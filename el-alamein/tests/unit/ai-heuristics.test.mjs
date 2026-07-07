import assert from "node:assert/strict";

import {
  AI_HEURISTIC_WEIGHTS,
  combatOvercommitPenalty,
  lineSpacingScore,
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

console.log("El Alamein AI heuristic tests passed.");
