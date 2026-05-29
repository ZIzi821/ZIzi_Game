import { firebaseConfig } from "./firebase-config.js";
import { mainlandConfig } from "./mainland-config.js";

const VALID_GAMES = new Set(["starfall", "sentinel", "chomp"]);
const MAX_NAME = 20;
const MAX_SCORE = 999999999;
const TOP_LIMIT = 20;
const READ_LIMIT = 50;

let firebasePromise;
let cloudbasePromise;

function cleanText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_SCORE, Math.floor(value)));
}

function formatTime(value) {
  if (!value) return "刚刚";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
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

function injectStyles() {
  if (document.getElementById("zizi-leaderboard-style")) return;
  const style = document.createElement("style");
  style.id = "zizi-leaderboard-style";
  style.textContent = `
    .zizi-lb-button {
      position: fixed;
      right: clamp(14px, 3vw, 28px);
      bottom: clamp(14px, 3vw, 28px);
      z-index: 80;
      border: 1px solid rgba(124, 229, 255, 0.45);
      border-radius: 999px;
      padding: 12px 18px;
      color: #eafaff;
      background: linear-gradient(135deg, rgba(13, 27, 45, 0.92), rgba(37, 31, 64, 0.92));
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42), inset 0 0 22px rgba(104, 213, 255, 0.14);
      font: 700 14px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      letter-spacing: 0;
    }

    .zizi-lb-button:hover,
    .zizi-lb-button:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 22px 52px rgba(0, 0, 0, 0.48), 0 0 26px rgba(97, 214, 255, 0.24);
    }

    .zizi-lb-button.is-inline {
      position: static;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 42px;
      padding: 10px 13px;
      font-size: 13px;
    }

    .zizi-lb-modal {
      position: fixed;
      inset: 0;
      z-index: 120;
      display: grid;
      place-items: center;
      padding: 18px;
      background: radial-gradient(circle at 50% 20%, rgba(84, 180, 255, 0.18), transparent 42%),
        rgba(4, 8, 15, 0.74);
      backdrop-filter: blur(12px);
    }

    .zizi-lb-modal[hidden] {
      display: none;
    }

    .zizi-lb-panel {
      width: min(720px, 100%);
      max-height: min(760px, 92vh);
      overflow: auto;
      border: 1px solid rgba(126, 226, 255, 0.32);
      border-radius: 18px;
      color: #eefbff;
      background: linear-gradient(180deg, rgba(13, 27, 45, 0.96), rgba(7, 12, 22, 0.97));
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.58), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .zizi-lb-head,
    .zizi-lb-actions,
    .zizi-lb-form {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .zizi-lb-head {
      justify-content: space-between;
      padding: 22px 22px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .zizi-lb-head h2 {
      margin: 0;
      font-size: clamp(22px, 4vw, 34px);
      letter-spacing: 0;
    }

    .zizi-lb-head p,
    .zizi-lb-note,
    .zizi-lb-status {
      margin: 6px 0 0;
      color: rgba(222, 245, 255, 0.74);
      font-size: 13px;
    }
    
    .zizi-lb-level-select {
      margin-top: 10px;
      width: 100%;
      padding: 8px 12px;
      border: 1px solid rgba(126, 226, 255, 0.3);
      border-radius: 8px;
      background: rgba(2, 7, 14, 0.76);
      color: #effcff;
      font: 700 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      outline: none;
      cursor: pointer;
    }
    .zizi-lb-level-select option {
      background: #0d1b2d;
    }

    .zizi-lb-close,
    .zizi-lb-submit,
    .zizi-lb-back {
      border: 1px solid rgba(126, 226, 255, 0.34);
      border-radius: 10px;
      padding: 10px 14px;
      color: #effcff;
      background: rgba(255, 255, 255, 0.08);
      cursor: pointer;
      font: 700 13px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .zizi-lb-submit {
      background: linear-gradient(135deg, #52d9d0, #7c74ff);
      border-color: transparent;
      color: #07111c;
    }

    .zizi-lb-back {
      margin-bottom: 14px;
    }

    .zizi-lb-body {
      padding: 18px 22px 22px;
    }

    .zizi-lb-region {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .zizi-lb-region[hidden],
    .zizi-lb-mainland-note[hidden],
    .zizi-lb-list[hidden],
    .zizi-lb-note[hidden],
    .zizi-lb-status[hidden] {
      display: none;
    }

    .zizi-lb-choice {
      min-height: 154px;
      display: grid;
      align-content: space-between;
      gap: 12px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 14px;
      padding: 16px;
      color: #eefbff;
      text-align: left;
      cursor: pointer;
      font: inherit;
    }

    .zizi-lb-choice strong {
      display: block;
      font-size: 20px;
      line-height: 1.15;
    }

    .zizi-lb-choice span,
    .zizi-lb-mainland-note p {
      color: rgba(230, 244, 255, 0.78);
      line-height: 1.55;
    }

    .zizi-lb-choice.mainland {
      background: linear-gradient(135deg, rgba(110, 16, 30, 0.9), rgba(54, 22, 30, 0.9));
    }

    .zizi-lb-choice.international {
      background: linear-gradient(135deg, rgba(10, 55, 76, 0.9), rgba(39, 33, 92, 0.9));
    }

    .zizi-lb-mainland-note {
      padding: 16px;
      border: 1px solid rgba(255, 200, 87, 0.28);
      border-radius: 14px;
      background: rgba(255, 200, 87, 0.08);
    }

    .zizi-lb-mainland-note p {
      margin: 0;
    }

    .zizi-lb-form {
      flex-wrap: wrap;
      margin-bottom: 16px;
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.045);
    }

    .zizi-lb-form[hidden] {
      display: none;
    }

    .zizi-lb-form label {
      display: grid;
      gap: 7px;
      flex: 1 1 190px;
      color: rgba(235, 250, 255, 0.76);
      font-size: 12px;
      text-transform: uppercase;
    }

    .zizi-lb-form input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(126, 226, 255, 0.3);
      border-radius: 10px;
      padding: 11px 12px;
      color: #effcff;
      background: rgba(2, 7, 14, 0.76);
      outline: none;
      font: 700 15px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .zizi-lb-list {
      display: grid;
      gap: 8px;
    }

    .zizi-lb-row {
      display: grid;
      grid-template-columns: 54px minmax(0, 1fr) 120px 126px;
      gap: 10px;
      align-items: center;
      min-height: 44px;
      padding: 10px 12px;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.045);
    }

    .zizi-lb-row.is-head {
      min-height: 28px;
      color: rgba(220, 241, 255, 0.62);
      background: transparent;
      border-color: transparent;
      font-size: 12px;
      text-transform: uppercase;
    }

    .zizi-lb-rank {
      color: #83f2e9;
      font-weight: 900;
    }

    .zizi-lb-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 800;
    }

    .zizi-lb-score {
      color: #ffe08a;
      font-weight: 900;
      text-align: right;
    }

    .zizi-lb-time {
      color: rgba(220, 241, 255, 0.68);
      font-size: 12px;
      text-align: right;
    }

    .zizi-lb-empty {
      padding: 18px;
      border: 1px dashed rgba(126, 226, 255, 0.28);
      border-radius: 14px;
      color: rgba(229, 246, 255, 0.72);
      text-align: center;
    }

    @media (max-width: 620px) {
      .zizi-lb-panel { border-radius: 14px; }
      .zizi-lb-head { align-items: flex-start; }
      .zizi-lb-region { grid-template-columns: 1fr; }
      .zizi-lb-row {
        grid-template-columns: 40px minmax(0, 1fr) 86px;
      }
      .zizi-lb-time,
      .zizi-lb-row.is-head .zizi-lb-time {
        display: none;
      }
    }
  `;
  document.head.appendChild(style);
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
        onSnapshot: firestoreModule.onSnapshot,
        orderBy: firestoreModule.orderBy,
        query: firestoreModule.query,
        serverTimestamp: firestoreModule.serverTimestamp
      };
    });
  }
  return firebasePromise;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.cloudbase) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function getCloudBaseDb() {
  if (!cloudbasePromise) {
    cloudbasePromise = loadScript(mainlandConfig.cloudbase.sdkUrl).then(async () => {
      const initOptions = {
        env: mainlandConfig.cloudbase.env,
        region: mainlandConfig.cloudbase.region || "ap-shanghai"
      };
      if (mainlandConfig.cloudbase.accessKey) initOptions.accessKey = mainlandConfig.cloudbase.accessKey;
      const app = window.cloudbase.init(initOptions);
      const auth = app.auth({ persistence: "local" });
      if (typeof auth.signInAnonymously === "function") {
        await auth.signInAnonymously();
      } else {
        await auth.anonymousAuthProvider().signIn();
      }
      return app.database();
    });
  }
  return cloudbasePromise;
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

function getScoreCollection(firebase, gameId, levelId = "") {
  if (levelId) {
    return firebase.collection(firebase.db, "leaderboards", gameId, "levels", levelId, "scores");
  }
  return firebase.collection(firebase.db, "leaderboards", gameId, "scores");
}

function mapScoreDoc(doc) {
  const data = doc.data();
  return {
    nickname: cleanText(data.nickname, MAX_NAME),
    score: normalizeScore(data.score),
    createdAt: data.createdAt,
    orderTime: createdAtMs(data.createdAt)
  };
}

export async function fetchLeaderboardRows({ gameId, levelId = "", limit = 5 } = {}) {
  if (!VALID_GAMES.has(gameId)) {
    throw new Error(`Unknown leaderboard gameId: ${gameId}`);
  }

  const firebase = await getFirebase();
  const ref = getScoreCollection(firebase, gameId, levelId);
  const scoresQuery = firebase.query(ref, firebase.orderBy("score", "desc"), firebase.limit(limit));
  const snapshot = await firebase.getDocs(scoresQuery);
  return snapshot.docs
    .map(mapScoreDoc)
    .sort((a, b) => b.score - a.score || a.orderTime - b.orderTime)
    .slice(0, limit);
}

export function setupLeaderboard({ gameId, gameName, scoreFormatter, levels, getLevelId, buttonContainer, buttonLabel } = {}) {
  if (!VALID_GAMES.has(gameId)) {
    throw new Error(`Unknown leaderboard gameId: ${gameId}`);
  }

  injectStyles();

  const levelOptions = normalizeLevels(levels);
  const hasLevels = levelOptions.length > 0;
  const formatScore = scoreFormatter || ((score) => Number(score || 0).toLocaleString("zh-CN"));
  let pendingScore = null;
  let pendingLevelId = null;
  let unsubscribe = null;
  let loadedBoardId = null;
  let selectedRegion = null;
  let selectedLevelId = hasLevels ? levelOptions[0].id : "";

  const getCurrentLevelId = () => {
    const requested = typeof getLevelId === "function" ? getLevelId() : selectedLevelId;
    const requestedText = cleanText(requested, 40);
    return levelOptions.some((level) => level.id === requestedText) ? requestedText : selectedLevelId;
  };
  const getSelectedLevel = () => levelOptions.find((level) => level.id === selectedLevelId);
  const getBoardLevelId = () => (hasLevels ? selectedLevelId : "");
  const getBoardName = () => (hasLevels ? `${gameName || gameId} - ${getSelectedLevel()?.name || selectedLevelId}` : gameName || gameId);

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
  if (hasLevels) {
    levelOptions.forEach((level) => {
      const option = document.createElement("option");
      option.value = level.id;
      option.textContent = level.name;
      levelSelect.appendChild(option);
    });
    titleWrap.appendChild(levelSelect);
  }

  const close = document.createElement("button");
  close.className = "zizi-lb-close";
  close.type = "button";
  close.textContent = "返回游戏";
  head.append(titleWrap, close);

  const body = document.createElement("div");
  body.className = "zizi-lb-body";

  const form = document.createElement("form");
  form.className = "zizi-lb-form";
  form.hidden = true;

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Nickname / 昵称";
  const nameInput = document.createElement("input");
  nameInput.name = "nickname";
  nameInput.maxLength = MAX_NAME;
  nameInput.placeholder = "最多 20 个字符";
  nameInput.autocomplete = "nickname";
  nameLabel.appendChild(nameInput);

  const scoreLabel = document.createElement("label");
  scoreLabel.textContent = "Score / 分数";
  const scoreInput = document.createElement("input");
  scoreInput.name = "score";
  scoreInput.readOnly = true;
  scoreLabel.appendChild(scoreInput);

  const submit = document.createElement("button");
  submit.className = "zizi-lb-submit";
  submit.type = "submit";
  submit.textContent = "提交分数";
  form.append(nameLabel, scoreLabel, submit);

  const note = document.createElement("p");
  note.className = "zizi-lb-note";
  note.textContent = "国际排行榜（包含港澳台）使用 Firebase Firestore。";

  const regionChoice = document.createElement("div");
  regionChoice.className = "zizi-lb-region";

  const mainlandChoice = document.createElement("button");
  mainlandChoice.className = "zizi-lb-choice mainland";
  mainlandChoice.type = "button";
  mainlandChoice.innerHTML = "<strong>中国大陆排行榜</strong><span>Mainland China Leaderboard<br>不使用 Firebase 或 Google 服务。</span>";

  const internationalChoice = document.createElement("button");
  internationalChoice.className = "zizi-lb-choice international";
  internationalChoice.type = "button";
  internationalChoice.innerHTML = "<strong>国际排行榜（包含港澳台）</strong><span>International Leaderboard<br>继续使用当前 Firebase 排行榜。</span>";

  regionChoice.append(mainlandChoice, internationalChoice);

  const mainlandNote = document.createElement("div");
  mainlandNote.className = "zizi-lb-mainland-note";
  mainlandNote.hidden = true;
  mainlandNote.innerHTML = "<p>中国大陆排行榜正在建设中。由于 Firebase 在中国大陆访问不稳定，这里将使用更适合中国大陆访问的排行榜方案。</p>";

  const regionBack = document.createElement("button");
  regionBack.className = "zizi-lb-back";
  regionBack.type = "button";
  regionBack.textContent = "返回区域选择";
  regionBack.hidden = true;

  const status = document.createElement("p");
  status.className = "zizi-lb-status";
  status.setAttribute("aria-live", "polite");

  const list = document.createElement("div");
  list.className = "zizi-lb-list";
  list.appendChild(makeHeadRow());

  body.append(regionChoice, regionBack, mainlandNote, form, note, status, list);
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
      empty.textContent = "还没有成绩，成为第一个上榜的人。";
      list.appendChild(empty);
      return;
    }
    rows.forEach((row, index) => {
      list.appendChild(makeRow({ ...row, rank: index + 1 }, formatScore));
    });
  }

  function resetLoadedBoard() {
    if (typeof unsubscribe === "function") unsubscribe();
    unsubscribe = null;
    loadedBoardId = null;
    renderRows([]);
  }

  function syncLevelFromGame() {
    if (!hasLevels) return;
    const currentLevelId = getCurrentLevelId();
    if (currentLevelId !== selectedLevelId) {
      selectedLevelId = currentLevelId;
      levelSelect.value = selectedLevelId;
      resetLoadedBoard();
    }
    subtitle.textContent = getBoardName();
  }

  function hasCloudBaseConfig(config) {
    return Boolean(config.enabled && config.cloudbase?.env && !config.cloudbase.env.startsWith("PASTE_") && config.cloudbase?.sdkUrl);
  }

  function showRegionSelection() {
    selectedRegion = null;
    regionChoice.hidden = false;
    regionBack.hidden = true;
    mainlandNote.hidden = true;
    form.hidden = true;
    note.hidden = true;
    status.hidden = true;
    list.hidden = true;
  }

  function showMainlandFallback() {
    selectedRegion = "mainland";
    regionChoice.hidden = true;
    regionBack.hidden = false;
    mainlandNote.hidden = false;
    form.hidden = true;
    note.hidden = true;
    status.hidden = true;
    list.hidden = true;
  }

  function showInternational(showSubmit = false) {
    selectedRegion = "international";
    regionChoice.hidden = true;
    regionBack.hidden = false;
    mainlandNote.hidden = true;
    form.hidden = !showSubmit;
    note.hidden = false;
    note.textContent = "国际排行榜（包含港澳台）使用 Firebase Firestore。";
    status.hidden = false;
    list.hidden = false;
    loadScores();
    if (showSubmit) nameInput.focus();
  }

  async function showMainland(showSubmit = false) {
    if (!hasCloudBaseConfig(mainlandConfig)) {
      showMainlandFallback();
      return;
    }
    selectedRegion = "mainland";
    regionChoice.hidden = true;
    regionBack.hidden = false;
    mainlandNote.hidden = true;
    form.hidden = !showSubmit;
    note.hidden = false;
    note.textContent = "中国大陆排行榜使用 Tencent CloudBase。";
    status.hidden = false;
    list.hidden = false;
    await loadMainlandScores();
    if (showSubmit) nameInput.focus();
  }

  async function loadScores() {
    const boardKey = `${gameId}:${getBoardLevelId()}`;
    if (loadedBoardId === boardKey) return;
    resetLoadedBoard();
    loadedBoardId = boardKey;
    setStatus("正在连接排行榜...");
    try {
      const firebase = await getFirebase();
      const ref = getScoreCollection(firebase, gameId, getBoardLevelId());
      const scoresQuery = firebase.query(ref, firebase.orderBy("score", "desc"), firebase.limit(READ_LIMIT));
      unsubscribe = firebase.onSnapshot(scoresQuery, (snapshot) => {
        const rows = snapshot.docs
          .map(mapScoreDoc)
          .sort((a, b) => b.score - a.score || a.orderTime - b.orderTime)
          .slice(0, TOP_LIMIT);
        renderRows(rows);
        setStatus("排行榜已同步。");
      }, (error) => {
        loadedBoardId = null;
        console.error("[ZIzi Leaderboard] Firestore read failed:", error);
        setStatus("无法读取云端排行榜。请确认 firestore.rules 已部署到 Firebase 项目 zizicommunity。", true);
      });
    } catch (error) {
      loadedBoardId = null;
      firebasePromise = null;
      console.error("[ZIzi Leaderboard] Firebase connection failed:", error);
      setStatus("Firebase 连接失败。请检查网络、Firebase 配置和浏览器控制台错误。", true);
      renderRows([]);
    }
  }

  async function loadMainlandScores() {
    const levelId = getBoardLevelId();
    setStatus("正在连接中国大陆排行榜...");
    try {
      const db = await getCloudBaseDb();
      const collectionName = mainlandConfig.cloudbase.collections.leaderboards;
      const whereClause = levelId ? { gameId, levelId } : { gameId };
      const snapshot = await db.collection(collectionName).where(whereClause).orderBy("score", "desc").limit(READ_LIMIT).get();
      const rows = (snapshot.data || [])
        .map((data) => ({
          nickname: cleanText(data.nickname, MAX_NAME),
          score: normalizeScore(data.score),
          createdAt: data.createdAt,
          orderTime: createdAtMs(data.createdAt)
        }))
        .sort((a, b) => b.score - a.score || a.orderTime - b.orderTime)
        .slice(0, TOP_LIMIT);
      renderRows(rows);
      setStatus("中国大陆排行榜已同步。");
    } catch (_) {
      cloudbasePromise = null;
      showMainlandFallback();
    }
  }

  function open(showSubmit = false) {
    if (showSubmit && hasLevels && pendingLevelId) {
      selectedLevelId = pendingLevelId;
      levelSelect.value = selectedLevelId;
      subtitle.textContent = getBoardName();
    } else {
      syncLevelFromGame();
    }
    modal.hidden = false;
    if (selectedRegion === "international") {
      showInternational(showSubmit);
    } else if (selectedRegion === "mainland") {
      showMainland(showSubmit);
    } else {
      showRegionSelection();
    }
  }

  function closeModal() {
    modal.hidden = true;
  }

  button.addEventListener("click", () => open(false));
  mainlandChoice.addEventListener("click", () => showMainland(Boolean(pendingScore)));
  internationalChoice.addEventListener("click", () => showInternational(Boolean(pendingScore)));
  regionBack.addEventListener("click", showRegionSelection);
  close.addEventListener("click", closeModal);
  levelSelect.addEventListener("change", () => {
    selectedLevelId = levelSelect.value;
    subtitle.textContent = getBoardName();
    resetLoadedBoard();
    if (selectedRegion === "international") showInternational(Boolean(pendingScore));
    if (selectedRegion === "mainland") showMainland(Boolean(pendingScore));
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  window.addEventListener("keydown", (event) => {
    if (!modal.hidden && event.key === "Escape") closeModal();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nickname = cleanText(nameInput.value, MAX_NAME);
    const score = normalizeScore(pendingScore);
    const levelId = getBoardLevelId();
    if (!nickname) {
      setStatus("请输入昵称。", true);
      return;
    }
    if (!Number.isFinite(score)) {
      setStatus("分数无效。", true);
      return;
    }
    submit.disabled = true;
    setStatus("正在提交分数...");
    try {
      if (selectedRegion === "mainland") {
        const db = await getCloudBaseDb();
        const data = {
          nickname,
          score,
          gameId,
          createdAt: new Date().toISOString()
        };
        if (levelId) data.levelId = levelId;
        await db.collection(mainlandConfig.cloudbase.collections.leaderboards).add(data);
        await loadMainlandScores();
      } else {
        const firebase = await getFirebase();
        const ref = getScoreCollection(firebase, gameId, levelId);
        const data = {
          nickname,
          score,
          gameId,
          createdAt: firebase.serverTimestamp()
        };
        if (levelId) data.levelId = levelId;
        await firebase.addDoc(ref, data);
      }
      form.hidden = true;
      setStatus("分数已提交。");
    } catch (error) {
      console.error("[ZIzi Leaderboard] Firestore submit failed:", error);
      setStatus("提交失败。请确认 firestore.rules 已部署，并且当前榜单路径被允许写入。", true);
    } finally {
      submit.disabled = false;
    }
  });

  return {
    open,
    openSubmit(score) {
      pendingScore = normalizeScore(score);
      pendingLevelId = hasLevels ? getCurrentLevelId() : null;
      scoreInput.value = formatScore(pendingScore);
      open(true);
    },
    destroy() {
      if (typeof unsubscribe === "function") unsubscribe();
      button.remove();
      modal.remove();
    }
  };
}
