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

["deck-command", "deckMetrics", "deck-brief", "deckSlots", "deck-roster", "deck-detail-wrap", "deckDetailState"].forEach((needle) => {
  assert(html.includes(needle), `deck command DOM missing ${needle}`);
});
["deckGrid", "deckDetail", "deckCount", "deckStart", "deckBack"].forEach((id) => {
  assert(new RegExp(`id="${id}"`).test(html), `preserved deck id missing #${id}`);
});

assert(game.includes("deckMetrics: document.getElementById(\"deckMetrics\")"), "deck metrics element should be wired");
assert(game.includes("deckSlots: document.getElementById(\"deckSlots\")"), "deck slots element should be wired");
assert(game.includes("function renderDeckMetrics(i)"), "deck metrics renderer missing");
assert(game.includes("function renderDeckSlots()"), "deck slots renderer missing");
assert(game.includes("renderDeckMetrics(game.pendingLevel || 0)") && game.includes("renderDeckSlots();"), "deck grid should refresh metrics and slots");
assert(game.includes("deckDetailState") && game.includes("已入阵") && game.includes("待入阵"), "deck detail should expose selected state");
assert(game.includes("for (let i = 0; i < DECK_SIZE; i++)"), "deck slots should render all formation slots");
assert(game.includes("data-slot=") && game.includes("showDeckHeroDetail(btn.dataset.slot)"), "deck slots should navigate to selected hero detail");

assert(css.includes(".deck-command {") && css.includes("grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr)"), "deck command desktop layout missing");
assert(css.includes(".deck-metrics") && css.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "deck metrics grid missing");
assert(css.includes(".deck-slots") && css.includes(".deck-slot-list"), "deck slot strip styles missing");
assert(css.includes(".deck-layout { display: grid; grid-template-columns: minmax(470px, 1fr) 390px"), "deck roster/detail layout missing");
assert(css.includes(".deck-foot {") && css.includes("position: static"), "deck decision bar should stay in document flow (avoid roster overlap)");
assert(css.includes("@media (max-width: 860px)") && css.includes(".deck-command,") && css.includes(".deck-brief,"), "deck mobile single-column fallback missing");
assert(css.includes("@media (max-width: 560px)") && css.includes(".deck-foot { align-items: stretch; flex-direction: column; }"), "deck mobile footer fallback missing");

assert(/v=20260614-r(?:45-deck-command|46-codex-command|50-path-tuning|51-battle-left-polish|52-hulao-8pads|53-hulao-7pads-path|54-pad-mounds-path|55-gate-approach-path)/.test(html), "R45 cache-busting version missing");
assert(design.includes("R45 选将出战军册升级"), "R45 design entry missing");
assert(design.includes("| R45-1 | 选将出战军册升级"), "R45 progress row missing");

console.log(JSON.stringify({
  ok: true,
  checks: ["deck-command-dom", "deck-state-render", "formation-slots", "responsive-layout", "cache-version"],
}, null, 2));
