import assert from "node:assert/strict";

import { createBoard, neighborsOf, terrainRule } from "../../src/core/index.js";
import { loadLocalData } from "../fixtures/load-local-data.mjs";

const { scenario, rules } = loadLocalData();
const board = createBoard(scenario);

assert.equal(scenario.format, "zizi-el-alamein-scenario", "scenario format should be explicit");
assert.equal(rules.format, "zizi-el-alamein-rules", "rules format should be explicit");
assert.ok(Array.isArray(board.hexes) && board.hexes.length > 0, "scenario should define board hexes");
assert.ok(Array.isArray(scenario.units) && scenario.units.length > 0, "scenario should define units");
assert.ok(Array.isArray(rules.phases) && rules.phases.length > 0, "rules should define phases");
assert.ok(Array.isArray(rules.crt.columns) && rules.crt.columns.length > 0, "CRT should define columns");

assert.equal(board.hexById.size, board.hexes.length, "hex ids should be unique");
assert.equal(new Set(scenario.units.map((unit) => unit.id)).size, scenario.units.length, "unit ids should be unique");

for (const [row, results] of Object.entries(rules.crt.rows)) {
  assert.match(row, /^[1-6]$/, `CRT row ${row} should be a die face`);
  assert.equal(results.length, rules.crt.columns.length, `CRT row ${row} should match column count`);
  for (const result of results) {
    assert.match(result, /^(AE|AR|DE|DR[1-4])$/, `CRT result ${result} should be a known combat result`);
  }
}

for (const hex of board.hexes) {
  assert.equal(typeof hex.id, "string", "hex should have an id");
  assert.equal(typeof hex.col, "number", `${hex.id} should have a numeric col`);
  assert.equal(typeof hex.row, "number", `${hex.id} should have a numeric row`);
  assert.ok(hex.center && typeof hex.center.x === "number" && typeof hex.center.y === "number", `${hex.id} should have a numeric center`);
  assert.ok(rules.terrain[hex.terrain], `${hex.id} should use a known terrain key`);
  assert.equal(typeof terrainRule(rules, hex).passable, "boolean", `${hex.id} terrain should define passability`);
  assert.ok(Array.isArray(hex.objective), `${hex.id} should have an objective array`);
}

for (const [objectiveName, hexIds] of Object.entries(scenario.objectives)) {
  assert.ok(Array.isArray(hexIds), `objective ${objectiveName} should be a hex id array`);
  for (const hexId of hexIds) {
    assert.ok(board.hexById.has(hexId), `objective ${objectiveName} references unknown hex ${hexId}`);
  }
}

const occupiedHexes = new Set();
for (const unit of scenario.units) {
  assert.match(unit.side, /^(axis|allied)$/, `${unit.id} should have a known side`);
  assert.ok(Number.isFinite(unit.combat) && unit.combat > 0, `${unit.id} should have positive combat strength`);
  assert.ok(Number.isFinite(unit.movement) && unit.movement > 0, `${unit.id} should have positive movement`);
  assert.ok(board.hexById.has(unit.hexId), `${unit.id} references unknown hex ${unit.hexId}`);
  assert.equal(occupiedHexes.has(unit.hexId), false, `${unit.id} starts stacked on ${unit.hexId}`);
  occupiedHexes.add(unit.hexId);
}

for (const hex of board.hexes) {
  for (const neighborId of neighborsOf(board, hex.id)) {
    assert.ok(board.hexById.has(neighborId), `${hex.id} has unknown neighbor ${neighborId}`);
  }
}
