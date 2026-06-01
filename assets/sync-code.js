const PENDING_KEY = "ziziPendingSyncItems";
const MAX_NAME = 20;
const MAX_MESSAGE = 300;
const MAX_SCORE = 999999999;
const VALID_GAMES = new Set(["starfall", "sentinel", "chomp"]);
const VALID_CHOMP_LEVELS = new Set(["level1", "level2", "level3", "level4"]);
const ISSUE_URL = "https://github.com/ZIzi821/ZIzi_Game/issues/new";

function textToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToText(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function cleanText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanMessage(value, max = MAX_MESSAGE) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, max);
}

export function makeSyncId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `zizi_${Date.now()}_${random}`;
}

function normalizeCreatedAt(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function normalizeSyncItem(item) {
  const type = item?.type === "score" ? "score" : item?.type === "comment" ? "comment" : "";
  const id = cleanText(item?.id, 80).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!type || !id) throw new Error("Each sync item needs a valid type and id.");

  const base = {
    id,
    type,
    nickname: cleanText(item?.nickname, MAX_NAME),
    createdAt: normalizeCreatedAt(item?.createdAt),
    sourceRegion: cleanText(item?.sourceRegion || "web", 20) || "web"
  };
  if (!base.nickname) throw new Error("Nickname is required.");

  if (type === "comment") {
    const message = cleanMessage(item?.message, MAX_MESSAGE);
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
  return {
    ...base,
    gameId,
    levelId: gameId === "chomp" ? levelId : "",
    score
  };
}

export function createSyncCode(items) {
  const normalizedItems = (Array.isArray(items) ? items : [items]).map(normalizeSyncItem);
  return `ZIZI-SYNC:${textToBase64(JSON.stringify({ version: 1, items: normalizedItems }))}`;
}

export function parseSyncCode(code) {
  const match = String(code || "").match(/ZIZI-SYNC:([A-Za-z0-9+/=_-]+)/);
  if (!match) throw new Error("No ZIZI-SYNC code found.");
  const payload = JSON.parse(base64ToText(match[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (payload?.version !== 1 || !Array.isArray(payload.items)) throw new Error("Unsupported sync payload.");
  return {
    version: 1,
    items: payload.items.map(normalizeSyncItem)
  };
}

function readPendingItems() {
  try {
    if (typeof localStorage === "undefined") return [];
    return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

function writePendingItems(items) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(PENDING_KEY, JSON.stringify(items.slice(-100)));
  } catch (_) {
    // Some browsers disable storage in private or restricted contexts.
  }
}

export function getPendingSyncItems() {
  return readPendingItems()
    .map((item) => {
      try {
        return normalizeSyncItem(item);
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

export function addPendingSyncItem(item) {
  const normalized = normalizeSyncItem(item);
  const current = readPendingItems().filter((entry) => entry?.id !== normalized.id);
  current.push(normalized);
  writePendingItems(current);
  return normalized;
}

export function removePendingSyncItem(id) {
  writePendingItems(readPendingItems().filter((entry) => entry?.id !== id));
}

export function clearPendingSyncItems() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(PENDING_KEY);
  } catch (_) {
    // Ignore storage failures in restricted browser contexts.
  }
}

export function createIssueUrlFromItems(items) {
  const code = createSyncCode(items);
  const body = [
    "This is a ZIzi Game sync submission.",
    "",
    "Please do not edit the sync code below.",
    "",
    code
  ].join("\n");
  const params = new URLSearchParams({
    title: "[ZIzi Sync] Pending Submission",
    body,
    labels: "zizi-sync,pending"
  });
  return `${ISSUE_URL}?${params.toString()}`;
}

export function openIssueForItems(items) {
  window.open(createIssueUrlFromItems(items), "_blank", "noopener,noreferrer");
}

export const syncCode = {
  addPendingSyncItem,
  clearPendingSyncItems,
  cleanMessage,
  cleanText,
  createIssueUrlFromItems,
  createSyncCode,
  getPendingSyncItems,
  makeSyncId,
  normalizeSyncItem,
  openIssueForItems,
  parseSyncCode,
  removePendingSyncItem
};

if (typeof window !== "undefined") {
  window.ZIziSync = syncCode;
}
