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
const html = read("index.html");
const design = read("DESIGN.md");

assert(game.includes("const HULAO_VISUAL_PATH"), "Hulao visual path anchors missing");
assert(/HULAO_VISUAL_PATH\s*=\s*\[[\s\S]*x:\s*-20[\s\S]*x:\s*955/.test(game), "Hulao visual path should span the visible dirt road");
assert(game.includes("function drawBuildPads()"), "build pad renderer should exist");
assert(game.includes('ctx.fillText("塔"'), "deploy state should label build pads");
assert(game.includes("path = buildSmoothPath(HULAO_VISUAL_PATH"), "level 1 should use smoothed visual path for movement");
assert(game.includes("function buildSmoothPath("), "smooth path builder missing");
assert(game.includes("const HULAO_BUILD_PADS"), "Hulao build pads missing");
assert(game.includes("function nearestBuildPad("), "build pad snapping missing");
assert(game.includes("mergeVisualPathBlocks(pathBlocked, path"), "visual path should also block road deployment cells");
assert(game.includes("function drawRouteMarkers()"), "route footprint markers missing");
assert(game.includes("ctx.ellipse(0, 0, 4.8, 2.3") || game.includes("ctx.ellipse(0, 0, 4.2, 2.0"), "route guide should use footprint-style markers");
assert(game.includes("const sheetFoot") && game.includes("const shadowPulse"), "enemy walking should use foot motion and shadow pulse");
const hulaoBlock = game.match(/if \(hulaoBg\) \{[\s\S]*?return;\n  \}/);
assert(hulaoBlock && !hulaoBlock[0].includes("drawCastle();"), "UIUE battlefield should not draw the old procedural castle on top");
assert(/v=20260614-r(?:40-path-anchors|41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-8pads|53-hulao-7pads-path|54-pad-mounds-path|55-gate-approach-path)/.test(html), "R40 cache-busting version missing");
assert(design.includes("R40 虎牢关路线锚点与行走融合"), "R40 design entry missing");
assert(design.includes("| R40-1 | 虎牢关路线锚点与行走融合"), "R40 implementation progress row missing");
assert(design.includes("| R40-1 | 虎牢关路线锚点与行走融合 | node --check") && design.includes("| ✅ 完成 | 通过 |"), "R40 completed test progress row missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["visual-path", "route-footprints", "enemy-foot-motion", "cache-version", "design-entry"],
}, null, 2));
