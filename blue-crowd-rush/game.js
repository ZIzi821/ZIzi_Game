import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { setupLeaderboard } from "../assets/leaderboard.js";

const GAME_ID = "tangsprint";
const GAME_NAME = "唐人冲刺 / Tang people sprint";
const ROAD_WIDTH = 9;
const ROAD_HALF = ROAD_WIDTH / 2 - 0.48;
const MAX_RENDER_CROWD = 160;
const MAX_RENDER_ENEMY_GROUP = 52;
const HERO_RUNNER_COUNT = 4;
const PLAYER_SPEED = 10;
const SIDE_SPEED = 8.2;
const POINTER_SCALE = 0.018;
const UNLOCK_STORAGE_KEY = "ziziTangSprintUnlockedLevel";

const levels = [
  {
    id: "level1",
    name: "Level 1 / 长街炼狱",
    length: 680,
    startCount: 4,
    speed: 11.2,
    gates: [
      { z: 28, left: "x3", right: "+8" },
      { z: 72, left: "+26", right: "x2" },
      { z: 118, left: "x2", right: "+38" },
      { z: 166, left: "+45", right: "x3" },
      { z: 224, left: "x2", right: "+72" },
      { z: 284, left: "+90", right: "x2" },
      { z: 346, left: "x4", right: "+105" },
      { z: 414, left: "+120", right: "x3" },
      { z: 486, left: "x2", right: "+155" },
      { z: 548, left: "+190", right: "x3" },
      { z: 618, left: "x4", right: "+220" }
    ],
    enemies: [
      { z: 52, x: 2.9, count: 16 },
      { z: 90, x: -2.8, count: 30 },
      { z: 136, x: 0.1, count: 48 },
      { z: 188, x: -3.1, count: 70 },
      { z: 206, x: 2.8, count: 76 },
      { z: 256, x: -0.4, count: 104 },
      { z: 316, x: 3.0, count: 142 },
      { z: 374, x: -2.9, count: 180 },
      { z: 398, x: 0.2, count: 210 },
      { z: 454, x: 2.9, count: 250 },
      { z: 512, x: -3.0, count: 310 },
      { z: 586, x: 0, count: 390 },
      { z: 650, x: 2.8, count: 520 }
    ],
    hazards: [
      { z: 104, x: 2.15, width: 2.4, loss: 0.32, label: "-32%" },
      { z: 156, x: -2.2, width: 2.2, loss: 24, label: "-24" },
      { z: 270, x: 2.2, width: 2.6, loss: 0.38, label: "-38%" },
      { z: 332, x: -1.2, width: 3.4, loss: 0.45, label: "-45%" },
      { z: 468, x: 0.7, width: 3.8, loss: 90, label: "-90" },
      { z: 604, x: -2.0, width: 2.8, loss: 0.5, label: "-50%" }
    ],
    pickups: [
      { z: 148, x: 3.35, count: 18 },
      { z: 240, x: -3.25, count: 35 },
      { z: 362, x: 3.25, count: 56 },
      { z: 532, x: -3.35, count: 95 },
      { z: 636, x: -0.1, count: 130 }
    ],
    sweepers: [
      { z: 112, count: 22, amplitude: 3.1, speed: 2.5, phase: 0.5 },
      { z: 300, count: 72, amplitude: 3.3, speed: 3.1, phase: 2.1 },
      { z: 438, count: 130, amplitude: 3.35, speed: 3.4, phase: 4.3 },
      { z: 572, count: 210, amplitude: 3.45, speed: 3.8, phase: 1.1 }
    ]
  },
  {
    id: "level2",
    name: "Level 2 / 远路超变态",
    length: 1080,
    startCount: 5,
    speed: 12.1,
    gates: [
      { z: 34, left: "+18", right: "x4" },
      { z: 86, left: "x2", right: "+52" },
      { z: 140, left: "+66", right: "x3" },
      { z: 198, left: "x4", right: "+78" },
      { z: 260, left: "+105", right: "x2" },
      { z: 318, left: "x3", right: "+132" },
      { z: 380, left: "+150", right: "x4" },
      { z: 448, left: "x2", right: "+210" },
      { z: 520, left: "+260", right: "x3" },
      { z: 592, left: "x4", right: "+310" },
      { z: 666, left: "+360", right: "x2" },
      { z: 742, left: "x3", right: "+430" },
      { z: 818, left: "+520", right: "x4" },
      { z: 894, left: "x2", right: "+680" },
      { z: 976, left: "+900", right: "x3" }
    ],
    enemies: [
      { z: 62, x: -2.8, count: 42 },
      { z: 110, x: 2.9, count: 84 },
      { z: 164, x: -0.2, count: 118 },
      { z: 224, x: -3.1, count: 170 },
      { z: 246, x: 2.8, count: 198 },
      { z: 292, x: 0.6, count: 245 },
      { z: 356, x: -2.9, count: 310 },
      { z: 418, x: 3.0, count: 390 },
      { z: 472, x: -0.2, count: 480 },
      { z: 548, x: -3.05, count: 610 },
      { z: 574, x: 3.1, count: 680 },
      { z: 638, x: 0, count: 760 },
      { z: 714, x: -2.8, count: 920 },
      { z: 768, x: 2.9, count: 1080 },
      { z: 842, x: 0.2, count: 1260 },
      { z: 916, x: -3.0, count: 1540 },
      { z: 946, x: 3.0, count: 1720 },
      { z: 1030, x: 0, count: 2200 }
    ],
    hazards: [
      { z: 126, x: -2.2, width: 2.7, loss: 0.35, label: "-35%" },
      { z: 188, x: 2.0, width: 3.1, loss: 60, label: "-60" },
      { z: 338, x: 0, width: 4.2, loss: 0.48, label: "-48%" },
      { z: 432, x: -2.35, width: 2.7, loss: 150, label: "-150" },
      { z: 506, x: 2.4, width: 2.9, loss: 0.52, label: "-52%" },
      { z: 624, x: -0.8, width: 3.6, loss: 260, label: "-260" },
      { z: 700, x: 2.3, width: 3.1, loss: 0.56, label: "-56%" },
      { z: 806, x: -2.0, width: 3.4, loss: 420, label: "-420" },
      { z: 970, x: 0.4, width: 4.4, loss: 0.62, label: "-62%" }
    ],
    pickups: [
      { z: 152, x: 3.3, count: 55 },
      { z: 276, x: -3.35, count: 90 },
      { z: 404, x: 0.1, count: 130 },
      { z: 616, x: 3.35, count: 220 },
      { z: 734, x: -3.35, count: 300 },
      { z: 884, x: 3.25, count: 460 },
      { z: 1010, x: -3.25, count: 700 }
    ],
    sweepers: [
      { z: 74, count: 44, amplitude: 3.2, speed: 2.8, phase: 0.2 },
      { z: 306, count: 150, amplitude: 3.4, speed: 3.3, phase: 1.5 },
      { z: 494, count: 300, amplitude: 3.5, speed: 3.7, phase: 3.4 },
      { z: 666, count: 520, amplitude: 3.45, speed: 4.1, phase: 2.3 },
      { z: 790, count: 760, amplitude: 3.55, speed: 4.35, phase: 5.2 },
      { z: 932, count: 1150, amplitude: 3.55, speed: 4.55, phase: 1.0 },
      { z: 1002, count: 1500, amplitude: 3.55, speed: 4.8, phase: 4.1 }
    ]
  },
  {
    id: "level3",
    name: "Level 3 / Decision Divide",
    length: 920,
    startCount: 180,
    speed: 11.8,
    gates: [
      { z: 34, left: "+80", right: "-35" },
      { z: 92, left: "/2", right: "x3" },
      { z: 154, left: "-110", right: "+160" },
      { z: 218, left: "x2", right: "/3" },
      { z: 286, left: "+240", right: "-180" },
      { z: 356, left: "/2", right: "+420" },
      { z: 430, left: "x3", right: "-360" },
      { z: 512, left: "-520", right: "/4" },
      { z: 600, left: "+780", right: "x2" },
      { z: 690, left: "/3", right: "+980" },
      { z: 786, left: "x4", right: "-1250" },
      { z: 870, left: "+1600", right: "/2" }
    ],
    enemies: [
      { z: 68, x: -2.7, count: 95 },
      { z: 128, x: 2.7, count: 140 },
      { z: 202, x: -0.2, count: 260 },
      { z: 266, x: -3.0, count: 340 },
      { z: 326, x: 2.9, count: 470 },
      { z: 392, x: 0.3, count: 650 },
      { z: 478, x: -2.8, count: 880 },
      { z: 566, x: 2.9, count: 1180 },
      { z: 640, x: 0, count: 1500 },
      { z: 736, x: -3.0, count: 2100 },
      { z: 842, x: 2.8, count: 3200 }
    ],
    hazards: [
      { z: 118, x: 0.4, width: 3.2, loss: 0.28, label: "-28%" },
      { z: 252, x: 2.3, width: 2.4, loss: 180, label: "-180" },
      { z: 468, x: -1.8, width: 3.4, loss: 0.4, label: "-40%" },
      { z: 624, x: 2.1, width: 3.0, loss: 520, label: "-520" },
      { z: 808, x: -0.5, width: 4.2, loss: 0.5, label: "-50%" }
    ],
    pickups: [
      { z: 176, x: 3.35, count: 120 },
      { z: 338, x: -3.35, count: 210 },
      { z: 548, x: 3.25, count: 420 },
      { z: 718, x: -3.25, count: 680 },
      { z: 888, x: 0.2, count: 980 }
    ],
    sweepers: [
      { z: 300, count: 240, amplitude: 3.45, speed: 3.5, phase: 0.8 },
      { z: 450, count: 520, amplitude: 3.55, speed: 4.0, phase: 2.7 },
      { z: 674, count: 900, amplitude: 3.55, speed: 4.4, phase: 4.2 },
      { z: 820, count: 1500, amplitude: 3.6, speed: 4.8, phase: 1.6 }
    ]
  },
  {
    id: "level4",
    name: "Level 4 / Arithmetic Storm",
    length: 1220,
    startCount: 240,
    speed: 12.6,
    gates: [
      { z: 40, left: "/2", right: "+150" },
      { z: 106, left: "x4", right: "-120" },
      { z: 174, left: "-260", right: "/3" },
      { z: 246, left: "+480", right: "x2" },
      { z: 324, left: "/4", right: "+720" },
      { z: 404, left: "x3", right: "-760" },
      { z: 490, left: "+1250", right: "/2" },
      { z: 582, left: "-1600", right: "x4" },
      { z: 674, left: "/3", right: "+2200" },
      { z: 770, left: "x2", right: "-2800" },
      { z: 872, left: "+3600", right: "/5" },
      { z: 980, left: "-4200", right: "x3" },
      { z: 1088, left: "/2", right: "+5200" },
      { z: 1162, left: "x4", right: "-6500" }
    ],
    enemies: [
      { z: 78, x: 2.7, count: 160 },
      { z: 146, x: -2.9, count: 260 },
      { z: 220, x: 0.2, count: 430 },
      { z: 302, x: 2.8, count: 620 },
      { z: 376, x: -2.7, count: 880 },
      { z: 462, x: 0.2, count: 1200 },
      { z: 548, x: 3.0, count: 1700 },
      { z: 640, x: -3.0, count: 2400 },
      { z: 732, x: 0, count: 3400 },
      { z: 836, x: 2.9, count: 4600 },
      { z: 934, x: -2.8, count: 6400 },
      { z: 1038, x: 0.3, count: 8600 },
      { z: 1136, x: 2.8, count: 11200 }
    ],
    hazards: [
      { z: 132, x: -0.4, width: 3.6, loss: 0.32, label: "-32%" },
      { z: 354, x: 2.1, width: 2.8, loss: 560, label: "-560" },
      { z: 520, x: -2.1, width: 3.0, loss: 0.42, label: "-42%" },
      { z: 704, x: 1.8, width: 3.4, loss: 1500, label: "-1500" },
      { z: 900, x: -0.8, width: 4.2, loss: 0.55, label: "-55%" },
      { z: 1104, x: 2.0, width: 3.4, loss: 3200, label: "-3200" }
    ],
    pickups: [
      { z: 190, x: 3.35, count: 240 },
      { z: 438, x: -3.35, count: 580 },
      { z: 616, x: 3.25, count: 1050 },
      { z: 812, x: -3.25, count: 1800 },
      { z: 1016, x: 3.25, count: 3000 },
      { z: 1180, x: -0.15, count: 4200 }
    ],
    sweepers: [
      { z: 274, count: 420, amplitude: 3.5, speed: 3.8, phase: 0.4 },
      { z: 564, count: 1050, amplitude: 3.6, speed: 4.25, phase: 2.2 },
      { z: 758, count: 1900, amplitude: 3.6, speed: 4.7, phase: 4.8 },
      { z: 962, count: 3200, amplitude: 3.65, speed: 5.0, phase: 1.4 },
      { z: 1126, count: 5200, amplitude: 3.65, speed: 5.2, phase: 3.3 }
    ]
  }
];

const canvas = document.getElementById("gameCanvas");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const levelSelect = document.getElementById("levelSelect");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const nextButton = document.getElementById("nextButton");
const leaderboardButton = document.getElementById("leaderboardButton");
const pauseButton = document.getElementById("pauseButton");
const musicButton = document.getElementById("musicButton");
const hudLevel = document.getElementById("hudLevel");
const hudCrowd = document.getElementById("hudCrowd");
const hudScore = document.getElementById("hudScore");
const hudThreat = document.getElementById("hudThreat");
const progressFill = document.getElementById("progressFill");

window.ZIziLeaderboards = window.ZIziLeaderboards || {};
window.ZIziLeaderboards.tangsprint = setupLeaderboard({
  gameId: GAME_ID,
  gameName: GAME_NAME,
  levels: levels.map((level) => ({ id: level.id, name: level.name })),
  getLevelId: () => currentLevel?.id || "level1"
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fdaf8);
scene.fog = new THREE.Fog(0x9fdaf8, 80, 720);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const ambient = new THREE.HemisphereLight(0xffffff, 0x7fb6c8, 2.6);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(-6, 14, -8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -25;
scene.add(sun);

const materials = {
  road: new THREE.MeshStandardMaterial({ color: 0xf8f6e9, roughness: 0.74 }),
  lane: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62 }),
  side: new THREE.MeshStandardMaterial({ color: 0x7ad7c6, roughness: 0.5 }),
  finish: new THREE.MeshStandardMaterial({ color: 0x263044, roughness: 0.42 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x2fd1c3, roughness: 0.38, metalness: 0.04, emissive: 0x063a48, emissiveIntensity: 0.18 }),
  runnerOutline: new THREE.MeshBasicMaterial({ color: 0xc9fff6, transparent: true, opacity: 0.36, depthWrite: false }),
  hero: new THREE.MeshStandardMaterial({ color: 0x1f8fff, roughness: 0.34, metalness: 0.05, emissive: 0x063a76, emissiveIntensity: 0.2 }),
  red: new THREE.MeshStandardMaterial({ color: 0xff4258, roughness: 0.48, metalness: 0.02 }),
  hazard: new THREE.MeshStandardMaterial({ color: 0x2b2233, roughness: 0.5, emissive: 0xaa1630, emissiveIntensity: 0.18 }),
  hazardStripe: new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.42, emissive: 0x7a3200, emissiveIntensity: 0.12 }),
  pickup: new THREE.MeshStandardMaterial({ color: 0x22d28f, roughness: 0.3, metalness: 0.1, emissive: 0x0a8f5b, emissiveIntensity: 0.36 }),
  sweeper: new THREE.MeshStandardMaterial({ color: 0xe02f4f, roughness: 0.36, metalness: 0.05, emissive: 0x7f0018, emissiveIntensity: 0.28 }),
  warning: new THREE.MeshBasicMaterial({ color: 0xff304f, transparent: true, opacity: 0.18 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffcf5d, roughness: 0.4, emissive: 0x6b3b00, emissiveIntensity: 0.16 }),
  playerGuide: new THREE.MeshBasicMaterial({ color: 0x74e8ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  gateLeft: new THREE.MeshStandardMaterial({ color: 0x21c7ad, transparent: true, opacity: 0.28, roughness: 0.25 }),
  gateRight: new THREE.MeshStandardMaterial({ color: 0x5b8def, transparent: true, opacity: 0.28, roughness: 0.25 }),
  gateFrame: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.36, emissive: 0x77d9ff, emissiveIntensity: 0.15 }),
  hidden: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
};

const crowdGeometry = new THREE.CapsuleGeometry(0.18, 0.42, 4, 8);
const heroGeometry = new THREE.CapsuleGeometry(0.24, 0.62, 5, 10);
const ringGeometry = new THREE.RingGeometry(0.92, 1.16, 64);
const runnerPalette = [
  new THREE.Color(0x2fd1c3),
  new THREE.Color(0x35a7ff),
  new THREE.Color(0x4ee7a8),
  new THREE.Color(0x7a8cff),
  new THREE.Color(0x28c4de)
];
const heroPalette = [
  new THREE.MeshStandardMaterial({ color: 0x1f8fff, roughness: 0.34, metalness: 0.05, emissive: 0x063a76, emissiveIntensity: 0.22 }),
  new THREE.MeshStandardMaterial({ color: 0x2fd1c3, roughness: 0.34, metalness: 0.05, emissive: 0x053f39, emissiveIntensity: 0.2 }),
  new THREE.MeshStandardMaterial({ color: 0x6e7bff, roughness: 0.36, metalness: 0.04, emissive: 0x20246f, emissiveIntensity: 0.18 }),
  new THREE.MeshStandardMaterial({ color: 0x53e4a6, roughness: 0.34, metalness: 0.05, emissive: 0x06422d, emissiveIntensity: 0.18 })
];
const runnerOutline = new THREE.InstancedMesh(crowdGeometry, materials.runnerOutline, MAX_RENDER_CROWD);
runnerOutline.renderOrder = 1;
scene.add(runnerOutline);

const blueCrowd = new THREE.InstancedMesh(crowdGeometry, materials.blue, MAX_RENDER_CROWD);
blueCrowd.castShadow = true;
blueCrowd.receiveShadow = true;
blueCrowd.renderOrder = 2;
scene.add(blueCrowd);

const heroRunnerGroup = new THREE.Group();
const heroRunners = Array.from({ length: HERO_RUNNER_COUNT }, (_, index) => {
  const runner = new THREE.Mesh(heroGeometry, heroPalette[index % heroPalette.length]);
  runner.castShadow = true;
  runner.receiveShadow = true;
  runner.renderOrder = 12;
  heroRunnerGroup.add(runner);
  return runner;
});
scene.add(heroRunnerGroup);

const playerRing = new THREE.Mesh(ringGeometry, materials.playerGuide);
playerRing.rotation.x = -Math.PI / 2;
playerRing.position.y = 0.08;
scene.add(playerRing);

const enemyCrowd = new THREE.InstancedMesh(crowdGeometry, materials.red, 1500);
enemyCrowd.castShadow = true;
enemyCrowd.receiveShadow = true;
scene.add(enemyCrowd);

const roadGroup = new THREE.Group();
const obstacleGroup = new THREE.Group();
const labelGroup = new THREE.Group();
const effectGroup = new THREE.Group();
scene.add(roadGroup, obstacleGroup, labelGroup, effectGroup);

const dummy = new THREE.Object3D();
const cameraTarget = new THREE.Vector3();
const gateBoxGeometry = new THREE.BoxGeometry(0.18, 2.6, 0.18);
const gateTopGeometry = new THREE.BoxGeometry(2.85, 0.18, 0.18);
const gatePlaneGeometry = new THREE.PlaneGeometry(2.85, 2.1);
const roadGeometry = new THREE.BoxGeometry(ROAD_WIDTH, 0.24, 1);
const railGeometry = new THREE.BoxGeometry(0.18, 0.32, 1);
const laneMarkGeometry = new THREE.BoxGeometry(0.08, 0.025, 5);
const decorPostGeometry = new THREE.BoxGeometry(0.22, 1.4, 0.22);
const decorBannerGeometry = new THREE.BoxGeometry(1.1, 0.34, 0.12);
const finishTileGeometry = new THREE.BoxGeometry(ROAD_WIDTH / 8, 0.04, 1.3);
const hazardGeometry = new THREE.BoxGeometry(1, 0.1, 3.4);
const hazardStripeGeometry = new THREE.BoxGeometry(0.42, 0.13, 0.18);
const pickupGeometry = new THREE.TorusGeometry(0.38, 0.1, 10, 28);
const sweeperGeometry = new THREE.BoxGeometry(2.25, 0.34, 0.58);
const warningGeometry = new THREE.PlaneGeometry(1, 4.8);

let currentLevelIndex = 0;
let selectedLevelIndex = 0;
let currentLevel = levels[0];
let gameState = "menu";
let crowdCount = currentLevel.startCount;
let crowdX = 0;
let targetX = 0;
let crowdZ = 0;
let lastTime = 0;
let lastLabelCount = -1;
let finalScore = 0;
let submittedThisRun = false;
let gates = [];
let enemies = [];
let hazards = [];
let pickups = [];
let sweepers = [];
let effects = [];
let pointerActive = false;
let lastPointerX = 0;
const keys = { left: false, right: false };

class MusicSystem {
  constructor(button) {
    this.button = button;
    this.context = null;
    this.master = null;
    this.timer = 0;
    this.nextTime = 0;
    this.step = 0;
    this.enabled = true;
    this.playing = false;
    this.ready = false;
    this.tempo = 138;
    this.updateButton();
  }

  init() {
    if (this.context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      this.enabled = false;
      this.button.disabled = true;
      this.button.textContent = "No Audio";
      return;
    }
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
  }

  async play() {
    if (!this.enabled) return;
    this.init();
    if (!this.context) return;
    await this.context.resume();
    this.ready = true;
    this.playing = true;
    this.nextTime = this.context.currentTime + 0.03;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.linearRampToValueAtTime(0.16, this.context.currentTime + 0.35);
    if (!this.timer) {
      this.timer = window.setInterval(() => this.schedule(), 90);
    }
    this.schedule();
    this.updateButton();
  }

  async prime() {
    if (!this.enabled) this.enabled = true;
    this.init();
    if (!this.context) return;
    await this.context.resume();
    this.ready = true;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0.08, now);
    this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    this.tone(523.25, now + 0.01, 0.12, "triangle", 0.06);
    this.tone(659.25, now + 0.13, 0.16, "triangle", 0.045);
    this.updateButton();
  }

  pause() {
    this.playing = false;
    if (this.context && this.master) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.22);
    }
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
    this.updateButton();
  }

  toggle() {
    if (this.playing) {
      this.enabled = false;
      this.pause();
    } else {
      this.enabled = true;
      if (gameState === "running") startMusic();
      else {
        this.prime().catch((error) => {
          console.warn("[Tang Sprint] Music prime failed:", error);
          this.pause();
        });
      }
    }
    this.updateButton();
  }

  updateButton() {
    if (!this.button) return;
    if (!this.enabled) this.button.textContent = "Music Off";
    else if (this.playing) this.button.textContent = "Music Playing";
    else if (this.ready) this.button.textContent = "Music Ready";
    else this.button.textContent = "Music On";
    this.button.setAttribute("aria-pressed", String(this.enabled));
    this.button.setAttribute("aria-label", this.enabled ? "Music is on" : "Music is off");
  }

  schedule() {
    if (!this.context || !this.playing) return;
    const beat = 60 / this.tempo;
    while (this.nextTime < this.context.currentTime + 0.35) {
      this.scheduleStep(this.nextTime, this.step);
      this.nextTime += beat / 2;
      this.step = (this.step + 1) % 32;
    }
  }

  scheduleStep(time, step) {
    const bass = [82.41, 98, 110, 146.83];
    const lead = [392, 440, 523.25, 587.33, 659.25, 587.33, 523.25, 440];
    if (step % 4 === 0) {
      this.tone(bass[Math.floor(step / 8) % bass.length], time, 0.28, "sawtooth", 0.11);
      this.kick(time);
    }
    if (step % 2 === 1) this.hat(time);
    if ([2, 5, 10, 13, 18, 21, 26, 29].includes(step)) {
      this.tone(lead[step % lead.length], time, 0.16, "triangle", 0.045);
    }
  }

  tone(freq, time, duration, type, volume) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  kick(time) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(92, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.16);
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  hat(time) {
    const buffer = this.context.createBuffer(1, 900, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.018, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
    source.connect(gain).connect(this.master);
    source.start(time);
  }
}

const music = new MusicSystem(musicButton);

function startMusic() {
  music.play().catch((error) => {
    console.warn("[Tang Sprint] Music playback failed:", error);
    music.pause();
  });
}

const crowdLabel = makeTextSprite("1", {
  color: "#ffffff",
  background: "rgba(20, 92, 170, 0.9)",
  width: 170,
  height: 80,
  fontSize: 42
});
crowdLabel.scale.set(2.7, 1.25, 1);
labelGroup.add(crowdLabel);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getUnlockedLevelIndex() {
  const stored = Number(window.localStorage.getItem(UNLOCK_STORAGE_KEY) || 0);
  return clamp(Number.isFinite(stored) ? Math.floor(stored) : 0, 0, levels.length - 1);
}

function setUnlockedLevelIndex(index) {
  const nextIndex = clamp(index, 0, levels.length - 1);
  window.localStorage.setItem(UNLOCK_STORAGE_KEY, String(nextIndex));
}

function unlockNextLevel() {
  const unlocked = getUnlockedLevelIndex();
  if (currentLevelIndex >= unlocked && currentLevelIndex < levels.length - 1) {
    setUnlockedLevelIndex(currentLevelIndex + 1);
  }
}

function getLevelFlavor(index) {
  if (index < 2) return "Classic route: addition and multiplication gates keep the old leaderboard balance.";
  if (index === 2) return "New route: subtraction and division gates punish lazy choices but can open safer lanes.";
  return "Final route: arithmetic traps are brutal, and the best score comes from choosing when to grow and when to shrink.";
}

function renderLevelSelect(mode = "menu") {
  if (!levelSelect) return;
  levelSelect.replaceChildren();
  const unlocked = getUnlockedLevelIndex();
  levelSelect.hidden = mode === "paused";
  levels.forEach((level, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-card";
    button.dataset.levelId = level.id;
    const locked = index > unlocked;
    const selected = index === selectedLevelIndex;
    button.disabled = locked;
    button.setAttribute("aria-pressed", String(selected));
    button.innerHTML = `
      <span class="level-number">${index + 1}</span>
      <span class="level-name">${level.name}</span>
      <span class="level-flavor">${locked ? "Locked: complete the previous level first." : getLevelFlavor(index)}</span>
      <span class="level-status">${locked ? "Locked" : selected ? "Selected" : "Playable"}</span>
    `;
    button.addEventListener("click", () => {
      selectedLevelIndex = index;
      currentLevelIndex = index;
      currentLevel = levels[index];
      renderLevelSelect(mode);
    });
    levelSelect.append(button);
  });
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function makeTextSprite(text, options = {}) {
  const width = options.width || 220;
  const height = options.height || 110;
  const canvas2d = document.createElement("canvas");
  canvas2d.width = width;
  canvas2d.height = height;
  const context = canvas2d.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas2d);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.userData.canvas = canvas2d;
  sprite.userData.context = context;
  sprite.userData.texture = texture;
  sprite.userData.options = options;
  updateTextSprite(sprite, text);
  return sprite;
}

function updateTextSprite(sprite, text) {
  const canvas2d = sprite.userData.canvas;
  const context = sprite.userData.context;
  const options = sprite.userData.options;
  context.clearRect(0, 0, canvas2d.width, canvas2d.height);
  context.fillStyle = options.background || "rgba(255, 255, 255, 0.86)";
  roundRect(context, 8, 8, canvas2d.width - 16, canvas2d.height - 16, options.radius || 20);
  context.fill();
  context.strokeStyle = options.stroke || "rgba(255, 255, 255, 0.7)";
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = options.color || "#233044";
  context.font = `900 ${options.fontSize || 48}px system-ui, "Microsoft YaHei", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(text), canvas2d.width / 2, canvas2d.height / 2 + 2);
  sprite.userData.texture.needsUpdate = true;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function applyGateFormula(value, formula) {
  const clean = String(formula).trim().toLowerCase().replace("×", "x").replace("÷", "/");
  if (clean.startsWith("+")) return value + Number(clean.slice(1) || 0);
  if (clean.startsWith("-")) return value - Number(clean.slice(1) || 0);
  if (clean.startsWith("x")) return value * Math.max(1, Number(clean.slice(1) || 1));
  if (clean.startsWith("/")) return Math.floor(value / Math.max(1, Number(clean.slice(1) || 1)));
  return value;
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    child.traverse?.((node) => {
      if (node.isSprite) node.material.map?.dispose();
      if (node.material && node.isSprite) node.material.dispose();
    });
  }
}

function clearEffects() {
  effects = [];
  clearGroup(effectGroup);
}

function addPopText(text, x, z, color = "#ffffff", background = "rgba(35, 48, 68, 0.9)") {
  const sprite = makeTextSprite(text, {
    color,
    background,
    width: 210,
    height: 82,
    fontSize: 34
  });
  sprite.position.set(x, 2.7, z);
  sprite.scale.set(2.6, 1.08, 1);
  effectGroup.add(sprite);
  effects.push({ sprite, age: 0, ttl: 0.9, baseY: 2.7 });
}

function updateEffects(dt) {
  effects = effects.filter((effect) => {
    effect.age += dt;
    const progress = effect.age / effect.ttl;
    effect.sprite.position.y = effect.baseY + progress * 1.1;
    effect.sprite.material.opacity = Math.max(0, 1 - progress);
    if (effect.age < effect.ttl) return true;
    effectGroup.remove(effect.sprite);
    effect.sprite.material.map?.dispose();
    effect.sprite.material.dispose();
    return false;
  });
}

function createRoad(level) {
  clearGroup(roadGroup);
  const road = new THREE.Mesh(roadGeometry, materials.road);
  road.position.set(0, -0.12, level.length / 2);
  road.scale.z = level.length + 24;
  road.receiveShadow = true;
  roadGroup.add(road);

  for (let x = -ROAD_WIDTH / 2 - 0.32; x <= ROAD_WIDTH / 2 + 0.32; x += ROAD_WIDTH + 0.64) {
    const rail = new THREE.Mesh(railGeometry, materials.side);
    rail.position.set(x, 0.1, level.length / 2);
    rail.scale.z = level.length + 24;
    rail.receiveShadow = true;
    roadGroup.add(rail);
  }

  for (let z = 12; z < level.length; z += 16) {
    const mark = new THREE.Mesh(laneMarkGeometry, materials.lane);
    mark.position.set(0, 0.025, z);
    roadGroup.add(mark);
  }

  for (let z = 24; z < level.length; z += 34) {
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(decorPostGeometry, materials.side);
      post.position.set(side * (ROAD_WIDTH / 2 + 0.62), 0.7, z);
      post.castShadow = true;
      roadGroup.add(post);

      const banner = new THREE.Mesh(decorBannerGeometry, z % 68 === 24 ? materials.gold : materials.gateRight);
      banner.position.set(side * (ROAD_WIDTH / 2 + 1.0), 1.36, z + 1.0);
      banner.rotation.y = side * 0.22;
      banner.castShadow = true;
      roadGroup.add(banner);
    });
  }

  const finish = new THREE.Group();
  finish.position.z = level.length;
  for (let i = 0; i < 8; i += 1) {
    const tile = new THREE.Mesh(finishTileGeometry, i % 2 ? materials.lane : materials.finish);
    tile.position.set(-ROAD_WIDTH / 2 + ROAD_WIDTH / 16 + i * (ROAD_WIDTH / 8), 0.06, 0);
    finish.add(tile);
  }
  const finishLabel = makeTextSprite("FINISH / 终点", {
    color: "#263044",
    background: "rgba(255, 255, 255, 0.9)",
    width: 280,
    height: 80,
    fontSize: 34
  });
  finishLabel.position.set(0, 2.5, 0);
  finishLabel.scale.set(4.2, 1.2, 1);
  finish.add(finishLabel);
  roadGroup.add(finish);
}

function createWarningStrip(x, z, width) {
  const strip = new THREE.Mesh(warningGeometry, materials.warning);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(x, 0.071, z);
  strip.scale.set(width, 1, 1);
  obstacleGroup.add(strip);
  return strip;
}

function createGateSide(x, z, label, material, side) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData.side = side;
  const plane = new THREE.Mesh(gatePlaneGeometry, material);
  plane.position.set(0, 1.35, 0);
  group.add(plane);
  [-1.42, 1.42].forEach((postX) => {
    const post = new THREE.Mesh(gateBoxGeometry, materials.gateFrame);
    post.position.set(postX, 1.3, 0);
    post.castShadow = true;
    group.add(post);
  });
  const top = new THREE.Mesh(gateTopGeometry, materials.gateFrame);
  top.position.set(0, 2.5, 0);
  top.castShadow = true;
  group.add(top);
  const sprite = makeTextSprite(label.replace(/x/i, "×"), {
    color: side === "left" ? "#087e72" : "#2459a7",
    background: "rgba(255, 255, 255, 0.92)",
    width: 180,
    height: 90,
    fontSize: 48
  });
  sprite.position.set(0, 3.25, 0);
  sprite.scale.set(2.2, 1.1, 1);
  group.add(sprite);
  return group;
}

function createObstacles(level) {
  clearGroup(obstacleGroup);
  gates = level.gates.map((gate) => {
    const group = new THREE.Group();
    const left = createGateSide(-2.25, gate.z, gate.left, materials.gateLeft, "left");
    const right = createGateSide(2.25, gate.z, gate.right, materials.gateRight, "right");
    group.add(left, right);
    obstacleGroup.add(group);
    return { ...gate, group, triggered: false };
  });

  enemies = level.enemies.map((enemy) => {
    const label = makeTextSprite(String(enemy.count), {
      color: "#ffffff",
      background: "rgba(190, 35, 61, 0.9)",
      width: 150,
      height: 76,
      fontSize: 40
    });
    label.position.set(enemy.x, 2.25, enemy.z);
    label.scale.set(2, 1.02, 1);
    obstacleGroup.add(label);
    createWarningStrip(enemy.x, enemy.z - 4.2, 1.9);
    return { ...enemy, label, triggered: false };
  });

  hazards = (level.hazards || []).map((hazard) => {
    const mesh = new THREE.Mesh(hazardGeometry, materials.hazard);
    mesh.position.set(hazard.x, 0.08, hazard.z);
    mesh.scale.set(hazard.width, 1, 1);
    mesh.receiveShadow = true;
    obstacleGroup.add(mesh);
    const parts = [mesh];

    for (let i = -1; i <= 1; i += 1) {
      const stripe = new THREE.Mesh(hazardStripeGeometry, materials.hazardStripe);
      stripe.position.set(hazard.x + i * hazard.width * 0.24, 0.16, hazard.z);
      stripe.rotation.y = 0.7;
      stripe.scale.x = hazard.width;
      obstacleGroup.add(stripe);
      parts.push(stripe);
    }

    const label = makeTextSprite(hazard.label || "TRAP", {
      color: "#ffffff",
      background: "rgba(43, 34, 51, 0.92)",
      width: 150,
      height: 72,
      fontSize: 36
    });
    label.position.set(hazard.x, 1.75, hazard.z);
    label.scale.set(1.8, 0.92, 1);
    obstacleGroup.add(label);
    createWarningStrip(hazard.x, hazard.z - 4.8, hazard.width);
    return { ...hazard, mesh, label, parts, triggered: false };
  });

  pickups = (level.pickups || []).map((pickup) => {
    const mesh = new THREE.Mesh(pickupGeometry, materials.pickup);
    mesh.position.set(pickup.x, 0.85, pickup.z);
    mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    obstacleGroup.add(mesh);

    const label = makeTextSprite(`+${pickup.count}`, {
      color: "#053b2c",
      background: "rgba(223, 255, 239, 0.94)",
      width: 150,
      height: 72,
      fontSize: 38
    });
    label.position.set(pickup.x, 1.9, pickup.z);
    label.scale.set(1.75, 0.9, 1);
    obstacleGroup.add(label);
    return { ...pickup, mesh, label, triggered: false };
  });

  sweepers = (level.sweepers || []).map((sweeper) => {
    const mesh = new THREE.Mesh(sweeperGeometry, materials.sweeper);
    mesh.position.set(0, 0.62, sweeper.z);
    mesh.castShadow = true;
    obstacleGroup.add(mesh);

    const label = makeTextSprite(`-${sweeper.count}`, {
      color: "#ffffff",
      background: "rgba(224, 47, 79, 0.92)",
      width: 145,
      height: 70,
      fontSize: 36
    });
    label.position.set(0, 1.55, sweeper.z);
    label.scale.set(1.65, 0.85, 1);
    obstacleGroup.add(label);
    createWarningStrip(0, sweeper.z - 5.2, ROAD_WIDTH * 0.72);
    return { ...sweeper, mesh, label, x: 0, triggered: false };
  });
}

function setOverlay(mode, details = "") {
  overlay.hidden = false;
  startButton.hidden = mode !== "menu";
  restartButton.hidden = mode === "menu";
  nextButton.hidden = mode !== "win" || currentLevelIndex >= getUnlockedLevelIndex() || currentLevelIndex >= levels.length - 1;
  leaderboardButton.hidden = mode === "menu";
  renderLevelSelect(mode);
  if (mode === "menu") {
    overlayTitle.textContent = GAME_NAME;
    overlayText.textContent = "Choose a level. Levels 3 and 4 add subtraction and division choices with separate leaderboards, so the old Level 1 and Level 2 scores stay fair.";
  } else if (mode === "paused") {
    overlayTitle.textContent = "Paused / 已暂停";
    overlayText.textContent = "Press P or Esc to keep running. / 按 P 或 Esc 继续冲刺。";
  } else if (mode === "win") {
    overlayTitle.textContent = "Level Complete / 关卡完成";
    overlayText.textContent = `Final Crowd: ${crowdCount}. ${details}`;
  } else {
    overlayTitle.textContent = "Game Over / 游戏失败";
    overlayText.textContent = details || "The brutal route crushed the team. Read the danger HUD and try a cleaner gate line.";
  }
}

function hideOverlay() {
  overlay.hidden = true;
}

function resetLevel(index = currentLevelIndex) {
  currentLevelIndex = clamp(index, 0, levels.length - 1);
  selectedLevelIndex = currentLevelIndex;
  currentLevel = levels[currentLevelIndex];
  crowdCount = currentLevel.startCount;
  crowdX = 0;
  targetX = 0;
  crowdZ = 0;
  lastLabelCount = -1;
  submittedThisRun = false;
  finalScore = 0;
  clearEffects();
  keys.left = false;
  keys.right = false;
  createRoad(currentLevel);
  createObstacles(currentLevel);
  updateCrowdInstances(0);
  updateEnemyInstances();
  updateHud();
  updateCamera(0);
}

function startGame(index = currentLevelIndex) {
  resetLevel(index);
  gameState = "running";
  lastTime = performance.now();
  hideOverlay();
  startMusic();
}

function pauseGame() {
  if (gameState !== "running") return;
  gameState = "paused";
  music.pause();
  setOverlay("paused");
}

function resumeGame() {
  if (gameState !== "paused") return;
  gameState = "running";
  lastTime = performance.now();
  hideOverlay();
  startMusic();
}

function endGame(won) {
  if (gameState === "ended") return;
  gameState = "ended";
  music.pause();
  const progress = clamp(crowdZ / currentLevel.length, 0, 1);
  finalScore = won ? crowdCount : Math.max(0, Math.floor(crowdCount * 0.35 + progress * 18));
  if (!submittedThisRun) {
    submittedThisRun = true;
    window.ZIziLeaderboards?.tangsprint?.openSubmit(finalScore, { levelId: currentLevel.id });
  }
  if (won) unlockNextLevel();
  const detail = won
    ? `Score submitted: ${finalScore}. / 分数已准备提交：${finalScore}。`
    : `Distance: ${Math.round(progress * 100)}%. Score: ${finalScore}. / 距离：${Math.round(progress * 100)}%。分数：${finalScore}。`;
  setOverlay(won ? "win" : "lose", detail);
}

function updateHud() {
  const progress = clamp(crowdZ / currentLevel.length, 0, 1);
  hudLevel.textContent = `${currentLevelIndex + 1}`;
  hudCrowd.textContent = crowdCount.toLocaleString("zh-CN");
  hudScore.textContent = Math.max(0, Math.floor(crowdCount + progress * 25)).toLocaleString("zh-CN");
  hudThreat.textContent = getThreatText();
  progressFill.style.width = `${Math.round(progress * 100)}%`;
  if (crowdCount !== lastLabelCount) {
    lastLabelCount = crowdCount;
    updateTextSprite(crowdLabel, crowdCount.toLocaleString("zh-CN"));
  }
}

function getThreatText() {
  if (gameState !== "running") return "变态";
  const upcoming = [
    ...enemies.filter((enemy) => !enemy.triggered).map((enemy) => ({ z: enemy.z, label: `红队 ${enemy.count}` })),
    ...hazards.filter((hazard) => !hazard.triggered).map((hazard) => ({ z: hazard.z, label: `陷阱 ${hazard.label || ""}` })),
    ...sweepers.filter((sweeper) => !sweeper.triggered).map((sweeper) => ({ z: sweeper.z, label: `横扫 -${sweeper.count}` }))
  ]
    .filter((item) => item.z > crowdZ)
    .sort((a, b) => a.z - b.z)[0];
  if (!upcoming) return "冲线";
  const distance = Math.max(0, Math.round(upcoming.z - crowdZ));
  return `${distance}m ${upcoming.label}`;
}

function formationOffset(index, total) {
  const columns = Math.ceil(Math.sqrt(total));
  const row = Math.floor(index / columns);
  const col = index % columns;
  const spacing = total > 70 ? 0.34 : 0.42;
  const rows = Math.ceil(total / columns);
  const x = (col - (columns - 1) / 2) * spacing;
  const z = (row - (rows - 1) / 2) * spacing;
  return { x, z };
}

function heroOffset(index) {
  const offsets = [
    { x: -0.28, z: -0.2 },
    { x: 0.28, z: -0.2 },
    { x: -0.2, z: 0.32 },
    { x: 0.2, z: 0.32 }
  ];
  return offsets[index] || { x: 0, z: 0 };
}

function updateHeroRunners(time) {
  const heroVisible = Math.min(HERO_RUNNER_COUNT, crowdCount);
  heroRunnerGroup.position.set(crowdX, 0, crowdZ - 0.1);
  heroRunners.forEach((runner, index) => {
    runner.visible = index < heroVisible;
    if (!runner.visible) return;
    const offset = heroOffset(index);
    const bob = Math.sin(time * 9.5 + index * 0.9) * 0.045;
    runner.position.set(offset.x, 0.48 + bob, offset.z);
    runner.rotation.set(0, Math.sin(time * 4.6 + index) * 0.12, 0);
    runner.scale.setScalar(1.16);
  });
}

function updateCrowdInstances(time) {
  const visible = Math.min(MAX_RENDER_CROWD, crowdCount);
  const scale = crowdCount > MAX_RENDER_CROWD ? 0.9 : 1;
  for (let i = 0; i < visible; i += 1) {
    const offset = formationOffset(i, visible);
    const bob = Math.sin(time * 8 + i * 0.7) * 0.025;
    dummy.position.set(crowdX + offset.x * scale, 0.38 + bob, crowdZ + offset.z * scale);
    dummy.rotation.set(0, Math.sin(time * 4 + i) * 0.08, 0);
    dummy.scale.setScalar(1.08);
    dummy.updateMatrix();
    runnerOutline.setMatrixAt(i, dummy.matrix);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    blueCrowd.setMatrixAt(i, dummy.matrix);
    blueCrowd.setColorAt(i, runnerPalette[i % runnerPalette.length]);
  }
  for (let i = visible; i < MAX_RENDER_CROWD; i += 1) {
    dummy.position.set(0, -100, 0);
    dummy.updateMatrix();
    runnerOutline.setMatrixAt(i, dummy.matrix);
    blueCrowd.setMatrixAt(i, dummy.matrix);
  }
  runnerOutline.instanceMatrix.needsUpdate = true;
  blueCrowd.instanceMatrix.needsUpdate = true;
  if (blueCrowd.instanceColor) blueCrowd.instanceColor.needsUpdate = true;
  updateHeroRunners(time);
  crowdLabel.position.set(crowdX, 2.35, crowdZ - 0.25);
  const ringScale = clamp(Math.sqrt(Math.max(visible, 1)) * 0.16 + 0.72, 1.0, 2.45);
  playerRing.position.x = crowdX;
  playerRing.position.z = crowdZ;
  playerRing.scale.setScalar(ringScale);
}

function updateEnemyInstances() {
  let instance = 0;
  enemies.forEach((enemy) => {
    enemy.label.visible = !enemy.triggered;
    if (enemy.triggered) return;
    const visible = Math.min(MAX_RENDER_ENEMY_GROUP, enemy.count);
    for (let i = 0; i < visible && instance < enemyCrowd.count; i += 1) {
      const offset = formationOffset(i, visible);
      dummy.position.set(enemy.x + offset.x * 0.86, 0.38, enemy.z + offset.z * 0.86);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      enemyCrowd.setMatrixAt(instance, dummy.matrix);
      instance += 1;
    }
  });
  for (let i = instance; i < enemyCrowd.count; i += 1) {
    dummy.position.set(0, -100, 0);
    dummy.updateMatrix();
    enemyCrowd.setMatrixAt(i, dummy.matrix);
  }
  enemyCrowd.instanceMatrix.needsUpdate = true;
}

function triggerGate(gate) {
  gate.triggered = true;
  const formula = crowdX < 0 ? gate.left : gate.right;
  const before = crowdCount;
  crowdCount = clamp(Math.floor(applyGateFormula(crowdCount, formula)), 0, 999999999);
  gate.group.visible = false;
  addPopText(`${formula.replace(/x/i, "×")}  ${before}→${crowdCount}`, crowdX, gate.z, "#053b2c", "rgba(223, 255, 239, 0.95)");
  updateHud();
}

function collideEnemy(enemy) {
  enemy.triggered = true;
  enemy.label.visible = false;
  const loss = Math.min(crowdCount, enemy.count);
  crowdCount -= enemy.count;
  addPopText(`-${loss}`, enemy.x, enemy.z, "#ffffff", "rgba(190, 35, 61, 0.94)");
  if (crowdCount < 1) {
    crowdCount = 0;
    updateHud();
    updateEnemyInstances();
    endGame(false);
    return;
  }
  updateHud();
  updateEnemyInstances();
}

function triggerHazard(hazard) {
  hazard.triggered = true;
  hazard.parts.forEach((part) => {
    part.visible = false;
  });
  hazard.label.visible = false;
  const before = crowdCount;
  if (hazard.loss < 1) {
    crowdCount = Math.max(0, Math.floor(crowdCount * (1 - hazard.loss)));
  } else {
    crowdCount = Math.max(0, crowdCount - hazard.loss);
  }
  addPopText(`陷阱 ${before}→${crowdCount}`, hazard.x, hazard.z, "#ffffff", "rgba(43, 34, 51, 0.94)");
  updateHud();
  if (crowdCount < 1) endGame(false);
}

function collectPickup(pickup) {
  pickup.triggered = true;
  pickup.mesh.visible = false;
  pickup.label.visible = false;
  crowdCount = clamp(crowdCount + pickup.count, 0, 999999999);
  addPopText(`救援 +${pickup.count}`, pickup.x, pickup.z, "#053b2c", "rgba(223, 255, 239, 0.95)");
  updateHud();
}

function triggerSweeper(sweeper) {
  sweeper.triggered = true;
  sweeper.mesh.visible = false;
  sweeper.label.visible = false;
  const loss = Math.min(crowdCount, sweeper.count);
  crowdCount = Math.max(0, crowdCount - sweeper.count);
  addPopText(`横扫 -${loss}`, sweeper.x, sweeper.z, "#ffffff", "rgba(224, 47, 79, 0.94)");
  updateHud();
  if (crowdCount < 1) endGame(false);
}

function updateSweepers(time) {
  pickups.forEach((pickup) => {
    if (pickup.triggered) return;
    pickup.mesh.rotation.z = time * 2.8;
    pickup.mesh.position.y = 0.85 + Math.sin(time * 4 + pickup.z) * 0.08;
    pickup.label.position.y = 1.9 + Math.sin(time * 4 + pickup.z) * 0.08;
  });
  sweepers.forEach((sweeper) => {
    if (sweeper.triggered) return;
    sweeper.x = Math.sin(time * sweeper.speed + sweeper.phase) * sweeper.amplitude;
    sweeper.mesh.position.x = sweeper.x;
    sweeper.mesh.rotation.y = Math.sin(time * sweeper.speed * 1.7 + sweeper.phase) * 0.16;
    sweeper.label.position.x = sweeper.x;
  });
}

function updateCollisions(previousZ) {
  gates.forEach((gate) => {
    if (!gate.triggered && previousZ < gate.z && crowdZ >= gate.z) triggerGate(gate);
  });
  if (gameState !== "running") return;
  enemies.forEach((enemy) => {
    if (enemy.triggered) return;
    const dz = Math.abs(crowdZ - enemy.z);
    const dx = Math.abs(crowdX - enemy.x);
    const crowdRadius = clamp(Math.sqrt(Math.min(crowdCount, MAX_RENDER_CROWD)) * 0.16 + 0.45, 0.7, 1.8);
    if (dz < 1.25 && dx < crowdRadius + 0.85) collideEnemy(enemy);
  });
  if (gameState !== "running") return;
  hazards.forEach((hazard) => {
    if (hazard.triggered) return;
    const dz = Math.abs(crowdZ - hazard.z);
    const dx = Math.abs(crowdX - hazard.x);
    if (dz < 1.7 && dx < hazard.width * 0.5 + 0.42) triggerHazard(hazard);
  });
  if (gameState !== "running") return;
  pickups.forEach((pickup) => {
    if (pickup.triggered) return;
    const dz = Math.abs(crowdZ - pickup.z);
    const dx = Math.abs(crowdX - pickup.x);
    if (dz < 1.6 && dx < 0.9) collectPickup(pickup);
  });
  if (gameState !== "running") return;
  sweepers.forEach((sweeper) => {
    if (sweeper.triggered) return;
    const dz = Math.abs(crowdZ - sweeper.z);
    const dx = Math.abs(crowdX - sweeper.x);
    if (dz < 1.25 && dx < 1.55) triggerSweeper(sweeper);
  });
}

function updateCamera(dt) {
  const desiredX = crowdX * 0.58;
  const desiredY = 5.75;
  const desiredZ = crowdZ - 6.35;
  const ease = dt ? Math.min(1, dt * 8.5) : 1;
  camera.position.x += (desiredX - camera.position.x) * ease;
  camera.position.y += (desiredY - camera.position.y) * ease;
  camera.position.z += (desiredZ - camera.position.z) * ease;
  cameraTarget.set(crowdX * 0.46, 0.95, crowdZ + 3.9);
  camera.lookAt(cameraTarget);
}

function updateGame(dt, time) {
  const previousZ = crowdZ;
  if (keys.left) targetX += SIDE_SPEED * dt;
  if (keys.right) targetX -= SIDE_SPEED * dt;
  targetX = clamp(targetX, -ROAD_HALF, ROAD_HALF);
  crowdX += (targetX - crowdX) * Math.min(1, dt * 12);
  crowdX = clamp(crowdX, -ROAD_HALF, ROAD_HALF);
  crowdZ += (currentLevel.speed || PLAYER_SPEED) * dt;
  updateSweepers(time);
  updateCollisions(previousZ);
  updateCrowdInstances(time);
  updateEffects(dt);
  updateHud();
  if (crowdZ >= currentLevel.length && crowdCount >= 1) {
    crowdZ = currentLevel.length;
    endGame(true);
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000 || 0, 0.05);
  lastTime = now;
  const time = now / 1000;
  if (gameState === "running") updateGame(dt, time);
  updateCamera(dt);
  renderer.render(scene, camera);
}

function onPointerDown(event) {
  pointerActive = true;
  lastPointerX = event.clientX;
  canvas.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function onPointerMove(event) {
  if (!pointerActive) return;
  const delta = event.clientX - lastPointerX;
  lastPointerX = event.clientX;
  targetX = clamp(targetX - delta * POINTER_SCALE, -ROAD_HALF, ROAD_HALF);
  event.preventDefault();
}

function onPointerUp(event) {
  pointerActive = false;
  canvas.releasePointerCapture?.(event.pointerId);
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") keys.left = true;
  if (key === "arrowright" || key === "d") keys.right = true;
  if (key === "p" || key === "escape") {
    if (gameState === "running") pauseGame();
    else if (gameState === "paused") resumeGame();
  }
}

function onKeyUp(event) {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") keys.left = false;
  if (key === "arrowright" || key === "d") keys.right = false;
}

startButton.addEventListener("click", () => startGame(selectedLevelIndex));
restartButton.addEventListener("click", () => startGame(currentLevelIndex));
nextButton.addEventListener("click", () => startGame(currentLevelIndex + 1));
leaderboardButton.addEventListener("click", () => window.ZIziLeaderboards?.tangsprint?.open());
musicButton.addEventListener("click", () => music.toggle());
pauseButton.addEventListener("click", () => {
  if (gameState === "running") pauseGame();
  else if (gameState === "paused") resumeGame();
});
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("resize", resize);

resize();
resetLevel(0);
setOverlay("menu");
requestAnimationFrame(animate);
