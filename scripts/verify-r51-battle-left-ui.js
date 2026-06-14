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
const css = read("style.css");
const html = read("index.html");

assert(game.includes("{ x: 224, y: 153 }"), "build pad should anchor to hulao wooden tower");
assert(!game.includes("{ x: 134, y: 150 }"), "legacy extra build pads should be removed");
assert(game.includes('if (!(Art.getUiImage && Art.getUiImage("battlefield:hulao"))) drawRouteMarkers();'), "UIUE battlefield should skip route footprint markers");
assert(game.includes('ctx.translate(p.x, p.y + 6);'), "build pad marker anchor should sit on platform base");
assert(!game.includes('rgba(26,18,12,0.42)'), "idle build pads should not draw dark ground ellipses");
assert(game.includes("// 土堆基座（常驻可见）"), "build pads should use visible mound markers");

assert(css.includes("background: #120e0a"), "canvas frame should use dark brown, not green placeholder");
assert(css.includes("justify-self: stretch"), "canvas should fill the battle column width");
assert(!css.includes("background: #3a4a2c"), "green canvas placeholder should be removed");

assert(/v=20260614-r(?:51-battle-left-polish|52-hulao-8pads|53-hulao-7pads-path|54-pad-mounds-path|55-gate-approach-path)/.test(html), "R51 cache-busting version missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["off-path-build-pads", "no-route-marker-clutter", "subtle-idle-pads", "canvas-frame-polish"],
}, null, 2));
