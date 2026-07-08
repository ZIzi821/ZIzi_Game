import assert from "node:assert/strict";

import {
  ENV_ACTION,
  createBoard,
  createEnvironment,
  generateLegalActions,
  makeInitialEnvironmentState,
  neighborsOf,
} from "../../src/core/index.js";
import { DEFAULT_PHASE_SEARCH_WEIGHTS } from "../../src/app/ai-phase-search.js";
import {
  evaluatePreferenceWeights,
  extractPreferenceSamples,
  makeExpertWeightsArtifact,
  rankSampleCandidates,
  trainPreferenceWeights,
} from "../../src/app/ai-preferences.js";
import { loadLocalData } from "../fixtures/load-local-data.mjs";

const { scenario, rules } = loadLocalData();
const board = createBoard(scenario);

const objectiveHex = scenario.objectives.alamHalfaRidge[0];
const axisStart = neighborsOf(board, objectiveHex)[0];
const state = makeInitialEnvironmentState(scenario);
state.phaseIndex = 0;
state.units = [
  { id: "axis-fast", side: "axis", hexId: axisStart, combat: 6, movement: 10, disrupted: false, eliminated: false },
  { id: "allied-block", side: "allied", hexId: "c10r13", combat: 2, movement: 4, disrupted: false, eliminated: false },
];
const environment = createEnvironment({ scenario, rules, board, state });
const legalActions = generateLegalActions(environment, { includeChanceActions: false });
const objectiveAction = legalActions.find((action) => (
  action.type === ENV_ACTION.MOVE_UNIT
  && action.unitId === "axis-fast"
  && action.toHexId === objectiveHex
));

assert.ok(objectiveAction, "fixture should make objective entry legal");

const samples = extractPreferenceSamples({
  scenario,
  rules,
  board,
  events: [{
    id: "event-human-axis-move",
    mode: "axis-vs-ai",
    type: "UNIT_MOVED",
    side: "axis",
    unitId: "axis-fast",
    fromHexId: axisStart,
    toHexId: objectiveHex,
    route: objectiveAction.route,
    stateBefore: state,
    legalActionsBefore: legalActions,
  }],
});

assert.equal(samples.length, 1);
assert.equal(samples[0].positiveKey, `move:axis-fast:${objectiveHex}`);
assert.ok(samples[0].candidates.length > 1, "event extraction should retain legal alternatives");
assert.ok(samples[0].candidates.some((candidate) => candidate.features.axisObjective === 1));

const syntheticSamples = [{
  id: "synthetic-objective",
  positiveKey: "good",
  candidates: [
    { key: "bad", features: { axisObjective: 0, axisProgress: 1 } },
    { key: "good", features: { axisObjective: 1, axisProgress: 0 } },
  ],
}];
const baselineWeights = { ...DEFAULT_PHASE_SEARCH_WEIGHTS, axisObjective: 0, axisProgress: 0 };
const baseline = evaluatePreferenceWeights(syntheticSamples, baselineWeights);
assert.equal(baseline.top1Rate, 0, "synthetic baseline should rank the wrong candidate first by tie-break");

const trained = trainPreferenceWeights(syntheticSamples, {
  baseWeights: baselineWeights,
  keys: ["axisObjective"],
  iterations: 1,
  stepSizes: [256, 128, 64, 32, 16, 8, 4, 2, 1],
});
assert.equal(trained.metrics.top1Rate, 1);
assert.ok(trained.weights.axisObjective > 0);
assert.equal(rankSampleCandidates(syntheticSamples[0], trained.weights)[0].key, "good");

const artifact = makeExpertWeightsArtifact({ ...trained, sources: ["sample.json"] });
assert.equal(artifact.schema, "zizi-el-alamein-ai-weights-v1");
assert.equal(artifact.profile, "expert");
assert.equal(artifact.phaseSearch.axisObjective, trained.weights.axisObjective);

console.log("El Alamein AI preference tests passed.");
