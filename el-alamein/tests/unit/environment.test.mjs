import assert from "node:assert/strict";

import {
  ENV_ACTION,
  ENV_EVENT,
  applyEnvironmentAction,
  createBoard,
  createEnvironment,
  evaluateEnvironmentVictory,
  generateLegalActions,
  makeInitialEnvironmentState,
  neighborsOf,
  restorePreviousState,
  stateHash,
} from "../../src/core/index.js";
import { loadLocalData } from "../fixtures/load-local-data.mjs";

const { scenario, rules } = loadLocalData();
const board = createBoard(scenario);

function makeEnvironment(state = null) {
  return createEnvironment({ scenario, rules, board, state });
}

const openingEnvironment = makeEnvironment();
const openingHash = stateHash(openingEnvironment);
const openingActions = generateLegalActions(openingEnvironment);
const openingMove = openingActions.find((action) => action.type === ENV_ACTION.MOVE_UNIT && action.unitId === "u23");

assert.ok(openingActions.some((action) => action.type === ENV_ACTION.END_PHASE), "movement phase should expose legal phase end");
assert.ok(openingMove, "environment should generate legal opening movement actions from core movement rules");

const illegalMove = applyEnvironmentAction(openingEnvironment, {
  type: ENV_ACTION.MOVE_UNIT,
  unitId: "u23",
  toHexId: "c24r00",
});
assert.equal(illegalMove.ok, false, "environment should reject moves not produced by legal movement generation");
assert.equal(stateHash(openingEnvironment), openingHash, "failed actions must not mutate the original environment");

const moved = applyEnvironmentAction(openingEnvironment, openingMove);
assert.equal(moved.ok, true, "generated movement action should apply successfully");
assert.notEqual(moved.state.units.find((unit) => unit.id === "u23").hexId, openingEnvironment.state.units.find((unit) => unit.id === "u23").hexId);
assert.equal(stateHash(openingEnvironment), openingHash, "apply without mutate should leave the source state unchanged");
assert.equal(stateHash({ ...openingEnvironment, state: restorePreviousState(moved) }), openingHash, "previousState should be enough to undo a searched action");
assert.equal(moved.events[0].type, ENV_EVENT.UNIT_MOVED);
assert.ok(moved.events[0].stateHashBefore && moved.events[0].stateHashAfter, "events should carry replay state hashes");
assert.ok(moved.events[0].legalActionsBefore.length > 0, "events should carry the legal action list before the action");
assert.ok(moved.events[0].metricsBefore.objectiveStatus, "events should carry key metrics before and after the action");

const defenderHex = "c12r10";
const [attackerHexA, attackerHexB] = neighborsOf(board, defenderHex);
const combatState = makeInitialEnvironmentState(scenario);
combatState.phaseIndex = 1;
combatState.units = [
  { id: "axis-a", side: "axis", hexId: attackerHexA, combat: 4, movement: 6, disrupted: false, eliminated: false },
  { id: "axis-b", side: "axis", hexId: attackerHexB, combat: 4, movement: 6, disrupted: false, eliminated: false },
  { id: "allied-d", side: "allied", hexId: defenderHex, combat: 1, movement: 4, disrupted: false, eliminated: false },
];
const combatEnvironment = makeEnvironment(combatState);
const combatActions = generateLegalActions(combatEnvironment);
const twoUnitAttack = combatActions.find((action) => (
  action.type === ENV_ACTION.DECLARE_COMBAT
  && action.defenderId === "allied-d"
  && action.attackerIds.length === 2
));
assert.ok(twoUnitAttack, "combat generation should include coordinated multi-unit legal attacks");

const declared = applyEnvironmentAction(combatEnvironment, twoUnitAttack);
assert.equal(declared.ok, true);
assert.equal(declared.events[0].type, ENV_EVENT.COMBAT_DECLARED);
assert.deepEqual(declared.state.usedAttackers.sort(), ["axis-a", "axis-b"]);

const resolvingEnvironment = makeEnvironment(declared.state);
const finishedDeclarations = applyEnvironmentAction(resolvingEnvironment, { type: ENV_ACTION.FINISH_DECLARATIONS });
assert.equal(finishedDeclarations.ok, true);

const resolvedEnvironment = makeEnvironment(finishedDeclarations.state);
const resolved = applyEnvironmentAction(resolvedEnvironment, {
  type: ENV_ACTION.RESOLVE_COMBAT,
  battleId: resolvedEnvironment.state.declaredCombats[0].id,
  dieRoll: 6,
});
assert.equal(resolved.ok, true);
assert.ok(resolved.events.some((event) => event.type === ENV_EVENT.COMBAT_RESOLVED && event.dieRoll === 6), "combat resolution should record injected dice");
assert.ok(resolved.events.some((event) => event.type === ENV_EVENT.UNIT_ELIMINATED && event.unitId === "allied-d"), "DE should eliminate the defender through the shared combat result plan");
assert.equal(resolved.state.advanceTask.targetHexId, defenderHex, "defender elimination should create a legal advance task");

const advanceEnvironment = makeEnvironment(resolved.state);
const advanceAction = generateLegalActions(advanceEnvironment).find((action) => action.type === ENV_ACTION.ADVANCE_UNIT);
const advanced = applyEnvironmentAction(advanceEnvironment, advanceAction);
assert.equal(advanced.ok, true);
assert.equal(advanced.events[0].type, ENV_EVENT.UNIT_ADVANCED);
assert.equal(advanced.state.units.find((unit) => unit.id === advanceAction.unitId).hexId, defenderHex);

const objectiveState = makeInitialEnvironmentState(scenario);
objectiveState.units = [
  { id: "axis-objective", side: "axis", hexId: scenario.objectives.alamHalfaRidge[0], combat: 4, movement: 6, disrupted: false, eliminated: false },
];
objectiveState.phaseIndex = 0;
assert.equal(evaluateEnvironmentVictory(makeEnvironment(objectiveState)), null, "Axis objective occupation must not win before the end-of-full-turn gate");

objectiveState.phaseIndex = rules.phases.length - 1;
objectiveState.combatMode = "resolve";
const endTurnEnvironment = makeEnvironment(objectiveState);
const endTurn = applyEnvironmentAction(endTurnEnvironment, { type: ENV_ACTION.END_PHASE });
assert.equal(endTurn.ok, true);
assert.equal(endTurn.state.winner.side, "axis");
assert.ok(endTurn.events.some((event) => event.type === ENV_EVENT.GAME_ENDED), "end-turn objective victory should emit a game end event");

console.log("El Alamein environment tests passed.");
