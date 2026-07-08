import assert from "node:assert/strict";

import {
  AI_HEURISTIC_WEIGHTS,
  alliedOperationalPlanMoveScore,
  alliedForwardWallPlaybookScore,
  axisOperationalPlanMoveScore,
  axisSpearheadPlaybookScore,
  bridgeheadSupportScore,
  combatDeclarationThreshold,
  combatOvercommitPenalty,
  finalGateScreenScore,
  finalApproachTempoScore,
  forcedRetreatObjectiveDenialScore,
  forcedRetreatTrapScore,
  lineSpacingScore,
  localAttackOvermassPenalty,
  objectiveEntrySecurityScore,
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

const redundantSpearheadCrowd = localAttackOvermassPenalty({
  attackerSide: "axis",
  candidateCombat: 6,
  candidateMovement: 10,
  defense: 2,
  otherAttackStrength: 8,
  otherAdjacentAttackers: 2,
  trappedExitCount: 0,
});
const neededExactAttacker = localAttackOvermassPenalty({
  attackerSide: "axis",
  candidateCombat: 6,
  candidateMovement: 10,
  defense: 2,
  otherAttackStrength: 2,
  otherAdjacentAttackers: 1,
  trappedExitCount: 3,
});
assert.ok(
  redundantSpearheadCrowd > 900 && neededExactAttacker === 0,
  "Axis spearheads should leave already sealed 4:1 attacks instead of piling on",
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

assert.ok(
  forcedRetreatObjectiveDenialScore({
    controllerSide: "allied",
    retreatingSide: "axis",
    isAxisObjective: true,
    axisObjectiveDistance: 0,
  }) < -2000,
  "Allied forced retreat control must not push Axis units onto objective hexes",
);

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

const secureObjectiveEntry = objectiveEntrySecurityScore({
  isObjective: true,
  turn: 3,
  combat: 6,
  supportStrength: 8,
  adjacentSupportCount: 2,
  counterattackThreat: 6,
});
const exposedObjectiveEntry = objectiveEntrySecurityScore({
  isObjective: true,
  turn: 3,
  combat: 6,
  supportStrength: 0,
  adjacentSupportCount: 0,
  counterattackThreat: 12,
});
assert.ok(
  secureObjectiveEntry > 300 && exposedObjectiveEntry < -700,
  "Axis AI should prefer secure objective entries over unsupported rushes",
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

const urgentFinalGate = finalGateScreenScore({
  turn: 4,
  hexToObjective: 1,
  axisToObjective: 3,
  axisToHex: 2,
  gateCount: 1,
  lineLinks: 2,
  zocCutsLane: true,
  combat: 4,
  movement: 8,
});
const isolatedFinalGate = finalGateScreenScore({
  turn: 4,
  hexToObjective: 1,
  axisToObjective: 3,
  axisToHex: 2,
  gateCount: 1,
  lineLinks: 0,
  zocCutsLane: false,
  combat: 2,
  movement: 4,
});
assert.ok(
  urgentFinalGate > isolatedFinalGate * 2,
  "late Allied defense should seal objective gates with linked ZOC instead of isolated blockers",
);

const spearheadBreakthrough = axisSpearheadPlaybookScore({
  turn: 3,
  currentFocusDistance: 6,
  candidateFocusDistance: 2,
  currentObjectiveDistance: 6,
  candidateObjectiveDistance: 3,
  movement: 10,
  combat: 4,
  isAssault: true,
  encirclementScore: 420,
  lineLinks: 2,
  remainingMovement: 2,
});
const driftingEncirclement = axisSpearheadPlaybookScore({
  turn: 3,
  currentFocusDistance: 4,
  candidateFocusDistance: 4,
  currentObjectiveDistance: 3,
  candidateObjectiveDistance: 6,
  movement: 10,
  combat: 4,
  isAssault: true,
  encirclementScore: 420,
  lineLinks: 1,
  remainingMovement: 1,
});
assert.ok(
  spearheadBreakthrough > driftingEncirclement + 700,
  "Axis playbook should use encirclement to open the objective road, not chase away from it",
);

const forwardWall = alliedForwardWallPlaybookScore({
  turn: 2,
  hexToObjective: 6,
  axisToObjective: 7,
  axisToHex: 3,
  onApproachLane: true,
  lineLinks: 2,
  zocCutsLane: true,
  combat: 4,
  movement: 8,
});
const objectiveHug = alliedForwardWallPlaybookScore({
  turn: 2,
  hexToObjective: 1,
  axisToObjective: 7,
  axisToHex: 6,
  onApproachLane: true,
  lineLinks: 0,
  zocCutsLane: false,
  combat: 4,
  movement: 8,
});
assert.ok(
  forwardWall > objectiveHug * 3,
  "Allied playbook should build a linked forward ZOC wall instead of sitting on the objective",
);

const axisPlannedPocket = axisOperationalPlanMoveScore({
  turn: 3,
  role: "spearhead",
  currentFocusDistance: 6,
  candidateFocusDistance: 3,
  currentObjectiveDistance: 7,
  candidateObjectiveDistance: 4,
  movement: 10,
  combat: 6,
  lineLinks: 2,
  currentTrapExits: 3,
  candidateTrapExits: 0,
  targetValue: 64,
});
const axisOffPlanPocket = axisOperationalPlanMoveScore({
  turn: 3,
  role: "spearhead",
  currentFocusDistance: 4,
  candidateFocusDistance: 6,
  currentObjectiveDistance: 4,
  candidateObjectiveDistance: 7,
  movement: 10,
  combat: 6,
  lineLinks: 1,
  currentTrapExits: 3,
  candidateTrapExits: 0,
  targetValue: 64,
});
assert.ok(
  axisPlannedPocket > axisOffPlanPocket + 800,
  "Axis operational plan should encircle on the breakthrough line instead of chasing away from objectives",
);

const releasedAxisScreen = axisOperationalPlanMoveScore({
  turn: 2,
  role: "screen",
  currentFocusDistance: 9,
  candidateFocusDistance: 7,
  currentObjectiveDistance: 10,
  candidateObjectiveDistance: 8,
  movement: 6,
  combat: 3,
  lineLinks: 2,
  westExitDistance: 5,
  westExitThreat: 12,
});
const wastedAxisScreen = axisOperationalPlanMoveScore({
  turn: 2,
  role: "screen",
  currentFocusDistance: 9,
  candidateFocusDistance: 10,
  currentObjectiveDistance: 10,
  candidateObjectiveDistance: 11,
  movement: 6,
  combat: 3,
  lineLinks: 1,
  westExitDistance: 1,
  westExitThreat: 12,
});
assert.ok(
  releasedAxisScreen > wastedAxisScreen + 350,
  "Axis screen units should release forward when the west exit is not under serious threat",
);

const riskyZocLock = axisOperationalPlanMoveScore({
  turn: 3,
  role: "spearhead",
  currentFocusDistance: 5,
  candidateFocusDistance: 4,
  currentObjectiveDistance: 5,
  candidateObjectiveDistance: 3,
  movement: 10,
  combat: 6,
  lineLinks: 1,
  inEnemyZoc: true,
  ownEscapeExits: 1,
});
const cleanApproach = axisOperationalPlanMoveScore({
  turn: 3,
  role: "spearhead",
  currentFocusDistance: 5,
  candidateFocusDistance: 4,
  currentObjectiveDistance: 5,
  candidateObjectiveDistance: 3,
  movement: 10,
  combat: 6,
  lineLinks: 1,
  inEnemyZoc: false,
  ownEscapeExits: 5,
});
assert.ok(
  cleanApproach > riskyZocLock + 400,
  "Axis spearheads should avoid being locked in enemy ZOC before they are close enough to the objective",
);

const alliedPlannedWall = alliedOperationalPlanMoveScore({
  turn: 2,
  role: "wall",
  hexToObjective: 6,
  axisToObjective: 7,
  axisToHex: 3,
  onApproachLane: true,
  lineLinks: 2,
  zocCutsLane: true,
  combat: 4,
  movement: 8,
});
const alliedLateObjectiveHug = alliedOperationalPlanMoveScore({
  turn: 2,
  role: "wall",
  hexToObjective: 1,
  axisToObjective: 7,
  axisToHex: 6,
  onApproachLane: true,
  lineLinks: 0,
  zocCutsLane: false,
  combat: 4,
  movement: 8,
});
assert.ok(
  alliedPlannedWall > alliedLateObjectiveHug + 250,
  "Allied operational plan should prefer a forward linked wall over early objective hugging",
);

console.log("El Alamein AI heuristic tests passed.");
