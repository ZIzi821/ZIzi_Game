(function () {
  "use strict";

  const SAVE_KEY = "zizi-el-alamein-save-v1";
  const DIRECTIONS = ["N", "NE", "SE", "S", "SW", "NW"];
  const OPPOSITE_SIDE = { axis: "allied", allied: "axis" };
  const HIGHLIGHT = {
    selected: "rgba(0, 166, 166, 0.56)",
    reachable: "rgba(34, 124, 118, 0.34)",
    attack: "rgba(168, 72, 50, 0.40)",
    defender: "rgba(178, 49, 49, 0.60)",
    declaredAttack: "rgba(34, 124, 118, 0.22)",
    declaredDefender: "rgba(216, 150, 44, 0.26)",
    currentAttack: "rgba(0, 166, 166, 0.52)",
    currentDefender: "rgba(178, 49, 49, 0.58)",
    retreat: "rgba(236, 167, 42, 0.46)",
    objective: "rgba(255, 238, 128, 0.30)",
  };

  const el = {
    body: document.body,
    mapImage: document.getElementById("mapImage"),
    hexLayer: document.getElementById("hexLayer"),
    unitLayer: document.getElementById("unitLayer"),
    boardSurface: document.getElementById("boardSurface"),
    boardViewport: document.getElementById("boardViewport"),
    boardBadge: document.getElementById("boardBadge"),
    turnLabel: document.getElementById("turnLabel"),
    phaseLabel: document.getElementById("phaseLabel"),
    selectedUnit: document.getElementById("selectedUnit"),
    combatComposer: document.getElementById("combatComposer"),
    battleList: document.getElementById("battleList"),
    taskPanel: document.getElementById("taskPanel"),
    logBlock: document.getElementById("logBlock"),
    logToggleButton: document.getElementById("logToggleButton"),
    logList: document.getElementById("logList"),
    winnerBanner: document.getElementById("winnerBanner"),
    finishDeclarationsButton: document.getElementById("finishDeclarationsButton"),
    resolveBattleButton: document.getElementById("resolveBattleButton"),
    endPhaseButton: document.getElementById("endPhaseButton"),
    newGameButton: document.getElementById("newGameButton"),
    saveButton: document.getElementById("saveButton"),
    loadButton: document.getElementById("loadButton"),
    chartsButton: document.getElementById("chartsButton"),
    onlineStatus: document.getElementById("onlineStatus"),
    roomCodeInput: document.getElementById("roomCodeInput"),
    createRoomButton: document.getElementById("createRoomButton"),
    joinRoomButton: document.getElementById("joinRoomButton"),
    leaveRoomButton: document.getElementById("leaveRoomButton"),
    claimAxisButton: document.getElementById("claimAxisButton"),
    claimAlliedButton: document.getElementById("claimAlliedButton"),
    spectatorButton: document.getElementById("spectatorButton"),
    onlineSetupButton: document.getElementById("onlineSetupButton"),
    onlineSetupDialog: document.getElementById("onlineSetupDialog"),
    supabaseUrlInput: document.getElementById("supabaseUrlInput"),
    supabaseAnonKeyInput: document.getElementById("supabaseAnonKeyInput"),
    saveSupabaseConfigButton: document.getElementById("saveSupabaseConfigButton"),
    testSupabaseButton: document.getElementById("testSupabaseButton"),
    copySchemaButton: document.getElementById("copySchemaButton"),
    schemaSqlText: document.getElementById("schemaSqlText"),
    setupStatus: document.getElementById("setupStatus"),
    chartsDialog: document.getElementById("chartsDialog"),
    victoryDialog: document.getElementById("victoryDialog"),
    victoryTitle: document.getElementById("victoryTitle"),
    victoryBody: document.getElementById("victoryBody"),
    combatResultDialog: document.getElementById("combatResultDialog"),
    combatResultTitle: document.getElementById("combatResultTitle"),
    combatResultBody: document.getElementById("combatResultBody"),
    crtImage: document.getElementById("crtImage"),
    tecImage: document.getElementById("tecImage"),
    turnTrackImage: document.getElementById("turnTrackImage"),
    missingDataTemplate: document.getElementById("missingDataTemplate"),
  };

  const app = {
    scenario: null,
    rules: null,
    hexes: [],
    hexById: new Map(),
    state: null,
    reachable: new Map(),
    legalRetreats: new Set(),
    animating: false,
    logExpanded: false,
    online: {
      client: null,
      configured: false,
      connected: false,
      roomCode: "",
      role: "spectator",
      playerId: "",
      players: {},
      revision: 0,
      channel: null,
      syncing: false,
      pendingSyncReason: "",
      applyingRemote: false,
      status: "本地模式 / Local",
      statusMode: "local",
    },
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function phase() {
    return app.rules.phases[app.state.phaseIndex];
  }

  function activeSide() {
    return phase().side;
  }

  function enemySide(side) {
    return OPPOSITE_SIDE[side];
  }

  function unitById(id) {
    return app.state.units.find((unit) => unit.id === id);
  }

  function hexById(id) {
    return app.hexById.get(id);
  }

  function terrainRule(hex) {
    return app.rules.terrain[hex?.terrain] || app.rules.terrain.desert;
  }

  function liveUnits() {
    return app.state.units.filter((unit) => !unit.eliminated);
  }

  function liveUnitsAt(hexId) {
    return liveUnits().filter((unit) => unit.hexId === hexId);
  }

  function liveUnitAt(hexId) {
    return liveUnitsAt(hexId)[0] || null;
  }

  function isCombatPhase() {
    return phase().type === "combat";
  }

  function isMovementPhase() {
    return phase().type === "movement";
  }

  function log(message) {
    app.state.log.push(`[T${app.state.turn}] ${message}`);
    if (app.state.log.length > 160) app.state.log.shift();
  }

  function sideLabel(side) {
    return side === "axis" ? "轴心国 / Axis" : "英军 / Allied";
  }

  function nationalityLabel(nationality) {
    if (nationality === "german") return "德军";
    if (nationality === "italian") return "意军";
    return "英联邦";
  }

  function phaseLabel(id) {
    return app.rules.phases.find((item) => item.id === id)?.label || id;
  }

  function makeInitialState() {
    return {
      version: 1,
      turn: 1,
      phaseIndex: 0,
      selectedUnitId: null,
      selectedDefenderId: null,
      selectedAttackers: [],
      combatMode: "declare",
      declaredCombats: [],
      combatCompleteNotified: false,
      movedUnits: [],
      usedAttackers: [],
      usedDefenders: [],
      lastMove: null,
      retreatTask: null,
      advanceTask: null,
      log: ["阿拉曼战役已载入。"],
      winner: null,
      winnerDialogShown: false,
      units: clone(app.scenario.units),
    };
  }

  async function init() {
    try {
      const [scenario, rules] = await Promise.all([
        fetchJson("local-data/scenario.json"),
        fetchJson("local-data/rules.json"),
      ]);
      app.scenario = scenario;
      app.rules = rules;
      app.hexes = scenario.board.hexes;
      app.hexById = new Map(app.hexes.map((hex) => [hex.id, hex]));
      app.state = makeInitialState();
      wireUi();
      initOnline();
      loadImages();
      draw();
      centerOnOpeningFront();
    } catch (error) {
      showMissingData(error);
    }
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json();
  }

  function showMissingData(error) {
    console.error(error);
    el.body.replaceChildren(el.missingDataTemplate.content.cloneNode(true));
  }

  function loadImages() {
    el.mapImage.src = app.scenario.board.image;
    el.crtImage.src = app.scenario.charts.crtImage;
    el.tecImage.src = app.scenario.charts.terrainImage;
    el.turnTrackImage.src = app.scenario.charts.turnTrackImage;
  }

  function wireUi() {
    el.boardSurface.addEventListener("click", onBoardClick);
    el.newGameButton.addEventListener("click", () => {
      resetGame();
    });
    el.saveButton.addEventListener("click", saveGame);
    el.loadButton.addEventListener("click", loadGame);
    el.chartsButton.addEventListener("click", () => el.chartsDialog.showModal());
    el.endPhaseButton.addEventListener("click", endPhase);
    el.finishDeclarationsButton.addEventListener("click", finishDeclarations);
    el.resolveBattleButton.addEventListener("click", resolveNextBattle);
    el.createRoomButton?.addEventListener("click", createOnlineRoom);
    el.joinRoomButton?.addEventListener("click", joinOnlineRoomFromInput);
    el.leaveRoomButton?.addEventListener("click", leaveOnlineRoom);
    el.claimAxisButton?.addEventListener("click", () => claimOnlineRole("axis"));
    el.claimAlliedButton?.addEventListener("click", () => claimOnlineRole("allied"));
    el.spectatorButton?.addEventListener("click", () => claimOnlineRole("spectator"));
    el.onlineSetupButton?.addEventListener("click", openOnlineSetup);
    el.saveSupabaseConfigButton?.addEventListener("click", saveSupabaseConfigFromDialog);
    el.testSupabaseButton?.addEventListener("click", testSupabaseConfigFromDialog);
    el.copySchemaButton?.addEventListener("click", copySchemaSql);
    el.logToggleButton?.addEventListener("click", () => {
      app.logExpanded = !app.logExpanded;
      drawLog();
    });
    el.roomCodeInput?.addEventListener("input", () => {
      el.roomCodeInput.value = normalizeRoomCode(el.roomCodeInput.value);
    });
  }

  function resetGame() {
    if (app.online.connected && app.online.role === "spectator") {
      log("旁观者不能重置联机房间。");
      draw();
      return;
    }
    if (app.online.connected && !window.confirm("重置当前联机房间？/ Reset this online room?")) return;
    app.state = makeInitialState();
    app.reachable.clear();
    app.legalRetreats.clear();
    draw();
    syncOnlineState("reset");
  }

  function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(app.state));
    log("局面已保存。");
    draw();
  }

  function loadGame() {
    if (app.online.connected) {
      log("联机房间中不能读取本地存档。");
      draw();
      return;
    }
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      log("没有找到本地存档。");
      draw();
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.units)) throw new Error("Bad save");
      app.state = parsed;
      app.state.selectedUnitId = null;
      app.state.selectedDefenderId = null;
      app.state.selectedAttackers = [];
      app.state.retreatTask = null;
      app.state.advanceTask = null;
      app.state.lastMove = null;
      app.state.combatCompleteNotified = Boolean(app.state.combatCompleteNotified);
      app.state.winnerDialogShown = Boolean(app.state.winnerDialogShown);
      app.reachable.clear();
      app.legalRetreats.clear();
      log("已读取本地存档。");
      draw();
    } catch (_) {
      log("存档无法读取。");
      draw();
    }
  }

  function initOnline() {
    app.online.playerId = localStorage.getItem("zizi-el-alamein-player-id") || makePlayerId();
    localStorage.setItem("zizi-el-alamein-player-id", app.online.playerId);
    const config = supabaseConfig();
    app.online.configured = Boolean(config.url && config.anonKey);
    const queryRoom = normalizeRoomCode(new URLSearchParams(window.location.search).get("room") || "");
    const storedRoom = normalizeRoomCode(localStorage.getItem("zizi-el-alamein-room") || "");
    if (el.roomCodeInput) el.roomCodeInput.value = queryRoom || storedRoom;
    setOnlineStatus(app.online.configured ? "可联机：输入房间码或创建房间。" : "本地模式：先填写 Supabase 配置。", app.online.configured ? "local" : "error");
  }

  function supabaseConfig() {
    const stored = storedSupabaseConfig();
    const config = stored.url || stored.anonKey ? stored : (window.EL_ALAMEIN_SUPABASE || {});
    return {
      url: config.url || config.supabaseUrl || "",
      anonKey: config.anonKey || config.supabaseAnonKey || "",
    };
  }

  function storedSupabaseConfig() {
    try {
      return JSON.parse(localStorage.getItem("zizi-el-alamein-supabase") || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function setSetupStatus(message, mode = "local") {
    if (!el.setupStatus) return;
    el.setupStatus.textContent = message;
    el.setupStatus.dataset.mode = mode;
  }

  async function openOnlineSetup() {
    const config = supabaseConfig();
    if (el.supabaseUrlInput) el.supabaseUrlInput.value = config.url;
    if (el.supabaseAnonKeyInput) el.supabaseAnonKeyInput.value = config.anonKey;
    setSetupStatus(app.online.configured ? "已读取 Supabase 配置。" : "填写 URL 和 anon key 后保存。", app.online.configured ? "ok" : "local");
    await loadSchemaSqlPreview();
    if (el.onlineSetupDialog && !el.onlineSetupDialog.open) el.onlineSetupDialog.showModal();
  }

  async function loadSchemaSqlPreview() {
    if (!el.schemaSqlText || el.schemaSqlText.value) return;
    try {
      const response = await fetch("supabase/schema.sql", { cache: "no-store" });
      el.schemaSqlText.value = response.ok ? await response.text() : "";
    } catch (_) {
      el.schemaSqlText.value = "";
    }
  }

  function readSupabaseConfigFromDialog() {
    return {
      url: String(el.supabaseUrlInput?.value || "").trim(),
      anonKey: String(el.supabaseAnonKeyInput?.value || "").trim(),
    };
  }

  function saveSupabaseConfigFromDialog(options = {}) {
    const config = readSupabaseConfigFromDialog();
    if (!config.url || !config.anonKey) {
      setSetupStatus("URL 和 anon key 都要填写。", "error");
      return false;
    }
    localStorage.setItem("zizi-el-alamein-supabase", JSON.stringify(config));
    app.online.client = null;
    app.online.configured = true;
    setOnlineStatus("Supabase 配置已保存，可以创建或加入房间。", "local");
    if (!options.silent) setSetupStatus("已保存到这个浏览器。", "ok");
    drawOnlinePanel();
    return true;
  }

  async function testSupabaseConfigFromDialog() {
    if (!saveSupabaseConfigFromDialog({ silent: true })) return;
    setSetupStatus("正在测试连接...", "local");
    if (!(await ensureSupabaseClient())) {
      setSetupStatus("Supabase 客户端没有加载成功。", "error");
      return;
    }
    const { error } = await app.online.client
      .from("el_alamein_rooms")
      .select("code")
      .limit(1);
    if (error) {
      setSetupStatus(`连接到了 Supabase，但表不可用：${error.message}`, "error");
      return;
    }
    setSetupStatus("连接成功，房间表可用。", "ok");
  }

  async function copySchemaSql() {
    await loadSchemaSqlPreview();
    const sql = el.schemaSqlText?.value || "";
    if (!sql) {
      setSetupStatus("没有读取到 SQL 文件。", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(sql);
      setSetupStatus("建表 SQL 已复制。", "ok");
    } catch (_) {
      el.schemaSqlText.focus();
      el.schemaSqlText.select();
      document.execCommand("copy");
      setSetupStatus("建表 SQL 已选中并复制。", "ok");
    }
  }

  function makePlayerId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeRoomCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }

  function generateRoomCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    const values = new Uint32Array(6);
    window.crypto?.getRandomValues?.(values);
    for (let index = 0; index < 6; index += 1) {
      const value = values[index] || Math.floor(Math.random() * alphabet.length);
      code += alphabet[value % alphabet.length];
    }
    return code;
  }

  function setOnlineStatus(message, mode = "local") {
    app.online.status = message;
    app.online.statusMode = mode;
    if (el.onlineStatus) {
      el.onlineStatus.textContent = message;
      el.onlineStatus.dataset.mode = mode;
    }
  }

  function onlineRoleLabel(role = app.online.role) {
    if (role === "axis") return "轴心 / Axis";
    if (role === "allied") return "英军 / Allied";
    return "旁观 / Watch";
  }

  async function ensureSupabaseClient() {
    if (app.online.client) return true;
    const config = supabaseConfig();
    if (!config.url || !config.anonKey) {
      setOnlineStatus("缺少 Supabase 配置：填写 el-alamein/supabase-config.js。", "error");
      drawOnlinePanel();
      return false;
    }
    try {
      if (!window.supabase?.createClient) {
        await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
      }
      app.online.client = window.supabase.createClient(config.url, config.anonKey);
      app.online.configured = true;
      return true;
    } catch (error) {
      setOnlineStatus(`Supabase 加载失败：${error.message}`, "error");
      drawOnlinePanel();
      return false;
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error(src)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error(src)), { once: true });
      document.head.append(script);
    });
  }

  async function createOnlineRoom() {
    if (!(await ensureSupabaseClient())) return;
    const code = normalizeRoomCode(el.roomCodeInput?.value) || generateRoomCode();
    if (el.roomCodeInput) el.roomCodeInput.value = code;
    const room = {
      code,
      revision: 1,
      state: snapshotStateForOnline(),
      players: {},
      updated_by: app.online.playerId,
      updated_at: new Date().toISOString(),
    };
    setOnlineStatus(`正在创建房间 ${code}...`, "local");
    const { data, error } = await app.online.client
      .from("el_alamein_rooms")
      .insert(room)
      .select("code, state, players, revision, updated_by")
      .single();
    if (error) {
      setOnlineStatus(`创建失败：${error.message}`, "error");
      return;
    }
    await connectOnlineRoom(data);
  }

  async function joinOnlineRoomFromInput() {
    if (!(await ensureSupabaseClient())) return;
    const code = normalizeRoomCode(el.roomCodeInput?.value);
    if (!code) {
      setOnlineStatus("请输入房间码。", "error");
      return;
    }
    setOnlineStatus(`正在加入房间 ${code}...`, "local");
    const { data, error } = await app.online.client
      .from("el_alamein_rooms")
      .select("code, state, players, revision, updated_by")
      .eq("code", code)
      .maybeSingle();
    if (error || !data) {
      setOnlineStatus(error ? `加入失败：${error.message}` : "没有找到这个房间。", "error");
      return;
    }
    await connectOnlineRoom(data);
  }

  async function connectOnlineRoom(room) {
    await unsubscribeOnlineRoom();
    app.online.connected = true;
    app.online.roomCode = normalizeRoomCode(room.code);
    app.online.revision = Number(room.revision || 0);
    app.online.players = room.players || {};
    app.online.role = roleFromPlayers(app.online.players) || "spectator";
    localStorage.setItem("zizi-el-alamein-room", app.online.roomCode);
    updateRoomUrl(app.online.roomCode);
    applyOnlineRoom(room, { force: true });
    app.online.channel = app.online.client
      .channel(`el-alamein-${app.online.roomCode}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "el_alamein_rooms",
        filter: `code=eq.${app.online.roomCode}`,
      }, (payload) => applyOnlineRoom(payload.new))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setOnlineStatus(`房间 ${app.online.roomCode} 已连接，你是 ${onlineRoleLabel()}。`, "connected");
          drawOnlinePanel();
        }
      });
    draw();
  }

  async function unsubscribeOnlineRoom() {
    if (app.online.channel && app.online.client) {
      await app.online.client.removeChannel(app.online.channel);
    }
    app.online.channel = null;
  }

  async function leaveOnlineRoom() {
    await unsubscribeOnlineRoom();
    app.online.connected = false;
    app.online.roomCode = "";
    app.online.role = "spectator";
    app.online.players = {};
    app.online.revision = 0;
    localStorage.removeItem("zizi-el-alamein-room");
    updateRoomUrl("");
    setOnlineStatus(app.online.configured ? "已离开房间，回到本地模式。" : "本地模式 / Local", "local");
    draw();
  }

  async function claimOnlineRole(role) {
    if (!app.online.connected) {
      setOnlineStatus("先创建或加入一个房间。", "error");
      return;
    }
    const players = { ...(app.online.players || {}) };
    for (const side of ["axis", "allied"]) {
      if (players[side] === app.online.playerId) delete players[side];
    }
    if (role !== "spectator") {
      if (players[role] && players[role] !== app.online.playerId) {
        setOnlineStatus(`${onlineRoleLabel(role)} 已有人占用。`, "error");
        return;
      }
      players[role] = app.online.playerId;
    }
    const { data, error } = await app.online.client
      .from("el_alamein_rooms")
      .update({ players, updated_by: app.online.playerId, updated_at: new Date().toISOString() })
      .eq("code", app.online.roomCode)
      .select("players")
      .single();
    if (error) {
      setOnlineStatus(`阵营更新失败：${error.message}`, "error");
      return;
    }
    app.online.players = data.players || players;
    app.online.role = roleFromPlayers(app.online.players) || "spectator";
    setOnlineStatus(`房间 ${app.online.roomCode} 已连接，你是 ${onlineRoleLabel()}。`, "connected");
    drawOnlinePanel();
  }

  function roleFromPlayers(players) {
    if (players?.axis === app.online.playerId) return "axis";
    if (players?.allied === app.online.playerId) return "allied";
    return "spectator";
  }

  function updateRoomUrl(code) {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("room", code);
    else url.searchParams.delete("room");
    window.history.replaceState(null, "", url);
  }

  function canControlPhase() {
    if (!app.online.connected) return true;
    return app.online.role === activeSide();
  }

  function requirePhaseControl() {
    if (canControlPhase()) return true;
    log(`联机等待 ${sideLabel(activeSide())} 操作。你当前是 ${onlineRoleLabel()}。`);
    draw();
    return false;
  }

  function snapshotStateForOnline() {
    const state = clone(app.state);
    state.selectedUnitId = null;
    state.selectedDefenderId = null;
    state.selectedAttackers = [];
    if (state.retreatTask?.battle) delete state.retreatTask.battle;
    if (state.winner) state.winnerDialogShown = false;
    return state;
  }

  function sanitizeOnlineState(remoteState) {
    const state = clone(remoteState);
    if (!state || state.version !== 1 || !Array.isArray(state.units)) throw new Error("Bad remote state");
    state.selectedUnitId = null;
    state.selectedDefenderId = null;
    state.selectedAttackers = [];
    state.declaredCombats ||= [];
    state.movedUnits ||= [];
    state.usedAttackers ||= [];
    state.usedDefenders ||= [];
    state.log ||= [];
    state.combatMode ||= "declare";
    state.combatCompleteNotified = Boolean(state.combatCompleteNotified);
    if (state.winner) state.winnerDialogShown = false;
    return state;
  }

  function refreshDerivedStateAfterRemote() {
    app.reachable.clear();
    app.legalRetreats.clear();
    const task = app.state.retreatTask;
    if (!task) return;
    const unit = unitById(task.unitIds[task.index]);
    if (unit && !unit.eliminated) {
      const originHexId = task.origins?.[unit.id] || unit.hexId;
      app.legalRetreats = legalRetreatDestinations(unit, task.steps, originHexId);
    }
  }

  function applyOnlineRoom(room, options = {}) {
    if (!room || normalizeRoomCode(room.code) !== app.online.roomCode) return;
    const incomingRevision = Number(room.revision || 0);
    app.online.players = room.players || {};
    app.online.role = roleFromPlayers(app.online.players) || "spectator";
    const shouldApplyState = options.force || room.updated_by !== app.online.playerId || incomingRevision > app.online.revision;
    app.online.revision = Math.max(app.online.revision, incomingRevision);
    if (room.state && shouldApplyState) {
      try {
        app.online.applyingRemote = true;
        app.state = sanitizeOnlineState(room.state);
        refreshDerivedStateAfterRemote();
      } catch (error) {
        setOnlineStatus(`远端局面无法读取：${error.message}`, "error");
      } finally {
        app.online.applyingRemote = false;
      }
    }
    if (app.online.connected) {
      setOnlineStatus(`房间 ${app.online.roomCode} 已连接，你是 ${onlineRoleLabel()}。`, "connected");
    }
    draw();
    presentVictoryDialog();
  }

  function syncOnlineState(reason) {
    if (!app.online.connected || app.online.applyingRemote) return;
    app.online.pendingSyncReason = reason || app.online.pendingSyncReason;
    if (app.online.syncing) return;
    pushOnlineState();
  }

  async function pushOnlineState() {
    if (!app.online.connected || app.online.syncing) return;
    app.online.syncing = true;
    const reason = app.online.pendingSyncReason;
    app.online.pendingSyncReason = "";
    const nextRevision = app.online.revision + 1;
    const payload = {
      state: snapshotStateForOnline(),
      revision: nextRevision,
      updated_by: app.online.playerId,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await app.online.client
      .from("el_alamein_rooms")
      .update(payload)
      .eq("code", app.online.roomCode)
      .eq("revision", app.online.revision)
      .select("code, state, players, revision, updated_by")
      .maybeSingle();
    app.online.syncing = false;
    if (error) {
      setOnlineStatus(`同步失败：${error.message}`, "error");
      drawOnlinePanel();
      return;
    }
    if (!data) {
      await reloadOnlineRoom("房间状态有新版本，已重新同步。");
      return;
    }
    app.online.revision = Number(data.revision || nextRevision);
    app.online.players = data.players || app.online.players;
    app.online.role = roleFromPlayers(app.online.players) || "spectator";
    setOnlineStatus(`房间 ${app.online.roomCode} 已同步：${reason || "update"}。`, "connected");
    drawOnlinePanel();
    if (app.online.pendingSyncReason) pushOnlineState();
  }

  async function reloadOnlineRoom(message) {
    const { data, error } = await app.online.client
      .from("el_alamein_rooms")
      .select("code, state, players, revision, updated_by")
      .eq("code", app.online.roomCode)
      .maybeSingle();
    if (error || !data) {
      setOnlineStatus(error ? `重新同步失败：${error.message}` : "房间已不存在。", "error");
      return;
    }
    setOnlineStatus(message, "connected");
    applyOnlineRoom(data, { force: true });
  }

  function centerOnOpeningFront() {
    requestAnimationFrame(() => {
      el.boardViewport.scrollLeft = 420;
      el.boardViewport.scrollTop = 260;
    });
  }

  function onBoardClick(event) {
    if (app.state.winner) return;
    if (app.animating) return;
    const rect = el.boardSurface.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const hex = nearestHex(point);
    if (!hex) return;

    if (app.state.retreatTask) {
      if (!requirePhaseControl()) return;
      chooseRetreatHex(hex.id);
      return;
    }

    if (isMovementPhase() && app.state.selectedUnitId) {
      if (!requirePhaseControl()) return;
      attemptMove(hex.id);
      return;
    }

    if (isCombatPhase() && app.state.combatMode === "declare") {
      if (!requirePhaseControl()) return;
      chooseCombatHex(hex.id);
    }
  }

  function nearestHex(point) {
    let best = null;
    for (const hex of app.hexes) {
      const score = Math.hypot(hex.center.x - point.x, hex.center.y - point.y);
      if (!best || score < best.score) best = { hex, score };
    }
    return best?.score <= 58 ? best.hex : null;
  }

  function onUnitClick(event, unitId) {
    event.stopPropagation();
    if (app.state.winner) return;
    if (app.animating) return;
    const unit = unitById(unitId);
    if (!unit || unit.eliminated) return;

    if (app.state.retreatTask) {
      return;
    }

    if (app.state.advanceTask) {
      if (!requirePhaseControl()) return;
      if (app.state.advanceTask.attackerIds.includes(unit.id)) advanceUnit(unit.id);
      else log("请选择参与本次攻击的单位进行战后挺进。");
      draw();
      return;
    }

    if (isCombatPhase() && app.state.combatMode === "declare") {
      if (!requirePhaseControl()) return;
      if (unit.side !== activeSide()) {
        setCombatDefender(unit);
      } else {
        toggleCombatAttacker(unit);
      }
    } else {
      selectUnit(unit);
    }
    draw();
  }

  function selectUnit(unit) {
    if (isMovementPhase() && app.state.lastMove && app.state.lastMove.unitId !== unit.id) {
      clearLastMove();
    }
    if (isMovementPhase() && app.state.selectedUnitId === unit.id) {
      if (canUndoLastMove(unit)) return;
      app.state.selectedUnitId = null;
      app.reachable.clear();
      return;
    }
    app.state.selectedUnitId = unit.id;
    app.reachable.clear();
    if (isMovementPhase() && canControlPhase() && unit.side === activeSide() && !unit.disrupted && !app.state.movedUnits.includes(unit.id)) {
      app.reachable = reachableHexes(unit);
    }
  }

  function clearLastMove() {
    app.state.lastMove = null;
  }

  function canUndoLastMove(unit = unitById(app.state.selectedUnitId)) {
    const move = app.state.lastMove;
    return Boolean(
      move &&
      unit &&
      move.unitId === unit.id &&
      move.turn === app.state.turn &&
      move.phaseIndex === app.state.phaseIndex &&
      isMovementPhase() &&
      !app.state.winner &&
      !app.animating
    );
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function animateUnitPath(unit, path) {
    const steps = Array.isArray(path) && path.length ? path : [unit.hexId];
    app.animating = true;
    for (const hexId of steps.slice(1)) {
      unit.hexId = hexId;
      draw();
      await delay(70);
    }
    app.animating = false;
  }

  function chooseCombatHex(hexId) {
    const unit = liveUnitAt(hexId);
    if (!unit) return;
    if (unit.side !== activeSide()) setCombatDefender(unit);
    else toggleCombatAttacker(unit);
    draw();
  }

  function setCombatDefender(unit) {
    if (unit.side === activeSide() || unit.disrupted || app.state.usedDefenders.includes(unit.id)) return;
    app.state.selectedDefenderId = unit.id;
    app.state.selectedAttackers = neighborsOf(unit.hexId)
      .map(liveUnitAt)
      .filter((attacker) => canAttack(attacker, unit))
      .map((attacker) => attacker.id);
  }

  function toggleCombatAttacker(unit) {
    if (!unit || unit.side !== activeSide() || unit.disrupted || app.state.usedAttackers.includes(unit.id)) return;
    const defender = unitById(app.state.selectedDefenderId);
    if (defender && !canAttack(unit, defender)) return;
    if (app.state.selectedAttackers.includes(unit.id)) {
      app.state.selectedAttackers = app.state.selectedAttackers.filter((id) => id !== unit.id);
    } else {
      app.state.selectedAttackers.push(unit.id);
    }
  }

  function canAttack(attacker, defender) {
    if (!attacker || !defender) return false;
    if (attacker.side !== activeSide()) return false;
    if (attacker.disrupted || defender.disrupted) return false;
    if (app.state.usedAttackers.includes(attacker.id)) return false;
    if (app.state.usedDefenders.includes(defender.id)) return false;
    return neighborsOf(attacker.hexId).includes(defender.hexId);
  }

  function declareBattle() {
    if (!requirePhaseControl()) return;
    const defender = unitById(app.state.selectedDefenderId);
    const attackers = app.state.selectedAttackers.map(unitById).filter(Boolean);
    if (!defender || !attackers.length) {
      log("战斗宣告需要守方和至少一个攻方单位。");
      draw();
      return;
    }
    if (attackers.some((attacker) => !canAttack(attacker, defender))) {
      log("宣告失败：攻击单位必须相邻且未参加其他战斗。");
      draw();
      return;
    }
    const battle = {
      id: `b${Date.now()}-${app.state.declaredCombats.length}`,
      phaseId: phase().id,
      defenderId: defender.id,
      defenderHexId: defender.hexId,
      attackerIds: attackers.map((unit) => unit.id),
      attackerOrigins: Object.fromEntries(attackers.map((unit) => [unit.id, unit.hexId])),
      oddsAtDeclaration: formatOddsWithDefense(calculateOdds(attackers, defender)),
      resolved: false,
      result: null,
    };
    app.state.declaredCombats.push(battle);
    app.state.combatCompleteNotified = false;
    app.state.usedDefenders.push(defender.id);
    app.state.usedAttackers.push(...attackers.map((unit) => unit.id));
    log(`宣告战斗：${attackers.map((unit) => unit.name).join(" + ")} 攻击 ${defender.name}。`);
    app.state.selectedDefenderId = null;
    app.state.selectedAttackers = [];
    draw();
    syncOnlineState("declare-combat");
  }

  function finishDeclarations() {
    if (!isCombatPhase() || app.state.combatMode !== "declare") return;
    if (!requirePhaseControl()) return;
    app.state.combatMode = "resolve";
    app.state.combatCompleteNotified = !app.state.declaredCombats.length;
    log(app.state.declaredCombats.length ? "战斗宣告完成，进入结算。" : "本阶段没有宣告战斗。");
    draw();
    syncOnlineState("finish-declarations");
    if (app.state.declaredCombats.length) {
      window.setTimeout(() => resolveNextBattle(), 80);
    }
  }

  function currentBattle() {
    if (app.state.retreatTask) return battleById(app.state.retreatTask.battleId) || app.state.retreatTask.battle;
    if (app.state.advanceTask) return app.state.declaredCombats.find((battle) => battle.id === app.state.advanceTask.battleId) || null;
    return app.state.declaredCombats.find((item) => !item.resolved) || null;
  }

  function battleById(id) {
    return app.state.declaredCombats.find((battle) => battle.id === id) || null;
  }

  function hasPendingBattles() {
    return app.state.declaredCombats.some((item) => !item.resolved);
  }

  function markCombatCompleteOnce() {
    if (!isCombatPhase() || app.state.combatMode !== "resolve") return;
    if (app.state.retreatTask || app.state.advanceTask || hasPendingBattles()) return;
    if (!app.state.combatCompleteNotified) {
      app.state.combatCompleteNotified = true;
      log("所有宣告战斗已结算完成。");
    }
  }

  function resolveNextBattle() {
    if (!isCombatPhase() || app.state.combatMode !== "resolve") return;
    if (!requirePhaseControl()) return;
    if (app.state.retreatTask || app.state.advanceTask) return;
    const battle = currentBattle();
    if (!battle) {
      markCombatCompleteOnce();
      draw();
      syncOnlineState("combat-complete");
      return;
    }
    const defender = unitById(battle.defenderId);
    const attackers = battle.attackerIds.map(unitById).filter((unit) => unit && !unit.eliminated);
    if (!defender || defender.eliminated || !attackers.length) {
      battle.resolved = true;
      battle.result = "Skipped";
      log("跳过一场已失效的战斗。");
      markCombatCompleteOnce();
      draw();
      syncOnlineState("skip-combat");
      return;
    }

    const odds = calculateOdds(attackers, defender);
    const roll = Math.floor(Math.random() * 6) + 1;
    const result = app.rules.crt.rows[String(roll)][odds.columnIndex];
    battle.result = `${roll}/${odds.column}/${result}`;
    battle.oddsAtResolution = formatOddsWithDefense(odds);
    log(`战斗结算：${odds.attack}:${odds.defense} -> ${odds.column}，骰 ${roll}，结果 ${result}。`);
    showCombatResultDialog(battle, odds, roll, result);
    applyCombatResult(battle, result);
    markCombatCompleteOnce();
    draw();
    syncOnlineState("resolve-combat");
  }

  function calculateOdds(attackers, defender) {
    const attack = attackers.reduce((sum, unit) => sum + unit.combat, 0);
    const defenseInfo = defenseBreakdown(defender);
    const defense = defenseInfo.total;
    const ratio = attack / Math.max(1, defense);
    const thresholds = [0.5, 1, 2, 3, 4, 5, 6];
    let columnIndex = 0;
    for (let index = 0; index < thresholds.length; index += 1) {
      if (ratio >= thresholds[index]) columnIndex = index;
    }
    return {
      attack,
      defense,
      defenseInfo,
      ratio,
      columnIndex,
      column: app.rules.crt.columns[columnIndex],
    };
  }

  function formatOdds(odds) {
    if (!odds) return "--";
    return `${odds.attack}:${odds.defense} / ${odds.column}`;
  }

  function formatOddsWithDefense(odds) {
    if (!odds) return "--";
    const detail = formatDefenseDetail(odds.defenseInfo);
    return detail ? `${formatOdds(odds)}；${detail}` : formatOdds(odds);
  }

  function formatDefenseDetail(info) {
    if (!info || !info.effects.length) return "";
    const effects = info.effects.join("，");
    return `守方 ${info.base} x ${info.multiplier} = ${info.total}（${effects}）`;
  }

  function previewOddsText(attackers, defender) {
    if (!defender || !attackers.length) return "赔率：--";
    return `赔率：${formatOddsWithDefense(calculateOdds(attackers, defender))}`;
  }

  function showCombatResultDialog(battle, odds, roll, result) {
    if (!el.combatResultDialog || !el.combatResultBody) return;
    const defender = unitById(battle.defenderId);
    const attackers = battle.attackerIds.map(unitById).filter(Boolean);
    el.combatResultTitle.textContent = `战斗结果：${result}`;
    el.combatResultBody.replaceChildren();
    const lines = [
      `${attackers.map((unit) => unit.name).join(" + ")} -> ${defender?.name || "?"}`,
      `守方格：${battle.defenderHexId}`,
      `赔率：${formatOddsWithDefense(odds)}`,
      `骰点：${roll}`,
      `结果：${combatResultLabel(result)}`,
    ];
    for (const line of lines) {
      const item = document.createElement("p");
      item.textContent = line;
      el.combatResultBody.append(item);
    }
    if (!el.combatResultDialog.open) {
      try {
        el.combatResultDialog.showModal();
      } catch (_) {
        el.combatResultDialog.setAttribute("open", "");
      }
    }
  }

  function combatResultLabel(result) {
    if (result === "AE") return "攻方消灭";
    if (result === "AR") return "攻方撤退 1 格";
    if (result === "DE") return "守方消灭";
    const match = result.match(/^DR(\d+)$/);
    if (match) return `守方撤退 ${match[1]} 格`;
    return result;
  }

  function defenseMultiplier(unit) {
    return defenseBreakdown(unit).multiplier;
  }

  function defenseBreakdown(unit) {
    const hex = hexById(unit.hexId);
    const terrain = terrainRule(hex);
    const effects = [];
    let multiplier = Number(terrain.defenseMultiplier || 1);
    if (multiplier > 1) effects.push(`${terrain.label} x${multiplier}`);

    const positionRule = app.rules.britishPosition;
    if (hex?.britishPosition && unit.side === positionRule.appliesOnlyToSide) {
      const positionMultiplier = Number(positionRule.defenseMultiplier || 1);
      if (positionMultiplier > 1) {
        if (positionRule.stacksWithHighland) {
          multiplier *= positionMultiplier;
          effects.push(`${positionRule.label} x${positionMultiplier}`);
        } else {
          multiplier = Math.max(multiplier, positionMultiplier);
          const note = Number(terrain.defenseMultiplier || 1) > 1 ? "，不叠加" : "";
          effects.push(`${positionRule.label} x${positionMultiplier}${note}`);
        }
      }
    } else if (hex?.britishPosition) {
      effects.push(`${positionRule.label} 仅英军`);
    }

    return {
      base: unit.combat,
      multiplier,
      total: unit.combat * multiplier,
      effects,
    };
  }

  function applyCombatResult(battle, result) {
    if (result === "AE") {
      for (const id of battle.attackerIds) eliminateUnit(id);
      battle.resolved = true;
      return;
    }
    if (result === "DE") {
      eliminateUnit(battle.defenderId);
      battle.resolved = true;
      startAdvanceTask(battle);
      return;
    }
    if (result === "AR") {
      startRetreatTask({
        battle,
        unitIds: battle.attackerIds.filter((id) => !unitById(id)?.eliminated),
        steps: 1,
        result,
        origins: battle.attackerOrigins,
        disruptAfterRetreat: false,
        advanceAfter: false,
      });
      return;
    }
    const match = result.match(/^DR(\d+)$/);
    if (match) {
      startRetreatTask({
        battle,
        unitIds: [battle.defenderId].filter((id) => !unitById(id)?.eliminated),
        steps: Number(match[1]),
        result,
        origins: { [battle.defenderId]: battle.defenderHexId },
        disruptAfterRetreat: true,
        advanceAfter: true,
      });
    }
  }

  function eliminateUnit(id) {
    const unit = unitById(id);
    if (!unit || unit.eliminated) return;
    unit.eliminated = true;
    unit.disrupted = false;
    log(`${unit.name} 被消灭。`);
  }

  function startRetreatTask(task) {
    task.battleId = task.battle?.id || task.battleId;
    task.index = 0;
    app.state.retreatTask = task;
    prepareCurrentRetreat();
  }

  function prepareCurrentRetreat() {
    const task = app.state.retreatTask;
    if (!task) return;
    while (task.index < task.unitIds.length) {
      const unit = unitById(task.unitIds[task.index]);
      if (!unit || unit.eliminated) {
        task.index += 1;
        continue;
      }
      const originHexId = task.origins[unit.id] || unit.hexId;
      app.legalRetreats = legalRetreatDestinations(unit, task.steps, originHexId);
      if (app.legalRetreats.size) {
        log(`${unit.name} 需要撤退 ${task.steps} 格。`);
        draw();
        return;
      }
      eliminateUnit(unit.id);
      log(`${unit.name} 无法合法撤退。`);
      task.index += 1;
    }
    finishRetreatTask();
  }

  function chooseRetreatHex(hexId) {
    if (!requirePhaseControl()) return;
    const task = app.state.retreatTask;
    if (!task || !app.legalRetreats.has(hexId)) return;
    const unit = unitById(task.unitIds[task.index]);
    unit.hexId = hexId;
    unit.disrupted = Boolean(task.disruptAfterRetreat);
    log(task.disruptAfterRetreat ? `${unit.name} 撤退到 ${hexId} 并进入混乱。` : `${unit.name} 撤退到 ${hexId}。`);
    task.index += 1;
    prepareCurrentRetreat();
    syncOnlineState("retreat");
  }

  function finishRetreatTask() {
    const task = app.state.retreatTask;
    if (!task) return;
    const battle = battleById(task.battleId) || task.battle;
    if (battle) battle.resolved = true;
    app.state.retreatTask = null;
    app.legalRetreats.clear();
    if (task.advanceAfter && battle) startAdvanceTask(battle);
    markCombatCompleteOnce();
    draw();
  }

  function startAdvanceTask(battle) {
    const targetHexId = battle.defenderHexId;
    if (liveUnitAt(targetHexId)) return;
    const eligible = battle.attackerIds.filter((id) => {
      const unit = unitById(id);
      return unit && !unit.eliminated && neighborsOf(unit.hexId).includes(targetHexId);
    });
    if (!eligible.length) return;
    app.state.advanceTask = {
      battleId: battle.id,
      targetHexId,
      attackerIds: eligible,
    };
  }

  function advanceUnit(unitId) {
    if (!requirePhaseControl()) return;
    const task = app.state.advanceTask;
    if (!task || unitId === "skip") {
      app.state.advanceTask = null;
      draw();
      syncOnlineState("advance-skip");
      return;
    }
    const unit = unitById(unitId);
    if (unit && !unit.eliminated && !liveUnitAt(task.targetHexId)) {
      unit.hexId = task.targetHexId;
      log(`${unit.name} 战后挺进。`);
    }
    app.state.advanceTask = null;
    markCombatCompleteOnce();
    draw();
    syncOnlineState("advance");
  }

  function legalRetreatDestinations(unit, requiredSteps, originHexId) {
    const result = new Set();
    const origin = hexById(originHexId);
    const maxSteps = requiredSteps + 6;
    const seen = new Set();
    const queue = [{ hexId: unit.hexId, steps: 0 }];

    while (queue.length) {
      const current = queue.shift();
      const key = `${current.hexId}:${current.steps}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const currentDistance = hexDistance(current.hexId, originHexId);

      if (current.steps >= requiredSteps) {
        const occupant = liveUnitAt(current.hexId);
        if (!occupant || occupant.id === unit.id) {
          result.add(current.hexId);
          continue;
        }
      }
      if (current.steps >= maxSteps) continue;

      for (const nextId of neighborsOf(current.hexId)) {
        const nextHex = hexById(nextId);
        if (!terrainRule(nextHex).passable) continue;
        const occupant = liveUnitAt(nextId);
        if (occupant && occupant.side !== unit.side) continue;
        if (isEnemyZoc(nextId, unit.side, unit.id)) continue;
        if (hexDistance(nextId, origin.id) <= currentDistance) continue;
        queue.push({ hexId: nextId, steps: current.steps + 1 });
      }
    }
    result.delete(unit.hexId);
    return result;
  }

  async function attemptMove(destinationHexId) {
    if (!requirePhaseControl()) return;
    const unit = unitById(app.state.selectedUnitId);
    if (!unit || unit.side !== activeSide() || unit.eliminated) return;
    if (unit.disrupted) {
      log(`${unit.name} 正在混乱，不能移动。`);
      draw();
      return;
    }
    if (app.state.movedUnits.includes(unit.id)) {
      log(`${unit.name} 本阶段已经移动。`);
      draw();
      return;
    }
    const route = app.reachable.get(destinationHexId);
    if (!route) return;
    const occupant = liveUnitAt(destinationHexId);
    if (occupant && occupant.id !== unit.id) {
      log("目标格已有单位。");
      draw();
      return;
    }
    const fromHexId = unit.hexId;
    const path = route.path || [fromHexId, destinationHexId];
    const movedUnitsBefore = app.state.movedUnits.slice();
    app.reachable.clear();
    await animateUnitPath(unit, path);
    unit.hexId = destinationHexId;
    app.state.movedUnits.push(unit.id);
    app.state.lastMove = {
      unitId: unit.id,
      fromHexId,
      toHexId: destinationHexId,
      path,
      movedUnitsBefore,
      turn: app.state.turn,
      phaseIndex: app.state.phaseIndex,
    };
    log(`${unit.name} 移动到 ${destinationHexId}，剩余移动力 ${route.remaining}。`);
    if (unit.side === "allied" && app.scenario.objectives.alliedWestExitEdge.includes(destinationHexId) && route.remaining > 0) {
      setWinner("allied", `${unit.name} 从西侧边缘脱出。`);
    }
    app.state.selectedUnitId = unit.id;
    draw();
    syncOnlineState("move");
  }

  async function undoLastMove() {
    const move = app.state.lastMove;
    const unit = unitById(move?.unitId);
    if (!canUndoLastMove(unit)) return;
    const reversePath = (move.path || [move.fromHexId, move.toHexId]).slice().reverse();
    app.reachable.clear();
    await animateUnitPath(unit, reversePath);
    unit.hexId = move.fromHexId;
    app.state.movedUnits = move.movedUnitsBefore || app.state.movedUnits.filter((id) => id !== unit.id);
    app.state.selectedUnitId = unit.id;
    app.state.lastMove = null;
    log(`${unit.name} 取消移动，回到 ${move.fromHexId}。`);
    draw();
    syncOnlineState("undo-move");
  }

  function reachableHexes(unit) {
    const allowance = movementAllowance(unit);
    const startHexId = unit.hexId;
    const result = new Map();
    const startInZoc = isEnemyZoc(startHexId, unit.side, unit.id);
    const queue = [{ hexId: startHexId, spent: 0, firstStep: true, path: [startHexId] }];
    const bestSpent = new Map([[startHexId, 0]]);

    while (queue.length) {
      const current = queue.shift();
      const currentInZoc = isEnemyZoc(current.hexId, unit.side, unit.id);
      if (!current.firstStep && currentInZoc) continue;

      for (const nextId of neighborsOf(current.hexId)) {
        const nextHex = hexById(nextId);
        const rule = terrainRule(nextHex);
        if (!rule.passable) continue;
        const occupant = liveUnitAt(nextId);
        if (occupant && occupant.side !== unit.side) continue;
        const nextInZoc = isEnemyZoc(nextId, unit.side, unit.id);
        if (currentInZoc && nextInZoc) continue;
        if (startInZoc && nextInZoc) continue;
        const cost = Number(rule.movement || 1);
        const spent = current.spent + cost;
        if (spent > allowance) continue;
        if (bestSpent.has(nextId) && bestSpent.get(nextId) <= spent) continue;
        bestSpent.set(nextId, spent);
        const remaining = allowance - spent;
        const path = current.path.concat(nextId);
        if (!occupant || occupant.id === unit.id) {
          result.set(nextId, { spent, remaining, path });
        }
        queue.push({ hexId: nextId, spent, firstStep: false, path });
      }
    }
    result.delete(startHexId);
    return result;
  }

  function movementAllowance(unit) {
    let movement = unit.movement;
    if (unit.side === "allied" && app.state.turn === 1) {
      movement = Math.max(1, Math.floor(movement * app.rules.firstTurnAlliedMovementMultiplier));
    }
    return movement;
  }

  function isEnemyZoc(hexId, friendlySide, ignoreUnitId = null) {
    return liveUnits().some((unit) => {
      if (unit.id === ignoreUnitId || unit.side === friendlySide || unit.disrupted) return false;
      return neighborsOf(unit.hexId).includes(hexId);
    });
  }

  function neighborsOf(hexId) {
    const hex = hexById(hexId);
    if (!hex) return [];
    const oddRow = Math.abs(hex.row % 2) === 1;
    const offsets = oddRow
      ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]]
      : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
    return offsets
      .map(([dc, dr]) => app.hexes.find((candidate) => candidate.col === hex.col + dc && candidate.row === hex.row + dr)?.id)
      .filter(Boolean);
  }

  function hexDistance(fromId, toId) {
    if (fromId === toId) return 0;
    const queue = [{ id: fromId, distance: 0 }];
    const seen = new Set([fromId]);
    while (queue.length) {
      const current = queue.shift();
      for (const next of neighborsOf(current.id)) {
        if (seen.has(next)) continue;
        if (next === toId) return current.distance + 1;
        seen.add(next);
        queue.push({ id: next, distance: current.distance + 1 });
      }
    }
    return Infinity;
  }

  function endPhase() {
    if (app.state.winner) return;
    if (!requirePhaseControl()) return;
    if (app.state.retreatTask || app.state.advanceTask) {
      log("先完成当前任务。");
      draw();
      return;
    }
    if (isCombatPhase() && app.state.combatMode === "resolve" && app.state.declaredCombats.some((battle) => !battle.resolved)) {
      log("还有未结算的战斗。");
      draw();
      return;
    }
    if (isCombatPhase() && app.state.combatMode === "declare" && app.state.declaredCombats.length) {
      log("请先完成战斗宣告。");
      draw();
      return;
    }

    if (isCombatPhase()) {
      recoverSide(activeSide());
    }

    app.state.selectedUnitId = null;
    app.state.selectedDefenderId = null;
    app.state.selectedAttackers = [];
    app.state.declaredCombats = [];
    app.state.combatCompleteNotified = false;
    app.state.usedAttackers = [];
    app.state.usedDefenders = [];
    app.state.movedUnits = [];
    app.state.lastMove = null;
    app.state.combatMode = "declare";
    app.reachable.clear();
    app.legalRetreats.clear();

    if (app.state.phaseIndex === app.rules.phases.length - 1) {
      if (checkAxisObjectiveVictory()) {
        draw();
        syncOnlineState("axis-objective-victory");
        return;
      }
      if (app.state.turn >= app.rules.turns.length) {
        setWinner("allied", "4 回合结束，轴心国未达成胜利。");
      } else {
        app.state.turn += 1;
        app.state.phaseIndex = 0;
        log(`进入第 ${app.state.turn} 回合。`);
      }
    } else {
      app.state.phaseIndex += 1;
      log(`进入 ${phaseLabel(phase().id)}。`);
    }
    draw();
    syncOnlineState("end-phase");
  }

  function recoverSide(side) {
    for (const unit of app.state.units) {
      if (!unit.eliminated && unit.side === side && unit.disrupted) {
        unit.disrupted = false;
        log(`${unit.name} 从混乱恢复。`);
      }
    }
  }

  function checkAxisObjectiveVictory() {
    const axisUnits = liveUnits().filter((unit) => unit.side === "axis");
    const ridge = new Set(app.scenario.objectives.alamHalfaRidge);
    const road = new Set(app.scenario.objectives.coastalRoadEast);
    const ridgeUnit = axisUnits.find((unit) => ridge.has(unit.hexId));
    const roadUnit = axisUnits.find((unit) => road.has(unit.hexId));
    if (ridgeUnit) {
      setWinner("axis", `${ridgeUnit.name} 占领阿拉姆哈勒法岭目标阵地。`);
      return true;
    }
    if (roadUnit) {
      setWinner("axis", `${roadUnit.name} 占领阿拉曼以东沿海道路。`);
      return true;
    }
    return false;
  }

  function setWinner(side, reason) {
    app.state.winner = { side, reason, summary: buildVictorySummary(side, reason) };
    app.state.winnerDialogShown = false;
    log(`${sideLabel(side)} 胜利：${reason}`);
    presentVictoryDialog();
  }

  function buildVictorySummary(side, reason) {
    const eliminated = app.state.units.filter((unit) => unit.eliminated).map((unit) => unit.name);
    const axisUnits = liveUnits().filter((unit) => unit.side === "axis");
    const alliedUnits = liveUnits().filter((unit) => unit.side === "allied");
    const ridge = new Set(app.scenario.objectives.alamHalfaRidge);
    const road = new Set(app.scenario.objectives.coastalRoadEast);
    const west = new Set(app.scenario.objectives.alliedWestExitEdge);
    const ridgeOccupiers = axisUnits.filter((unit) => ridge.has(unit.hexId)).map((unit) => unit.name);
    const roadOccupiers = axisUnits.filter((unit) => road.has(unit.hexId)).map((unit) => unit.name);
    const westEdgeAllies = alliedUnits.filter((unit) => west.has(unit.hexId)).map((unit) => unit.name);
    return {
      title: `${sideLabel(side)} 胜利`,
      lines: [
        `胜利方式：${reason}`,
        eliminated.length ? `已歼灭部队：${eliminated.join("、")}` : "已歼灭部队：无",
        ridgeOccupiers.length ? `阿拉姆哈勒法岭目标：${ridgeOccupiers.join("、")} 占领` : "阿拉姆哈勒法岭目标：未被轴心占领",
        roadOccupiers.length ? `阿拉曼以东沿海道路：${roadOccupiers.join("、")} 占领或切断` : "阿拉曼以东沿海道路：未被轴心占领或切断",
        westEdgeAllies.length ? `西侧脱出边：${westEdgeAllies.join("、")} 位于边缘` : "西侧脱出边：无英军停留",
      ],
    };
  }

  function presentVictoryDialog() {
    if (!app.state.winner || app.state.winnerDialogShown || !el.victoryDialog) return;
    const summary = app.state.winner.summary || buildVictorySummary(app.state.winner.side, app.state.winner.reason);
    el.victoryTitle.textContent = summary.title;
    el.victoryBody.replaceChildren();
    for (const line of summary.lines) {
      const item = document.createElement("p");
      item.textContent = line;
      el.victoryBody.append(item);
    }
    app.state.winnerDialogShown = true;
    if (!el.victoryDialog.open) {
      try {
        el.victoryDialog.showModal();
      } catch (_) {
        el.victoryDialog.setAttribute("open", "");
      }
    }
  }

  function draw() {
    if (!app.state) return;
    drawStatus();
    drawHexLayer();
    drawUnits();
    drawSelectedUnit();
    drawCombatPanel();
    drawTaskPanel();
    drawLog();
    drawOnlinePanel();
  }

  function drawStatus() {
    const turn = app.rules.turns[app.state.turn - 1];
    const canAct = canControlPhase();
    el.turnLabel.textContent = `${turn?.label || `Turn ${app.state.turn}`} · ${sideLabel(activeSide())}`;
    el.phaseLabel.textContent = phase().label;
    el.boardBadge.textContent = boardBadgeText();
    el.finishDeclarationsButton.hidden = !(isCombatPhase() && app.state.combatMode === "declare");
    el.resolveBattleButton.hidden = !(isCombatPhase() && app.state.combatMode === "resolve");
    if (isCombatPhase() && app.state.combatMode === "resolve") {
      const pendingBattle = currentBattle();
      el.resolveBattleButton.disabled = Boolean(app.state.winner || !canAct || app.state.retreatTask || app.state.advanceTask || !pendingBattle);
      el.resolveBattleButton.textContent = pendingBattle ? "结算下一战 / Roll" : "战斗已结束 / Done";
    } else {
      el.resolveBattleButton.disabled = Boolean(app.state.winner || !canAct);
      el.resolveBattleButton.textContent = "结算下一战 / Roll";
    }
    el.finishDeclarationsButton.disabled = Boolean(app.state.winner || !canAct);
    el.endPhaseButton.disabled = Boolean(app.state.winner || !canAct);
    if (app.state.winner) {
      el.winnerBanner.hidden = false;
      el.winnerBanner.textContent = `${sideLabel(app.state.winner.side)} 胜利：${app.state.winner.reason}`;
    } else {
      el.winnerBanner.hidden = true;
      el.winnerBanner.textContent = "";
    }
  }

  function boardBadgeText() {
    if (app.state.retreatTask) {
      const unit = unitById(app.state.retreatTask.unitIds[app.state.retreatTask.index]);
      return unit ? `${unit.name} 撤退中` : "撤退中";
    }
    if (app.state.advanceTask) return "选择战后挺进单位";
    if (isMovementPhase()) return `${sideLabel(activeSide())} 移动阶段`;
    if (isCombatPhase() && app.state.combatMode === "declare") return `${sideLabel(activeSide())} 宣告战斗`;
    if (isCombatPhase()) return `${sideLabel(activeSide())} 结算战斗`;
    return "";
  }

  function drawBattleHighlights(ctx) {
    if (!isCombatPhase()) return;
    if (app.state.combatMode === "declare") {
      for (const battle of app.state.declaredCombats) {
        for (const attackerId of battle.attackerIds) {
          drawHex(ctx, hexById(unitById(attackerId)?.hexId), HIGHLIGHT.declaredAttack, 3);
        }
        drawHex(ctx, hexById(unitById(battle.defenderId)?.hexId), HIGHLIGHT.declaredDefender, 3);
      }
      return;
    }
    const battle = currentBattle();
    if (!battle) return;
    for (const attackerId of battle.attackerIds) {
      drawHex(ctx, hexById(unitById(attackerId)?.hexId), HIGHLIGHT.currentAttack, 5);
    }
    drawHex(ctx, hexById(unitById(battle.defenderId)?.hexId || battle.defenderHexId), HIGHLIGHT.currentDefender, 5);
  }

  function drawHexLayer() {
    const ctx = el.hexLayer.getContext("2d");
    ctx.clearRect(0, 0, el.hexLayer.width, el.hexLayer.height);
    drawBattleHighlights(ctx);
    if (app.state.selectedUnitId) drawHex(ctx, hexById(unitById(app.state.selectedUnitId)?.hexId), HIGHLIGHT.selected, 5);
    for (const hexId of app.reachable.keys()) drawHex(ctx, hexById(hexId), HIGHLIGHT.reachable, 3);
    if (app.state.selectedDefenderId) drawHex(ctx, hexById(unitById(app.state.selectedDefenderId)?.hexId), HIGHLIGHT.defender, 5);
    for (const attackerId of app.state.selectedAttackers) drawHex(ctx, hexById(unitById(attackerId)?.hexId), HIGHLIGHT.attack, 4);
    for (const hexId of app.legalRetreats) drawHex(ctx, hexById(hexId), HIGHLIGHT.retreat, 4);
    if (app.state.advanceTask) drawHex(ctx, hexById(app.state.advanceTask.targetHexId), HIGHLIGHT.attack, 5);
  }

  function drawHex(ctx, hex, color, lineWidth) {
    if (!hex) return;
    const radius = 49;
    const points = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 180 * (-90 + 60 * i);
      points.push({
        x: hex.center.x + Math.cos(angle) * radius,
        y: hex.center.y + Math.sin(angle) * radius,
      });
    }
    ctx.save();
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.strokeStyle = color.replace(/0\.\d+\)/, "0.95)");
    ctx.lineWidth = lineWidth;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function unitBattleRole(unitId) {
    if (app.state.combatMode === "declare") {
      for (const battle of app.state.declaredCombats) {
        if (battle.defenderId === unitId) return "declared-defender";
        if (battle.attackerIds.includes(unitId)) return "declared-attacker";
      }
    } else {
      const activeBattle = currentBattle();
      if (activeBattle?.defenderId === unitId) return "current-defender";
      if (activeBattle?.attackerIds.includes(unitId)) return "current-attacker";
    }
    return "";
  }

  function drawUnits() {
    el.unitLayer.replaceChildren();
    for (const unit of liveUnits()) {
      const hex = hexById(unit.hexId);
      if (!hex) continue;
      const node = document.createElement("button");
      node.type = "button";
      node.className = "unit";
      node.dataset.side = unit.side;
      node.dataset.selected = String(unit.id === app.state.selectedUnitId || unit.id === app.state.selectedDefenderId || app.state.selectedAttackers.includes(unit.id));
      node.dataset.used = String(app.state.movedUnits.includes(unit.id) || app.state.usedAttackers.includes(unit.id) || app.state.usedDefenders.includes(unit.id));
      node.dataset.battleRole = unitBattleRole(unit.id);
      node.style.left = `${hex.center.x}px`;
      node.style.top = `${hex.center.y}px`;
      node.title = `${unit.name} ${unit.combat}-${unit.movement}`;
      node.addEventListener("click", (event) => onUnitClick(event, unit.id));
      const image = document.createElement("img");
      image.src = unit.image;
      image.alt = unit.name;
      node.append(image);
      if (unit.disrupted) {
        const disrupted = document.createElement("span");
        disrupted.className = "disrupted";
        disrupted.textContent = "D";
        node.append(disrupted);
      }
      el.unitLayer.append(node);
    }
  }

  function drawSelectedUnit() {
    const unit = unitById(app.state.selectedUnitId) || unitById(app.state.selectedDefenderId);
    if (!unit) {
      el.selectedUnit.className = "selected-unit empty";
      el.selectedUnit.textContent = "--";
      return;
    }
    el.selectedUnit.className = "selected-unit";
    el.selectedUnit.replaceChildren(unitCard(unit));
  }

  function unitCard(unit) {
    const wrap = document.createElement("div");
    wrap.className = "unit-card";
    const image = document.createElement("img");
    image.src = unit.image;
    image.alt = unit.name;
    const meta = document.createElement("div");
    meta.className = "unit-meta";
    const title = document.createElement("strong");
    title.textContent = unit.name;
    const stats = document.createElement("span");
    stats.textContent = `${sideLabel(unit.side)} · ${nationalityLabel(unit.nationality)} · ${unit.combat}-${unit.movement}`;
    const state = document.createElement("span");
    state.textContent = unit.disrupted ? "混乱 / Disrupted" : "Ready";
    meta.append(title, stats, state);
    wrap.append(image, meta);
    if (canUndoLastMove(unit)) {
      const undo = document.createElement("button");
      undo.type = "button";
      undo.className = "undo-move-button";
      undo.textContent = "取消移动 / Undo Move";
      undo.addEventListener("click", undoLastMove);
      wrap.append(undo);
    }
    return wrap;
  }

  function drawCombatPanel() {
    el.combatComposer.replaceChildren();
    el.battleList.replaceChildren();

    if (!isCombatPhase()) {
      el.combatComposer.textContent = "--";
      return;
    }

    if (app.state.combatMode === "declare") {
      const defender = unitById(app.state.selectedDefenderId);
      const attackers = app.state.selectedAttackers.map(unitById).filter(Boolean);
      const defenderLine = document.createElement("div");
      defenderLine.innerHTML = `<strong>守方:</strong> ${defender ? defender.name : "--"}`;
      const attackerLine = document.createElement("div");
      attackerLine.innerHTML = `<strong>攻方:</strong>`;
      const row = document.createElement("div");
      row.className = "pill-row";
      if (attackers.length) attackers.forEach((unit) => row.append(pill(unit.name)));
      else row.append(pill("--"));
      const odds = document.createElement("div");
      odds.className = "odds-preview";
      odds.textContent = previewOddsText(attackers, defender);
      const actions = document.createElement("div");
      actions.className = "composer-actions";
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = "加入战斗 / Add";
      add.disabled = !defender || !attackers.length;
      add.addEventListener("click", declareBattle);
      const clear = document.createElement("button");
      clear.type = "button";
      clear.textContent = "清空 / Clear";
      clear.addEventListener("click", () => {
        app.state.selectedDefenderId = null;
        app.state.selectedAttackers = [];
        draw();
      });
      actions.append(add, clear);
      const declared = document.createElement("div");
      declared.className = "declared-summary";
      declared.textContent = app.state.declaredCombats.length ? `已宣告 ${app.state.declaredCombats.length} 场战斗。` : "尚未宣告战斗。";
      el.combatComposer.append(defenderLine, attackerLine, row, odds, actions, declared);
      return;
    }

    const activeBattle = currentBattle();
    if (activeBattle) {
      const defender = unitById(activeBattle.defenderId);
      const attackers = activeBattle.attackerIds.map(unitById).filter(Boolean);
      const odds = activeBattle.result
        ? activeBattle.oddsAtResolution
        : activeBattle.oddsAtDeclaration || formatOddsWithDefense(calculateOdds(attackers, defender));
      const card = document.createElement("div");
      card.className = "current-combat-card";
      const title = document.createElement("strong");
      title.textContent = `当前战斗：${activeBattle.defenderHexId}`;
      const line = document.createElement("p");
      line.textContent = `${attackers.map((unit) => unit.name).join(" + ")} -> ${defender?.name || "?"}`;
      const detail = document.createElement("p");
      detail.textContent = odds;
      card.append(title, line, detail);
      el.combatComposer.append(card);
    } else {
      el.combatComposer.textContent = app.state.declaredCombats.length ? "所有宣告战斗已结算完成。" : "本阶段没有宣告战斗。";
    }

    if (app.state.advanceTask) {
      const prompt = document.createElement("div");
      prompt.className = "advance-prompt";
      const text = document.createElement("span");
      text.textContent = `战后挺进：点击参与攻击单位进入 ${app.state.advanceTask.targetHexId}`;
      const skip = document.createElement("button");
      skip.type = "button";
      skip.textContent = "跳过 / Skip";
      skip.addEventListener("click", () => advanceUnit("skip"));
      prompt.append(text, skip);
      el.combatComposer.append(prompt);
    }

    for (const battle of app.state.declaredCombats) {
      const row = document.createElement("div");
      row.className = "battle-row";
      row.dataset.resolved = String(battle.resolved);
      row.dataset.current = String(activeBattle?.id === battle.id);
      const title = document.createElement("strong");
      title.textContent = `守方格：${battle.defenderHexId}`;
      const detail = document.createElement("small");
      detail.textContent = compactOddsText(battle.oddsAtResolution || battle.oddsAtDeclaration || phaseLabel(battle.phaseId));
      row.append(title, document.createElement("br"), detail);
      el.battleList.append(row);
    }
  }

  function compactOddsText(text) {
    return String(text || "--").split("；")[0];
  }

  function pill(text) {
    const node = document.createElement("span");
    node.className = "pill";
    node.textContent = text;
    return node;
  }

  function drawTaskPanel() {
    if (!el.taskPanel) return;
    el.taskPanel.replaceChildren();
    if (app.state.retreatTask) {
      const task = app.state.retreatTask;
      const unit = unitById(task.unitIds[task.index]);
      el.taskPanel.append(textNode(unit ? `${unit.name}: ${task.result}, ${task.steps} 格` : "撤退中"));
      return;
    }
    if (app.state.advanceTask) {
      const task = app.state.advanceTask;
      el.taskPanel.append(textNode(`目标格 ${task.targetHexId}`));
      const actions = document.createElement("div");
      actions.className = "task-actions";
      for (const id of task.attackerIds) {
        const unit = unitById(id);
        if (!unit) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${unit.name} 挺进`;
        button.addEventListener("click", () => advanceUnit(id));
        actions.append(button);
      }
      const skip = document.createElement("button");
      skip.type = "button";
      skip.textContent = "跳过 / Skip";
      skip.addEventListener("click", () => advanceUnit("skip"));
      actions.append(skip);
      el.taskPanel.append(actions);
      return;
    }
    el.taskPanel.textContent = "--";
  }

  function textNode(text) {
    const node = document.createElement("div");
    node.textContent = text;
    return node;
  }

  function drawLog() {
    if (!el.logList) return;
    if (el.logBlock) el.logBlock.dataset.expanded = String(app.logExpanded);
    if (el.logToggleButton) el.logToggleButton.textContent = app.logExpanded ? "收起 / Close" : "打开 / Open";
    el.logList.replaceChildren();
    const messages = app.logExpanded ? app.state.log.slice(-80) : app.state.log.slice(-1);
    for (const message of messages) {
      const item = document.createElement("p");
      item.textContent = message;
      el.logList.append(item);
    }
    if (app.logExpanded) el.logList.scrollTop = el.logList.scrollHeight;
  }

  function drawOnlinePanel() {
    if (!el.onlineStatus) return;
    el.onlineStatus.textContent = app.online.status;
    el.onlineStatus.dataset.mode = app.online.statusMode;
    if (el.roomCodeInput && app.online.roomCode) el.roomCodeInput.value = app.online.roomCode;

    const connected = app.online.connected;
    const players = app.online.players || {};
    if (el.createRoomButton) el.createRoomButton.disabled = connected;
    if (el.joinRoomButton) el.joinRoomButton.disabled = connected;
    if (el.leaveRoomButton) el.leaveRoomButton.disabled = !connected;

    const axisTaken = Boolean(players.axis && players.axis !== app.online.playerId);
    const alliedTaken = Boolean(players.allied && players.allied !== app.online.playerId);
    if (el.claimAxisButton) {
      el.claimAxisButton.disabled = !connected || axisTaken;
      el.claimAxisButton.dataset.active = String(app.online.role === "axis");
      el.claimAxisButton.textContent = axisTaken ? "轴心已占 / Axis" : "轴心 / Axis";
    }
    if (el.claimAlliedButton) {
      el.claimAlliedButton.disabled = !connected || alliedTaken;
      el.claimAlliedButton.dataset.active = String(app.online.role === "allied");
      el.claimAlliedButton.textContent = alliedTaken ? "英军已占 / Allied" : "英军 / Allied";
    }
    if (el.spectatorButton) {
      el.spectatorButton.disabled = !connected;
      el.spectatorButton.dataset.active = String(app.online.role === "spectator");
    }
  }

  init();
})();
