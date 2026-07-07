export const AI_HEURISTIC_WEIGHTS = Object.freeze({
  axisLine: Object.freeze({
    exactAssault: 44,
    exactSupport: 70,
    looseAssault: 7,
    looseSupport: 12,
    adjacentAssaultPenalty: 24,
    adjacentSupportPenalty: 42,
    closeAssaultPenalty: 64,
    closeSupportPenalty: 92,
    densePenalty: 64,
  }),
  alliedWall: Object.freeze({
    exactLink: 84,
    looseLink: 12,
    adjacentPenalty: 34,
    closePenalty: 86,
  }),
  overcommit: Object.freeze({
    excessColumn: 260,
    extraAttacker: 260,
    axisTempo: 1.5,
    surrounded: 2.7,
    axisMobileWaste: 180,
    alliedMobileWaste: 70,
  }),
  finalApproach: Object.freeze({
    turnThreeGain: 90,
    finalTurnGain: 185,
    turnThreeNear: 185,
    finalTurnNear: 460,
    turnThreeHoldPenalty: 54,
    finalTurnHoldPenalty: 170,
  }),
  combatThreshold: Object.freeze({
    axisEarly: 90,
    axisAssault: 64,
    axisFinal: 8,
    allied: 5.1,
  }),
  objectiveGateLatch: Object.freeze({
    adjacentBase: 92,
    occupyBase: 42,
    urgency: 34,
    missingGate: 28,
    lanePressure: 16,
    combat: 8,
    mobile: 18,
    zoc: 18,
  }),
  forcedRetreat: Object.freeze({
    sealed: 260,
    oneExit: 150,
    twoExit: 72,
    adjacentStrength: 16,
    zocCount: 24,
    objectiveDistance: 7,
    exitDistance: 7,
    highValueMultiplier: 1.24,
  }),
  objectiveRetreat: Object.freeze({
    objectiveBonus: 88,
    selfCombat: 10,
    supportStrength: 18,
    adjacentSupport: 38,
    counterThreat: 24,
    unsupportedPenalty: 190,
  }),
  bridgeheadSupport: Object.freeze({
    base: 42,
    missingSupport: 46,
    alliedThreat: 7.5,
    combat: 4.8,
    mobile: 18,
    lineLink: 18,
  }),
  roadScreen: Object.freeze({
    base: 54,
    laneCut: 78,
    pressure: 8,
    roadPressure: 7,
    lineLink: 28,
    noLinkPenalty: 32,
    combat: 5.2,
    mobile: 20,
  }),
});

export function clampScore(score, min, max) {
  return Math.min(max, Math.max(min, score));
}

export function lineSpacingScore({
  exactLinks = 0,
  looseLinks = 0,
  adjacentCrowd = 0,
  closeCrowd = 0,
  denseCrowd = 0,
  exactWeight = 0,
  looseWeight = 0,
  adjacentPenalty = 0,
  closeLimit = 3,
  closePenalty = 0,
  denseLimit = 5,
  densePenalty = 0,
  looseLimit = 2,
}) {
  let score = exactLinks * exactWeight + Math.min(looseLimit, looseLinks) * looseWeight - adjacentCrowd * adjacentPenalty;
  if (closeCrowd >= closeLimit) score -= (closeCrowd - closeLimit + 1) * closePenalty;
  if (denseCrowd >= denseLimit) score -= (denseCrowd - denseLimit + 1) * densePenalty;
  return score;
}

export function minimumAttackersForStrength(strengths, targetStrength) {
  let total = 0;
  let count = 0;
  for (const strength of strengths.slice().sort((a, b) => b - a)) {
    total += strength;
    count += 1;
    if (total >= targetStrength) break;
  }
  return total >= targetStrength ? count : 0;
}

export function combatOvercommitPenalty({
  attackerSide,
  attackStrength,
  defense,
  oddsColumnIndex,
  attackerCount,
  attackerStrengths,
  mobileUnits,
  surrounded = false,
  earlyNoExtraRelief = 1,
}) {
  const weights = AI_HEURISTIC_WEIGHTS.overcommit;
  const mobilePenalty = attackerSide === "axis" ? weights.axisMobileWaste : weights.alliedMobileWaste;
  if (oddsColumnIndex < 4) {
    const bloatedAttackers = Math.max(0, attackerCount - 3);
    const mobileWaste = Math.max(0, mobileUnits - 1);
    const lowOddsRisk = 1 + Math.max(0, 3 - oddsColumnIndex) * 0.45;
    const tempo = attackerSide === "axis" ? weights.axisTempo : 1.15;
    return (bloatedAttackers * weights.extraAttacker * 0.85 + mobileWaste * mobilePenalty * 0.95) * lowOddsRisk * tempo;
  }
  const targetStrength = Math.max(1, defense) * 4;
  const excessStrength = Math.max(0, attackStrength - targetStrength);
  const excessColumn = Math.max(0, oddsColumnIndex - 4);
  const minimumAttackers = minimumAttackersForStrength(attackerStrengths, targetStrength);
  const extraAttackers = minimumAttackers ? Math.max(0, attackerCount - minimumAttackers) : 0;
  if (excessStrength <= 1 && excessColumn === 0 && extraAttackers === 0) return 0;

  const mobileWaste = Math.max(0, mobileUnits - 1);
  const extraStrengthPenalty = surrounded ? 22 : 14;
  const earlyTempoRelief = extraAttackers === 0 ? earlyNoExtraRelief : 1;
  const tempo = attackerSide === "axis" ? weights.axisTempo : 1;
  const surround = surrounded ? weights.surrounded : 1;
  return (
    Math.max(0, excessStrength - 1) * extraStrengthPenalty
    + excessColumn * weights.excessColumn
    + extraAttackers * weights.extraAttacker
    + mobileWaste * mobilePenalty
  ) * earlyTempoRelief * surround * tempo;
}

export function finalApproachTempoScore({
  turn,
  currentDistance,
  candidateDistance,
  objectiveHeld = false,
  weights = AI_HEURISTIC_WEIGHTS.finalApproach,
}) {
  if (objectiveHeld || turn < 3 || currentDistance > 7 || candidateDistance > currentDistance + 1) return 0;
  const finalTurn = turn >= 4;
  const gain = Math.max(0, currentDistance - candidateDistance);
  let score = gain * (finalTurn ? weights.finalTurnGain : weights.turnThreeGain);
  if (candidateDistance <= 1) score += finalTurn ? weights.finalTurnNear : weights.turnThreeNear;
  else if (candidateDistance === 2) score += finalTurn ? weights.finalTurnNear * 0.68 : weights.turnThreeNear * 0.62;
  else if (candidateDistance === 3) score += finalTurn ? weights.finalTurnNear * 0.32 : weights.turnThreeNear * 0.34;
  if (gain === 0 && currentDistance <= 5 && candidateDistance > 1) {
    score -= finalTurn ? weights.finalTurnHoldPenalty : weights.turnThreeHoldPenalty;
  }
  return score;
}

export function combatDeclarationThreshold({
  side,
  turn,
  weights = AI_HEURISTIC_WEIGHTS.combatThreshold,
}) {
  if (side !== "axis") return weights.allied;
  if (turn <= 2) return weights.axisEarly;
  if (turn === 3) return weights.axisAssault;
  return weights.axisFinal;
}

export function objectiveGateLatchScore({
  turn,
  hexToObjective,
  axisToObjective,
  axisToHex,
  currentGateCount = 0,
  combat = 0,
  movement = 0,
  inEnemyZoc = false,
  occupiedByAllied = false,
  weights = AI_HEURISTIC_WEIGHTS.objectiveGateLatch,
}) {
  if (hexToObjective > 1 || axisToObjective > 6 || axisToHex > axisToObjective + 1) return 0;
  const urgent = Math.max(0, 6 - axisToObjective) * weights.urgency;
  const missingGate = Math.max(0, 3 - currentGateCount) * weights.missingGate;
  const lanePressure = Math.max(0, 7 - axisToHex) * weights.lanePressure;
  const combatFit = Number(combat || 0) * weights.combat;
  const mobileFit = Number(movement || 0) >= 7 ? weights.mobile : 0;
  const zocFit = inEnemyZoc ? weights.zoc : 0;
  if (hexToObjective === 0) {
    return occupiedByAllied ? weights.occupyBase + urgent * 0.45 + combatFit : 0;
  }
  return weights.adjacentBase + urgent + missingGate + lanePressure + combatFit + mobileFit + zocFit;
}

export function forcedRetreatTrapScore({
  retreatExitCount = 6,
  adjacentControllerStrength = 0,
  controllerZocCount = 0,
  enemyObjectiveDistance = 0,
  enemyExitDistance = 0,
  highValueEnemy = false,
  weights = AI_HEURISTIC_WEIGHTS.forcedRetreat,
}) {
  const exitScore = retreatExitCount <= 0
    ? weights.sealed
    : retreatExitCount === 1
      ? weights.oneExit
      : retreatExitCount === 2
        ? weights.twoExit
        : Math.max(0, 4 - retreatExitCount) * 18;
  const localTrap = Math.min(12, Number(adjacentControllerStrength || 0)) * weights.adjacentStrength
    + Math.min(4, Number(controllerZocCount || 0)) * weights.zocCount;
  const positionalDenial = Math.min(10, Math.max(0, Number(enemyObjectiveDistance || 0))) * weights.objectiveDistance
    + Math.min(12, Math.max(0, Number(enemyExitDistance || 0))) * weights.exitDistance;
  const score = exitScore + localTrap + positionalDenial;
  return highValueEnemy ? score * weights.highValueMultiplier : score;
}

export function objectiveRetreatHoldScore({
  isObjective = false,
  combat = 0,
  supportStrength = 0,
  adjacentSupportCount = 0,
  counterattackThreat = 0,
  weights = AI_HEURISTIC_WEIGHTS.objectiveRetreat,
}) {
  if (!isObjective) return 0;
  const support = Number(supportStrength || 0) * weights.supportStrength
    + Number(adjacentSupportCount || 0) * weights.adjacentSupport;
  const threat = Number(counterattackThreat || 0) * weights.counterThreat;
  const unsupported = adjacentSupportCount <= 0 && counterattackThreat > Number(combat || 0) + Number(supportStrength || 0)
    ? weights.unsupportedPenalty
    : 0;
  return weights.objectiveBonus + Number(combat || 0) * weights.selfCombat + support - threat - unsupported;
}

export function bridgeheadSupportScore({
  turn = 1,
  hexToObjective = Infinity,
  objectiveHeld = false,
  currentSupportCount = 0,
  alliedThreat = 0,
  combat = 0,
  movement = 0,
  lineLinks = 0,
  weights = AI_HEURISTIC_WEIGHTS.bridgeheadSupport,
}) {
  if (turn < 3 || hexToObjective <= 0 || hexToObjective > 2) return 0;
  const need = Math.max(0, (objectiveHeld ? 3 : 2) - Number(currentSupportCount || 0));
  if (!objectiveHeld && need <= 0 && Number(alliedThreat || 0) <= 0) return 0;
  const distanceFit = hexToObjective === 1 ? 1 : 0.46;
  const urgency = turn >= 4 ? 1.28 : 1;
  const unitFit = Number(combat || 0) >= 4 ? 1.16 : Number(combat || 0) >= 2 ? 1 : 0.58;
  const mobileFit = Number(movement || 0) >= 6 ? weights.mobile : 0;
  const score = weights.base
    + need * weights.missingSupport
    + Math.min(16, Number(alliedThreat || 0)) * weights.alliedThreat
    + Number(combat || 0) * weights.combat
    + Math.min(3, Number(lineLinks || 0)) * weights.lineLink
    + mobileFit;
  return score * distanceFit * urgency * unitFit;
}

export function roadApproachScreenScore({
  turn = 1,
  hexToRoad = Infinity,
  axisToRoad = Infinity,
  axisToHex = Infinity,
  zocCutsLane = false,
  lineLinks = 0,
  combat = 0,
  movement = 0,
  weights = AI_HEURISTIC_WEIGHTS.roadScreen,
}) {
  if (hexToRoad < 3 || hexToRoad > 7) return 0;
  if (axisToRoad > 10 || axisToHex < 2 || axisToHex > 8) return 0;
  if (axisToHex + hexToRoad > axisToRoad + 4) return 0;

  const depthFit = hexToRoad === 5 ? 1.25
    : hexToRoad === 4 ? 1.15
      : hexToRoad === 6 ? 1
        : hexToRoad === 3 ? 0.78
          : 0.62;
  const timing = turn <= 2 ? 1.18 : turn === 3 ? 1.08 : 0.84;
  const unitFit = Number(combat || 0) >= 4 ? 1.18 : Number(combat || 0) >= 2 ? 1 : 0.58;
  const pressure = Math.max(0, 9 - Number(axisToHex || 0)) * weights.pressure
    + Math.max(0, 8 - Number(axisToRoad || 0)) * weights.roadPressure;
  const lineShape = Math.min(3, Number(lineLinks || 0)) * weights.lineLink
    - (lineLinks > 0 ? 0 : weights.noLinkPenalty);
  const score = weights.base
    + (zocCutsLane ? weights.laneCut : 0)
    + pressure
    + lineShape
    + Number(combat || 0) * weights.combat
    + (Number(movement || 0) >= 7 ? weights.mobile : 0);
  return Math.max(0, score * depthFit * timing * unitFit);
}
