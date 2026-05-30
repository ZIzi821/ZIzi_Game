import { firebaseConfig } from "./firebase-config.js";
import {
  addPendingSyncItem,
  cleanText,
  createIssueUrlFromItems,
  makeSyncId,
  openIssueForItems
} from "./sync-code.js";

const VALID_GAMES = new Set(["starfall", "sentinel", "chomp"]);
const VALID_CHOMP_LEVELS = new Set(["level1", "level2", "level3"]);
const MAX_NAME = 20;
const MAX_SCORE = 999999999;
const TOP_LIMIT = 20;
const READ_LIMIT = 50;
const FIREBASE_TIMEOUT_MS = 3500;
const CACHE_URL = new URL("../data/leaderboards.json", import.meta.url);

let firebasePromise;

function normalizeScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_SCORE, Math.floor(value)));
}

function formatTime(value) {
  if (!value) return "Just now";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function createdAtMs(value) {
  if (!value) return Date.now();
  if (typeof value.toMillis === "function") return value.toMillis();
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    })
  ]);
}

function normalizeLevelId(gameId, levelId = "") {
  const cleanLevelId = cleanText(levelId, 40);
  if (gameId !== "chomp") return "";
  return VALID_CHOMP_LEVELS.has(cleanLevelId) ? cleanLevelId : "level1";
}

function getScoreCollection(firebase, gameId, levelId = "") {
  const cleanLevelId = normalizeLevelId(gameId, levelId);
  if (gameId === "chomp") {
    return firebase.collection(firebase.db, "leaderboards", gameId, "levels", cleanLevelId, "scores");
  }
  return firebase.collection(firebase.db, "leaderboards", gameId, "scores");
}

function getScorePath(gameId, levelId = "") {
  const cleanLevelId = normalizeLevelId(gameId, levelId);
  return gameId === "chomp"
    ? `leaderboards/${gameId}/levels/${cleanLevelId}/scores`
    : `leaderboards/${gameId}/scores`;
}

function mapScoreDoc(doc) {
  const data = typeof doc.data === "function" ? doc.data() : doc;
  return {
    id: doc.id || data.id || "",
    nickname: cleanText(data.nickname, MAX_NAME) || "Anonymous",
    score: normalizeScore(data.score),
    createdAt: data.createdAt,
    sourceRegion: data.sourceRegion || "",
    orderTime: createdAtMs(data.createdAt)
  };
}

function sortRows(rows, limit = TOP_LIMIT) {
  return rows
    .map(mapScoreDoc)
    .sort((a, b) => b.score - a.score || a.orderTime - b.orderTime)
    .slice(0, limit);
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

async function fetchFirebaseRows(gameId, levelId, limitCount) {
  const firebase = await getFirebase();
  const ref = getScoreCollection(firebase, gameId, levelId);
  const scoresQuery = firebase.query(ref, firebase.orderBy("score", "desc"), firebase.limit(limitCount));
  const snapshot = await firebase.getDocs(scoresQuery);
  return sortRows(snapshot.docs, limitCount);
}

async function fetchCachedRows(gameId, levelId, limitCount) {
  const response = await fetch(CACHE_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Cache request failed: ${response.status}`);
  const payload = await response.json();
  const source = gameId === "chomp"
    ? payload?.leaderboards?.chomp?.[normalizeLevelId(gameId, levelId)]
    : payload?.leaderboards?.[gameId];
  return sortRows(Array.isArray(source) ? source : [], limitCount);
}

export async function fetchLeaderboardRows({ gameId, levelId = "", limit = 5, preferCache = false } = {}) {
  if (!VALID_GAMES.has(gameId)) throw new Error(`Unknown leaderboard gameId: ${gameId}`);
  const cleanLevelId = normalizeLevelId(gameId, levelId);
  if (preferCache) return fetchCachedRows(gameId, cleanLevelId, limit);
  try {
    return await withTimeout(fetchFirebaseRows(gameId, cleanLevelId, limit), FIREBASE_TIMEOUT_MS, "Firebase leaderboard");
  } catch (error) {
    console.warn("[ZIzi Leaderboard] Firebase read fell back to cache:", error);
    return fetchCachedRows(gameId, cleanLevelId, limit);
  }
}

function normalizeLevels(levels) {
  if (!Array.isArray(levels) || !levels.length) return [];
  return levels
    .map((level, index) => {
      const id = cleanText(level?.id ?? level?.value ?? index + 1, 40).replace(/[^a-zA-Z0-9_-]/g, "-");
      const name = cleanText(level?.name ?? level?.label ?? id, 80);
      return id ? { id, name: name || id } : null;
    })
    .filter(Boolean);
}

function injectStyles() {
  if (document.getElementById("zizi-leaderboard-style")) return;
  const style = document.createElement("style");
  style.id = "zizi-leaderboard-style";
  style.textContent = `
    .zizi-lb-button { position: fixed; right: clamp(14px, 3vw, 28px); bottom: clamp(14px, 3vw, 28px); z-index: 80; border: 1px solid rgba(124, 229, 255, 0.45); border-radius: 999px; padding: 12px 18px; color: #eafaff; background: linear-gradient(135deg, rgba(13, 27, 45, 0.94), rgba(38, 36, 54, 0.94)); box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42); font: 800 14px/1.2 system-ui, sans-serif; cursor: pointer; letter-spacing: 0; }
    .zizi-lb-button.is-inline { position: static; display: inline-flex; align-items: center; justify-content: center; width: 100%; min-height: 42px; padding: 10px 13px; font-size: 13px; }
    .zizi-lb-modal { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: 18px; background: rgba(4, 8, 15, 0.78); backdrop-filter: blur(12px); }
    .zizi-lb-modal[hidden], .zizi-lb-form[hidden], .zizi-lb-note[hidden], .zizi-lb-pending[hidden] { display: none; }
    .zizi-lb-panel { width: min(720px, 100%); max-height: min(760px, 92vh); overflow: auto; border: 1px solid rgba(126, 226, 255, 0.32); border-radius: 8px; color: #eefbff; background: linear-gradient(180deg, rgba(13, 27, 45, 0.98), rgba(7, 12, 22, 0.98)); box-shadow: 0 28px 80px rgba(0, 0, 0, 0.58); }
    .zizi-lb-head { display: flex; gap: 12px; align-items: start; justify-content: space-between; padding: 22px 22px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
    .zizi-lb-head h2 { margin: 0; font-size: clamp(22px, 4vw, 34px); letter-spacing: 0; }
    .zizi-lb-head p, .zizi-lb-note, .zizi-lb-status { margin: 6px 0 0; color: rgba(222, 245, 255, 0.74); font-size: 13px; line-height: 1.45; }
    .zizi-lb-body { padding: 18px 22px 22px; }
    .zizi-lb-close, .zizi-lb-submit, .zizi-lb-region, .zizi-lb-sync, .zizi-lb-copy { border: 1px solid rgba(126, 226, 255, 0.34); border-radius: 8px; padding: 10px 14px; color: #effcff; background: rgba(255, 255, 255, 0.08); cursor: pointer; font: 800 13px/1 system-ui, sans-serif; }
    .zizi-lb-actions, .zizi-lb-form, .zizi-lb-pending-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
    .zizi-lb-submit, .zizi-lb-sync { background: linear-gradient(135deg, #52d9d0, #ffc857); border-color: transparent; color: #07111c; }
    .zizi-lb-form { padding: 14px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; background: rgba(255, 255, 255, 0.045); }
    .zizi-lb-form label { display: grid; gap: 7px; flex: 1 1 190px; color: rgba(235, 250, 255, 0.76); font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .zizi-lb-form input, .zizi-lb-level-select, .zizi-lb-pending textarea { width: 100%; box-sizing: border-box; border: 1px solid rgba(126, 226, 255, 0.3); border-radius: 8px; padding: 11px 12px; color: #effcff; background: rgba(2, 7, 14, 0.76); outline: none; font: 700 14px/1.2 system-ui, sans-serif; }
    .zizi-lb-level-select { margin-top: 10px; }
    .zizi-lb-list { display: grid; gap: 8px; margin-top: 12px; }
    .zizi-lb-row { display: grid; grid-template-columns: 54px minmax(0, 1fr) 120px 126px; gap: 10px; align-items: center; min-height: 44px; padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 8px; background: rgba(255, 255, 255, 0.045); }
    .zizi-lb-row.is-head { min-height: 28px; color: rgba(220, 241, 255, 0.62); background: transparent; border-color: transparent; font-size: 12px; text-transform: uppercase; }
    .zizi-lb-rank { color: #83f2e9; font-weight: 900; }
    .zizi-lb-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 800; }
    .zizi-lb-score { color: #ffe08a; font-weight: 900; text-align: right; }
    .zizi-lb-time { color: rgba(220, 241, 255, 0.68); font-size: 12px; text-align: right; }
    .zizi-lb-empty, .zizi-lb-pending { padding: 14px; border: 1px dashed rgba(126, 226, 255, 0.28); border-radius: 8px; color: rgba(229, 246, 255, 0.72); }
    .zizi-lb-pending textarea { min-height: 96px; margin: 10px 0; resize: vertical; }
    @media (max-width: 620px) { .zizi-lb-row { grid-template-columns: 40px minmax(0, 1fr) 86px; } .zizi-lb-time, .zizi-lb-row.is-head .zizi-lb-time { display: none; } }
  `;
  document.head.appendChild(style);
}

function makeHeadRow() {
  const row = document.createElement("div");
  row.className = "zizi-lb-row is-head";
  ["Rank", "Nickname", "Score", "Time"].forEach((text, index) => {
    const cell = document.createElement("span");
    cell.textContent = text;
    if (index === 0) cell.className = "zizi-lb-rank";
    if (index === 1) cell.className = "zizi-lb-name";
    if (index === 2) cell.className = "zizi-lb-score";
    if (index === 3) cell.className = "zizi-lb-time";
    row.appendChild(cell);
  });
  return row;
}

function makeRow({ rank, nickname, score, createdAt }, scoreFormatter) {
  const row = document.createElement("div");
  row.className = "zizi-lb-row";
  const rankEl = document.createElement("span");
  rankEl.className = "zizi-lb-rank";
  rankEl.textContent = `#${rank}`;
  const nameEl = document.createElement("span");
  nameEl.className = "zizi-lb-name";
  nameEl.textContent = nickname || "Anonymous";
  const scoreEl = document.createElement("span");
  scoreEl.className = "zizi-lb-score";
  scoreEl.textContent = scoreFormatter(score);
  const timeEl = document.createElement("span");
  timeEl.className = "zizi-lb-time";
  timeEl.textContent = formatTime(createdAt);
  row.append(rankEl, nameEl, scoreEl, timeEl);
  return row;
}

export function setupLeaderboard({ gameId, gameName, scoreFormatter, levels, getLevelId, buttonContainer, buttonLabel } = {}) {
  if (!VALID_GAMES.has(gameId)) throw new Error(`Unknown leaderboard gameId: ${gameId}`);
  injectStyles();

  const levelOptions = normalizeLevels(levels);
  const hasLevels = levelOptions.length > 0;
  const formatScore = scoreFormatter || ((score) => Number(score || 0).toLocaleString("zh-CN"));
  let pendingScore = null;
  let pendingLevelId = null;
  let selectedRegion = "international";
  let selectedLevelId = hasLevels ? levelOptions[0].id : "";
  let lastPendingItem = null;

  const getCurrentLevelId = () => {
    const requested = typeof getLevelId === "function" ? getLevelId() : selectedLevelId;
    const requestedText = cleanText(requested, 40);
    return hasLevels && levelOptions.some((level) => level.id === requestedText) ? requestedText : selectedLevelId;
  };
  const getBoardLevelId = () => (hasLevels ? selectedLevelId : "");
  const getBoardName = () => {
    const level = levelOptions.find((option) => option.id === selectedLevelId);
    return hasLevels ? `${gameName || gameId} - ${level?.name || selectedLevelId}` : gameName || gameId;
  };

  const button = document.createElement("button");
  button.className = buttonContainer ? "zizi-lb-button is-inline" : "zizi-lb-button";
  button.type = "button";
  button.textContent = buttonLabel || "Leaderboard";

  const modal = document.createElement("section");
  modal.className = "zizi-lb-modal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const panel = document.createElement("div");
  panel.className = "zizi-lb-panel";
  const head = document.createElement("div");
  head.className = "zizi-lb-head";
  const titleWrap = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = "Leaderboard";
  const subtitle = document.createElement("p");
  subtitle.textContent = getBoardName();
  titleWrap.append(title, subtitle);
  const levelSelect = document.createElement("select");
  levelSelect.className = "zizi-lb-level-select";
  levelSelect.hidden = !hasLevels;
  levelOptions.forEach((level) => {
    const option = document.createElement("option");
    option.value = level.id;
    option.textContent = level.name;
    levelSelect.appendChild(option);
  });
  titleWrap.appendChild(levelSelect);
  const close = document.createElement("button");
  close.className = "zizi-lb-close";
  close.type = "button";
  close.textContent = "Back";
  head.append(titleWrap, close);

  const body = document.createElement("div");
  body.className = "zizi-lb-body";
  const actions = document.createElement("div");
  actions.className = "zizi-lb-actions";
  const internationalButton = document.createElement("button");
  internationalButton.className = "zizi-lb-region";
  internationalButton.type = "button";
  internationalButton.textContent = "International / Firebase";
  const mainlandButton = document.createElement("button");
  mainlandButton.className = "zizi-lb-region";
  mainlandButton.type = "button";
  mainlandButton.textContent = "Mainland / Cache";
  actions.append(internationalButton, mainlandButton);

  const form = document.createElement("form");
  form.className = "zizi-lb-form";
  form.hidden = true;
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Nickname";
  const nameInput = document.createElement("input");
  nameInput.name = "nickname";
  nameInput.maxLength = MAX_NAME;
  nameInput.placeholder = "20 characters max";
  nameInput.autocomplete = "nickname";
  nameLabel.appendChild(nameInput);
  const scoreLabel = document.createElement("label");
  scoreLabel.textContent = "Score";
  const scoreInput = document.createElement("input");
  scoreInput.name = "score";
  scoreInput.readOnly = true;
  scoreLabel.appendChild(scoreInput);
  const submit = document.createElement("button");
  submit.className = "zizi-lb-submit";
  submit.type = "submit";
  submit.textContent = "Submit score";
  form.append(nameLabel, scoreLabel, submit);

  const note = document.createElement("p");
  note.className = "zizi-lb-note";
  const status = document.createElement("p");
  status.className = "zizi-lb-status";
  status.setAttribute("aria-live", "polite");
  const list = document.createElement("div");
  list.className = "zizi-lb-list";
  list.appendChild(makeHeadRow());

  const pendingPanel = document.createElement("div");
  pendingPanel.className = "zizi-lb-pending";
  pendingPanel.hidden = true;
  const pendingText = document.createElement("textarea");
  pendingText.readOnly = true;
  const pendingActions = document.createElement("div");
  pendingActions.className = "zizi-lb-pending-actions";
  const syncButton = document.createElement("button");
  syncButton.className = "zizi-lb-sync";
  syncButton.type = "button";
  syncButton.textContent = "Submit to GitHub Sync Inbox";
  const copyButton = document.createElement("button");
  copyButton.className = "zizi-lb-copy";
  copyButton.type = "button";
  copyButton.textContent = "Copy GitHub Issue link";
  pendingActions.append(syncButton, copyButton);
  pendingPanel.append("Firebase is unavailable. Your score was saved locally and can be submitted through GitHub sync.", pendingText, pendingActions);

  body.append(actions, form, note, status, list, pendingPanel);
  panel.append(head, body);
  modal.appendChild(panel);
  (buttonContainer || document.body).appendChild(button);
  document.body.appendChild(modal);

  function setStatus(text, isError = false) {
    status.textContent = text;
    status.style.color = isError ? "#ff9a9a" : "rgba(222, 245, 255, 0.74)";
  }

  function renderRows(rows) {
    list.replaceChildren(makeHeadRow());
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "zizi-lb-empty";
      empty.textContent = "No scores yet.";
      list.appendChild(empty);
      return;
    }
    rows.forEach((row, index) => {
      list.appendChild(makeRow({ ...row, rank: index + 1 }, formatScore));
    });
  }

  async function loadScores() {
    pendingPanel.hidden = true;
    subtitle.textContent = getBoardName();
    const levelId = getBoardLevelId();
    const preferCache = selectedRegion === "mainland";
    note.hidden = false;
    note.textContent = preferCache
      ? "Cache leaderboard, may not be latest."
      : "Firebase first. If Firebase times out, this view falls back to the latest exported cache.";
    setStatus("Loading leaderboard...");
    try {
      const rows = await fetchLeaderboardRows({ gameId, levelId, limit: TOP_LIMIT, preferCache });
      renderRows(rows);
      setStatus(preferCache ? "Cache leaderboard loaded." : "Leaderboard loaded.");
    } catch (error) {
      console.warn("[ZIzi Leaderboard] Read failed:", error);
      renderRows([]);
      setStatus("Leaderboard unavailable.", true);
    }
  }

  function showPendingSync(item) {
    lastPendingItem = item;
    pendingText.value = createIssueUrlFromItems([item]);
    pendingPanel.hidden = false;
  }

  function open(showSubmit = false) {
    if (showSubmit && hasLevels && pendingLevelId) {
      selectedLevelId = pendingLevelId;
      levelSelect.value = selectedLevelId;
    } else if (hasLevels) {
      selectedLevelId = getCurrentLevelId();
      levelSelect.value = selectedLevelId;
    }
    modal.hidden = false;
    form.hidden = !showSubmit;
    if (showSubmit) nameInput.focus();
    loadScores();
  }

  button.addEventListener("click", () => open(false));
  close.addEventListener("click", () => {
    modal.hidden = true;
  });
  internationalButton.addEventListener("click", () => {
    selectedRegion = "international";
    loadScores();
  });
  mainlandButton.addEventListener("click", () => {
    selectedRegion = "mainland";
    loadScores();
  });
  levelSelect.addEventListener("change", () => {
    selectedLevelId = levelSelect.value;
    loadScores();
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.hidden = true;
  });
  window.addEventListener("keydown", (event) => {
    if (!modal.hidden && event.key === "Escape") modal.hidden = true;
  });
  syncButton.addEventListener("click", () => {
    if (lastPendingItem) openIssueForItems([lastPendingItem]);
  });
  copyButton.addEventListener("click", async () => {
    if (!lastPendingItem) return;
    await navigator.clipboard?.writeText(createIssueUrlFromItems([lastPendingItem]));
    setStatus("GitHub Issue link copied.");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nickname = cleanText(nameInput.value, MAX_NAME);
    const score = normalizeScore(pendingScore);
    const levelId = getBoardLevelId();
    if (!nickname) {
      setStatus("Please enter a nickname.", true);
      return;
    }
    submit.disabled = true;
    setStatus("Submitting score...");
    const pendingItem = {
      id: makeSyncId(),
      type: "score",
      gameId,
      levelId,
      nickname,
      score,
      createdAt: new Date().toISOString(),
      sourceRegion: selectedRegion === "mainland" ? "mainland" : "international"
    };
    try {
      if (selectedRegion === "mainland") throw new Error("Mainland score submissions use GitHub sync.");
      const firebase = await getFirebase();
      const ref = getScoreCollection(firebase, gameId, levelId);
      const data = { nickname, score, gameId, createdAt: firebase.serverTimestamp() };
      if (gameId === "chomp") data.levelId = levelId;
      await withTimeout(firebase.addDoc(ref, data), FIREBASE_TIMEOUT_MS, "Firebase score submit");
      form.hidden = true;
      setStatus("Score submitted to Firebase.");
      await loadScores();
    } catch (error) {
      console.warn("[ZIzi Leaderboard] Score queued for GitHub sync:", {
        path: getScorePath(gameId, levelId),
        error
      });
      const saved = addPendingSyncItem(pendingItem);
      showPendingSync(saved);
      setStatus("Firebase is unavailable. Score saved locally for GitHub sync.", true);
    } finally {
      submit.disabled = false;
    }
  });

  return {
    open,
    openSubmit(score) {
      pendingScore = normalizeScore(score);
      pendingLevelId = hasLevels ? getCurrentLevelId() : "";
      scoreInput.value = formatScore(pendingScore);
      open(true);
    },
    destroy() {
      button.remove();
      modal.remove();
    }
  };
}
