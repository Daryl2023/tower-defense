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

assert(css.includes(".btn:active"), "buttons should have pressed feedback");
assert(css.includes(".btn:focus-visible") && css.includes(".skill-btn:focus-visible"), "interactive controls need keyboard focus styling");
assert(css.includes("transition: transform .1s ease"), "buttons should have subtle interaction transitions");

assert(css.includes(".hud-hint {") && css.includes("position: fixed"), "flash messages should be toast-like and not consume HUD layout");
assert(css.includes(".hud-hint:not(:empty)"), "toast visible state should be driven by flash text");
assert(css.includes("z-index: 20"), "toast should float above battle UI");

assert(css.includes("#sceneHome { position: relative; overflow: hidden"), "home scene should frame the canvas cleanly");
assert(css.includes(".home-ui {") && css.includes("radial-gradient(circle at 26% 18%"), "home overlay should add visual depth over the canvas");
assert(css.includes(".home-command {") && css.includes(".home-report {"), "home command panel should be structured and readable");
assert(css.includes(".home-metrics") && css.includes(".hr-progress"), "home overview should use stable report metrics");

assert(css.includes(".overlay {") && css.includes("backdrop-filter: blur(2px)"), "modal overlay should dim and separate the battlefield");
assert(css.includes(".overlay-card {") && css.includes("width: min(560px, 100%)"), "result modal should have responsive stable width");
assert(css.includes(".overlay-card h2") && css.includes("border-bottom: 1px solid rgba(200,160,74,0.30)"), "result modal title needs a clear hierarchy separator");
assert(css.includes("@media (max-width: 560px)") && css.includes(".overlay-card { padding: 22px 18px; }"), "small-screen modal polish missing");

assert(/v=202606(?:13|14)-r(30-polish|31-state-card|32-global-polish|33-hud-layout|34-state-colors|35-ui-quality|38-uiue-assets|39-battlefield-integration|40-path-anchors|41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)/.test(html), "R30-R39/R40 cache-busting version missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["home-polish", "button-feedback", "toast-feedback", "modal-polish", "mobile-polish"],
}, null, 2));
