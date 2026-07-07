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
import {
  AI_HEURISTIC_WEIGHTS,
  clampScore,
  combatDeclarationThreshold,
  combatOvercommitPenalty,
  finalApproachTempoScore,
  forcedRetreatTrapScore,
  lineSpacingScore,
  objectiveGateLatchScore,
} from "../el-alamein/src/app/ai-heuristics.js";

const scenario = JSON.parse(fs.readFileSync(new URL("../el-alamein/local-data/scenario.json", import.meta.url), "utf8"));
const rules = JSON.parse(fs.readFileSync(new URL("../el-alamein/local-data/rules.json", import.meta.url), "utf8"));
const board = createBoard(scenario);
const AXIS_OBJECTIVE_HEXES = Object.freeze([...scenario.objectives.alamHalfaRidge, ...scenario.objectives.coastalRoadEast]);
const ALLIED_ANCHOR_HEXES = Object.freeze([...AXIS_OBJECTIVE_HEXES, ...scenario.objectives.alliedWestExitEdge]);
const distanceCache = new Map();

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));

const games = Number(args.get("games") || 80);
const seed = Number(args.get("seed") || 1942);
const seedList = args.has("seeds")
  ? args.get("seeds").split(",").map((value) => Number(value.trim())).filter(Number.isFinite)
  : null;
const sampleCount = Number(args.get("sample") || 0);
const traceSeed = args.has("trace") ? Number(args.get("trace") || seed) : null;
const expectAxis = args.has("expect-axis");
const delayAxisVictory = args.has("delay-axis-victory");

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
    firstAxisObjective: null,
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
    if (unit.side === "axis" && maybeCheckAxisVictory(state)) return;
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
  const maxExitThreat = Math.max(0, ...westExit.map((hexId) => alliedExitThreat(state, hexId)));
  if (maxExitThreat < 12 && nearestDistance(unit.hexId, westExit) > 1) return null;
  const holdThreat = 11;
  if (westExit.includes(unit.hexId) && alliedExitThreat(state, unit.hexId) >= holdThreat) return "hold";
  let best = null;
  for (const [hexId, route] of reachable.entries()) {
    const coverage = axisExitCoverageScore(state, hexId, unit.id);
    if (!coverage) continue;
    const score = coverage + Number(route?.remaining || 0) * 0.3 - distance(unit.hexId, hexId) * 0.4;
    if (!best || score > best.score) best = { hexId, score };
  }
  return best && best.score >= 24 ? best.hexId : null;
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
  const reliefPriority = unit.side === "allied" && alliedShouldRelieveObjectiveDefender(state, unit) ? 55 : 0;
  return movement * 1.7 + combat * 1.2 + pressure + reliefPriority;
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
    if (!candidate || candidate.score < combatThreshold(state, activeSide(state))) break;
    const battle = declareBattle(state, candidate.defender, candidate.attackers);
    state.declaredCombats.push(battle);
    if (trace) {
      console.error(`declare ${battle.id} ${candidate.attackers.map((unit) => `${unit.id}:${hexLabel(unit.hexId)}`).join("+")} -> ${candidate.defender.id}:${hexLabel(candidate.defender.hexId)} score=${candidate.score.toFixed(1)}`);
    }
  }

  for (const battle of state.declaredCombats.slice()) {
    if (!battle.resolved) resolveBattle(state, battle, rng, trace);
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

function resolveBattle(state, battle, rng, trace = false) {
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
    retreatUnits(state, battle, attackers, 1, battle.side, false, trace);
    battle.resolved = true;
    return;
  }
  const retreat = result.match(/^DR(\d+)$/);
  if (retreat) {
    retreatUnits(state, battle, [defender], Number(retreat[1]), battle.side, true, trace);
    advanceAfterCombat(state, battle);
    battle.resolved = true;
  }
}

function retreatUnits(state, battle, units, steps, controllerSide, disruptAfterRetreat, trace = false) {
  for (const unit of units) {
    if (!unit || unit.eliminated) continue;
    const origin = battle.attackerOrigins?.[unit.id] || battle.defenderHexId || unit.hexId;
    const paths = getLegalRetreatPaths(context(state), unit, steps, origin);
    const destination = chooseRetreat(state, unit, paths, controllerSide);
    if (trace) {
      console.error(`retreat ${unit.id}:${hexLabel(unit.hexId)} -> ${destination ? hexLabel(destination) : "eliminated"} controller=${controllerSide} paths=${paths.size}`);
    }
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
  const trapScore = forcedRetreatTrap(state, controllerSide, unit, hexId);
  if (controllerSide === "axis" && unit.side === "allied") {
    const exitDistance = nearestDistance(hexId, scenario.objectives.alliedWestExitEdge);
    const allowance = Math.max(movementAllowance(state, unit), Number(unit.movement || 0));
    let score = Math.min(exitDistance, 12) * 5;
    if (exitDistance < allowance) score -= 180 + (allowance - exitDistance) * 35;
    else if (exitDistance <= allowance + 1) score -= 60;
    return score + trapScore - strategicHexValue(state, "allied", hexId) * 0.08;
  }
  if (controllerSide === "allied" && unit.side === "axis") {
    const objectiveDistance = nearestDistance(hexId, axisObjectives());
    return objectiveDistance * 6 + trapScore - strategicHexValue(state, "axis", hexId) * 0.12;
  }
  return trapScore + strategicHexValue(state, controllerSide, hexId) * 0.02;
}

function forcedRetreatTrap(state, controllerSide, unit, hexId) {
  const hypothetical = { unit, hexId };
  return forcedRetreatTrapScore({
    retreatExitCount: retreatExitCount(state, unit, hypothetical),
    adjacentControllerStrength: adjacentSideStrength(state, controllerSide, hexId),
    controllerZocCount: sideZocCount(state, controllerSide, hexId),
    enemyObjectiveDistance: nearestDistance(hexId, axisObjectives()),
    enemyExitDistance: unit.side === "allied" ? nearestDistance(hexId, scenario.objectives.alliedWestExitEdge) : 0,
    highValueEnemy: unit.side === "axis" ? isAxisAssaultUnit(unit) : isHighValueAlliedUnit(unit),
  });
}

function adjacentSideStrength(state, side, hexId) {
  return neighborsOf(board, hexId)
    .map((neighborId) => liveUnitAt(state.units, neighborId))
    .filter((unit) => unit && unit.side === side && !unit.disrupted)
    .reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
}

function sideZocCount(state, side, hexId) {
  return neighborsOf(board, hexId).filter((neighborId) => (
    liveUnits(state.units).some((unit) => unit.side === side && !unit.disrupted && neighborsOf(board, unit.hexId).includes(neighborId))
  )).length;
}

function advanceAfterCombat(state, battle) {
  if (liveUnitAt(state.units, battle.defenderHexId)) return;
  let best = null;
  for (const id of battle.attackerIds) {
    const unit = unitById(state.units, id);
    if (!unit || unit.eliminated || !neighborsOf(board, unit.hexId).includes(battle.defenderHexId)) continue;
    const gain = scoreHex(state, unit, battle.defenderHexId, { remaining: 0, path: [unit.hexId, battle.defenderHexId] })
      - scoreHex(state, unit, unit.hexId, { remaining: 0, path: [unit.hexId] })
      + axisAdvanceObjectiveScore(state, unit, unit.hexId, battle.defenderHexId)
      + axisAdvancePerimeterScore(state, unit, unit.hexId, battle.defenderHexId);
    if (!best || gain > best.gain) best = { unit, gain };
  }
  if (best && best.gain > 0) {
    best.unit.hexId = battle.defenderHexId;
    if (best.unit.side === "axis") maybeCheckAxisVictory(state);
  }
}

function axisAdvanceObjectiveScore(state, unit, fromHexId, toHexId) {
  if (unit.side !== "axis") return 0;
  const fromObjective = axisObjectives().includes(fromHexId);
  const toObjective = axisObjectives().includes(toHexId);
  let score = 0;
  if (fromObjective && state.turn >= 3) return -10000;
  if (toObjective && !fromObjective) score += 220;
  else if (toObjective) score -= state.turn >= 3 ? 180 : 70;
  if (fromObjective && !toObjective) score -= state.turn >= 3 ? 280 : 150;
  return score;
}

function axisAdvancePerimeterScore(state, unit, fromHexId, toHexId) {
  if (unit.side !== "axis" || state.turn < 3 || axisObjectives().includes(toHexId)) return 0;
  if (axisObjectives().includes(fromHexId)) return -10000;
  let score = 0;
  for (const objectiveHexId of axisObjectives()) {
    const occupant = liveUnitAt(state.units, objectiveHexId);
    if (occupant?.side !== "axis" || !neighborsOf(board, objectiveHexId).includes(toHexId)) continue;
    const adjacentAlliedThreat = neighborsOf(board, objectiveHexId)
      .map((neighborId) => liveUnitAt(state.units, neighborId))
      .filter((enemy) => enemy && enemy.side === "allied" && !enemy.disrupted)
      .reduce((sum, enemy) => sum + Number(enemy.combat || 0), 0);
    score += (state.turn >= 4 ? 160 : 92) + Math.min(70, adjacentAlliedThreat * 8) + Number(unit.combat || 0) * 5;
  }
  return score;
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

function maybeCheckAxisVictory(state) {
  if (delayAxisVictory) {
    recordAxisObjective(state);
    return false;
  }
  return checkAxisVictory(state);
}

function recordAxisObjective(state) {
  if (state.firstAxisObjective) return;
  const reason = axisObjectiveReason(state);
  if (reason) state.firstAxisObjective = { reason, turn: state.turn, phase: phase(state).id };
}

function axisObjectiveReason(state) {
  const axisHexes = new Set(liveUnits(state.units).filter((unit) => unit.side === "axis").map((unit) => unit.hexId));
  if (scenario.objectives.alamHalfaRidge.some((hexId) => axisHexes.has(hexId))) return "ridge";
  if (scenario.objectives.coastalRoadEast.some((hexId) => axisHexes.has(hexId))) return "road";
  return null;
}

function checkAxisVictory(state) {
  const reason = axisObjectiveReason(state);
  if (reason) {
    state.winner = { side: "axis", reason, turn: state.turn };
    recordAxisObjective(state);
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

function combatThreshold(state, side) {
  return combatDeclarationThreshold({ side, turn: state.turn });
}

function scoreCombat(state, attackers, defender, odds) {
  const side = attackers[0]?.side || activeSide(state);
  const attackStrength = attackers.reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const defenderValue = strategicUnitValue(state, side, defender);
  const objectiveUrgency = axisObjectiveCombatUrgency(state, side, defender.hexId);
  const perimeterUrgency = axisObjectivePerimeterCombatUrgency(state, side, attackers, defender.hexId);
  const bridgeheadUrgency = axisBridgeheadCombatUrgency(state, side, attackers, defender, odds);
  const counterattackUrgency = alliedObjectiveCombatUrgency(state, side, defender.hexId);
  const spearheadUrgency = alliedSpearheadCounterattackUrgency(state, side, attackers, defender, odds);
  let total = 0;
  for (const row of Object.values(rules.crt.rows)) {
    total += scoreCombatResult(state, row[odds.columnIndex], attackers, defender, defenderValue);
  }
  const overcommit = Math.max(0, attackStrength - Math.max(1, odds.defense) * 4) * 0.28 + Math.max(0, attackers.length - 2) * 0.45;
  const counterattackOddsBonus = counterattackUrgency ? odds.columnIndex * 44 + Math.max(0, attackers.length - 1) * 40 + attackStrength * 6 : 0;
  const spearheadOddsBonus = spearheadUrgency ? odds.columnIndex * 26 + Math.max(0, attackers.length - 1) * 34 + attackStrength * 3.5 : 0;
  const counterattackOvercommit = counterattackUrgency || spearheadUrgency ? overcommit * 0.25 : overcommit;
  const objectiveOddsBonus = axisObjectiveOddsBonus(state, side, objectiveUrgency, attackers, odds);
  const perimeterOddsBonus = axisObjectivePerimeterOddsBonus(state, side, perimeterUrgency, attackers, odds);
  return (total / 6) + objectiveUrgency + objectiveOddsBonus + perimeterUrgency + perimeterOddsBonus + bridgeheadUrgency + counterattackUrgency + counterattackOddsBonus + spearheadUrgency + spearheadOddsBonus + odds.columnIndex * 1.1 + strategicHexValue(state, side, defender.hexId) * 0.04 - counterattackOvercommit - combatOverkillPenalty(state, side, attackers, defender, odds) - axisBridgeheadLowOddsPenalty(state, side, attackers, defender, odds) - axisObjectiveGarrisonAttackPenalty(state, side, attackers, defender, odds) - axisObjectiveLowOddsPenalty(state, side, objectiveUrgency, attackers, odds) - axisObjectiveDiversionPenalty(state, side, attackers, defender) - axisScreenAttackPenalty(state, attackers, odds) - alliedObjectiveDiversionPenalty(state, side, attackers, defender) - alliedSpoilingAttackPenalty(side, counterattackUrgency + spearheadUrgency, attackers, odds);
}

function axisObjectiveCombatUrgency(state, attackerSide, defenderHexId) {
  if (attackerSide !== "axis") return 0;
  const onRidge = scenario.objectives.alamHalfaRidge.includes(defenderHexId);
  const onRoad = scenario.objectives.coastalRoadEast.includes(defenderHexId);
  if (!onRidge && !onRoad) return 0;
  const base = onRidge ? 130 : 105;
  const deadline = state.turn >= 4 ? 430 : state.turn === 3 ? 210 : 60;
  return base + deadline;
}

function axisObjectivePerimeterCombatUrgency(state, attackerSide, attackers, defenderHexId) {
  if (attackerSide !== "axis" || state.turn < 3) return 0;
  const occupiedObjective = axisObjectives().find((objectiveHexId) => {
    const occupant = liveUnitAt(state.units, objectiveHexId);
    return occupant?.side === "axis" && neighborsOf(board, objectiveHexId).includes(defenderHexId);
  });
  if (!occupiedObjective) return 0;
  const adjacentAlliedThreat = neighborsOf(board, occupiedObjective)
    .map((neighborId) => liveUnitAt(state.units, neighborId))
    .filter((enemy) => enemy && enemy.side === "allied" && !enemy.disrupted)
    .reduce((sum, enemy) => sum + Number(enemy.combat || 0), 0);
  const nonObjectiveAttackers = attackers.filter((unit) => !axisObjectives().includes(unit.hexId)).length;
  const objectiveAttackers = attackers.length - nonObjectiveAttackers;
  const base = state.turn >= 4 ? 210 : 118;
  return base + adjacentAlliedThreat * 12 + nonObjectiveAttackers * 72 - objectiveAttackers * 18;
}

function axisObjectivePerimeterOddsBonus(state, attackerSide, perimeterUrgency, attackers, odds) {
  if (attackerSide !== "axis" || !perimeterUrgency) return 0;
  const nonObjectiveAttackers = attackers.filter((unit) => !axisObjectives().includes(unit.hexId)).length;
  const attackStrength = attackers.reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const timing = state.turn >= 4 ? 1.35 : 1;
  return (odds.columnIndex * 22 + nonObjectiveAttackers * 46 + attackStrength * 1.8) * timing;
}

function axisBridgeheadCombatUrgency(state, attackerSide, attackers, defender, odds) {
  if (attackerSide !== "axis" || state.turn < 3) return 0;
  const attackStrength = attackers.reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  let best = 0;
  for (const objectiveHexId of axisObjectives()) {
    const occupant = liveUnitAt(state.units, objectiveHexId);
    if (occupant?.side !== "axis") continue;
    const defenderDistance = distance(defender.hexId, objectiveHexId);
    if (defenderDistance > 2) continue;
    const perimeterAttack = attackers.some((unit) => distance(unit.hexId, objectiveHexId) <= 1);
    if (!perimeterAttack) continue;
    const objectiveGarrisonAttack = attackers.some((unit) => unit.hexId === objectiveHexId);
    const oddsDiscipline = odds.columnIndex >= 4 ? 1.22 : odds.columnIndex === 3 ? 0.42 : odds.columnIndex >= 2 ? 0.16 : 0.06;
    const base = defenderDistance === 1 ? 330 : 112;
    const threatValue = Number(defender.combat || 0) * (defenderDistance === 1 ? 24 : 12);
    const groupValue = Math.max(0, attackers.length - 1) * 34 + attackStrength * 5.2;
    const garrisonValue = objectiveGarrisonAttack ? 84 : 0;
    best = Math.max(best, (base + threatValue + groupValue + garrisonValue) * oddsDiscipline);
  }
  return Math.min(680, best);
}

function axisBridgeheadLowOddsPenalty(state, attackerSide, attackers, defender, odds) {
  if (attackerSide !== "axis" || state.turn < 3 || odds.columnIndex >= 4) return 0;
  let penalty = 0;
  for (const objectiveHexId of axisObjectives()) {
    const occupant = liveUnitAt(state.units, objectiveHexId);
    if (occupant?.side !== "axis") continue;
    if (distance(defender.hexId, objectiveHexId) > 2) continue;
    if (!attackers.some((unit) => distance(unit.hexId, objectiveHexId) <= 2)) continue;
    const timing = state.turn >= 4 ? 1.45 : 1;
    const soloRisk = attackers.length === 1 ? 110 : 0;
    const garrisonRisk = attackers.some((unit) => unit.hexId === objectiveHexId) ? 160 : 0;
    penalty = Math.max(penalty, ((4 - odds.columnIndex) * 175 + soloRisk + garrisonRisk) * timing);
  }
  return penalty;
}

function axisObjectiveGarrisonAttackPenalty(state, attackerSide, attackers, defender, odds) {
  if (attackerSide !== "axis" || state.turn < 3) return 0;
  const garrisonAttackers = attackers.filter((unit) => axisObjectives().includes(unit.hexId));
  if (!garrisonAttackers.length) return 0;
  const targetObjective = axisObjectives().includes(defender.hexId);
  const objectiveThreat = garrisonAttackers.some((unit) => {
    const adjacentAlliedThreat = neighborsOf(board, unit.hexId)
      .map((neighborId) => liveUnitAt(state.units, neighborId))
      .filter((enemy) => enemy && enemy.side === "allied" && !enemy.disrupted)
      .reduce((sum, enemy) => sum + Number(enemy.combat || 0), 0);
    return adjacentAlliedThreat >= 6;
  });
  const nonGarrisonAttackers = attackers.length - garrisonAttackers.length;
  const timing = state.turn >= 4 ? 1.35 : 1;
  if (nonGarrisonAttackers === 0 && odds.columnIndex < 4) return 900 * timing;
  const base = targetObjective ? 135 : objectiveThreat ? 92 : 240;
  const oddsRisk = odds.columnIndex < 4 ? (4 - odds.columnIndex) * 62 : 0;
  const soloRisk = nonGarrisonAttackers === 0 ? (targetObjective ? 190 : 120) : 0;
  const supportRelief = Math.min(90, nonGarrisonAttackers * 36);
  return Math.max(0, (base + oddsRisk + soloRisk - supportRelief) * timing);
}

function combatOverkillPenalty(state, attackerSide, attackers, defender, odds) {
  if (odds.columnIndex < 4) return 0;
  if (attackerSide === "axis" && axisObjectives().includes(defender.hexId)) return 0;
  const attackStrength = attackers.reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const retreatPressure = defenderRetreatPressure(state, defender, 1);
  const surrounded = retreatPressure >= 5;
  const mobileUnits = attackerSide === "axis"
    ? attackers.filter((unit) => isAxisAssaultUnit(unit)).length
    : attackers.filter((unit) => Number(unit.movement || 0) >= 7).length;
  return combatOvercommitPenalty({
    attackerSide,
    attackStrength,
    defense: odds.defense,
    oddsColumnIndex: odds.columnIndex,
    attackerCount: attackers.length,
    attackerStrengths: attackers.map((unit) => Number(unit.combat || 0)),
    mobileUnits,
    surrounded,
    earlyNoExtraRelief: attackerSide === "axis" && state.turn <= 2 ? 0.5 : 1,
  });
}

function alliedObjectiveCombatUrgency(state, attackerSide, defenderHexId) {
  if (attackerSide !== "allied") return 0;
  const objectiveDistance = nearestDistance(defenderHexId, axisObjectives());
  if (objectiveDistance === 0) return state.turn >= 3 ? 360 : 260;
  if (objectiveDistance === 1) return state.turn >= 3 ? 120 : 70;
  return 0;
}

function alliedSpearheadCounterattackUrgency(state, attackerSide, attackers, defender, odds) {
  if (attackerSide !== "allied" || defender.side !== "axis" || !isAxisAssaultUnit(defender)) return 0;
  const objectiveDistance = nearestDistance(defender.hexId, axisObjectives());
  if (objectiveDistance > 2) return 0;
  const attackStrength = attackers.reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const defenderDefense = Math.max(1, defenseBreakdown(context(state), defender).total);
  if (attackers.length === 1 && attackStrength < defenderDefense * 1.5) return 0;
  if (odds.columnIndex < 2 && attackers.length < 2) return 0;
  const localAllied = liveUnits(state.units).filter((unit) => unit.side === "allied" && !unit.disrupted && distance(unit.hexId, defender.hexId) <= 2);
  const nearbyAxisAssault = liveUnits(state.units).filter((unit) => isAxisAssaultUnit(unit) && unit.id !== defender.id && distance(unit.hexId, defender.hexId) <= 2).length;
  const lineThreat = Math.max(0, 3 - objectiveDistance) * 46 + Math.max(0, localAllied.length - nearbyAxisAssault) * 18;
  const oddsDiscipline = odds.columnIndex >= 2 ? 1 : 0.42;
  const groupBonus = attackers.length >= 2 ? 58 : attackers.length === 1 ? -18 : 0;
  return Math.max(0, (lineThreat + groupBonus + Math.max(0, attackStrength - defenderDefense) * 7) * oddsDiscipline);
}

function alliedSpoilingAttackPenalty(attackerSide, counterattackUrgency, attackers, odds) {
  if (attackerSide !== "allied" || counterattackUrgency) return 0;
  const lowOddsPenalty = odds.columnIndex < 3 ? (3 - odds.columnIndex) * 28 : 0;
  const singleUnitPenalty = attackers.length === 1 ? 24 : 0;
  const weakUnitPenalty = attackers.some((unit) => Number(unit.combat || 0) <= 2) ? 18 : 0;
  return lowOddsPenalty + singleUnitPenalty + weakUnitPenalty;
}

function alliedObjectiveDiversionPenalty(state, attackerSide, attackers, defender) {
  if (attackerSide !== "allied" || axisObjectives().includes(defender.hexId)) return 0;
  const occupiedObjectives = axisObjectives().filter((hexId) => liveUnitAt(state.units, hexId)?.side === "axis");
  if (!occupiedObjectives.length) return 0;
  let penalty = 0;
  for (const attacker of attackers) {
    const guardsOccupiedObjective = occupiedObjectives.some((objectiveHexId) => neighborsOf(board, objectiveHexId).includes(attacker.hexId));
    if (!guardsOccupiedObjective) continue;
    penalty += (state.turn >= 3 ? 220 : 160) + Number(attacker.combat || 0) * 10;
  }
  return Math.min(520, penalty);
}

function axisObjectiveOddsBonus(state, attackerSide, objectiveUrgency, attackers, odds) {
  if (attackerSide !== "axis" || !objectiveUrgency) return 0;
  const attackStrength = attackers.reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const grouped = Math.max(0, attackers.length - 1) * 16;
  const oddsBonus = odds.columnIndex * (state.turn >= 4 ? 30 : 20);
  return grouped + oddsBonus + attackStrength * 2.2;
}

function axisObjectiveLowOddsPenalty(state, attackerSide, objectiveUrgency, attackers, odds) {
  if (attackerSide !== "axis" || !objectiveUrgency || odds.columnIndex >= 2) return 0;
  const attackStrength = attackers.reduce((sum, unit) => sum + Number(unit.combat || 0), 0);
  const pressure = state.turn >= 4 ? 0.45 : state.turn === 3 ? 1 : 1.25;
  const singleUnitPenalty = attackers.length === 1 ? 76 : 0;
  const assaultRisk = attackers.some(isAxisAssaultUnit) ? 38 : 0;
  return ((2 - odds.columnIndex) * 150 + singleUnitPenalty + assaultRisk + attackStrength * 3) * pressure;
}

function axisObjectiveDiversionPenalty(state, attackerSide, attackers, defender) {
  if (attackerSide !== "axis" || state.turn < 3 || axisObjectives().includes(defender.hexId)) return 0;
  let penalty = 0;
  for (const attacker of attackers) {
    if (!isAxisAssaultUnit(attacker)) continue;
    const adjacentObjective = axisObjectives().some((objectiveHexId) => {
      const occupant = liveUnitAt(state.units, objectiveHexId);
      return occupant?.side === "allied" && neighborsOf(board, objectiveHexId).includes(attacker.hexId);
    });
    if (adjacentObjective) penalty += (state.turn >= 4 ? 180 : 92) + Number(attacker.combat || 0) * 4;
  }
  return Math.min(state.turn >= 4 ? 520 : 260, penalty);
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
  if (result === "AR") {
    const tempoRisk = side === "axis" && state.turn <= 2 && attackers.some(isAxisAssaultUnit) ? 2.65 : 1.85;
    return -attackerValue * tempoRisk;
  }
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
    score += axisFinalObjectiveEntry(state, unit, hexId);
    score += axisBridgeheadSecurity(state, unit, hexId) * (assault ? 1.18 : combat >= 3 ? 0.9 : 0.45);
    score -= nearestDistance(hexId, axisTargetsForUnit(unit)) * (combat >= 4 ? 6.1 : 3.5);
    score += axisProgress(state, unit, hexId) * (assault ? 1.35 : 1);
    score += axisForwardZocLine(state, unit, hexId) * (assault ? 1.45 : combat >= 3 ? 2.25 : 1);
    score += assault ? 0 : axisRearGuard(state, unit, hexId);
    score += attackSetup(state, unit, hexId) * (assault ? 3.9 : 3.1);
    score += zocTrapSetup(state, unit, hexId) * (assault ? 6.2 : 4.45);
    if (assault) {
      score += axisPenetration(state, unit, hexId, route);
      score += axisEncirclement(state, unit, hexId, route);
      score += axisObjectiveAttackPosition(state, unit, hexId);
      score += axisFinalAssaultMass(state, unit, hexId);
      score += axisFinalApproachTempo(state, unit, hexId);
      score += axisMobileGroupSupport(state, unit, hexId);
      score += axisSpearheadPressure(state, unit, hexId);
    }
    else {
      score += axisZocScreen(state, unit, hexId);
      score += axisDynamicScreen(state, unit, hexId);
    }
    if (assault && scenario.objectives.alliedWestExitEdge.includes(hexId)) score -= 110;
  } else {
    if (scenario.objectives.alliedWestExitEdge.includes(hexId) && route?.remaining > 0) {
      score += isEnemyZoc(context(state), hexId, unit.side, unit.id) ? 24 : 230;
    }
    score += alliedDefenseScore(hexId) * 2.65;
    score += alliedScreen(hexId) * 3.25;
    score += alliedForwardDefense(state, unit, hexId) * (combat >= 4 ? 1.05 : 0.82);
    score += alliedZocBarrier(state, unit, hexId) * (combat >= 4 ? 1.45 : 1.15);
    score += alliedInterlockingZoc(state, unit, hexId) * (combat >= 4 ? 1.5 : 1.18);
    score += alliedRoadblock(state, unit, hexId) * (combat >= 3 ? 1.1 : 0.9);
    score += alliedObjectiveGateLatch(state, unit, hexId) * (combat >= 3 ? 1.18 : 0.92);
    score += alliedSupportedLine(state, unit, hexId) * 0.78;
    score += alliedApproachInterdiction(state, unit, hexId) * 1.28;
    score += alliedForwardScreenLine(state, unit, hexId) * (combat >= 4 ? 1.32 : 1.06);
    score += alliedForwardZocWall(state, unit, hexId) * (combat >= 3 ? 2.15 : 1.55);
    score += alliedSpearheadCounterattackPosition(state, unit, hexId);
    score -= alliedIsolatedObjectivePenalty(state, unit, hexId);
    score += alliedRidgeReserve(state, unit, hexId) * (combat >= 4 ? 1.05 : 0.9);
    score += alliedObjectiveHold(state, unit, hexId);
    score += alliedObjectiveCounterattack(state, unit, hexId) * (combat >= 3 ? 1.1 : 0.75);
    score += alliedObjectiveRelief(state, unit, hexId);
    score += alliedLineCohesion(state, unit, hexId) * 0.8;
    score -= nearestDistance(hexId, alliedAnchors()) * (combat >= 4 ? 1.1 : 0.85);
    score += attackSetup(state, unit, hexId) * 2.2;
    score += zocTrapSetup(state, unit, hexId) * 1.3;
  }

  if (hex.terrain === "highland" || hex.terrain === "settlement") score += 9 + combat * 0.8;
  if (unit.side === "allied" && hex.britishPosition) score += 16 + combat * 0.7;
  score += friendlySupport(state, unit, hexId) * 1.25;
  score -= danger(state, unit, hexId) * (unit.side === "axis" && isAxisAssaultUnit(unit) ? 0.68 : combat >= 4 ? 0.6 : 1.25);
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
  return AXIS_OBJECTIVE_HEXES;
}

function alliedAnchors() {
  return ALLIED_ANCHOR_HEXES;
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

function axisFinalObjectiveEntry(state, unit, hexId) {
  if (unit.side !== "axis" || state.turn < 4) return 0;
  const axisAlreadyHoldsObjective = axisObjectives().some((objectiveHexId) => liveUnitAt(state.units, objectiveHexId)?.side === "axis");
  if (axisAlreadyHoldsObjective) return 0;
  if (axisObjectives().includes(hexId) && liveUnitAt(state.units, hexId)?.side !== "allied") {
    return 1800 + Number(unit.combat || 0) * 24 + Number(unit.movement || 0) * 8;
  }
  const openObjectives = axisObjectives().filter((objectiveHexId) => liveUnitAt(state.units, objectiveHexId)?.side !== "allied");
  const openObjectiveDistance = openObjectives.length ? nearestDistance(hexId, openObjectives) : Infinity;
  if (openObjectiveDistance === 1) return isAxisAssaultUnit(unit) ? 220 : 70;
  return 0;
}

function axisBridgeheadSecurity(state, unit, hexId) {
  if (unit.side !== "axis" || state.turn < 3) return 0;
  const units = liveUnits(state.units);
  const combat = Number(unit.combat || 0);
  let score = 0;

  for (const objectiveHexId of axisObjectives()) {
    const occupant = liveUnitAt(state.units, objectiveHexId);
    if (occupant?.side === "allied") continue;
    const currentDistance = distance(unit.hexId, objectiveHexId);
    const candidateDistance = distance(hexId, objectiveHexId);
    const securityRadius = state.turn >= 4 ? 3 : 2;
    if (candidateDistance > securityRadius && currentDistance > 2) continue;

    const nearbyAllied = units.filter((candidate) => candidate.side === "allied" && !candidate.disrupted && distance(candidate.hexId, objectiveHexId) <= 3);
    const adjacentThreat = nearbyAllied
      .filter((enemy) => distance(enemy.hexId, objectiveHexId) === 1)
      .reduce((sum, enemy) => sum + Number(enemy.combat || 0), 0);
    const closeThreat = nearbyAllied
      .filter((enemy) => distance(enemy.hexId, objectiveHexId) <= 2)
      .reduce((sum, enemy) => sum + Number(enemy.combat || 0), 0);
    const bridgeheadMates = units.filter((ally) => ally.side === "axis" && ally.id !== unit.id && !ally.disrupted && distance(ally.hexId, objectiveHexId) <= 2);
    const interlocks = bridgeheadMates.filter((ally) => distance(hexId, ally.hexId) === 2 || distance(hexId, ally.hexId) === 1).length;
    const held = occupant?.side === "axis";
    const pressure = adjacentThreat * 2.4 + closeThreat + nearbyAllied.length * 4;

    if (held && occupant.id === unit.id && candidateDistance > 0) score -= 10000;
    if (candidateDistance === 0) score += (held ? 110 : 155) + pressure * 5.4 + combat * 7;
    else if (candidateDistance === 1) score += (held ? 135 : 92) + pressure * 4.1 + combat * 5 + interlocks * 18;
    else if (candidateDistance === 2) score += (held ? 48 : 26) + pressure * 1.8 + interlocks * 8;
    else if (candidateDistance === 3 && state.turn >= 4) score += (held ? 24 : 14) + pressure * 0.8 + interlocks * 5;

    if (candidateDistance < currentDistance) score += Math.min(30, (currentDistance - candidateDistance) * 12);
    if (currentDistance <= 1 && candidateDistance > currentDistance) score -= held ? 210 : 120;
  }

  return Math.min(560, Math.max(-10000, score));
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

function axisPenetration(state, unit, hexId, route = null) {
  const targets = axisTargetsForUnit(unit);
  const currentDistance = nearestDistance(unit.hexId, targets);
  const nextDistance = nearestDistance(hexId, targets);
  const distanceGain = currentDistance - nextDistance;
  const inEnemyZoc = isEnemyZoc(context(state), hexId, unit.side, unit.id);
  let score = distanceGain * 13;
  if (nextDistance === 0) score += 90;
  else if (nextDistance === 1) score += 34;
  else if (nextDistance === 2) score += 14;
  if (nextDistance <= 5) score += (6 - nextDistance) * 7.5;
  if (!inEnemyZoc && nextDistance <= 5) score += 10;
  if (!inEnemyZoc && Number(route?.remaining || 0) >= 2 && nextDistance <= 6) score += Math.min(3, Number(route.remaining)) * 3.5;
  if (route?.path?.some((id) => liveUnits(state.units).some((enemy) => enemy.side === "allied" && !enemy.disrupted && distance(id, enemy.hexId) <= 2))) {
    score += nextDistance <= currentDistance ? 8 : 0;
  }
  for (const enemy of liveUnits(state.units).filter((candidate) => candidate.side === "allied" && !candidate.disrupted)) {
    if (!isHighValueAlliedUnit(enemy)) continue;
    const enemyDistance = distance(hexId, enemy.hexId);
    if (enemyDistance > 3) continue;
    const currentExits = retreatExitCount(state, enemy, null);
    const trappedExits = retreatExitCount(state, enemy, { unit, hexId });
    const trapGain = Math.max(0, currentExits - trappedExits);
    score += strategicUnitValue(state, "axis", enemy) * (enemyDistance === 1 ? 0.32 : enemyDistance === 2 ? 0.18 : 0.09);
    score += trapGain * 9 + Math.max(0, 3 - trappedExits) * 3;
  }
  return score;
}

function axisEncirclement(state, unit, hexId, route = null) {
  if (unit.side !== "axis") return 0;
  const combat = Number(unit.combat || 0);
  const movement = Number(unit.movement || 0);
  if (!isAxisAssaultUnit(unit) && combat < 4 && movement < 8) return 0;

  const allowance = Math.max(movementAllowance(state, unit), movement);
  const spent = route ? Math.max(0, allowance - Number(route.remaining || 0)) : 0;
  const efficientMove = !route || spent <= Math.max(4, allowance * 0.72);
  let score = 0;

  for (const enemy of liveUnits(state.units).filter((candidate) => candidate.side === "allied" && !candidate.disrupted)) {
    const enemyDistance = distance(hexId, enemy.hexId);
    if (enemyDistance > 2) continue;

    const currentExits = retreatExitCount(state, enemy, null);
    const trappedExits = retreatExitCount(state, enemy, { unit, hexId });
    const reduced = Math.max(0, currentExits - trappedExits);
    if (!reduced && trappedExits > 1) continue;

    const adjacent = neighborsOf(board, enemy.hexId).includes(hexId);
    const supportStrength = neighborsOf(board, enemy.hexId)
      .map((neighborId) => (neighborId === hexId ? unit : liveUnitAt(state.units, neighborId)))
      .filter((ally) => ally && ally.side === "axis" && ally.id !== unit.id && !ally.disrupted)
      .reduce((sum, ally) => sum + Number(ally.combat || 0), adjacent ? combat : 0);
    const defense = Math.max(1, defenseBreakdown(context(state), enemy).total);
    const attackReady = adjacent || supportStrength >= defense;
    const value = strategicUnitValue(state, "axis", enemy) + Number(enemy.combat || 0) * 4;
    const killShape = trappedExits === 0
      ? 132 + value * 2.2
      : trappedExits === 1
        ? 62 + value * 0.9
        : Math.max(0, 3 - trappedExits) * 18;
    const reductionValue = reduced * (24 + value * 0.15);
    const attackValue = attackReady ? Math.min(90, (supportStrength / defense) * 24) : 0;
    score += (killShape + reductionValue + attackValue) * (adjacent ? 1.16 : 0.82) * (efficientMove ? 1 : 0.55);
  }

  const objectiveDrift = nearestDistance(hexId, axisObjectives()) - nearestDistance(unit.hexId, axisObjectives());
  if (objectiveDrift > 2) score *= 0.55;
  return Math.min(460, score);
}

function axisMobileGroupSupport(state, unit, hexId) {
  let score = 0;
  let nearestSupport = Infinity;
  for (const ally of liveUnits(state.units).filter((candidate) => candidate.side === "axis" && candidate.id !== unit.id && !candidate.disrupted)) {
    const allyDistance = distance(hexId, ally.hexId);
    if (isAxisAssaultUnit(ally)) {
      nearestSupport = Math.min(nearestSupport, allyDistance);
      if (allyDistance === 2) score += 6;
      else if (allyDistance === 3) score += 4;
      else if (allyDistance === 1) score += 1.5;
      else if (allyDistance === 4) score += 1.5;
    } else if (allyDistance <= 2) {
      score += Number(ally.combat || 0) * 0.45;
    }
  }
  if (nearestSupport > 3 && nearestDistance(hexId, axisObjectives()) > 1) score -= 8;
  return score;
}

function axisObjectiveAttackPosition(state, unit, hexId) {
  if (!isAxisAssaultUnit(unit)) return 0;
  const urgency = state.turn >= 4 ? 1.75 : state.turn >= 3 ? 1.35 : state.turn === 2 ? 0.95 : 0.55;
  let score = 0;
  for (const objectiveHexId of axisObjectives()) {
    const distanceToObjective = distance(hexId, objectiveHexId);
    if (distanceToObjective > 3) continue;
    const occupant = liveUnitAt(state.units, objectiveHexId);
    const adjacentAxisAssault = neighborsOf(board, objectiveHexId)
      .map((neighborId) => liveUnitAt(state.units, neighborId))
      .filter((ally) => ally && ally.side === "axis" && ally.id !== unit.id && isAxisAssaultUnit(ally) && !ally.disrupted)
      .length;
    if (occupant?.side === "allied") {
      if (distanceToObjective === 1) {
        score += (46 + adjacentAxisAssault * 26 + strategicUnitValue(state, "axis", occupant) * 0.18) * urgency;
      } else if (distanceToObjective === 2) {
        score += 14 * urgency;
      }
    } else if (occupant?.side === "axis" && occupant.id !== unit.id) {
      if (distanceToObjective === 1) {
        const counterThreat = neighborsOf(board, objectiveHexId)
          .map((neighborId) => liveUnitAt(state.units, neighborId))
          .filter((enemy) => enemy && enemy.side === "allied" && !enemy.disrupted)
          .reduce((sum, enemy) => sum + Number(enemy.combat || 0), 0);
        score += (36 + Math.min(30, counterThreat * 3)) * urgency;
      } else if (distanceToObjective === 2) {
        score += 14 * urgency;
      }
    } else if (!occupant && distanceToObjective === 1 && state.turn >= 3) {
      const nearbyAllied = neighborsOf(board, objectiveHexId).some((neighborId) => {
        const enemy = liveUnitAt(state.units, neighborId);
        return enemy?.side === "allied" && !enemy.disrupted;
      });
      if (nearbyAllied) score += 20 * urgency;
    }
  }
  return score;
}

function axisFinalAssaultMass(state, unit, hexId) {
  if (!isAxisAssaultUnit(unit) || state.turn < 3) return 0;
  let score = 0;
  const urgency = state.turn >= 4 ? 1.65 : 0.85;
  for (const objectiveHexId of axisObjectives()) {
    const occupant = liveUnitAt(state.units, objectiveHexId);
    if (occupant?.side !== "allied") continue;
    const distanceToObjective = distance(hexId, objectiveHexId);
    if (distanceToObjective > 2) continue;
    const adjacentAxisAssault = neighborsOf(board, objectiveHexId)
      .map((neighborId) => liveUnitAt(state.units, neighborId))
      .filter((ally) => ally && ally.side === "axis" && ally.id !== unit.id && isAxisAssaultUnit(ally) && !ally.disrupted)
      .length;
    const need = Math.max(0, 3 - adjacentAxisAssault);
    if (distanceToObjective === 1) {
      score += (96 + need * 42 + Number(unit.combat || 0) * 6) * urgency;
    }
  }
  return score;
}

function axisFinalApproachTempo(state, unit, hexId) {
  if (!isAxisAssaultUnit(unit)) return 0;
  const objectiveHeld = axisObjectives().some((objectiveHexId) => liveUnitAt(state.units, objectiveHexId)?.side === "axis");
  return finalApproachTempoScore({
    turn: state.turn,
    currentDistance: nearestDistance(unit.hexId, axisObjectives()),
    candidateDistance: nearestDistance(hexId, axisObjectives()),
    objectiveHeld,
  });
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
  let score = Math.max(0, 3 - nearestDistance(hexId, westExit)) * 3 + axisExitCoverageScore(state, hexId, unit.id) * 0.42;
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

function axisDynamicScreen(state, unit, hexId) {
  if (unit.side !== "axis" || isAxisAssaultUnit(unit)) return 0;
  const westExit = scenario.objectives.alliedWestExitEdge;
  const units = liveUnits(state.units);
  const alliedUnits = units.filter((candidate) => candidate.side === "allied" && !candidate.disrupted);
  if (!alliedUnits.length) return 0;

  const combat = Number(unit.combat || 0);
  const maxExitThreat = Math.max(0, ...westExit.map((exitHexId) => alliedExitThreat(state, exitHexId)));
  const exitDistance = nearestDistance(hexId, westExit);
  let score = 0;

  if (maxExitThreat < 12 && exitDistance <= 1) score -= 28 + combat * 2.4;
  else if (exitDistance === 1) score += 16;
  else if (exitDistance === 2) score += 18;
  else if (exitDistance === 3) score += 10;
  else if (exitDistance === 4) score += 4;

  for (const ally of units.filter((candidate) => candidate.side === "axis" && candidate.id !== unit.id && !candidate.disrupted)) {
    const allyDistance = distance(hexId, ally.hexId);
    if (allyDistance === 2) score += isAxisAssaultUnit(ally) ? 7 : 19 + Math.min(5, Number(ally.combat || 0));
    else if (allyDistance === 3) score += isAxisAssaultUnit(ally) ? 5 : 8;
    else if (allyDistance === 1 && !isAxisAssaultUnit(ally)) score -= 5;
  }

  const assaultUnits = units.filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted);
  if (assaultUnits.length) {
    const nearestAssault = Math.min(...assaultUnits.map((assault) => distance(hexId, assault.hexId)));
    if (nearestAssault === 2) score += 16;
    else if (nearestAssault === 3) score += 12;
    else if (nearestAssault === 4) score += 6;
    else if (nearestAssault <= 1) score -= 6;
  }

  for (const enemy of alliedUnits) {
    const enemyExitDistance = nearestDistance(enemy.hexId, westExit);
    const enemyObjectiveDistance = nearestDistance(enemy.hexId, axisObjectives());
    if (enemyExitDistance > 9 && enemyObjectiveDistance > 7) continue;
    const enemyDistance = distance(hexId, enemy.hexId);
    if (enemyDistance === 2) score += 16 + Math.min(6, Number(enemy.combat || 0));
    else if (enemyDistance === 3) score += 7;
    else if (enemyDistance === 1) score += combat >= 4 ? 4 : -5;
    if (enemyDistance + exitDistance <= enemyExitDistance + 2) score += Math.max(0, 7 - enemyDistance) * 4.5;
  }

  const objectiveGain = nearestDistance(unit.hexId, axisObjectives()) - nearestDistance(hexId, axisObjectives());
  if (objectiveGain > 0 && exitDistance > 1) score += Math.min(18, objectiveGain * 4.5);
  return Math.min(250, Math.max(-80, score));
}

function axisForwardZocLine(state, unit, hexId) {
  if (unit.side !== "axis") return 0;
  const units = liveUnits(state.units);
  const combat = Number(unit.combat || 0);
  const movement = Number(unit.movement || 0);
  const assault = isAxisAssaultUnit(unit);
  const currentObjectiveDistance = nearestDistance(unit.hexId, axisObjectives());
  const candidateObjectiveDistance = nearestDistance(hexId, axisObjectives());
  if (candidateObjectiveDistance > 12 && currentObjectiveDistance > 12) return 0;

  const axisMates = units.filter((candidate) => (
    candidate.side === "axis"
    && candidate.id !== unit.id
    && !candidate.disrupted
    && nearestDistance(candidate.hexId, axisObjectives()) <= 12
  ));
  const exactLineMates = axisMates.filter((ally) => distance(hexId, ally.hexId) === 2).length;
  const looseLineMates = axisMates.filter((ally) => distance(hexId, ally.hexId) === 3).length;
  const adjacentCrowd = axisMates.filter((ally) => distance(hexId, ally.hexId) === 1).length;
  const closeCrowd = axisMates.filter((ally) => distance(hexId, ally.hexId) <= 2).length;
  const denseCrowd = axisMates.filter((ally) => distance(hexId, ally.hexId) <= 3).length;
  const progress = currentObjectiveDistance - candidateObjectiveDistance;
  const weights = AI_HEURISTIC_WEIGHTS.axisLine;
  let score = lineSpacingScore({
    exactLinks: exactLineMates,
    looseLinks: looseLineMates,
    adjacentCrowd,
    closeCrowd,
    denseCrowd,
    exactWeight: assault ? weights.exactAssault : weights.exactSupport,
    looseWeight: assault ? weights.looseAssault : weights.looseSupport,
    adjacentPenalty: assault ? weights.adjacentAssaultPenalty : weights.adjacentSupportPenalty,
    closeLimit: 3,
    closePenalty: assault ? weights.closeAssaultPenalty : weights.closeSupportPenalty,
    denseLimit: 5,
    densePenalty: weights.densePenalty,
  });
  if (progress > 0) score += progress * (assault ? 8 : combat >= 3 ? 5.2 : 1.6);
  if (progress < -1) score += progress * (assault ? 10 : 15);
  if (!exactLineMates && candidateObjectiveDistance <= 9) score -= assault ? 18 : combat >= 3 ? 44 : 22;
  if (exactLineMates && adjacentCrowd === 0) score += assault ? 10 : 18;

  const westExit = scenario.objectives.alliedWestExitEdge;
  const uncoveredExitThreat = westExit.reduce((sum, exitHexId) => (
    isAxisExitCoveredByOther(state, exitHexId, unit.id) ? sum : sum + alliedExitThreat(state, exitHexId)
  ), 0);
  if (combat >= 3 && movement >= 6 && nearestDistance(hexId, westExit) <= 2 && uncoveredExitThreat < 48) {
    score -= 70 + combat * 7;
  }

  for (const enemy of units.filter((candidate) => candidate.side === "allied" && !candidate.disrupted)) {
    const enemyDistance = distance(hexId, enemy.hexId);
    const enemyObjectiveDistance = nearestDistance(enemy.hexId, axisObjectives());
    const enemyExitDistance = nearestDistance(enemy.hexId, westExit);
    if (enemyObjectiveDistance > 11 && enemyExitDistance > 10) continue;
    if (enemyDistance === 2) score += 24 + combat * 1.6;
    else if (enemyDistance === 3) score += 12;
    else if (enemyDistance === 1) score += combat >= 4 ? 3 : -18;
    if (enemyDistance <= 5 && candidateObjectiveDistance < enemyObjectiveDistance) {
      score += Math.max(0, 6 - enemyDistance) * (assault ? 5.2 : 3.6);
    }
  }

  return clampScore(score, -180, 360);
}

function axisExitCoverageScore(state, hexId, movingUnitId = null) {
  let score = 0;
  for (const exitHexId of scenario.objectives.alliedWestExitEdge) {
    const threat = alliedExitThreat(state, exitHexId);
    if (!threat) continue;
    const alreadyCovered = isAxisExitCoveredByOther(state, exitHexId, movingUnitId);
    const exitDistance = distance(hexId, exitHexId);
    const coverageMultiplier = alreadyCovered ? 0.08 : 1;
    if (exitDistance === 0) score += threat * 4.8 * coverageMultiplier;
    else if (exitDistance === 1) score += threat * 6.4 * coverageMultiplier;
    else if (exitDistance === 2) score += threat * 0.45 * coverageMultiplier;
  }
  return score;
}

function isAxisExitCoveredByOther(state, exitHexId, movingUnitId = null) {
  return liveUnits(state.units).some((unit) => {
    if (unit.id === movingUnitId || unit.side !== "axis" || unit.disrupted) return false;
    return distance(unit.hexId, exitHexId) <= 2;
  });
}

function axisRearGuard(state, unit, hexId) {
  const westExit = scenario.objectives.alliedWestExitEdge;
  const threat = liveUnits(state.units).some((enemy) => enemy.side === "allied" && !enemy.disrupted && nearestDistance(enemy.hexId, westExit) <= 4);
  if (!threat) return 0;
  const combat = Number(unit.combat || 0);
  const guardBias = Math.max(0, 5 - combat) * 1;
  const mobilityPenalty = Number(unit.movement || 0) >= 9 ? 0.45 : 1.55;
  const distanceToExit = nearestDistance(hexId, westExit);
  let score = Math.max(0, 4 - distanceToExit) * (guardBias + mobilityPenalty) + (westExit.includes(hexId) ? 5 + guardBias * 1.2 : 0);
  const uncoveredExitThreat = westExit.reduce((sum, exitHexId) => (
    isAxisExitCoveredByOther(state, exitHexId, unit.id) ? sum : sum + alliedExitThreat(state, exitHexId)
  ), 0);
  for (const exitHexId of westExit) {
    const exitThreat = alliedExitThreat(state, exitHexId);
    if (!exitThreat) continue;
    const exitDistance = distance(hexId, exitHexId);
    const guardSuitability = Number(unit.movement || 0) >= 9 && combat >= 4 ? 0.55 : 1;
    if (exitDistance === 0) score += exitThreat * 4.2 * guardSuitability;
    else if (exitDistance === 1) score += exitThreat * 0.55 * guardSuitability;
  }
  if (combat >= 3 && Number(unit.movement || 0) >= 6 && uncoveredExitThreat < 48) score *= 0.32;
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
  const distanceToAxisObjective = nearestDistance(hexId, axisObjectives());
  const distanceToWestExit = nearestDistance(hexId, scenario.objectives.alliedWestExitEdge);
  const forwardWall = distanceToAxisObjective >= 3 && distanceToAxisObjective <= 7
    ? 16 + Math.max(0, 4 - Math.abs(distanceToAxisObjective - 5)) * 2
    : Math.max(0, 4 - distanceToAxisObjective) * 1.8;
  return forwardWall + Math.max(0, 4 - distanceToWestExit) * 0.5;
}

function alliedForwardDefense(state, unit, hexId) {
  let score = 0;
  const objectiveDistance = nearestDistance(hexId, axisObjectives());
  for (const axisUnit of liveUnits(state.units).filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted)) {
    const axisTargets = axisTargetsForUnit(axisUnit);
    const axisToObjective = nearestDistance(axisUnit.hexId, axisTargets);
    const axisDistance = distance(hexId, axisUnit.hexId);
    const hexToObjective = nearestDistance(hexId, axisTargets);
    const onApproachLane = axisDistance + hexToObjective <= axisToObjective + 2;
    if (!onApproachLane || axisDistance > 6) continue;
    if (axisDistance === 2) score += 12;
    else if (axisDistance === 3) score += 10;
    else if (axisDistance === 4) score += 6;
    else if (axisDistance === 5) score += 3;
    else if (axisDistance === 1) score -= Number(axisUnit.combat || 0) >= 6 ? 9 : 4;
    score += Math.max(0, 8 - hexToObjective) * 1.4;
  }
  if (objectiveDistance <= 8) score += Math.max(0, 9 - objectiveDistance) * 0.8;
  return score;
}

function alliedZocBarrier(state, unit, hexId) {
  let score = 0;
  const zocHexes = [hexId, ...neighborsOf(board, hexId)];
  for (const axisUnit of liveUnits(state.units).filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted)) {
    const axisTargets = axisTargetsForUnit(axisUnit);
    const axisToObjective = nearestDistance(axisUnit.hexId, axisTargets);
    let laneCoverage = 0;
    for (const zocHexId of zocHexes) {
      const axisDistance = distance(zocHexId, axisUnit.hexId);
      if (axisDistance < 2 || axisDistance > 7) continue;
      const objectiveDistance = nearestDistance(zocHexId, axisTargets);
      if (objectiveDistance > 8) continue;
      const onApproachLane = axisDistance + objectiveDistance <= axisToObjective + 3;
      if (!onApproachLane) continue;
      laneCoverage += (8 - axisDistance) * 1.7 + Math.max(0, 8 - objectiveDistance) * 0.85;
      if (objectiveDistance >= 2 && objectiveDistance <= 5) laneCoverage += 5;
    }
    score += Math.min(32, laneCoverage);
  }
  const objectiveDistance = nearestDistance(hexId, axisObjectives());
  if (objectiveDistance >= 2 && objectiveDistance <= 7) score += (8 - objectiveDistance) * 1.6;
  if (objectiveDistance <= 1) score -= 8;
  return score;
}

function alliedInterlockingZoc(state, unit, hexId) {
  const objectiveDistance = nearestDistance(hexId, axisObjectives());
  if (objectiveDistance > 9) return 0;
  let score = 0;
  for (const ally of liveUnits(state.units).filter((candidate) => candidate.side === "allied" && candidate.id !== unit.id && !candidate.disrupted)) {
    const allyObjectiveDistance = nearestDistance(ally.hexId, axisObjectives());
    if (allyObjectiveDistance > 10) continue;
    const allyDistance = distance(hexId, ally.hexId);
    if (allyDistance === 2) score += 11 + Math.min(5, Number(ally.combat || 0));
    else if (allyDistance === 3) score += 4;
    else if (allyDistance === 1) score += 1;
  }
  for (const axisUnit of liveUnits(state.units).filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted)) {
    const axisTargets = axisTargetsForUnit(axisUnit);
    const axisToObjective = nearestDistance(axisUnit.hexId, axisTargets);
    const axisDistance = distance(hexId, axisUnit.hexId);
    const hexToObjective = nearestDistance(hexId, axisTargets);
    if (axisDistance >= 2 && axisDistance <= 6 && axisDistance + hexToObjective <= axisToObjective + 3) {
      score += Math.max(0, 7 - hexToObjective) * 1.7;
    }
  }
  return Math.min(70, score);
}

function alliedRoadblock(state, unit, hexId) {
  const roadHexes = scenario.objectives.coastalRoadEast;
  const axisAssaultUnits = liveUnits(state.units).filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted);
  if (!axisAssaultUnits.length) return 0;
  const closestRoadThreat = Math.min(...axisAssaultUnits.map((axisUnit) => nearestDistance(axisUnit.hexId, roadHexes)));
  if (closestRoadThreat > 8 && state.turn <= 2) return 0;

  let score = 0;
  for (const objectiveHexId of roadHexes) {
    const objectiveThreat = Math.min(...axisAssaultUnits.map((axisUnit) => distance(axisUnit.hexId, objectiveHexId)));
    if (objectiveThreat > closestRoadThreat + 2 || objectiveThreat > 8) continue;

    const hexToObjective = distance(hexId, objectiveHexId);
    if (hexToObjective > 2) continue;

    const gatePressure = axisAssaultUnits.reduce((sum, axisUnit) => {
      const axisToObjective = distance(axisUnit.hexId, objectiveHexId);
      const axisToHex = distance(axisUnit.hexId, hexId);
      if (axisToHex > 6) return sum;
      const onApproachLane = axisToHex + hexToObjective <= axisToObjective + 1;
      if (!onApproachLane) return sum;
      return sum + Math.max(0, 8 - axisToHex) + Math.max(0, 7 - axisToObjective) * 0.7;
    }, 0);
    if (!gatePressure && hexToObjective > 0) continue;

    const currentGateCount = roadGateCount(state, objectiveHexId, unit.id);
    const need = Math.max(0, 4 - currentGateCount);
    const urgency = state.turn <= 2 ? 1.35 : state.turn === 3 ? 1.15 : 1;
    const combat = Number(unit.combat || 0);
    const occupant = liveUnitAt(state.units, objectiveHexId);
    const defenderSuitability = combat >= 4 ? 1.05 : combat >= 3 ? 0.8 : combat >= 2 ? 0.45 : 0.16;
    const blockerSuitability = combat >= 4 ? 1.12 : combat >= 2 ? 0.86 : 0.24;

    if (hexToObjective === 0) {
      if (occupant?.side === "allied" && unit.hexId === objectiveHexId) {
        score += (42 + need * 12 + combat * 4) * urgency * defenderSuitability;
      } else if (!occupant && objectiveThreat <= 5) {
        score += (38 + combat * 3) * urgency * defenderSuitability;
      }
    } else if (hexToObjective === 1) {
      score += (72 + need * 24 + gatePressure * 11 + combat * 5) * urgency * blockerSuitability;
      if (isEnemyZoc(context(state), hexId, unit.side, unit.id)) score += combat >= 3 ? 16 : combat >= 2 ? 4 : -8;
      if (combat <= 1 && hasStrongerRoadGateReserve(state, unit, hexId)) score -= 260 * urgency;
    } else if (hexToObjective === 2 && Number(unit.movement || 0) >= 7) {
      score += (16 + gatePressure * 3 + need * 5) * urgency * (combat >= 2 ? 1 : 0.55);
    }
  }
  return Math.min(340, score);
}

function alliedObjectiveGateLatch(state, unit, hexId) {
  if (unit.side !== "allied") return 0;
  const axisAssaultUnits = liveUnits(state.units).filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted);
  if (!axisAssaultUnits.length) return 0;
  let score = 0;
  for (const objectiveHexId of axisObjectives()) {
    const hexToObjective = distance(hexId, objectiveHexId);
    if (hexToObjective > 1) continue;
    const nearestAxis = axisAssaultUnits
      .map((axisUnit) => ({
        axisToObjective: distance(axisUnit.hexId, objectiveHexId),
        axisToHex: distance(axisUnit.hexId, hexId),
      }))
      .sort((a, b) => a.axisToObjective - b.axisToObjective || a.axisToHex - b.axisToHex)[0];
    if (!nearestAxis) continue;
    score += objectiveGateLatchScore({
      turn: state.turn,
      hexToObjective,
      axisToObjective: nearestAxis.axisToObjective,
      axisToHex: nearestAxis.axisToHex,
      currentGateCount: roadGateCount(state, objectiveHexId, unit.id),
      combat: Number(unit.combat || 0),
      movement: Number(unit.movement || 0),
      inEnemyZoc: isEnemyZoc(context(state), hexId, unit.side, unit.id),
      occupiedByAllied: liveUnitAt(state.units, objectiveHexId)?.side === "allied",
    });
  }
  return Math.min(520, score);
}

function alliedSupportedLine(state, unit, hexId) {
  if (unit.side !== "allied") return 0;
  const axisAssaultUnits = liveUnits(state.units).filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted);
  if (!axisAssaultUnits.length) return 0;

  let score = 0;
  const combat = Number(unit.combat || 0);
  const movement = Number(unit.movement || 0);
  for (const objectiveHexId of axisObjectives()) {
    const nearestThreat = Math.min(...axisAssaultUnits.map((axisUnit) => distance(axisUnit.hexId, objectiveHexId)));
    if (nearestThreat > 7) continue;
    const hexToObjective = distance(hexId, objectiveHexId);
    if (hexToObjective > 2) continue;
    const adjacentAllied = neighborsOf(board, hexId)
      .map((neighborId) => liveUnitAt(state.units, neighborId))
      .filter((ally) => ally && ally.side === "allied" && ally.id !== unit.id && !ally.disrupted);
    const interlockAllied = liveUnits(state.units).filter((ally) => (
      ally.side === "allied"
      && ally.id !== unit.id
      && !ally.disrupted
      && distance(hexId, ally.hexId) === 2
      && nearestDistance(ally.hexId, axisObjectives()) <= 8
    ));
    const supportStrength = adjacentAllied.reduce((sum, ally) => sum + Number(ally.combat || 0), 0);
    const lineShape = adjacentAllied.length * 16 + interlockAllied.length * 22 + Math.min(18, supportStrength * 2);
    const pressure = Math.max(0, 8 - nearestThreat);
    const screenSuitability = combat <= 2 ? 0.82 : combat >= 4 ? 1.12 : 1;
    const mobileReserve = movement >= 7 && hexToObjective === 1 ? 1.12 : 1;
    if (hexToObjective === 1) {
      score += (86 + pressure * 14 + lineShape) * screenSuitability * mobileReserve;
    } else if (hexToObjective === 2 && movement >= 7) {
      score += (36 + pressure * 8 + lineShape * 0.55) * (combat >= 3 ? 1.05 : 0.72);
    } else if (hexToObjective === 0 && adjacentAllied.length >= 2) {
      score += (28 + lineShape * 0.38) * (combat >= 3 ? 0.82 : 1);
    }
  }
  return Math.min(300, score);
}

function alliedApproachInterdiction(state, unit, hexId) {
  if (unit.side !== "allied") return 0;
  const axisAssaultUnits = liveUnits(state.units).filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted);
  if (!axisAssaultUnits.length) return 0;

  let score = 0;
  const combat = Number(unit.combat || 0);
  const movement = Number(unit.movement || 0);
  const zocHexes = [hexId, ...neighborsOf(board, hexId)];
  for (const axisUnit of axisAssaultUnits) {
    const targets = axisTargetsForUnit(axisUnit);
    const axisToObjective = nearestDistance(axisUnit.hexId, targets);
    if (axisToObjective > 9) continue;
    const candidateToObjective = nearestDistance(hexId, targets);
    if (candidateToObjective < 2 || candidateToObjective > 5) continue;
    const candidateToAxis = distance(hexId, axisUnit.hexId);
    if (candidateToAxis < 2 || candidateToAxis > 7) continue;
    if (candidateToAxis + candidateToObjective > axisToObjective + 3) continue;

    const zocCutsLane = zocHexes.some((zocHexId) => {
      const zocToAxis = distance(zocHexId, axisUnit.hexId);
      if (zocToAxis < 1 || zocToAxis > 6) return false;
      const zocToObjective = nearestDistance(zocHexId, targets);
      return zocToObjective < axisToObjective && zocToAxis + zocToObjective <= axisToObjective + 2;
    });
    if (!zocCutsLane) continue;

    const lineMates = liveUnits(state.units).filter((ally) => (
      ally.side === "allied"
      && ally.id !== unit.id
      && !ally.disrupted
      && distance(hexId, ally.hexId) >= 2
      && distance(hexId, ally.hexId) <= 3
      && nearestDistance(ally.hexId, axisObjectives()) <= 8
    )).length;
    if (lineMates === 0 && combat < 4) continue;
    if (lineMates === 0 && candidateToObjective > 3) continue;
    const depth = candidateToObjective === 3 ? 1.22 : candidateToObjective === 2 || candidateToObjective === 4 ? 1 : 0.72;
    const timing = state.turn <= 2 ? 1.12 : state.turn === 3 ? 1.08 : 0.86;
    const suitability = combat >= 4 ? 1.18 : combat >= 2 ? 1 : 0.62;
    const pressure = Math.max(0, 7 - candidateToAxis) * 10 + Math.max(0, 6 - candidateToObjective) * 8;
    score += (38 + pressure * 0.55 + Math.min(28, lineMates * 12)) * depth * timing * suitability;
    if (movement >= 7) score += 10;
    if (candidateToAxis === 2 && combat >= 3) score += 12;
  }
  return Math.min(210, score);
}

function alliedForwardScreenLine(state, unit, hexId) {
  if (unit.side !== "allied") return 0;
  const units = liveUnits(state.units);
  const axisAssaultUnits = units.filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted);
  if (!axisAssaultUnits.length) return 0;

  const combat = Number(unit.combat || 0);
  const movement = Number(unit.movement || 0);
  const zocHexes = [hexId, ...neighborsOf(board, hexId)];
  let score = 0;
  const lineMates = units.filter((ally) => (
    ally.side === "allied"
    && ally.id !== unit.id
    && !ally.disrupted
    && nearestDistance(ally.hexId, axisObjectives()) <= 9
  ));
  const interlocks = lineMates.filter((ally) => distance(hexId, ally.hexId) === 2).length;
  const looseLinks = lineMates.filter((ally) => distance(hexId, ally.hexId) === 3).length;
  const crowding = lineMates.filter((ally) => distance(hexId, ally.hexId) === 1).length;
  const lineShape = interlocks * 30 + looseLinks * 10 - crowding * 8;

  if (state.turn <= 2 && nearestDistance(hexId, axisObjectives()) <= 1) score -= 24;

  for (const axisUnit of axisAssaultUnits) {
    const targets = axisTargetsForUnit(axisUnit);
    const axisToObjective = nearestDistance(axisUnit.hexId, targets);
    const candidateToObjective = nearestDistance(hexId, targets);
    const candidateToAxis = distance(hexId, axisUnit.hexId);
    if (candidateToObjective < 2 || candidateToObjective > 7) continue;
    if (candidateToAxis < 2 || candidateToAxis > 8) continue;
    if (candidateToAxis + candidateToObjective > axisToObjective + 4) continue;

    const cutsLane = zocHexes.some((zocHexId) => {
      const zocToAxis = distance(zocHexId, axisUnit.hexId);
      const zocToObjective = nearestDistance(zocHexId, targets);
      return zocToObjective < axisToObjective && zocToAxis + zocToObjective <= axisToObjective + 2;
    });

    const depth = candidateToObjective === 4 ? 1.25
      : candidateToObjective === 5 ? 1.1
        : candidateToObjective === 3 ? 1
          : candidateToObjective === 6 ? 0.84
            : 0.64;
    const suitability = combat >= 4 ? 1.16 : combat >= 2 ? 1 : 0.62;
    const pressure = Math.max(0, 8 - candidateToAxis) * 6 + Math.max(0, 7 - candidateToObjective) * 4;
    score += ((cutsLane ? 52 : 26) + pressure + Math.min(56, lineShape)) * depth * suitability;
    if (movement >= 7 && candidateToObjective >= 3) score += 12;
    if (interlocks >= 2) score += 16;
  }

  return Math.min(360, Math.max(-60, score));
}

function alliedForwardZocWall(state, unit, hexId) {
  if (unit.side !== "allied") return 0;
  const units = liveUnits(state.units);
  const axisAssaultUnits = units.filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted);
  if (!axisAssaultUnits.length) return 0;

  const combat = Number(unit.combat || 0);
  const movement = Number(unit.movement || 0);
  const candidateObjectiveDistance = nearestDistance(hexId, axisObjectives());
  const alliedMates = units.filter((ally) => (
    ally.side === "allied"
    && ally.id !== unit.id
    && !ally.disrupted
    && nearestDistance(ally.hexId, axisObjectives()) <= 10
  ));
  const exactLinks = alliedMates.filter((ally) => distance(hexId, ally.hexId) === 2).length;
  const looseLinks = alliedMates.filter((ally) => distance(hexId, ally.hexId) === 3).length;
  const adjacentCrowd = alliedMates.filter((ally) => distance(hexId, ally.hexId) === 1).length;
  const closeCrowd = alliedMates.filter((ally) => distance(hexId, ally.hexId) <= 2).length;
  const weights = AI_HEURISTIC_WEIGHTS.alliedWall;
  let score = lineSpacingScore({
    exactLinks,
    looseLinks,
    adjacentCrowd,
    closeCrowd,
    exactWeight: weights.exactLink,
    looseWeight: weights.looseLink,
    adjacentPenalty: weights.adjacentPenalty,
    closeLimit: 4,
    closePenalty: weights.closePenalty,
  });
  if (candidateObjectiveDistance >= 3 && candidateObjectiveDistance <= 8) {
    const depthBonus = candidateObjectiveDistance === 5 ? 34
      : candidateObjectiveDistance === 6 ? 30
        : candidateObjectiveDistance === 4 ? 24
          : candidateObjectiveDistance === 7 ? 20
            : candidateObjectiveDistance === 3 ? 12
              : 6;
    score += 66 + depthBonus;
  } else if (candidateObjectiveDistance === 2) {
    score += 18;
  } else if (candidateObjectiveDistance <= 1 && state.turn <= 3) {
    score -= 118;
  }

  const zocHexes = [hexId, ...neighborsOf(board, hexId)];
  for (const axisUnit of axisAssaultUnits) {
    const targets = axisTargetsForUnit(axisUnit);
    const axisToObjective = nearestDistance(axisUnit.hexId, targets);
    if (axisToObjective > 10) continue;
    const candidateToObjective = nearestDistance(hexId, targets);
    const candidateToAxis = distance(hexId, axisUnit.hexId);
    if (candidateToObjective < 2 || candidateToObjective > 7) continue;
    if (candidateToAxis < 2 || candidateToAxis > 8) continue;
    if (candidateToAxis + candidateToObjective > axisToObjective + 4) continue;

    const blocksLane = zocHexes.some((zocHexId) => {
      const zocToAxis = distance(zocHexId, axisUnit.hexId);
      const zocToObjective = nearestDistance(zocHexId, targets);
      return zocToObjective < axisToObjective && zocToAxis + zocToObjective <= axisToObjective + 2;
    });
    const depth = candidateToObjective === 4 ? 1.28
      : candidateToObjective === 5 ? 1.18
        : candidateToObjective === 3 ? 1.08
          : candidateToObjective === 6 ? 0.92
            : 0.72;
    const suitability = combat >= 4 ? 1.2 : combat >= 2 ? 1 : 0.58;
    const contactRisk = candidateToAxis === 1 ? -36 : candidateToAxis === 2 ? 18 : 0;
    score += ((blocksLane ? 96 : 40) + Math.max(0, 8 - candidateToAxis) * 8 + exactLinks * 18 + contactRisk) * depth * suitability;
    if (movement >= 7 && candidateToObjective >= 3) score += 24;
  }

  if (!exactLinks && candidateObjectiveDistance >= 3 && candidateObjectiveDistance <= 8) score -= 34;
  if (exactLinks && adjacentCrowd === 0) score += 22;

  return clampScore(score, -140, 560);
}

function alliedSpearheadCounterattackPosition(state, unit, hexId) {
  if (unit.side !== "allied") return 0;
  const combat = Number(unit.combat || 0);
  const movement = Number(unit.movement || 0);
  let score = 0;
  for (const axisUnit of liveUnits(state.units).filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted)) {
    const objectiveDistance = nearestDistance(axisUnit.hexId, axisObjectives());
    if (objectiveDistance > 3) continue;
    const attackDistance = distance(hexId, axisUnit.hexId);
    if (attackDistance !== 1) continue;
    const existingAttackers = neighborsOf(board, axisUnit.hexId)
      .map((neighborId) => liveUnitAt(state.units, neighborId))
      .filter((ally) => ally && ally.side === "allied" && ally.id !== unit.id && !ally.disrupted);
    const supportStrength = existingAttackers.reduce((sum, ally) => sum + Number(ally.combat || 0), 0);
    const groupStrength = combat + supportStrength;
    const supportCount = existingAttackers.length;
    const oddsReady = groupStrength >= Number(axisUnit.combat || 0) * 1.4;
    const weakSolo = combat <= 2 && supportCount === 0;
    if (weakSolo || (supportCount === 0 && combat < 4)) continue;
    const urgency = state.turn >= 3 ? 1.25 : 1;
    const mobileFit = movement >= 7 ? 1.12 : 1;
    score += (28 + Math.max(0, 4 - objectiveDistance) * 24 + supportCount * 28 + Math.max(0, groupStrength - Number(axisUnit.combat || 0)) * 4.5) * urgency * mobileFit;
    if (oddsReady) score += 24;
  }
  return Math.min(190, Math.max(0, score));
}

function alliedIsolatedObjectivePenalty(state, unit, hexId) {
  if (unit.side !== "allied" || state.turn > 3) return 0;
  if (!axisObjectives().includes(hexId) || Number(unit.combat || 0) < 3) return 0;
  const axisAssaultUnits = liveUnits(state.units).filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted);
  if (!axisAssaultUnits.length) return 0;
  const nearestThreat = Math.min(...axisAssaultUnits.map((axisUnit) => distance(axisUnit.hexId, hexId)));
  if (nearestThreat > 5) return 0;
  const support = neighborsOf(board, hexId)
    .map((neighborId) => liveUnitAt(state.units, neighborId))
    .filter((ally) => ally && ally.side === "allied" && ally.id !== unit.id && !ally.disrupted);
  const supportStrength = support.reduce((sum, ally) => sum + Number(ally.combat || 0), 0);
  const nearbyAxisStrength = liveUnits(state.units)
    .filter((enemy) => isAxisAssaultUnit(enemy) && distance(enemy.hexId, hexId) <= 2)
    .reduce((sum, enemy) => sum + Number(enemy.combat || 0), 0);
  if (support.length >= 2 && supportStrength >= 4) return 0;
  return 110 + Math.max(0, nearbyAxisStrength - supportStrength) * 12 + Math.max(0, 6 - nearestThreat) * 18;
}

function hasStrongerRoadGateReserve(state, unit, hexId) {
  return liveUnits(state.units).some((candidate) => (
    candidate.side === "allied"
    && candidate.id !== unit.id
    && !candidate.disrupted
    && Number(candidate.combat || 0) >= 3
    && Number(candidate.movement || 0) >= 7
    && distance(candidate.hexId, hexId) <= Math.max(movementAllowance(state, candidate), Number(candidate.movement || 0)) + 1
  ));
}

function roadGateCount(state, objectiveHexId, movingUnitId = null) {
  return neighborsOf(board, objectiveHexId)
    .map((neighborId) => liveUnitAt(state.units, neighborId))
    .filter((ally) => ally && ally.side === "allied" && ally.id !== movingUnitId && !ally.disrupted)
    .length;
}

function alliedRidgeReserve(state, unit, hexId) {
  const ridgeHexes = scenario.objectives.alamHalfaRidge;
  const nearestAxisToRidge = nearestAxisAssaultDistance(state, ridgeHexes);
  if (nearestAxisToRidge > 7 && state.turn < 3) return 0;
  if (isAxisOnCoastalRoad(state) && nearestDistance(hexId, scenario.objectives.coastalRoadEast) > 1 && nearestDistance(unit.hexId, scenario.objectives.coastalRoadEast) <= 8) {
    return 0;
  }
  if (isCoastalRoadThreatened(state) && nearestDistance(unit.hexId, scenario.objectives.coastalRoadEast) <= 2 && nearestDistance(hexId, ridgeHexes) > 2) {
    return 0;
  }

  let score = 0;
  const reserveHex = !ridgeHexes.includes(hexId) && ridgeHexes.some((objectiveHexId) => neighborsOf(board, objectiveHexId).includes(hexId));
  if (reserveHex) {
    for (const objectiveHexId of ridgeHexes) {
      if (!neighborsOf(board, objectiveHexId).includes(hexId)) continue;
      const defenders = ridgeSupportCount(state, objectiveHexId, unit.id);
      const occupiedByAllied = liveUnitAt(state.units, objectiveHexId)?.side === "allied";
      const occupiedByAxis = liveUnitAt(state.units, objectiveHexId)?.side === "axis";
      const threat = ridgeObjectiveThreat(state, objectiveHexId);
      if (!threat && !occupiedByAxis) continue;
      const need = Math.max(0, 3 - defenders);
      const urgency = occupiedByAxis ? 2.6 : occupiedByAllied ? 1.45 : 1.05;
      score += (28 + need * 34 + Number(unit.combat || 0) * 5) * urgency;
      const nearestAxisHexId = nearestAxisAssaultHex(state, objectiveHexId);
      if (nearestAxisHexId) {
        const axisDistance = distance(nearestAxisHexId, objectiveHexId);
        const blockerDistance = distance(hexId, nearestAxisHexId);
        if (axisDistance <= 4 && blockerDistance < axisDistance && blockerDistance <= 2) {
          const immediateGate = axisDistance <= 2 && blockerDistance === 1;
          score += (immediateGate ? 190 : 82) + Math.max(0, 5 - axisDistance) * (immediateGate ? 28 : 18);
        } else if (blockerDistance === 2) {
          score += 16;
        }
      }
    }
  } else {
    const ridgeDistance = nearestDistance(hexId, ridgeHexes);
    if (ridgeDistance === 2 && Number(unit.movement || 0) >= 7) score += 22;
    else if (ridgeDistance === 2 && state.turn >= 3) score += 10;
  }
  return Math.min(360, score);
}

function ridgeObjectiveThreat(state, objectiveHexId) {
  return liveUnits(state.units).some((candidate) => (
    isAxisAssaultUnit(candidate)
    && !candidate.disrupted
    && distance(candidate.hexId, objectiveHexId) <= 5
  ));
}

function ridgeSupportCount(state, objectiveHexId, movingUnitId = null) {
  return neighborsOf(board, objectiveHexId)
    .map((neighborId) => liveUnitAt(state.units, neighborId))
    .filter((ally) => ally && ally.side === "allied" && ally.id !== movingUnitId && !ally.disrupted)
    .length;
}

function nearestAxisAssaultDistance(state, targets) {
  const distances = liveUnits(state.units)
    .filter((unit) => isAxisAssaultUnit(unit) && !unit.disrupted)
    .map((unit) => nearestDistance(unit.hexId, targets));
  return distances.length ? Math.min(...distances) : Infinity;
}

function nearestAxisAssaultHex(state, targetHexId) {
  let best = null;
  for (const unit of liveUnits(state.units).filter((candidate) => isAxisAssaultUnit(candidate) && !candidate.disrupted)) {
    const unitDistance = distance(unit.hexId, targetHexId);
    if (!best || unitDistance < best.distance) best = { hexId: unit.hexId, distance: unitDistance };
  }
  return best?.hexId || null;
}

function isCoastalRoadThreatened(state) {
  return scenario.objectives.coastalRoadEast.some((objectiveHexId) => {
    if (liveUnitAt(state.units, objectiveHexId)?.side === "axis") return true;
    return liveUnits(state.units).some((unit) => isAxisAssaultUnit(unit) && !unit.disrupted && distance(unit.hexId, objectiveHexId) <= 3);
  });
}

function isAxisOnCoastalRoad(state) {
  return scenario.objectives.coastalRoadEast.some((objectiveHexId) => liveUnitAt(state.units, objectiveHexId)?.side === "axis");
}

function alliedObjectiveCounterattack(state, unit, hexId) {
  const objectiveScores = [];
  for (const objectiveHexId of axisObjectives()) {
    let score = 0;
    const occupant = liveUnitAt(state.units, objectiveHexId);
    const axisOnObjective = occupant?.side === "axis";
    const axisThreat = axisOnObjective || liveUnits(state.units).some((candidate) => (
      isAxisAssaultUnit(candidate)
      && !candidate.disrupted
      && distance(candidate.hexId, objectiveHexId) <= 3
    ));
    if (!axisThreat) continue;
    const distanceToObjective = distance(hexId, objectiveHexId);
      if (axisOnObjective) {
        const adjacentAllied = neighborsOf(board, objectiveHexId)
          .map((neighborId) => liveUnitAt(state.units, neighborId))
          .filter((ally) => ally && ally.side === "allied" && ally.id !== unit.id && !ally.disrupted)
          .length;
        const earlyEmergency = state.turn <= 2 ? 1.35 : 1;
        if (distanceToObjective === 1) score += (132 + adjacentAllied * 28 + Number(unit.combat || 0) * 5) * earlyEmergency;
        else if (distanceToObjective === 2) score += 18 * earlyEmergency;
      } else {
      if (distanceToObjective === 0) score += 34;
      else if (distanceToObjective === 1) score += 24;
      else if (distanceToObjective === 2) score += 10;
    }
    if (score > 0) {
      const ridgeMultiplier = scenario.objectives.alamHalfaRidge.includes(objectiveHexId) ? 1.35 : 1;
      objectiveScores.push(score * ridgeMultiplier);
    }
  }
  return objectiveScores
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, score) => sum + score, 0);
}

function alliedObjectiveHold(state, unit, hexId) {
  if (unit?.side !== "allied" || alliedShouldRelieveObjectiveDefender(state, unit)) return 0;
  const currentObjective = axisObjectives().includes(unit.hexId) ? unit.hexId : null;
  if (!currentObjective || !isAxisObjectiveThreatened(state, currentObjective)) return 0;
  const ridge = scenario.objectives.alamHalfaRidge.includes(currentObjective);
  const base = ridge ? 220 : 105;
  const deadline = state.turn >= 3 ? 1.35 : 1;
  if (hexId === currentObjective) return base * deadline;
  if (neighborsOf(board, currentObjective).includes(hexId)) return (ridge ? 30 : 18) * deadline;
  return -(ridge ? 120 : 54) * deadline;
}

function alliedObjectiveRelief(state, unit, hexId) {
  if (!alliedShouldRelieveObjectiveDefender(state, unit)) return 0;
  if (hexId === unit.hexId) return -140;
  const reliefDistance = distance(hexId, unit.hexId);
  if (reliefDistance === 1) return 38;
  if (reliefDistance === 2) return 12;
  return -18;
}

function alliedShouldRelieveObjectiveDefender(state, unit) {
  return unit?.side === "allied"
    && Number(unit.combat || 0) <= 2
    && axisObjectives().includes(unit.hexId)
    && isAxisObjectiveThreatened(state, unit.hexId)
    && hasStrongerAlliedReserve(state, unit, unit.hexId);
}

function isAxisObjectiveThreatened(state, objectiveHexId) {
  const threshold = scenario.objectives.alamHalfaRidge.includes(objectiveHexId) ? 9 : 6;
  return liveUnits(state.units).some((candidate) => (
    isAxisAssaultUnit(candidate)
    && !candidate.disrupted
    && distance(candidate.hexId, objectiveHexId) <= threshold
  ));
}

function hasStrongerAlliedReserve(state, unit, objectiveHexId) {
  return liveUnits(state.units).some((candidate) => (
    candidate.side === "allied"
    && candidate.id !== unit.id
    && !candidate.disrupted
    && Number(candidate.combat || 0) > Number(unit.combat || 0)
    && (Number(candidate.combat || 0) >= 4 || Number(candidate.movement || 0) >= 8)
    && distance(candidate.hexId, objectiveHexId) <= 8
  ));
}

function alliedLineCohesion(state, unit, hexId) {
  let score = 0;
  for (const ally of liveUnits(state.units).filter((candidate) => candidate.side === "allied" && candidate.id !== unit.id && !candidate.disrupted)) {
    const allyDistance = distance(hexId, ally.hexId);
    if (allyDistance === 2) score += 3.2 + Number(ally.combat || 0) * 0.25;
    else if (allyDistance === 3) score += 1.2;
    else if (allyDistance === 1) score += 0.3;
  }
  return score;
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
    if (isHighValueAlliedUnit(unit)) value += 16 + Math.max(0, 6 - nearestDistance(unit.hexId, axisObjectives())) * 4;
  }
  if (side === "allied" && unit.side === "axis") {
    const objectiveDistance = nearestDistance(unit.hexId, axisObjectives());
    if (objectiveDistance <= 3) value += Math.max(0, 4 - objectiveDistance) * 7 + (Number(unit.combat || 0) >= 4 ? 8 : 0);
  }
  return value;
}

function isHighValueAlliedUnit(unit) {
  return unit?.side === "allied" && (Number(unit.combat || 0) >= 4 || Number(unit.movement || 0) >= 7);
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
    firstAxisObjective: state.firstAxisObjective,
    axisObjectiveDistance,
    closestAxis,
  };
}

const gameSeeds = seedList?.length ? seedList : Array.from({ length: games }, (_, index) => seed + index);
const results = gameSeeds.map((gameSeed) => playGame(gameSeed));
const wins = results.reduce((totals, result) => {
  totals[result.winner] = (totals[result.winner] || 0) + 1;
  return totals;
}, {});
const average = (key) => results.reduce((sum, result) => sum + Number(result[key] || 0), 0) / Math.max(1, results.length);
const failures = results.filter((result) => result.winner !== "axis");

const summary = {
  games: results.length,
  seed,
  seeds: seedList?.length ? gameSeeds : undefined,
  delayAxisVictory: delayAxisVictory || undefined,
  wins,
  axisWinRate: Number(((wins.axis || 0) / results.length).toFixed(3)),
  alliedWinRate: Number(((wins.allied || 0) / results.length).toFixed(3)),
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
  failures,
  samples: results.slice(0, sampleCount),
};

console.log(JSON.stringify(summary, null, 2));

if (expectAxis && failures.length) {
  console.error(`Expected Axis wins, but ${failures.length}/${results.length} games failed.`);
  process.exitCode = 1;
}
