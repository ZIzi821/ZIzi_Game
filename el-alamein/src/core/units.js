export function liveUnits(units) {
  return (units || []).filter((unit) => !unit.eliminated);
}

export function liveUnitAt(units, hexId) {
  return liveUnits(units).find((unit) => unit.hexId === hexId) || null;
}

export function unitById(units, unitId) {
  return (units || []).find((unit) => unit.id === unitId) || null;
}

export function resolveUnit(units, unitOrId) {
  return typeof unitOrId === "string" ? unitById(units, unitOrId) : unitOrId;
}
