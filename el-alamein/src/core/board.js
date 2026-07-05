const ODD_ROW_OFFSETS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 1],
];

const EVEN_ROW_OFFSETS = [
  [1, 0],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

function coordKey(col, row) {
  return `${col},${row}`;
}

export function createBoard(scenario) {
  const hexes = scenario?.board?.hexes || [];
  const hexById = new Map(hexes.map((hex) => [hex.id, hex]));
  const hexByCoord = new Map(hexes.map((hex) => [coordKey(hex.col, hex.row), hex]));

  return {
    meta: scenario?.board || null,
    hexes,
    hexById,
    hexByCoord,
  };
}

export function getHex(board, hexId) {
  return board?.hexById?.get(hexId) || null;
}

export function neighborsOf(board, hexId) {
  const hex = getHex(board, hexId);
  if (!hex) return [];

  const offsets = Math.abs(hex.row % 2) === 1 ? ODD_ROW_OFFSETS : EVEN_ROW_OFFSETS;
  return offsets
    .map(([dc, dr]) => board.hexByCoord.get(coordKey(hex.col + dc, hex.row + dr))?.id)
    .filter(Boolean);
}

export function hexDistance(board, fromId, toId) {
  if (fromId === toId) return 0;

  const queue = [{ id: fromId, distance: 0 }];
  const seen = new Set([fromId]);

  while (queue.length) {
    const current = queue.shift();
    for (const next of neighborsOf(board, current.id)) {
      if (seen.has(next)) continue;
      if (next === toId) return current.distance + 1;
      seen.add(next);
      queue.push({ id: next, distance: current.distance + 1 });
    }
  }

  return Infinity;
}
