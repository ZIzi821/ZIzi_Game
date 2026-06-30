(function (global) {
  "use strict";

  const FORMAT = "zizi-wargame-scenario";
  const VERSION = 1;
  const SIDES = Object.freeze(["german", "soviet"]);
  const PHASES = Object.freeze(["setup", "movement", "combat", "end"]);

  function mapApi() {
    if (!global.OperationTyphoonMap) throw new Error("地图契约未加载 / Map contract is not loaded");
    return global.OperationTyphoonMap;
  }

  function unitApi() {
    if (!global.ZiziWargameUnit) throw new Error("单位契约未加载 / Unit contract is not loaded");
    return global.ZiziWargameUnit;
  }

  function slug(value, fallback) {
    const text = String(value || fallback || "scenario")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return text || fallback || "scenario";
  }

  function text(value, fallback) {
    const result = String(value == null ? "" : value).trim();
    return result || fallback;
  }

  function integer(value, fallback, label, min) {
    const number = value == null || value === "" ? Number(fallback) : Number(value);
    if (!Number.isInteger(number) || number < min) {
      throw new Error(label + "必须是整数 / " + label + " must be an integer");
    }
    return number;
  }

  function makeScenarioId(scenario) {
    return slug(scenario && (scenario.id || scenario.name), "scenario");
  }

  function normalizeUnits(units) {
    if (!Array.isArray(units)) throw new Error("units 必须是数组 / units must be an array");
    return units.map((unit) => unitApi().normalizeUnitDocument(unit.unit ? unit : { unit }).unit);
  }

  function normalizeScenario(scenario) {
    if (!scenario || typeof scenario !== "object") {
      throw new Error("场景数据必须是对象 / Scenario data must be an object");
    }
    const normalized = {
      id: text(scenario.id, ""),
      name: text(scenario.name, "Untitled Scenario"),
      description: text(scenario.description, ""),
      author: text(scenario.author, "ZIzi Game"),
      ruleset: text(scenario.ruleset, "sandbox-v1"),
      turn: integer(scenario.turn, scenario.currentTurn || 1, "turn", 1),
      side: SIDES.includes(scenario.side) ? scenario.side : "german",
      phase: PHASES.includes(scenario.phase) ? scenario.phase : "movement",
      map: mapApi().normalizeMap(scenario.map),
      units: normalizeUnits(scenario.units || []),
    };
    normalized.id = normalized.id || makeScenarioId(normalized);
    return normalized;
  }

  function normalizeScenarioDocument(doc) {
    if (!doc || typeof doc !== "object") {
      throw new Error("场景 JSON 必须是对象 / Scenario JSON must be an object");
    }
    let source = doc.source || "ZIzi_Game wargame-sandbox";
    let scenario = doc.scenario || doc;
    if (doc.format === "zizi-wargame-sandbox-save") {
      scenario = {
        id: "imported-save",
        name: "Imported Save",
        description: "",
        author: "ZIzi Game",
        ruleset: "sandbox-v1",
        turn: doc.meta && doc.meta.currentTurn ? doc.meta.currentTurn : doc.currentTurn || 1,
        side: doc.side || "german",
        phase: doc.phase || "movement",
        map: doc.map,
        units: doc.units || [],
      };
      source = doc.source || source;
    } else if (doc.format && doc.format !== FORMAT) {
      throw new Error("不支持的场景格式 / Unsupported scenario format: " + doc.format);
    }
    return {
      version: VERSION,
      format: FORMAT,
      source,
      scenario: normalizeScenario(scenario),
    };
  }

  function createDefaultScenario() {
    return normalizeScenario({
      id: "sandbox-scenario",
      name: "Sandbox Scenario",
      description: "",
      author: "ZIzi Game",
      ruleset: "sandbox-v1",
      turn: 1,
      side: "german",
      phase: "movement",
      map: mapApi().createMap(10, 8),
      units: [],
    });
  }

  function createDemoScenario() {
    const map = mapApi().createMap(10, 8);
    const byKey = new Map(map.hexes.map((hex) => [`${hex.x},${hex.y}`, hex]));
    [
      [2, 1, "forest"],
      [3, 1, "forest"],
      [4, 2, "forest"],
      [2, 5, "city"],
      [7, 2, "city"],
      [6, 5, "major-city"],
    ].forEach(([x, y, visual]) => {
      const hex = byKey.get(`${x},${y}`);
      if (!hex) return;
      const definition = mapApi().visualDefinition(visual);
      hex.visual = visual;
      hex.terrain = definition.terrain;
      hex.city = definition.city;
    });
    [
      [1, 3, "NE"],
      [2, 2, "SE"],
      [4, 4, "NE"],
    ].forEach(([x, y, direction]) => {
      const hex = byKey.get(`${x},${y}`);
      if (hex && !hex.river.includes(direction)) hex.river.push(direction);
    });
    [
      [0, 6, "NE"],
      [1, 5, "NE"],
      [3, 4, "NE"],
      [5, 3, "NE"],
    ].forEach(([x, y, direction]) => {
      const hex = byKey.get(`${x},${y}`);
      if (hex && !hex.rail.includes(direction)) hex.rail.push(direction);
    });
    return normalizeScenario({
      id: "demo-scenario",
      name: "Demo Scenario",
      description: "A small test scenario.",
      author: "ZIzi Game",
      ruleset: "sandbox-v1",
      turn: 1,
      side: "german",
      phase: "movement",
      map,
      units: [
        { faction: "german", designation: "NNA", echelon: "army", unitType: "tank", combatFull: 12, combatReduced: 6, movement: 6, steps: 2, strength: "full", position: { x: 1, y: 1 } },
        { faction: "soviet", designation: "16A", echelon: "army", unitType: "infantry", combatFull: 8, combatReduced: 4, movement: 4, steps: 2, strength: "full", position: { x: 7, y: 5 } },
      ],
    });
  }

  global.ZiziWargameScenario = Object.freeze({
    FORMAT,
    VERSION,
    normalizeScenarioDocument,
    normalizeScenario,
    createDefaultScenario,
    createDemoScenario,
    makeScenarioId,
  });
})(typeof window !== "undefined" ? window : globalThis);
