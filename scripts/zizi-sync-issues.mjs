import fs from "node:fs/promises";
import process from "node:process";
import * as core from "@actions/core";
import * as github from "@actions/github";
import admin from "firebase-admin";
import { exportAll } from "./export-cache.mjs";

const MAX_NAME = 20;
const MAX_MESSAGE = 300;
const MAX_SCORE = 999999999;
const VALID_GAMES = new Set(["starfall", "sentinel", "chomp"]);
const VALID_CHOMP_LEVELS = new Set(["level1", "level2", "level3", "level4"]);
const SYNC_RE = /ZIZI-SYNC:([A-Za-z0-9+/=_-]+)/;

function cleanText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanMessage(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_MESSAGE);
}

function decodeBase64(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function normalizeItem(item) {
  const type = item?.type === "score" ? "score" : item?.type === "comment" ? "comment" : "";
  const id = cleanText(item?.id, 80).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!type || !id) throw new Error("Each sync item needs a valid type and id.");
  const createdAt = new Date(item?.createdAt || Date.now());
  const base = {
    id,
    type,
    nickname: cleanText(item?.nickname, MAX_NAME),
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
    sourceRegion: cleanText(item?.sourceRegion || "web", 20) || "web"
  };
  if (!base.nickname) throw new Error("Nickname is required.");
  if (type === "comment") {
    const message = cleanMessage(item?.message);
    if (!message) throw new Error("Message is required.");
    return { ...base, message };
  }
  const gameId = cleanText(item?.gameId, 20);
  const levelId = cleanText(item?.levelId, 20);
  const score = Number(item?.score);
  if (!VALID_GAMES.has(gameId)) throw new Error("Invalid gameId.");
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) throw new Error("Invalid score.");
  if (gameId === "chomp" && !VALID_CHOMP_LEVELS.has(levelId)) throw new Error("Invalid Chomp levelId.");
  if (gameId !== "chomp" && levelId) throw new Error("Only Chomp scores can include levelId.");
  return { ...base, gameId, levelId: gameId === "chomp" ? levelId : "", score };
}

function parseSyncItems(body) {
  const match = String(body || "").match(SYNC_RE);
  if (!match) throw new Error("No ZIZI-SYNC code found.");
  const payload = JSON.parse(decodeBase64(match[1]));
  if (payload?.version !== 1 || !Array.isArray(payload.items)) throw new Error("Unsupported sync payload.");
  return payload.items.map(normalizeItem);
}

function timestampToIso(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

async function ensureFirebase() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON secret.");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(raw))
    });
  }
  return admin.firestore();
}

async function commentExists(db, syncId) {
  const snapshot = await db.collection("messages").where("syncId", "==", syncId).limit(1).get();
  return !snapshot.empty;
}

async function scoreExists(db, syncId) {
  const refs = [
    db.collection("leaderboards").doc("starfall").collection("scores"),
    db.collection("leaderboards").doc("sentinel").collection("scores"),
    db.collection("leaderboards").doc("chomp").collection("levels").doc("level1").collection("scores"),
    db.collection("leaderboards").doc("chomp").collection("levels").doc("level2").collection("scores"),
    db.collection("leaderboards").doc("chomp").collection("levels").doc("level3").collection("scores"),
    db.collection("leaderboards").doc("chomp").collection("levels").doc("level4").collection("scores")
  ];
  for (const ref of refs) {
    const snapshot = await ref.where("syncId", "==", syncId).limit(1).get();
    if (!snapshot.empty) return true;
  }
  return false;
}

function scoreCollection(db, item) {
  if (item.gameId === "chomp") {
    return db.collection("leaderboards").doc(item.gameId).collection("levels").doc(item.levelId).collection("scores");
  }
  return db.collection("leaderboards").doc(item.gameId).collection("scores");
}

async function writeItem(db, item, issueNumber) {
  if (item.type === "comment") {
    if (await commentExists(db, item.id)) return { skipped: true, id: item.id };
    await db.collection("messages").add({
      nickname: item.nickname,
      message: item.message,
      createdAt: admin.firestore.Timestamp.fromDate(item.createdAt),
      sourceRegion: item.sourceRegion,
      syncId: item.id,
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      sourceIssueNumber: issueNumber
    });
    return { skipped: false, id: item.id };
  }
  if (await scoreExists(db, item.id)) return { skipped: true, id: item.id };
  const data = {
    nickname: item.nickname,
    score: item.score,
    gameId: item.gameId,
    createdAt: admin.firestore.Timestamp.fromDate(item.createdAt),
    sourceRegion: item.sourceRegion,
    syncId: item.id,
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    sourceIssueNumber: issueNumber
  };
  if (item.gameId === "chomp") data.levelId = item.levelId;
  await scoreCollection(db, item).add(data);
  return { skipped: false, id: item.id };
}

async function exportComments(db) {
  const snapshot = await db.collection("messages").orderBy("createdAt", "desc").limit(100).get();
  const comments = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      nickname: cleanText(data.nickname, MAX_NAME),
      message: cleanMessage(data.message),
      createdAt: timestampToIso(data.createdAt),
      sourceRegion: cleanText(data.sourceRegion || "", 20)
    };
  });
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile("data/comments.json", `${JSON.stringify({ updatedAt: new Date().toISOString(), comments }, null, 2)}\n`);
}

async function exportScorePath(ref) {
  const snapshot = await ref.orderBy("score", "desc").limit(80).get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        nickname: cleanText(data.nickname, MAX_NAME),
        score: Math.max(0, Math.min(MAX_SCORE, Number(data.score) || 0)),
        createdAt: timestampToIso(data.createdAt),
        sourceRegion: cleanText(data.sourceRegion || "", 20)
      };
    })
    .sort((a, b) => b.score - a.score || new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, 50);
}

async function exportLeaderboards(db) {
  const leaderboards = {
    starfall: await exportScorePath(db.collection("leaderboards").doc("starfall").collection("scores")),
    sentinel: await exportScorePath(db.collection("leaderboards").doc("sentinel").collection("scores")),
    chomp: {
      level1: await exportScorePath(db.collection("leaderboards").doc("chomp").collection("levels").doc("level1").collection("scores")),
      level2: await exportScorePath(db.collection("leaderboards").doc("chomp").collection("levels").doc("level2").collection("scores")),
      level3: await exportScorePath(db.collection("leaderboards").doc("chomp").collection("levels").doc("level3").collection("scores")),
      level4: await exportScorePath(db.collection("leaderboards").doc("chomp").collection("levels").doc("level4").collection("scores"))
    }
  };
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile("data/leaderboards.json", `${JSON.stringify({ updatedAt: new Date().toISOString(), leaderboards }, null, 2)}\n`);
}

async function ensureLabel(octokit, owner, repo, name, color) {
  try {
    await octokit.rest.issues.getLabel({ owner, repo, name });
  } catch (_) {
    await octokit.rest.issues.createLabel({ owner, repo, name, color });
  }
}

async function markIssue(octokit, owner, repo, issue, ok, message) {
  if (!issue) return;
  const labels = ok ? ["synced"] : ["sync-failed"];
  for (const label of labels) {
    await ensureLabel(octokit, owner, repo, label, ok ? "2da44e" : "d73a49");
  }
  await octokit.rest.issues.addLabels({ owner, repo, issue_number: issue.number, labels });
  await octokit.rest.issues.createComment({ owner, repo, issue_number: issue.number, body: message });
  if (ok) {
    await octokit.rest.issues.update({ owner, repo, issue_number: issue.number, state: "closed" });
  }
}

async function issuesToProcess(octokit, owner, repo) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const event = eventPath ? JSON.parse(await fs.readFile(eventPath, "utf8")) : github.context.payload;
  if (event.issue) return [event.issue];
  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo,
    state: "open",
    per_page: 100
  });
  return issues.filter((issue) => !issue.pull_request && String(issue.title || "").includes("[ZIzi Sync]"));
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN.");
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;
  const db = await ensureFirebase();
  const issues = await issuesToProcess(octokit, owner, repo);
  core.info(`Found ${issues.length} issue(s) to process.`);
  for (const issue of issues) {
    if (!String(issue.title || "").includes("[ZIzi Sync]")) continue;
    try {
      const items = parseSyncItems(issue.body);
      const results = [];
      for (const item of items) {
        results.push(await writeItem(db, item, issue.number));
      }
      await exportAll(db);
      const wrote = results.filter((result) => !result.skipped).length;
      const skipped = results.filter((result) => result.skipped).length;
      await markIssue(octokit, owner, repo, issue, true, `Synced to Firebase and cache files updated.\n\nNew items: ${wrote}\nSkipped duplicates: ${skipped}`);
    } catch (error) {
      core.error(error);
      await markIssue(octokit, owner, repo, issue, false, `Sync failed: ${error.message}`);
    }
  }
}

main().catch((error) => {
  core.setFailed(error.message);
});
