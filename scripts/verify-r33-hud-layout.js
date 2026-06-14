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
const css = read("style.css");
const game = read("game.js");

["hud-left", "hud-resources", "hud-actions", "hud-controls"].forEach((cls) => {
  assert(html.includes(`class="${cls}"`), `${cls} group missing from HUD`);
});
["startBtn", "skillFire", "skillFort", "pauseBtn", "speedBtn", "muteBtn", "menuBtn", "gold", "hp", "wave", "waveTotal"].forEach((id) => {
  assert(html.includes(`id="${id}"`), `${id} should be preserved for JS bindings`);
});
assert(game.includes('document.getElementById("startBtn")'), "start button binding should remain id-based");
assert(game.includes('document.querySelectorAll(".skill-btn")'), "skill button binding should remain class-based");

assert(css.includes(".hud-left, .hud-actions, .hud-controls, .hud-resources"), "HUD group base style missing");
assert(css.includes(".hud-left { flex: 1 1 360px; }"), "HUD left group should claim flexible battle-info space");
assert(css.includes(".hud-actions {") && css.includes("background: rgba(18,12,8,0.22)"), "HUD action group should be visually framed");
assert(css.includes(".hud-controls {") && css.includes("border-left: 1px solid rgba(200,160,74,0.22)"), "HUD controls should be separated from actions");
assert(css.includes(".skillbar { display: flex; gap: 8px; }"), "skillbar should no longer use auto margin for layout");
assert(css.includes(".hud-left, .hud-actions, .hud-controls { width: 100%; flex-basis: 100%; }"), "mobile HUD groups should stack cleanly");
assert(css.includes(".hud-controls { justify-content: flex-start; border-left: 0; padding-left: 0; flex-wrap: wrap; }"), "mobile controls should wrap without divider");
assert(/v=202606(?:13|14)-r(33-hud-layout|34-state-colors|35-ui-quality|38-uiue-assets|39-battlefield-integration|40-path-anchors|41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)/.test(html), "R33-R39/R40 cache-busting version missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["hud-layout", "hud-bindings-preserved", "hud-responsive"],
}, null, 2));
