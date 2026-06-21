(function (global) {
  "use strict";

  const FORMAT = "zizi-operation-typhoon-map";
  const VERSION = 2;
  const RULESET = "operation-typhoon-v1";
  const DIRECTIONS = Object.freeze(["N", "NE", "SE", "S", "SW", "NW"]);
  const OPPOSITE = Object.freeze({ N: "S", NE: "SW", SE: "NW", S: "N", SW: "NE", NW: "SE" });

  const VISUALS = Object.freeze({
    open: Object.freeze({ terrain: "open", city: "none", rulesPending: false }),
    forest: Object.freeze({ terrain: "forest", city: "none", rulesPending: false }),
    city: Object.freeze({ terrain: "open", city: "normal", rulesPending: false }),
    "major-city": Object.freeze({ terrain: "open", city: "major", rulesPending: false }),
    fort: Object.freeze({ terrain: "open", city: "none", rulesPending: true }),
    rail: Object.freeze({ terrain: "open", city: "none", rulesPending: true }),
    setup: Object.freeze({ terrain: "open", city: "none", rulesPending: true }),
  });

  function clampInteger(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function visualDefinition(visual) {
    return VISUALS[visual] || VISUALS.open;
  }

  function createHex(x, y, visual = "open") {
    const resolvedVisual = VISUALS[visual] ? visual : "open";
    const definition = visualDefinition(resolvedVisual);
    return {
      x,
      y,
      visual: resolvedVisual,
      terrain: definition.terrain,
      city: definition.city,
      river: [],
    };
  }

  function createMap(cols = 14, rows = 11) {
    const width = clampInteger(cols, 14, 4, 24);
    const height = clampInteger(rows, 11, 4, 18);
    const hexes = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) hexes.push(createHex(x, y));
    }
    return {
      version: VERSION,
      format: FORMAT,
      ruleset: RULESET,
      terrainSheet: "battle-for-moscow/assets/terrain.png",
      grid: { cols: width, rows: height, orientation: "flat", offset: 1 },
      hexes,
    };
  }

  function neighborOf(x, y, direction) {
    const odd = Math.abs(x % 2) === 1;
    const offsets = odd
      ? { N: [0, -1], NE: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], NW: [-1, 0] }
      : { N: [0, -1], NE: [1, -1], SE: [1, 0], S: [0, 1], SW: [-1, 0], NW: [-1, -1] };
    if (!offsets[direction]) throw new Error(`无效河流方向 / Invalid river direction: ${direction}`);
    return { x: x + offsets[direction][0], y: y + offsets[direction][1] };
  }

  function normalizeDirectionList(value) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error("河流方向必须是数组 / River directions must be an array");
    const result = [];
    for (const direction of value) {
      if (!DIRECTIONS.includes(direction)) {
        throw new Error(`无效河流方向 / Invalid river direction: ${direction}`);
      }
      if (!result.includes(direction)) result.push(direction);
    }
    return result;
  }

  function addRiverSide(hexesByKey, cols, rows, x, y, direction) {
    const source = hexesByKey.get(`${x},${y}`);
    if (!source) return;
    if (!source.river.includes(direction)) source.river.push(direction);
    const neighbor = neighborOf(x, y, direction);
    if (neighbor.x < 0 || neighbor.x >= cols || neighbor.y < 0 || neighbor.y >= rows) return;
    const target = hexesByKey.get(`${neighbor.x},${neighbor.y}`);
    const opposite = OPPOSITE[direction];
    if (target && !target.river.includes(opposite)) target.river.push(opposite);
  }

  function normalizeVersionTwo(document) {
    if (document.format && document.format !== FORMAT) {
      throw new Error(`不支持的地图格式 / Unsupported map format: ${document.format}`);
    }
    if (document.ruleset && document.ruleset !== RULESET) {
      throw new Error(`不支持的规则集 / Unsupported ruleset: ${document.ruleset}`);
    }
    if (!Array.isArray(document.hexes)) throw new Error("缺少 hexes 数组 / Missing hexes array");

    const sourceGrid = document.grid || {};
    const cols = clampInteger(sourceGrid.cols, 14, 4, 24);
    const rows = clampInteger(sourceGrid.rows, 11, 4, 18);
    const normalized = createMap(cols, rows);
    normalized.terrainSheet = typeof document.terrainSheet === "string"
      ? document.terrainSheet
      : normalized.terrainSheet;
    const hexesByKey = new Map(normalized.hexes.map((hex) => [`${hex.x},${hex.y}`, hex]));
    const riverSides = [];

    for (const source of document.hexes) {
      const x = Number(source?.x);
      const y = Number(source?.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= cols || y < 0 || y >= rows) {
        throw new Error(`无效六边形坐标 / Invalid hex coordinate: ${source?.x},${source?.y}`);
      }
      const target = hexesByKey.get(`${x},${y}`);
      const visual = VISUALS[source.visual] ? source.visual : "open";
      const definition = visualDefinition(visual);
      target.visual = visual;
      target.terrain = definition.terrain;
      target.city = definition.city;
      for (const direction of normalizeDirectionList(source.river)) riverSides.push({ x, y, direction });
    }

    for (const side of riverSides) {
      addRiverSide(hexesByKey, cols, rows, side.x, side.y, side.direction);
    }
    for (const hex of normalized.hexes) {
      hex.river.sort((a, b) => DIRECTIONS.indexOf(a) - DIRECTIONS.indexOf(b));
    }
    return normalized;
  }

  function normalizeLegacy(document) {
    if (!Array.isArray(document.tiles)) throw new Error("缺少 tiles 数组 / Missing tiles array");
    const rows = clampInteger(document.rows || document.tiles.length, 11, 4, 18);
    const cols = clampInteger(document.cols || document.tiles[0]?.length, 14, 4, 24);
    const normalized = createMap(cols, rows);
    const hexesByKey = new Map(normalized.hexes.map((hex) => [`${hex.x},${hex.y}`, hex]));
    const legacyRivers = [];

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const sourceVisual = document.tiles[y]?.[x] || "open";
        const visual = sourceVisual === "river" ? "open" : (VISUALS[sourceVisual] ? sourceVisual : "open");
        const definition = visualDefinition(visual);
        const target = hexesByKey.get(`${x},${y}`);
        target.visual = visual;
        target.terrain = definition.terrain;
        target.city = definition.city;
        if (sourceVisual === "river") legacyRivers.push({ x, y });
      }
    }

    for (const river of legacyRivers) {
      for (const direction of ["N", "NE", "SE"]) {
        addRiverSide(hexesByKey, cols, rows, river.x, river.y, direction);
      }
    }
    for (const hex of normalized.hexes) {
      hex.river.sort((a, b) => DIRECTIONS.indexOf(a) - DIRECTIONS.indexOf(b));
    }
    return normalized;
  }

  function normalizeMap(document) {
    if (!document || typeof document !== "object") {
      throw new Error("地图数据必须是对象 / Map data must be an object");
    }
    if (document.version === VERSION || Array.isArray(document.hexes)) return normalizeVersionTwo(document);
    return normalizeLegacy(document);
  }

  function getMovementCost(hex, context = {}) {
    if (context.railMovement && context.army === "soviet") return 1;
    return hex?.terrain === "forest" ? 2 : 1;
  }

  function getCombatEffects(defenderHex, attackDirections = [], defenderArmy = "") {
    const modifiers = [];
    if (defenderHex?.terrain === "forest") modifiers.push("forest");
    if (defenderHex?.city === "major" || defenderHex?.city === "moscow") modifiers.push("major");

    const rivers = normalizeDirectionList(defenderHex?.river || []);
    const directions = normalizeDirectionList(attackDirections);
    if (directions.length > 0 && directions.every((direction) => rivers.includes(direction))) {
      modifiers.push("river");
    }

    return {
      oddsColumnShift: modifiers.length ? -modifiers.length : 0,
      modifiers,
      defenderRetreat: defenderHex?.city === "major" || defenderHex?.city === "moscow"
        ? "step-loss-instead"
        : "normal",
      defenderArmy,
    };
  }

  global.OperationTyphoonMap = Object.freeze({
    FORMAT,
    VERSION,
    RULESET,
    DIRECTIONS,
    OPPOSITE,
    VISUALS,
    createHex,
    createMap,
    neighborOf,
    normalizeMap,
    getMovementCost,
    getCombatEffects,
    visualDefinition,
  });
})(typeof window !== "undefined" ? window : globalThis);
