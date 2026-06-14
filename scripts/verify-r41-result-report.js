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

["ovBadge", "ovSummary", "ovRewards", "ovNext", "resultCard"].forEach((id) => {
  assert(html.includes(`id="${id}"`), `result report node missing: ${id}`);
});
assert(/v=20260614-r(?:41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)/.test(html), "R41 cache-busting version missing");

assert(game.includes("function renderResultSummary(items)"), "result summary renderer missing");
assert(game.includes("function renderResultRewards(items)"), "result reward renderer missing");
assert(game.includes("card.dataset.tone = tone"), "result card tone state missing");
assert(game.includes("rewards = Object.keys(drops).map"), "win rewards should be structured as chips");
assert(game.includes("badge: \"捷报\"") && game.includes("badge: \"败报\""), "win/lose report badges missing");
assert(game.includes("next: \"下一战：\" + LEVELS[game.levelIndex + 1].name"), "next level report copy missing");
assert(!game.includes("shardLine"), "old inline shard reward text should be removed");

[".result-badge", ".result-summary", ".result-stat", ".result-rewards", ".reward-chip", ".result-next"].forEach((sel) => {
  assert(css.includes(sel), `result report style missing: ${sel}`);
});
assert(css.includes('.overlay-card[data-tone="win"]') && css.includes('.overlay-card[data-tone="lose"]'), "result tone styles missing");
assert(css.includes(".reward-chip { width: 100%; justify-content: space-between; }"), "mobile reward chip layout missing");

assert(design.includes("R41 战报结算 UI 升级"), "R41 design entry missing");
assert(design.includes("| R41-1 | 战报结算 UI 升级"), "R41 progress row missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["result-structure", "result-payloads", "reward-chips", "tone-styles", "cache-version"],
}, null, 2));
