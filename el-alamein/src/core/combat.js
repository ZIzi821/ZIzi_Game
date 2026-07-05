import { neighborsOf } from "./board.js";

export function canAttack(context, attacker, defender, options = {}) {
  const activeSide = options.activeSide ?? context.activeSide ?? null;
  const usedAttackers = options.usedAttackers ?? context.usedAttackers ?? [];
  const usedDefenders = options.usedDefenders ?? context.usedDefenders ?? [];

  if (!attacker || !defender) return false;
  if (activeSide && attacker.side !== activeSide) return false;
  if (attacker.side === defender.side) return false;
  if (attacker.disrupted || defender.disrupted) return false;
  if (usedAttackers.includes(attacker.id) || usedDefenders.includes(defender.id)) return false;
  return neighborsOf(context.board, attacker.hexId).includes(defender.hexId);
}

export function defenseBreakdown(context, unit) {
  const hex = context.board.hexById.get(unit.hexId);
  const terrain = context.rules.terrain[hex?.terrain] || context.rules.terrain.desert;
  const terrainMultiplier = Number(terrain.defenseMultiplier || 1);
  const effects = [];
  let multiplier = terrainMultiplier;
  if (terrainMultiplier > 1) effects.push({ type: "terrain", key: hex?.terrain, multiplier: terrainMultiplier });

  const positionRule = context.rules.britishPosition;
  if (hex?.britishPosition && unit.side === positionRule.appliesOnlyToSide) {
    const positionMultiplier = Number(positionRule.defenseMultiplier || 1);
    if (positionRule.stacksWithHighland) {
      multiplier *= positionMultiplier;
      effects.push({ type: "britishPosition", multiplier: positionMultiplier });
    } else if (positionMultiplier > multiplier) {
      multiplier = positionMultiplier;
      effects.length = 0;
      effects.push({ type: "britishPosition", multiplier: positionMultiplier });
    } else if (positionMultiplier > 1 && terrainMultiplier <= 1) {
      multiplier = Math.max(multiplier, positionMultiplier);
      effects.push({ type: "britishPosition", multiplier: positionMultiplier });
    }
  }

  return {
    base: unit.combat,
    multiplier,
    total: unit.combat * multiplier,
    effects,
  };
}

export function calculateOdds(context, attackers, defender) {
  const attack = attackers.reduce((sum, unit) => sum + unit.combat, 0);
  const defenseInfo = defenseBreakdown(context, defender);
  const defense = defenseInfo.total;
  const ratio = attack / Math.max(1, defense);
  const thresholds = [0.5, 1, 2, 3, 4, 5, 6];
  let columnIndex = 0;

  for (let index = 0; index < thresholds.length; index += 1) {
    if (ratio >= thresholds[index]) columnIndex = index;
  }

  return {
    attack,
    defense,
    defenseInfo,
    ratio,
    columnIndex,
    column: context.rules.crt.columns[columnIndex],
  };
}
