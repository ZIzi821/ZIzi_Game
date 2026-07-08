import assert from "node:assert/strict";

import {
  ENV_ACTION,
  createBoard,
  createEnvironment,
  makeInitialEnvironmentState,
  neighborsOf,
  stateHash,
} from "../../src/core/index.js";
import { beamSearchMovementPhase, phaseEndProjectionScore } from "../../src/app/ai-phase-search.js";
import { loadLocalData } from "../fixtures/load-local-data.mjs";

const { scenario, rules } = loadLocalData();
const board = createBoard(scenario);

function makeEnvironment(state) {
  return createEnvironment({ scenario, rules, board, state });
}

const objectiveHex = scenario.objectives.alamHalfaRidge[0];
const axisStart = neighborsOf(board, objectiveHex).find((hexId) => hexId !== scenario.objectives.alamHalfaRidge[1]);
const axisState = makeInitialEnvironmentState(scenario);
axisState.phaseIndex = 0;
axisState.units = [
  { id: "axis-fast", side: "axis", hexId: axisStart, combat: 6, movement: 10, disrupted: false, eliminated: false },
  { id: "axis-support", side: "axis", hexId: "c06r18", combat: 4, movement: 10, disrupted: false, eliminated: false },
  { id: "allied-block", side: "allied", hexId: "c10r13", combat: 2, movement: 4, disrupted: false, eliminated: false },
];
const axisEnvironment = makeEnvironment(axisState);
const axisHash = stateHash(axisEnvironment);
const axisPlan = beamSearchMovementPhase(axisEnvironment, {
  side: "axis",
  beamWidth: 6,
  candidateLimit: 10,
  maxActions: 3,
});

assert.ok(axisPlan.actions.length >= 1, "beam search should produce at least one movement action");
assert.equal(axisPlan.actions[0].type, ENV_ACTION.MOVE_UNIT);
assert.ok(
  axisPlan.actions.some((action) => action.unitId === "axis-fast" && action.toHexId === objectiveHex),
  "Axis beam search should include the objective-entry move when it is legal",
);
assert.equal(stateHash(axisEnvironment), axisHash, "beam search must not mutate the source environment");

const alliedState = makeInitialEnvironmentState(scenario);
alliedState.turn = 2;
alliedState.phaseIndex = 2;
alliedState.units = [
  { id: "axis-threat", side: "axis", hexId: "c12r13", combat: 6, movement: 10, disrupted: false, eliminated: false },
  { id: "allied-wall-a", side: "allied", hexId: "c18r10", combat: 2, movement: 4, disrupted: false, eliminated: false },
  { id: "allied-wall-b", side: "allied", hexId: "c21r08", combat: 2, movement: 4, disrupted: false, eliminated: false },
];
const alliedEnvironment = makeEnvironment(alliedState);
const alliedPlan = beamSearchMovementPhase(alliedEnvironment, {
  side: "allied",
  beamWidth: 8,
  candidateLimit: 12,
  maxActions: 2,
});

assert.ok(alliedPlan.actions.every((action) => action.type === ENV_ACTION.MOVE_UNIT), "movement beam should contain only legal movement actions");
assert.ok(alliedPlan.score > -10000, "Allied beam search should return a valid defensive movement plan");

const pocketDefenderHex = "c12r10";
const pocketNeighbors = neighborsOf(board, pocketDefenderHex);
const combatProjectionState = makeInitialEnvironmentState(scenario);
combatProjectionState.phaseIndex = 0;
combatProjectionState.units = [
  { id: "allied-pocket", side: "allied", hexId: pocketDefenderHex, combat: 2, movement: 4, disrupted: false, eliminated: false },
  ...pocketNeighbors.map((hexId, index) => ({
    id: `axis-ring-${index}`,
    side: "axis",
    hexId,
    combat: 2,
    movement: 6,
    disrupted: false,
    eliminated: false,
  })),
];
const combatProjection = phaseEndProjectionScore(makeEnvironment(combatProjectionState), {
  side: "axis",
  candidateLimit: 20,
});
assert.ok(
  combatProjection.score > 1000,
  "phase projection should reward movement plans that lead into no-retreat combat eliminations",
);
assert.match(combatProjection.reason, /projected_/);

const exitEdgeThreatState = makeInitialEnvironmentState(scenario);
exitEdgeThreatState.phaseIndex = 0;
exitEdgeThreatState.units = [
  { id: "axis-idle", side: "axis", hexId: "c10r12", combat: 2, movement: 4, disrupted: false, eliminated: false },
  { id: "allied-exit", side: "allied", hexId: scenario.objectives.alliedWestExitEdge[0], combat: 1, movement: 4, disrupted: false, eliminated: false },
];
const exitProjection = phaseEndProjectionScore(makeEnvironment(exitEdgeThreatState), {
  side: "axis",
  candidateLimit: 20,
});
assert.ok(
  exitProjection.score < -1000,
  "phase projection should penalize plans that let Allied immediately win after Axis passes combat",
);
assert.match(exitProjection.reason, /opponent_immediate_win/);

console.log("El Alamein AI phase search tests passed.");
