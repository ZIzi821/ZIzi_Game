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
    logList: document.getElementById("logList"),
    winnerBanner: document.getElementById("winnerBanner"),
    finishDeclarationsButton: document.getElementById("finishDeclarationsButton"),
    resolveBattleButton: document.getElementById("resolveBattleButton"),
    endPhaseButton: document.getElementById("endPhaseButton"),
    newGameButton: document.getElementById("newGameButton"),
    saveButton: document.getElementById("saveButton"),
    loadButton: document.getElementById("loadButton"),
    chartsButton: document.getElementById("chartsButton"),
    chartsDialog: document.getElementById("chartsDialog"),
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
      movedUnits: [],
      usedAttackers: [],
      usedDefenders: [],
      retreatTask: null,
      advanceTask: null,
      log: ["阿拉曼战役已载入。"],
      winner: null,
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
      app.state = makeInitialState();
      draw();
    });
    el.saveButton.addEventListener("click", saveGame);
    el.loadButton.addEventListener("click", loadGame);
    el.chartsButton.addEventListener("click", () => el.chartsDialog.showModal());
    el.endPhaseButton.addEventListener("click", endPhase);
    el.finishDeclarationsButton.addEventListener("click", finishDeclarations);
    el.resolveBattleButton.addEventListener("click", resolveNextBattle);
  }

  function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(app.state));
    log("局面已保存。");
    draw();
  }

  function loadGame() {
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
      app.reachable.clear();
      app.legalRetreats.clear();
      log("已读取本地存档。");
      draw();
    } catch (_) {
      log("存档无法读取。");
      draw();
    }
  }

  function centerOnOpeningFront() {
    requestAnimationFrame(() => {
      el.boardViewport.scrollLeft = 420;
      el.boardViewport.scrollTop = 260;
    });
  }

  function onBoardClick(event) {
    if (app.state.winner) return;
    const rect = el.boardSurface.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const hex = nearestHex(point);
    if (!hex) return;

    if (app.state.retreatTask) {
      chooseRetreatHex(hex.id);
      return;
    }

    if (isMovementPhase() && app.state.selectedUnitId) {
      attemptMove(hex.id);
      return;
    }

    if (isCombatPhase() && app.state.combatMode === "declare") {
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
    const unit = unitById(unitId);
    if (!unit || unit.eliminated) return;

    if (app.state.retreatTask || app.state.advanceTask) {
      return;
    }

    if (isCombatPhase() && app.state.combatMode === "declare") {
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
    if (isMovementPhase() && app.state.selectedUnitId === unit.id) {
      app.state.selectedUnitId = null;
      app.reachable.clear();
      return;
    }
    app.state.selectedUnitId = unit.id;
    app.reachable.clear();
    if (isMovementPhase() && unit.side === activeSide() && !unit.disrupted && !app.state.movedUnits.includes(unit.id)) {
      app.reachable = reachableHexes(unit);
    }
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
    app.state.selectedAttackers = app.state.selectedAttackers.filter((id) => canAttack(unitById(id), unit));
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
      resolved: false,
      result: null,
    };
    app.state.declaredCombats.push(battle);
    app.state.usedDefenders.push(defender.id);
    app.state.usedAttackers.push(...attackers.map((unit) => unit.id));
    log(`宣告战斗：${attackers.map((unit) => unit.name).join(" + ")} 攻击 ${defender.name}。`);
    app.state.selectedDefenderId = null;
    app.state.selectedAttackers = [];
    draw();
  }

  function finishDeclarations() {
    if (!isCombatPhase() || app.state.combatMode !== "declare") return;
    app.state.combatMode = "resolve";
    log(app.state.declaredCombats.length ? "战斗宣告完成，进入结算。" : "本阶段没有宣告战斗。");
    draw();
  }

  function resolveNextBattle() {
    if (!isCombatPhase() || app.state.combatMode !== "resolve") return;
    if (app.state.retreatTask || app.state.advanceTask) return;
    const battle = app.state.declaredCombats.find((item) => !item.resolved);
    if (!battle) {
      log("所有战斗已经结算。");
      draw();
      return;
    }
    const defender = unitById(battle.defenderId);
    const attackers = battle.attackerIds.map(unitById).filter((unit) => unit && !unit.eliminated);
    if (!defender || defender.eliminated || !attackers.length) {
      battle.resolved = true;
      battle.result = "Skipped";
      log("跳过一场已失效的战斗。");
      draw();
      return;
    }

    const odds = calculateOdds(attackers, defender);
    const roll = Math.floor(Math.random() * 6) + 1;
    const result = app.rules.crt.rows[String(roll)][odds.columnIndex];
    battle.result = `${roll}/${odds.column}/${result}`;
    log(`战斗结算：${odds.attack}:${odds.defense} -> ${odds.column}，骰 ${roll}，结果 ${result}。`);
    applyCombatResult(battle, result);
    draw();
  }

  function calculateOdds(attackers, defender) {
    const attack = attackers.reduce((sum, unit) => sum + unit.combat, 0);
    const defense = defender.combat * defenseMultiplier(defender);
    const ratio = attack / Math.max(1, defense);
    const thresholds = [0.5, 1, 2, 3, 4, 5, 6];
    let columnIndex = 0;
    for (let index = 0; index < thresholds.length; index += 1) {
      if (ratio >= thresholds[index]) columnIndex = index;
    }
    return {
      attack,
      defense,
      ratio,
      columnIndex,
      column: app.rules.crt.columns[columnIndex],
    };
  }

  function defenseMultiplier(unit) {
    const hex = hexById(unit.hexId);
    let multiplier = terrainRule(hex).defenseMultiplier || 1;
    if (hex?.britishPosition && unit.side === app.rules.britishPosition.appliesOnlyToSide) {
      multiplier = Math.max(multiplier, app.rules.britishPosition.defenseMultiplier);
    }
    return multiplier;
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
    const task = app.state.retreatTask;
    if (!task || !app.legalRetreats.has(hexId)) return;
    const unit = unitById(task.unitIds[task.index]);
    unit.hexId = hexId;
    unit.disrupted = true;
    log(`${unit.name} 撤退到 ${hexId} 并进入混乱。`);
    task.index += 1;
    prepareCurrentRetreat();
  }

  function finishRetreatTask() {
    const task = app.state.retreatTask;
    if (!task) return;
    task.battle.resolved = true;
    app.state.retreatTask = null;
    app.legalRetreats.clear();
    if (task.advanceAfter) startAdvanceTask(task.battle);
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
    const task = app.state.advanceTask;
    if (!task || unitId === "skip") {
      app.state.advanceTask = null;
      draw();
      return;
    }
    const unit = unitById(unitId);
    if (unit && !unit.eliminated && !liveUnitAt(task.targetHexId)) {
      unit.hexId = task.targetHexId;
      log(`${unit.name} 战后挺进。`);
    }
    app.state.advanceTask = null;
    draw();
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

  function attemptMove(destinationHexId) {
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
    unit.hexId = destinationHexId;
    app.state.movedUnits.push(unit.id);
    log(`${unit.name} 移动到 ${destinationHexId}，剩余移动力 ${route.remaining}。`);
    if (unit.side === "allied" && app.scenario.objectives.alliedWestExitEdge.includes(destinationHexId) && route.remaining > 0) {
      setWinner("allied", `${unit.name} 从西侧边缘脱出。`);
    }
    app.state.selectedUnitId = null;
    app.reachable.clear();
    draw();
  }

  function reachableHexes(unit) {
    const allowance = movementAllowance(unit);
    const startHexId = unit.hexId;
    const result = new Map();
    const startInZoc = isEnemyZoc(startHexId, unit.side, unit.id);
    const queue = [{ hexId: startHexId, spent: 0, firstStep: true }];
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
        if (!occupant || occupant.id === unit.id) {
          result.set(nextId, { spent, remaining });
        }
        queue.push({ hexId: nextId, spent, firstStep: false });
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
    app.state.usedAttackers = [];
    app.state.usedDefenders = [];
    app.state.movedUnits = [];
    app.state.combatMode = "declare";
    app.reachable.clear();
    app.legalRetreats.clear();

    if (app.state.phaseIndex === app.rules.phases.length - 1) {
      if (checkAxisObjectiveVictory()) {
        draw();
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
    app.state.winner = { side, reason };
    log(`${sideLabel(side)} 胜利：${reason}`);
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
  }

  function drawStatus() {
    const turn = app.rules.turns[app.state.turn - 1];
    el.turnLabel.textContent = `${turn?.label || `Turn ${app.state.turn}`} · ${sideLabel(activeSide())}`;
    el.phaseLabel.textContent = phase().label;
    el.boardBadge.textContent = boardBadgeText();
    el.finishDeclarationsButton.hidden = !(isCombatPhase() && app.state.combatMode === "declare");
    el.resolveBattleButton.hidden = !(isCombatPhase() && app.state.combatMode === "resolve");
    el.endPhaseButton.disabled = Boolean(app.state.winner);
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

  function drawHexLayer() {
    const ctx = el.hexLayer.getContext("2d");
    ctx.clearRect(0, 0, el.hexLayer.width, el.hexLayer.height);
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
    const hex = hexById(unit.hexId);
    stats.textContent = `${sideLabel(unit.side)} · ${nationalityLabel(unit.nationality)} · ${unit.combat}-${unit.movement} · ${hex?.id || unit.hexId}`;
    const state = document.createElement("span");
    state.textContent = unit.disrupted ? "混乱 / Disrupted" : "Ready";
    meta.append(title, stats, state);
    wrap.append(image, meta);
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
      el.combatComposer.append(defenderLine, attackerLine, row, actions);
    } else {
      el.combatComposer.textContent = "战斗结算中 / Resolving";
    }

    for (const battle of app.state.declaredCombats) {
      const defender = unitById(battle.defenderId);
      const attackers = battle.attackerIds.map(unitById).filter(Boolean);
      const row = document.createElement("div");
      row.className = "battle-row";
      row.dataset.resolved = String(battle.resolved);
      const title = document.createElement("strong");
      title.textContent = `${attackers.map((unit) => unit.name).join(" + ")} -> ${defender?.name || "?"}`;
      const detail = document.createElement("small");
      detail.textContent = battle.result || phaseLabel(battle.phaseId);
      row.append(title, document.createElement("br"), detail);
      el.battleList.append(row);
    }
  }

  function pill(text) {
    const node = document.createElement("span");
    node.className = "pill";
    node.textContent = text;
    return node;
  }

  function drawTaskPanel() {
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
    el.logList.replaceChildren();
    for (const message of app.state.log.slice(-80)) {
      const item = document.createElement("p");
      item.textContent = message;
      el.logList.append(item);
    }
  }

  init();
})();
