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

["gold", "hp", "wave"].forEach((kind) => {
  assert(html.includes(`data-kind="${kind}"`), `HUD ${kind} resource kind missing`);
});
assert(css.includes("--info: #7ec8ff"), "info color token missing");
assert(css.includes("--skill: #9b83dc"), "skill color token missing");
assert(css.includes("--warn: #d99a45"), "warning color token missing");
assert(css.includes('.hud-item[data-kind="gold"]'), "gold HUD semantic style missing");
assert(css.includes('.hud-item[data-kind="hp"]'), "hp HUD semantic style missing");
assert(css.includes('.hud-item[data-kind="wave"]'), "wave HUD semantic style missing");
assert(css.includes('.skill-btn[data-skill="fire"]'), "fire skill semantic style missing");
assert(css.includes('.skill-btn[data-skill="fort"]'), "fort skill semantic style missing");
assert(css.includes('.level-btn.cleared') && css.includes(".level-btn.boss .lv-tag"), "level status semantic styles missing");
assert(css.includes('.cand-card[data-state="deploy"]'), "deploy candidate semantic style missing");
assert(css.includes('.cand-card[data-state="upgrade"]'), "upgrade candidate semantic style missing");
assert(css.includes('.cand-card[data-state="short"]'), "short-gold candidate semantic style missing");
assert(css.includes(".deck-cell.on { border-color: var(--good)"), "selected deck state should use good color token");
assert(css.includes(".deck-count.full { color: var(--good); }"), "full deck count should use good color token");
assert(/v=202606(?:13|14)-r(34-state-colors|35-ui-quality|38-uiue-assets|39-battlefield-integration|40-path-anchors|41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)/.test(html), "R34-R39/R40 cache-busting version missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["state-colors", "hud-semantics", "skill-semantics", "candidate-semantics"],
}, null, 2));
