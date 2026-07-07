import assert from "node:assert/strict";

import {
  AI_HEURISTIC_WEIGHTS,
  bridgeheadSupportScore,
  combatDeclarationThreshold,
  combatOvercommitPenalty,
  finalApproachTempoScore,
  forcedRetreatTrapScore,
  lineSpacingScore,
  objectiveGateLatchScore,
  objectiveRetreatHoldScore,
  roadApproachScreenScore,
} from "../../src/app/ai-heuristics.js";

const axisLine = AI_HEURISTIC_WEIGHTS.axisLine;
const twoHexLineScore = lineSpacingScore({
  exactLinks: 2,
  looseLinks: 1,
  adjacentCrowd: 1,
  closeCrowd: 2,
  exactWeight: axisLine.exactSupport,
  looseWeight: axisLine.looseSupport,
  adjacentPenalty: axisLine.adjacentSupportPenalty,
  closeLimit: 3,
  closePenalty: axisLine.closeSupportPenalty,
});
assert.ok(
  twoHexLineScore > 100,
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

const bloatedLowOddsCounterattack = combatOvercommitPenalty({
  attackerSide: "allied",
  attackStrength: 15,
  defense: 6,
  oddsColumnIndex: 2,
  attackerCount: 6,
  attackerStrengths: [4, 4, 2, 2, 2, 1],
  mobileUnits: 4,
});
assert.ok(
  bloatedLowOddsCounterattack > 800,
  "low-odds counterattacks should not strip the line with a six-unit stack",
);

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

const supportedObjectiveRetreat = objectiveRetreatHoldScore({
  isObjective: true,
  combat: 6,
  supportStrength: 8,
  adjacentSupportCount: 2,
  counterattackThreat: 5,
});
const exposedObjectiveRetreat = objectiveRetreatHoldScore({
  isObjective: true,
  combat: 6,
  supportStrength: 0,
  adjacentSupportCount: 0,
  counterattackThreat: 12,
});
assert.ok(
  supportedObjectiveRetreat > exposedObjectiveRetreat + 400,
  "Axis AI should avoid retreating onto an exposed objective bridgehead",
);

const urgentBridgeheadSupport = bridgeheadSupportScore({
  turn: 3,
  hexToObjective: 1,
  objectiveHeld: true,
  currentSupportCount: 0,
  alliedThreat: 8,
  combat: 4,
  movement: 6,
  lineLinks: 1,
});
const distantBridgeheadSupport = bridgeheadSupportScore({
  turn: 3,
  hexToObjective: 3,
  objectiveHeld: true,
  currentSupportCount: 0,
  alliedThreat: 8,
  combat: 4,
  movement: 6,
  lineLinks: 1,
});
assert.ok(
  urgentBridgeheadSupport > 250 && distantBridgeheadSupport === 0,
  "Axis AI should pull useful units next to an exposed objective bridgehead",
);

const forwardRoadScreen = roadApproachScreenScore({
  turn: 2,
  hexToRoad: 5,
  axisToRoad: 6,
  axisToHex: 3,
  zocCutsLane: true,
  lineLinks: 2,
  combat: 4,
  movement: 8,
});
const isolatedRoadScreen = roadApproachScreenScore({
  turn: 2,
  hexToRoad: 5,
  axisToRoad: 6,
  axisToHex: 3,
  zocCutsLane: false,
  lineLinks: 0,
  combat: 2,
  movement: 4,
});
assert.ok(
  forwardRoadScreen > isolatedRoadScreen * 2,
  "Allied AI should prefer interlocked ZOC screens forward of the road objective",
);

console.log("El Alamein AI heuristic tests passed.");
