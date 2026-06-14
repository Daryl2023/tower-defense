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

const padBlock = game.match(/const HULAO_BUILD_PADS = \[([\s\S]*?)\];/);
assert(padBlock, "HULAO_BUILD_PADS missing");
const pads = [...padBlock[1].matchAll(/\{ x: (\d+), y: (\d+) \}/g)].map((m) => ({ x: +m[1], y: +m[2] }));
assert(pads.length === 7, "Hulao should expose exactly 7 build pads");
assert(pads[0].x === 224 && pads[1].x === 230 && pads[4].x === 653, "pads should match user screenshot order");

assert(game.includes("function buildLinearPath("), "linear path builder missing");
assert(game.includes("buildLinearPath(HULAO_VISUAL_PATH, 4)"), "hulao should use dense linear path sampling");
assert(game.includes("{ x: 935, y: 190 }"), "hulao path should use fine-grained anchors");

assert(game.includes("{ x: 672, y: 258 }"), "path should continue right past pad 5 before turning");
assert(game.includes("{ x: 748, y: 298 }"), "path should sweep down-right only after two-soldier gap");
assert(!game.includes("{ x: 718, y: 276 }"), "old pad5 lane anchors should be removed");
assert(!game.includes("{ x: 758, y: 292 }"), "old pad5 lane anchors should be removed");
assert(!game.includes("{ x: 622, y: 276 }"), "early northbound loop after pad 5 should be removed");
assert(game.includes("// 土堆基座（常驻可见）"), "build pads should draw visible earth mounds");
assert(game.includes('fillText(String(i + 1)'), "build pads should label slot numbers");

assert(/v=20260614-r(?:53-hulao-7pads-path|54-pad-mounds-path|55-gate-approach-path|56-pad5-delayed-turn|57-user24-path|58-pad5-lane-fix|59-pad5-up-left)/.test(html), "R53 cache-busting version missing");

console.log(JSON.stringify({
  ok: true,
  padCount: pads.length,
  pads,
  checks: ["seven-pads", "linear-path", "fine-anchors", "cache-version"],
}, null, 2));
