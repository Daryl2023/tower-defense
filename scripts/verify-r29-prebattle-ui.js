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

assert(css.includes(".scene-card {"), "shared scene panel style missing");
assert(css.includes("linear-gradient(180deg, rgba(54,40,29,0.97)"), "scene cards should use unified military-panel background");
assert(css.includes(".levels-wrap { max-width: 1040px; }"), "level select panel should be wider and more readable");
assert(css.includes(".level-btn .lv-tag"), "level status pill style missing");
assert(css.includes("border-radius: 999px"), "status tags should use pill styling");

assert(
  css.includes(".deck-card { width: min(1120px, 94vw)") ||
  css.includes(".deck-card { width: min(1180px, 94vw)"),
  "deck scene should use wider campaign layout"
);
assert(
  css.includes(".deck-layout { display: grid; grid-template-columns: minmax(430px, 1fr) 380px") ||
  css.includes(".deck-layout { display: grid; grid-template-columns: minmax(470px, 1fr) 390px"),
  "deck should keep roster and detail columns"
);
assert(css.includes(".deck-grid") && css.includes("background: rgba(18,12,8,0.24)"), "deck roster should sit in a framed roster area");
assert(css.includes(".deck-cell {") && css.includes("min-height: 164px"), "deck hero cards need stable dimensions");
assert(css.includes(".deck-cell:hover") && css.includes("transform: translateY(-1px)"), "deck cards should have clear interactive affordance");

assert(
  css.includes(".codex-card { max-width: 860px") ||
  css.includes(".codex-card { width: min(1040px, 94vw); max-width: 1040px"),
  "codex should use wider roster panel"
);
assert(
  (css.includes(".codex-tools") && css.includes("background: rgba(18,12,8,0.30)")) ||
  (css.includes(".codex-toolbar,") && css.includes(".codex-tools")),
  "codex sort/filter controls should be grouped as a toolbar"
);
assert(css.includes(".codex-row {") && css.includes("box-shadow: inset 0 1px 0"), "codex rows should share the new roster item style");
assert(css.includes(".detail-card { max-width: 560px"), "hero detail panel should align with the upgraded archive style");
assert(css.includes("@media (max-width: 560px)"), "small-screen prebattle fallback missing");
assert(css.includes(".deck-grid { grid-template-columns: 1fr; }"), "small screens should stack deck cards");
assert(css.includes(".dt-head { flex-direction: column;"), "small hero detail should avoid cramped horizontal layout");

assert(/v=202606(?:13|14)-r(29-prebattle-ui|30-polish|31-state-card|32-global-polish|33-hud-layout|34-state-colors|35-ui-quality|38-uiue-assets|39-battlefield-integration|40-path-anchors|41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)/.test(html), "R29-R39/R40 cache-busting version missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["prebattle-ui", "level-select", "deck-layout", "codex-archive", "mobile-fallback"],
}, null, 2));
