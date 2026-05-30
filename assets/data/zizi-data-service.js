import { firebaseConfig } from "../firebase-config.js";

const API_BASE = "https://zizi-game-api.ehsshshshhs526272828272828.workers.dev";
const VALID_GAMES = new Set(["starfall", "sentinel", "chomp"]);
const VALID_CHOMP_LEVELS = new Set(["level1", "level2", "level3"]);
const MAX_SCORE = 999999999;

let firebasePromise;

function cleanText(value, max = 100) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanMessage(value, max = 300) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, max);
}

function normalizeScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_SCORE, Math.floor(value)));
}

function normalizeLimit(limit, fallback, max) {
  const value = Number.parseInt(limit, 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, max);
}

function normalizeLevelId(gameId, levelId = "") {
  const cleanLevelId = cleanText(levelId, 40);
  if (gameId !== "chomp") return "";
  return VALID_CHOMP_LEVELS.has(cleanLevelId) ? cleanLevelId : "";
}

function createdAtMs(value) {
  if (!value) return Date.now();
  if (typeof value.toMillis === "function") return value.toMillis();
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
}

function normalizeItem(row = {}) {
  const playerName = cleanText(row.playerName ?? row.player_name ?? row.nickname ?? "Anonymous", 24) || "Anonymous";
  const createdAt = row.createdAt ?? row.created_at ?? row.time ?? null;
  return {
    id: row.id || row.externalId || row.external_id || "",
    gameId: cleanText(row.gameId ?? row.game_id ?? "", 40),
    levelId: cleanText(row.levelId ?? row.level_id ?? "", 40),
    playerName,
    nickname: playerName,
    score: normalizeScore(row.score),
    region: cleanText(row.region || "global", 24),
    source: cleanText(row.source || "cloudflare", 24),
    createdAt,
    orderTime: createdAtMs(createdAt)
  };
}

function normalizeComment(row = {}) {
  const playerName = cleanText(row.playerName ?? row.player_name ?? row.nickname ?? "Anonymous", 24) || "Anonymous";
  const createdAt = row.createdAt ?? row.created_at ?? null;
  return {
    id: row.id || row.externalId || row.external_id || "",
    playerName,
    nickname: playerName,
    message: String(row.message || ""),
    region: cleanText(row.region || "global", 24),
    source: cleanText(row.source || "cloudflare", 24),
    createdAt,
    orderTime: createdAtMs(createdAt)
  };
}

function okItems(items) {
  return { ok: true, items };
}

function fail(error) {
  return { ok: false, error: error instanceof Error ? error.message : String(error || "Request failed") };
}

function buildUrl(path, params = {}) {
  const url = new URL(path, API_BASE);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function apiGet(path, params) {
  const response = await fetch(buildUrl(path, params), {
    method: "GET",
    headers: { Accept: "application/json" }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function apiPost(path, body) {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function getFirebase() {
  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
    ]).then(([appModule, firestoreModule]) => {
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(firebaseConfig);
      return {
        db: firestoreModule.getFirestore(app),
        addDoc: firestoreModule.addDoc,
        collection: firestoreModule.collection,
        getDocs: firestoreModule.getDocs,
        limit: firestoreModule.limit,
        orderBy: firestoreModule.orderBy,
        query: firestoreModule.query,
        serverTimestamp: firestoreModule.serverTimestamp
      };
    });
  }
  return firebasePromise;
}

function scoreCollection(firebase, gameId, levelId = "") {
  const cleanLevelId = normalizeLevelId(gameId, levelId);
  if (cleanLevelId) {
    return firebase.collection(firebase.db, "leaderboards", gameId, "levels", cleanLevelId, "scores");
  }
  return firebase.collection(firebase.db, "leaderboards", gameId, "scores");
}

async function firebaseLeaderboard(gameId, { levelId = "", limit = 10 } = {}) {
  const firebase = await getFirebase();
  const ref = scoreCollection(firebase, gameId, levelId);
  const scoresQuery = firebase.query(ref, firebase.orderBy("score", "desc"), firebase.limit(normalizeLimit(limit, 10, 50)));
  const snapshot = await firebase.getDocs(scoresQuery);
  const items = snapshot.docs
    .map((doc) => normalizeItem({ ...doc.data(), id: doc.id, gameId, levelId }))
    .sort((a, b) => b.score - a.score || a.orderTime - b.orderTime)
    .slice(0, normalizeLimit(limit, 10, 50));
  return okItems(items);
}

async function firebaseSubmitScore(gameId, scoreData = {}) {
  const firebase = await getFirebase();
  const levelId = normalizeLevelId(gameId, scoreData.levelId);
  const playerName = cleanText(scoreData.playerName || scoreData.nickname, 24);
  const score = normalizeScore(scoreData.score);
  if (!playerName) throw new Error("playerName is required");
  const ref = scoreCollection(firebase, gameId, levelId);
  const data = {
    nickname: playerName,
    score,
    gameId,
    createdAt: firebase.serverTimestamp()
  };
  if (levelId) data.levelId = levelId;
  await firebase.addDoc(ref, data);
  return { ok: true, item: normalizeItem({ ...data, playerName, createdAt: new Date().toISOString() }) };
}

async function firebaseComments({ limit = 50 } = {}) {
  const firebase = await getFirebase();
  const messagesRef = firebase.collection(firebase.db, "messages");
  const messagesQuery = firebase.query(messagesRef, firebase.orderBy("createdAt", "desc"), firebase.limit(normalizeLimit(limit, 50, 100)));
  const snapshot = await firebase.getDocs(messagesQuery);
  return okItems(snapshot.docs.map((doc) => normalizeComment({ ...doc.data(), id: doc.id })));
}

async function firebaseAddComment(commentData = {}) {
  const firebase = await getFirebase();
  const playerName = cleanText(commentData.playerName || commentData.nickname, 24);
  const message = cleanMessage(commentData.message, 300);
  if (!playerName) throw new Error("playerName is required");
  if (!message) throw new Error("message is required");
  const messagesRef = firebase.collection(firebase.db, "messages");
  await firebase.addDoc(messagesRef, {
    nickname: playerName,
    message,
    createdAt: firebase.serverTimestamp()
  });
  return { ok: true, item: normalizeComment({ playerName, message, createdAt: new Date().toISOString() }) };
}

async function getLeaderboard(gameId, options = {}) {
  if (!VALID_GAMES.has(gameId)) return { ok: false, error: `Unknown gameId: ${gameId}` };
  const levelId = normalizeLevelId(gameId, options.levelId);
  const limit = normalizeLimit(options.limit, 10, 50);
  try {
    const data = await apiGet("/leaderboards", { gameId, levelId, limit });
    return okItems((data.items || []).map(normalizeItem));
  } catch (error) {
    console.warn("[ZiZiData] Cloudflare leaderboard failed, falling back to Firebase:", error);
    try {
      return await firebaseLeaderboard(gameId, { levelId, limit });
    } catch (fallbackError) {
      console.error("[ZiZiData] Firebase leaderboard fallback failed:", fallbackError);
      return fail(error);
    }
  }
}

async function submitScore(gameId, scoreData = {}) {
  if (!VALID_GAMES.has(gameId)) return { ok: false, error: `Unknown gameId: ${gameId}` };
  const levelId = normalizeLevelId(gameId, scoreData.levelId);
  const playerName = cleanText(scoreData.playerName || scoreData.nickname, 24);
  const score = normalizeScore(scoreData.score);
  const payload = {
    gameId,
    levelId,
    playerName,
    score,
    region: cleanText(scoreData.region || "global", 24)
  };
  try {
    const data = await apiPost("/leaderboards", payload);
    return { ok: true, item: normalizeItem(data.item || payload) };
  } catch (error) {
    console.warn("[ZiZiData] Cloudflare score submission failed, falling back to Firebase:", error);
    try {
      return await firebaseSubmitScore(gameId, payload);
    } catch (fallbackError) {
      console.error("[ZiZiData] Firebase score fallback failed:", fallbackError);
      return fail(error);
    }
  }
}

async function getLeaderboardOverview(options = {}) {
  const limit = normalizeLimit(options.limit, 5, 50);
  try {
    const data = await apiGet("/leaderboard-overview", { limit });
    const items = {};
    for (const gameId of VALID_GAMES) {
      items[gameId] = ((data.items && data.items[gameId]) || []).map(normalizeItem);
    }
    return okItems(items);
  } catch (error) {
    console.warn("[ZiZiData] Cloudflare overview failed, falling back to Firebase:", error);
    const entries = await Promise.all([...VALID_GAMES].map(async (gameId) => {
      const result = await firebaseLeaderboard(gameId, { limit });
      return [gameId, result.ok ? result.items : []];
    }));
    return okItems(Object.fromEntries(entries));
  }
}

async function getComments(options = {}) {
  const limit = normalizeLimit(options.limit, 50, 100);
  try {
    const data = await apiGet("/comments", { limit });
    return okItems((data.items || []).map(normalizeComment));
  } catch (error) {
    console.warn("[ZiZiData] Cloudflare comments failed, falling back to Firebase:", error);
    try {
      return await firebaseComments({ limit });
    } catch (fallbackError) {
      console.error("[ZiZiData] Firebase comments fallback failed:", fallbackError);
      return fail(error);
    }
  }
}

async function addComment(commentData = {}) {
  const payload = {
    playerName: cleanText(commentData.playerName || commentData.nickname, 24),
    message: cleanMessage(commentData.message, 300),
    region: cleanText(commentData.region || "global", 24)
  };
  try {
    const data = await apiPost("/comments", payload);
    return { ok: true, item: normalizeComment(data.item || payload) };
  } catch (error) {
    console.warn("[ZiZiData] Cloudflare comment submission failed, falling back to Firebase:", error);
    try {
      return await firebaseAddComment(payload);
    } catch (fallbackError) {
      console.error("[ZiZiData] Firebase comment fallback failed:", fallbackError);
      return fail(error);
    }
  }
}

export const ZiZiData = {
  API_BASE,
  getLeaderboard,
  submitScore,
  getLeaderboardOverview,
  getComments,
  addComment
};

window.ZiZiData = ZiZiData;
