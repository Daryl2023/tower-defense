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

const portrait = pngSize("assets/heroes/zhaoyun/portrait.png");
const sheet = pngSize("assets/heroes/zhaoyun/sheet.png");
const icons = pngSize("assets/heroes/zhaoyun/icons.png");
const passiveIcon = pngSize("assets/heroes/zhaoyun/passive-icon.png");

assert(portrait.w === 848 && portrait.h === 1264, "zhaoyun portrait should use 赵云立绘1.png");
assert(sheet.w === 1456 && sheet.h === 720, "zhaoyun sheet should use 赵云精灵表1.png");
assert(icons.w === 1264 && icons.h === 848, "zhaoyun icons should use 赵云技能1.png");
assert(passiveIcon.w === 256 && passiveIcon.h === 256, "zhaoyun passive icon should be a single 256x256 icon");
assert(portrait.colorType === 6 && sheet.colorType === 6 && icons.colorType === 6 && passiveIcon.colorType === 6, "zhaoyun runtime assets should be RGBA PNGs");

const sprites = read("sprites.js");
assert(sprites.includes('"hero:zhaoyun"'), "zhaoyun image override missing");
assert(sprites.includes("cols: 4, rows: 2, frameW: 364, frameH: 360"), "zhaoyun sheet grid config missing");
assert(sprites.includes("stripBg: false"), "zhaoyun transparent sheet should bypass runtime bg stripping");
assert(sprites.includes("passiveIcon: \"assets/heroes/zhaoyun/passive-icon.png\""), "zhaoyun passive icon config missing");
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
assert(html.includes("v=20260613-r27-aspect"), "cache-busting asset version missing");

console.log(JSON.stringify({
  ok: true,
  zhaoyun: { portrait, sheet, icons, passiveIcon },
}, null, 2));
