import assert from "node:assert/strict";

import {
  ENV_ACTION,
  createBoard,
  createEnvironment,
  generateLegalActions,
  makeInitialEnvironmentState,
  neighborsOf,
} from "../../src/core/index.js";
import {
  TACTICAL_REASON,
  actionAllowsOpponentImmediateWin,
  combatEliminationProfile,
  findImmediateTacticalAction,
} from "../../src/app/ai-tactics.js";
import { loadLocalData } from "../fixtures/load-local-data.mjs";

const { scenario, rules } = loadLocalData();
const board = createBoard(scenario);

function makeEnvironment(state) {
  return createEnvironment({ scenario, rules, board, state });
}

const alliedBreakthroughState = makeInitialEnvironmentState(scenario);
alliedBreakthroughState.turn = 2;
alliedBreakthroughState.phaseIndex = 2;
alliedBreakthroughState.units = [
  {
    id: "allied-breaker",
    side: "allied",
    hexId: neighborsOf(board, scenario.objectives.alliedWestExitEdge[0]).find((hexId) => !scenario.objectives.alliedWestExitEdge.includes(hexId)),
    combat: 4,
    movement: 8,
    disrupted: false,
    eliminated: false,
  },
];
const alliedBreakthroughEnvironment = makeEnvironment(alliedBreakthroughState);
const alliedBreakthrough = findImmediateTacticalAction(
  alliedBreakthroughEnvironment,
  generateLegalActions(alliedBreakthroughEnvironment).filter((action) => action.type === ENV_ACTION.MOVE_UNIT),
);
assert.equal(alliedBreakthrough.reason, TACTICAL_REASON.DIRECT_WIN, "scanner should take an Allied immediate breakthrough move");
assert.equal(alliedBreakthrough.result.side, "allied");

const objectiveHex = scenario.objectives.alamHalfaRidge[0];
const objectiveStart = neighborsOf(board, objectiveHex).find((hexId) => hexId !== scenario.objectives.alamHalfaRidge[1]);
const axisObjectiveState = makeInitialEnvironmentState(scenario);
axisObjectiveState.phaseIndex = 0;
axisObjectiveState.units = [
  {
    id: "axis-spearhead",
    side: "axis",
    hexId: objectiveStart,
    combat: 6,
    movement: 10,
    disrupted: false,
    eliminated: false,
  },
];
const axisObjectiveEnvironment = makeEnvironment(axisObjectiveState);
const axisObjectiveTactic = findImmediateTacticalAction(
  axisObjectiveEnvironment,
  generateLegalActions(axisObjectiveEnvironment).filter((action) => action.type === ENV_ACTION.MOVE_UNIT),
);
assert.equal(axisObjectiveTactic.reason, TACTICAL_REASON.AXIS_OBJECTIVE_PENDING, "scanner should detect Axis objective occupation as a pending end-turn win");
assert.equal(axisObjectiveTactic.action.toHexId, objectiveHex);

const defenderHex = "c12r10";
const defenderNeighbors = neighborsOf(board, defenderHex);
const pocketState = makeInitialEnvironmentState(scenario);
pocketState.phaseIndex = 1;
pocketState.units = [
  { id: "allied-pocket", side: "allied", hexId: defenderHex, combat: 2, movement: 4, disrupted: false, eliminated: false },
  ...defenderNeighbors.map((hexId, index) => ({
    id: `axis-ring-${index}`,
    side: "axis",
    hexId,
    combat: 2,
    movement: 6,
    disrupted: false,
    eliminated: false,
  })),
];
const pocketEnvironment = makeEnvironment(pocketState);
const pocketActions = generateLegalActions(pocketEnvironment).filter((action) => action.type === ENV_ACTION.DECLARE_COMBAT);
const pocketTactic = findImmediateTacticalAction(pocketEnvironment, pocketActions);
assert.ok(
  [TACTICAL_REASON.GUARANTEED_DEFENDER_ELIMINATION, TACTICAL_REASON.SEALED_RETREAT_ELIMINATION].includes(pocketTactic.reason),
  "scanner should prefer attacks that turn DR results into no-retreat eliminations",
);
const pocketProfile = combatEliminationProfile(pocketEnvironment, pocketTactic.action);
assert.equal(pocketProfile.guaranteedDefenderElimination, true, "fully surrounded defender should be eliminated by every CRT result that affects the defender");

const exitEdgeState = makeInitialEnvironmentState(scenario);
exitEdgeState.phaseIndex = 1;
exitEdgeState.units = [
  {
    id: "allied-exit",
    side: "allied",
    hexId: scenario.objectives.alliedWestExitEdge[0],
    combat: 1,
    movement: 4,
    disrupted: false,
    eliminated: false,
  },
];
const exitEdgeEnvironment = makeEnvironment(exitEdgeState);
assert.equal(
  actionAllowsOpponentImmediateWin(exitEdgeEnvironment, { type: ENV_ACTION.END_PHASE }, { side: "axis" }),
  true,
  "scanner should flag an end phase that lets Allied movement immediately break through",
);

console.log("El Alamein AI tactics tests passed.");
