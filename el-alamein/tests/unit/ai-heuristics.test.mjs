import assert from "node:assert/strict";

import {
  AI_HEURISTIC_WEIGHTS,
  combatDeclarationThreshold,
  combatOvercommitPenalty,
  finalApproachTempoScore,
  forcedRetreatTrapScore,
  lineSpacingScore,
  objectiveGateLatchScore,
} from "../../src/app/ai-heuristics.js";

const axisLine = AI_HEURISTIC_WEIGHTS.axisLine;
assert.equal(
  lineSpacingScore({
    exactLinks: 2,
    looseLinks: 1,
    adjacentCrowd: 1,
    closeCrowd: 2,
    exactWeight: axisLine.exactSupport,
    looseWeight: axisLine.looseSupport,
    adjacentPenalty: axisLine.adjacentSupportPenalty,
    closeLimit: 3,
    closePenalty: axisLine.closeSupportPenalty,
  }),
  81,
  "line spacing should reward two-hex ZOC links more than adjacent crowding",
);

const efficientFourToOne = combatOvercommitPenalty({
  attackerSide: "axis",
  attackStrength: 8,
  defense: 2,
  oddsColumnIndex: 4,
  attackerCount: 1,
  attackerStrengths: [8],
  mobileUnits: 1,
});
assert.equal(efficientFourToOne, 0, "exact 4:1 attack should not be penalized");

const overstackedSixToOne = combatOvercommitPenalty({
  attackerSide: "axis",
  attackStrength: 12,
  defense: 2,
  oddsColumnIndex: 6,
  attackerCount: 3,
  attackerStrengths: [4, 4, 4],
  mobileUnits: 3,
  surrounded: true,
});
assert.ok(overstackedSixToOne > 400, "surrounded target should still punish wasting extra mobile attackers past 4:1");

const finalApproachPush = finalApproachTempoScore({
  turn: 3,
  currentDistance: 5,
  candidateDistance: 2,
});
assert.ok(finalApproachPush > 350, "late Axis spearheads should be rewarded for closing to assault distance");

const finalApproachHold = finalApproachTempoScore({
  turn: 4,
  currentDistance: 3,
  candidateDistance: 3,
});
assert.ok(finalApproachHold < 0, "final-turn spearheads should not hold outside the objective perimeter");

assert.ok(
  combatDeclarationThreshold({ side: "axis", turn: 1 }) > combatDeclarationThreshold({ side: "axis", turn: 4 }),
  "Axis combat threshold should preserve spearheads early and relax on the final turn",
);

const urgentGateLatch = objectiveGateLatchScore({
  turn: 2,
  hexToObjective: 1,
  axisToObjective: 3,
  axisToHex: 2,
  currentGateCount: 1,
  combat: 4,
  movement: 8,
  inEnemyZoc: true,
});
assert.ok(urgentGateLatch > 300, "Allied AI should strongly prefer adjacent gate latches against a near spearhead");

assert.equal(
  objectiveGateLatchScore({ turn: 2, hexToObjective: 3, axisToObjective: 3, axisToHex: 2, combat: 4 }),
  0,
  "gate latch scoring should only affect objective and adjacent gate hexes",
);

const sealedRetreat = forcedRetreatTrapScore({
  retreatExitCount: 0,
  adjacentControllerStrength: 6,
  controllerZocCount: 3,
  enemyObjectiveDistance: 5,
  highValueEnemy: true,
});
const openRetreat = forcedRetreatTrapScore({
  retreatExitCount: 4,
  adjacentControllerStrength: 1,
  controllerZocCount: 0,
  enemyObjectiveDistance: 5,
  highValueEnemy: true,
});
assert.ok(sealedRetreat > openRetreat * 2, "forced retreat control should prefer sealed ZOC traps over merely distant retreats");

console.log("El Alamein AI heuristic tests passed.");
