import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { setupLeaderboard } from "../assets/leaderboard.js";

const GAME_ID = "bluecrowd";
const GAME_NAME = "Blue Crowd Rush / 蓝色人群冲刺";
const ROAD_WIDTH = 9;
const ROAD_HALF = ROAD_WIDTH / 2 - 0.48;
const MAX_RENDER_CROWD = 100;
const MAX_RENDER_ENEMY_GROUP = 45;
const PLAYER_SPEED = 10;
const SIDE_SPEED = 8.2;
const POINTER_SCALE = 0.018;

const levels = [
  {
    name: "Level 1 / 教学关",
    length: 180,
    startCount: 1,
    speed: 9,
    gates: [
      { z: 30, left: "+10", right: "x2" },
      { z: 78, left: "+15", right: "+8" },
      { z: 128, left: "x2", right: "+20" }
    ],
    enemies: [
      { z: 55, x: 2.5, count: 8 },
      { z: 108, x: -2.4, count: 12 },
      { z: 158, x: 0, count: 18 }
    ]
  },
  {
    name: "Level 2 / 中等冲刺",
    length: 245,
    startCount: 8,
    speed: 10,
    gates: [
      { z: 32, left: "+12", right: "x2" },
      { z: 84, left: "x2", right: "+25" },
      { z: 138, left: "+18", right: "x3" },
      { z: 194, left: "x2", right: "+30" }
    ],
    enemies: [
      { z: 58, x: -2.7, count: 15 },
      { z: 112, x: 2.7, count: 24 },
      { z: 166, x: 0, count: 36 },
      { z: 220, x: -2.3, count: 48 }
    ]
  },
  {
    name: "Level 3 / 红色夹击",
    length: 310,
    startCount: 12,
    speed: 10.8,
    gates: [
      { z: 36, left: "x2", right: "+20" },
      { z: 90, left: "+25", right: "x3" },
      { z: 148, left: "x2", right: "+35" },
      { z: 210, left: "+45", right: "x2" },
      { z: 266, left: "x3", right: "+30" }
    ],
    enemies: [
      { z: 64, x: 0, count: 20 },
      { z: 122, x: -2.8, count: 34 },
      { z: 180, x: 2.6, count: 52 },
      { z: 238, x: 0.2, count: 70 },
      { z: 288, x: -2.6, count: 82 }
    ]
  }
];

const canvas = document.getElementById("gameCanvas");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const nextButton = document.getElementById("nextButton");
const leaderboardButton = document.getElementById("leaderboardButton");
const pauseButton = document.getElementById("pauseButton");
const hudLevel = document.getElementById("hudLevel");
const hudCrowd = document.getElementById("hudCrowd");
const hudScore = document.getElementById("hudScore");
const progressFill = document.getElementById("progressFill");

window.ZIziLeaderboards = window.ZIziLeaderboards || {};
window.ZIziLeaderboards.bluecrowd = setupLeaderboard({
  gameId: GAME_ID,
  gameName: GAME_NAME
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fdaf8);
scene.fog = new THREE.Fog(0x9fdaf8, 60, 250);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 500);
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
  blue: new THREE.MeshStandardMaterial({ color: 0x1689ff, roughness: 0.42, metalness: 0.02 }),
  red: new THREE.MeshStandardMaterial({ color: 0xff4258, roughness: 0.48, metalness: 0.02 }),
  gateLeft: new THREE.MeshStandardMaterial({ color: 0x21c7ad, transparent: true, opacity: 0.28, roughness: 0.25 }),
  gateRight: new THREE.MeshStandardMaterial({ color: 0x5b8def, transparent: true, opacity: 0.28, roughness: 0.25 }),
  gateFrame: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.36, emissive: 0x77d9ff, emissiveIntensity: 0.15 }),
  hidden: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
};

const crowdGeometry = new THREE.CapsuleGeometry(0.18, 0.42, 4, 8);
const blueCrowd = new THREE.InstancedMesh(crowdGeometry, materials.blue, MAX_RENDER_CROWD);
blueCrowd.castShadow = true;
blueCrowd.receiveShadow = true;
scene.add(blueCrowd);

const enemyCrowd = new THREE.InstancedMesh(crowdGeometry, materials.red, 350);
enemyCrowd.castShadow = true;
enemyCrowd.receiveShadow = true;
scene.add(enemyCrowd);

const roadGroup = new THREE.Group();
const obstacleGroup = new THREE.Group();
const labelGroup = new THREE.Group();
scene.add(roadGroup, obstacleGroup, labelGroup);

const dummy = new THREE.Object3D();
const cameraTarget = new THREE.Vector3();
const gateBoxGeometry = new THREE.BoxGeometry(0.18, 2.6, 0.18);
const gateTopGeometry = new THREE.BoxGeometry(2.85, 0.18, 0.18);
const gatePlaneGeometry = new THREE.PlaneGeometry(2.85, 2.1);

let currentLevelIndex = 0;
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
let pointerActive = false;
let lastPointerX = 0;
const keys = { left: false, right: false };

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
  const clean = String(formula).trim().toLowerCase().replace("×", "x");
  if (clean.startsWith("+")) return value + Number(clean.slice(1) || 0);
  if (clean.startsWith("x")) return value * Math.max(1, Number(clean.slice(1) || 1));
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

function createRoad(level) {
  clearGroup(roadGroup);
  const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH, 0.24, level.length + 24), materials.road);
  road.position.set(0, -0.12, level.length / 2);
  road.receiveShadow = true;
  roadGroup.add(road);

  for (let x = -ROAD_WIDTH / 2 - 0.32; x <= ROAD_WIDTH / 2 + 0.32; x += ROAD_WIDTH + 0.64) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, level.length + 24), materials.side);
    rail.position.set(x, 0.1, level.length / 2);
    rail.receiveShadow = true;
    roadGroup.add(rail);
  }

  for (let z = 12; z < level.length; z += 16) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 5), materials.lane);
    mark.position.set(0, 0.025, z);
    roadGroup.add(mark);
  }

  const finish = new THREE.Group();
  finish.position.z = level.length;
  for (let i = 0; i < 8; i += 1) {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH / 8, 0.04, 1.3), i % 2 ? materials.lane : materials.finish);
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
    return { ...enemy, label, triggered: false };
  });
}

function setOverlay(mode, details = "") {
  overlay.hidden = false;
  startButton.hidden = mode !== "menu";
  restartButton.hidden = mode === "menu";
  nextButton.hidden = mode !== "win" || currentLevelIndex >= levels.length - 1;
  leaderboardButton.hidden = mode === "menu";
  if (mode === "menu") {
    overlayTitle.textContent = GAME_NAME;
    overlayText.textContent = "Lead the blue crowd through boost gates, dodge red rivals, and rush as many runners to the finish as you can.";
  } else if (mode === "paused") {
    overlayTitle.textContent = "Paused / 已暂停";
    overlayText.textContent = "Press P or Esc to keep running. / 按 P 或 Esc 继续冲刺。";
  } else if (mode === "win") {
    overlayTitle.textContent = "Level Complete / 关卡完成";
    overlayText.textContent = `Final Crowd: ${crowdCount}. ${details}`;
  } else {
    overlayTitle.textContent = "Game Over / 游戏失败";
    overlayText.textContent = details || "The red crowd stopped your run. Try a better gate route next time.";
  }
}

function hideOverlay() {
  overlay.hidden = true;
}

function resetLevel(index = currentLevelIndex) {
  currentLevelIndex = clamp(index, 0, levels.length - 1);
  currentLevel = levels[currentLevelIndex];
  crowdCount = currentLevel.startCount;
  crowdX = 0;
  targetX = 0;
  crowdZ = 0;
  lastLabelCount = -1;
  submittedThisRun = false;
  finalScore = 0;
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
}

function pauseGame() {
  if (gameState !== "running") return;
  gameState = "paused";
  setOverlay("paused");
}

function resumeGame() {
  if (gameState !== "paused") return;
  gameState = "running";
  lastTime = performance.now();
  hideOverlay();
}

function endGame(won) {
  if (gameState === "ended") return;
  gameState = "ended";
  const progress = clamp(crowdZ / currentLevel.length, 0, 1);
  finalScore = won ? crowdCount : Math.max(0, Math.floor(crowdCount * 0.35 + progress * 18));
  if (!submittedThisRun) {
    submittedThisRun = true;
    window.ZIziLeaderboards?.bluecrowd?.openSubmit(finalScore);
  }
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
  progressFill.style.width = `${Math.round(progress * 100)}%`;
  if (crowdCount !== lastLabelCount) {
    lastLabelCount = crowdCount;
    updateTextSprite(crowdLabel, crowdCount.toLocaleString("zh-CN"));
  }
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

function updateCrowdInstances(time) {
  const visible = Math.min(MAX_RENDER_CROWD, crowdCount);
  const scale = crowdCount > MAX_RENDER_CROWD ? 0.9 : 1;
  for (let i = 0; i < visible; i += 1) {
    const offset = formationOffset(i, visible);
    const bob = Math.sin(time * 8 + i * 0.7) * 0.025;
    dummy.position.set(crowdX + offset.x * scale, 0.38 + bob, crowdZ + offset.z * scale);
    dummy.rotation.set(0, Math.sin(time * 4 + i) * 0.08, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    blueCrowd.setMatrixAt(i, dummy.matrix);
  }
  for (let i = visible; i < MAX_RENDER_CROWD; i += 1) {
    dummy.position.set(0, -100, 0);
    dummy.updateMatrix();
    blueCrowd.setMatrixAt(i, dummy.matrix);
  }
  blueCrowd.instanceMatrix.needsUpdate = true;
  crowdLabel.position.set(crowdX, 2.35, crowdZ - 0.25);
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
  crowdCount = clamp(Math.floor(applyGateFormula(crowdCount, formula)), 0, 999999999);
  gate.group.visible = false;
  updateHud();
}

function collideEnemy(enemy) {
  enemy.triggered = true;
  enemy.label.visible = false;
  crowdCount -= enemy.count;
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

function updateCollisions(previousZ) {
  gates.forEach((gate) => {
    if (!gate.triggered && previousZ < gate.z && crowdZ >= gate.z) triggerGate(gate);
  });
  enemies.forEach((enemy) => {
    if (enemy.triggered) return;
    const dz = Math.abs(crowdZ - enemy.z);
    const dx = Math.abs(crowdX - enemy.x);
    const crowdRadius = clamp(Math.sqrt(Math.min(crowdCount, MAX_RENDER_CROWD)) * 0.16 + 0.45, 0.7, 1.8);
    if (dz < 1.25 && dx < crowdRadius + 0.85) collideEnemy(enemy);
  });
}

function updateCamera(dt) {
  const desiredX = crowdX * 0.34;
  const desiredY = 7.1;
  const desiredZ = crowdZ - 10.2;
  const ease = dt ? Math.min(1, dt * 6) : 1;
  camera.position.x += (desiredX - camera.position.x) * ease;
  camera.position.y += (desiredY - camera.position.y) * ease;
  camera.position.z += (desiredZ - camera.position.z) * ease;
  cameraTarget.set(crowdX * 0.24, 1.1, crowdZ + 11);
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
  updateCollisions(previousZ);
  updateCrowdInstances(time);
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

startButton.addEventListener("click", () => startGame(0));
restartButton.addEventListener("click", () => startGame(currentLevelIndex));
nextButton.addEventListener("click", () => startGame(currentLevelIndex + 1));
leaderboardButton.addEventListener("click", () => window.ZIziLeaderboards?.bluecrowd?.open());
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
