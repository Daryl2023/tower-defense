"use strict";

// ===== 基础配置 =====
const TILE = 60;
const COLS = 16;
const ROWS = 10;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
// R19 主界面背景画布
const homeCanvas = document.getElementById("homeCanvas");
const homeCtx = homeCanvas ? homeCanvas.getContext("2d") : null;

// 关卡当前状态（由 loadLevel 填充）
let path = [];
let pathBlocked = new Set();
let waves = [];

// ===== 数据配置（R8-1）：全部来自 data.js 的 window.GameData =====
const GameData = window.GameData;
const RARITY = GameData.RARITY;
const ARCHETYPES = GameData.ARCHETYPES;
const HEROES = GameData.HEROES;
const BONDS = GameData.BONDS;
const SKILLS = GameData.SKILLS;
const ENEMY_TYPES = GameData.ENEMY_TYPES;
const BOSSES = GameData.BOSSES;
const STARTERS = GameData.STARTERS;
const LEVELS = GameData.LEVELS;
const CHAPTERS = GameData.CHAPTERS;
const BOONS = GameData.BOONS || [];
// R22：连续征战增益累加器
function freshRunBuffs() { return { dmgMul: 1, rateMul: 1, rangeMul: 1, goldStart: 0, killGoldMul: 0, hpBonus: 0, refreshCut: 0, critChance: 0, count: 0 }; }
function applyBoon(effect) {
  const b = game.runBuffs;
  if (effect.dmgMul) b.dmgMul += effect.dmgMul;
  if (effect.rateMul) b.rateMul += effect.rateMul;
  if (effect.rangeMul) b.rangeMul += effect.rangeMul;
  if (effect.goldStart) b.goldStart += effect.goldStart;
  if (effect.killGoldMul) b.killGoldMul += effect.killGoldMul;
  if (effect.hpBonus) b.hpBonus += effect.hpBonus;
  if (effect.refreshCut) b.refreshCut += effect.refreshCut;
  if (effect.critChance) b.critChance += effect.critChance;
  b.count += 1;
}
// 关卡末波是否含 Boss → 返回 boss id（无则 null）
function levelBossId(i) {
  const lv = LEVELS[i];
  if (!lv || !lv.waves || !lv.waves.length) return null;
  for (const grp of lv.waves[lv.waves.length - 1]) { if (grp && grp.boss) return grp.boss; }
  return null;
}
const HP_SCALE_PER_WAVE = GameData.TUNING.hpScalePerWave;
const UPGRADE_COST_MULT = GameData.TUNING.upgradeCostMult;

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
  paused: false,
  speed: 1,
  maxUnlocked: 0,
  refreshCost: 30,
  candidates: [],
  pendingCost: 0,
  cutscene: null,  // R21：结算过场动画状态
  runBuffs: null,  // R22：连续征战增益累加器（freshRunBuffs）
  scene: "home",   // R19：场景状态机 home / levels / deck / battle / barracks / codex
  sceneReturn: "home", // R19：离开 barracks/codex 时返回的场景
};

// ===== 存档（R7-2 / R9-1 扩展 shards/ranks）=====
const SAVE_KEY = "sgtd_save_v1";
const TUNING = GameData.TUNING;
// 持久养成态：碎片数 + 升级等级 + 出战阵容 deck + 已解锁武将 unlocked
const meta = { shards: {}, ranks: {}, deck: [], unlocked: {} };
const DECK_SIZE = 6;
function unlockedIds(u) { u = u || meta.unlocked; return Object.keys(HEROES).filter((id) => u[id]); }
function defaultDeck(u) { return unlockedIds(u).slice(0, DECK_SIZE); }
// 弹性阵容（R17）：仅已解锁武将、去重、上限 DECK_SIZE、至少 1（空则取已解锁补足）
function normalizeDeck(arr, u) {
  u = u || meta.unlocked;
  let deck = Array.isArray(arr) ? [...new Set(arr.filter((id) => HEROES[id] && u[id]))] : [];
  if (deck.length > DECK_SIZE) deck = deck.slice(0, DECK_SIZE);
  if (deck.length === 0) deck = unlockedIds(u).slice(0, DECK_SIZE);
  return deck;
}
function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* 忽略损坏存档 */ }
  if (!s || typeof s !== "object") s = {};
  const maxUnlocked = typeof s.maxUnlocked === "number" ? s.maxUnlocked : 0;
  const shards = {}, ranks = {}, unlocked = {};
  const hasUnlocked = s.unlocked && typeof s.unlocked === "object";
  for (const id of Object.keys(HEROES)) {
    shards[id] = s.shards && typeof s.shards[id] === "number" ? s.shards[id] : 0;
    ranks[id] = s.ranks && typeof s.ranks[id] === "number" ? Math.max(1, s.ranks[id]) : 1;
    // 解锁：有存档读存档；无 unlocked 字段则默认仅起始武将（R17）
    unlocked[id] = hasUnlocked ? !!s.unlocked[id] : STARTERS.includes(id);
  }
  for (const id of STARTERS) if (HEROES[id]) unlocked[id] = true; // 起始武将始终解锁
  return { maxUnlocked, shards, ranks, unlocked, deck: normalizeDeck(s.deck, unlocked) };
}
function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      maxUnlocked: game.maxUnlocked, shards: meta.shards, ranks: meta.ranks, deck: meta.deck, unlocked: meta.unlocked,
    }));
  } catch (e) { /* 隐私模式等可能失败，忽略 */ }
}
function unlockLevel(i) {
  if (i > game.maxUnlocked) { game.maxUnlocked = Math.min(i, LEVELS.length - 1); saveProgress(); }
}

// ===== 养成读写（R9-1）=====
function heroRank(id) { return meta.ranks[id] || 1; }
function heroShards(id) { return meta.shards[id] || 0; }
function maxRank() { return TUNING.maxRank || 5; }
// 从当前等级升到下一级所需碎片（满级返回 null）
function rankUpCost(id) {
  const next = heroRank(id) + 1;
  if (next > maxRank()) return null;
  return TUNING.rankCost[next];
}
function canRankUp(id) {
  const cost = rankUpCost(id);
  return cost != null && heroShards(id) >= cost;
}
function rankUp(id) {
  if (!canRankUp(id)) return false;
  meta.shards[id] -= rankUpCost(id);
  meta.ranks[id] += 1;
  saveProgress();
  return true;
}
// 该武将被动是否已解锁（升级达 unlockRank）
function passiveUnlocked(id) {
  const p = HEROES[id].passive;
  return !!p && heroRank(id) >= p.unlockRank;
}
function addShards(rewards) {
  if (!rewards) return;
  for (const id of Object.keys(rewards)) {
    if (HEROES[id]) meta.shards[id] = (meta.shards[id] || 0) + rewards[id];
  }
  saveProgress();
}

// ===== 解锁 / 碎片招募（R17）=====
function isUnlocked(id) { return !!meta.unlocked[id]; }
function recruitCost(id) { return TUNING.recruitShardCost[HEROES[id].rarity]; }
function canRecruit(id) { return !isUnlocked(id) && heroShards(id) >= recruitCost(id); }
function recruitHero(id) {
  if (!canRecruit(id)) return false;
  meta.shards[id] -= recruitCost(id);
  meta.unlocked[id] = true;
  if (!meta.ranks[id] || meta.ranks[id] < 1) meta.ranks[id] = 1;
  saveProgress();
  return true;
}
// 概率碎片掉落（R17）：按稀有度权重（低稀有更高）+ featured 加权，抽 draws 次各 +1
function rollShardDrops(idx) {
  const draws = TUNING.shardDrawsBase + Math.floor(idx * TUNING.shardDrawsPerLevel);
  const featured = LEVELS[idx].featured;
  const ids = Object.keys(HEROES);
  const wOf = (id) => RARITY[HEROES[id].rarity].drawWeight + (id === featured ? TUNING.featuredWeight : 0);
  const drops = {};
  for (let i = 0; i < draws; i++) {
    let total = 0; for (const id of ids) total += wOf(id);
    let roll = Math.random() * total, chosen = ids[ids.length - 1];
    for (const id of ids) { roll -= wOf(id); if (roll <= 0) { chosen = id; break; } }
    drops[chosen] = (drops[chosen] || 0) + 1;
  }
  return drops;
}

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
  ovBtn2: document.getElementById("ovBtn2"),
  menuList: document.getElementById("menuList"),
  pauseBtn: document.getElementById("pauseBtn"),
  speedBtn: document.getElementById("speedBtn"),
  muteBtn: document.getElementById("muteBtn"),
  menuBtn: document.getElementById("menuBtn"),
  shopBtns: Array.from(document.querySelectorAll(".tower-btn")),
  skillBtns: Array.from(document.querySelectorAll(".skill-btn")),
  recruitBtn: document.getElementById("recruitBtn"),
  recruitCost: document.getElementById("recruitCost"),
  candidates: document.getElementById("candidates"),
  codexBtn: document.getElementById("codexBtn"),
  codexHeroes: document.getElementById("codexHeroes"),
  codexBonds: document.getElementById("codexBonds"),
  codexClose: document.getElementById("codexClose"),
  trainBtn: document.getElementById("trainBtn"),
  trainList: document.getElementById("trainList"),
  trainClose: document.getElementById("trainClose"),
  deckTitle: document.getElementById("deckTitle"),
  deckIntro: document.getElementById("deckIntro"),
  deckGrid: document.getElementById("deckGrid"),
  deckCount: document.getElementById("deckCount"),
  deckStart: document.getElementById("deckStart"),
  deckBack: document.getElementById("deckBack"),
  detailBody: document.getElementById("detailBody"),
  detailBack: document.getElementById("detailBack"),
};
el.recruitBtn.addEventListener("click", drawRecruit);
el.codexBtn.addEventListener("click", openCodex);
el.codexClose.addEventListener("click", () => leaveSubScene());
el.trainBtn.addEventListener("click", openTrain);
el.trainClose.addEventListener("click", () => leaveSubScene());
el.deckStart.addEventListener("click", confirmDeck);
el.deckBack.addEventListener("click", () => showMenu());
// R19 主界面 / 关卡选择导航
document.getElementById("homeStart").addEventListener("click", () => showMenu());
document.getElementById("homeTrain").addEventListener("click", openTrain);
document.getElementById("homeCodex").addEventListener("click", openCodex);
document.getElementById("levelsBack").addEventListener("click", () => showHome());
el.detailBack.addEventListener("click", () => showCodexList());

// ===== 音效（R12）=====
function updateMuteUI() { if (el.muteBtn) el.muteBtn.textContent = Sfx.isMuted() ? "🔇" : "🔊"; }
el.muteBtn.addEventListener("click", () => { Sfx.init(); Sfx.toggle(); updateMuteUI(); });
// 首次用户手势解锁 AudioContext（浏览器自动播放策略要求）
function unlockAudio() { Sfx.init(); updateMuteUI(); }
window.addEventListener("pointerdown", unlockAudio, { once: true });
window.addEventListener("keydown", unlockAudio, { once: true });

// ===== 图鉴（R8-5）：数据来自 GameData，自动渲染 =====
const ARCH_LABEL = { archer: "弓", spear: "枪", strategist: "谋" };
function heroPortraitImg(id, cls) {
  const src = Art.getHeroPortrait(id);
  return src ? `<img class="${cls}" src="${src}" alt="">` : "";
}
// R19-3：图鉴/养成场景化 —— 子视图切换 + 统一返回
function showCodexList() {
  document.getElementById("codexListView").classList.remove("hidden");
  document.getElementById("codexDetailView").classList.add("hidden");
}
function showCodexDetail() {
  document.getElementById("codexListView").classList.add("hidden");
  document.getElementById("codexDetailView").classList.remove("hidden");
}
// 离开图鉴/养成场景：返回来源场景（home 则刷新概览条）
function leaveSubScene() {
  const ret = game.sceneReturn || "home";
  if (ret === "home") renderHomeOverview();
  else if (ret === "levels") renderMenuList();
  switchScene(ret);
}
function openCodex() {
  game.sceneReturn = game.scene;
  el.codexHeroes.innerHTML = Object.keys(HEROES).map((id) => {
    const h = HEROES[id];
    const locked = !isUnlocked(id);
    const costTag = locked
      ? `<span class="cx-cost lock">🔒 ${recruitCost(id)} 碎招募</span>`
      : `<span class="cx-cost">部署 ${RARITY[h.rarity].deployCost}</span>`;
    return `<div class="codex-row hero-row ${locked ? "locked" : ""}" data-id="${id}">${heroPortraitImg(id, "cx-portrait")}` +
      `<span class="cx-name">${h.name}</span>` +
      `<span class="cx-fac">${ARCH_LABEL[h.arch]}</span>` +
      `<span class="cx-star">${RARITY[h.rarity].star}</span>` +
      `<span class="cx-desc">${h.trait || ""}</span>` +
      costTag + `</div>`;
  }).join("");
  el.codexHeroes.querySelectorAll(".hero-row").forEach((row) => {
    row.addEventListener("click", () => openHeroDetail(row.dataset.id));
  });
  el.codexBonds.innerHTML = BONDS.map((b) => {
    const names = b.heroes.map((id) => HEROES[id].name).join("·");
    return `<div class="codex-row"><span class="cx-name">${b.name}</span>` +
      `<span class="cx-desc">${b.desc}</span></div>` +
      `<div style="font-size:11px;color:#8a7a62;padding:0 12px 2px">需：${names}</div>`;
  }).join("");
  showCodexList();
  switchScene("codex");
}

// ===== 图鉴武将详细页（R15）=====
// 预览属性：Lv.1 战斗形态 + 当前永久升级，不含羁绊/光环（构造临时塔复用 towerStats 公式）
function computeHeroPreview(id) {
  return towerStats({ hero: id, arch: HEROES[id].arch, level: 1 });
}
function bondsOfHero(id) { return BONDS.filter((b) => b.heroes.includes(id)); }
function openHeroDetail(id) {
  const h = HEROES[id];
  const s = computeHeroPreview(id);
  const rank = heroRank(id), sh = heroShards(id);
  const locked = !isUnlocked(id);
  const metaLine = locked
    ? `<div class="dt-meta">🔒 未招募 · 需 ${recruitCost(id)} 专属碎片（当前 ${sh}）</div>`
    : `<div class="dt-meta">永久升级 Lv.${rank}/${maxRank()}　专属碎片 ${sh}</div>`;
  const aps = (1 / s.fireRate).toFixed(2);
  const splashStr = s.splash > 0 ? s.splash : "单体";
  const pas = h.passive;
  const unlocked = pas && passiveUnlocked(id);
  const pasHtml = pas
    ? `<div class="dt-passive ${unlocked ? "on" : ""}"><b>「${pas.name}」</b>` +
        (unlocked ? `<span class="dt-on"> · 已解锁</span>` : `<span class="dt-off"> · 升级 Lv.${pas.unlockRank} 解锁</span>`) +
        `<br>${pas.desc}</div>`
    : `<div class="dt-passive">该武将暂无被动</div>`;
  const bonds = bondsOfHero(id);
  const bondHtml = bonds.length
    ? bonds.map((b) => `<div class="dt-bond"><span class="dt-bond-name">${b.name}</span>` +
        `<span class="dt-bond-need">需 ${b.heroes.map((x) => HEROES[x].name).join("·")}</span>` +
        `<div class="dt-bond-desc">${b.desc}</div></div>`).join("")
    : `<div class="dt-bond-desc">暂无可参与的羁绊</div>`;
  el.detailBody.innerHTML =
    `<div class="dt-head">${heroPortraitImg(id, "dt-portrait")}` +
      `<div class="dt-title">` +
        `<div class="dt-name">${h.name} <span class="dt-star">${RARITY[h.rarity].star}</span></div>` +
        `<div class="dt-sub">${h.faction}国 · ${ARCH_LABEL[h.arch]}兵 · ${h.trait || ""}</div>` +
        metaLine +
      `</div></div>` +
    `<div class="dt-stats">` +
      `<div class="dt-stat"><span>伤害</span><b>${s.damage}</b></div>` +
      `<div class="dt-stat"><span>射程</span><b>${s.range}</b></div>` +
      `<div class="dt-stat"><span>攻速</span><b>${aps}/秒</b></div>` +
      `<div class="dt-stat"><span>溅射</span><b>${splashStr}</b></div>` +
    `</div>` +
    `<div class="dt-tip">※ 属性为 Lv.1 战斗形态（含当前永久升级），实战另受羁绊/光环加成</div>` +
    `<div class="dt-section">被动技能</div>` + pasHtml +
    `<div class="dt-section">参与羁绊</div>` + bondHtml;
  showCodexDetail();
}

// ===== 养成界面（R9-5）：碎片升级 + 被动解锁 =====
function renderTrainList() {
  el.trainList.innerHTML = Object.keys(HEROES).map((id) => {
    const h = HEROES[id];
    const rank = heroRank(id), sh = heroShards(id), max = maxRank();
    const locked = !isUnlocked(id);
    const maxed = rank >= max;
    const cost = rankUpCost(id);
    const can = canRankUp(id);
    const pas = h.passive;
    const pasHtml = pas
      ? `<div class="train-passive">被动「${pas.name}」` + (passiveUnlocked(id)
          ? `<span class="on"> · 已解锁</span>：${pas.desc}`
          : `<span class="off"> · Lv.${pas.unlockRank} 解锁</span>：${pas.desc}`) + `</div>`
      : "";
    let btn;
    if (locked) {
      const rc = recruitCost(id);
      btn = `<button class="train-up recruit" data-recruit="${id}" ${canRecruit(id) ? "" : "disabled"}>招募 (${rc} 碎)</button>`;
    } else if (maxed) {
      btn = `<button class="train-up maxed" disabled>满级</button>`;
    } else {
      btn = `<button class="train-up" data-id="${id}" ${can ? "" : "disabled"}>升级 (${cost} 碎)</button>`;
    }
    const metaLine = locked
      ? `<div class="train-meta"><span class="tr-lock">未招募</span> · <span class="tr-shard">碎片 ${sh}</span></div>`
      : `<div class="train-meta"><span class="tr-rank">升级 Lv.${rank}/${max}</span> · <span class="tr-shard">碎片 ${sh}</span></div>`;
    return `<div class="train-row ${maxed ? "maxed" : ""} ${locked ? "locked" : ""}">` +
      heroPortraitImg(id, "cx-portrait") +
      `<div class="train-info">` +
        `<div class="train-name">${h.name}<span class="tr-star">${RARITY[h.rarity].star}</span>${locked ? '<span class="tr-locktag">🔒</span>' : ""}</div>` +
        metaLine +
        pasHtml +
      `</div>` + btn + `</div>`;
  }).join("");
  el.trainList.querySelectorAll(".train-up[data-id]").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      if (rankUp(id)) { flash(HEROES[id].name + " 升至 Lv." + heroRank(id)); renderTrainList(); }
    });
  });
  el.trainList.querySelectorAll(".train-up[data-recruit]").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.dataset.recruit;
      if (recruitHero(id)) { flash("已招募 " + HEROES[id].name + "！"); Sfx.play("recruit"); renderTrainList(); }
    });
  });
}
function openTrain() {
  game.sceneReturn = game.scene;
  renderTrainList();
  switchScene("barracks");
}

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
  const h = HEROES[tw.hero];
  // 武将差异化倍率（默认 1），见 data.js
  const dmgMul = h.dmgMul || 1, rangeMul = h.rangeMul || 1, rateMul = h.rateMul || 1;
  // 永久升级加成（R9-2）：基础属性 ×(1+升级) → 升星(level 缩放) → 羁绊(bondMult)
  const rank = heroRank(tw.hero);
  const rankDmg = 1 + (rank - 1) * TUNING.rankDmgPerLv;
  const rankRange = 1 + (rank - 1) * TUNING.rankRangePerLv;
  const baseDmg = a.damage * dmgMul * rankDmg;
  let rawBase = baseDmg + (tw.level - 1) * Math.round(baseDmg * 0.6);
  // 庞统·连环计：溅射半径 +40%（modifier，被动解锁后生效）
  let splash = h.splash != null ? h.splash : a.splash;
  if (passiveUnlocked(tw.hero) && h.passive.type === "modifier") {
    const pp = h.passive.params;
    if (pp.splashMul) splash = Math.round(splash * pp.splashMul);
    // 廖化·蜀汉老将：随波次成长（每波 +growthPerWave，封顶 growthMax）
    if (pp.growthPerWave) {
      const g = Math.min(pp.growthMax || 1, Math.max(0, game.waveIndex) * pp.growthPerWave);
      rawBase = rawBase * (1 + g);
    }
  }
  // R22 连续征战增益（仅战斗内有 runBuffs；codex 预览时为 null → 取 1）
  const rb = game.runBuffs || null;
  const buffDmg = rb ? rb.dmgMul : 1, buffRange = rb ? rb.rangeMul : 1, buffRate = rb ? rb.rateMul : 1;
  return {
    range: Math.round((a.range * rangeMul * rankRange * (tw.auraRange || 1) * buffRange) + (tw.level - 1) * 12),
    damage: Math.round(rawBase * (tw.bondMult || 1) * (tw.auraMult || 1) * buffDmg),
    baseDamage: Math.round(rawBase),
    fireRate: a.fireRate * rateMul / (tw.rateBondMult || 1) / (tw.auraRate || 1) / buffRate,
    splash,
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
  // R21：过场动画进行中，点击跳过直接出结算卡
  if (game.cutscene && !game.cutscene.done) { finishCutscene(); return; }
  if (!game.mouse.cell) return;
  // 施放定点计谋（火计）
  if (game.targeting) { castTargetedSkill(game.targeting, game.mouse.x, game.mouse.y); return; }
  const { c, r } = game.mouse.cell;
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;

  const existing = towerAt(c, r);
  if (existing) {
    // 选中已有武将（升级由招贤重复抽取触发，这里仅查看/卖塔）
    if (!game.selectedHero) { game.selectedSlot = existing; updateSelInfo(); return; }
  }
  // 待部署武将 → 放到空地（招贤时已付招募费，这里不再扣费）
  if (!game.selectedHero) { game.selectedSlot = null; updateSelInfo(); return; }
  if (existing || pathBlocked.has(cellKey(c, r))) return;
  const hero = HEROES[game.selectedHero];
  game.towers.push({
    hero: game.selectedHero, arch: hero.arch, c, r,
    x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
    level: 1, cooldown: 0, angle: 0, bondMult: 1, rateBondMult: 1, attackAnim: 1, phase: Math.random() * 6.28,
    invested: game.pendingCost || RARITY[hero.rarity].deployCost,
  });
  game.selectedSlot = game.towers[game.towers.length - 1];
  game.selectedHero = null; game.pendingCost = 0;
  Sfx.play("place");
  updateSelInfo();
});

// ===== 招贤馆（R8-4）=====
function deployCostOf(hero) { return RARITY[hero.rarity].deployCost; }
function heroUpgradeCost(tw) { return Math.round(deployCostOf(HEROES[tw.hero]) * 0.7 * tw.level); }

// 招贤池：阵容(deck)内、未满级的武将（含未部署 + 已部署但未满级）
function recruitPool() {
  return Object.keys(HEROES).filter((id) => {
    if (meta.deck.length && !meta.deck.includes(id)) return false; // R10：仅出战阵容内
    const tw = game.towers.find((t) => t.hero === id);
    const maxLv = HEROES[id].maxLevel || 3;
    return !tw || tw.level < maxLv;
  });
}
function weightedPick(ids) {
  let total = 0;
  for (const id of ids) total += RARITY[HEROES[id].rarity].drawWeight;
  let roll = Math.random() * total;
  for (const id of ids) { roll -= RARITY[HEROES[id].rarity].drawWeight; if (roll <= 0) return id; }
  return ids[ids.length - 1];
}
function drawRecruit() {
  if (!game.running || game.over) return;
  if (game.selectedHero) { flash("请先安置待部署武将"); return; }
  const pool = recruitPool();
  if (!pool.length) { flash("武将皆已满级"); return; }
  if (game.gold < game.refreshCost) { flash("军粮不足"); return; }
  game.gold -= game.refreshCost;
  game.refreshCost += GameData.TUNING.recruitInc;
  // 不放回抽 3 个
  const avail = pool.slice();
  const picks = [];
  for (let i = 0; i < 3 && avail.length; i++) {
    const id = weightedPick(avail);
    picks.push(id);
    avail.splice(avail.indexOf(id), 1);
  }
  game.candidates = picks;
  Sfx.play("recruit");
  renderCandidates();
  updateHUD();
}
function selectCandidate(heroId) {
  const hero = HEROES[heroId];
  const existing = game.towers.find((t) => t.hero === heroId);
  if (existing) {
    // 重复 → 升级
    const cost = heroUpgradeCost(existing);
    if (game.gold < cost) { flash("军粮不足，无法升级"); return; }
    game.gold -= cost;
    existing.level += 1;
    existing.invested += cost;
    game.selectedSlot = existing;
    Sfx.play("upgrade");
    flash(hero.name + " 升至 Lv." + existing.level);
  } else {
    // 新武将 → 付招募费，待部署
    const cost = deployCostOf(hero);
    if (game.gold < cost) { flash("军粮不足"); return; }
    game.gold -= cost;
    game.selectedHero = heroId;
    game.pendingCost = cost;
    flash("点击空地安置 " + hero.name);
  }
  game.candidates = [];
  renderCandidates();
  updateSelInfo();
  updateHUD();
}
function renderCandidates() {
  el.candidates.innerHTML = "";
  for (const id of game.candidates) {
    const hero = HEROES[id];
    const existing = game.towers.find((t) => t.hero === id);
    const archName = { archer: "弓", spear: "枪", strategist: "谋" }[hero.arch];
    const cost = existing ? heroUpgradeCost(existing) : deployCostOf(hero);
    const costLabel = existing ? `升级 ${cost}` : `招募 ${cost}`;
    const afford = game.gold >= cost;
    const card = document.createElement("div");
    card.className = "cand-card" + (afford ? "" : " cant");
    card.dataset.cost = cost;  // R18：供 updateCandidateAfford 实时判定
    card.innerHTML =
      `${heroPortraitImg(id, "cand-portrait")}` +
      `<div class="cand-top"><span class="cand-name">${hero.name}</span>` +
      `<span class="tw-fac">${archName}</span><span class="cand-star">${RARITY[hero.rarity].star}</span></div>` +
      `<div class="cand-trait">${hero.trait || ""}${existing ? `（当前 Lv.${existing.level}）` : ""}</div>` +
      `<div class="cand-cost ${existing ? "up" : ""}">军粮 ${costLabel}</div>`;
    // R18：始终绑定点击（selectCandidate 自带军粮校验），军粮回升后即可选
    card.addEventListener("click", () => selectCandidate(id));
    el.candidates.appendChild(card);
  }
}
// R18：军粮变化时实时刷新候选卡灰显（不重建，保留监听）
function updateCandidateAfford() {
  if (!el.candidates) return;
  el.candidates.querySelectorAll(".cand-card").forEach((card) => {
    const cost = +card.dataset.cost || 0;
    card.classList.toggle("cant", game.gold < cost);
  });
}

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
    Sfx.play("skill_fire");
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
    Sfx.play("skill_fort");
    for (const en of game.enemies) {
      applySlow(en, sk.slowDur, sk.slowMult);
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
  const mode = game.overlayMode;
  el.overlay.classList.add("hidden");
  if (mode === "levelClear") startLevel(game.levelIndex + 1);
  else if (mode === "win") { showHome(); return; }
  else if (mode === "retry") startLevel(game.levelIndex);
  // intro / levelClear / retry → 开始战斗
  game.overlayMode = null;
  game.running = true;
});

el.ovBtn2.addEventListener("click", () => showHome());
el.menuBtn.addEventListener("click", () => showHome());

// ===== 场景状态机（R19）=====
// 每个场景是一个全屏 <section class="scene">，互斥显隐。switchScene 仅管 DOM 显隐 + 记录状态。
const SCENE_IDS = { home: "sceneHome", levels: "sceneLevels", deck: "sceneDeck", battle: "sceneBattle", barracks: "sceneBarracks", codex: "sceneCodex" };
function switchScene(name) {
  game.scene = name;
  for (const key of Object.keys(SCENE_IDS)) {
    const node = document.getElementById(SCENE_IDS[key]);
    if (node) node.classList.toggle("active", key === name);
  }
}

// ===== 主菜单 / 关卡选择（R7-1 → R19 场景化）=====
// 进入关卡选择场景：复位战斗态、停乐、渲染分章列表。
function showMenu() {
  game.running = false;
  game.over = false;
  game.paused = false;
  Sfx.stopMusic();
  game.overlayMode = null;
  el.overlay.classList.add("hidden"); // 收起战中结算弹窗
  renderMenuList();
  switchScene("levels");
  updatePauseUI();
}

// ===== 主界面 home（R19）=====
function chapterOfLevel(i) {
  if (CHAPTERS) for (const ch of CHAPTERS) if (i >= ch.from && i <= ch.to) return ch;
  return null;
}
function renderHomeOverview() {
  const node = document.getElementById("homeOverview");
  if (!node) return;
  const cur = Math.min(Math.max(0, game.maxUnlocked), LEVELS.length - 1);
  const ch = chapterOfLevel(cur);
  const lvName = LEVELS[cur] ? LEVELS[cur].name : "";
  const cleared = game.maxUnlocked >= LEVELS.length - 1;
  const unlockedCount = unlockedIds().length;
  const totalHeroes = Object.keys(HEROES).length;
  node.innerHTML =
    `<div class="ov-chip"><span class="ov-k">战役进度</span><span class="ov-v">${ch ? ch.name : "—"}　第 ${cur + 1}/${LEVELS.length} 关</span></div>` +
    `<div class="ov-chip"><span class="ov-k">武将解锁</span><span class="ov-v">${unlockedCount}/${totalHeroes}</span></div>` +
    `<button id="homeContinue" class="btn ov-continue">${cleared ? "重战" : "继续"}：${lvName} →</button>`;
  const cont = document.getElementById("homeContinue");
  if (cont) cont.addEventListener("click", () => enterLevel(cur));
}
function showHome() {
  game.running = false;
  game.over = false;
  game.paused = false;
  Sfx.stopMusic();
  game.overlayMode = null;
  el.overlay.classList.add("hidden");
  renderHomeOverview();
  switchScene("home");
  updatePauseUI();
}
function appendLevelBtn(i) {
  const lv = LEVELS[i];
  const locked = i > game.maxUnlocked;
  const cleared = i < game.maxUnlocked;
  const bossId = levelBossId(i);
  const btn = document.createElement("button");
  btn.className = "level-btn" + (locked ? " locked" : "") + (cleared ? " cleared" : "") + (bossId ? " boss" : "");
  const tag = locked ? "未解锁" : cleared ? "已通关" : "可挑战";
  const bossName = bossId && BOSSES[bossId] ? BOSSES[bossId].name : "";
  const bossMark = bossId ? `<span class="lv-boss">⚔ ${bossName}</span>` : "";
  btn.innerHTML = `<span class="lv-name">${i + 1}. ${lv.name}${bossMark}</span><span class="lv-tag">${tag}</span>`;
  if (!locked) btn.addEventListener("click", () => enterLevel(i));
  el.menuList.appendChild(btn);
}
function renderMenuList() {
  el.menuList.innerHTML = "";
  const grouped = new Set();
  // 分章渲染：每章一个标题 + 区内关卡
  if (CHAPTERS && CHAPTERS.length) {
    CHAPTERS.forEach((ch) => {
      const head = document.createElement("div");
      const chLocked = ch.from > game.maxUnlocked;
      head.className = "chapter-head" + (chLocked ? " locked" : "");
      head.textContent = ch.name;
      el.menuList.appendChild(head);
      for (let i = ch.from; i <= ch.to && i < LEVELS.length; i++) { appendLevelBtn(i); grouped.add(i); }
    });
  }
  // 兜底：未被任何章节覆盖的关卡（防止漏关）
  LEVELS.forEach((lv, i) => { if (!grouped.has(i)) appendLevelBtn(i); });
}
function enterLevel(i) {
  startLevel(i);          // 载入关卡（不开战），背景就绪
  showDeckSelect(i);      // R10：先选将
}

// ===== 选将界面（R10-2）：8 选 6 出战阵容 =====
let deckDraft = [];
function showDeckSelect(i) {
  game.pendingLevel = i;
  deckDraft = normalizeDeck(meta.deck);
  const lv = LEVELS[i];
  el.deckTitle.textContent = (i + 1) + ". " + lv.name + " · 选将出战";
  const fid = lv.featured;
  el.deckIntro.textContent = lv.intro + (fid && HEROES[fid] ? `（本关「${HEROES[fid].name}」碎片掉落提升）` : "");
  renderDeckGrid();
  switchScene("deck");
}
function renderDeckGrid() {
  el.deckGrid.innerHTML = unlockedIds().map((id) => {
    const h = HEROES[id];
    const on = deckDraft.includes(id);
    const rank = heroRank(id);
    const pas = h.passive;
    const pasHtml = pas
      ? `<div class="dk-pas ${passiveUnlocked(id) ? "on" : ""}">${passiveUnlocked(id) ? "★" + pas.name : pas.name + " Lv." + pas.unlockRank}</div>`
      : "";
    return `<div class="deck-cell ${on ? "on" : ""}" data-id="${id}">` +
      `<div class="dk-check">✓</div>` +
      heroPortraitImg(id, "dk-portrait") +
      `<div class="dk-name">${h.name} <span class="dk-star">${RARITY[h.rarity].star}</span></div>` +
      `<div class="dk-meta">升级 Lv.${rank}</div>` +
      pasHtml + `</div>`;
  }).join("");
  el.deckGrid.querySelectorAll(".deck-cell").forEach((cell) => {
    cell.addEventListener("click", () => toggleDeckCell(cell.dataset.id));
  });
  const n = deckDraft.length;
  el.deckCount.textContent = "已选 " + n + "/" + DECK_SIZE + "（至少 1）";
  el.deckCount.classList.toggle("full", n === DECK_SIZE);
  el.deckStart.disabled = n < 1 || n > DECK_SIZE;
}
function toggleDeckCell(id) {
  const idx = deckDraft.indexOf(id);
  if (idx >= 0) deckDraft.splice(idx, 1);
  else { if (deckDraft.length >= DECK_SIZE) { flash("最多选 " + DECK_SIZE + " 将"); return; } deckDraft.push(id); }
  renderDeckGrid();
}
function confirmDeck() {
  if (deckDraft.length < 1 || deckDraft.length > DECK_SIZE) return;
  meta.deck = deckDraft.slice();
  saveProgress();
  switchScene("battle");
  game.overlayMode = null;
  game.running = true;
  Sfx.init(); Sfx.startMusic();
  updateHUD();
}

// ===== 暂停 / 加速（R7-3）=====
el.pauseBtn.addEventListener("click", togglePause);
el.speedBtn.addEventListener("click", toggleSpeed);
function togglePause() {
  if (!game.running || game.over) return;
  game.paused = !game.paused;
  Sfx.duckMusic(game.paused);
  updatePauseUI();
}
function toggleSpeed() {
  game.speed = game.speed === 1 ? 2 : 1;
  updatePauseUI();
}
function updatePauseUI() {
  el.pauseBtn.textContent = game.paused ? "继续" : "暂停";
  el.speedBtn.textContent = game.speed + "x";
  el.pauseBtn.disabled = !game.running || game.over;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") drawRecruit();
  if (e.key === "s" || e.key === "S") trySell();
  if (e.key === "Escape") cancelPending();
  if (e.key === "1") onSkillButton("fire");
  if (e.key === "2") onSkillButton("fort");
  if (e.key === " ") { e.preventDefault(); togglePause(); }
  if (e.key === "f" || e.key === "F") toggleSpeed();
});

// 取消：先撤待部署武将（退还招募费），否则取消定点计谋
function cancelPending() {
  if (game.selectedHero) {
    game.gold += game.pendingCost || 0;
    game.selectedHero = null; game.pendingCost = 0;
    flash("已取消，退还军粮");
    updateSelInfo();
    return;
  }
  game.targeting = null; updateSkillUI();
}

// ===== 卖塔 / 撤将（R18：全额返还累计投入 = 部署 + 所有升级花费）=====
const SELL_REFUND_RATE = 1.0;
function sellRefund(t) { return Math.round((t.invested || RARITY[HEROES[t.hero].rarity].deployCost) * SELL_REFUND_RATE); }
function trySell() {
  const t = game.selectedSlot;
  if (!t) return;
  const refund = sellRefund(t);
  const i = game.towers.indexOf(t);
  if (i >= 0) game.towers.splice(i, 1);
  game.gold += refund;
  game.floaters.push({ x: t.x, y: t.y, text: "+" + refund, life: 0.9, color: "#c8a04a" });
  Art.emitParticles(t.x, t.y, { count: 8, color: HEROES[t.hero].color, speed: 60, life: 0.4, size: 3 });
  game.selectedSlot = null;
  updateSelInfo();
}

// ===== 波次 =====
function startNextWave() {
  game.waveIndex += 1;
  if (game.waveIndex >= waves.length) return;
  game.betweenWaves = false;
  Sfx.play("wave_start");
  const groups = waves[game.waveIndex];
  const queue = [];
  let t = 0;
  for (const g of groups) {
    if (g.boss) { queue.push({ boss: g.boss, at: t }); t += 1.2; continue; } // 末波名将
    for (let i = 0; i < g.count; i++) { queue.push({ type: g.type, at: t }); t += g.gap; }
  }
  game.spawnQueue = queue;
  game.spawnTimer = 0;
  updateHUD();
}

function spawnEnemy(type, pos) {
  const def = ENEMY_TYPES[type];
  const scale = 1 + game.waveIndex * HP_SCALE_PER_WAVE;
  game.enemies.push({
    type, spriteKey: "enemy:" + type,
    x: pos ? pos.x : path[0].x, y: pos ? pos.y : path[0].y,
    hp: def.hp * scale, maxHp: def.hp * scale,
    speed: def.speed, reward: def.reward, radius: def.radius, color: def.color,
    castleDmg: def.castleDmg, seg: pos ? pos.seg : 0, walk: Math.random() * 6.28, hitFlash: 0,
    armor: def.armor || 0,
    heal: def.heal || 0, healRadius: def.healRadius || 0, healCd: def.healCd || 0, healTimer: def.healCd || 0,
    _auraSpeed: 1, _auraArmor: 0,
  });
}

// 生成名将 Boss（R16）：固定血、不随波缩放、携带能力引擎
function spawnBoss(id) {
  const def = BOSSES[id];
  if (!def) return;
  const en = {
    type: "boss", bossId: id, boss: true, name: def.name, title: def.title || "",
    spriteKey: "boss:" + id,
    x: path[0].x, y: path[0].y,
    hp: def.hp, maxHp: def.hp,
    speed: def.speed, reward: def.reward, radius: def.radius, color: def.color,
    castleDmg: def.castleDmg, shardBonus: def.shardBonus || 0,
    seg: 0, walk: Math.random() * 6.28, hitFlash: 0,
    armor: def.armor || 0,
    heal: 0, healRadius: 0, healCd: 0, healTimer: 0,
    abilities: def.abilities, abilTimers: def.abilities.map((ab) => ab.everySec || 0),
    controlResist: 1, dmgReduction: 0, _enraged: false, _auraSpeed: 1, _auraArmor: 0,
  };
  for (const ab of def.abilities) if (ab.type === "resist") en.controlResist = ab.control;
  game.enemies.push(en);
  flash("⚔ 名将「" + def.name + "」现身！");
  Sfx.play("wave_start");
}

// ===== 名将 Boss 能力引擎（R16）=====
function processBosses(dt) {
  // 每帧清零光环临时量（所有敌人）
  for (const en of game.enemies) { en._auraSpeed = 1; en._auraArmor = 0; }
  const bosses = game.enemies.filter((e) => e.boss && e.hp > 0);
  if (!bosses.length) return;
  for (const b of bosses) {
    for (let i = 0; i < b.abilities.length; i++) {
      const ab = b.abilities[i];
      if (ab.type === "aura") {
        for (const en of game.enemies) {
          if (en === b || en.hp <= 0) continue;
          if (distance(b.x, b.y, en.x, en.y) > ab.radius) continue;
          if (ab.speedMul) en._auraSpeed = Math.max(en._auraSpeed, ab.speedMul);
          if (ab.armorBonus) en._auraArmor = Math.max(en._auraArmor, ab.armorBonus);
        }
      } else if (ab.type === "charge") {
        b.abilTimers[i] -= dt;
        if (b.abilTimers[i] <= 0) {
          b.abilTimers[i] = ab.everySec;
          b.chargeUntil = game.time + ab.dur; b.chargeMul = ab.speedMul;
          Art.emitParticles(b.x, b.y, { count: 16, color: "#e0c060", speed: 130, life: 0.5, size: 4, gravity: 30 });
          game.floaters.push({ x: b.x, y: b.y - b.radius - 16, text: b.name + "·冲锋!", life: 0.8, color: "#ffd24a" });
        }
      } else if (ab.type === "rally") {
        b.abilTimers[i] -= dt;
        if (b.abilTimers[i] <= 0) {
          b.abilTimers[i] = ab.everySec;
          for (let k = 0; k < ab.count; k++) spawnEnemy(ab.summon, { x: b.x, y: b.y, seg: b.seg });
          game.blasts.push({ x: b.x, y: b.y, r0: 6, r1: 52, life: 0.3, max: 0.3, color: "rgba(220,180,80,0.4)" });
          game.floaters.push({ x: b.x, y: b.y - b.radius - 16, text: b.name + "·召唤!", life: 0.8, color: "#ffd24a" });
        }
      } else if (ab.type === "regen") {
        if (b.hp > 0 && b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + ab.perSec * dt);
      } else if (ab.type === "enrage") {
        if (!b._enraged && b.hp <= b.maxHp * ab.hpPct) {
          b._enraged = true;
          b.enrageSpeed = ab.speedMul || 1;
          b.dmgReduction = ab.dmgReduction || 0;
          game.blasts.push({ x: b.x, y: b.y, r0: 6, r1: b.radius * 3, life: 0.5, max: 0.5, color: "rgba(220,60,60,0.5)" });
          Art.emitParticles(b.x, b.y, { count: 24, color: "#ff4a4a", speed: 150, life: 0.6, size: 4 });
          game.floaters.push({ x: b.x, y: b.y - b.radius - 16, text: b.name + "·狂暴!", life: 1.0, color: "#ff5a5a" });
        }
      }
    }
  }
}
// 控制施加（统一走抗性缩放）：boss controlResist<1 缩短、=0 免疫
function applyStun(en, dur) {
  const r = en.controlResist != null ? en.controlResist : 1;
  if (r <= 0) return;
  en.stunUntil = Math.max(en.stunUntil || 0, game.time + dur * r);
}
function applySlow(en, dur, mult) {
  const r = en.controlResist != null ? en.controlResist : 1;
  if (r <= 0) return;
  en.slowUntil = Math.max(en.slowUntil || 0, game.time + dur * r);
  en.slowMult = mult;
}

// ===== 羁绊计算 =====
function recomputeBonds() {
  const present = new Set(game.towers.map((t) => t.hero));
  const active = [];
  for (const b of BONDS) {
    if (b.heroes.every((h) => present.has(h))) active.push(b);
  }
  // 每个武将取其参与羁绊里各维度的最高加成（伤害、攻速分别取最大）
  for (const tw of game.towers) {
    let dmg = 1, rate = 1;
    for (const b of active) {
      if (!b.heroes.includes(tw.hero)) continue;
      const e = b.effect || {};
      if (e.dmgMul) dmg = Math.max(dmg, e.dmgMul);
      if (e.rateMul) rate = Math.max(rate, e.rateMul);
    }
    tw.bondMult = dmg;
    tw.rateBondMult = rate;
  }
  // 光环类被动（aura）：范围内友军获得对应维度加成；各维度分别取最高一个光环
  // 维度：dmgMul 伤害（刘备 仁德 / 关平 协同）、rateMul 攻速（姜维 继志北伐）、rangeMul 射程（王平 无当飞军）
  const auraSrc = game.towers.filter((t) => passiveUnlocked(t.hero) && HEROES[t.hero].passive.type === "aura");
  for (const tw of game.towers) {
    let aDmg = 1, aRate = 1, aRange = 1;
    for (const src of auraSrc) {
      if (src === tw) continue;
      const pr = HEROES[src.hero].passive.params;
      if (distance(src.x, src.y, tw.x, tw.y) > pr.radius) continue;
      if (pr.dmgMul) aDmg = Math.max(aDmg, pr.dmgMul);
      if (pr.rateMul) aRate = Math.max(aRate, pr.rateMul);
      if (pr.rangeMul) aRange = Math.max(aRange, pr.rangeMul);
    }
    tw.auraMult = aDmg;   // 兼容旧字段（伤害光环）
    tw.auraRate = aRate;
    tw.auraRange = aRange;
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
      const it = game.spawnQueue.shift();
      if (it.boss) spawnBoss(it.boss); else spawnEnemy(it.type);
    }
  }

  processBosses(dt); // R16 名将能力引擎（光环/冲锋/召唤/狂暴/自愈），须在移动前

  for (const en of game.enemies) {
    if (en.hp <= 0) continue;
    const target = path[en.seg + 1];
    if (!target) { reachCastle(en); continue; }
    const dx = target.x - en.x, dy = target.y - en.y;
    const d = Math.hypot(dx, dy);
    const stunned = game.time < (en.stunUntil || 0);
    const slow = game.time < (en.slowUntil || 0) ? (en.slowMult || SKILLS.fort.slowMult) : 1;
    let factor = slow * (en._auraSpeed || 1);
    if (en.boss) {
      if (game.time < (en.chargeUntil || 0)) factor *= en.chargeMul || 1;
      if (en._enraged) factor *= en.enrageSpeed || 1;
    }
    const step = stunned ? 0 : en.speed * factor * dt;
    en.walk += step * 0.08;
    if (en.hitFlash > 0) en.hitFlash -= dt;
    if (step > 0 && d <= step) { en.x = target.x; en.y = target.y; en.seg += 1; }
    else if (step > 0) { en.x += (dx / d) * step; en.y += (dy / d) * step; }
  }

  // 军医治疗光环（R11）：周期为范围内受伤友军回血
  for (const h of game.enemies) {
    if (h.hp <= 0 || !h.heal) continue;
    h.healTimer -= dt;
    if (h.healTimer > 0) continue;
    h.healTimer = h.healCd;
    let healed = false;
    for (const en of game.enemies) {
      if (en.hp <= 0 || en.hp >= en.maxHp) continue;
      if (distance(h.x, h.y, en.x, en.y) <= h.healRadius) {
        en.hp = Math.min(en.maxHp, en.hp + h.heal);
        Art.emitParticles(en.x, en.y - 4, { count: 5, color: "#7fe0a0", speed: 36, life: 0.5, size: 3 });
        healed = true;
      }
    }
    if (healed) game.blasts.push({ x: h.x, y: h.y, r0: 4, r1: h.healRadius, life: 0.3, max: 0.3, color: "rgba(127,224,160,0.18)" });
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
        Sfx.play("fire_" + tw.arch);
        if (s.projSpeed >= 999) {
          // 枪兵：瞬时命中 + 枪刺火花
          Art.emitParticles(target.x, target.y, { count: 8, color: "#ffe0a0", speed: 90, life: 0.3, size: 2.5 });
          resolveHit(tw, target, target.x, target.y, s.damage, s.splash, s.range);
        } else {
          game.projectiles.push({
            x: tw.x, y: tw.y, tx: target.x, ty: target.y, target,
            speed: s.projSpeed, damage: s.damage, splash: s.splash, color: s.projColor,
            arch: tw.arch, ownerTw: tw, range: s.range,
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
  const tw = p.ownerTw;
  if (p.splash > 0) {
    // 火攻溅射：橙红火球爆点
    Art.emitParticles(p.tx, p.ty, { count: 16, color: "#ff7a2a", speed: 110, life: 0.5, size: 4, gravity: 40 });
    Art.emitParticles(p.tx, p.ty, { count: 8, color: "#ffd24a", speed: 70, life: 0.4, size: 3 });
    game.blasts.push({ x: p.tx, y: p.ty, r0: 6, r1: p.splash, life: 0.3, max: 0.3, color: "rgba(255,120,42,0.5)" });
    if (tw) resolveHit(tw, p.target, p.tx, p.ty, p.damage, p.splash, p.range || 9999);
    else areaDamage(p.tx, p.ty, p.splash, p.damage);
  } else if (p.target && p.target.hp > 0) {
    if (tw) resolveHit(tw, p.target, p.tx, p.ty, p.damage, 0, p.range || 9999);
    else damage(p.target, p.damage);
    Art.emitParticles(p.tx, p.ty, { count: 6, color: p.color || "#ffe0a0", speed: 70, life: 0.3, size: 2.5 });
  }
}

// ===== 命中结算（R9-3/4）：modifier/onHit 被动 + 溅射 + 攻击归属 =====
function resolveHit(tw, target, ix, iy, baseDamage, splash, range) {
  const h = HEROES[tw.hero];
  const p = passiveUnlocked(tw.hero) ? h.passive : null;
  let dmg = baseDamage, crit = false;
  // modifier·黄忠 百步穿杨：目标越远伤害越高
  if (p && p.type === "modifier" && p.params.distBonus && target) {
    const frac = Math.min(1, distance(tw.x, tw.y, target.x, target.y) / (range || 1));
    dmg = Math.round(dmg * (1 + p.params.distBonus * frac));
  }
  // onHit·关羽 武圣：暴击
  if (p && p.type === "onHit" && p.params.critChance && Math.random() < p.params.critChance) {
    dmg = Math.round(dmg * p.params.critMul); crit = true;
  }
  // R22·锐卒增益：全军额外暴击（与被动暴击不叠乘，取已暴免重复）
  if (!crit && game.runBuffs && game.runBuffs.critChance > 0 && Math.random() < game.runBuffs.critChance) {
    dmg = Math.round(dmg * 1.8); crit = true;
  }
  // 主伤害（溅射 or 单体），带攻击归属
  if (splash > 0) areaDamageBy(ix, iy, splash, dmg, tw, null);
  else if (target && target.hp > 0) damageBy(target, dmg, tw);
  if (crit && target) game.floaters.push({ x: target.x, y: target.y - 10, text: "暴击!", life: 0.7, color: "#ffd24a" });
  if (crit) Sfx.play("crit");
  // onHit 对主目标附加控制/溅射
  if (p && p.type === "onHit" && target && target.hp > 0) {
    if (p.params.stunChance && Math.random() < p.params.stunChance) {
      applyStun(target, p.params.stunDur);
      Art.emitParticles(target.x, target.y - 8, { count: 6, color: "#ffe066", speed: 50, life: 0.5, size: 3 });
    }
    if (p.params.slowDur) {
      applySlow(target, p.params.slowDur, p.params.slowMult);
      Art.emitParticles(target.x, target.y, { count: 5, color: "#7ec8ff", speed: 40, life: 0.5, size: 3 });
    }
    if (p.params.splashRadius) { // 赵云 龙胆：攻击附带小范围溅射
      areaDamageBy(target.x, target.y, p.params.splashRadius, Math.round(dmg * p.params.splashMul), tw, target);
      game.blasts.push({ x: target.x, y: target.y, r0: 4, r1: p.params.splashRadius, life: 0.22, max: 0.22, color: "rgba(216,216,232,0.4)" });
    }
    // 魏延 奇袭：永久削减目标护甲（克制盾兵）
    if (p.params.armorBreak && target.armor) {
      target.armor = Math.max(0, target.armor - p.params.armorBreak);
      Art.emitParticles(target.x, target.y, { count: 5, color: "#d8b84a", speed: 50, life: 0.4, size: 3 });
    }
    // 马岱 追斩：残血直接斩杀
    if (p.params.execute && target.hp > 0 && target.hp <= target.maxHp * p.params.execute) {
      target.hp = 0;
      Sfx.play("execute");
      game.floaters.push({ x: target.x, y: target.y - 10, text: "斩!", life: 0.7, color: "#ff5a5a" });
      Art.emitParticles(target.x, target.y, { count: 14, color: "#ff5a5a", speed: 120, life: 0.5, size: 4 });
      onEnemyKilled(target, tw);
    }
  }
}

function areaDamage(x, y, radius, amount) { areaDamageBy(x, y, radius, amount, null, null); }
function areaDamageBy(x, y, radius, amount, tw, exclude) {
  for (const en of game.enemies) {
    if (en.hp <= 0 || en === exclude) continue;
    if (distance(x, y, en.x, en.y) <= radius) damageBy(en, amount, tw);
  }
}
function damage(en, amount) { damageBy(en, amount, null); }
function damageBy(en, amount, tw) {
  const wasAlive = en.hp > 0;
  // 护甲减伤（盾兵 + Boss 光环临时护甲）：每次受击固定减免，最低保留 1 点
  const armor = (en.armor || 0) + (en._auraArmor || 0);
  let eff = armor ? Math.max(1, amount - armor) : amount;
  // Boss 狂暴减伤
  if (en.dmgReduction) eff = Math.max(1, Math.round(eff * (1 - en.dmgReduction)));
  en.hp -= eff;
  en.hitFlash = 0.12; // 受击白闪
  if (wasAlive && en.hp <= 0) onEnemyKilled(en, tw);
}
function onEnemyKilled(en, tw) {
  // R22·取敌之资增益：击杀军粮加成
  const reward = game.runBuffs && game.runBuffs.killGoldMul ? Math.round(en.reward * (1 + game.runBuffs.killGoldMul)) : en.reward;
  game.gold += reward;
  Sfx.play("kill");
  game.floaters.push({ x: en.x, y: en.y, text: "+" + reward, life: 0.8, color: "#c8a04a" });
  // 死亡消散粒子
  Art.emitParticles(en.x, en.y, { count: 12, color: en.color, speed: 80, life: 0.5, size: 3, gravity: 30 });
  // 名将 Boss 授首（R16）：盛大特效 + 记录 featured 碎片奖励（结算并入掉落）
  if (en.boss) {
    game._bossBonus = (game._bossBonus || 0) + (en.shardBonus || 0);
    Sfx.play("win");
    game.floaters.push({ x: en.x, y: en.y - 18, text: "名将「" + en.name + "」授首！", life: 1.5, color: "#ffd24a" });
    Art.emitParticles(en.x, en.y, { count: 40, color: "#ffd24a", speed: 170, life: 0.8, size: 5, gravity: 30 });
    game.blasts.push({ x: en.x, y: en.y, r0: 8, r1: en.radius * 4, life: 0.6, max: 0.6, color: "rgba(255,210,74,0.4)" });
  }
  // onKill·诸葛亮 八阵图：击杀触发二次小爆
  if (tw && passiveUnlocked(tw.hero)) {
    const p = HEROES[tw.hero].passive;
    if (p.type === "onKill" && p.params.boomRadius) {
      game.blasts.push({ x: en.x, y: en.y, r0: 6, r1: p.params.boomRadius, life: 0.32, max: 0.32, color: "rgba(120,180,255,0.5)" });
      Art.emitParticles(en.x, en.y, { count: 14, color: "#9ad0ff", speed: 120, life: 0.5, size: 4 });
      areaDamageBy(en.x, en.y, p.params.boomRadius, p.params.boomDamage, tw, en);
    }
    // 法正 鬼才：击杀额外获军粮
    if (p.type === "onKill" && p.params.goldBonus) {
      game.gold += p.params.goldBonus;
      game.floaters.push({ x: en.x, y: en.y - 12, text: "+" + p.params.goldBonus + "粮", life: 0.8, color: "#ffd24a" });
    }
  }
}
function spawnHitFx(x, y, color) {
  game.floaters.push({ x, y, text: "·", life: 0.2, color });
}
function reachCastle(en) {
  en.reached = true;
  const dmg = en.castleDmg || 1;
  Sfx.play("castle_hit");
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
  drawBossBar();
  if (game.paused && game.running) {
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f0e6d2"; ctx.font = "bold 36px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("‖ 暂停", canvas.width / 2, canvas.height / 2);
  }
  // R21：结算过场动画叠加层
  if (game.cutscene && !game.cutscene.done) {
    const p = game.cutscene.t / game.cutscene.dur;
    Art.drawCutscene(ctx, canvas.width, canvas.height, game.cutscene.type, p);
  }
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

// 名将 Boss 顶部专属血条（R16）
function drawBossBar() {
  const b = game.enemies.find((e) => e.boss && e.hp > 0);
  if (!b) return;
  const w = 440, h = 18, x = (canvas.width - w) / 2, y = 16;
  const pct = Math.max(0, b.hp / b.maxHp);
  ctx.fillStyle = "rgba(20,12,8,0.72)"; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = "#3a2018"; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pct > 0.5 ? "#d4503a" : pct > 0.25 ? "#d87a2a" : "#a02828";
  ctx.fillRect(x, y, w * pct, h);
  ctx.strokeStyle = "#caa84a"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#ffe6a0"; ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("⚔ " + b.name + (b.title ? " · " + b.title : "") + "　" + Math.ceil(b.hp) + "/" + b.maxHp,
    canvas.width / 2, y + h / 2);
  if (b._enraged) { ctx.fillStyle = "#ff6a6a"; ctx.fillText("狂暴", x + w + 28, y + h / 2); }
  ctx.textBaseline = "alphabetic";
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
    // 仁德光环（刘备 aura 被动）：淡蓝光环范围
    if (passiveUnlocked(tw.hero) && hero.passive.type === "aura") {
      const pr = hero.passive.params;
      ctx.strokeStyle = "rgba(110,170,230,0.28)"; ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(tw.x, tw.y, pr.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
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
    if (en.boss) {
      ctx.strokeStyle = "rgba(255,210,74,0.55)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(en.x, en.y + en.radius * 0.7, en.radius * 1.1, en.radius * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
    }
    Art.drawSprite(ctx, en.spriteKey || ("enemy:" + en.type), en.x, en.y, {
      size, walk: en.walk, flashAlpha: en.hitFlash > 0 ? en.hitFlash / 0.12 * 0.7 : 0,
    });
    if (en.boss) {
      ctx.fillStyle = "#ffd24a"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(en.name, en.x, en.y - en.radius - 18);
    }
    const w = en.radius * 2, pct = Math.max(0, en.hp / en.maxHp);
    ctx.fillStyle = "#000"; ctx.fillRect(en.x - w / 2, en.y - en.radius - 12, w, 4);
    ctx.fillStyle = pct > 0.5 ? "#6fae4a" : pct > 0.25 ? "#d8a850" : "#d4503a";
    ctx.fillRect(en.x - w / 2, en.y - en.radius - 12, w * pct, 4);
    // 眩晕标记（张飞·燕人咆哮）：头顶旋转星
    if (game.time < (en.stunUntil || 0)) {
      ctx.fillStyle = "#ffe066"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
      for (let k = 0; k < 3; k++) {
        const a = game.time * 6 + k * 2.094;
        ctx.fillText("✦", en.x + Math.cos(a) * 9, en.y - en.radius - 16 + Math.sin(a) * 3);
      }
    }
    // 减速标记（马超·西凉铁骑）：淡蓝足环
    else if (game.time < (en.slowUntil || 0)) {
      ctx.strokeStyle = "rgba(126,200,255,0.7)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(en.x, en.y + en.radius * 0.7, en.radius * 0.9, en.radius * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
    }
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
  updatePauseUI();
  updateRecruitUI();
  updateCandidateAfford();
}

function updateRecruitUI() {
  if (el.recruitCost) el.recruitCost.textContent = "军粮 " + game.refreshCost;
  if (el.recruitBtn) {
    const poolEmpty = recruitPool().length === 0;
    el.recruitBtn.disabled = !game.running || game.over || !!game.selectedHero || poolEmpty || game.gold < game.refreshCost;
  }
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
  if (game.selectedHero) {
    const hero = HEROES[game.selectedHero];
    el.selInfo.innerHTML = `待部署：<b>${hero.name}</b><br>点击空地安置（Esc 取消退款）`;
    return;
  }
  const t = game.selectedSlot;
  if (t) {
    const hero = HEROES[t.hero]; const s = towerStats(t);
    const maxed = t.level >= (hero.maxLevel || 3);
    const bondNote = t.bondMult > 1 ? `<br><span style="color:#6fae4a">羁绊 +${Math.round((t.bondMult - 1) * 100)}%</span>` : "";
    const auraNote = t.auraMult > 1 ? `<br><span style="color:#7ec8ff">伤害光环 +${Math.round((t.auraMult - 1) * 100)}%</span>` : "";
    const rank = heroRank(t.hero);
    const rankNote = `<br><span style="color:#c8a04a">升级 Lv.${rank}/${maxRank()}</span>`;
    const pas = hero.passive;
    const pasNote = pas
      ? `<br>被动「${pas.name}」：` + (passiveUnlocked(t.hero)
          ? `<span style="color:#6fae4a">已激活</span>`
          : `<span style="color:#9a8a72">升级 Lv.${pas.unlockRank} 解锁</span>`)
      : "";
    el.selInfo.innerHTML =
      `<b>${hero.name}</b> ${RARITY[hero.rarity].star} Lv.${t.level}${maxed ? "（满级）" : ""}${bondNote}${auraNote}${rankNote}${pasNote}<br>` +
      `伤害 ${s.damage}　射程 ${s.range}<br><br>` +
      `${maxed ? "已满级，招贤再抽到将不再出现<br>" : "招贤再抽到此将可升级<br>"}` +
      `按 <b>S</b> 撤将（全额返还军粮 ${sellRefund(t)}）`;
    return;
  }
  el.selInfo.textContent = "点击「招贤」抽取武将，或点已有武将查看";
}
function flash(text) {
  el.speedHint.textContent = text;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { el.speedHint.textContent = ""; }, 2000);
}

// ===== 胜负 =====
// R21：过场动画 → 揭示结算卡。win/lose 先算结果存 payload，播放过场，结束后 applyResultOverlay。
function startCutscene(type, payload) {
  game.cutscene = { type, t: 0, dur: type === "win" ? 1.7 : 1.5, payload, done: false };
}
function finishCutscene() {
  const cs = game.cutscene;
  if (!cs || cs.done) return;
  cs.done = true;
  applyResultOverlay(cs.payload);
  game.cutscene = null;
}
function applyResultOverlay(pl) {
  game.overlayMode = pl.mode;
  el.ovTitle.textContent = pl.title;
  el.ovText.textContent = pl.text;
  el.ovBtn.textContent = pl.btn;
  el.ovBtn.classList.remove("hidden");
  if (pl.showBtn2) el.ovBtn2.classList.remove("hidden"); else el.ovBtn2.classList.add("hidden");
  el.overlay.classList.remove("hidden");
  el.overlay.classList.remove("cut-reveal"); void el.overlay.offsetWidth; el.overlay.classList.add("cut-reveal");
  updatePauseUI();
}
function win() {
  game.over = true; game.running = false; game.paused = false;
  Sfx.stopMusic(); Sfx.play("win");
  unlockLevel(game.levelIndex + 1); // 解锁下一关（R7-2）
  // 通关碎片奖励（R17）：按稀有度概率掉落，featured 提升；Boss 额外补 featured 碎片
  const idx = game.levelIndex;
  const featured = LEVELS[idx].featured;
  const drops = rollShardDrops(idx);
  if (game._bossBonus && featured && HEROES[featured]) drops[featured] = (drops[featured] || 0) + game._bossBonus;
  addShards(drops);
  const dn = Object.keys(drops);
  const shardLine = dn.length
    ? "　战利碎片：" + dn.map((id) => `${HEROES[id].name}×${drops[id]}`).join("、")
    : "";
  let payload;
  if (game.levelIndex >= LEVELS.length - 1) {
    payload = { mode: "win", title: "天下大势已定！", text: "三战皆捷，威震华夏。" + shardLine, btn: "返回主菜单", showBtn2: false };
  } else {
    payload = { mode: "levelClear", title: "大捷！", text: LEVELS[game.levelIndex].name + " 已下。下一战：" + LEVELS[game.levelIndex + 1].name + shardLine, btn: "进军下一关", showBtn2: true };
  }
  startCutscene("win", payload);
  updatePauseUI();
}
function lose() {
  game.over = true; game.running = false; game.paused = false;
  Sfx.stopMusic(); Sfx.play("lose");
  startCutscene("lose", { mode: "retry", title: "关隘失守", text: "城池被攻破……整军再来，未为晚也。", btn: "重整旗鼓", showBtn2: true });
  updatePauseUI();
}
function startLevel(i) {
  game.levelIndex = i;
  loadLevel(i);
  const lv = LEVELS[i];
  const rb = game.runBuffs; // R22：连续征战增益（起始军粮/城防/刷新费）
  game.gold = lv.gold + (rb ? rb.goldStart : 0);
  game.hp = lv.hp + (rb ? rb.hpBonus : 0);
  game.over = false;
  game.waveIndex = -1; game.spawnQueue = []; game.betweenWaves = true;
  game.enemies = []; game.towers = []; game.projectiles = []; game.floaters = [];
  game.activeBonds = []; game._bondSig = null;
  game.time = 0; game.skillReady = { fire: 0, fort: 0 }; game.targeting = null; game.blasts = [];
  game._bossBonus = 0;
  game.cutscene = null; // R21：清结算过场
  game.paused = false; game.speed = 1;
  game.refreshCost = Math.max(10, GameData.TUNING.recruitBase - (rb ? rb.refreshCut : 0));
  game.candidates = []; game.pendingCost = 0;
  Art.clearParticles();
  game.selectedHero = null; game.selectedSlot = null;
  if (el.title) el.title.textContent = lv.name;
  renderBondPanel([]);
  renderCandidates();
  updateHUD(); updateSelInfo(); updatePauseUI();
}

// ===== 主循环 =====
function loop(now) {
  const dt = Math.min(0.05, (now - game.lastTime) / 1000 || 0);
  game.lastTime = now;
  if (!game.paused) {
    for (let i = 0; i < game.speed; i++) update(dt); // 加速 = 每帧多跑几步
  }
  // R21：结算过场推进（独立于 update，game.over 后仍走时）
  if (game.cutscene && !game.cutscene.done) {
    game.cutscene.t += dt;
    if (game.cutscene.t >= game.cutscene.dur) finishCutscene();
  }
  if (game.scene === "battle") draw(); // R19：仅战斗场景绘制战场 canvas
  else if (game.scene === "home" && homeCtx) Art.drawHomeScene(homeCtx, homeCanvas.width, homeCanvas.height, now / 1000);
  requestAnimationFrame(loop);
}

// ===== 启动 =====
Art.preloadSprites();
const _save = loadSave();
game.maxUnlocked = _save.maxUnlocked;
meta.shards = _save.shards;
meta.ranks = _save.ranks;
meta.deck = _save.deck;
meta.unlocked = _save.unlocked;
startLevel(0);   // 预载关卡（path/waves 就绪，供战斗场景绘制）
showHome();      // R19：落地到主界面
updateMuteUI();
requestAnimationFrame(loop);
