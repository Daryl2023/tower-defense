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

["codex-command", "codexMetrics", "codex-toolbar", "codex-archive", "codexResultCount", "bond-dossier", "detail-command", "detailBackTop"].forEach((needle) => {
  assert(html.includes(needle), `codex command DOM missing ${needle}`);
});
["codexSort", "codexFilter", "codexHeroes", "codexBonds", "detailBody", "detailBack"].forEach((id) => {
  assert(new RegExp(`id="${id}"`).test(html), `preserved codex id missing #${id}`);
});

assert(game.includes("codexMetrics: document.getElementById(\"codexMetrics\")"), "codex metrics should be wired");
assert(game.includes("codexResultCount: document.getElementById(\"codexResultCount\")"), "codex result count should be wired");
assert(game.includes("detailBackTop: document.getElementById(\"detailBackTop\")"), "detail top back button should be wired");
assert(game.includes("function codexMetricsHtml(ids)"), "codex metrics renderer missing");
assert(game.includes("function codexStateFor(id)") && game.includes("function codexStateLabel(state)"), "codex state helpers missing");
assert(game.includes("data-state=\"${state}\""), "codex rows should expose state for styling");
assert(game.includes("cx-state") && game.includes("codexStateLabel(state)"), "codex row state badge missing");
assert(game.includes("bond-row") && game.includes("bond-owned"), "bond dossier rendering missing");
assert(game.includes("if (el.codexMetrics) el.codexMetrics.innerHTML = codexMetricsHtml(ids)"), "codex metrics should refresh when list renders");
assert(game.includes("if (el.detailBackTop) el.detailBackTop.addEventListener(\"click\", () => showCodexList())"), "detail top back should return to codex list");

assert(css.includes(".codex-command {") && css.includes("grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr)"), "codex command desktop layout missing");
assert(css.includes(".codex-metrics") && css.includes("grid-template-columns: repeat(5, minmax(0, 1fr))"), "codex metrics grid missing");
assert(css.includes(".codex-toolbar,") && css.includes(".codex-archive,") && css.includes(".bond-dossier"), "codex archive panels missing");
assert(css.includes(".codex-row.hero-row") && css.includes("grid-template-columns: auto minmax(0, 1fr) auto auto auto"), "codex roster grid missing");
assert(css.includes(".codex-row[data-state=\"upgradable\"] .cx-state"), "codex upgradable state style missing");
assert(css.includes(".bond-row") && css.includes(".bond-owned"), "bond dossier styles missing");
assert(css.includes(".detail-command") && css.includes("justify-content: space-between"), "detail command header styles missing");
assert(css.includes("@media (max-width: 860px)") && css.includes(".codex-command { grid-template-columns: 1fr; }"), "codex tablet fallback missing");
assert(css.includes("@media (max-width: 560px)") && css.includes(".detail-command { align-items: stretch; flex-direction: column; }"), "codex mobile detail fallback missing");

assert(/v=20260614-r(?:46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-pad-only)|50-path-tuning/.test(html), "R46 cache-busting version missing");
assert(design.includes("R46 武将府军籍档案升级"), "R46 design entry missing");
assert(design.includes("| R46-1 | 武将府军籍档案升级"), "R46 progress row missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["codex-command-dom", "codex-metrics", "codex-row-states", "bond-dossier", "detail-command", "cache-version"],
}, null, 2));
