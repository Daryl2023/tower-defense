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
assert(pads[0].x === 224 && pads[0].y === 153, "pad 1 should anchor to entry upper tower");
assert(pads[4].x === 653 && pads[4].y === 298, "pad 5 should anchor to inner curve tower");

assert(/v=20260614-r(?:52-hulao-8pads|53-hulao-7pads-path|54-pad-mounds-path|55-gate-approach-path)/.test(html), "R52 cache-busting version missing");

console.log(JSON.stringify({
  ok: true,
  padCount: pads.length,
  pads,
  checks: ["seven-pads-only", "roadside-towers", "cache-version"],
}, null, 2));
