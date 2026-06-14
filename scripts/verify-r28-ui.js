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

const css = read("style.css");
const html = read("index.html");

assert(css.includes("#stage {"), "battle stage style missing");
assert(css.includes("grid-template-columns: minmax(0, 960px) 260px"), "stage should reserve a fixed battle column and command panel");
assert(css.includes("align-items: start"), "stage children should not stretch vertically");
assert(css.includes("aspect-ratio: 960 / 600"), "battle canvas display ratio should stay locked");
assert(css.includes("height: auto !important"), "canvas height should be derived from width, not side panel height");
assert(css.includes("align-self: start"), "canvas should not stretch with the command panel");
assert(css.includes("justify-self: stretch"), "canvas should stay stretched in its battle column");
assert(css.includes("max-height: calc(100vh - 116px)"), "command panel should cap height and scroll");
assert(css.includes("overflow-y: auto"), "command panel should scroll when candidate list is long");
assert(css.includes("grid-template-columns: 62px minmax(0, 1fr)"), "candidate cards should use compact portrait/text layout");
assert(css.includes("@media (max-width: 860px)"), "responsive battle layout missing");
assert(css.includes("grid-template-columns: 1fr"), "narrow battle layout should stack into one column");

assert(html.includes("军令台 · 招贤"), "battle side panel title should use the new command-panel wording");
assert(/v=202606(?:13|14)-r(28-battle-ui|29-prebattle-ui|30-polish|31-state-card|32-global-polish|33-hud-layout|34-state-colors|35-ui-quality|38-uiue-assets|39-battlefield-integration|40-path-anchors|41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-8pads|53-hulao-7pads-path|54-pad-mounds-path|55-gate-approach-path)/.test(html), "R28-R39/R40 cache-busting version missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["battle-ui", "canvas-aspect-lock", "command-panel-scroll"],
}, null, 2));
