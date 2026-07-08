import assert from "node:assert/strict";

import {
  choiceKey,
  flattenTrainingEvents,
  flattenTrainingLogs,
  summarizeTrainingEntries,
  summarizeTrainingEvents,
  trainingSchemaGaps,
} from "../../src/app/ai-training.js";

const entries = flattenTrainingLogs([{
  path: "sample-a.json",
  entries: [
    {
      id: "m1",
      action: "move",
      turn: 1,
      phaseId: "axis-move",
      side: "axis",
      stateHash: "abc",
      unit: { id: "u23" },
      fromHexId: "c06r18",
      humanChoice: { hexId: "c10r16", score: 10 },
      aiChoice: { hexId: "c07r17", score: 40 },
      aiTopChoices: [{ hexId: "c07r17" }, { hexId: "c10r16" }],
      legalChoiceCount: 12,
      scoreDelta: -30,
    },
    {
      id: "c1",
      action: "combat-declaration",
      turn: 1,
      phaseId: "axis-combat",
      side: "axis",
      defender: { id: "u01" },
      humanChoice: { defenderId: "u01", attackerIds: ["u23", "u24"], score: 90 },
      aiChoice: { defenderId: "u01", attackerIds: ["u23"], score: 20 },
      scoreDelta: 70,
    },
    {
      id: "r1",
      action: "retreat",
      turn: 1,
      phaseId: "axis-combat",
      controllerSide: "axis",
      unit: { id: "u23" },
      humanChoice: { hexId: "c09r16" },
      aiChoice: { hexId: "c08r17" },
      legalChoiceCount: 3,
    },
  ],
}]);

assert.equal(entries.length, 3);
assert.equal(entries[0].__source, "sample-a.json");
assert.equal(choiceKey({ defenderId: "u01", attackerIds: ["u24", "u23"] }), "combat:u01:u23+u24");

const summary = summarizeTrainingEntries(entries);
assert.equal(summary.entries, 3);
assert.deepEqual(summary.actions, { move: 1, "combat-declaration": 1, retreat: 1 });
assert.equal(summary.movement.top3Rate, 1);
assert.equal(summary.movement.aiAboveHuman, 1);
assert.equal(summary.combat.humanAboveAi, 1);
assert.equal(summary.retreat.mismatches, 1);
assert.equal(summary.worstMovementDivergences[0].id, "m1");
assert.equal(summary.worstCombatDivergences[0].id, "c1");

const gaps = trainingSchemaGaps(entries);
assert.equal(gaps.missingStateSnapshot, 3);
assert.equal(gaps.missingLegalActions, 3);
assert.equal(gaps.missingDiceOrCombatResult, 1);
assert.equal(gaps.missingWinner, 3);
assert.equal(gaps.missingStateHash, 2);

const events = flattenTrainingEvents([{
  path: "sample-events.json",
  events: [
    {
      type: "GAME_STARTED",
      turn: 1,
      phaseId: "axis-move",
      stateHashAfter: "h1",
      legalActionsBefore: [],
      legalActionsAfter: [{ type: "MOVE_UNIT" }],
      metricsAfter: { turn: 1 },
      stateAfter: { turn: 1 },
    },
    {
      type: "COMBAT_RESOLVED",
      turn: 1,
      phaseId: "axis-combat",
      stateHashBefore: "h1",
      stateHashAfter: "h2",
      legalActionsBefore: [{ type: "RESOLVE_COMBAT" }],
      legalActionsAfter: [{ type: "RETREAT_UNIT" }],
      metricsBefore: { turn: 1 },
      metricsAfter: { turn: 1 },
      stateBefore: { turn: 1 },
      stateAfter: { turn: 1 },
      dieRoll: 4,
      result: "DR2",
    },
  ],
}]);
const eventSummary = summarizeTrainingEvents(events);
assert.equal(eventSummary.events, 2);
assert.deepEqual(eventSummary.types, { GAME_STARTED: 1, COMBAT_RESOLVED: 1 });
assert.equal(eventSummary.stateHashCoverage, 1);
assert.equal(eventSummary.legalActionCoverage, 1);
assert.equal(eventSummary.diceEvents, 1);
assert.equal(eventSummary.missingReplayFields.combatResolvedMissingDice, 0);

console.log("El Alamein AI training tests passed.");
