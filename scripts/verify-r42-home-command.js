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

["home-command", "home-primary", "home-badge", "homeOverview", "home-actions", "homeStart", "homeHeroes"].forEach((token) => {
  assert(html.includes(token), `home command DOM missing: ${token}`);
});
assert(/v=20260614-r(?:42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-8pads|53-hulao-7pads-path|54-pad-mounds-path|55-gate-approach-path)/.test(html), "R42 cache-busting version missing");

assert(game.includes("const progressPct = Math.round"), "home progress percentage missing");
assert(game.includes("class=\"home-report\""), "home report render markup missing");
assert(game.includes("class=\"home-metrics\""), "home metrics render markup missing");
assert(game.includes("<progress class=\"hr-progress\""), "home progress bar render missing");
assert(game.includes("id=\"homeContinue\"") && game.includes("enterLevel(cur)"), "home continue action should remain wired");

[".home-command", ".home-primary", ".home-report", ".home-badge", ".hr-progress", ".home-metrics", ".hr-intel"].forEach((sel) => {
  assert(css.includes(sel), `home command style missing: ${sel}`);
});
assert(css.includes("grid-template-columns: minmax(280px, 1fr) minmax(320px, 460px)"), "desktop home command layout missing");
assert(css.includes(".hr-progress::-webkit-progress-value"), "home progress fill style missing");
assert(css.includes(".home-command { grid-template-columns: 1fr; gap: 12px;"), "mobile home command fallback missing");

assert(design.includes("R42 主界面战役司令台升级"), "R42 design entry missing");
assert(design.includes("| R42-1 | 主界面战役司令台升级"), "R42 progress row missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["home-command-dom", "home-report-render", "home-command-style", "cache-version", "design-entry"],
}, null, 2));
