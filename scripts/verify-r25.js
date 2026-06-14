"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const gameJs = read("game.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("R25 verify failed:", msg);
    process.exitCode = 1;
  }
}

function hasId(id) {
  return new RegExp(`id=["']${id}["']`).test(html);
}

global.window = global;
require(path.join(root, "data.js"));
require(path.join(root, "sprites.js"));

const { HEROES, LEVELS, ENEMY_TYPES, SKILLS } = global.GameData;
const enemyKeys = new Set([...Object.keys(ENEMY_TYPES), "boss"]);
const skillKeys = new Set(Object.keys(SKILLS));

// R25-1: 武将府合并，旧双入口不应再出现在静态页面。
["homeHeroes", "heroesBtn", "sceneCodex", "codexHeroes", "codexDetailView", "detailBody"].forEach((id) => {
  assert(hasId(id), `missing #${id}`);
});
["homeTrain", "homeCodex", "trainBtn", "codexBtn", "sceneBarracks", "trainList", "trainClose"].forEach((id) => {
  assert(!hasId(id), `legacy split entry still present: #${id}`);
});

// R25-2: 选将详情布局。
["deckGrid", "deckDetail", "deckIntel"].forEach((id) => assert(hasId(id), `missing deck element #${id}`));
assert(gameJs.includes("data-toggle="), "deck selection toggle button is missing");
assert(gameJs.includes("showDeckHeroDetail"), "deck card detail handler is missing");

// R25-3: 关卡敌情与轻规则。
assert(LEVELS.length === 16, `expected 16 levels, got ${LEVELS.length}`);
let intelCount = 0;
let rulesCount = 0;
for (const [idx, lv] of LEVELS.entries()) {
  const n = idx + 1;
  assert(Array.isArray(lv.tags) && lv.tags.length > 0, `level ${n} missing tags`);
  assert(Array.isArray(lv.threats) && lv.threats.length >= 2, `level ${n} missing threats`);
  assert(Array.isArray(lv.recommends) && lv.recommends.length >= 2, `level ${n} missing recommends`);
  intelCount++;
  const rules = lv.rules || null;
  if (!rules) continue;
  rulesCount++;
  for (const key of ["enemySpeedMul", "enemyHpMul", "enemyArmorBonus", "enemyRewardMul", "castleDamageMul"]) {
    for (const enemy of Object.keys(rules[key] || {})) {
      assert(enemyKeys.has(enemy), `level ${n} rule ${key} uses unknown enemy ${enemy}`);
    }
  }
  for (const skill of Object.keys(rules.skillCdMul || {})) {
    assert(skillKeys.has(skill), `level ${n} rule skillCdMul uses unknown skill ${skill}`);
  }
  if (rules.healerPowerMul != null) assert(typeof rules.healerPowerMul === "number", `level ${n} healerPowerMul must be number`);
  if (rules.rewardMul != null) assert(typeof rules.rewardMul === "number", `level ${n} rewardMul must be number`);
}
assert(intelCount === LEVELS.length, "not all levels have intel");
assert(rulesCount >= 12, `expected at least 12 levels with rules, got ${rulesCount}`);
[
  "function levelRules",
  "function ruleFor",
  "function skillCooldown",
  "ruleFor(\"enemyHpMul\"",
  "ruleFor(\"enemySpeedMul\"",
  "ruleFor(\"enemyRewardMul\"",
  "ruleFor(\"enemyArmorBonus\"",
  "ruleFor(\"castleDamageMul\"",
  "ruleScalar(\"healerPowerMul\"",
  "ruleFor(\"skillCdMul\"",
  "rulesText",
  "战场规则",
].forEach((needle) => assert(gameJs.includes(needle), `rules integration missing: ${needle}`));

const ruleSamples = [
  { idx: 1, path: ["rewardMul"], value: 0.9 },
  { idx: 2, path: ["skillCdMul", "fire"], value: 0.8 },
  { idx: 3, path: ["enemySpeedMul", "cavalry"], value: 1.12 },
  { idx: 4, path: ["enemyArmorBonus", "shield"], value: 2 },
  { idx: 9, path: ["healerPowerMul"], value: 1.25 },
  { idx: 13, path: ["enemyHpMul", "siege"], value: 1.12 },
  { idx: 15, path: ["enemyHpMul", "boss"], value: 1.15 },
];
for (const sample of ruleSamples) {
  let cur = LEVELS[sample.idx].rules;
  for (const part of sample.path) cur = cur && cur[part];
  assert(cur === sample.value, `rule sample mismatch at level ${sample.idx + 1}: ${sample.path.join(".")}`);
}

// R25-4: UI portrait coverage and fallback.
const overrides = global.Art.IMAGE_OVERRIDES;
for (const [assetId, cfg] of Object.entries(overrides)) {
  for (const key of ["img", "portrait", "icons"]) {
    if (!cfg[key]) continue;
    assert(fs.existsSync(path.join(root, cfg[key])), `${assetId}.${key} file missing: ${cfg[key]}`);
  }
}
assert(Object.keys(HEROES).length === 22, `expected 22 heroes, got ${Object.keys(HEROES).length}`);
assert(Object.keys(overrides).length >= 5, "expected at least 5 image override heroes");
assert(gameJs.includes("hero-fallback"), "fallback portrait markup missing");
assert(gameJs.includes("onSpritesReady"), "sprite ready refresh hook missing");

if (!process.exitCode) {
  console.log(JSON.stringify({
    ok: true,
    heroes: Object.keys(HEROES).length,
    levels: LEVELS.length,
    levelsWithRules: rulesCount,
    imageOverrides: Object.keys(overrides).length,
  }, null, 2));
}
