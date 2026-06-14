#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const game = read("game.js");
const sprites = read("sprites.js");
const html = read("index.html");
const design = read("DESIGN.md");

const hulaoBlock = game.match(/if \(hulaoBg\) \{[\s\S]*?return;\n  \}/);
assert(hulaoBlock, "UIUE Hulao battlefield branch missing");
assert(hulaoBlock[0].includes("ctx.drawImage(hulaoBg"), "Hulao branch should draw UIUE battlefield image");
assert(hulaoBlock[0].includes("drawRouteGuide();"), "Hulao branch should keep only lightweight route guide");
assert(!hulaoBlock[0].includes("drawPath();"), "Hulao branch must not draw the old thick path");

assert(game.includes("function drawGroundedRouteDust()"), "grounded dust route guide missing");
assert(game.includes("ctx.setLineDash([18, 28])"), "route guide should use broken dust lines, not a solid band");
assert(game.includes("function drawRouteEdgeScuffs()"), "route edge scuffs missing");
assert(game.includes("ctx.ellipse(0, 0, 4.2, 2.0"), "route footprints should be small and subtle");
assert(game.includes("function drawHulaoFallbackField()"), "Hulao fallback should avoid old chessboard path while image loads");

assert(game.includes("const contact = (1 + Math.cos(phase * Math.PI * 4)) * 0.5"), "enemy walking should compute foot contact");
assert(game.includes("drawFootDust("), "enemy footsteps should emit grounding dust");
assert(game.includes("flipX"), "enemy sprites should flip with movement direction");
assert(game.includes("Art.drawSprite(ctx, en.spriteKey || (\"enemy:\" + en.type), 0, 0"), "enemy sprites should draw upright without body lean");
assert(game.includes("en.walk += step * (en.boss ? 0.035 : 0.07)"), "enemy walk phase should advance visibly with movement distance");

assert(sprites.includes("const frames = 2"), "one-row enemy sprite sheets should use first two frames for walk cycle");
assert(/v=20260614-r(?:44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-8pads|53-hulao-7pads-path|54-pad-mounds-path|55-gate-approach-path)/.test(html), "R44 cache-busting version missing");
assert(design.includes("R44 战场路线与士兵行走融合修正"), "R44 design entry missing");
assert(design.includes("| R44-1 | 战场路线与士兵行走融合修正"), "R44 progress row missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["no-thick-uiue-route", "grounded-route-dust", "enemy-contact-shadow", "walk-frame-cycle", "cache-version"],
}, null, 2));
