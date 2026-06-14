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

assert(!game.includes('<div style="font-size:11px;color:#8a7a62;padding:0 12px 2px">'), "bond requirement line should not use inline style");
assert(game.includes('class="bond-need-line"'), "bond requirement line should use class-based styling");

const overlayAnimCount = (css.match(/\.overlay\.cut-reveal \.overlay-card/g) || []).length;
assert(overlayAnimCount === 1, "overlay reveal animation rule should not be duplicated");

assert(css.includes("*::-webkit-scrollbar"), "custom scrollbar style missing");
assert(css.includes("*::-webkit-scrollbar-thumb:hover"), "scrollbar hover style missing");
assert(css.includes(".bond-need-line"), "bond requirement style missing");
assert(css.includes(".tower-btn {") && css.includes("background: rgba(32,23,17,0.82)"), "tower buttons should use unified panel background");
assert(css.includes(".train-row") && css.includes("background: rgba(32,23,17,0.82)"), "train rows should use unified panel background");
assert(css.includes(".train-up") && css.includes("linear-gradient(180deg, #dbb75c, #b98734)"), "train buttons should share the primary button gradient");
assert(css.includes(".level-intel") && css.includes("border: 1px solid rgba(138,109,47,0.56)"), "enemy intel panel should use unified border");
assert(css.includes(".tw-fac") && css.includes("border-radius: 999px"), "battle faction chips should use pill styling");
assert(css.includes(".codex-row .cx-fac") && css.includes("border-radius: 999px"), "codex faction chips should use pill styling");
assert(css.includes(".hero-tags em") && css.includes("border-radius: 999px"), "hero tags should use pill styling");

assert(/v=202606(?:13|14)-r(32-global-polish|33-hud-layout|34-state-colors|35-ui-quality|38-uiue-assets|39-battlefield-integration|40-path-anchors|41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)/.test(html), "R32-R39/R40 cache-busting version missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["global-polish", "no-inline-bond-style", "scrollbar", "legacy-control-unification"],
}, null, 2));
