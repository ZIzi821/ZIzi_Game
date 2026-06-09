import fs from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const MAX_NAME = 20;
const MAX_MESSAGE = 300;
const MAX_SCORE = 999999999;

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

function timestampToIso(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function initializeFirebaseAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON secret.");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(raw))
    });
  }
  return admin.firestore();
}

export async function exportComments(db) {
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

export async function exportLeaderboards(db) {
  const leaderboards = {
    starfall: await exportScorePath(db.collection("leaderboards").doc("starfall").collection("scores")),
    sentinel: await exportScorePath(db.collection("leaderboards").doc("sentinel").collection("scores")),
    bluecrowd: await exportScorePath(db.collection("leaderboards").doc("bluecrowd").collection("scores")),
    tangsprint: {
      level1: await exportScorePath(db.collection("leaderboards").doc("tangsprint").collection("levels").doc("level1").collection("scores")),
      level2: await exportScorePath(db.collection("leaderboards").doc("tangsprint").collection("levels").doc("level2").collection("scores")),
      level3: await exportScorePath(db.collection("leaderboards").doc("tangsprint").collection("levels").doc("level3").collection("scores")),
      level4: await exportScorePath(db.collection("leaderboards").doc("tangsprint").collection("levels").doc("level4").collection("scores"))
    },
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

export async function exportAll(db = initializeFirebaseAdmin()) {
  await exportComments(db);
  await exportLeaderboards(db);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  exportAll().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
