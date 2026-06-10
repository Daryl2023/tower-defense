"use strict";

// ============================================================
// 游戏数据配置（R8-1）：所有可调数值集中于此，挂到 window.GameData
// 扩展约定：加武将=HEROES 加一项 + sprites.js 加画法；加羁绊=BONDS 加一项；加关卡=LEVELS 加一项。
// 用 IIFE 包裹，内部 const 不泄漏到全局，避免与 game.js 撞名。
// ============================================================
(function () {

// 稀有度 → 招募费 + 抽取权重（招贤系统 R8-4 使用）
const RARITY = {
  1: { star: "★",   deployCost: 40,  drawWeight: 10 },
  2: { star: "★★",  deployCost: 70,  drawWeight: 5  },
  3: { star: "★★★", deployCost: 110, drawWeight: 2  },
};

// 兵种原型（决定战斗方式）
const ARCHETYPES = {
  archer:     { range: 130, damage: 14, fireRate: 0.45, splash: 0,  projColor: "#e8e0c0", projSpeed: 480 },
  spear:      { range: 85,  damage: 42, fireRate: 0.75, splash: 0,  projColor: "#d8d0b0", projSpeed: 999 },
  strategist: { range: 115, damage: 24, fireRate: 1.05, splash: 50, projColor: "#ff8a3a", projSpeed: 420 },
};

// 武将
// 字段：name/faction/arch/rarity/color；可选差异化 dmgMul/rangeMul/rateMul/splash；maxLevel 满级
// cost 为旧商店造价（R8-4 招贤系统将改用 RARITY.deployCost）
const HEROES = {
  liubei:     { name: "刘备",   arch: "archer",     faction: "蜀", rarity: 1, cost: 60,  color: "#4a90c8", maxLevel: 3, trait: "主公·均衡" },
  guanyu:     { name: "关羽",   arch: "archer",     faction: "蜀", rarity: 2, cost: 50,  color: "#6fae4a", maxLevel: 3, trait: "高伤弓",       dmgMul: 1.25 },
  zhangfei:   { name: "张飞",   arch: "spear",      faction: "蜀", rarity: 2, cost: 70,  color: "#c89a3a", maxLevel: 3, trait: "高伤近战",     dmgMul: 1.1 },
  machao:     { name: "马超",   arch: "spear",      faction: "蜀", rarity: 2, cost: 70,  color: "#c0c0d0", maxLevel: 3, trait: "锦马超·枪带溅射", splash: 38, dmgMul: 0.85 },
  huangzhong: { name: "黄忠",   arch: "archer",     faction: "蜀", rarity: 2, cost: 70,  color: "#b87333", maxLevel: 3, trait: "老将神射·超远射程", rangeMul: 1.45, dmgMul: 1.15, rateMul: 1.25 },
  pangtong:   { name: "庞统",   arch: "strategist", faction: "蜀", rarity: 2, cost: 70,  color: "#7a9a6a", maxLevel: 3, trait: "凤雏·范围控制",   dmgMul: 0.7 },
  zhaoyun:    { name: "赵云",   arch: "spear",      faction: "蜀", rarity: 3, cost: 100, color: "#d8d8e8", maxLevel: 3, trait: "常胜将军·全能高攻速", dmgMul: 1.15, rateMul: 0.7, rangeMul: 1.15 },
  zhugeliang: { name: "诸葛亮", arch: "strategist", faction: "蜀", rarity: 3, cost: 100, color: "#c8503a", maxLevel: 3, trait: "卧龙·强范围火攻", dmgMul: 1.2 },
};

// 羁绊
// effect: { dmgMul?, rateMul? }  dmgMul 伤害倍率；rateMul 攻速倍率(>1 更快)
const BONDS = [
  { id: "taoyuan", name: "桃园结义", heroes: ["liubei", "guanyu", "zhangfei"],
    effect: { dmgMul: 1.25 }, desc: "刘备·关羽·张飞同场，三人伤害 +25%" },
  { id: "wuhu", name: "五虎上将", heroes: ["guanyu", "zhangfei", "zhaoyun", "machao", "huangzhong"],
    effect: { dmgMul: 1.35, rateMul: 1.15 }, desc: "关·张·赵·马·黄五人集结，伤害 +35%、攻速 +15%" },
  { id: "wolong", name: "卧龙凤雏", heroes: ["zhugeliang", "pangtong"],
    effect: { dmgMul: 1.4 }, desc: "诸葛亮·庞统同场，二人范围伤害 +40%" },
];

// 计谋（主动技能）
const SKILLS = {
  fire: { name: "火计", cd: 12, radius: 78, damage: 90, targeted: true },
  fort: { name: "空城计", cd: 18, slowDur: 4, slowMult: 0.5, targeted: false },
};

// 敌军
const ENEMY_TYPES = {
  infantry: { name: "步兵", hp: 60,  speed: 55,  reward: 8,  color: "#b8b0a0", radius: 12, castleDmg: 1 },
  cavalry:  { name: "骑兵", hp: 40,  speed: 105, reward: 11, color: "#d8a850", radius: 11, castleDmg: 1 },
  siege:    { name: "攻城车", hp: 520, speed: 32, reward: 55, color: "#8a5a3a", radius: 19, castleDmg: 3 },
};

// 全局调参
const TUNING = {
  hpScalePerWave: 0.18,   // 每波敌人血量递增
  upgradeCostMult: 0.8,   // 旧升级费倍率（R8-4 后由招贤系统接管）
  recruitBase: 25,        // 招贤刷新起始费（每关重置）
  recruitInc: 12,         // 每次招贤后刷新费增量
};

// 关卡
const LEVELS = [
  {
    name: "虎牢关之战",
    intro: "守住虎牢关，击退董卓大军！",
    gold: 285, hp: 20,
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
    gold: 280, hp: 20,
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
    gold: 300, hp: 18,
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

window.GameData = { RARITY, ARCHETYPES, HEROES, BONDS, SKILLS, ENEMY_TYPES, TUNING, LEVELS };

})();
