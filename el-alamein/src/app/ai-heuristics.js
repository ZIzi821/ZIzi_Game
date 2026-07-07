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
