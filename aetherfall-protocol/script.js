const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  overlay: document.getElementById("overlay"),
  start: document.getElementById("startButton"),
  mute: document.getElementById("muteButton"),
  score: document.getElementById("score"),
  wave: document.getElementById("wave"),
  timer: document.getElementById("timer"),
  bestScore: document.getElementById("bestScore"),
  bestTime: document.getElementById("bestTime"),
  health: document.getElementById("healthBar"),
  shield: document.getElementById("shieldBar"),
  pulse: document.getElementById("pulseBar"),
  pauseOverlay: document.getElementById("pauseOverlay"),
  resume: document.getElementById("resumeButton"),
  restart: document.getElementById("restartButton"),
  upgradeOverlay: document.getElementById("upgradeOverlay"),
  upgradeCards: document.getElementById("upgradeCards"),
};

const TAU = Math.PI * 2;
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const distSq = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};
const fmtTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem("starfall-muted") === "1";
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  tone(freq, duration = 0.08, type = "sine", gain = 0.05, slide = 0) {
    if (this.muted) return;
    this.ensure();
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  shot() {
    this.tone(560, 0.055, "square", 0.025, 180);
  }

  hit() {
    this.tone(118, 0.13, "sawtooth", 0.045, -55);
  }

  pickup() {
    this.tone(740, 0.1, "triangle", 0.04, 220);
  }

  pulse() {
    this.tone(210, 0.28, "sine", 0.07, 430);
  }

  level() {
    this.tone(440, 0.08, "triangle", 0.04, 220);
    setTimeout(() => this.tone(660, 0.12, "triangle", 0.035, 300), 90);
  }
}

class Entity {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.dead = false;
  }

  step(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}

class Projectile extends Entity {
  constructor(x, y, angle, speed, damage, color, pierce = 0) {
    super(x, y, 5);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.life = 1.25;
    this.color = color;
    this.pierce = pierce;
    this.angle = angle;
    this.hit = new Set();
  }

  update(game, dt) {
    this.step(dt);
    this.life -= dt;
    if (this.life <= 0 || this.x < -80 || this.y < -80 || this.x > game.w + 80 || this.y > game.h + 80) {
      this.dead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.shadowBlur = 16;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(-9, -2.5, 18, 5, 3);
    ctx.fill();
    ctx.restore();
  }
}

class Enemy extends Entity {
  constructor(game, type, x, y) {
    const specs = {
      seeker: { r: 16, hp: 36, speed: 82, color: "#ff5d73", score: 45 },
      skitter: { r: 10, hp: 18, speed: 142, color: "#ffc857", score: 30 },
      bulwark: { r: 24, hp: 130, speed: 46, color: "#65a8ff", score: 120 },
      warden: { r: 36, hp: 680, speed: 55, color: "#d7ff65", score: 900 },
    };
    const spec = specs[type];
    super(x, y, spec.r);
    Object.assign(this, spec);
    this.type = type;
    this.maxHp = this.hp;
    this.phase = rand(0, TAU);
    this.attackTimer = rand(0.6, 1.8);
  }

  update(game, dt) {
    const player = game.player;
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const wobble = Math.sin(game.time * 2.3 + this.phase) * (this.type === "skitter" ? 1.5 : 0.55);
    const speed = this.speed * game.difficulty;
    this.vx = Math.cos(angle + wobble) * speed;
    this.vy = Math.sin(angle + wobble) * speed;

    if (this.type === "bulwark") {
      this.vx *= 0.74;
      this.vy *= 0.74;
    }

    if (this.type === "warden") {
      this.vx += Math.cos(game.time * 0.9) * 38;
      this.vy += Math.sin(game.time * 1.1) * 38;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackTimer = Math.max(0.55, 1.55 - game.wave * 0.025);
        for (let i = 0; i < 14; i++) {
          game.enemyShots.push(new EnemyShot(this.x, this.y, (i / 14) * TAU + game.time * 0.7));
        }
      }
    }

    this.step(dt);
  }

  hurt(game, damage) {
    this.hp -= damage;
    game.flashAt(this.x, this.y, this.color, 5);
    if (this.hp <= 0) {
      this.dead = true;
      game.score += this.score;
      const shards = this.type === "warden" ? 16 : this.type === "bulwark" ? 5 : 2;
      for (let i = 0; i < shards; i++) game.pickups.push(new Shard(this.x, this.y));
      game.audio.hit();
      game.burst(this.x, this.y, this.color, this.type === "warden" ? 70 : 22);
    }
  }

  draw(ctx) {
    const pulse = 1 + Math.sin(performance.now() * 0.006 + this.phase) * 0.05;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pulse, pulse);
    ctx.shadowBlur = 22;
    ctx.shadowColor = this.color;
    ctx.fillStyle = "rgba(8, 10, 13, 0.88)";
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.type === "warden" ? 4 : 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + this.phase;
      const r = this.radius * (i % 2 ? 0.75 : 1.1);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (this.type === "warden") {
      ctx.strokeStyle = "rgba(215, 255, 101, 0.38)";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 13, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class EnemyShot extends Entity {
  constructor(x, y, angle) {
    super(x, y, 7);
    this.vx = Math.cos(angle) * 145;
    this.vy = Math.sin(angle) * 145;
    this.life = 4.5;
  }

  update(game, dt) {
    this.step(dt);
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#d7ff65";
    ctx.fillStyle = "#d7ff65";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

class Particle extends Entity {
  constructor(x, y, color, speed, life, size) {
    super(x, y, size);
    const a = rand(0, TAU);
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
    this.color = color;
    this.life = life;
    this.maxLife = life;
  }

  update(dt) {
    this.step(dt);
    this.vx *= 0.985;
    this.vy *= 0.985;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    ctx.globalAlpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class Shard extends Entity {
  constructor(x, y) {
    super(x, y, 6);
    const a = rand(0, TAU);
    const speed = rand(55, 210);
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
    this.life = 16;
    this.spin = rand(0, TAU);
  }

  update(game, dt) {
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const pullRange = 95 * player.magnet;
    if (d < pullRange) {
      const force = (1 - d / pullRange) * 920;
      this.vx += (dx / d) * force * dt;
      this.vy += (dy / d) * force * dt;
    }
    this.step(dt);
    this.vx *= 0.982;
    this.vy *= 0.982;
    this.spin += dt * 6;
    this.life -= dt;
    if (d < player.radius + this.radius) {
      this.dead = true;
      game.shards += 1;
      game.score += 8;
      game.audio.pickup();
      game.flashAt(this.x, this.y, "#ffc857", 4);
    }
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#ffc857";
    ctx.fillStyle = "#ffc857";
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

class Player extends Entity {
  constructor(game) {
    super(game.w / 2, game.h / 2, 18);
    this.maxHealth = 120;
    this.health = this.maxHealth;
    this.maxShield = 80;
    this.shield = this.maxShield;
    this.speed = 250;
    this.fireRate = 0.16;
    this.fireTimer = 0;
    this.damage = 22;
    this.projectiles = 1;
    this.pierce = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.pulseCooldownMax = 5.5;
    this.pulseCooldown = 0;
    this.invuln = 0;
    this.magnet = 1;
  }

  update(game, dt) {
    const input = game.input;
    let ax = 0;
    let ay = 0;
    if (input.keys.has("KeyW") || input.keys.has("ArrowUp")) ay -= 1;
    if (input.keys.has("KeyS") || input.keys.has("ArrowDown")) ay += 1;
    if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) ax -= 1;
    if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) ax += 1;
    const len = Math.hypot(ax, ay) || 1;
    ax /= len;
    ay /= len;

    const dashReady = this.dashCooldown <= 0;
    if (input.keys.has("Space") && dashReady && (ax || ay)) {
      this.dashTimer = 0.14;
      this.dashCooldown = 1.2;
      this.invuln = 0.24;
      game.shake = Math.max(game.shake, 8);
      game.burst(this.x, this.y, "#42f5d4", 20);
      game.audio.tone(180, 0.12, "triangle", 0.05, 280);
    }

    const dashMul = this.dashTimer > 0 ? 3.2 : 1;
    this.vx = lerp(this.vx, ax * this.speed * dashMul, 0.2);
    this.vy = lerp(this.vy, ay * this.speed * dashMul, 0.2);
    this.step(dt);
    this.x = clamp(this.x, this.radius, game.w - this.radius);
    this.y = clamp(this.y, this.radius, game.h - this.radius);

    this.fireTimer -= dt;
    this.dashTimer -= dt;
    this.dashCooldown -= dt;
    this.pulseCooldown -= dt;
    this.invuln -= dt;
    this.shield = Math.min(this.maxShield, this.shield + dt * 7);

    if ((input.mouseDown || input.keys.has("KeyF")) && this.fireTimer <= 0) {
      this.shoot(game);
      this.fireTimer = this.fireRate;
    }

    if (input.keys.has("KeyE") && this.pulseCooldown <= 0) {
      this.pulse(game);
    }
  }

  shoot(game) {
    const aim = Math.atan2(game.input.mouse.y - this.y, game.input.mouse.x - this.x);
    const spread = Math.min(0.44, 0.12 * (this.projectiles - 1));
    for (let i = 0; i < this.projectiles; i++) {
      const t = this.projectiles === 1 ? 0 : i / (this.projectiles - 1) - 0.5;
      const angle = aim + t * spread;
      game.projectiles.push(new Projectile(this.x, this.y, angle, 720, this.damage, "#42f5d4", this.pierce));
    }
    game.audio.shot();
  }

  pulse(game) {
    this.pulseCooldown = this.pulseCooldownMax;
    game.shake = Math.max(game.shake, 12);
    game.audio.pulse();
    for (const enemy of game.enemies) {
      const d = Math.sqrt(distSq(this, enemy));
      if (d < 230) {
        enemy.hurt(game, 58 + game.wave * 2);
        const push = (230 - d) * 2.8;
        const a = Math.atan2(enemy.y - this.y, enemy.x - this.x);
        enemy.vx += Math.cos(a) * push;
        enemy.vy += Math.sin(a) * push;
      }
    }
    for (let i = 0; i < 90; i++) game.particles.push(new Particle(this.x, this.y, "#8cff8a", rand(60, 520), rand(0.28, 0.8), rand(1, 4)));
  }

  hurt(game, amount) {
    if (this.invuln > 0) return;
    const blocked = Math.min(this.shield, amount);
    this.shield -= blocked;
    this.health -= amount - blocked;
    this.invuln = 0.55;
    game.shake = Math.max(game.shake, 11);
    game.audio.hit();
    game.burst(this.x, this.y, "#ff5d73", 26);
    if (this.health <= 0) game.end(false);
  }

  draw(ctx, game) {
    const aim = Math.atan2(game.input.mouse.y - this.y, game.input.mouse.x - this.x);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(aim);
    ctx.globalAlpha = this.invuln > 0 ? 0.58 + Math.sin(game.time * 38) * 0.26 : 1;
    ctx.shadowBlur = 24;
    ctx.shadowColor = "#42f5d4";
    ctx.fillStyle = "#0b1718";
    ctx.strokeStyle = "#42f5d4";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-15, -15);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-15, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffc857";
    ctx.beginPath();
    ctx.arc(2, 0, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

const upgrades = [
  { icon: "+", name: "裂光弹幕", desc: "每次射击额外发射一枚光弹，散射角自动收束。", stat: "火力 +1", apply: (p) => (p.projectiles += 1) },
  { icon: "*", name: "高能聚焦", desc: "主武器伤害提升，适合快速熔穿重甲目标。", stat: "伤害 +28%", apply: (p) => (p.damage *= 1.28) },
  { icon: ">", name: "过载扳机", desc: "缩短开火间隔，让武器进入更稳定的持续输出。", stat: "射速 +18%", apply: (p) => (p.fireRate *= 0.82) },
  { icon: "O", name: "相位护盾", desc: "扩展护盾容量，并提高容错空间。", stat: "护盾 +35", apply: (p) => ((p.maxShield += 35), (p.shield += 35)) },
  { icon: "^", name: "离子引擎", desc: "提高移动速度，冲刺恢复也更快。", stat: "机动 +14%", apply: (p) => ((p.speed *= 1.14), (p.dashCooldown -= 0.18)) },
  { icon: "=", name: "穿透导轨", desc: "光弹可额外穿透目标，面对密集波次更有效。", stat: "穿透 +1", apply: (p) => (p.pierce += 1) },
  { icon: "#", name: "碎片磁场", desc: "扩大碎片吸附范围，升级节奏更顺畅。", stat: "吸附 +40%", apply: (p) => (p.magnet *= 1.4) },
  { icon: "!", name: "核心修复", desc: "立即修复核心结构，并提高最大耐久。", stat: "生命 +30", apply: (p) => ((p.maxHealth += 30), (p.health = Math.min(p.maxHealth, p.health + 65))) },
  { icon: "~", name: "脉冲冷凝", desc: "脉冲释放更频繁，近身压力会被更快清空。", stat: "技能冷却 -22%", apply: (p) => (p.pulseCooldownMax *= 0.78) },
];

class Game {
  constructor() {
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.audio = new AudioEngine();
    this.input = { keys: new Set(), mouse: { x: 0, y: 0 }, mouseDown: false };
    this.stars = [];
    this.state = "menu";
    this.high = JSON.parse(localStorage.getItem("starfall-record") || '{"score":0,"time":0}');
    this.updateRecordUI();
    this.bind();
    this.resize();
    this.reset();
    requestAnimationFrame((t) => this.frame(t));
  }

  bind() {
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("keydown", (e) => {
      this.input.keys.add(e.code);
      if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) {
        e.preventDefault();
        this.togglePause();
      }
      if (e.code === "Enter" && (this.state === "menu" || this.state === "gameover")) this.start();
    });
    window.addEventListener("keyup", (e) => this.input.keys.delete(e.code));
    canvas.addEventListener("pointermove", (e) => this.setMouse(e));
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.setMouse(e);
      this.input.mouseDown = true;
      if (this.state === "menu") this.start();
    });
    canvas.addEventListener("pointerup", () => (this.input.mouseDown = false));
    ui.start.addEventListener("click", () => this.start());
    ui.resume.addEventListener("click", () => this.resume());
    ui.restart.addEventListener("click", () => this.start());
    ui.mute.addEventListener("click", () => {
      this.audio.muted = !this.audio.muted;
      localStorage.setItem("starfall-muted", this.audio.muted ? "1" : "0");
      this.updateMute();
    });
    this.updateMute();
  }

  setMouse(e) {
    const rect = canvas.getBoundingClientRect();
    this.input.mouse.x = e.clientX - rect.left;
    this.input.mouse.y = e.clientY - rect.top;
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    canvas.width = Math.floor(this.w * this.dpr);
    canvas.height = Math.floor(this.h * this.dpr);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.input.mouse.x = this.w / 2;
    this.input.mouse.y = this.h / 2;
    this.stars = Array.from({ length: Math.floor((this.w * this.h) / 10500) }, () => ({
      x: rand(0, this.w),
      y: rand(0, this.h),
      z: rand(0.2, 1),
      r: rand(0.5, 1.8),
    }));
  }

  reset() {
    this.player = new Player(this);
    this.projectiles = [];
    this.enemyShots = [];
    this.enemies = [];
    this.particles = [];
    this.pickups = [];
    this.shards = 0;
    this.nextLevel = 7;
    this.level = 1;
    this.wave = 1;
    this.score = 0;
    this.time = 0;
    this.spawnTimer = 0.4;
    this.waveTimer = 12;
    this.shake = 0;
    this.difficulty = 1;
    this.bossSpawned = false;
  }

  start() {
    this.audio.ensure();
    this.reset();
    this.state = "playing";
    this.input.keys.clear();
    this.input.mouseDown = false;
    ui.overlay.classList.remove("show");
    ui.pauseOverlay.classList.remove("show");
    ui.upgradeOverlay.classList.remove("show");
  }

  togglePause() {
    if (this.state === "playing") this.pause();
    else if (this.state === "paused") this.resume();
  }

  pause() {
    this.state = "paused";
    this.input.keys.clear();
    this.input.mouseDown = false;
    ui.pauseOverlay.classList.add("show");
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.input.keys.clear();
    this.input.mouseDown = false;
    ui.pauseOverlay.classList.remove("show");
  }

  end(won) {
    this.state = "gameover";
    this.high.score = Math.max(this.high.score, Math.floor(this.score));
    this.high.time = Math.max(this.high.time, Math.floor(this.time));
    localStorage.setItem("starfall-record", JSON.stringify(this.high));
    this.updateRecordUI();
    ui.pauseOverlay.classList.remove("show");
    ui.overlay.classList.add("show");
    ui.start.textContent = won ? "再次进入" : "重新部署";
    document.querySelector(".panel h1").textContent = won ? "Starfall Clear" : "Signal Lost";
    document.querySelector(".copy").textContent = won
      ? `最终监察者已被击溃。本次得分 ${Math.floor(this.score)}，生存 ${fmtTime(this.time)}。`
      : `核心信号中断。本次得分 ${Math.floor(this.score)}，生存 ${fmtTime(this.time)}。`;
  }

  updateRecordUI() {
    ui.bestScore.textContent = this.high.score.toLocaleString("zh-CN");
    ui.bestTime.textContent = fmtTime(this.high.time || 0);
  }

  updateMute() {
    ui.mute.textContent = this.audio.muted ? "音效关闭" : "音效开启";
  }

  frame(now) {
    const dt = Math.min(0.033, (now - (this.last || now)) / 1000);
    this.last = now;
    if (this.state === "playing") this.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    this.time += dt;
    this.difficulty = 1 + this.wave * 0.035 + this.time * 0.002;
    this.shake = Math.max(0, this.shake - dt * 24);

    this.player.update(this, dt);
    this.spawnTimer -= dt;
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) this.nextWave();
    if (this.spawnTimer <= 0) this.spawnEnemyPack();

    for (const item of [...this.projectiles, ...this.enemyShots]) item.update(this, dt);
    for (const enemy of this.enemies) enemy.update(this, dt);
    for (const pickup of this.pickups) pickup.update(this, dt);
    for (const particle of this.particles) particle.update(dt);

    this.handleCollisions();
    this.collectShards(dt);
    this.cleanup();
    this.updateHud();
  }

  nextWave() {
    this.wave += 1;
    this.waveTimer = Math.max(8, 13 - this.wave * 0.35);
    this.spawnTimer = 0.05;
    this.score += 120 + this.wave * 20;
    if (this.wave === 12 && !this.bossSpawned) {
      this.bossSpawned = true;
      const p = this.spawnPoint(90);
      this.enemies.push(new Enemy(this, "warden", p.x, p.y));
      this.audio.level();
    }
  }

  spawnEnemyPack() {
    const count = this.wave > 8 ? 3 : this.wave > 4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let type = "seeker";
      if (this.wave > 2 && roll < 0.32) type = "skitter";
      if (this.wave > 5 && roll > 0.78) type = "bulwark";
      const p = this.spawnPoint(60);
      this.enemies.push(new Enemy(this, type, p.x, p.y));
    }
    this.spawnTimer = clamp(1.05 - this.wave * 0.045, 0.32, 1.05);
  }

  spawnPoint(pad) {
    const side = Math.floor(rand(0, 4));
    if (side === 0) return { x: rand(0, this.w), y: -pad };
    if (side === 1) return { x: this.w + pad, y: rand(0, this.h) };
    if (side === 2) return { x: rand(0, this.w), y: this.h + pad };
    return { x: -pad, y: rand(0, this.h) };
  }

  handleCollisions() {
    for (const shot of this.projectiles) {
      for (const enemy of this.enemies) {
        if (enemy.dead || shot.hit.has(enemy)) continue;
        const r = shot.radius + enemy.radius;
        if (distSq(shot, enemy) < r * r) {
          shot.hit.add(enemy);
          enemy.hurt(this, shot.damage);
          this.burst(shot.x, shot.y, "#42f5d4", 5);
          if (shot.pierce > 0) shot.pierce -= 1;
          else shot.dead = true;
          break;
        }
      }
    }

    for (const enemy of this.enemies) {
      const r = enemy.radius + this.player.radius;
      if (!enemy.dead && distSq(enemy, this.player) < r * r) {
        enemy.dead = enemy.type !== "warden";
        this.player.hurt(this, enemy.type === "warden" ? 32 : enemy.type === "bulwark" ? 28 : 18);
      }
    }

    for (const shot of this.enemyShots) {
      const r = shot.radius + this.player.radius;
      if (!shot.dead && distSq(shot, this.player) < r * r) {
        shot.dead = true;
        this.player.hurt(this, 18);
      }
    }

    if (this.bossSpawned && this.wave >= 12 && !this.enemies.some((e) => e.type === "warden" && !e.dead)) {
      this.end(true);
    }
  }

  collectShards(dt) {
    if (this.shards >= this.nextLevel) {
      this.shards -= this.nextLevel;
      this.nextLevel = Math.floor(this.nextLevel * 1.32 + 4);
      this.level += 1;
      this.offerUpgrade();
      return;
    }

    if (Math.random() < dt * Math.min(2, this.shards)) {
      this.particles.push(new Particle(this.player.x, this.player.y, "#ffc857", rand(20, 120), 0.35, rand(1.5, 3)));
    }
  }

  offerUpgrade() {
    this.state = "upgrade";
    this.audio.level();
    ui.pauseOverlay.classList.remove("show");
    ui.upgradeCards.innerHTML = "";
    const choices = [...upgrades].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const option of choices) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "upgrade-card";
      card.innerHTML = `<span class="icon">${option.icon}</span><strong>${option.name}</strong><p>${option.desc}</p><small>${option.stat}</small>`;
      card.addEventListener("click", () => {
        option.apply(this.player);
        this.state = "playing";
        ui.upgradeOverlay.classList.remove("show");
        this.audio.pickup();
      });
      ui.upgradeCards.appendChild(card);
    }
    ui.upgradeOverlay.classList.add("show");
  }

  cleanup() {
    this.projectiles = this.projectiles.filter((x) => !x.dead);
    this.enemyShots = this.enemyShots.filter((x) => !x.dead);
    this.enemies = this.enemies.filter((x) => !x.dead);
    this.particles = this.particles.filter((x) => !x.dead);
    this.pickups = this.pickups.filter((x) => !x.dead);
  }

  burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, color, rand(60, 340), rand(0.25, 0.72), rand(1, 4)));
    }
  }

  flashAt(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, color, rand(20, 110), rand(0.12, 0.28), rand(1, 2.8)));
    }
  }

  updateHud() {
    ui.score.textContent = Math.floor(this.score).toLocaleString("zh-CN");
    ui.wave.textContent = `Wave ${this.wave}`;
    ui.timer.textContent = fmtTime(this.time);
    ui.health.style.transform = `scaleX(${clamp(this.player.health / this.player.maxHealth, 0, 1)})`;
    ui.shield.style.transform = `scaleX(${clamp(this.player.shield / this.player.maxShield, 0, 1)})`;
    ui.pulse.style.transform = `scaleX(${1 - clamp(this.player.pulseCooldown / this.player.pulseCooldownMax, 0, 1)})`;
  }

  draw() {
    ctx.save();
    const sx = this.shake ? rand(-this.shake, this.shake) : 0;
    const sy = this.shake ? rand(-this.shake, this.shake) : 0;
    ctx.translate(sx, sy);
    this.drawBackground();
    for (const particle of this.particles) particle.draw(ctx);
    for (const pickup of this.pickups) pickup.draw(ctx);
    for (const shot of this.enemyShots) shot.draw(ctx);
    for (const projectile of this.projectiles) projectile.draw(ctx);
    for (const enemy of this.enemies) enemy.draw(ctx);
    this.player.draw(ctx, this);
    this.drawReticle();
    if (this.state === "paused") this.drawPause();
    ctx.restore();
  }

  drawBackground() {
    ctx.clearRect(-40, -40, this.w + 80, this.h + 80);
    const g = ctx.createRadialGradient(this.w * 0.5, this.h * 0.5, 50, this.w * 0.5, this.h * 0.5, Math.max(this.w, this.h));
    g.addColorStop(0, "#111920");
    g.addColorStop(0.55, "#0a0d11");
    g.addColorStop(1, "#050607");
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, this.w + 80, this.h + 80);

    ctx.strokeStyle = "rgba(66, 245, 212, 0.07)";
    ctx.lineWidth = 1;
    const grid = 72;
    const ox = (this.time * 18) % grid;
    const oy = (this.time * 11) % grid;
    for (let x = -grid + ox; x < this.w + grid; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.h);
      ctx.stroke();
    }
    for (let y = -grid + oy; y < this.h + grid; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.w, y);
      ctx.stroke();
    }

    for (const s of this.stars) {
      s.y += s.z * 0.16;
      if (s.y > this.h) s.y = 0;
      ctx.globalAlpha = 0.25 + s.z * 0.55;
      ctx.fillStyle = s.z > 0.7 ? "#ffc857" : "#eef6f5";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawReticle() {
    const m = this.input.mouse;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 200, 87, 0.82)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 14, 0, TAU);
    ctx.moveTo(m.x - 22, m.y);
    ctx.lineTo(m.x - 7, m.y);
    ctx.moveTo(m.x + 7, m.y);
    ctx.lineTo(m.x + 22, m.y);
    ctx.moveTo(m.x, m.y - 22);
    ctx.lineTo(m.x, m.y - 7);
    ctx.moveTo(m.x, m.y + 7);
    ctx.lineTo(m.x, m.y + 22);
    ctx.stroke();
    ctx.restore();
  }

  drawPause() {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.44)";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.fillStyle = "#eef6f5";
    ctx.textAlign = "center";
    ctx.font = "800 36px system-ui";
    ctx.fillText("PAUSED", this.w / 2, this.h / 2);
    ctx.font = "14px system-ui";
    ctx.fillStyle = "#9aa8ad";
    ctx.fillText("Press ESC to resume", this.w / 2, this.h / 2 + 32);
    ctx.restore();
  }
}

new Game();
