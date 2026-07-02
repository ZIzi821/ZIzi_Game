import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const scenario = JSON.parse(fs.readFileSync(path.join(repoRoot, "el-alamein", "local-data", "scenario.json"), "utf8"));
const rules = JSON.parse(fs.readFileSync(path.join(repoRoot, "el-alamein", "local-data", "rules.json"), "utf8"));
const hexes = scenario.board.hexes;
const hexById = new Map(hexes.map((hex) => [hex.id, hex]));

function terrainRule(hex) {
  return rules.terrain[hex?.terrain] || rules.terrain.desert;
}

function neighborsOf(hexId) {
  const hex = hexById.get(hexId);
  if (!hex) return [];
  const oddRow = Math.abs(hex.row % 2) === 1;
  const offsets = oddRow
    ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]]
    : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  return offsets
    .map(([dc, dr]) => hexes.find((candidate) => candidate.col === hex.col + dc && candidate.row === hex.row + dr)?.id)
    .filter(Boolean);
}

function isEnemyZoc(hexId, friendlySide, units, ignoreUnitId = null) {
  return units.some((unit) => {
    if (unit.id === ignoreUnitId || unit.side === friendlySide || unit.disrupted || unit.eliminated) return false;
    return neighborsOf(unit.hexId).includes(hexId);
  });
}

function reachableHexes(unit, units, allowance = unit.movement) {
  const result = new Map();
  const startInZoc = isEnemyZoc(unit.hexId, unit.side, units, unit.id);
  const queue = [{ hexId: unit.hexId, spent: 0, firstStep: true }];
  const bestSpent = new Map([[unit.hexId, 0]]);

  while (queue.length) {
    const current = queue.shift();
    const currentInZoc = isEnemyZoc(current.hexId, unit.side, units, unit.id);
    if (!current.firstStep && currentInZoc) continue;

    for (const nextId of neighborsOf(current.hexId)) {
      const nextHex = hexById.get(nextId);
      const rule = terrainRule(nextHex);
      if (!rule.passable) continue;
      const occupant = units.find((candidate) => !candidate.eliminated && candidate.hexId === nextId);
      if (occupant && occupant.side !== unit.side) continue;
      const nextInZoc = isEnemyZoc(nextId, unit.side, units, unit.id);
      if (currentInZoc && nextInZoc) continue;
      if (startInZoc && nextInZoc) continue;
      const spent = current.spent + Number(rule.movement || 1);
      if (spent > allowance) continue;
      if (bestSpent.has(nextId) && bestSpent.get(nextId) <= spent) continue;
      bestSpent.set(nextId, spent);
      if (!occupant || occupant.id === unit.id) result.set(nextId, { spent, remaining: allowance - spent });
      queue.push({ hexId: nextId, spent, firstStep: false });
    }
  }
  result.delete(unit.hexId);
  return result;
}

function hexDistance(fromId, toId) {
  if (fromId === toId) return 0;
  const queue = [{ id: fromId, distance: 0 }];
  const seen = new Set([fromId]);
  while (queue.length) {
    const current = queue.shift();
    for (const next of neighborsOf(current.id)) {
      if (seen.has(next)) continue;
      if (next === toId) return current.distance + 1;
      seen.add(next);
      queue.push({ id: next, distance: current.distance + 1 });
    }
  }
  return Infinity;
}

function legalRetreatDestinations(unit, units, requiredSteps, originHexId) {
  const result = new Set();
  const maxSteps = requiredSteps + 6;
  const seen = new Set();
  const queue = [{ hexId: unit.hexId, steps: 0 }];

  while (queue.length) {
    const current = queue.shift();
    const key = `${current.hexId}:${current.steps}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const currentDistance = hexDistance(current.hexId, originHexId);
    if (current.steps >= requiredSteps) {
      const occupant = units.find((candidate) => !candidate.eliminated && candidate.hexId === current.hexId);
      if (!occupant || occupant.id === unit.id) {
        result.add(current.hexId);
        continue;
      }
    }
    if (current.steps >= maxSteps) continue;
    for (const nextId of neighborsOf(current.hexId)) {
      const nextHex = hexById.get(nextId);
      if (!terrainRule(nextHex).passable) continue;
      const occupant = units.find((candidate) => !candidate.eliminated && candidate.hexId === nextId);
      if (occupant && occupant.side !== unit.side) continue;
      if (isEnemyZoc(nextId, unit.side, units, unit.id)) continue;
      if (hexDistance(nextId, originHexId) <= currentDistance) continue;
      queue.push({ hexId: nextId, steps: current.steps + 1 });
    }
  }
  result.delete(unit.hexId);
  return result;
}

function canAttack(attacker, defender, usedAttackers = [], usedDefenders = []) {
  if (!attacker || !defender) return false;
  if (attacker.side === defender.side) return false;
  if (attacker.disrupted || defender.disrupted) return false;
  if (usedAttackers.includes(attacker.id) || usedDefenders.includes(defender.id)) return false;
  return neighborsOf(attacker.hexId).includes(defender.hexId);
}

for (const id of ["c15r10", "c16r10"]) {
  const hex = hexById.get(id);
  assert.equal(hex.terrain, "desert", `${id} should be desert`);
  assert.equal(hex.britishPosition, false, `${id} should not be a British position`);
  assert.deepEqual(hex.objective, [], `${id} should not be an objective`);
}
assert.deepEqual(scenario.objectives.alamHalfaRidge, ["c17r10", "c18r10"]);

for (const hex of hexes) {
  for (const neighbor of neighborsOf(hex.id)) {
    assert(neighborsOf(neighbor).includes(hex.id), `${hex.id} and ${neighbor} should be symmetric neighbors`);
  }
}

const start = "c10r10";
const startNeighbors = neighborsOf(start);
const enemy = { id: "enemy", side: "allied", hexId: startNeighbors[0], disrupted: false, eliminated: false };
const mover = { id: "mover", side: "axis", hexId: start, movement: 6, disrupted: false, eliminated: false };
const directZocNeighbor = startNeighbors.find((id) => id !== enemy.hexId && neighborsOf(enemy.hexId).includes(id));
assert(directZocNeighbor, "test setup needs a second enemy-ZOC neighbor");
assert.equal(isEnemyZoc(start, "axis", [mover, enemy], "mover"), true);
assert.equal(isEnemyZoc(directZocNeighbor, "axis", [mover, enemy], "mover"), true);
assert.equal(reachableHexes(mover, [mover, enemy]).has(directZocNeighbor), false, "movement may not go directly from ZOC to ZOC");

const retreatEnemy = { id: "retreat-enemy", side: "allied", hexId: "c13r10", disrupted: false, eliminated: false };
const retreatUnit = { id: "retreater", side: "axis", hexId: "c12r10", disrupted: false, eliminated: false };
const retreats = legalRetreatDestinations(retreatUnit, [retreatUnit, retreatEnemy], 1, retreatUnit.hexId);
for (const destination of retreats) {
  assert.equal(isEnemyZoc(destination, "axis", [retreatUnit, retreatEnemy], "retreater"), false, `retreat destination ${destination} must not be in EZOC`);
}

const defender = { id: "defender", side: "allied", hexId: "c16r10", disrupted: false, eliminated: false };
const attackers = neighborsOf(defender.hexId).slice(0, 4).map((hexId, index) => ({
  id: `attacker-${index}`,
  side: "axis",
  hexId,
  disrupted: false,
  eliminated: false,
}));
assert.equal(attackers.length >= 4, true);
for (const attacker of attackers) {
  assert.equal(canAttack(attacker, defender), true, `${attacker.hexId} should be able to attack ${defender.hexId}`);
}

console.log("El Alamein rule tests passed.");
