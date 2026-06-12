"use strict";

// ============================================================
// 游戏数据配置（R8-1）：所有可调数值集中于此，挂到 window.GameData
// 扩展约定：加武将=HEROES 加一项 + sprites.js 加画法；加羁绊=BONDS 加一项；
//          加关卡=LEVELS 加一项；加 Boss=BOSSES 加一项 + sprites.js 加画法。
// 用 IIFE 包裹，内部 const 不泄漏到全局，避免与 game.js 撞名。
// ============================================================
(function () {

// 稀有度 → 招募费 + 抽取权重（招贤系统 R8-4 使用；R17 碎片掉落复用 drawWeight）
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
// passive（R9）：{ name, unlockRank, type, params, desc }；升级达 unlockRank 解锁，战斗中按 type 派发
//   type: onHit 命中触发 / onKill 击杀触发 / aura 常驻光环 / modifier 常驻属性改算
const HEROES = {
  liubei:     { name: "刘备",   arch: "archer",     faction: "蜀", rarity: 1, cost: 60,  color: "#4a90c8", maxLevel: 3, trait: "主公·均衡",
    passive: { name: "仁德", unlockRank: 3, type: "aura", params: { dmgMul: 1.12, radius: 95 }, desc: "范围内友军伤害 +12%" } },
  guanyu:     { name: "关羽",   arch: "archer",     faction: "蜀", rarity: 2, cost: 50,  color: "#6fae4a", maxLevel: 3, trait: "高伤弓",       dmgMul: 1.25,
    passive: { name: "武圣", unlockRank: 3, type: "onHit", params: { critChance: 0.15, critMul: 2 }, desc: "15% 概率暴击（双倍伤害）" } },
  zhangfei:   { name: "张飞",   arch: "spear",      faction: "蜀", rarity: 2, cost: 70,  color: "#c89a3a", maxLevel: 3, trait: "高伤近战",     dmgMul: 1.1,
    passive: { name: "燕人咆哮", unlockRank: 3, type: "onHit", params: { stunChance: 0.25, stunDur: 0.7 }, desc: "25% 概率眩晕命中目标 0.7s" } },
  machao:     { name: "马超",   arch: "spear",      faction: "蜀", rarity: 2, cost: 70,  color: "#c0c0d0", maxLevel: 3, trait: "锦马超·枪带溅射", splash: 38, dmgMul: 0.85,
    passive: { name: "西凉铁骑", unlockRank: 3, type: "onHit", params: { slowDur: 1.5, slowMult: 0.6 }, desc: "命中附带减速 1.5s" } },
  huangzhong: { name: "黄忠",   arch: "archer",     faction: "蜀", rarity: 2, cost: 70,  color: "#b87333", maxLevel: 3, trait: "老将神射·超远射程", rangeMul: 1.45, dmgMul: 1.15, rateMul: 1.25,
    passive: { name: "百步穿杨", unlockRank: 3, type: "modifier", params: { distBonus: 0.4 }, desc: "目标越远伤害越高（最高 +40%）" } },
  pangtong:   { name: "庞统",   arch: "strategist", faction: "蜀", rarity: 2, cost: 70,  color: "#7a9a6a", maxLevel: 3, trait: "凤雏·范围控制",   dmgMul: 0.7,
    passive: { name: "连环计", unlockRank: 3, type: "modifier", params: { splashMul: 1.4 }, desc: "溅射半径 +40%" } },
  zhaoyun:    { name: "赵云",   arch: "spear",      faction: "蜀", rarity: 3, cost: 100, color: "#d8d8e8", maxLevel: 3, trait: "常胜将军·全能高攻速", dmgMul: 1.15, rateMul: 0.7, rangeMul: 1.15,
    passive: { name: "龙胆", unlockRank: 3, type: "onHit", params: { splashRadius: 34, splashMul: 0.5 }, desc: "攻击附带小范围溅射（50% 伤害）" } },
  zhugeliang: { name: "诸葛亮", arch: "strategist", faction: "蜀", rarity: 3, cost: 100, color: "#c8503a", maxLevel: 3, trait: "卧龙·强范围火攻", dmgMul: 1.2,
    passive: { name: "八阵图", unlockRank: 3, type: "onKill", params: { boomRadius: 46, boomDamage: 28 }, desc: "击杀触发二次小范围爆炸" } },

  // ---------- R13: 武将扩充（+10 蜀将）----------
  jiangwei:   { name: "姜维",   arch: "strategist", faction: "蜀", rarity: 3, cost: 100, color: "#9aa6c8", maxLevel: 3, trait: "武侯传人·攻速光环", dmgMul: 1.15, splash: 46,
    passive: { name: "继志北伐", unlockRank: 3, type: "aura", params: { rateMul: 1.18, radius: 100 }, desc: "范围内友军攻速 +18%" } },
  weiyan:     { name: "魏延",   arch: "spear",      faction: "蜀", rarity: 2, cost: 70,  color: "#8a4a3a", maxLevel: 3, trait: "勇将·破甲奇袭", dmgMul: 1.25,
    passive: { name: "奇袭", unlockRank: 3, type: "onHit", params: { armorBreak: 5 }, desc: "命中永久削减目标护甲 5（克制盾兵）" } },
  fazheng:    { name: "法正",   arch: "strategist", faction: "蜀", rarity: 3, cost: 100, color: "#6a8a9a", maxLevel: 3, trait: "鬼才·军粮谋算", dmgMul: 1.15, splash: 44,
    passive: { name: "鬼才", unlockRank: 3, type: "onKill", params: { goldBonus: 6 }, desc: "击杀额外获得军粮 6" } },
  madai:      { name: "马岱",   arch: "archer",     faction: "蜀", rarity: 2, cost: 70,  color: "#b0a070", maxLevel: 3, trait: "西凉劲弩·追斩残敌", dmgMul: 1.05, rateMul: 0.9,
    passive: { name: "追斩", unlockRank: 3, type: "onHit", params: { execute: 0.18 }, desc: "目标血量低于 18% 时直接斩杀" } },
  guanping:   { name: "关平",   arch: "archer",     faction: "蜀", rarity: 1, cost: 50,  color: "#5a9a5a", maxLevel: 3, trait: "少将·协同光环",
    passive: { name: "协同", unlockRank: 3, type: "aura", params: { dmgMul: 1.1, radius: 90 }, desc: "范围内友军伤害 +10%" } },
  guanxing:   { name: "关兴",   arch: "spear",      faction: "蜀", rarity: 2, cost: 70,  color: "#4a8a4a", maxLevel: 3, trait: "将门虎子·暴击", dmgMul: 1.15,
    passive: { name: "将门虎子", unlockRank: 3, type: "onHit", params: { critChance: 0.18, critMul: 1.9 }, desc: "18% 概率暴击（×1.9）" } },
  zhangbao:   { name: "张苞",   arch: "spear",      faction: "蜀", rarity: 2, cost: 70,  color: "#3a3a44", maxLevel: 3, trait: "燕赵勇·虎啸眩晕", dmgMul: 1.15,
    passive: { name: "虎啸", unlockRank: 3, type: "onHit", params: { stunChance: 0.2, stunDur: 0.8 }, desc: "20% 概率眩晕命中目标 0.8s" } },
  wangping:   { name: "王平",   arch: "spear",      faction: "蜀", rarity: 2, cost: 70,  color: "#7a8a6a", maxLevel: 3, trait: "无当飞军·射程光环", dmgMul: 1.05, rangeMul: 1.1,
    passive: { name: "无当飞军", unlockRank: 3, type: "aura", params: { rangeMul: 1.15, radius: 95 }, desc: "范围内友军射程 +15%" } },
  liaohua:    { name: "廖化",   arch: "spear",      faction: "蜀", rarity: 1, cost: 50,  color: "#9a8a5a", maxLevel: 3, trait: "蜀汉老将·愈战愈勇",
    passive: { name: "蜀汉老将", unlockRank: 3, type: "modifier", params: { growthPerWave: 0.05, growthMax: 0.6 }, desc: "每波伤害 +5%（本关最高 +60%）" } },
  huangyueying:{ name: "黄月英", arch: "strategist", faction: "蜀", rarity: 2, cost: 70,  color: "#b89a6a", maxLevel: 3, trait: "机关术·范围阻滞", dmgMul: 0.8, splash: 52,
    passive: { name: "机关阻滞", unlockRank: 3, type: "onHit", params: { slowDur: 1.2, slowMult: 0.65 }, desc: "命中附带减速 1.2s（×0.65）" } },

  // ---------- R17: 起始低品质武将（开局即解锁，过渡兵，被动为现有机制弱化版）----------
  zhoucang:   { name: "周仓",   arch: "spear",      faction: "蜀", rarity: 1, cost: 45,  color: "#6a5a3a", maxLevel: 3, trait: "扛刀力士·忠勇", dmgMul: 1.0,
    passive: { name: "力斩", unlockRank: 3, type: "onHit", params: { critChance: 0.12, critMul: 1.6 }, desc: "12% 概率暴击（×1.6）" } },
  guansuo:    { name: "关索",   arch: "archer",     faction: "蜀", rarity: 1, cost: 45,  color: "#5a9a6a", maxLevel: 3, trait: "少年弓将", dmgMul: 0.95,
    passive: { name: "穿云", unlockRank: 3, type: "modifier", params: { distBonus: 0.2 }, desc: "目标越远伤害越高（最高 +20%）" } },
  dengzhi:    { name: "邓芝",   arch: "strategist", faction: "蜀", rarity: 1, cost: 45,  color: "#6a8a8a", maxLevel: 3, trait: "沉稳使者", dmgMul: 0.9, splash: 44,
    passive: { name: "斡旋", unlockRank: 3, type: "onKill", params: { goldBonus: 4 }, desc: "击杀额外获得军粮 4" } },
  chendao:    { name: "陈到",   arch: "spear",      faction: "蜀", rarity: 1, cost: 45,  color: "#8a8a78", maxLevel: 3, trait: "白毦卫·坚毅", dmgMul: 1.05,
    passive: { name: "白毦", unlockRank: 3, type: "onHit", params: { stunChance: 0.15, stunDur: 0.6 }, desc: "15% 概率眩晕命中目标 0.6s" } },
};

// 开局即解锁的起始武将（R17）；其余武将需碎片招募
const STARTERS = ["liubei", "zhoucang", "guansuo", "dengzhi", "chendao"];

// 羁绊
// effect: { dmgMul?, rateMul? }  dmgMul 伤害倍率；rateMul 攻速倍率(>1 更快)
const BONDS = [
  { id: "taoyuan", name: "桃园结义", heroes: ["liubei", "guanyu", "zhangfei"],
    effect: { dmgMul: 1.25 }, desc: "刘备·关羽·张飞同场，三人伤害 +25%" },
  { id: "wuhu", name: "五虎上将", heroes: ["guanyu", "zhangfei", "zhaoyun", "machao", "huangzhong"],
    effect: { dmgMul: 1.35, rateMul: 1.15 }, desc: "关·张·赵·马·黄五人集结，伤害 +35%、攻速 +15%" },
  { id: "wolong", name: "卧龙凤雏", heroes: ["zhugeliang", "pangtong"],
    effect: { dmgMul: 1.4 }, desc: "诸葛亮·庞统同场，二人范围伤害 +40%" },
  // ---------- R13: 新增羁绊 ----------
  { id: "guanmen", name: "关门虎子", heroes: ["guanyu", "guanping", "guanxing"],
    effect: { dmgMul: 1.3 }, desc: "关羽·关平·关兴父子同场，三人伤害 +30%" },
  { id: "huben", name: "虎贲双骁", heroes: ["guanxing", "zhangbao"],
    effect: { dmgMul: 1.2, rateMul: 1.1 }, desc: "关兴·张苞结义，二人伤害 +20%、攻速 +10%" },
  { id: "chuanren", name: "武侯传人", heroes: ["zhugeliang", "jiangwei"],
    effect: { dmgMul: 1.3 }, desc: "诸葛亮·姜维师徒同场，二人伤害 +30%" },
  { id: "jiguan", name: "机关连弩", heroes: ["zhugeliang", "huangyueying"],
    effect: { dmgMul: 1.25, rateMul: 1.1 }, desc: "诸葛亮·黄月英同场，二人伤害 +25%、攻速 +10%" },
];

// 计谋（主动技能）
const SKILLS = {
  fire: { name: "火计", cd: 12, radius: 78, damage: 90, targeted: true },
  fort: { name: "空城计", cd: 18, slowDur: 4, slowMult: 0.5, targeted: false },
};

// 敌军
// 可选机制字段：armor 护甲(每次受击固定减伤,最低保留1) / heal+healRadius+healCd 军医治疗光环
const ENEMY_TYPES = {
  infantry: { name: "步兵", hp: 60,  speed: 55,  reward: 8,  color: "#b8b0a0", radius: 12, castleDmg: 1 },
  cavalry:  { name: "骑兵", hp: 40,  speed: 105, reward: 11, color: "#d8a850", radius: 11, castleDmg: 1 },
  siege:    { name: "攻城车", hp: 520, speed: 32, reward: 55, color: "#8a5a3a", radius: 19, castleDmg: 3 },
  shield:   { name: "盾兵", hp: 150, speed: 42, reward: 18, color: "#7c8a99", radius: 14, castleDmg: 2, armor: 6 },
  healer:   { name: "军医", hp: 90,  speed: 60, reward: 22, color: "#cf6f7a", radius: 12, castleDmg: 1, heal: 14, healRadius: 72, healCd: 1.2 },
};

// ============================================================
// R16: 名将 Boss
// 字段：name/title/color/hp(固定,不随波缩放)/speed/radius/armor/reward/shardBonus/castleDmg
// abilities[]：{ type, ...params }
//   charge: {everySec,dur,speedMul} 周期冲锋  | rally: {everySec,summon,count} 周期召唤
//   aura:   {radius,speedMul?,armorBonus?} 范围增益其他敌人
//   enrage: {hpPct,speedMul?,dmgReduction?} 残血狂暴  | regen: {perSec} 自愈
//   resist: {control} 受控持续 ×control（0=免疫）
// ============================================================
const BOSSES = {
  lvbu: {
    name: "吕布", title: "飞将·入门之敌", color: "#b03a3a",
    hp: 520, speed: 46, radius: 21, armor: 2, reward: 80, shardBonus: 3, castleDmg: 4,
    abilities: [ { type: "charge", everySec: 7, dur: 1.2, speedMul: 2.0 } ],
  },
  caocao: {
    name: "曹操", title: "魏武·挟天子", color: "#3a4a7a",
    hp: 1500, speed: 36, radius: 22, armor: 6, reward: 120, shardBonus: 4, castleDmg: 5,
    abilities: [
      { type: "rally", everySec: 7, summon: "cavalry", count: 3 },
      { type: "aura", radius: 120, speedMul: 1.2 },
    ],
  },
  xiahouyuan: {
    name: "夏侯渊", title: "虎步关右·疾行", color: "#7a5a2a",
    hp: 1300, speed: 60, radius: 20, armor: 4, reward: 110, shardBonus: 3, castleDmg: 4,
    abilities: [ { type: "charge", everySec: 5, dur: 1.4, speedMul: 2.0 } ],
  },
  luxun: {
    name: "陆逊", title: "书生拜将·火烧连营", color: "#c85a2a",
    hp: 1700, speed: 40, radius: 21, armor: 4, reward: 130, shardBonus: 4, castleDmg: 5,
    abilities: [
      { type: "enrage", hpPct: 0.4, speedMul: 1.6, dmgReduction: 0.3 },
      { type: "rally", everySec: 8, summon: "infantry", count: 4 },
    ],
  },
  caoren: {
    name: "曹仁", title: "铁壁·据守", color: "#5a6a4a",
    hp: 2200, speed: 30, radius: 23, armor: 10, reward: 140, shardBonus: 4, castleDmg: 6,
    abilities: [
      { type: "regen", perSec: 14 },
      { type: "resist", control: 0.5 },
    ],
  },
  zhanghe: {
    name: "张郃", title: "巧变·五子良将", color: "#8a7a3a",
    hp: 1900, speed: 64, radius: 20, armor: 5, reward: 150, shardBonus: 5, castleDmg: 5,
    abilities: [
      { type: "charge", everySec: 5, dur: 1.5, speedMul: 2.2 },
      { type: "rally", everySec: 9, summon: "cavalry", count: 4 },
    ],
  },
  simayi: {
    name: "司马懿", title: "冢虎·鹰视狼顾", color: "#4a3a6a",
    hp: 2600, speed: 38, radius: 23, armor: 8, reward: 180, shardBonus: 6, castleDmg: 6,
    abilities: [
      { type: "aura", radius: 130, speedMul: 1.25, armorBonus: 3 },
      { type: "rally", everySec: 7, summon: "shield", count: 3 },
      { type: "enrage", hpPct: 0.35, speedMul: 1.5, dmgReduction: 0.35 },
    ],
  },
  dengai: {
    name: "邓艾", title: "偷渡阴平·终局", color: "#6a3a3a",
    hp: 3000, speed: 42, radius: 23, armor: 9, reward: 200, shardBonus: 8, castleDmg: 7,
    abilities: [
      { type: "charge", everySec: 5, dur: 1.6, speedMul: 2.2 },
      { type: "rally", everySec: 8, summon: "cavalry", count: 4 },
      { type: "enrage", hpPct: 0.4, speedMul: 1.5, dmgReduction: 0.3 },
      { type: "resist", control: 0.4 },
    ],
  },
};

// 全局调参
const TUNING = {
  hpScalePerWave: 0.18,   // 每波敌人血量递增（Boss 固定血，不受此影响）
  upgradeCostMult: 0.8,   // 旧升级费倍率（R8-4 后由招贤系统接管）
  recruitBase: 25,        // 招贤刷新起始费（每关重置）
  recruitInc: 6,          // 每次招贤后刷新费增量（R18：12→6，增长放缓）
  // 升级（R9，永久养成）：rankCost[lv] = 从 lv-1 升到 lv 所需专属碎片；rankDmgPerLv/rangePerLv = 每级加成
  rankCost: { 2: 4, 3: 8, 4: 14, 5: 22 },
  rankDmgPerLv: 0.08,     // 每级 +8% 基础伤害（Lv1 基准=0）
  rankRangePerLv: 0.03,   // 每级 +3% 射程
  maxRank: 5,
  // R17 碎片招募 + 概率掉落
  recruitShardCost: { 1: 6, 2: 14, 3: 26 }, // 招募(解锁)所需专属碎片，按稀有度
  shardDrawsBase: 5,       // 通关碎片抽取次数基础
  shardDrawsPerLevel: 0.6, // 每关递增：draws = base + floor(关序号 × 此值)
  featuredWeight: 16,      // featured 武将在掉落池中的附加权重（掉率显著提升）
};

// 关卡
// featured（R17）：本关掉率提升的武将 id（在选将介绍中注明）
// 某波 group 含 { boss:"id" } 即在该波接入对应 Boss（R16）
const LEVELS = [
  {
    name: "虎牢关之战",
    intro: "守住虎牢关，击退董卓大军！关底飞将吕布亲临。",
    gold: 285, hp: 20, featured: "guanyu",
    shardRewards: { guanyu: 3, zhangfei: 2 },
    cells: [{ c:0,r:2 },{ c:4,r:2 },{ c:4,r:7 },{ c:9,r:7 },{ c:9,r:2 },{ c:13,r:2 },{ c:13,r:7 },{ c:15,r:7 }],
    waves: [
      [{ type:"infantry", count:5,  gap:1.0 }],
      [{ type:"infantry", count:8,  gap:0.8 }],
      [{ type:"cavalry",  count:7,  gap:0.65 }],
      [{ type:"infantry", count:10, gap:0.6 }, { type:"cavalry", count:6, gap:0.5 }],
      [{ type:"infantry", count:14, gap:0.45 }, { type:"cavalry", count:10, gap:0.4 }, { boss:"lvbu" }],
    ],
  },
  {
    name: "官渡之战",
    intro: "以寡敌众，火烧乌巢，正面挡住袁绍大军。",
    gold: 280, hp: 20, featured: "zhangfei",
    shardRewards: { liubei: 2, huangzhong: 2, machao: 1 },
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
    intro: "借东风，火攻连环船，决战于大江之畔。关底魏武曹操压阵。",
    gold: 300, hp: 18, featured: "zhugeliang",
    shardRewards: { zhugeliang: 3, pangtong: 2, zhaoyun: 2 },
    cells: [{ c:0,r:1 },{ c:6,r:1 },{ c:6,r:5 },{ c:2,r:5 },{ c:2,r:8 },{ c:11,r:8 },{ c:11,r:2 },{ c:15,r:2 }],
    waves: [
      [{ type:"infantry", count:14, gap:0.5 }],
      [{ type:"cavalry",  count:16, gap:0.38 }],
      [{ type:"siege",    count:2,  gap:2.5 }, { type:"infantry", count:14, gap:0.45 }],
      [{ type:"cavalry",  count:18, gap:0.32 }, { type:"infantry", count:14, gap:0.4 }],
      [{ type:"siege",    count:3,  gap:2.0 }, { type:"cavalry", count:14, gap:0.35 }],
      [{ type:"siege",    count:4,  gap:1.6 }, { type:"infantry", count:20, gap:0.3 }, { type:"cavalry", count:14, gap:0.3 }, { boss:"caocao" }],
    ],
  },
  {
    name: "长坂坡之战",
    intro: "赵子龙单骑救主，七进七出，护少主突出重围！",
    gold: 320, hp: 18, featured: "zhaoyun",
    shardRewards: { zhaoyun: 3, zhangfei: 2 },
    cells: [{ c:0,r:4 },{ c:5,r:4 },{ c:5,r:8 },{ c:10,r:8 },{ c:10,r:2 },{ c:15,r:2 }],
    waves: [
      [{ type:"infantry", count:12, gap:0.5 }],
      [{ type:"cavalry",  count:14, gap:0.4 }],
      [{ type:"shield",   count:4,  gap:1.2 }, { type:"infantry", count:10, gap:0.5 }],
      [{ type:"cavalry",  count:16, gap:0.35 }, { type:"shield", count:3, gap:1.5 }],
      [{ type:"shield",   count:6,  gap:1.0 }, { type:"infantry", count:16, gap:0.4 }, { type:"cavalry", count:10, gap:0.4 }],
    ],
  },
  {
    name: "定军山之战",
    intro: "老将黄忠居高临下，刀劈夏侯渊，定鼎汉中。关底虎步夏侯渊。",
    gold: 330, hp: 18, featured: "huangzhong",
    shardRewards: { huangzhong: 3, liubei: 2, guanyu: 1 },
    cells: [{ c:0,r:8 },{ c:4,r:8 },{ c:4,r:3 },{ c:9,r:3 },{ c:9,r:7 },{ c:13,r:7 },{ c:13,r:2 },{ c:15,r:2 }],
    waves: [
      [{ type:"infantry", count:14, gap:0.45 }],
      [{ type:"shield",   count:5,  gap:1.0 }, { type:"cavalry", count:10, gap:0.4 }],
      [{ type:"healer",   count:2,  gap:2.0 }, { type:"infantry", count:16, gap:0.45 }],
      [{ type:"shield",   count:6,  gap:0.9 }, { type:"healer", count:2, gap:3.0 }, { type:"cavalry", count:12, gap:0.35 }],
      [{ type:"siege",    count:1,  gap:1.0 }, { type:"shield", count:5, gap:1.0 }, { type:"infantry", count:16, gap:0.4 }],
      [{ type:"healer",   count:3,  gap:2.0 }, { type:"shield", count:6, gap:0.9 }, { type:"cavalry", count:16, gap:0.32 }, { boss:"xiahouyuan" }],
    ],
  },
  {
    name: "夷陵之战",
    intro: "火烧连营七百里，决死收官之战！关底书生陆逊。",
    gold: 350, hp: 16, featured: "guanxing",
    shardRewards: { zhugeliang: 2, pangtong: 2, machao: 2, zhaoyun: 1 },
    cells: [{ c:0,r:2 },{ c:3,r:2 },{ c:3,r:7 },{ c:7,r:7 },{ c:7,r:3 },{ c:11,r:3 },{ c:11,r:8 },{ c:15,r:8 }],
    waves: [
      [{ type:"cavalry",  count:16, gap:0.38 }],
      [{ type:"shield",   count:6,  gap:0.9 }, { type:"infantry", count:16, gap:0.4 }],
      [{ type:"healer",   count:2,  gap:2.5 }, { type:"shield", count:6, gap:1.0 }, { type:"cavalry", count:14, gap:0.35 }],
      [{ type:"siege",    count:2,  gap:2.5 }, { type:"infantry", count:18, gap:0.4 }],
      [{ type:"healer",   count:3,  gap:2.0 }, { type:"shield", count:8, gap:0.8 }, { type:"cavalry", count:16, gap:0.32 }],
      [{ type:"siege",    count:3,  gap:1.8 }, { type:"healer", count:3, gap:2.5 }, { type:"shield", count:8, gap:0.8 }, { type:"infantry", count:20, gap:0.3 }, { boss:"luxun" }],
    ],
  },

  // ============================================================
  // R14: 关卡扩充（蜀汉战役线，关卡 7~16）
  // ============================================================
  {
    name: "博望坡之战",
    intro: "诸葛亮初用兵，火烧博望，挫夏侯惇前锋。",
    gold: 320, hp: 18, featured: "weiyan",
    shardRewards: { zhugeliang: 2, weiyan: 2 },
    cells: [{ c:0,r:5 },{ c:5,r:5 },{ c:5,r:1 },{ c:10,r:1 },{ c:10,r:8 },{ c:15,r:8 }],
    waves: [
      [{ type:"infantry", count:12, gap:0.55 }],
      [{ type:"cavalry",  count:12, gap:0.42 }],
      [{ type:"shield",   count:4,  gap:1.2 }, { type:"infantry", count:12, gap:0.45 }],
      [{ type:"cavalry",  count:16, gap:0.35 }, { type:"shield", count:4, gap:1.4 }],
      [{ type:"shield",   count:6,  gap:1.0 }, { type:"infantry", count:16, gap:0.4 }, { type:"cavalry", count:10, gap:0.4 }],
    ],
  },
  {
    name: "火烧新野",
    intro: "弃城纵火，疲敌于新野，且战且退护民南渡。关底铁壁曹仁。",
    gold: 330, hp: 18, featured: "guanping",
    shardRewards: { guanping: 3, guanxing: 2 },
    cells: [{ c:0,r:1 },{ c:4,r:1 },{ c:4,r:6 },{ c:8,r:6 },{ c:8,r:2 },{ c:12,r:2 },{ c:12,r:8 },{ c:15,r:8 }],
    waves: [
      [{ type:"infantry", count:14, gap:0.5 }],
      [{ type:"shield",   count:5,  gap:1.0 }, { type:"cavalry", count:10, gap:0.4 }],
      [{ type:"cavalry",  count:16, gap:0.36 }, { type:"shield", count:4, gap:1.3 }],
      [{ type:"shield",   count:7,  gap:0.9 }, { type:"infantry", count:14, gap:0.42 }],
      [{ type:"siege",    count:1,  gap:1.0 }, { type:"shield", count:6, gap:1.0 }, { type:"cavalry", count:14, gap:0.34 }, { boss:"caoren" }],
    ],
  },
  {
    name: "江陵争夺",
    intro: "兵进江陵，扼守要津，与曹仁鏖战南郡。",
    gold: 330, hp: 17, featured: "zhangbao",
    shardRewards: { zhangbao: 3, zhaoyun: 1 },
    cells: [{ c:0,r:8 },{ c:6,r:8 },{ c:6,r:3 },{ c:11,r:3 },{ c:11,r:7 },{ c:15,r:7 }],
    waves: [
      [{ type:"cavalry",  count:14, gap:0.4 }],
      [{ type:"shield",   count:6,  gap:0.95 }, { type:"infantry", count:14, gap:0.42 }],
      [{ type:"cavalry",  count:18, gap:0.33 }, { type:"shield", count:5, gap:1.2 }],
      [{ type:"siege",    count:1,  gap:1.0 }, { type:"infantry", count:16, gap:0.4 }, { type:"cavalry", count:10, gap:0.4 }],
      [{ type:"shield",   count:8,  gap:0.85 }, { type:"cavalry", count:16, gap:0.32 }],
    ],
  },
  {
    name: "葭萌关·入川",
    intro: "西进益州，强攻葭萌，敌阵随军医往来不绝。",
    gold: 340, hp: 17, featured: "madai",
    shardRewards: { weiyan: 2, fazheng: 2, madai: 2 },
    cells: [{ c:0,r:4 },{ c:3,r:4 },{ c:3,r:8 },{ c:9,r:8 },{ c:9,r:2 },{ c:13,r:2 },{ c:13,r:6 },{ c:15,r:6 }],
    waves: [
      [{ type:"infantry", count:16, gap:0.45 }],
      [{ type:"shield",   count:6,  gap:0.9 }, { type:"cavalry", count:12, gap:0.38 }],
      [{ type:"healer",   count:2,  gap:2.0 }, { type:"infantry", count:16, gap:0.42 }],
      [{ type:"shield",   count:7,  gap:0.85 }, { type:"healer", count:2, gap:3.0 }, { type:"cavalry", count:14, gap:0.34 }],
      [{ type:"siege",    count:2,  gap:2.2 }, { type:"shield", count:6, gap:1.0 }, { type:"infantry", count:16, gap:0.4 }],
      [{ type:"healer",   count:3,  gap:2.0 }, { type:"shield", count:8, gap:0.8 }, { type:"cavalry", count:16, gap:0.32 }],
    ],
  },
  {
    name: "汉中之战",
    intro: "决战定军，争汉中咽喉，敌以重甲医阵死守。",
    gold: 350, hp: 16, featured: "fazheng",
    shardRewards: { fazheng: 2, huangzhong: 2, machao: 1 },
    cells: [{ c:0,r:6 },{ c:4,r:6 },{ c:4,r:1 },{ c:8,r:1 },{ c:8,r:8 },{ c:12,r:8 },{ c:12,r:3 },{ c:15,r:3 }],
    waves: [
      [{ type:"shield",   count:6,  gap:0.9 }, { type:"infantry", count:14, gap:0.42 }],
      [{ type:"cavalry",  count:18, gap:0.34 }],
      [{ type:"healer",   count:2,  gap:2.2 }, { type:"shield", count:7, gap:0.85 }, { type:"infantry", count:14, gap:0.4 }],
      [{ type:"siege",    count:2,  gap:2.2 }, { type:"cavalry", count:16, gap:0.34 }],
      [{ type:"healer",   count:3,  gap:1.8 }, { type:"shield", count:8, gap:0.8 }, { type:"cavalry", count:14, gap:0.34 }],
      [{ type:"siege",    count:3,  gap:1.8 }, { type:"healer", count:2, gap:2.5 }, { type:"shield", count:8, gap:0.8 }, { type:"infantry", count:18, gap:0.32 }],
    ],
  },
  {
    name: "七擒孟获",
    intro: "深入南中，攻心为上，蛮兵机关医阵层出不穷。",
    gold: 350, hp: 16, featured: "huangyueying",
    shardRewards: { huangyueying: 3, liaohua: 2 },
    cells: [{ c:0,r:3 },{ c:3,r:3 },{ c:3,r:8 },{ c:7,r:8 },{ c:7,r:1 },{ c:11,r:1 },{ c:11,r:6 },{ c:15,r:6 }],
    waves: [
      [{ type:"infantry", count:16, gap:0.42 }],
      [{ type:"healer",   count:2,  gap:2.0 }, { type:"shield", count:6, gap:0.9 }, { type:"infantry", count:12, gap:0.42 }],
      [{ type:"cavalry",  count:18, gap:0.33 }, { type:"healer", count:2, gap:2.5 }],
      [{ type:"healer",   count:3,  gap:1.8 }, { type:"shield", count:8, gap:0.8 }, { type:"cavalry", count:14, gap:0.34 }],
      [{ type:"siege",    count:2,  gap:2.0 }, { type:"healer", count:3, gap:2.0 }, { type:"infantry", count:18, gap:0.36 }],
      [{ type:"healer",   count:4,  gap:1.6 }, { type:"shield", count:10, gap:0.75 }, { type:"cavalry", count:16, gap:0.32 }],
    ],
  },
  {
    name: "街亭之战",
    intro: "扼守街亭要道，铁骑奔涌如潮，存亡系于一线。关底巧变张郃。",
    gold: 350, hp: 15, featured: "wangping",
    shardRewards: { wangping: 3, madai: 2 },
    cells: [{ c:0,r:1 },{ c:6,r:1 },{ c:6,r:5 },{ c:10,r:5 },{ c:10,r:9 },{ c:15,r:9 }],
    waves: [
      [{ type:"cavalry",  count:18, gap:0.34 }],
      [{ type:"cavalry",  count:14, gap:0.36 }, { type:"shield", count:6, gap:0.9 }],
      [{ type:"cavalry",  count:22, gap:0.28 }],
      [{ type:"healer",   count:2,  gap:2.0 }, { type:"cavalry", count:18, gap:0.32 }, { type:"shield", count:6, gap:1.0 }],
      [{ type:"siege",    count:2,  gap:2.0 }, { type:"cavalry", count:18, gap:0.3 }],
      [{ type:"healer",   count:3,  gap:1.8 }, { type:"cavalry", count:24, gap:0.26 }, { type:"shield", count:8, gap:0.8 }, { boss:"zhanghe" }],
    ],
  },
  {
    name: "陈仓鏖兵",
    intro: "郝昭据城死守，攻城重械蔽野而来。",
    gold: 360, hp: 15, featured: "liaohua",
    shardRewards: { liaohua: 3, weiyan: 2 },
    cells: [{ c:0,r:7 },{ c:5,r:7 },{ c:5,r:2 },{ c:10,r:2 },{ c:10,r:7 },{ c:15,r:7 }],
    waves: [
      [{ type:"shield",   count:8,  gap:0.8 }, { type:"infantry", count:14, gap:0.42 }],
      [{ type:"siege",    count:2,  gap:2.5 }, { type:"infantry", count:16, gap:0.4 }],
      [{ type:"siege",    count:3,  gap:2.0 }, { type:"shield", count:6, gap:0.9 }, { type:"cavalry", count:12, gap:0.36 }],
      [{ type:"healer",   count:2,  gap:2.0 }, { type:"siege", count:2, gap:2.5 }, { type:"shield", count:8, gap:0.8 }],
      [{ type:"siege",    count:4,  gap:1.8 }, { type:"infantry", count:18, gap:0.36 }],
      [{ type:"siege",    count:5,  gap:1.5 }, { type:"healer", count:3, gap:2.0 }, { type:"shield", count:10, gap:0.75 }],
    ],
  },
  {
    name: "五丈原",
    intro: "鞠躬尽瘁，秋风五丈原，倾力一搏未竟之业。关底冢虎司马懿。",
    gold: 360, hp: 14, featured: "jiangwei",
    shardRewards: { jiangwei: 2, huangyueying: 2, zhugeliang: 1 },
    cells: [{ c:0,r:4 },{ c:4,r:4 },{ c:4,r:8 },{ c:8,r:8 },{ c:8,r:1 },{ c:12,r:1 },{ c:12,r:5 },{ c:15,r:5 }],
    waves: [
      [{ type:"shield",   count:8,  gap:0.8 }, { type:"cavalry", count:14, gap:0.36 }],
      [{ type:"healer",   count:2,  gap:2.0 }, { type:"infantry", count:18, gap:0.38 }],
      [{ type:"siege",    count:2,  gap:2.2 }, { type:"shield", count:8, gap:0.8 }, { type:"cavalry", count:14, gap:0.34 }],
      [{ type:"healer",   count:3,  gap:1.8 }, { type:"cavalry", count:18, gap:0.32 }, { type:"shield", count:6, gap:1.0 }],
      [{ type:"siege",    count:3,  gap:1.8 }, { type:"healer", count:2, gap:2.5 }, { type:"infantry", count:18, gap:0.36 }],
      [{ type:"shield",   count:10, gap:0.75 }, { type:"healer", count:3, gap:2.0 }, { type:"cavalry", count:16, gap:0.32 }],
      [{ type:"siege",    count:4,  gap:1.6 }, { type:"healer", count:3, gap:2.0 }, { type:"shield", count:10, gap:0.7 }, { type:"cavalry", count:14, gap:0.34 }, { boss:"simayi" }],
    ],
  },
  {
    name: "剑阁天险",
    intro: "姜维守剑阁，以一当万，蜀汉存续在此一战！终局邓艾偷渡阴平。",
    gold: 380, hp: 14, featured: "machao",
    shardRewards: { jiangwei: 3, guanxing: 2, zhangbao: 2 },
    cells: [{ c:0,r:5 },{ c:3,r:5 },{ c:3,r:1 },{ c:7,r:1 },{ c:7,r:8 },{ c:11,r:8 },{ c:11,r:3 },{ c:15,r:3 }],
    waves: [
      [{ type:"shield",   count:10, gap:0.75 }, { type:"cavalry", count:14, gap:0.34 }],
      [{ type:"healer",   count:3,  gap:1.8 }, { type:"infantry", count:18, gap:0.36 }],
      [{ type:"siege",    count:3,  gap:1.8 }, { type:"shield", count:8, gap:0.8 }, { type:"cavalry", count:14, gap:0.34 }],
      [{ type:"healer",   count:3,  gap:1.6 }, { type:"cavalry", count:22, gap:0.28 }, { type:"shield", count:8, gap:0.85 }],
      [{ type:"siege",    count:4,  gap:1.6 }, { type:"healer", count:3, gap:2.0 }, { type:"infantry", count:20, gap:0.34 }],
      [{ type:"shield",   count:12, gap:0.7 }, { type:"healer", count:4, gap:1.8 }, { type:"cavalry", count:18, gap:0.3 }],
      [{ type:"siege",    count:5,  gap:1.4 }, { type:"healer", count:4, gap:1.8 }, { type:"shield", count:12, gap:0.65 }, { type:"cavalry", count:18, gap:0.3 }, { boss:"dengai" }],
    ],
  },
];

// 章节划分（R18）：按战役线分章，每章末关为 Boss 关。from/to 为 LEVELS 下标（含端点）。
const CHAPTERS = [
  { name: "第一章 · 群雄逐鹿", from: 0,  to: 2 },   // 虎牢关→官渡→赤壁(曹操)
  { name: "第二章 · 三分天下", from: 3,  to: 5 },   // 长坂坡→定军山→夷陵(陆逊)
  { name: "第三章 · 南征北战", from: 6,  to: 7 },   // 博望坡→火烧新野(曹仁)
  { name: "第四章 · 克定中原", from: 8,  to: 12 },  // 江陵→葭萌关→汉中→七擒孟获→街亭(张郃)
  { name: "第五章 · 鞠躬尽瘁", from: 13, to: 15 },  // 陈仓→五丈原→剑阁(邓艾)
];

// 通关三选一增益（R22）：连续征战累加。effect 合并进 runBuffs 累加器。
const BOONS = [
  { id: "dmg",    name: "锋锐",     desc: "全军伤害 +12%",       effect: { dmgMul: 0.12 } },
  { id: "rate",   name: "疾战",     desc: "全军攻速 +12%",       effect: { rateMul: 0.12 } },
  { id: "range",  name: "远略",     desc: "全军射程 +12%",       effect: { rangeMul: 0.12 } },
  { id: "gold",   name: "屯粮",     desc: "进关起始军粮 +70",     effect: { goldStart: 70 } },
  { id: "greed",  name: "取敌之资", desc: "击杀军粮 +20%",       effect: { killGoldMul: 0.20 } },
  { id: "wall",   name: "固城",     desc: "城池上限 +6",         effect: { hpBonus: 6 } },
  { id: "thrift", name: "简募",     desc: "招贤刷新费起步 -6",    effect: { refreshCut: 6 } },
  { id: "crit",   name: "锐卒",     desc: "全军额外暴击 +8%（×1.8）", effect: { critChance: 0.08 } },
];

window.GameData = { RARITY, ARCHETYPES, HEROES, STARTERS, BONDS, SKILLS, ENEMY_TYPES, BOSSES, TUNING, LEVELS, CHAPTERS, BOONS };

})();
