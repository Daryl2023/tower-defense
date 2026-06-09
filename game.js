"use strict";

// ===== 基础配置 =====
const TILE = 60;
const COLS = 16;
const ROWS = 10;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// 关卡当前状态（由 loadLevel 填充）
let path = [];
let pathBlocked = new Set();
let waves = [];

// ===== 兵种原型（决定战斗方式）=====
const ARCHETYPES = {
  archer:     { range: 130, damage: 14, fireRate: 0.45, splash: 0,  projColor: "#e8e0c0", projSpeed: 480 },
  spear:      { range: 85,  damage: 42, fireRate: 0.75, splash: 0,  projColor: "#d8d0b0", projSpeed: 999 },
  strategist: { range: 115, damage: 24, fireRate: 1.05, splash: 50, projColor: "#ff8a3a", projSpeed: 420 },
};

// ===== 武将 =====
const HEROES = {
  liubei:     { name: "刘备",   arch: "archer",     faction: "蜀", cost: 60,  color: "#4a90c8" },
  guanyu:     { name: "关羽",   arch: "archer",     faction: "蜀", cost: 50,  color: "#6fae4a" },
  zhangfei:   { name: "张飞",   arch: "spear",      faction: "蜀", cost: 70,  color: "#c89a3a" },
  zhugeliang: { name: "诸葛亮", arch: "strategist", faction: "蜀", cost: 100, color: "#c8503a" },
};

// ===== 羁绊 =====
const BONDS = [
  { name: "桃园结义", heroes: ["liubei", "guanyu", "zhangfei"], dmgMult: 1.25,
    desc: "刘备·关羽·张飞同时在场，三人伤害 +25%" },
];

const UPGRADE_COST_MULT = 0.8;

// ===== 计谋（主动技能）=====
const SKILLS = {
  fire: { name: "火计", cd: 12, radius: 78, damage: 90, targeted: true },
  fort: { name: "空城计", cd: 18, slowDur: 4, slowMult: 0.5, targeted: false },
};

// ===== 敌军 =====
const ENEMY_TYPES = {
  infantry: { name: "步兵", hp: 60,  speed: 55,  reward: 5,  color: "#b8b0a0", radius: 12, castleDmg: 1 },
  cavalry:  { name: "骑兵", hp: 40,  speed: 105, reward: 7,  color: "#d8a850", radius: 11, castleDmg: 1 },
  siege:    { name: "攻城车", hp: 520, speed: 32, reward: 35, color: "#8a5a3a", radius: 19, castleDmg: 3 },
};
const HP_SCALE_PER_WAVE = 0.18;

// ===== 关卡 =====
const LEVELS = [
  {
    name: "虎牢关之战",
    intro: "守住虎牢关，击退董卓大军！",
    gold: 170, hp: 20,
    cells: [{ c:0,r:2 },{ c:4,r:2 },{ c:4,r:7 },{ c:9,r:7 },{ c:9,r:2 },{ c:13,r:2 },{ c:13,r:7 },{ c:15,r:7 }],
    waves: [
      [{ type:"infantry", count:5,  gap:1.0 }],
      [{ type:"infantry", count:8,  gap:0.8 }],
      [{ type:"cavalry",  count:7,  gap:0.65 }],
      [{ type:"infantry", count:10, gap:0.6 }, { type:"cavalry", count:6, gap:0.5 }],
      [{ type:"infantry", count:14, gap:0.45 }, { type:"cavalry", count:10, gap:0.4 }],
    ],
  },
  {
    name: "官渡之战",
    intro: "以寡敌众，火烧乌巢，正面挡住袁绍大军。",
    gold: 180, hp: 20,
    cells: [{ c:0,r:5 },{ c:3,r:5 },{ c:3,r:1 },{ c:8,r:1 },{ c:8,r:8 },{ c:12,r:8 },{ c:12,r:3 },{ c:15,r:3 }],
    waves: [
      [{ type:"infantry", count:12, gap:0.6 }],
      [{ type:"cavalry",  count:12, gap:0.45 }],
      [{ type:"infantry", count:14, gap:0.5 }, { type:"cavalry", count:8, gap:0.4 }],
      [{ type:"siege",    count:1,  gap:1.0 }, { type:"infantry", count:12, gap:0.45 }],
      [{ type:"cavalry",  count:16, gap:0.35 }, { type:"siege", count:2, gap:3.0 }],
    ],
  },
  {
    name: "赤壁之战",
    intro: "借东风，火攻连环船，决战于大江之畔。",
    gold: 170, hp: 18,
    cells: [{ c:0,r:1 },{ c:6,r:1 },{ c:6,r:5 },{ c:2,r:5 },{ c:2,r:8 },{ c:11,r:8 },{ c:11,r:2 },{ c:15,r:2 }],
    waves: [
      [{ type:"infantry", count:14, gap:0.5 }],
      [{ type:"cavalry",  count:16, gap:0.38 }],
      [{ type:"siege",    count:2,  gap:2.5 }, { type:"infantry", count:14, gap:0.45 }],
      [{ type:"cavalry",  count:18, gap:0.32 }, { type:"infantry", count:14, gap:0.4 }],
      [{ type:"siege",    count:3,  gap:2.0 }, { type:"cavalry", count:14, gap:0.35 }],
      [{ type:"siege",    count:4,  gap:1.6 }, { type:"infantry", count:20, gap:0.3 }, { type:"cavalry", count:14, gap:0.3 }],
    ],
  },
];

function loadLevel(i) {
  const lv = LEVELS[i];
  path = lv.cells.map((p) => ({ x: p.c * TILE + TILE / 2, y: p.r * TILE + TILE / 2 }));
  pathBlocked = buildPathBlockSet(lv.cells);
  waves = lv.waves;
}

// ===== 游戏状态 =====
const game = {
  gold: 150,
  hp: 20,
  running: false,
  over: false,
  levelIndex: 0,
  waveIndex: -1,
  spawnQueue: [],
  spawnTimer: 0,
  betweenWaves: true,
  enemies: [],
  towers: [],
  projectiles: [],
  floaters: [],
  activeBonds: [],
  selectedHero: null,
  selectedSlot: null,
  mouse: { x: -1, y: -1, cell: null },
  lastTime: 0,
  time: 0,
  skillReady: { fire: 0, fort: 0 },
  targeting: null,
  blasts: [],
  overlayMode: null,
};

// ===== DOM =====
const el = {
  title: document.querySelector(".hud-title"),
  gold: document.getElementById("gold"),
  hp: document.getElementById("hp"),
  wave: document.getElementById("wave"),
  waveTotal: document.getElementById("waveTotal"),
  startBtn: document.getElementById("startBtn"),
  speedHint: document.getElementById("speedHint"),
  selInfo: document.getElementById("selInfo"),
  bondList: document.getElementById("bondList"),
  overlay: document.getElementById("overlay"),
  ovTitle: document.getElementById("ovTitle"),
  ovText: document.getElementById("ovText"),
  ovBtn: document.getElementById("ovBtn"),
  shopBtns: Array.from(document.querySelectorAll(".tower-btn")),
  skillBtns: Array.from(document.querySelectorAll(".skill-btn")),
};

// ===== 工具 =====
function buildPathBlockSet(cells) {
  const set = new Set();
  for (let i = 0; i < cells.length - 1; i++) {
    const a = cells[i], b = cells[i + 1];
    const dc = Math.sign(b.c - a.c), dr = Math.sign(b.r - a.r);
    let c = a.c, r = a.r;
    set.add(c + "," + r);
    while (c !== b.c || r !== b.r) { c += dc; r += dr; set.add(c + "," + r); }
  }
  return set;
}
function cellKey(c, r) { return c + "," + r; }
function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function towerAt(c, r) { return game.towers.find((t) => t.c === c && t.r === r) || null; }

function towerStats(tw) {
  const a = ARCHETYPES[tw.arch];
  return {
    range: a.range + (tw.level - 1) * 12,
    damage: Math.round((a.damage + (tw.level - 1) * Math.round(a.damage * 0.6)) * (tw.bondMult || 1)),
    baseDamage: a.damage + (tw.level - 1) * Math.round(a.damage * 0.6),
    fireRate: a.fireRate,
    splash: a.splash,
    projColor: a.projColor,
    projSpeed: a.projSpeed,
  };
}
function upgradeCost(tw) { return Math.round(HEROES[tw.hero].cost * UPGRADE_COST_MULT * tw.level); }

// ===== 输入 =====
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  game.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
  game.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  game.mouse.cell = { c: Math.floor(game.mouse.x / TILE), r: Math.floor(game.mouse.y / TILE) };
});
canvas.addEventListener("mouseleave", () => { game.mouse.cell = null; });

canvas.addEventListener("click", () => {
  if (!game.mouse.cell) return;
  // 施放定点计谋（火计）
  if (game.targeting) { castTargetedSkill(game.targeting, game.mouse.x, game.mouse.y); return; }
  const { c, r } = game.mouse.cell;
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;

  const existing = towerAt(c, r);
  if (existing) {
    game.selectedSlot = existing;
    game.selectedHero = null;
    el.shopBtns.forEach((b) => b.classList.remove("active"));
    updateSelInfo();
    return;
  }
  if (!game.selectedHero) { game.selectedSlot = null; updateSelInfo(); return; }
  if (pathBlocked.has(cellKey(c, r))) return;
  const hero = HEROES[game.selectedHero];
  if (game.gold < hero.cost) { flash("军粮不足"); return; }
  game.gold -= hero.cost;
  game.towers.push({
    hero: game.selectedHero, arch: hero.arch, c, r,
    x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
    level: 1, cooldown: 0, angle: 0, bondMult: 1, attackAnim: 1, phase: Math.random() * 6.28,
  });
  game.selectedSlot = game.towers[game.towers.length - 1];
  updateSelInfo();
});

el.shopBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const h = btn.dataset.hero;
    game.selectedHero = game.selectedHero === h ? null : h;
    game.selectedSlot = null;
    el.shopBtns.forEach((b) => b.classList.toggle("active", b === btn && game.selectedHero));
    updateSelInfo();
  });
});

el.skillBtns.forEach((btn) => {
  btn.addEventListener("click", () => onSkillButton(btn.dataset.skill));
});

function skillReady(key) { return game.running && !game.over && game.time >= game.skillReady[key]; }

function onSkillButton(key) {
  if (!skillReady(key)) return;
  const sk = SKILLS[key];
  if (sk.targeted) {
    game.targeting = game.targeting === key ? null : key; // 再点取消
  } else {
    castInstantSkill(key);
  }
  updateSkillUI();
}

function castTargetedSkill(key, x, y) {
  const sk = SKILLS[key];
  game.skillReady[key] = game.time + sk.cd;
  game.targeting = null;
  if (key === "fire") {
    areaDamage(x, y, sk.radius, sk.damage);
    // 多层火焰扩散环 + 余烬
    game.blasts.push({ x, y, r0: 10, r1: sk.radius, life: 0.5, max: 0.5, color: "rgba(255,138,58,0.6)" });
    game.blasts.push({ x, y, r0: 6, r1: sk.radius * 0.7, life: 0.35, max: 0.35, color: "rgba(255,210,74,0.7)" });
    Art.emitParticles(x, y, { count: 40, color: "#ff6a1a", speed: 180, life: 0.7, size: 5, gravity: 50 });
    Art.emitParticles(x, y, { count: 24, color: "#ffd24a", speed: 120, life: 0.6, size: 3 });
    flash("火计！烈焰焚敌");
  }
  updateSkillUI();
}

function castInstantSkill(key) {
  const sk = SKILLS[key];
  game.skillReady[key] = game.time + sk.cd;
  if (key === "fort") {
    for (const en of game.enemies) {
      en.slowUntil = game.time + sk.slowDur;
      Art.emitParticles(en.x, en.y, { count: 6, color: "#b8a8e8", speed: 40, life: 0.7, size: 3 });
    }
    // 紫色疑兵迷雾扩散
    game.blasts.push({ x: canvas.width / 2, y: canvas.height / 2, r0: 20, r1: 420, life: 0.7, max: 0.7, color: "rgba(160,138,216,0.4)" });
    flash("空城计！敌军疑而缓行");
  }
}

el.startBtn.addEventListener("click", () => {
  if (game.over) return;
  if (game.betweenWaves) startNextWave();
});

el.ovBtn.addEventListener("click", () => {
  el.overlay.classList.add("hidden");
  if (game.overlayMode === "levelClear") startLevel(game.levelIndex + 1);
  else if (game.overlayMode === "win") startLevel(0);
  else if (game.overlayMode === "retry") startLevel(game.levelIndex);
  game.overlayMode = null;
  game.running = true;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "u" || e.key === "U") tryUpgrade();
  if (e.key === "Escape") { game.targeting = null; updateSkillUI(); }
  if (e.key === "1") onSkillButton("fire");
  if (e.key === "2") onSkillButton("fort");
});

function tryUpgrade() {
  const t = game.selectedSlot;
  if (!t) return;
  const cost = upgradeCost(t);
  if (game.gold < cost) { flash("军粮不足"); return; }
  game.gold -= cost;
  t.level += 1;
  updateSelInfo();
}

// ===== 波次 =====
function startNextWave() {
  game.waveIndex += 1;
  if (game.waveIndex >= waves.length) return;
  game.betweenWaves = false;
  const groups = waves[game.waveIndex];
  const queue = [];
  let t = 0;
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) { queue.push({ type: g.type, at: t }); t += g.gap; }
  }
  game.spawnQueue = queue;
  game.spawnTimer = 0;
  updateHUD();
}

function spawnEnemy(type) {
  const def = ENEMY_TYPES[type];
  const scale = 1 + game.waveIndex * HP_SCALE_PER_WAVE;
  game.enemies.push({
    type, x: path[0].x, y: path[0].y,
    hp: def.hp * scale, maxHp: def.hp * scale,
    speed: def.speed, reward: def.reward, radius: def.radius, color: def.color,
    castleDmg: def.castleDmg, seg: 0, walk: Math.random() * 6.28, hitFlash: 0,
  });
}

// ===== 羁绊计算 =====
function recomputeBonds() {
  const present = new Set(game.towers.map((t) => t.hero));
  const active = [];
  const buffed = new Set();
  for (const b of BONDS) {
    if (b.heroes.every((h) => present.has(h))) {
      active.push(b);
      b.heroes.forEach((h) => buffed.add(h + ":" + b.dmgMult));
    }
  }
  // 每个武将取其参与的最高加成
  for (const tw of game.towers) {
    let mult = 1;
    for (const b of active) if (b.heroes.includes(tw.hero)) mult = Math.max(mult, b.dmgMult);
    tw.bondMult = mult;
  }
  // 仅在变化时刷新面板
  const sig = active.map((b) => b.name).join(",");
  if (sig !== game._bondSig) { game._bondSig = sig; renderBondPanel(active); }
}

function renderBondPanel(active) {
  if (!active.length) { el.bondList.innerHTML = "未激活"; return; }
  el.bondList.innerHTML = active
    .map((b) => `<div class="on">${b.name}</div><div>${b.desc}</div>`)
    .join("");
}

// ===== 更新 =====
function update(dt) {
  if (!game.running || game.over) return;
  game.time += dt;

  recomputeBonds();

  if (!game.betweenWaves && game.spawnQueue.length) {
    game.spawnTimer += dt;
    while (game.spawnQueue.length && game.spawnTimer >= game.spawnQueue[0].at) {
      spawnEnemy(game.spawnQueue.shift().type);
    }
  }

  for (const en of game.enemies) {
    if (en.hp <= 0) continue;
    const target = path[en.seg + 1];
    if (!target) { reachCastle(en); continue; }
    const dx = target.x - en.x, dy = target.y - en.y;
    const d = Math.hypot(dx, dy);
    const slow = game.time < (en.slowUntil || 0) ? SKILLS.fort.slowMult : 1;
    const step = en.speed * slow * dt;
    en.walk += step * 0.08;
    if (en.hitFlash > 0) en.hitFlash -= dt;
    if (d <= step) { en.x = target.x; en.y = target.y; en.seg += 1; }
    else { en.x += (dx / d) * step; en.y += (dy / d) * step; }
  }

  for (const tw of game.towers) {
    const s = towerStats(tw);
    tw.cooldown -= dt;
    if (tw.attackAnim < 1) tw.attackAnim = Math.min(1, tw.attackAnim + dt / 0.18);
    let target = null, bestSeg = -1;
    for (const en of game.enemies) {
      if (en.hp <= 0) continue;
      if (distance(tw.x, tw.y, en.x, en.y) <= s.range && en.seg > bestSeg) { bestSeg = en.seg; target = en; }
    }
    if (target) {
      tw.angle = Math.atan2(target.y - tw.y, target.x - tw.x);
      if (tw.cooldown <= 0) {
        tw.cooldown = s.fireRate;
        tw.attackAnim = 0; // 触发攻击动作
        if (s.projSpeed >= 999) {
          // 枪兵：瞬时命中 + 枪刺火花
          Art.emitParticles(target.x, target.y, { count: 8, color: "#ffe0a0", speed: 90, life: 0.3, size: 2.5 });
          if (s.splash > 0) areaDamage(target.x, target.y, s.splash, s.damage);
          else damage(target, s.damage);
        } else {
          game.projectiles.push({
            x: tw.x, y: tw.y, tx: target.x, ty: target.y, target,
            speed: s.projSpeed, damage: s.damage, splash: s.splash, color: s.projColor,
            arch: tw.arch,
          });
        }
      }
    }
  }

  for (const p of game.projectiles) {
    if (p.dead) continue;
    const tx = p.target && p.target.hp > 0 ? p.target.x : p.tx;
    const ty = p.target && p.target.hp > 0 ? p.target.y : p.ty;
    p.tx = tx; p.ty = ty;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), step = p.speed * dt;
    if (d <= step) { hitProjectile(p); p.dead = true; }
    else { p.x += (dx / d) * step; p.y += (dy / d) * step; }
  }

  for (const f of game.floaters) { f.y -= 30 * dt; f.life -= dt; }
  for (const b of game.blasts) b.life -= dt;
  Art.updateParticles(dt);

  game.enemies = game.enemies.filter((e) => e.hp > 0 && !e.reached);
  game.projectiles = game.projectiles.filter((p) => !p.dead);
  game.floaters = game.floaters.filter((f) => f.life > 0);
  game.blasts = game.blasts.filter((b) => b.life > 0);

  if (!game.betweenWaves && game.spawnQueue.length === 0 && game.enemies.length === 0) {
    game.betweenWaves = true;
    if (game.waveIndex >= waves.length - 1) return win();
    flash("第 " + (game.waveIndex + 1) + " 波已挡下，整顿兵马");
  }

  updateHUD();
}

function hitProjectile(p) {
  if (p.splash > 0) {
    areaDamage(p.tx, p.ty, p.splash, p.damage);
    // 火攻溅射：橙红火球爆点
    Art.emitParticles(p.tx, p.ty, { count: 16, color: "#ff7a2a", speed: 110, life: 0.5, size: 4, gravity: 40 });
    Art.emitParticles(p.tx, p.ty, { count: 8, color: "#ffd24a", speed: 70, life: 0.4, size: 3 });
    game.blasts.push({ x: p.tx, y: p.ty, r0: 6, r1: p.splash, life: 0.3, max: 0.3, color: "rgba(255,120,42,0.5)" });
  } else if (p.target && p.target.hp > 0) {
    damage(p.target, p.damage);
    Art.emitParticles(p.tx, p.ty, { count: 6, color: p.color || "#ffe0a0", speed: 70, life: 0.3, size: 2.5 });
  }
}
function areaDamage(x, y, radius, amount) {
  for (const en of game.enemies) {
    if (en.hp <= 0) continue;
    if (distance(x, y, en.x, en.y) <= radius) damage(en, amount);
  }
}
function damage(en, amount) {
  en.hp -= amount;
  en.hitFlash = 0.12; // 受击白闪
  if (en.hp <= 0) {
    game.gold += en.reward;
    game.floaters.push({ x: en.x, y: en.y, text: "+" + en.reward, life: 0.8, color: "#c8a04a" });
    // 死亡消散粒子
    Art.emitParticles(en.x, en.y, { count: 12, color: en.color, speed: 80, life: 0.5, size: 3, gravity: 30 });
  }
}
function spawnHitFx(x, y, color) {
  game.floaters.push({ x, y, text: "·", life: 0.2, color });
}
function reachCastle(en) {
  en.reached = true;
  const dmg = en.castleDmg || 1;
  game.hp = Math.max(0, game.hp - dmg);
  game.floaters.push({ x: canvas.width - 40, y: path[path.length - 1].y, text: "-" + dmg, life: 1, color: "#d4503a" });
  if (game.hp <= 0) lose();
}

// ===== 渲染 =====
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawPath();
  drawCastle();
  drawTowers();
  drawEnemies();
  drawProjectiles();
  drawBlasts();
  Art.drawParticles(ctx);
  drawFloaters();
  drawHover();
  drawTargeting();
}

function drawBlasts() {
  for (const b of game.blasts) {
    const t = 1 - b.life / b.max;
    const r = b.r0 + (b.r1 - b.r0) * t;
    ctx.globalAlpha = b.life / b.max;
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawTargeting() {
  if (!game.targeting || !game.mouse.cell) return;
  const sk = SKILLS[game.targeting];
  ctx.strokeStyle = "rgba(255,138,58,0.9)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(game.mouse.x, game.mouse.y, sk.radius, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(255,138,58,0.15)"; ctx.fill();
}
function drawGrid() {
  ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * TILE, 0); ctx.lineTo(c * TILE, canvas.height); ctx.stroke(); }
  for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * TILE); ctx.lineTo(canvas.width, r * TILE); ctx.stroke(); }
}
function drawPath() {
  ctx.strokeStyle = "#7a6242"; ctx.lineWidth = TILE * 0.7; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
  ctx.stroke();
}
function drawCastle() {
  const last = path[path.length - 1];
  ctx.fillStyle = "#5a4a8a"; ctx.fillRect(last.x - 6, last.y - TILE / 2, TILE / 2 + 6, TILE);
  ctx.fillStyle = "#c8a04a"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("关", last.x + 16, last.y + 6);
}
function drawTowers() {
  for (const tw of game.towers) {
    const hero = HEROES[tw.hero];
    const s = towerStats(tw);
    if (game.selectedSlot === tw) {
      ctx.fillStyle = "rgba(200,160,74,0.12)";
      ctx.beginPath(); ctx.arc(tw.x, tw.y, s.range, 0, Math.PI * 2); ctx.fill();
    }
    // 羁绊光环（脉动）
    if (tw.bondMult > 1) {
      const pulse = 24 + Math.sin(game.time * 4 + tw.phase) * 2;
      ctx.strokeStyle = "rgba(111,174,74,0.8)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tw.x, tw.y, pulse, 0, Math.PI * 2); ctx.stroke();
    }
    // 底座
    ctx.fillStyle = "rgba(26,18,12,0.6)";
    ctx.beginPath(); ctx.ellipse(tw.x, tw.y + 18, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
    // 待机呼吸浮动
    const bob = Math.sin(game.time * 2 + tw.phase) * 1.5;
    Art.drawSprite(ctx, "hero:" + tw.hero, tw.x, tw.y - 4 + bob, {
      size: 44, angle: tw.angle, attack: tw.attackAnim, t: game.time + tw.phase,
    });
    // 武将名 + 等级点
    ctx.fillStyle = "#f0e6d2"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(hero.name, tw.x, tw.y - 30);
    for (let i = 0; i < tw.level; i++) {
      ctx.fillStyle = "#f0e6d2"; ctx.beginPath(); ctx.arc(tw.x - 9 + i * 9, tw.y + 26, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function drawEnemies() {
  for (const en of game.enemies) {
    const size = en.radius * 2.4;
    // 阴影
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(en.x, en.y + en.radius * 0.7, en.radius * 0.8, en.radius * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    Art.drawSprite(ctx, "enemy:" + en.type, en.x, en.y, {
      size, walk: en.walk, flashAlpha: en.hitFlash > 0 ? en.hitFlash / 0.12 * 0.7 : 0,
    });
    const w = en.radius * 2, pct = Math.max(0, en.hp / en.maxHp);
    ctx.fillStyle = "#000"; ctx.fillRect(en.x - w / 2, en.y - en.radius - 12, w, 4);
    ctx.fillStyle = pct > 0.5 ? "#6fae4a" : pct > 0.25 ? "#d8a850" : "#d4503a";
    ctx.fillRect(en.x - w / 2, en.y - en.radius - 12, w * pct, 4);
  }
}
function drawProjectiles() {
  for (const p of game.projectiles) {
    if (p.arch === "archer") {
      // 箭：细长 + 拖尾
      const ang = Math.atan2(p.ty - p.y, p.tx - p.x);
      ctx.strokeStyle = "rgba(232,224,192,0.4)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(ang) * 14, p.y - Math.sin(ang) * 14); ctx.stroke();
      ctx.strokeStyle = p.color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(ang) * 7, p.y - Math.sin(ang) * 7); ctx.stroke();
    } else {
      // 火球：光晕
      ctx.fillStyle = "rgba(255,138,58,0.35)"; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function drawFloaters() {
  ctx.textAlign = "center"; ctx.font = "bold 14px sans-serif";
  for (const f of game.floaters) {
    ctx.globalAlpha = Math.min(1, f.life * 1.5); ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
function drawHover() {
  if (!game.mouse.cell || !game.selectedHero) return;
  const { c, r } = game.mouse.cell;
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
  const blocked = pathBlocked.has(cellKey(c, r)) || towerAt(c, r);
  const a = ARCHETYPES[HEROES[game.selectedHero].arch];
  const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
  ctx.fillStyle = blocked ? "rgba(212,80,58,0.3)" : "rgba(111,174,74,0.3)";
  ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
  if (!blocked) {
    ctx.fillStyle = "rgba(200,160,74,0.12)";
    ctx.beginPath(); ctx.arc(x, y, a.range, 0, Math.PI * 2); ctx.fill();
  }
}

// ===== HUD / 文案 =====
function updateHUD() {
  el.gold.textContent = game.gold;
  el.hp.textContent = game.hp;
  el.wave.textContent = Math.max(0, game.waveIndex + 1);
  el.waveTotal.textContent = waves.length;
  if (game.over) { el.startBtn.disabled = true; }
  else if (!game.betweenWaves) { el.startBtn.textContent = "激战中…"; el.startBtn.disabled = true; }
  else { el.startBtn.textContent = game.waveIndex < 0 ? "出战" : "下一波"; el.startBtn.disabled = false; }
  updateSkillUI();
}

function updateSkillUI() {
  for (const btn of el.skillBtns) {
    const key = btn.dataset.skill;
    const ready = skillReady(key);
    const remain = Math.max(0, game.skillReady[key] - game.time);
    btn.disabled = !ready;
    btn.classList.toggle("armed", game.targeting === key);
    const cdEl = btn.querySelector(".sk-cd");
    if (cdEl) cdEl.textContent = remain > 0.05 ? remain.toFixed(1) + "s" : "就绪";
  }
}
function updateSelInfo() {
  const t = game.selectedSlot;
  if (t) {
    const hero = HEROES[t.hero]; const s = towerStats(t);
    const bondNote = t.bondMult > 1 ? `<br><span style="color:#6fae4a">羁绊 +${Math.round((t.bondMult - 1) * 100)}%</span>` : "";
    el.selInfo.innerHTML =
      `<b>${hero.name}</b>（${hero.faction}） Lv.${t.level}${bondNote}<br>` +
      `伤害 ${s.damage}　射程 ${s.range}<br><br>按 <b>U</b> 升级（军粮 ${upgradeCost(t)}）`;
    return;
  }
  if (game.selectedHero) {
    const hero = HEROES[game.selectedHero];
    el.selInfo.innerHTML = `选中：<b>${hero.name}</b><br>点击空地建造（军粮 ${hero.cost}）`;
    return;
  }
  el.selInfo.textContent = "点击空地选择武将，或点已有武将升级";
}
function flash(text) {
  el.speedHint.textContent = text;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { el.speedHint.textContent = ""; }, 2000);
}

// ===== 胜负 =====
function win() {
  game.over = true; game.running = false;
  if (game.levelIndex >= LEVELS.length - 1) {
    game.overlayMode = "win";
    el.ovTitle.textContent = "天下大势已定！";
    el.ovText.textContent = "三战皆捷，威震华夏。可再起战端，重头来过。";
    el.ovBtn.textContent = "再起战端";
  } else {
    game.overlayMode = "levelClear";
    el.ovTitle.textContent = "大捷！";
    el.ovText.textContent = LEVELS[game.levelIndex].name + " 已下。下一战：" + LEVELS[game.levelIndex + 1].name;
    el.ovBtn.textContent = "进军下一关";
  }
  el.overlay.classList.remove("hidden");
}
function lose() {
  game.over = true; game.running = false;
  game.overlayMode = "retry";
  el.ovTitle.textContent = "关隘失守";
  el.ovText.textContent = "城池被攻破……整军再来，未为晚也。";
  el.ovBtn.textContent = "重整旗鼓";
  el.overlay.classList.remove("hidden");
}
function startLevel(i) {
  game.levelIndex = i;
  loadLevel(i);
  const lv = LEVELS[i];
  game.gold = lv.gold; game.hp = lv.hp; game.over = false;
  game.waveIndex = -1; game.spawnQueue = []; game.betweenWaves = true;
  game.enemies = []; game.towers = []; game.projectiles = []; game.floaters = [];
  game.activeBonds = []; game._bondSig = null;
  game.time = 0; game.skillReady = { fire: 0, fort: 0 }; game.targeting = null; game.blasts = [];
  Art.clearParticles();
  game.selectedHero = null; game.selectedSlot = null;
  if (el.title) el.title.textContent = lv.name;
  el.shopBtns.forEach((b) => b.classList.remove("active"));
  renderBondPanel([]);
  updateHUD(); updateSelInfo();
}
function resetGame() { startLevel(0); }

// ===== 主循环 =====
function loop(now) {
  const dt = Math.min(0.05, (now - game.lastTime) / 1000 || 0);
  game.lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// ===== 启动 =====
Art.preloadSprites();
resetGame();
el.overlay.classList.remove("hidden");
requestAnimationFrame(loop);
