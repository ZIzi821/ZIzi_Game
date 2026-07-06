import fs from "node:fs";

import {
  calculateOdds,
  canAttack,
  createBoard,
  defenseBreakdown,
  getLegalRetreatPaths,
  getReachableHexes,
  hexDistance,
  isEnemyZoc,
  liveUnitAt,
  liveUnits,
  neighborsOf,
  terrainRule,
  unitById,
} from "../el-alamein/src/core/index.js";

const scenario = JSON.parse(fs.readFileSync(new URL("../el-alamein/local-data/scenario.json", import.meta.url), "utf8"));
const rules = JSON.parse(fs.readFileSync(new URL("../el-alamein/local-data/rules.json", import.meta.url), "utf8"));
const board = createBoard(scenario);
const distanceCache = new Map();

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));

const games = Number(args.get("games") || 80);
const seed = Number(args.get("seed") || 1942);
const sampleCount = Number(args.get("sample") || 0);
const traceSeed = args.has("trace") ? Number(args.get("trace") || seed) : null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mulberry32(initialSeed) {
  let state = initialSeed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function distance(fromId, toId) {
  const key = fromId < toId ? `${fromId}|${toId}` : `${toId}|${fromId}`;
  if (!distanceCache.has(key)) distanceCache.set(key, hexDistance(board, fromId, toId));
  return distanceCache.get(key);
}

function hexLabel(hexId) {
  const hex = board.hexById.get(hexId);
  if (!hex) return hexId;
  return `${String(hex.row + 1).padStart(2, "0")}${String(27 - hex.col).padStart(2, "0")}`;
}

function makeState() {
  return {
    turn: 1,
    phaseIndex: 0,
    units: clone(scenario.units),
    movedUnits: [],
    usedAttackers: [],
    usedDefenders: [],
    declaredCombats: [],
    eliminatedUnitIds: [],
    winner: null,
  };
}

function phase(state) {
  return rules.phases[state.phaseIndex];
}

function activeSide(state) {
  return phase(state).side;
}

function context(state) {
  return {
    board,
    rules,
    state,
    units: state.units,
    activeSide: activeSide(state),
    usedAttackers: state.usedAttackers,
    usedDefenders: state.usedDefenders,
  };
}

function playGame(gameSeed) {
  const state = makeState();
  const rng = mulberry32(gameSeed);
  const trace = gameSeed === traceSeed;
  let guard = 0;

  while (!state.winner && guard < 80) {
    guard += 1;
    if (trace) console.error(`\nT${state.turn} ${phase(state).id}`);
    if (phase(state).type === "movement") runMovement(state, trace);
    else runCombat(state, rng, trace);
    endPhase(state, trace);
  }

  if (!state.winner) state.winner = { side: "draw", reason: "guard" };
  return summarizeGame(state, gameSeed);
}

function runMovement(state, trace = false) {
  const side = activeSide(state);
  const units = liveUnits(state.units)
    .filter((unit) => unit.side === side && !unit.disrupted)
    .sort((a, b) => movePriority(state, b) - movePriority(state, a) || String(a.id).localeCompare(String(b.id)));

  for (const unit of units) {
    if (state.winner || state.movedUnits.includes(unit.id)) continue;
    const order = chooseMove(state, unit);
    if (trace && (side === "axis" || side === "allied")) {
      const from = hexLabel(unit.hexId);
      const to = order ? hexLabel(order.hexId) : "hold";
      const dist = side === "axis"
        ? (order ? nearestDistance(order.hexId, axisObjectives()) : nearestDistance(unit.hexId, axisObjectives()))
        : (order ? nearestDistance(order.hexId, scenario.objectives.alliedWestExitEdge) : nearestDistance(unit.hexId, scenario.objectives.alliedWestExitEdge));
      console.error(`${side} ${unit.id} ${unit.combat}-${unit.movement} ${from} -> ${to} d=${dist} score=${order?.score?.toFixed?.(1) ?? "-"}`);
    }
    if (!order) continue;
    unit.hexId = order.hexId;
    state.movedUnits.push(unit.id);
    if (unit.side === "axis" && checkAxisVictory(state)) return;
    if (
      unit.side === "allied"
      && scenario.objectives.alliedWestExitEdge.includes(order.hexId)
      && order.route.remaining > 0
      && !isEnemyZoc(context(state), order.hexId, unit.side, unit.id)
    ) {
      state.winner = { side: "allied", reason: "breakthrough", turn: state.turn };
      if (trace) console.error(`winner allied breakthrough ${unit.id} ${hexLabel(order.hexId)} remaining=${order.route.remaining}`);
      return;
    }
  }
}

function chooseMove(state, unit) {
  const reachable = getReachableHexes(context(state), unit);
  if (!reachable.size) return null;
  if (unit.side === "axis") {
    const guardMove = chooseAxisExitGuardMove(state, unit, reachable);
    if (guardMove === "hold") return null;
    if (guardMove) return { hexId: guardMove, route: reachable.get(guardMove) };
  }
  const currentScore = scoreHex(state, unit, unit.hexId, { remaining: unit.movement || 0, path: [unit.hexId] });
  let best = null;
  for (const [hexId, route] of reachable.entries()) {
    const score = scoreHex(state, unit, hexId, route);
    if (!best || score > best.score) best = { hexId, route, score };
  }
  if (!best || best.score <= currentScore + moveThreshold(unit)) return null;
  return best;
}

function chooseAxisExitGuardMove(state, unit, reachable) {
  const westExit = scenario.objectives.alliedWestExitEdge;
  if (isAxisAssaultUnit(unit)) return null;
  const holdThreat = 5;
  if (westExit.includes(unit.hexId) && alliedExitThreat(state, unit.hexId) >= holdThreat) return "hold";
  let best = null;
  for (const [hexId, route] of reachable.entries()) {
    const coverage = axisExitCoverageScore(state, hexId, unit.id);
    if (!coverage) continue;
    const score = coverage + Number(route?.remaining || 0) * 0.3 - distance(unit.hexId, hexId) * 0.4;
    if (!best || score > best.score) best = { hexId, score };
  }
  return best && best.score >= 10 ? best.hexId : null;
}

function isAxisAssaultUnit(unit) {
  return unit?.side === "axis" && Number(unit.movement || 0) >= 9 && Number(unit.combat || 0) >= 4;
}

function movePriority(state, unit) {
  const combat = Number(unit.combat || 0);
  const movement = Number(unit.movement || 0);
  const pressure = unit.side === "axis"
    ? Math.max(0, 18 - nearestDistance(unit.hexId, axisTargetsForUnit(unit))) * 0.8
    : Math.max(0, 12 - nearestDistance(unit.hexId, alliedAnchors())) * 0.5;
  return movement * 1.7 + combat * 1.2 + pressure;
}

function moveThreshold(unit) {
  if (unit.side === "axis") return Number(unit.movement || 0) >= 9 ? 0.35 : 0.6;
  return Number(unit.movement || 0) >= 7 ? 0.45 : 0.75;
}

function runCombat(state, rng, trace = false) {
  let guard = 0;
  while (guard < 30) {
    guard += 1;
    const candidate = bestCombat(state);
    if (!candidate || candidate.score < combatThreshold(activeSide(state))) break;
    const battle = declareBattle(state, candidate.defender, candidate.attackers);
    state.declaredCombats.push(battle);
    if (trace) {
      console.error(`declare ${battle.id} ${candidate.attackers.map((unit) => `${unit.id}:${hexLabel(unit.hexId)}`).join("+")} -> ${candidate.defender.id}:${hexLabel(candidate.defender.hexId)} score=${candidate.score.toFixed(1)}`);
    }
  }

  for (const battle of state.declaredCombats.slice()) {
    if (!battle.resolved) resolveBattle(state, battle, rng);
    if (trace) console.error(`result ${battle.id} roll=${battle.roll ?? "-"} ${battle.result ?? "-"}`);
  }
}

function bestCombat(state) {
  let best = null;
  const side = activeSide(state);
  for (const defender of liveUnits(state.units).filter((unit) => unit.side !== side && !unit.disrupted && !state.usedDefenders.includes(unit.id))) {
    const attackers = neighborsOf(board, defender.hexId)
      .map((hexId) => liveUnitAt(state.units, hexId))
      .filter((unit) => canAttack(context(state), unit, defender))
      .sort((a, b) => Number(b.combat || 0) - Number(a.combat || 0));
    if (!attackers.length) continue;
    for (const group of attackerGroups(attackers)) {
      const odds = calculateOdds(context(state), group, defender);
      const score = scoreCombat(state, group, defender, odds);
      if (!best || score > best.score) best = { attackers: group, defender, odds, score };
    }
  }
  return best;
}

function declareBattle(state, defender, attackers) {
  const battle = {
    id: `b${state.turn}-${state.phaseIndex}-${state.declaredCombats.length}`,
    side: activeSide(state),
    defenderId: defender.id,
    defenderHexId: defender.hexId,
    attackerIds: attackers.map((unit) => unit.id),
    attackerOrigins: Object.fromEntries(attackers.map((unit) => [unit.id, unit.hexId])),
    resolved: false,
  };
  state.usedDefenders.push(defender.id);
  state.usedAttackers.push(...battle.attackerIds);
  return battle;
}

function resolveBattle(state, battle, rng) {
  const defender = unitById(state.units, battle.defenderId);
  const attackers = battle.attackerIds.map((id) => unitById(state.units, id)).filter((unit) => unit && !unit.eliminated);
  if (!defender || defender.eliminated || !attackers.length) {
    battle.resolved = true;
    return;
  }

  const odds = calculateOdds(context(state), attackers, defender);
  const roll = Math.floor(rng() * 6) + 1;
  const result = rules.crt.rows[String(roll)][odds.columnIndex];
  battle.roll = roll;
  battle.result = result;

  if (result === "AE") {
    attackers.forEach((unit) => eliminate(state, unit));
    battle.resolved = true;
    return;
  }
  if (result === "DE") {
    eliminate(state, defender);
    advanceAfterCombat(state, battle);
    battle.resolved = true;
    return;
  }
  if (result === "AR") {
    retreatUnits(state, battle, attackers, 1, battle.side, false);
    battle.resolved = true;
    return;
  }
  const retreat = result.match(/^DR(\d+)$/);
  if (retreat) {
    retreatUnits(state, battle, [defender], Number(retreat[1]), battle.side, true);
    advanceAfterCombat(state, battle);
    battle.resolved = true;
  }
}

function retreatUnits(state, battle, units, steps, controllerSide, disruptAfterRetreat) {
  for (const unit of units) {
    if (!unit || unit.eliminated) continue;
    const origin = battle.attackerOrigins?.[unit.id] || battle.defenderHexId || unit.hexId;
    const paths = getLegalRetreatPaths(context(state), unit, steps, origin);
    const destination = chooseRetreat(state, unit, paths, controllerSide);
    if (!destination) {
      eliminate(state, unit);
      continue;
    }
    unit.hexId = destination;
    unit.disrupted = Boolean(disruptAfterRetreat);
  }
}

function chooseRetreat(state, unit, paths, controllerSide) {
  const maximizeForRetreater = controllerSide === unit.side;
  let best = null;
  for (const [hexId, path] of paths.entries()) {
    const retreaterScore = scoreHex(state, unit, hexId, { remaining: 0, path })
      - path.length * 0.25
      + friendlySupport(state, unit, hexId) * 0.35
      - danger(state, unit, hexId);
    const controllerScore = maximizeForRetreater ? retreaterScore : -retreaterScore + forcedRetreatDenialScore(state, controllerSide, unit, hexId);
    if (!best || controllerScore > best.score) best = { hexId, score: controllerScore };
  }
  return best?.hexId || null;
}

function forcedRetreatDenialScore(state, controllerSide, unit, hexId) {
  if (controllerSide === "axis" && unit.side === "allied") {
    const exitDistance = nearestDistance(hexId, scenario.objectives.alliedWestExitEdge);
    const allowance = Math.max(movementAllowance(state, unit), Number(unit.movement || 0));
    let score = Math.min(exitDistance, 12) * 5;
    if (exitDistance < allowance) score -= 180 + (allowance - exitDistance) * 35;
    else if (exitDistance <= allowance + 1) score -= 60;
    return score - strategicHexValue(state, "allied", hexId) * 0.08;
  }
  if (controllerSide === "allied" && unit.side === "axis") {
    const objectiveDistance = nearestDistance(hexId, axisObjectives());
    return objectiveDistance * 6 - strategicHexValue(state, "axis", hexId) * 0.12;
  }
  return strategicHexValue(state, controllerSide, hexId) * 0.02;
}

function advanceAfterCombat(state, battle) {
  if (liveUnitAt(state.units, battle.defenderHexId)) return;
  let best = null;
  for (const id of battle.attackerIds) {
    const unit = unitById(state.units, id);
    if (!unit || unit.eliminated || !neighborsOf(board, unit.hexId).includes(battle.defenderHexId)) continue;
    const gain = scoreHex(state, unit, battle.defenderHexId, { remaining: 0, path: [unit.hexId, battle.defenderHexId] })
      - scoreHex(state, unit, unit.hexId, { remaining: 0, path: [unit.hexId] });
    if (!best || gain > best.gain) best = { unit, gain };
  }
  if (best) {
    best.unit.hexId = battle.defenderHexId;
    if (best.unit.side === "axis") checkAxisVictory(state);
  }
}

function endPhase(state, trace = false) {
  const endingPhase = phase(state);
  if (endingPhase.type === "combat") {
    for (const unit of state.units) {
      if (!unit.eliminated && unit.side === endingPhase.side) unit.disrupted = false;
    }
  }

  state.movedUnits = [];
  state.usedAttackers = [];
  state.usedDefenders = [];
  state.declaredCombats = [];

  if (state.winner) return;
  if (state.phaseIndex === rules.phases.length - 1) {
    if (checkAxisVictory(state)) return;
    if (state.turn >= rules.turns.length) {
      state.winner = { side: "allied", reason: "axis-failed", turn: state.turn };
      if (trace) console.error("winner allied axis-failed");
      return;
    }
    state.turn += 1;
    state.phaseIndex = 0;
  } else {
    state.phaseIndex += 1;
  }
}

function checkAxisVictory(state) {
  const axisHexes = new Set(liveUnits(state.units).filter((unit) => unit.side === "axis").map((unit) => unit.hexId));
  if (scenario.objectives.alamHalfaRidge.some((hexId) => axisHexes.has(hexId))) {
    state.winner = { side: "axis", reason: "ridge", turn: state.turn };
    return true;
  }
  if (scenario.objectives.coastalRoadEast.some((hexId) => axisHexes.has(hexId))) {
    state.winner = { side: "axis", reason: "road", turn: state.turn };
    return true;
  }
  return false;
}

function eliminate(state, unit) {
  unit.eliminated = true;
  unit.disrupted = false;
  if (!state.eliminatedUnitIds.includes(unit.id)) state.eliminatedUnitIds.push(unit.id);
}

function attackerGroups(attackers) {
  const ordered = attackers.slice(0, 6).sort((a, b) => Number(b.combat || 0) - Number(a.combat || 0));
  const groups = [];
  for (let mask = 1; mask < (1 << ordered.length); mask += 1) {
    groups.push(ordered.filter((_, index) => mask & (1 << index)));
  }
  return groups;
}

function combatThreshold(side) {
  return side === "axis" ? 3.6 : 5.1;
}

function scoreCombat(state, attackers, defender, odds) {
  const side = attackers[0]?.side || activeSide(state);
  const attackStrength = attackers.reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const defenderValue = strategicUnitValue(state, side, defender);
  const objectiveUrgency = axisObjectiveCombatUrgency(state, side, defender.hexId);
  let total = 0;
  for (const row of Object.values(rules.crt.rows)) {
    total += scoreCombatResult(state, row[odds.columnIndex], attackers, defender, defenderValue);
  }
  const overcommit = Math.max(0, attackStrength - Math.max(1, odds.defense) * 4) * 0.28 + Math.max(0, attackers.length - 2) * 0.45;
  return (total / 6) + objectiveUrgency + odds.columnIndex * 1.1 + strategicHexValue(state, side, defender.hexId) * 0.04 - overcommit - axisScreenAttackPenalty(state, attackers, odds);
}

function axisObjectiveCombatUrgency(state, attackerSide, defenderHexId) {
  if (attackerSide !== "axis") return 0;
  const onRidge = scenario.objectives.alamHalfaRidge.includes(defenderHexId);
  const onRoad = scenario.objectives.coastalRoadEast.includes(defenderHexId);
  if (!onRidge && !onRoad) return 0;
  const base = onRidge ? 130 : 105;
  const deadline = state.turn >= 4 ? 240 : state.turn === 3 ? 150 : 60;
  return base + deadline;
}

function axisScreenAttackPenalty(state, attackers, odds) {
  if (attackers[0]?.side !== "axis") return 0;
  let penalty = 0;
  for (const attacker of attackers) {
    if (isAxisAssaultUnit(attacker)) continue;
    const coverage = axisExitCoverageScore(state, attacker.hexId, attacker.id);
    if (coverage <= 20) continue;
    const oddsRisk = Math.max(0, 4 - odds.columnIndex);
    penalty += Math.min(180, coverage * 0.82) * (1 + oddsRisk * 0.35);
  }
  return penalty;
}

function scoreCombatResult(state, result, attackers, defender, defenderValue) {
  const side = attackers[0]?.side || activeSide(state);
  const attackStrength = attackers.reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const attackerValue = attackStrength * 2.7 + attackers.reduce((sum, unit) => sum + strategicHexValue(state, side, unit.hexId) * 0.03, 0);
  if (result === "DE") return defenderValue * 8.5 + strategicHexValue(state, side, defender.hexId) * 0.7;
  if (result === "AE") return -attackerValue * 8.2;
  if (result === "AR") return -attackerValue * 1.85;
  const retreat = result.match(/^DR(\d+)$/);
  if (retreat) {
    const retreatSteps = Number(retreat[1]);
    const pressure = defenderRetreatPressure(state, defender, retreatSteps);
    return defenderValue * (2.05 + retreatSteps * 0.42 + pressure) + strategicHexValue(state, side, defender.hexId) * (0.22 + pressure * 0.08);
  }
  return 0;
}

function defenderRetreatPressure(state, defender, steps) {
  const paths = getLegalRetreatPaths(context(state), defender, steps, defender.hexId);
  const count = paths.size;
  if (count === 0) return 5.6;
  if (count === 1) return 3.1;
  if (count === 2) return 2.2;
  if (count <= 4) return 1.25;
  return Math.max(0, (7 - count) * 0.16);
}

function scoreHex(state, unit, hexId, route = null) {
  const hex = board.hexById.get(hexId);
  if (!hex) return -Infinity;
  const combat = Number(unit.combat || 0);
  let score = 0;

  if (unit.side === "axis") {
    const assault = isAxisAssaultUnit(unit);
    score += axisObjectiveScore(hexId) * 4.4;
    score -= nearestDistance(hexId, axisTargetsForUnit(unit)) * (combat >= 4 ? 6.1 : 3.5);
    score += axisProgress(state, unit, hexId) * (assault ? 1.35 : 1);
    score += assault ? 0 : axisRearGuard(state, unit, hexId);
    score += attackSetup(state, unit, hexId) * (assault ? 3.9 : 3.1);
    score += zocTrapSetup(state, unit, hexId) * (assault ? 4.2 : 3.4);
    if (assault) score += axisSpearheadPressure(state, unit, hexId);
    else score += axisZocScreen(state, unit, hexId);
    if (assault && scenario.objectives.alliedWestExitEdge.includes(hexId)) score -= 110;
  } else {
    if (scenario.objectives.alliedWestExitEdge.includes(hexId) && route?.remaining > 0) {
      score += isEnemyZoc(context(state), hexId, unit.side, unit.id) ? 24 : 230;
    }
    score += alliedDefenseScore(hexId) * 3.4;
    score += alliedScreen(hexId) * 2.8;
    score -= nearestDistance(hexId, alliedAnchors()) * (combat >= 4 ? 2.1 : 1.45);
    score += attackSetup(state, unit, hexId) * 2.2;
    score += zocTrapSetup(state, unit, hexId) * 1.3;
  }

  if (hex.terrain === "highland" || hex.terrain === "settlement") score += 9 + combat * 0.8;
  if (unit.side === "allied" && hex.britishPosition) score += 16 + combat * 0.7;
  score += friendlySupport(state, unit, hexId) * 1.25;
  score -= danger(state, unit, hexId) * (combat >= 4 ? 0.6 : 1.25);
  if (isEnemyZoc(context(state), hexId, unit.side, unit.id)) score += combat >= 4 ? 4.5 : -9;
  score += Number(route?.remaining || 0) * (unit.side === "axis" ? 0.18 : 0.28);
  score += combat * 0.35;
  return score;
}

function axisTargetsForUnit(unit) {
  const objectives = axisObjectives();
  const bestDistance = nearestDistance(unit.hexId, objectives);
  const spread = Number(unit.movement || 0) >= 9 ? 2 : 1;
  return objectives.filter((hexId) => distance(unit.hexId, hexId) <= bestDistance + spread);
}

function axisObjectives() {
  return [...scenario.objectives.alamHalfaRidge, ...scenario.objectives.coastalRoadEast];
}

function alliedAnchors() {
  return [...scenario.objectives.alamHalfaRidge, ...scenario.objectives.coastalRoadEast, ...scenario.objectives.alliedWestExitEdge];
}

function nearestDistance(hexId, targets) {
  if (!targets?.length) return Infinity;
  return Math.min(...targets.map((target) => distance(hexId, target)));
}

function axisObjectiveScore(hexId) {
  let score = 0;
  if (scenario.objectives.alamHalfaRidge.includes(hexId)) score += 60;
  if (scenario.objectives.coastalRoadEast.includes(hexId)) score += 32;
  if (hexId === "c12r03") score += 38;
  return score;
}

function alliedDefenseScore(hexId) {
  const hex = board.hexById.get(hexId);
  let score = 0;
  if (scenario.objectives.alamHalfaRidge.includes(hexId)) score += 45;
  if (scenario.objectives.coastalRoadEast.includes(hexId)) score += 18;
  if (hex?.britishPosition) score += 18;
  return score;
}

function axisProgress(state, unit, hexId) {
  const hex = board.hexById.get(hexId);
  const start = board.hexById.get(unit.hexId);
  if (!hex || !start) return 0;
  const targets = axisTargetsForUnit(unit);
  const distanceGain = nearestDistance(unit.hexId, targets) - nearestDistance(hexId, targets);
  const eastwardGain = Number(hex.col || 0) - Number(start.col || 0);
  const tempo = Number(unit.movement || 0) >= 9 ? 8.6 : 4.2;
  return distanceGain * tempo + eastwardGain * 0.85;
}

function axisSpearheadPressure(state, unit, hexId) {
  const targets = axisTargetsForUnit(unit);
  const targetDistance = nearestDistance(hexId, targets);
  let score = Math.max(0, 8 - targetDistance) * 4.8;
  for (const enemy of liveUnits(state.units).filter((candidate) => candidate.side === "allied" && !candidate.disrupted)) {
    const enemyDistance = distance(hexId, enemy.hexId);
    if (enemyDistance > 2) continue;
    score += strategicUnitValue(state, "axis", enemy) * (enemyDistance === 1 ? 0.18 : 0.08);
  }
  return score;
}

function axisZocScreen(state, unit, hexId) {
  const westExit = scenario.objectives.alliedWestExitEdge;
  let score = Math.max(0, 3 - nearestDistance(hexId, westExit)) * 4.5 + axisExitCoverageScore(state, hexId, unit.id) * 0.75;
  for (const ally of liveUnits(state.units).filter((candidate) => candidate.side === "axis" && candidate.id !== unit.id && !candidate.eliminated)) {
    const allyDistance = distance(hexId, ally.hexId);
    if (allyDistance === 2) score += isAxisAssaultUnit(ally) ? 1.5 : 7.5;
    else if (allyDistance === 3) score += isAxisAssaultUnit(ally) ? 0.5 : 3.2;
    else if (allyDistance === 1 && !isAxisAssaultUnit(ally)) score += 1.2;
  }
  for (const enemy of liveUnits(state.units).filter((candidate) => candidate.side === "allied" && !candidate.disrupted)) {
    if (nearestDistance(enemy.hexId, westExit) > 8) continue;
    const enemyDistance = distance(hexId, enemy.hexId);
    if (enemyDistance === 2) score += 8;
    else if (enemyDistance === 3) score += 4;
    else if (enemyDistance === 1) score += 2.5;
  }
  return score;
}

function axisExitCoverageScore(state, hexId, movingUnitId = null) {
  let score = 0;
  for (const exitHexId of scenario.objectives.alliedWestExitEdge) {
    const threat = alliedExitThreat(state, exitHexId);
    if (!threat) continue;
    const alreadyCovered = isAxisExitCoveredByOther(state, exitHexId, movingUnitId);
    const exitDistance = distance(hexId, exitHexId);
    const coverageMultiplier = alreadyCovered ? 0.22 : 1;
    if (exitDistance === 0) score += threat * 6 * coverageMultiplier;
    else if (exitDistance === 1) score += threat * 4.4 * coverageMultiplier;
    else if (exitDistance === 2) score += threat * 1.1 * coverageMultiplier;
  }
  return score;
}

function isAxisExitCoveredByOther(state, exitHexId, movingUnitId = null) {
  return liveUnits(state.units).some((unit) => {
    if (unit.id === movingUnitId || unit.side !== "axis" || unit.disrupted) return false;
    return unit.hexId === exitHexId || neighborsOf(board, unit.hexId).includes(exitHexId);
  });
}

function axisRearGuard(state, unit, hexId) {
  const westExit = scenario.objectives.alliedWestExitEdge;
  const threat = liveUnits(state.units).some((enemy) => enemy.side === "allied" && !enemy.disrupted && nearestDistance(enemy.hexId, westExit) <= 5);
  if (!threat) return 0;
  const combat = Number(unit.combat || 0);
  const guardBias = Math.max(0, 5 - combat) * 1.35;
  const mobilityPenalty = Number(unit.movement || 0) >= 9 ? 0.8 : 2.35;
  const distanceToExit = nearestDistance(hexId, westExit);
  let score = Math.max(0, 4 - distanceToExit) * (guardBias + mobilityPenalty) + (westExit.includes(hexId) ? 8 + guardBias * 1.8 : 0);
  for (const exitHexId of westExit) {
    const exitThreat = alliedExitThreat(state, exitHexId);
    if (!exitThreat) continue;
    const exitDistance = distance(hexId, exitHexId);
    const guardSuitability = Number(unit.movement || 0) >= 9 && combat >= 4 ? 0.55 : 1;
    if (exitDistance === 0) score += exitThreat * 5.8 * guardSuitability;
    else if (exitDistance === 1) score += exitThreat * 0.9 * guardSuitability;
  }
  return score;
}

function alliedExitThreat(state, exitHexId) {
  return liveUnits(state.units)
    .filter((unit) => unit.side === "allied" && !unit.disrupted)
    .reduce((score, unit) => {
      const exitDistance = distance(unit.hexId, exitHexId);
      const allowance = Math.max(movementAllowance(state, unit), Number(unit.movement || 0));
      if (exitDistance < allowance) return score + 18 + (allowance - exitDistance) * 4 + Number(unit.combat || 0);
      if (exitDistance <= allowance + 1) return score + 5;
      return score;
    }, 0);
}

function movementAllowance(state, unit) {
  let movement = Number(unit.movement || 0);
  if (unit.side === "allied" && state.turn === 1) movement = Math.max(1, Math.floor(movement * Number(rules.firstTurnAlliedMovementMultiplier || 1)));
  return movement;
}

function alliedScreen(hexId) {
  return Math.max(0, 9 - nearestDistance(hexId, axisObjectives())) + Math.max(0, 4 - nearestDistance(hexId, scenario.objectives.alliedWestExitEdge)) * 0.5;
}

function attackSetup(state, unit, hexId) {
  let score = 0;
  for (const enemy of liveUnits(state.units).filter((candidate) => candidate.side !== unit.side && !candidate.disrupted)) {
    if (!neighborsOf(board, enemy.hexId).includes(hexId)) continue;
    const support = neighborsOf(board, enemy.hexId)
      .map((id) => liveUnitAt(state.units, id))
      .filter((ally) => ally && ally.side === unit.side && ally.id !== unit.id && !ally.disrupted)
      .reduce((sum, ally) => sum + Number(ally.combat || 0), 0);
    const attack = Number(unit.combat || 0) + support;
    const defense = Math.max(1, defenseBreakdown(context(state), enemy).total);
    score += Math.min(6, attack / defense) * 2.4 + strategicUnitValue(state, unit.side, enemy) * 0.08 + Number(enemy.combat || 0) * 0.6;
  }
  return score;
}

function zocTrapSetup(state, unit, hexId) {
  let score = 0;
  const hypothetical = { unit, hexId };
  for (const enemy of liveUnits(state.units).filter((candidate) => candidate.side !== unit.side && !candidate.disrupted)) {
    const enemyDistance = distance(hexId, enemy.hexId);
    if (enemyDistance > 2) continue;
    const currentExits = retreatExitCount(state, enemy, null);
    const trappedExits = retreatExitCount(state, enemy, hypothetical);
    const reduced = Math.max(0, currentExits - trappedExits);
    const scarcity = Math.max(0, 4 - trappedExits);
    const adjacent = neighborsOf(board, enemy.hexId).includes(hexId);
    score += (reduced * 3 + scarcity * 1.8 + strategicUnitValue(state, unit.side, enemy) * 0.04) * (adjacent ? 1.25 : 0.55);
  }
  return score;
}

function retreatExitCount(state, unit, hypothetical = null) {
  let count = 0;
  for (const nextId of neighborsOf(board, unit.hexId)) {
    const nextHex = board.hexById.get(nextId);
    if (!terrainRule(nextHex).passable) continue;
    const occupant = liveUnitAtWithHypothetical(state, nextId, hypothetical);
    if (occupant && occupant.side !== unit.side) continue;
    if (isEnemyZocWithHypothetical(state, nextId, unit.side, unit.id, hypothetical)) continue;
    count += 1;
  }
  return count;
}

function liveUnitAtWithHypothetical(state, hexId, hypothetical = null) {
  if (hypothetical?.hexId === hexId) return hypothetical.unit;
  const occupant = liveUnitAt(state.units, hexId);
  if (occupant && occupant.id === hypothetical?.unit?.id) return null;
  return occupant;
}

function isEnemyZocWithHypothetical(state, hexId, friendlySide, ignoreUnitId = null, hypothetical = null) {
  return liveUnits(state.units).some((unit) => {
    if (unit.id === ignoreUnitId || unit.side === friendlySide || unit.disrupted) return false;
    const unitHexId = unit.id === hypothetical?.unit?.id ? hypothetical.hexId : unit.hexId;
    return neighborsOf(board, unitHexId).includes(hexId);
  });
}

function friendlySupport(state, unit, hexId) {
  let score = 0;
  for (const ally of liveUnits(state.units).filter((candidate) => candidate.side === unit.side && candidate.id !== unit.id && !candidate.disrupted)) {
    const allyDistance = distance(hexId, ally.hexId);
    if (allyDistance === 1) score += Number(ally.combat || 0) * 1.1;
    else if (allyDistance === 2) score += Number(ally.combat || 0) * 0.35;
  }
  return score;
}

function danger(state, unit, hexId) {
  const enemyStrength = neighborsOf(board, hexId)
    .map((id) => liveUnitAt(state.units, id))
    .filter((enemy) => enemy && enemy.side !== unit.side && !enemy.disrupted)
    .reduce((sum, enemy) => sum + Number(enemy.combat || 0), 0);
  if (!enemyStrength) return 0;
  return Math.max(0, enemyStrength - (Number(unit.combat || 0) + friendlySupport(state, unit, hexId) * 0.45));
}

function strategicHexValue(state, side, hexId) {
  if (side === "axis") return axisObjectiveScore(hexId) + alliedDefenseScore(hexId) * 0.55;
  return alliedDefenseScore(hexId) + Math.max(0, 10 - nearestDistance(hexId, axisObjectives())) * 3.5;
}

function strategicUnitValue(state, side, unit) {
  if (!unit) return 0;
  let value = Number(unit.combat || 0) * 3.2 + strategicHexValue(state, side, unit.hexId) * 0.18;
  if (side === "axis" && unit.side === "allied") {
    const exitDistance = nearestDistance(unit.hexId, scenario.objectives.alliedWestExitEdge);
    const allowance = movementAllowance(state, unit);
    if (exitDistance <= allowance + 2) value += Math.max(0, allowance + 3 - exitDistance) * 8 + (Number(unit.movement || 0) >= 7 ? 10 : 0);
  }
  if (side === "allied" && unit.side === "axis") {
    const objectiveDistance = nearestDistance(unit.hexId, axisObjectives());
    if (objectiveDistance <= 3) value += Math.max(0, 4 - objectiveDistance) * 7 + (Number(unit.combat || 0) >= 4 ? 8 : 0);
  }
  return value;
}

function summarizeGame(state, gameSeed) {
  const live = liveUnits(state.units);
  const axisCombat = live.filter((unit) => unit.side === "axis").reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const alliedCombat = live.filter((unit) => unit.side === "allied").reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const axisHexes = new Set(live.filter((unit) => unit.side === "axis").map((unit) => unit.hexId));
  const axisUnits = live.filter((unit) => unit.side === "axis");
  const axisObjectiveDistance = Math.min(...axisUnits.map((unit) => nearestDistance(unit.hexId, axisObjectives())));
  const closestAxis = axisUnits
    .map((unit) => ({
      id: unit.id,
      combat: unit.combat,
      movement: unit.movement,
      hex: hexLabel(unit.hexId),
      distance: nearestDistance(unit.hexId, axisObjectives()),
    }))
    .sort((a, b) => a.distance - b.distance || Number(b.combat || 0) - Number(a.combat || 0))
    .slice(0, 5);
  return {
    seed: gameSeed,
    winner: state.winner?.side || "none",
    reason: state.winner?.reason || "none",
    turn: state.winner?.turn || state.turn,
    axisCombat,
    alliedCombat,
    axisEliminated: state.eliminatedUnitIds.filter((id) => unitById(state.units, id)?.side === "axis").length,
    alliedEliminated: state.eliminatedUnitIds.filter((id) => unitById(state.units, id)?.side === "allied").length,
    ridge: scenario.objectives.alamHalfaRidge.some((hexId) => axisHexes.has(hexId)),
    road: scenario.objectives.coastalRoadEast.some((hexId) => axisHexes.has(hexId)),
    axisObjectiveDistance,
    closestAxis,
  };
}

const results = Array.from({ length: games }, (_, index) => playGame(seed + index));
const wins = results.reduce((totals, result) => {
  totals[result.winner] = (totals[result.winner] || 0) + 1;
  return totals;
}, {});
const average = (key) => results.reduce((sum, result) => sum + Number(result[key] || 0), 0) / Math.max(1, results.length);

console.log(JSON.stringify({
  games,
  seed,
  wins,
  axisWinRate: Number(((wins.axis || 0) / games).toFixed(3)),
  alliedWinRate: Number(((wins.allied || 0) / games).toFixed(3)),
  averageTurn: Number(average("turn").toFixed(2)),
  averageAxisCombat: Number(average("axisCombat").toFixed(2)),
  averageAlliedCombat: Number(average("alliedCombat").toFixed(2)),
  averageAxisEliminated: Number(average("axisEliminated").toFixed(2)),
  averageAlliedEliminated: Number(average("alliedEliminated").toFixed(2)),
  averageAxisObjectiveDistance: Number(average("axisObjectiveDistance").toFixed(2)),
  reasons: results.reduce((totals, result) => {
    totals[result.reason] = (totals[result.reason] || 0) + 1;
    return totals;
  }, {}),
  failures: results.filter((result) => result.winner !== "axis"),
  samples: results.slice(0, sampleCount),
}, null, 2));
