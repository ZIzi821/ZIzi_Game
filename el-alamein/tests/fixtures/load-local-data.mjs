import fs from "node:fs";

export function readJson(url) {
  return JSON.parse(fs.readFileSync(url, "utf8"));
}

export function loadLocalData() {
  return {
    scenario: readJson(new URL("../../local-data/scenario.json", import.meta.url)),
    rules: readJson(new URL("../../local-data/rules.json", import.meta.url)),
  };
}
