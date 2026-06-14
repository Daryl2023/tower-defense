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

assert(game.includes('card.dataset.state = afford ? (existing ? "upgrade" : "deploy") : "short"'), "candidate cards should expose deploy/upgrade/short states");
assert(game.includes('card.dataset.state = short ? "short"'), "candidate state should update when gold changes");
assert(game.includes('class="sel-card pending"'), "pending deployment state card missing");
assert(game.includes('class="sel-card active"'), "selected tower state card missing");
assert(game.includes('class="sel-card empty"'), "empty command hint state card missing");
assert(game.includes("sel-stats") && game.includes("sel-action"), "state cards should include stat and action sections");
assert(game.includes("点击战场空地安置") && game.includes("按 S 撤将"), "state cards should preserve core action guidance");

assert(css.includes(".sel-card {") && css.includes("flex-direction: column"), "state card base style missing");
assert(css.includes(".sel-stats {") && css.includes("grid-template-columns: repeat(3"), "state stats grid missing");
assert(css.includes(".sel-action {") && css.includes("background: rgba(200,160,74,0.10)"), "state action callout missing");
assert(css.includes('.cand-card[data-state="upgrade"]'), "upgrade candidate state style missing");
assert(css.includes('.cand-card[data-state="short"]'), "short-gold candidate state style missing");
assert(css.includes(".sel-card.pending .sel-action"), "pending action callout style missing");
assert(css.includes("@media (max-width: 560px)") && css.includes(".sel-stats { grid-template-columns: 1fr; }"), "small-screen state card fallback missing");

assert(/v=202606(?:13|14)-r(31-state-card|32-global-polish|33-hud-layout|34-state-colors|35-ui-quality|38-uiue-assets|39-battlefield-integration|40-path-anchors|41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)/.test(html), "R31-R39/R40 cache-busting version missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["battle-state-card", "candidate-states", "state-card-responsive"],
}, null, 2));
