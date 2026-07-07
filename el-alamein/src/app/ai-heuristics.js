export const AI_HEURISTIC_WEIGHTS = Object.freeze({
  axisLine: Object.freeze({
    exactAssault: 34,
    exactSupport: 52,
    looseAssault: 5,
    looseSupport: 9,
    adjacentAssaultPenalty: 18,
    adjacentSupportPenalty: 32,
    closeAssaultPenalty: 48,
    closeSupportPenalty: 72,
    densePenalty: 46,
  }),
  alliedWall: Object.freeze({
    exactLink: 60,
    looseLink: 9,
    adjacentPenalty: 20,
    closePenalty: 54,
  }),
  overcommit: Object.freeze({
    excessColumn: 180,
    extraAttacker: 190,
    axisTempo: 1.5,
    surrounded: 2.2,
    axisMobileWaste: 105,
    alliedMobileWaste: 40,
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
  if (oddsColumnIndex < 4) return 0;
  const targetStrength = Math.max(1, defense) * 4;
  const excessStrength = Math.max(0, attackStrength - targetStrength);
  const excessColumn = Math.max(0, oddsColumnIndex - 4);
  const minimumAttackers = minimumAttackersForStrength(attackerStrengths, targetStrength);
  const extraAttackers = minimumAttackers ? Math.max(0, attackerCount - minimumAttackers) : 0;
  if (excessStrength <= 1 && excessColumn === 0 && extraAttackers === 0) return 0;

  const weights = AI_HEURISTIC_WEIGHTS.overcommit;
  const mobileWaste = Math.max(0, mobileUnits - 1);
  const mobilePenalty = attackerSide === "axis" ? weights.axisMobileWaste : weights.alliedMobileWaste;
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
