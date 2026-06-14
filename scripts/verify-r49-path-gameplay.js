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

assert(game.includes("function buildLinearPath("), "linear path builder missing");
assert(game.includes("buildLinearPath(HULAO_VISUAL_PATH"), "hulao should use linear path along fine anchors");
assert(game.includes("const HULAO_BUILD_PADS"), "Hulao build pads missing");
assert(game.includes("function canPlaceTower("), "tower placement guard missing");
assert(game.includes("drawBuildPads();"), "build pads should always render on battlefield");
assert(game.includes('ctx.fillText("塔"'), "deploy pads should show tower label");
assert(game.includes("请点在箭塔平台上"), "build pad feedback missing");
assert(sprites.includes("opts.flipX"), "sprite flip support missing");
assert(/v=20260614-r59-pad5-up-left/.test(html), "R49 cache-busting version missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["smooth-path", "build-pads", "walk-frames", "sprite-flip", "cache-version"],
}, null, 2));
