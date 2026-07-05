import { neighborsOf } from "./board.js";
import { liveUnits } from "./units.js";

export function isEnemyZoc(context, hexId, friendlySide, ignoreUnitId = null) {
  const { board, units } = context;

  return liveUnits(units).some((unit) => {
    if (unit.id === ignoreUnitId) return false;
    if (unit.side === friendlySide) return false;
    if (unit.disrupted) return false;
    return neighborsOf(board, unit.hexId).includes(hexId);
  });
}
