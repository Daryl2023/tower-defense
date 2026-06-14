#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function png(rel) {
  const buf = fs.readFileSync(path.join(root, rel));
  assert(buf.readUInt32BE(0) === 0x89504e47, `${rel} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

[
  "UI 装饰图集.png",
  "军医精灵表.png",
  "工程车精灵表.png",
  "步兵.png",
  "火计主动技能图标.png",
  "盾兵精灵表.png",
  "空城计主动技能图标.png",
  "虎牢关战场整图背景.png",
  "资源图标图集.png",
  "赵云技能.png",
  "赵云立绘.png",
  "赵云精灵表.png",
  "风格参考图.png",
  "骑兵精灵表.png",
].forEach((file) => assert(exists(path.join("素材/UIUE", file)), `source UIUE asset missing: ${file}`));

[
  "assets/uiue/heroes/zhaoyun/portrait.png",
  "assets/uiue/heroes/zhaoyun/sheet.png",
  "assets/uiue/heroes/zhaoyun/passive-icon.png",
  "assets/uiue/enemies/infantry/sheet.png",
  "assets/uiue/enemies/cavalry/sheet.png",
  "assets/uiue/enemies/shield/sheet.png",
  "assets/uiue/enemies/healer/sheet.png",
  "assets/uiue/enemies/siege/sheet.png",
  "assets/uiue/ui/panel_atlas.png",
  "assets/uiue/ui/resource_icons.png",
  "assets/uiue/effects/fire_icon_256.png",
  "assets/uiue/effects/fort_icon_256.png",
].forEach((file) => {
  assert(exists(file), `runtime UIUE asset missing: ${file}`);
  assert(png(file).colorType === 6, `runtime UIUE asset should be RGBA PNG: ${file}`);
});

const bg = png("assets/uiue/battlefields/hulao_gate.png");
assert(bg.width === 960 && bg.height === 600, "hulao battlefield should be 960x600");

const sprites = read("sprites.js");
assert(sprites.includes("assets/uiue/heroes/zhaoyun/sheet.png"), "zhaoyun UIUE sheet override missing");
assert(sprites.includes("assets/uiue/enemies/infantry/sheet.png"), "enemy UIUE overrides missing");
assert(sprites.includes("\"battlefield:hulao\""), "hulao battlefield preload missing");
assert(sprites.includes("getUiImage"), "UIUE image accessor missing");

const game = read("game.js");
assert(game.includes('Art.getUiImage("battlefield:hulao")'), "battlefield should draw UIUE background");

const html = read("index.html");
const css = read("style.css");
assert(/v=20260614-r(?:39-battlefield-integration|40-path-anchors|41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)/.test(html), "R38/R40 cache-busting version missing");
assert(html.includes("hud-icon") && html.includes("sk-icon"), "HUD image icon markup missing");
assert(css.includes("assets/uiue/ui/resource_icons.png"), "resource icon atlas style missing");
assert(css.includes("assets/uiue/effects/fire_icon_256.png"), "fire skill icon style missing");
assert(css.includes("assets/uiue/effects/fort_icon_256.png"), "fort skill icon style missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["source-assets", "runtime-alpha", "battlefield-bg", "sprite-overrides", "hud-icons"],
}, null, 2));
