export { createBoard, getHex, hexDistance, neighborsOf } from "./board.js";
export { terrainRule, isPassableTerrain } from "./terrain.js";
export { liveUnitAt, liveUnits, resolveUnit, unitById } from "./units.js";
export { isEnemyZoc } from "./zoc.js";
export { getReachableHexes, movementAllowance } from "./movement.js";
export { getLegalRetreatDestinations, getLegalRetreatPaths } from "./retreat.js";
export { calculateOdds, canAttack, defenseBreakdown, planCombatResult } from "./combat.js";
export { evaluateAxisObjectiveVictory, getObjectiveStatus, isAlliedBreakthroughMove } from "./victory.js";
