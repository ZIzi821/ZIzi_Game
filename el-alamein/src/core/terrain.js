export function terrainRule(rules, hex) {
  return rules?.terrain?.[hex?.terrain] || rules?.terrain?.desert || {};
}

export function isPassableTerrain(rules, hex) {
  return terrainRule(rules, hex).passable !== false;
}
