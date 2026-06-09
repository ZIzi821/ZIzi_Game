import { firebaseConfig } from "./firebase-config.js";
import {
  cleanText,
  createSyncCode,
  makeSyncId,
  openIssueForItems
} from "./sync-code.js";

const LEVEL_GAME_LEVELS = {
  chomp: ["level1", "level2", "level3", "level4"],
  tangsprint: ["level1", "level2", "level3", "level4"]
};
const LEVEL_GAME_SETS = Object.fromEntries(
  Object.entries(LEVEL_GAME_LEVELS).map(([gameId, levels]) => [gameId, new Set(levels)])
);
const VALID_GAMES = new Set(["starfall", "sentinel", "bluecrowd", ...Object.keys(LEVEL_GAME_LEVELS)]);
const MAX_NAME = 20;
const MAX_SCORE = 999999999;
const TOP_LIMIT = 20;
const FIREBASE_TIMEOUT_MS = 8000;
const CACHE_URL = new URL("../data/leaderboards.json", import.meta.url);

let firebasePromise;

function normalizeScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_SCORE, Math.floor(value)));
}

function formatTime(value) {
  if (!value) return "刚刚 / Just now";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚 / Just now";
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

function isLevelGame(gameId) {
  return Object.prototype.hasOwnProperty.call(LEVEL_GAME_SETS, gameId);
}

function normalizeLevelId(gameId, levelId = "") {
  const cleanLevelId = cleanText(levelId, 40);
  if (!isLevelGame(gameId)) return "";
  const levels = LEVEL_GAME_SETS[gameId];
  return levels.has(cleanLevelId) ? cleanLevelId : LEVEL_GAME_LEVELS[gameId][0];
}

function getScoreCollection(firebase, gameId, levelId = "") {
  if (isLevelGame(gameId)) {
    return firebase.collection(firebase.db, "leaderboards", gameId, "levels", normalizeLevelId(gameId, levelId), "scores");
  }
  return firebase.collection(firebase.db, "leaderboards", gameId, "scores");
}

function getScorePath(gameId, levelId = "") {
  if (isLevelGame(gameId)) return `leaderboards/${gameId}/levels/${normalizeLevelId(gameId, levelId)}/scores`;
  return `leaderboards/${gameId}/scores`;
}

function describeError(error) {
  return cleanText(error?.code || error?.message || String(error || "unknown error"), 140);
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
    ])
      .then(([appModule, firestoreModule]) => {
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
      })
      .catch((error) => {
        firebasePromise = undefined;
        throw error;
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
  const source = isLevelGame(gameId)
    ? payload?.leaderboards?.[gameId]?.[normalizeLevelId(gameId, levelId)]
    : payload?.leaderboards?.[gameId];
  return sortRows(Array.isArray(source) ? source : [], limitCount);
}

export async function fetchLeaderboardRows({ gameId, levelId = "", limit = 5 } = {}) {
  if (!VALID_GAMES.has(gameId)) throw new Error(`Unknown leaderboard gameId: ${gameId}`);
  const cleanLevelId = normalizeLevelId(gameId, levelId);
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
    .zizi-lb-button { position: fixed; right: clamp(14px, 3vw, 28px); bottom: clamp(14px, 3vw, 28px); z-index: 80; border: 1px solid rgba(91, 141, 239, 0.24); border-radius: 999px; padding: 12px 18px; color: #ffffff; background: linear-gradient(135deg, #18a999, #5b8def); box-shadow: 0 14px 30px rgba(77, 89, 121, 0.24); font: 800 14px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif; cursor: pointer; letter-spacing: 0; }
    .zizi-lb-button:hover, .zizi-lb-button:focus-visible { transform: translateY(-2px); box-shadow: 0 18px 38px rgba(77, 89, 121, 0.28); }
    .zizi-lb-button.is-inline { position: static; display: inline-flex; align-items: center; justify-content: center; width: 100%; min-height: 42px; padding: 10px 13px; font-size: 13px; }
    .zizi-lb-modal { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: 18px; background: rgba(249, 244, 232, 0.68); backdrop-filter: blur(14px); }
    .zizi-lb-modal[hidden], .zizi-lb-form[hidden], .zizi-lb-note[hidden], .zizi-lb-pending[hidden] { display: none; }
    .zizi-lb-panel { width: min(760px, 100%); max-height: min(780px, 92vh); overflow: auto; border: 1px solid rgba(83, 101, 135, 0.18); border-radius: 20px; color: #263044; background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 252, 255, 0.9)); box-shadow: 0 24px 70px rgba(77, 89, 121, 0.28); }
    .zizi-lb-head { display: flex; gap: 12px; align-items: start; justify-content: space-between; padding: 22px 22px 14px; border-bottom: 1px solid rgba(83, 101, 135, 0.12); }
    .zizi-lb-head h2 { margin: 0; color: #263044; font-size: clamp(24px, 4vw, 36px); letter-spacing: 0; }
    .zizi-lb-head p, .zizi-lb-note, .zizi-lb-status { margin: 6px 0 0; color: #34425c; font-size: 13px; line-height: 1.45; }
    .zizi-lb-body { padding: 18px 22px 22px; }
    .zizi-lb-close, .zizi-lb-submit, .zizi-lb-sync, .zizi-lb-copy { border: 1px solid rgba(91, 141, 239, 0.24); border-radius: 999px; padding: 10px 14px; color: #315caa; background: rgba(255, 255, 255, 0.82); cursor: pointer; box-shadow: 0 8px 18px rgba(77, 89, 121, 0.12); font: 800 13px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif; }
    .zizi-lb-form, .zizi-lb-pending-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
    .zizi-lb-submit, .zizi-lb-sync { background: linear-gradient(135deg, #18a999, #5b8def); border-color: transparent; color: #ffffff; }
    .zizi-lb-form { padding: 14px; border: 1px solid rgba(83, 101, 135, 0.12); border-radius: 16px; background: rgba(255, 255, 255, 0.68); }
    .zizi-lb-form label { display: grid; gap: 7px; flex: 1 1 190px; color: #4f5b70; font-size: 13px; font-weight: 800; }
    .zizi-lb-submit-level { flex: 1 1 100%; margin: 0; padding: 9px 12px; border-radius: 12px; background: rgba(91, 141, 239, 0.1); color: #263044; font-size: 13px; font-weight: 850; }
    .zizi-lb-form input, .zizi-lb-level-select, .zizi-lb-pending textarea { width: 100%; box-sizing: border-box; border: 1px solid rgba(91, 141, 239, 0.22); border-radius: 14px; padding: 11px 12px; color: #263044; background: rgba(255, 255, 255, 0.86); outline: none; font: 700 14px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif; }
    .zizi-lb-level-select { margin-top: 10px; }
    .zizi-lb-list { display: grid; gap: 8px; margin-top: 12px; }
    .zizi-lb-row { display: grid; grid-template-columns: 54px minmax(0, 1fr) 120px 126px; gap: 10px; align-items: center; min-height: 44px; padding: 10px 12px; border: 1px solid rgba(83, 101, 135, 0.1); border-radius: 14px; background: rgba(255, 255, 255, 0.68); }
    .zizi-lb-row.is-head { min-height: 28px; color: #657186; background: transparent; border-color: transparent; font-size: 12px; }
    .zizi-lb-rank { color: #18a999; font-weight: 900; }
    .zizi-lb-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 800; }
    .zizi-lb-score { color: #a46800; font-weight: 900; text-align: right; }
    .zizi-lb-time { color: #657186; font-size: 12px; text-align: right; }
    .zizi-lb-empty, .zizi-lb-pending { padding: 14px; border: 1px dashed rgba(91, 141, 239, 0.3); border-radius: 16px; color: #34425c; background: rgba(255, 255, 255, 0.5); }
    .zizi-lb-pending textarea { min-height: 96px; margin: 10px 0; resize: vertical; }
    @media (max-width: 620px) { .zizi-lb-panel { border-radius: 18px; } .zizi-lb-row { grid-template-columns: 40px minmax(0, 1fr) 86px; } .zizi-lb-time, .zizi-lb-row.is-head .zizi-lb-time { display: none; } }
  `;
  document.head.appendChild(style);
}

function makeHeadRow() {
  const row = document.createElement("div");
  row.className = "zizi-lb-row is-head";
  ["排名 / Rank", "昵称 / Nickname", "分数 / Score", "时间 / Time"].forEach((text, index) => {
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
  nameEl.textContent = nickname || "匿名玩家 / Anonymous";
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
  let selectedLevelId = hasLevels ? levelOptions[0].id : "";
  let lastPendingItem = null;

  const getCurrentLevelId = () => {
    const requested = typeof getLevelId === "function" ? getLevelId() : selectedLevelId;
    const requestedText = cleanText(requested, 40);
    return hasLevels && levelOptions.some((level) => level.id === requestedText) ? requestedText : selectedLevelId;
  };
  const resolveLevelId = (levelId) => {
    const requestedText = cleanText(levelId, 40);
    return hasLevels && levelOptions.some((level) => level.id === requestedText) ? requestedText : getCurrentLevelId();
  };
  const getBoardLevelId = () => (hasLevels ? selectedLevelId : "");
  const getBoardName = () => {
    const level = levelOptions.find((option) => option.id === selectedLevelId);
    return hasLevels ? `${gameName || gameId} - ${level?.name || selectedLevelId}` : gameName || gameId;
  };

  const button = document.createElement("button");
  button.className = buttonContainer ? "zizi-lb-button is-inline" : "zizi-lb-button";
  button.type = "button";
  button.textContent = buttonLabel || "排行榜 / Leaderboard";

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
  title.textContent = "排行榜 / Leaderboard";
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
  close.textContent = "返回游戏 / Back";
  head.append(titleWrap, close);

  const body = document.createElement("div");
  body.className = "zizi-lb-body";
  const form = document.createElement("form");
  form.className = "zizi-lb-form";
  form.hidden = true;
  const submitLevel = document.createElement("p");
  submitLevel.className = "zizi-lb-submit-level";
  submitLevel.hidden = true;
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "昵称 / Nickname";
  const nameInput = document.createElement("input");
  nameInput.name = "nickname";
  nameInput.maxLength = MAX_NAME;
  nameInput.placeholder = "最多 20 个字符 / 20 characters max";
  nameInput.autocomplete = "nickname";
  nameLabel.appendChild(nameInput);
  const scoreLabel = document.createElement("label");
  scoreLabel.textContent = "分数 / Score";
  const scoreInput = document.createElement("input");
  scoreInput.name = "score";
  scoreInput.readOnly = true;
  scoreLabel.appendChild(scoreInput);
  const submit = document.createElement("button");
  submit.className = "zizi-lb-submit";
  submit.type = "submit";
  submit.textContent = "提交分数 / Submit Score";
  form.append(submitLevel, nameLabel, scoreLabel, submit);

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
  const pendingNotice = document.createElement("div");
  pendingNotice.innerHTML = `
    <p><strong>Firebase 暂时无法连接，你的分数没有自动提交。</strong><br />Firebase is temporarily unavailable. Your score was not submitted automatically.</p>
    <p><strong>同步码已生成，请现在复制。</strong><br />A sync code has been generated. Please copy it now.</p>
    <p>刷新或关闭页面后，这个同步码不会保存在你的设备上。<br />After refreshing or closing this page, this sync code will not be saved on your device.</p>
    <p><strong>有 GitHub 账号 / With a GitHub account:</strong><br />点击 “提交到 GitHub Sync / Submit to GitHub Sync”，打开 GitHub 后保持标题和内容不变，然后点击 “Submit new issue”。</p>
    <p><strong>没有 GitHub 账号 / Without a GitHub account:</strong><br />复制 ZIZI-SYNC 同步码发给 ZIzi，只需要发送同步码，不需要发送其他内容。</p>
  `;
  const pendingText = document.createElement("textarea");
  pendingText.readOnly = true;
  const pendingActions = document.createElement("div");
  pendingActions.className = "zizi-lb-pending-actions";
  const syncButton = document.createElement("button");
  syncButton.className = "zizi-lb-sync";
  syncButton.type = "button";
  syncButton.textContent = "提交到 GitHub Sync / Submit to GitHub Sync";
  const copyButton = document.createElement("button");
  copyButton.className = "zizi-lb-copy";
  copyButton.type = "button";
  copyButton.textContent = "复制同步码 / Copy Sync Code";
  pendingActions.append(syncButton, copyButton);
  pendingPanel.append(pendingNotice, pendingText, pendingActions);

  body.append(form, note, status, list, pendingPanel);
  panel.append(head, body);
  modal.appendChild(panel);
  (buttonContainer || document.body).appendChild(button);
  document.body.appendChild(modal);

  function setStatus(text, isError = false) {
    status.textContent = text;
    status.style.color = isError ? "#b4234a" : "#34425c";
  }

  function renderRows(rows) {
    list.replaceChildren(makeHeadRow());
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "zizi-lb-empty";
      empty.textContent = "还没有成绩 / No scores yet.";
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
    note.hidden = false;
    note.textContent = "Firebase 排行榜优先加载；如果超时，会显示最近一次导出的缓存数据。 / Firebase loads first. If it times out, this view falls back to the latest exported cache.";
    setStatus("正在加载排行榜 / Loading leaderboard...");
    try {
      const rows = await fetchLeaderboardRows({ gameId, levelId, limit: TOP_LIMIT });
      renderRows(rows);
      setStatus("排行榜已更新 / Leaderboard loaded.");
    } catch (error) {
      console.warn("[ZIzi Leaderboard] Read failed:", error);
      renderRows([]);
      setStatus("排行榜暂不可用 / Leaderboard unavailable.", true);
    }
  }

  function showPendingSync(item) {
    lastPendingItem = item;
    pendingText.value = createSyncCode([item]);
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
    levelSelect.disabled = Boolean(showSubmit);
    submitLevel.hidden = !(showSubmit && hasLevels);
    if (showSubmit && hasLevels) {
      const level = levelOptions.find((option) => option.id === selectedLevelId);
      submitLevel.textContent = `当前地图 / Current Level: ${level?.name || selectedLevelId}`;
    }
    if (showSubmit) nameInput.focus();
    loadScores();
  }

  button.addEventListener("click", () => open(false));
  close.addEventListener("click", () => {
    modal.hidden = true;
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
    await navigator.clipboard?.writeText(createSyncCode([lastPendingItem]));
    setStatus("同步码已复制 / Sync code copied.");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nickname = cleanText(nameInput.value, MAX_NAME);
    const score = normalizeScore(pendingScore);
    const levelId = hasLevels && pendingLevelId ? pendingLevelId : getBoardLevelId();
    if (!nickname) {
      setStatus("请输入昵称 / Please enter a nickname.", true);
      return;
    }
    submit.disabled = true;
    setStatus("正在提交分数 / Submitting score...");
    const pendingItem = {
      id: makeSyncId(),
      type: "score",
      gameId,
      levelId,
      nickname,
      score,
      createdAt: new Date().toISOString(),
      sourceRegion: "web"
    };
    try {
      const firebase = await getFirebase();
      const ref = getScoreCollection(firebase, gameId, levelId);
      const data = { nickname, score, gameId, createdAt: firebase.serverTimestamp() };
      if (isLevelGame(gameId)) data.levelId = levelId;
      await withTimeout(firebase.addDoc(ref, data), FIREBASE_TIMEOUT_MS, "Firebase score submit");
      form.hidden = true;
      levelSelect.disabled = false;
      submitLevel.hidden = true;
      pendingLevelId = null;
      setStatus("分数已提交 / Score submitted.");
      await loadScores();
    } catch (error) {
      console.warn("[ZIzi Leaderboard] Score needs manual sync:", {
        path: getScorePath(gameId, levelId),
        error
      });
      showPendingSync(pendingItem);
      setStatus(`Firebase 暂时无法连接，你的分数没有自动提交。 / Firebase is temporarily unavailable. Reason: ${describeError(error)}`, true);
    } finally {
      submit.disabled = false;
    }
  });

  return {
    open,
    openSubmit(score, options = {}) {
      pendingScore = normalizeScore(score);
      const explicitLevelId = typeof options === "string" ? options : options?.levelId;
      pendingLevelId = hasLevels ? resolveLevelId(explicitLevelId || getCurrentLevelId()) : "";
      scoreInput.value = formatScore(pendingScore);
      open(true);
    },
    destroy() {
      button.remove();
      modal.remove();
    }
  };
}
