#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const game = read("game.js");
assert(game.includes("drawBattlefield();"), "draw() should use drawBattlefield");
assert(game.includes("function drawBattlefield()"), "drawBattlefield missing");
assert(game.includes("function isNearPath"), "path-aware terrain decoration missing");
assert(game.includes("const towers = game.towers.slice().sort((a, b) => a.y - b.y)"), "tower depth sorting missing");
assert(game.includes('tw.hero === "zhaoyun" ? 76 : 48'), "zhaoyun battle size boost missing");
assert(game.includes("function drawTowerLabel"), "tower label avoidance missing");
assert(game.includes("roundRect(ctx"), "tower label background missing");
assert(!game.includes("drawGrid();"), "old grid draw call should be removed");

const sprites = read("sprites.js");
assert(sprites.includes('"hero:zhaoyun"'), "zhaoyun override missing");
assert(sprites.includes("frameInset: 0.04"), "zhaoyun sheet should use lower inset for sharper battlefield sprite");
assert(sprites.includes("stripBg: false"), "zhaoyun transparent sheet should bypass runtime stripping");

const css = read("style.css");
assert(css.includes("aspect-ratio: 960 / 600"), "battle canvas display aspect ratio should be locked");
assert(css.includes("flex: 0 0 180px"), "shop sidebar should not stretch the canvas");
assert(css.includes("#game {"), "game canvas style missing");

const html = read("index.html");
assert(html.includes("v=20260613-r27-aspect"), "battlefield cache-busting version missing");

console.log(JSON.stringify({ ok: true, checks: ["battlefield", "zhaoyun-size", "label-avoidance", "canvas-aspect"] }, null, 2));
