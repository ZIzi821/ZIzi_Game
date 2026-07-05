import { neighborsOf } from "./board.js";
import { terrainRule } from "./terrain.js";
import { isEnemyZoc } from "./zoc.js";
import { liveUnitAt, resolveUnit } from "./units.js";

export function movementAllowance(state, unit, rules) {
  let movement = Number(unit?.movement || 0);
  if (unit?.side === "allied" && state?.turn === 1) {
    movement = Math.max(1, Math.floor(movement * Number(rules?.firstTurnAlliedMovementMultiplier || 1)));
  }
  return movement;
}

export function getReachableHexes(context, unitOrId, allowance = null) {
  const { board, rules, units, state } = context;
  const unit = resolveUnit(units, unitOrId);
  if (!unit) return new Map();

  const moveAllowance = allowance ?? movementAllowance(state, unit, rules);
  const startHexId = unit.hexId;
  const result = new Map();
  const startInZoc = isEnemyZoc(context, startHexId, unit.side, unit.id);
  const queue = [{ hexId: startHexId, spent: 0, firstStep: true, path: [startHexId] }];
  const bestSpent = new Map([[startHexId, 0]]);

  while (queue.length) {
    const current = queue.shift();
    const currentInZoc = isEnemyZoc(context, current.hexId, unit.side, unit.id);
    if (!current.firstStep && currentInZoc) continue;

    for (const nextId of neighborsOf(board, current.hexId)) {
      const nextHex = board.hexById.get(nextId);
      const rule = terrainRule(rules, nextHex);
      if (!rule.passable) continue;

      const occupant = liveUnitAt(units, nextId);
      if (occupant && occupant.side !== unit.side) continue;

      const nextInZoc = isEnemyZoc(context, nextId, unit.side, unit.id);
      if (currentInZoc && nextInZoc) continue;
      if (startInZoc && nextInZoc) continue;

      const spent = current.spent + Number(rule.movement || 1);
      if (spent > moveAllowance) continue;
      if (bestSpent.has(nextId) && bestSpent.get(nextId) <= spent) continue;

      bestSpent.set(nextId, spent);
      const remaining = moveAllowance - spent;
      const path = current.path.concat(nextId);
      if (!occupant || occupant.id === unit.id) result.set(nextId, { spent, remaining, path });
      queue.push({ hexId: nextId, spent, firstStep: false, path });
    }
  }

  result.delete(startHexId);
  return result;
}
