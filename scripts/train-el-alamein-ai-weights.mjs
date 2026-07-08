import fs from "node:fs";
import path from "node:path";

import {
  extractPreferenceSamplesFromLogs,
  makeExpertWeightsArtifact,
  trainPreferenceWeights,
} from "../el-alamein/src/app/ai-preferences.js";
import { createBoard } from "../el-alamein/src/core/index.js";
import { loadLocalData } from "../el-alamein/tests/fixtures/load-local-data.mjs";

const args = process.argv.slice(2);
const parsedArgs = parseArgs(args);
const paths = parsedArgs.paths;
const outputPath = parsedArgs.options.out || null;
const jsonOutput = Boolean(parsedArgs.options.json);
const iterations = Number(parsedArgs.options.iterations || 4);

if (!paths.length) {
  console.error("Usage: node scripts\\train-el-alamein-ai-weights.mjs <training-log.json> [more.json] [--out el-alamein\\local-data\\ai-weights-expert.json] [--json]");
  process.exitCode = 1;
} else {
  const { scenario, rules } = loadLocalData();
  const board = createBoard(scenario);
  const logs = paths.map((filePath) => {
    const absolutePath = path.resolve(filePath);
    return {
      ...JSON.parse(fs.readFileSync(absolutePath, "utf8")),
      source: path.basename(absolutePath),
    };
  });

  const samples = extractPreferenceSamplesFromLogs(logs, { scenario, rules, board });
  const result = trainPreferenceWeights(samples, { iterations });
  const artifact = makeExpertWeightsArtifact({
    ...result,
    sources: logs.map((log) => log.source),
  });

  if (outputPath) {
    const absoluteOutput = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
    fs.writeFileSync(absoluteOutput, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  }

  if (jsonOutput) {
    console.log(JSON.stringify(artifact, null, 2));
  } else {
    printSummary(artifact, outputPath);
  }
}

function parseArgs(rawArgs) {
  const options = {};
  const positional = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg.startsWith("--out=")) {
      options.out = arg.slice("--out=".length);
      continue;
    }
    if (arg === "--out") {
      options.out = rawArgs[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg.startsWith("--iterations=")) {
      options.iterations = arg.slice("--iterations=".length);
      continue;
    }
    if (arg === "--iterations") {
      options.iterations = rawArgs[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) continue;
    positional.push(arg);
  }
  return { paths: positional, options };
}

function printSummary(artifact, outputPath) {
  console.log("El Alamein Expert AI weight training");
  console.log(`Samples: ${artifact.sampleCount}`);
  console.log(`Trainable keys: ${artifact.trainableKeys.join(", ") || "none"}`);
  console.log(`Baseline top1/top3: ${formatRate(artifact.baselineMetrics?.top1Rate)} / ${formatRate(artifact.baselineMetrics?.top3Rate)}`);
  console.log(`Trained top1/top3: ${formatRate(artifact.metrics?.top1Rate)} / ${formatRate(artifact.metrics?.top3Rate)}`);
  console.log(`Pair accuracy: ${formatRate(artifact.metrics?.pairAccuracy)}`);
  if (outputPath) console.log(`Wrote: ${path.resolve(outputPath)}`);
  if (!artifact.sampleCount) {
    console.log("No usable movement preference samples were found. Export a v2 training log with replay events or human move entries.");
  }
}

function formatRate(value) {
  return value === null || value === undefined ? "--" : `${Math.round(value * 100)}%`;
}
