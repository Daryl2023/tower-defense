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

const versions = [...html.matchAll(/[?&]v=([^"']+)/g)].map((m) => m[1]);
assert(versions.length >= 5, "expected cache-busting versions on CSS and JS assets");
assert(new Set(versions).size === 1, "all cache-busting versions should match");
assert(/^202606(?:13|14)-r(35-ui-quality|38-uiue-assets|39-battlefield-integration|40-path-anchors|41-result-report|42-home-command|43-campaign-map|44-battlefield-grounding|45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)$/.test(versions[0]), "cache-busting version should be an accepted UI quality version");

let balance = 0;
let minBalance = 0;
for (const ch of css) {
  if (ch === "{") balance += 1;
  if (ch === "}") balance -= 1;
  if (balance < minBalance) minBalance = balance;
}
assert(balance === 0 && minBalance === 0, "CSS braces should be balanced");

assert(!/font-size\s*:\s*[^;]*vw\b/.test(css), "font size should not scale directly with viewport width");
assert(!/letter-spacing\s*:\s*-/.test(css), "negative letter spacing should not be used");

const htmlInlineStyles = html.match(/\sstyle=/g) || [];
assert(htmlInlineStyles.length === 0, "HTML should not use inline styles");

const gameInlineStyles = game.match(/\sstyle=/g) || [];
assert(gameInlineStyles.length === 1 && game.includes("style=\"--hero-color:"), "game inline styles should be limited to dynamic hero fallback color");

const overlayAnimCount = (css.match(/\.overlay\.cut-reveal \.overlay-card/g) || []).length;
assert(overlayAnimCount === 1, "overlay reveal rule should appear exactly once");
const hudRuleCount = (css.match(/#hud\s*\{/g) || []).length;
assert(hudRuleCount >= 1 && hudRuleCount <= 2, "HUD rules should include the main rule and at most one responsive override");

[
  "verify-r28-ui.js",
  "verify-r29-prebattle-ui.js",
  "verify-r30-polish.js",
  "verify-r31-battle-state-ui.js",
  "verify-r32-global-polish.js",
  "verify-r33-hud-layout.js",
  "verify-r34-state-colors.js",
].forEach((file) => {
  assert(fs.existsSync(path.join(root, "scripts", file)), `${file} should exist as part of UI quality gate`);
});

console.log(JSON.stringify({
  ok: true,
  checks: ["cache-version", "css-balance", "rough-style-guard", "ui-gate-chain"],
}, null, 2));
