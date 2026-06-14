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

const html = read("index.html");
const game = read("game.js");
const css = read("style.css");
const design = read("DESIGN.md");

assert(/v=20260614-r(?:43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)/.test(html), "R43 cache-busting version missing");

assert(game.includes("campaign-card"), "level buttons should render campaign cards");
assert(game.includes("camp-top") && game.includes("camp-no"), "campaign card header missing");
assert(game.includes("camp-tags") && game.includes("camp-intel") && game.includes("camp-drop"), "campaign card detail sections missing");
assert(game.includes("threats[0]") && game.includes("recommends[0]"), "campaign cards should expose threat and recommendation summaries");
assert(game.includes("掉落提升：") && game.includes("HEROES[lv.featured].name"), "campaign cards should show featured shard target");
assert(game.includes("campaign-chapter"), "chapter headers should use campaign styling");
assert(game.includes("if (!locked) btn.addEventListener(\"click\", () => enterLevel(i));"), "unlocked level click behavior should remain");

assert(css.includes(".menu-list {") && css.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "level list should use a campaign-card grid");
[".campaign-card", ".camp-top", ".camp-tags", ".camp-intel", ".camp-drop", ".campaign-chapter"].forEach((sel) => {
  assert(css.includes(sel), `campaign map style missing: ${sel}`);
});
assert(css.includes(".menu-list { grid-template-columns: 1fr; max-height: 64vh; }"), "mobile campaign list fallback missing");
assert(css.includes(".level-btn.locked { opacity: 0.54; cursor: default; }"), "locked level affordance should remain");

assert(design.includes("R43 关卡选择战役沙盘升级"), "R43 design entry missing");
assert(design.includes("| R43-1 | 关卡选择战役沙盘升级"), "R43 progress row missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["campaign-card-render", "campaign-card-style", "state-preservation", "mobile-fallback", "cache-version"],
}, null, 2));
