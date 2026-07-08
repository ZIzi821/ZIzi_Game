import fs from "node:fs";
import path from "node:path";

import {
  flattenTrainingEvents,
  flattenTrainingLogs,
  summarizeTrainingEntries,
  summarizeTrainingEvents,
} from "../el-alamein/src/app/ai-training.js";

const paths = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const jsonOutput = process.argv.includes("--json");

if (!paths.length) {
  console.error("Usage: node scripts\\analyze-el-alamein-training.mjs <training-log.json> [more.json] [--json]");
  process.exitCode = 1;
} else {
  const logs = paths.map((filePath) => {
    const absolutePath = path.resolve(filePath);
    const payload = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    return {
      ...payload,
      source: absolutePath,
    };
  });
  const entries = flattenTrainingLogs(logs);
  const events = flattenTrainingEvents(logs);
  const summary = summarizeTrainingEntries(entries);
  const eventSummary = summarizeTrainingEvents(events);

  if (jsonOutput) {
    console.log(JSON.stringify({ summary, events: eventSummary }, null, 2));
  } else {
    printSummary(summary, eventSummary);
  }
}

function printSummary(summary, eventSummary) {
  console.log("El Alamein training log analysis");
  console.log(`Entries: ${summary.entries}`);
  console.log(`Actions: ${formatCounts(summary.actions)}`);
  console.log(`Sides: ${formatCounts(summary.sides)}`);
  console.log(`Phases: ${formatCounts(summary.phases)}`);
  console.log(`Turns: ${formatCounts(summary.turns)}`);
  console.log("");
  console.log(`Movement: ${summary.movement.scored}/${summary.movement.entries} scored, avg delta ${formatNumber(summary.movement.averageScoreDelta)}, top3 ${formatRate(summary.movement.top3Rate)}, top5 ${formatRate(summary.movement.top5Rate)}`);
  console.log(`Combat: ${summary.combat.scored}/${summary.combat.entries} scored, avg delta ${formatNumber(summary.combat.averageScoreDelta)}`);
  console.log(`Retreat: ${summary.retreat.mismatches}/${summary.retreat.compared} mismatches`);
  console.log(`Advance: ${summary.advance.mismatches}/${summary.advance.compared} mismatches`);
  console.log("");
  console.log(`Replay events: ${eventSummary.events}`);
  if (eventSummary.events) {
    console.log(`Event types: ${formatCounts(eventSummary.types)}`);
    console.log(`Event hash coverage: ${formatRate(eventSummary.stateHashCoverage)}`);
    console.log(`Event legal-action coverage: ${formatRate(eventSummary.legalActionCoverage)}`);
    console.log(`Event metric coverage: ${formatRate(eventSummary.metricCoverage)}`);
    console.log(`Dice-bearing events: ${eventSummary.diceEvents}`);
    console.log(`Replay gaps: ${formatCounts(eventSummary.missingReplayFields)}`);
    console.log("");
  }
  printDivergences("Worst movement divergences", summary.worstMovementDivergences);
  printDivergences("Worst combat divergences", summary.worstCombatDivergences);
  console.log("Schema gaps:");
  for (const [key, value] of Object.entries(summary.schemaGaps)) {
    if (key === "notes") continue;
    console.log(`  ${key}: ${value}`);
  }
  for (const note of summary.schemaGaps.notes) console.log(`  note: ${note}`);
}

function printDivergences(title, rows) {
  console.log(`${title}:`);
  if (!rows.length) {
    console.log("  none");
    return;
  }
  for (const row of rows.slice(0, 8)) {
    const human = row.humanChoice?.hexId || row.humanChoice?.defenderId || row.humanChoice?.id || "--";
    const ai = row.aiChoice?.hexId || row.aiChoice?.defenderId || row.aiChoice?.id || "--";
    console.log(`  ${row.id || "sample"} T${row.turn ?? "?"} ${row.phaseId || "?"} ${row.unitId || ""} delta=${row.scoreDelta}: human ${human}, ai ${ai}`);
  }
  console.log("");
}

function formatCounts(counts) {
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

function formatNumber(value) {
  return value === null || value === undefined ? "--" : String(value);
}

function formatRate(value) {
  return value === null || value === undefined ? "--" : `${Math.round(value * 100)}%`;
}
