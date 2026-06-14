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
const design = read("DESIGN.md");

assert(game.includes("function drawRouteGuide()"), "UIUE route guide renderer missing");
assert(game.includes("drawRouteGuide();") && game.includes("drawPath();"), "battlefield should keep route guide separate from old path");
assert(game.indexOf("drawRouteGuide();") < game.indexOf("drawPath();"), "route guide should be defined before old path fallback is reused");
assert(
  (game.includes("rgba(70,47,27,0.10)") && game.includes("rgba(244,204,130,0.08)")) ||
  (game.includes("function drawGroundedRouteDust()") && game.includes("ctx.setLineDash([18, 28])")),
  "route guide should use subtle integrated strokes"
);
assert(game.includes("function drawRouteMarkers()"), "route guide should include footprint markers");
assert(game.includes("const sheetFoot") && game.includes("const drawY"), "enemy drawing should use a foot-anchored y position");
assert(
  (game.includes("sheetFoot + 1") && game.includes("scale: 1 + Math.abs(stride)")) ||
  (game.includes("sheetFoot + 2") && game.includes("scale: 1 + contact")),
  "enemy shadow and step scale should be tied to foot contact"
);

assert(sprites.includes("a.rows === 1 && a.cols >= 4"), "enemy sprite sheets should use walk frame selection");
assert(
  sprites.includes("return (Math.floor(walk * 8) % 2)") ||
  sprites.includes("const frames = 2"),
  "enemy walking should alternate between movement frames"
);

assert(design.includes("R39 战场路线融合与敌兵落地修正"), "R39 design entry missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["route-guide", "no-heavy-uiue-path", "enemy-foot-anchor", "walk-frames"],
}, null, 2));
