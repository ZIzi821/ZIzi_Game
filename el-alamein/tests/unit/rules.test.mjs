import assert from "node:assert/strict";

import {
  calculateOdds,
  canAttack,
  createBoard,
  defenseBreakdown,
  evaluateAxisObjectiveVictory,
  getLegalRetreatDestinations,
  getObjectiveStatus,
  getReachableHexes,
  hexDistance,
  isEnemyZoc,
  isAlliedBreakthroughMove,
  neighborsOf,
  planCombatResult,
  terrainRule,
} from "../../src/core/index.js";
import { loadLocalData } from "../fixtures/load-local-data.mjs";

const { scenario, rules } = loadLocalData();
const board = createBoard(scenario);
const hexes = board.hexes;
const context = (units = [], state = { turn: 1 }) => ({ board, rules, scenario, units, state });

for (const id of ["c15r10", "c16r10"]) {
  const hex = board.hexById.get(id);
  assert.equal(hex.terrain, "desert", `${id} should be desert`);
  assert.equal(hex.britishPosition, false, `${id} should not be a British position`);
  assert.deepEqual(hex.objective, [], `${id} should not be an objective`);
}
assert.deepEqual(scenario.objectives.alamHalfaRidge, ["c17r10", "c18r10"]);

for (const id of ["c13r11", "c14r11", "c18r08", "c19r08"]) {
  const hex = board.hexById.get(id);
  assert.equal(hex.terrain, "desert", `${id} should remain ordinary desert`);
  assert.equal(hex.britishPosition, false, `${id} should not be a British position`);
}

for (const id of ["c10r08", "c12r08", "c13r08", "c18r09", "c19r09"]) {
  assert.equal(board.hexById.get(id).terrain, "highland", `${id} should be high ground`);
  assert.equal(terrainRule(rules, board.hexById.get(id)).movement, 2, `${id} should cost 2 MP to enter`);
}

assert.equal(board.hexById.get("c10r08").britishPosition, true, "c10r08 should be a British position");
assert.equal(board.hexById.get("c10r13").terrain, "desert", "c10r13 position uses underlying desert movement");
assert.equal(board.hexById.get("c10r13").britishPosition, true, "c10r13 should be a British position");
assert.equal(board.hexById.get("c12r03").terrain, "settlement", "El Alamein should be settlement terrain");
assert.equal(terrainRule(rules, board.hexById.get("c12r03")).movement, 1, "settlements should cost 1 MP to enter");

assert.equal(defenseBreakdown(context(), { side: "allied", hexId: "c10r08", combat: 2 }).total, 4, "high ground plus British position should not stack beyond x2");
assert.equal(defenseBreakdown(context(), { side: "allied", hexId: "c10r13", combat: 2 }).total, 4, "British position should double Allied defense");
assert.equal(defenseBreakdown(context(), { side: "axis", hexId: "c10r13", combat: 2 }).total, 2, "British position should not double Axis defense");
assert.equal(defenseBreakdown(context(), { side: "axis", hexId: "c10r08", combat: 2 }).total, 4, "high ground should double either side's defense");
assert.equal(defenseBreakdown(context(), { side: "axis", hexId: "c12r03", combat: 2 }).total, 4, "settlement should double either side's defense");
assert.equal(
  calculateOdds(context(), [{ combat: 4 }, { combat: 2 }], { side: "allied", hexId: "c10r08", combat: 2 }).column,
  "1:1",
  "odds should use doubled high-ground/position defense",
);

for (const hex of hexes) {
  for (const neighbor of neighborsOf(board, hex.id)) {
    assert(neighborsOf(board, neighbor).includes(hex.id), `${hex.id} and ${neighbor} should be symmetric neighbors`);
  }
}

const start = "c10r10";
const startNeighbors = neighborsOf(board, start);
const enemy = { id: "enemy", side: "allied", hexId: startNeighbors[0], disrupted: false, eliminated: false };
const mover = { id: "mover", side: "axis", hexId: start, movement: 6, disrupted: false, eliminated: false };
const zocContext = context([mover, enemy]);
const directZocNeighbor = startNeighbors.find((id) => id !== enemy.hexId && neighborsOf(board, enemy.hexId).includes(id));
assert(directZocNeighbor, "test setup needs a second enemy-ZOC neighbor");
assert.equal(isEnemyZoc(zocContext, start, "axis", "mover"), true);
assert.equal(isEnemyZoc(zocContext, directZocNeighbor, "axis", "mover"), true);
assert.equal(getReachableHexes(zocContext, mover, mover.movement).has(directZocNeighbor), false, "movement may not go directly from ZOC to ZOC");
for (const destination of getReachableHexes(zocContext, mover, mover.movement).keys()) {
  assert.equal(isEnemyZoc(zocContext, destination, "axis", "mover"), false, `movement from EZOC may not enter EZOC at ${destination}`);
}

const retreatEnemy = { id: "retreat-enemy", side: "allied", hexId: "c13r10", disrupted: false, eliminated: false };
const retreatUnit = { id: "retreater", side: "axis", hexId: "c12r10", disrupted: false, eliminated: false };
const retreatContext = context([retreatUnit, retreatEnemy]);
const retreats = getLegalRetreatDestinations(retreatContext, retreatUnit, 1, retreatUnit.hexId);
for (const destination of retreats) {
  assert.equal(isEnemyZoc(retreatContext, destination, "axis", "retreater"), false, `retreat destination ${destination} must not be in EZOC`);
}

const defender = { id: "defender", side: "allied", hexId: "c16r10", disrupted: false, eliminated: false };
const attackers = neighborsOf(board, defender.hexId).slice(0, 4).map((hexId, index) => ({
  id: `attacker-${index}`,
  side: "axis",
  hexId,
  disrupted: false,
  eliminated: false,
}));
assert.equal(attackers.length >= 4, true);
for (const attacker of attackers) {
  assert.equal(canAttack(context(), attacker, defender), true, `${attacker.hexId} should be able to attack ${defender.hexId}`);
}
const selectedAttackers = [];
for (const attacker of attackers) {
  if (canAttack(context(), attacker, defender)) selectedAttackers.push(attacker.id);
}
assert.deepEqual(selectedAttackers, attackers.map((attacker) => attacker.id), "four adjacent attackers should all be selectable for one declared combat");

assert.equal(hexDistance(board, start, start), 0, "distance to self should be zero");
assert.equal(hexDistance(board, start, startNeighbors[0]), 1, "adjacent hex distance should be one");
const combatBattle = {
  id: "battle-1",
  attackerIds: ["attacker-0", "attacker-1"],
  attackerOrigins: { "attacker-0": attackers[0].hexId, "attacker-1": attackers[1].hexId },
  defenderId: defender.id,
  defenderHexId: defender.hexId,
};
const combatContext = context([...attackers.slice(0, 2), defender]);
assert.deepEqual(
  planCombatResult(combatContext, combatBattle, "AE"),
  {
    result: "AE",
    eliminatedUnitIds: ["attacker-0", "attacker-1"],
    retreatTask: null,
    resolveBattle: true,
    archiveBattle: true,
    startAdvance: false,
  },
  "AE should eliminate all committed attackers and resolve the battle",
);
assert.deepEqual(
  planCombatResult(combatContext, combatBattle, "DE"),
  {
    result: "DE",
    eliminatedUnitIds: [defender.id],
    retreatTask: null,
    resolveBattle: true,
    archiveBattle: true,
    startAdvance: true,
  },
  "DE should eliminate the defender, resolve the battle, and allow advance",
);
assert.deepEqual(
  planCombatResult(context([{ ...attackers[0], eliminated: true }, attackers[1], defender]), combatBattle, "AR").retreatTask,
  {
    unitIds: ["attacker-1"],
    steps: 1,
    result: "AR",
    origins: combatBattle.attackerOrigins,
    disruptAfterRetreat: false,
    advanceAfter: false,
  },
  "AR should retreat only live attackers without post-retreat disruption",
);
assert.deepEqual(
  planCombatResult(combatContext, combatBattle, "DR3").retreatTask,
  {
    unitIds: [defender.id],
    steps: 3,
    result: "DR3",
    origins: { [defender.id]: defender.hexId },
    disruptAfterRetreat: true,
    advanceAfter: true,
  },
  "DR results should retreat and disrupt the live defender, then allow advance",
);

const ridgeAxis = { id: "ridge-axis", side: "axis", hexId: scenario.objectives.alamHalfaRidge[0], disrupted: false, eliminated: false };
const roadAxis = { id: "road-axis", side: "axis", hexId: "c13r04", disrupted: false, eliminated: false };
const alliedBlocker = { id: "ridge-allied", side: "allied", hexId: scenario.objectives.alamHalfaRidge[1], disrupted: false, eliminated: false };
assert.deepEqual(
  evaluateAxisObjectiveVictory(context([ridgeAxis])),
  { side: "axis", reason: "ridge", unitId: "ridge-axis", hexId: ridgeAxis.hexId, type: null },
  "Axis ridge occupation should be the first automatic objective victory",
);
assert.deepEqual(
  evaluateAxisObjectiveVictory(context([roadAxis])),
  { side: "axis", reason: "road", unitId: "road-axis", hexId: roadAxis.hexId, type: null },
  "Axis coastal road occupation should be an automatic objective victory",
);
assert.equal(evaluateAxisObjectiveVictory(context([{ ...roadAxis, side: "allied" }])), null, "Allied units on Axis objectives should not trigger Axis victory");

const ridgeStatus = getObjectiveStatus(context([ridgeAxis]));
assert.equal(ridgeStatus.ridgeControl, true, "Axis occupation should control the ridge objective");
assert.equal(ridgeStatus.ridgeFullControl, true, "Axis ZOC should count toward full ridge control when no Allied unit occupies the other ridge hex");
assert.deepEqual(ridgeStatus.ridgeOccupiedHexes, [ridgeAxis.hexId], "objective status should list Axis-occupied ridge hexes");
const blockedRidgeStatus = getObjectiveStatus(context([ridgeAxis, alliedBlocker]));
assert.equal(blockedRidgeStatus.ridgeFullControl, false, "Allied occupation should prevent full Axis ridge control");

const roadStatus = getObjectiveStatus(context([roadAxis, { ...roadAxis, id: "el-alamein-axis", hexId: "c12r03" }]));
assert.equal(roadStatus.roadCut, true, "Axis occupation east of El Alamein should count as a road cut");
assert.equal(roadStatus.elAlameinOccupied, true, "Axis occupation of c12r03 should be tracked separately");

assert.equal(isAlliedBreakthroughMove(context(), { side: "allied" }, scenario.objectives.alliedWestExitEdge[0], 1), true, "Allied units exiting west with movement remaining should win");
assert.equal(isAlliedBreakthroughMove(context(), { side: "allied" }, scenario.objectives.alliedWestExitEdge[0], 0), false, "Allied west-edge movement with no remaining movement should not win");
assert.equal(isAlliedBreakthroughMove(context(), { side: "axis" }, scenario.objectives.alliedWestExitEdge[0], 1), false, "Axis units cannot trigger Allied breakthrough victory");
