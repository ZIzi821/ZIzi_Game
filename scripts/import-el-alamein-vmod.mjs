import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultVmod = path.join(process.env.USERPROFILE || process.env.HOME || "", "Downloads", "阿拉曼战役 (1).vmod");
const vmodPath = path.resolve(process.argv[2] || defaultVmod);
const assetsDir = path.join(repoRoot, "el-alamein", "local-assets", "images");
const dataDir = path.join(repoRoot, "el-alamein", "local-data");

const CRT_COLUMNS = ["1:2", "1:1", "2:1", "3:1", "4:1", "5:1", "6:1"];
const CRT_ROWS = {
  1: ["AE", "AR", "AR", "AR", "DR1", "DR3", "DE"],
  2: ["AR", "AR", "AR", "DR1", "DR2", "DR4", "DE"],
  3: ["AR", "AR", "DR1", "DR2", "DR3", "DE", "DE"],
  4: ["AR", "DR1", "DR2", "DR3", "DR4", "DE", "DE"],
  5: ["AR", "DR2", "DR3", "DR4", "DE", "DE", "DE"],
  6: ["DR1", "DR3", "DR4", "DE", "DE", "DE", "DE"],
};

const UNIT_STATS = {
  "e10td8.jpg": [4, 8],
  "e161Ind.jpg": [1, 8],
  "e1sa1.jpg": [1, 4],
  "e1sa2.jpg": [1, 4],
  "e1sa3.jpg": [1, 4],
  "e22.jpg": [4, 8],
  "e2NZ5.jpg": [2, 4],
  "e2NZ6.jpg": [2, 4],
  "e44d131.jpg": [2, 4],
  "e44d132.jpg": [2, 4],
  "e44d133.jpg": [2, 4],
  "e5Ind5.jpg": [2, 4],
  "e5Ind9.jpg": [2, 4],
  "e7td4.jpg": [4, 8],
  "e7td7.jpg": [4, 8],
  "e7td7m.jpg": [2, 8],
  "e8td23.jpg": [3, 8],
  "e9Aus20.jpg": [2, 4],
  "e9Aus24.jpg": [2, 4],
  "e9Aus26.jpg": [2, 4],
  "g15pd115rgt.jpg": [4, 10],
  "g15pd8rgt.jpg": [6, 10],
  "g164md125rgt.jpg": [2, 8],
  "g164md382rgt.jpg": [2, 8],
  "g164md433rgt.jpg": [2, 8],
  "g21pd104rgt.jpg": [4, 10],
  "g21pd200rgt.jpg": [4, 10],
  "g21pd5rgt.jpg": [6, 10],
  "g90ld155rgt.jpg": [4, 10],
  "g90ld361rgt.jpg": [4, 10],
  "gFJrget.jpg": [1, 8],
  "iArieteTD.jpg": [4, 6],
  "iBolognaDiv.jpg": [1, 3],
  "iBresciaDiv.jpg": [1, 3],
  "iFolgoreDiv.jpg": [1, 6],
  "iLittorioTD.jpg": [3, 6],
  "iPaviaDiv.jpg": [1, 3],
  "iTrentoDiv.jpg": [1, 3],
  "iTriesteMD.jpg": [2, 6],
};

const HIGH_GROUND_SAMPLES = [
  [553, 91],
  [545, 933],
  [591, 1506],
  [646, 1503],
  [723, 922],
  [861, 936],
  [907, 1048],
  [910, 1249],
  [1044, 1433],
  [1115, 1426],
  [1111, 1515],
  [1211, 927],
  [1271, 932],
  [1543, 847],
  [1616, 676],
  [1690, 681],
];

const BRITISH_POSITION_SAMPLES = [
  [553, 91],
  [746, 326],
  [849, 488],
  [849, 674],
  [850, 833],
  [907, 1048],
  [909, 1249],
  [1038, 1435],
  [1627, 674],
  [1908, 522],
];

const ALAM_HALFA_OBJECTIVE_SAMPLES = [
  [1533, 844],
  [1624, 844],
];

const SETTLEMENT_SAMPLES = [
  [1036, 416],
  [2210, 337],
];

const COASTAL_ROAD_SAMPLES = [
  [936, 357],
  [1036, 416],
  [1138, 411],
  [1240, 393],
  [1347, 423],
  [1465, 430],
  [1584, 430],
  [1702, 430],
  [1821, 430],
  [1943, 429],
  [2062, 408],
  [2190, 337],
  [2306, 236],
];

const SEA_POLYGON = [
  [1160, 12],
  [2325, 12],
  [2350, 120],
  [2280, 230],
  [2210, 305],
  [2070, 345],
  [1880, 351],
  [1700, 350],
  [1510, 350],
  [1350, 323],
  [1222, 270],
  [1130, 198],
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
  throw new Error(message);
}

function decodeXml(value) {
  return String(value || "")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function parseAttrs(source) {
  const attrs = {};
  source.replace(/([A-Za-z0-9_.:-]+)="([^"]*)"/g, (_, name, value) => {
    attrs[name] = decodeXml(value);
    return "";
  });
  return attrs;
}

function readZip(filePath) {
  const buffer = fs.readFileSync(filePath);
  let eocdOffset = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65558); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) fail(`Could not find zip central directory in ${filePath}`);

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const directoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map();
  let offset = directoryOffset;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) fail("Invalid zip central directory entry");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    entries.set(name, { name, method, compressedSize, uncompressedSize, localOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return {
    entries,
    read(name) {
      const entry = entries.get(name);
      if (!entry) fail(`Missing zip entry: ${name}`);
      const local = entry.localOffset;
      if (buffer.readUInt32LE(local) !== 0x04034b50) fail(`Invalid local zip header for ${name}`);
      const fileNameLength = buffer.readUInt16LE(local + 26);
      const extraLength = buffer.readUInt16LE(local + 28);
      const start = local + 30 + fileNameLength + extraLength;
      const compressed = buffer.subarray(start, start + entry.compressedSize);
      if (entry.method === 0) return Buffer.from(compressed);
      if (entry.method === 8) return zlib.inflateRawSync(compressed, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
      fail(`Unsupported zip compression method ${entry.method} for ${name}`);
    },
  };
}

function parseBuildFile(xml) {
  const moduleMatch = xml.match(/<VASSAL\.build\.GameModule\b([^>]*)>/);
  const module = moduleMatch ? parseAttrs(moduleMatch[1]) : {};

  const boardMatch = xml.match(/<VASSAL\.build\.module\.map\.boardPicker\.Board\b([^>]*)>/);
  const board = boardMatch ? parseAttrs(boardMatch[1]) : {};

  const zoneMatch = xml.match(/<VASSAL\.build\.module\.map\.boardPicker\.board\.mapgrid\.Zone\b([^>]*)name="地图区"([^>]*)>/);
  const zoneAttrs = zoneMatch ? parseAttrs(`${zoneMatch[1]} ${zoneMatch[2]}`) : {};

  const hexMatch = xml.match(/<VASSAL\.build\.module\.map\.boardPicker\.board\.HexGrid\b([^>]*)>/);
  const hexGrid = hexMatch ? parseAttrs(hexMatch[1]) : {};

  const regions = [...xml.matchAll(/<VASSAL\.build\.module\.map\.boardPicker\.board\.Region\b([^>]*)\/>/g)]
    .map((match) => parseAttrs(match[1]));

  const stacks = [];
  const stackRe = /<VASSAL\.build\.module\.map\.SetupStack\b([^>]*)>([\s\S]*?)<\/VASSAL\.build\.module\.map\.SetupStack>/g;
  for (const match of xml.matchAll(stackRe)) {
    const stackAttrs = parseAttrs(match[1]);
    const body = match[2];
    const slotMatch = body.match(/<VASSAL\.build\.widget\.PieceSlot\b([^>]*)>([\s\S]*?)<\/VASSAL\.build\.widget\.PieceSlot>/);
    if (!slotMatch) continue;
    const slotAttrs = parseAttrs(slotMatch[1]);
    const entryText = decodeXml(slotMatch[2]);
    const imageMatch = entryText.match(/piece;;;([^;]+);/);
    if (!imageMatch) continue;
    stacks.push({
      name: stackAttrs.name || slotAttrs.entryName,
      location: stackAttrs.location || "",
      x: Number(stackAttrs.x),
      y: Number(stackAttrs.y),
      gpid: slotAttrs.gpid,
      image: imageMatch[1],
      entryName: slotAttrs.entryName || stackAttrs.name,
    });
  }

  return { module, board, zoneAttrs, hexGrid, regions, stacks };
}

function parsePointPath(source) {
  return String(source || "")
    .split(";")
    .map((pair) => pair.split(",").map(Number))
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    .map(([x, y]) => ({ x, y }));
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x ?? polygon[i][0];
    const yi = polygon[i].y ?? polygon[i][1];
    const xj = polygon[j].x ?? polygon[j][0];
    const yj = polygon[j].y ?? polygon[j][1];
    const intersects = ((yi > point.y) !== (yj > point.y))
      && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || 1) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearestHex(hexes, sample) {
  const point = Array.isArray(sample) ? { x: sample[0], y: sample[1] } : sample;
  let best = null;
  for (const hex of hexes) {
    const score = distance(hex.center, point);
    if (!best || score < best.score) best = { hex, score };
  }
  return best?.hex;
}

function generateHexes(hexGrid, zonePath) {
  const xSpacing = Number(hexGrid.dy) || 90.2;
  const ySpacing = Number(hexGrid.dx) || 78;
  const x0 = 0;
  const y0 = 64;
  const polygon = parsePointPath(zonePath);
  const hexes = [];

  for (let row = -1; row < 26; row += 1) {
    for (let col = 0; col < 40; col += 1) {
      const center = {
        x: x0 + col * xSpacing + (Math.abs(row % 2) === 1 ? xSpacing / 2 : 0),
        y: y0 + row * ySpacing,
      };
      if (!pointInPolygon(center, polygon)) continue;
      const id = `c${String(col).padStart(2, "0")}r${String(row).padStart(2, "0")}`;
      hexes.push({
        id,
        col,
        row,
        center: { x: Math.round(center.x * 10) / 10, y: Math.round(center.y * 10) / 10 },
        terrain: "desert",
        road: false,
        britishPosition: false,
        objective: [],
      });
    }
  }

  for (const hex of hexes) {
    if (pointInPolygon(hex.center, SEA_POLYGON)) hex.terrain = "mediterranean";
  }

  markNearest(hexes, HIGH_GROUND_SAMPLES, (hex) => {
    if (hex.terrain !== "mediterranean") hex.terrain = "highland";
  });
  markNearest(hexes, SETTLEMENT_SAMPLES, (hex) => {
    if (hex.terrain !== "mediterranean") hex.terrain = "settlement";
  });
  markNearest(hexes, BRITISH_POSITION_SAMPLES, (hex) => {
    if (hex.terrain !== "mediterranean") hex.britishPosition = true;
  });
  markNearest(hexes, COASTAL_ROAD_SAMPLES, (hex) => {
    if (hex.terrain !== "mediterranean") hex.road = true;
  });
  markNearest(hexes, ALAM_HALFA_OBJECTIVE_SAMPLES, (hex) => {
    if (hex.terrain !== "mediterranean" && !hex.objective.includes("alam-halfa-ridge")) {
      hex.objective.push("alam-halfa-ridge");
      hex.britishPosition = true;
      hex.terrain = "highland";
    }
  });
  markNearest(hexes, COASTAL_ROAD_SAMPLES.filter(([x]) => x >= 1030), (hex) => {
    if (hex.terrain !== "mediterranean" && !hex.objective.includes("coastal-road-east")) {
      hex.objective.push("coastal-road-east");
      hex.road = true;
    }
  });

  const landHexes = hexes.filter((hex) => hex.terrain !== "mediterranean");
  const minX = Math.min(...landHexes.map((hex) => hex.center.x));
  for (const hex of landHexes) {
    if (hex.center.x <= minX + xSpacing * 0.75) hex.objective.push("allied-west-exit-edge");
  }

  return hexes.sort((a, b) => a.col - b.col || a.row - b.row);
}

function markNearest(hexes, samples, apply) {
  const used = new Set();
  for (const sample of samples) {
    const candidates = hexes
      .map((hex) => ({ hex, score: distance(hex.center, { x: sample[0], y: sample[1] }) }))
      .sort((a, b) => a.score - b.score);
    const chosen = candidates.find(({ hex }) => !used.has(hex.id)) || candidates[0];
    if (!chosen) continue;
    used.add(chosen.hex.id);
    apply(chosen.hex);
  }
}

function sideFromImage(image) {
  if (image.startsWith("e")) return "allied";
  return "axis";
}

function nationalityFromImage(image) {
  if (image.startsWith("g")) return "german";
  if (image.startsWith("i")) return "italian";
  return "british-commonwealth";
}

function unitTypeFromImage(image) {
  if (/td|tank|Ariete|Littorio|e22|e10td|e8td|e7td4|e7td7|g15pd8|g21pd5/i.test(image)) return "armor";
  if (/FJ|Folgore/i.test(image)) return "airborne";
  if (/md|7m|Trieste|pd|90ld|115|104|155|200|361/i.test(image)) return "mechanized";
  return "infantry";
}

function buildUnits(stacks, hexes) {
  return stacks.map((stack, index) => {
    const stats = UNIT_STATS[stack.image];
    if (!stats) fail(`Missing combat/movement stats for ${stack.image}`);
    const hex = nearestHex(hexes, { x: stack.x, y: stack.y });
    if (!hex) fail(`Could not place ${stack.name}`);
    return {
      id: `u${String(index + 1).padStart(2, "0")}`,
      name: stack.name,
      entryName: stack.entryName,
      gpid: String(stack.gpid),
      side: sideFromImage(stack.image),
      nationality: nationalityFromImage(stack.image),
      unitType: unitTypeFromImage(stack.image),
      combat: stats[0],
      movement: stats[1],
      steps: 1,
      status: "ready",
      eliminated: false,
      disrupted: false,
      image: `local-assets/images/${stack.image}`,
      sourceImage: stack.image,
      sourceLocation: stack.location,
      sourcePixel: { x: stack.x, y: stack.y },
      hexId: hex.id,
    };
  });
}

function makeRules() {
  return {
    version: 1,
    format: "zizi-el-alamein-rules",
    source: "阿拉曼之战新人全面指南.pdf + VMOD charts",
    turns: [
      { turn: 1, label: "1942-08-31 AM / 8月31日上午" },
      { turn: 2, label: "1942-08-31 PM / 8月31日下午" },
      { turn: 3, label: "1942-09-01 AM / 9月1日上午" },
      { turn: 4, label: "1942-09-01 PM / 9月1日下午" },
    ],
    phases: [
      { id: "axis-move", side: "axis", type: "movement", label: "轴心国移动 / Axis Movement" },
      { id: "axis-combat", side: "axis", type: "combat", label: "轴心国战斗 / Axis Combat" },
      { id: "allied-move", side: "allied", type: "movement", label: "英军移动 / Allied Movement" },
      { id: "allied-combat", side: "allied", type: "combat", label: "英军战斗 / Allied Combat" },
    ],
    crt: { columns: CRT_COLUMNS, rows: CRT_ROWS },
    terrain: {
      desert: { label: "沙漠 / Desert", movement: 1, defenseMultiplier: 1, passable: true },
      highland: { label: "高地 / High Ground", movement: 2, defenseMultiplier: 2, passable: true },
      settlement: { label: "集落 / Settlement", movement: 1, defenseMultiplier: 2, passable: true },
      coast: { label: "海岸 / Coast", movement: 1, defenseMultiplier: 1, passable: true },
      mediterranean: { label: "地中海 / Mediterranean", movement: null, defenseMultiplier: 1, passable: false },
    },
    britishPosition: {
      label: "英军阵地 / British Position",
      defenseMultiplier: 2,
      appliesOnlyToSide: "allied",
      stacksWithHighland: false,
    },
    stackingLimit: 1,
    firstTurnAlliedMovementMultiplier: 0.5,
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeAudit(units) {
  const header = "id,name,side,nationality,image,combat,movement,hexId,sourceLocation,sourceX,sourceY";
  const rows = units.map((unit) => [
    unit.id,
    unit.name,
    unit.side,
    unit.nationality,
    unit.sourceImage,
    unit.combat,
    unit.movement,
    unit.hexId,
    unit.sourceLocation,
    unit.sourcePixel.x,
    unit.sourcePixel.y,
  ].map((value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`).join(","));
  fs.writeFileSync(path.join(dataDir, "unit-audit.csv"), `${header}\n${rows.join("\n")}\n`, "utf8");
}

function copyEntry(zip, source, targetName = source) {
  const target = path.join(assetsDir, path.basename(targetName));
  fs.writeFileSync(target, zip.read(source));
}

function main() {
  if (!fs.existsSync(vmodPath)) fail(`VMOD not found: ${vmodPath}`);
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const zip = readZip(vmodPath);
  const buildXml = zip.read("buildFile.xml").toString("utf8");
  const moduleData = zip.read("moduledata").toString("utf8");
  const parsed = parseBuildFile(buildXml);
  const hexes = generateHexes(parsed.hexGrid, parsed.zoneAttrs.path);
  const units = buildUnits(parsed.stacks, hexes);
  const rules = makeRules();

  const requiredAssets = new Set([
    "images/mainmap.jpg",
    "images/CRT.jpg",
    "images/TEC.jpg",
    "images/TurnTrack.jpg",
    ...units.map((unit) => `images/${unit.sourceImage}`),
  ]);
  for (const asset of requiredAssets) copyEntry(zip, asset);

  const scenario = {
    version: 1,
    format: "zizi-el-alamein-scenario",
    source: {
      vmod: path.basename(vmodPath),
      moduleName: parsed.module.name || "阿拉曼战役",
      moduleDescription: parsed.module.description || "",
      vassalVersion: parsed.module.VassalVersion || "",
      moduleVersion: parsed.module.version || "",
      moduledata: moduleData,
    },
    board: {
      name: parsed.board.name || "main",
      image: "local-assets/images/mainmap.jpg",
      width: 2448,
      height: 1696,
      vassalGrid: {
        dx: Number(parsed.hexGrid.dx),
        dy: Number(parsed.hexGrid.dy),
        x0: Number(parsed.hexGrid.x0),
        y0: Number(parsed.hexGrid.y0),
        sideways: parsed.hexGrid.sideways === "true",
        stagger: true,
        displayXSpacing: Number(parsed.hexGrid.dy),
        displayYSpacing: Number(parsed.hexGrid.dx),
        displayX0: 0,
        displayY0: 64,
      },
      hexes,
    },
    charts: {
      crtImage: "local-assets/images/CRT.jpg",
      terrainImage: "local-assets/images/TEC.jpg",
      turnTrackImage: "local-assets/images/TurnTrack.jpg",
    },
    objectives: {
      alamHalfaRidge: hexes.filter((hex) => hex.objective.includes("alam-halfa-ridge")).map((hex) => hex.id),
      coastalRoadEast: hexes.filter((hex) => hex.objective.includes("coastal-road-east")).map((hex) => hex.id),
      alliedWestExitEdge: hexes.filter((hex) => hex.objective.includes("allied-west-exit-edge")).map((hex) => hex.id),
    },
    units,
  };

  writeJson(path.join(dataDir, "rules.json"), rules);
  writeJson(path.join(dataDir, "scenario.json"), scenario);
  writeAudit(units);

  console.log(`Imported ${path.basename(vmodPath)}`);
  console.log(`Module: ${scenario.source.moduleName} (${scenario.source.vassalVersion})`);
  console.log(`Hexes: ${hexes.length}`);
  console.log(`SetupStack units: ${units.length}`);
  console.log(`Assets: ${requiredAssets.size}`);
  console.log(`Generated: ${path.relative(repoRoot, dataDir)}`);
}

main();
