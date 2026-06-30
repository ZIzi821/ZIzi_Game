(function (global) {
  "use strict";

  const FORMAT = "zizi-wargame-unit";
  const VERSION = 1;
  const DEFAULT_UNIT = Object.freeze({
    faction: "german",
    designation: "NNA",
    echelon: "army",
    unitType: "tank",
    combatFull: 12,
    combatReduced: 6,
    movement: 6,
    steps: 2,
    strength: "full",
    position: Object.freeze({ x: 0, y: 0 }),
  });
  const FACTIONS = Object.freeze(["german", "soviet"]);
  const STRENGTHS = Object.freeze(["full", "reduced"]);

  function slug(value, fallback) {
    const text = String(value || fallback || "unit")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return text || fallback || "unit";
  }

  function cleanText(value, fallback, label) {
    const text = String(value == null ? "" : value).trim();
    if (!text) throw new Error(label + "不能为空 / " + label + " is required");
    return text;
  }

  function integer(value, fallback, label, options) {
    const number = value == null || value === "" ? Number(fallback) : Number(value);
    if (!Number.isFinite(number) || !Number.isInteger(number)) {
      throw new Error(label + "必须是整数 / " + label + " must be an integer");
    }
    const min = options && Number.isFinite(options.min) ? options.min : -Infinity;
    const max = options && Number.isFinite(options.max) ? options.max : Infinity;
    if (number < min || number > max) {
      throw new Error(label + "超出范围 / " + label + " is out of range");
    }
    return number;
  }

  function makeUnitId(unit) {
    return [
      slug(unit && unit.faction, "unit"),
      slug(unit && unit.designation, "unnamed").toUpperCase(),
      slug(unit && unit.unitType, "unit"),
    ].join("-");
  }

  function createDefaultUnit() {
    return normalizeUnit(DEFAULT_UNIT);
  }

  function normalizeUnit(unit) {
    if (!unit || typeof unit !== "object") {
      throw new Error("单位数据必须是对象 / Unit data must be an object");
    }
    const faction = slug(unit.faction || DEFAULT_UNIT.faction, DEFAULT_UNIT.faction);
    if (!FACTIONS.includes(faction)) {
      throw new Error("不支持的阵营 / Unsupported faction: " + faction);
    }
    const designation = cleanText(unit.designation || DEFAULT_UNIT.designation, DEFAULT_UNIT.designation, "designation");
    const unitType = slug(unit.unitType || unit.unit || DEFAULT_UNIT.unitType, DEFAULT_UNIT.unitType);
    const echelon = slug(unit.echelon || DEFAULT_UNIT.echelon, DEFAULT_UNIT.echelon);
    const strength = STRENGTHS.includes(unit.strength) ? unit.strength : DEFAULT_UNIT.strength;
    const normalized = {
      id: String(unit.id || "").trim(),
      faction,
      designation,
      echelon,
      unitType,
      combatFull: integer(unit.combatFull, DEFAULT_UNIT.combatFull, "combatFull", { min: 0, max: 99 }),
      combatReduced: integer(unit.combatReduced, DEFAULT_UNIT.combatReduced, "combatReduced", { min: 0, max: 99 }),
      movement: integer(unit.movement, DEFAULT_UNIT.movement, "movement", { min: 0, max: 99 }),
      steps: integer(unit.steps, DEFAULT_UNIT.steps, "steps", { min: 1, max: 9 }),
      strength,
      position: {
        x: integer(unit.position && unit.position.x != null ? unit.position.x : unit.x, 0, "x", { min: 0, max: 99 }),
        y: integer(unit.position && unit.position.y != null ? unit.position.y : unit.y, 0, "y", { min: 0, max: 99 }),
      },
    };
    normalized.id = normalized.id || makeUnitId(normalized);
    return normalized;
  }

  function normalizeUnitDocument(doc) {
    if (!doc || typeof doc !== "object") {
      throw new Error("单位 JSON 必须是对象 / Unit JSON must be an object");
    }
    if (doc.format && doc.format !== FORMAT) {
      throw new Error("不支持的单位格式 / Unsupported unit format: " + doc.format);
    }
    const unit = normalizeUnit(doc.unit || doc);
    return {
      version: VERSION,
      format: FORMAT,
      source: doc.source || "ZIzi_Game wargame-counter-maker",
      unit,
    };
  }

  global.ZiziWargameUnit = Object.freeze({
    FORMAT,
    VERSION,
    normalizeUnitDocument,
    normalizeUnit,
    createDefaultUnit,
    makeUnitId,
  });
})(typeof window !== "undefined" ? window : globalThis);
