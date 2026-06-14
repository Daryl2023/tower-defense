#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function pngSize(rel) {
  const buf = fs.readFileSync(path.join(root, rel));
  assert(buf.readUInt32BE(0) === 0x89504e47, `${rel} is not a PNG`);
  const colorType = buf[25];
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), colorType };
}

const portrait = pngSize("assets/uiue/heroes/zhaoyun/portrait.png");
const sheet = pngSize("assets/uiue/heroes/zhaoyun/sheet.png");
const icons = pngSize("assets/heroes/zhaoyun/icons.png");
const passiveIcon = pngSize("assets/uiue/heroes/zhaoyun/passive-icon.png");

assert(portrait.w === 896 && portrait.h === 1200, "zhaoyun portrait should use UIUE 赵云立绘.png");
assert(sheet.w === 1376 && sheet.h === 768, "zhaoyun sheet should use UIUE 赵云精灵表.png");
assert(icons.w === 1264 && icons.h === 848, "zhaoyun icons should use 赵云技能1.png");
assert(passiveIcon.w === 1024 && passiveIcon.h === 1024, "zhaoyun passive icon should use UIUE 赵云技能.png");
assert(portrait.colorType === 6 && sheet.colorType === 6 && icons.colorType === 6 && passiveIcon.colorType === 6, "zhaoyun runtime assets should be RGBA PNGs");

const sprites = read("sprites.js");
assert(sprites.includes('"hero:zhaoyun"'), "zhaoyun image override missing");
assert(sprites.includes("assets/uiue/heroes/zhaoyun/sheet.png"), "zhaoyun UIUE sheet config missing");
assert(sprites.includes("cols: 4, rows: 2, frameW: 344, frameH: 384"), "zhaoyun UIUE sheet grid config missing");
assert(sprites.includes("stripBg: false"), "zhaoyun transparent sheet should bypass runtime bg stripping");
assert(sprites.includes("passiveIcon: \"assets/uiue/heroes/zhaoyun/passive-icon.png\""), "zhaoyun UIUE passive icon config missing");
assert(sprites.includes("getHeroPassiveIcon"), "getHeroPassiveIcon missing");
assert(sprites.includes("_iconsSrc"), "processed icon data URL missing");
assert(sprites.includes("a._portraitSrc = a.portrait"), "portrait fallback to original path missing");
assert(sprites.includes("a._iconsSrc = a.icons"), "icons fallback to original path missing");

const game = read("game.js");
assert(game.includes("heroSkillArtHtml"), "hero skill art renderer missing");
assert(game.includes("Art.getHeroPassiveIcon"), "hero detail should use a single passive icon");
assert(!game.includes("Art.getHeroIcons && Art.getHeroIcons(id)"), "hero detail should not render the full icon sheet");
assert(game.includes("codexHeroIds"), "codex sorting/filtering helper missing");
assert(game.includes("codexSort") && game.includes("codexFilter"), "codex sort/filter bindings missing");
assert(game.includes("dt-passive-icon") && game.includes("dt-passive-text"), "passive icon and description should be in one passive section");
assert(game.includes('Art.drawSprite(ctx, "hero:" + tw.hero'), "battle tower drawing should use hero sprite assets by hero id");

const css = read("style.css");
assert(css.includes(".codex-tools"), "codex tools styles missing");
assert(css.includes(".dt-passive-icon"), "single passive icon styles missing");
assert(!css.includes(".dt-skill-art.single"), "old separated skill art style should be removed");

const html = read("index.html");
assert(html.includes("codexSort") && html.includes("codexFilter"), "codex sort/filter controls missing");
assert(/v=202606(?:13|14)-r(27-aspect|28-battle-ui|29-prebattle-ui|30-polish|31-state-card|32-global-polish|33-hud-layout|34-state-colors|35-ui-quality|38-uiue-assets|39-battlefield-integration|40-path-anchors|41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)/.test(html), "cache-busting asset version missing");

console.log(JSON.stringify({
  ok: true,
  zhaoyun: { portrait, sheet, icons, passiveIcon },
}, null, 2));
