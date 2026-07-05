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
  let guard = 0;

  while (!state.winner && guard < 80) {
    guard += 1;
    if (phase(state).type === "movement") runMovement(state);
    else runCombat(state, rng);
    endPhase(state);
  }

  if (!state.winner) state.winner = { side: "draw", reason: "guard" };
  return summarizeGame(state, gameSeed);
}

function runMovement(state) {
  const side = activeSide(state);
  const units = liveUnits(state.units)
    .filter((unit) => unit.side === side && !unit.disrupted)
    .sort((a, b) => movePriority(state, b) - movePriority(state, a) || String(a.id).localeCompare(String(b.id)));

  for (const unit of units) {
    if (state.winner || state.movedUnits.includes(unit.id)) continue;
    const order = chooseMove(state, unit);
    if (!order) continue;
    unit.hexId = order.hexId;
    state.movedUnits.push(unit.id);
    if (unit.side === "allied" && scenario.objectives.alliedWestExitEdge.includes(order.hexId) && order.route.remaining > 0) {
      state.winner = { side: "allied", reason: "breakthrough", turn: state.turn };
      return;
    }
  }
}

function chooseMove(state, unit) {
  const reachable = getReachableHexes(context(state), unit);
  if (!reachable.size) return null;
  const currentScore = scoreHex(state, unit, unit.hexId, { remaining: unit.movement || 0, path: [unit.hexId] });
  let best = null;
  for (const [hexId, route] of reachable.entries()) {
    const score = scoreHex(state, unit, hexId, route);
    if (!best || score > best.score) best = { hexId, route, score };
  }
  if (!best || best.score <= currentScore + moveThreshold(unit)) return null;
  return best;
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

function runCombat(state, rng) {
  let guard = 0;
  while (guard < 30) {
    guard += 1;
    const candidate = bestCombat(state);
    if (!candidate || candidate.score < combatThreshold(activeSide(state))) break;
    const battle = declareBattle(state, candidate.defender, candidate.attackers);
    state.declaredCombats.push(battle);
  }

  for (const battle of state.declaredCombats.slice()) {
    if (!battle.resolved) resolveBattle(state, battle, rng);
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
    const controllerScore = maximizeForRetreater ? retreaterScore : -retreaterScore;
    if (!best || controllerScore > best.score) best = { hexId, score: controllerScore };
  }
  return best?.hexId || null;
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
  if (best && best.gain > -3) best.unit.hexId = battle.defenderHexId;
}

function endPhase(state) {
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
  const defenderValue = Number(defender.combat || 0) * 3.2 + strategicHexValue(state, side, defender.hexId) * 0.18;
  let total = 0;
  for (const row of Object.values(rules.crt.rows)) {
    total += scoreCombatResult(state, row[odds.columnIndex], attackers, defender, defenderValue);
  }
  const overcommit = Math.max(0, attackStrength - Math.max(1, odds.defense) * 4) * 0.28 + Math.max(0, attackers.length - 2) * 0.45;
  return (total / 6) + odds.columnIndex * 1.1 + strategicHexValue(state, side, defender.hexId) * 0.04 - overcommit;
}

function scoreCombatResult(state, result, attackers, defender, defenderValue) {
  const side = attackers[0]?.side || activeSide(state);
  const attackStrength = attackers.reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const attackerValue = attackStrength * 2.7 + attackers.reduce((sum, unit) => sum + strategicHexValue(state, side, unit.hexId) * 0.03, 0);
  if (result === "DE") return defenderValue * 8.5 + strategicHexValue(state, side, defender.hexId) * 0.7;
  if (result === "AE") return -attackerValue * 8.2;
  if (result === "AR") return -attackerValue * 1.85;
  const retreat = result.match(/^DR(\d+)$/);
  if (retreat) return defenderValue * (2.05 + Number(retreat[1]) * 0.42) + strategicHexValue(state, side, defender.hexId) * 0.22;
  return 0;
}

function scoreHex(state, unit, hexId, route = null) {
  const hex = board.hexById.get(hexId);
  if (!hex) return -Infinity;
  const combat = Number(unit.combat || 0);
  let score = 0;

  if (unit.side === "axis") {
    score += axisObjectiveScore(hexId) * 4.4;
    score -= nearestDistance(hexId, axisTargetsForUnit(unit)) * (combat >= 4 ? 5.2 : 3.5);
    score += axisProgress(unit, hexId);
    score += axisRearGuard(state, unit, hexId);
    score += attackSetup(state, unit, hexId) * 3.1;
  } else {
    if (scenario.objectives.alliedWestExitEdge.includes(hexId) && route?.remaining > 0) score += 230;
    score += alliedDefenseScore(hexId) * 3.4;
    score += alliedScreen(hexId) * 2.8;
    score -= nearestDistance(hexId, alliedAnchors()) * (combat >= 4 ? 2.1 : 1.45);
    score += attackSetup(state, unit, hexId) * 2.2;
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
  const hex = board.hexById.get(unit.hexId);
  if (Number(unit.movement || 0) >= 9 && Number(hex?.row || 0) >= 10) return scenario.objectives.alamHalfaRidge;
  if (Number(hex?.row || 0) <= 6) return scenario.objectives.coastalRoadEast;
  return axisObjectives();
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

function axisProgress(unit, hexId) {
  const hex = board.hexById.get(hexId);
  const start = board.hexById.get(unit.hexId);
  if (!hex || !start) return 0;
  const idealRow = Number(unit.movement || 0) >= 9 && Number(start.row || 0) >= 10 ? 10 : 4;
  return Number(hex.col || 0) * 0.85 - Math.abs(Number(hex.row || 0) - idealRow) * 0.55;
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
      const allowance = movementAllowance(state, unit);
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
    score += Math.min(6, attack / defense) * 2.4 + strategicHexValue(state, unit.side, enemy.hexId) * 0.08 + Number(enemy.combat || 0) * 0.6;
  }
  return score;
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

function summarizeGame(state, gameSeed) {
  const live = liveUnits(state.units);
  const axisCombat = live.filter((unit) => unit.side === "axis").reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const alliedCombat = live.filter((unit) => unit.side === "allied").reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const axisHexes = new Set(live.filter((unit) => unit.side === "axis").map((unit) => unit.hexId));
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
  reasons: results.reduce((totals, result) => {
    totals[result.reason] = (totals[result.reason] || 0) + 1;
    return totals;
  }, {}),
}, null, 2));
