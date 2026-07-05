# AGENTS.md

## Project Overview

This repository is a GitHub Pages static game collection published from the repository root on the `main` branch.

The El Alamein wargame lives in `el-alamein/`. Keep it playable while refactoring. The goal is a static, browser-playable hex-and-counter wargame with a testable rules core, clear UI state, deterministic combat/replay support, and no fragile single-file rule/UI tangle.

Do not migrate this repository to React, Vite, TypeScript, a backend server, or a build-required deployment unless the user explicitly asks for that migration.

## Running The App Locally

Run the static server from the repository root:

```powershell
node local-static-server.js
```

Then open:

```text
http://127.0.0.1:8000/
http://127.0.0.1:8000/el-alamein/
```

If a browser preview is needed, use the local static server above. Do not assume files loaded via `file://` behave the same as GitHub Pages.

## Checks And Tests

On Windows PowerShell, prefer `npm.cmd` because plain `npm run ...` may be blocked by the `npm.ps1` execution policy.

Before finishing code changes, run:

```powershell
npm.cmd run check
```

For El Alamein rule-only validation, run:

```powershell
node scripts\test-el-alamein-rules.mjs
```

For syntax-only checks while iterating:

```powershell
node --check el-alamein\game.js
node --check scripts\test-el-alamein-rules.mjs
```

If changing UI layout, also run the local server and inspect `http://127.0.0.1:8000/el-alamein/` in desktop and mobile-sized viewports. Check for missing images, text overflow, overlapping panels, unusable buttons, and unreadable contrast.

## Code Style

- Keep the project static and dependency-light.
- Prefer plain JavaScript modules for new El Alamein core code.
- Keep pure game rules deterministic and free of DOM, storage, timers, animation, network calls, and `Math.random()`.
- Inject dice rolls, IDs, clocks, and persistence from app/controller layers instead of hardcoding them in rules.
- Keep functions small enough to test directly. Avoid adding new giant procedural blocks to `game.js`.
- Avoid duplicated rule logic in tests. Tests should import the same implementation used by the app.
- Prefer structured data and explicit events over parsing human-readable log strings.
- Preserve existing behavior unless the task explicitly asks for a rules change.
- Do not reformat unrelated files or churn generated/asset files.

## El Alamein Architecture Rules

Use this target shape:

```text
el-alamein/
  game.js
  src/
    core/
    app/
    ui/
    replay/
  tests/
    unit/
    integration/
    fixtures/
```

Responsibilities:

- `src/core/`: board geometry, terrain, movement, ZOC, combat, retreat, phases, victory, serialization, RNG adapters. No DOM.
- `src/app/`: commands, state transitions, persistence glue, migrations, event/reducer wiring.
- `src/ui/`: DOM rendering, board rendering, panels, i18n, interaction affordances.
- `src/replay/`: event schema, replay player, log formatting.
- `game.js`: transition-period bootstrap and compatibility layer. Thin it gradually; do not rewrite it all at once.

When extracting from `game.js`, move one behavior group at a time:

1. Add or update tests around the behavior.
2. Extract a pure function into `src/core/`.
3. Make `game.js` call that function.
4. Run `npm.cmd run check`.
5. Report any behavior that intentionally changed.

High-risk rules that need focused tests before edits:

- ZOC entry/exit restrictions.
- Retreat path legality.
- Stacking.
- First-turn Allied movement reduction.
- Combat odds and CRT result mapping.
- AR/DR/AE/DE effects.
- Advance after combat.
- Phase gates and cleanup.
- Victory conditions.
- Save/load roundtrip and replay state hash.

## Event And Replay Rules

Combat and state-changing actions should become explicit events. Prefer event names like:

```text
GAME_STARTED
UNIT_MOVED
MOVE_UNDONE
COMBAT_DECLARED
COMBAT_RESOLVED
RETREAT_REQUIRED
UNIT_RETREATED
UNIT_ELIMINATED
UNIT_ADVANCED
PHASE_ENDED
TURN_STARTED
GAME_ENDED
```

Combat events must record die rolls and battle IDs. Replay must not depend on localized UI text.

## UI And Visual Direction

El Alamein should not look like a generic web dashboard. Use a 1942 North Africa operations-room direction:

- Full map is the visual anchor.
- UI should feel like a field command table: sand-toned map paper, black/olive military labels, muted red/blue force markers, brass/steel highlights, restrained texture.
- Prioritize information hierarchy: current turn/phase, selected unit, legal moves, declared combats, pending retreat/advance, and victory pressure.
- Use compact operational panels, not marketing cards or oversized hero sections.
- Preserve readability over decoration.
- Avoid vague atmospheric backgrounds, purple gradients, glassmorphism, decorative orbs, and generic SaaS styling.
- Make the player always know: whose phase it is, what can be clicked, why something is illegal, and what must happen next.

Before implementing a major UI change, ask for or produce a short UI brief with:

```text
1. Player job: what decision the screen supports.
2. Visual metaphor: e.g. operations map table, staff briefing board, field logbook.
3. Layout hierarchy: map, command panel, selected unit, combat queue, log.
4. Color tokens: background, panel, Axis, Allied, warning, legal move, attack, disabled.
5. Interaction states: selected, reachable, attackable, invalid, pending retreat, pending advance.
6. Verification: desktop/mobile screenshots, no overlap, no text overflow, all images loaded.
```

Useful UI prompts for future agents:

```text
First, do not edit code. Review the current El Alamein UI and propose a visual brief for a North Africa 1942 operations-room style. Include layout hierarchy, color tokens, typography direction, interaction states, and risks.
```

```text
Redesign only the El Alamein UI CSS/DOM presentation. Keep gameplay behavior and existing rule functions unchanged. The map must remain the first visual anchor. Make the current phase, selected unit, legal actions, combat queue, and log easier to scan. Run npm.cmd run check and inspect the page locally.
```

```text
Improve UI clarity without changing rules: add clearer selected/reachable/attack/retreat/advance states, better panel grouping, and concise button labels. Do not add a build step or new framework. Verify desktop and mobile viewports.
```

```text
Create a style guide for El Alamein before coding: CSS variables, color palette, spacing scale, button states, unit counter states, combat panel states, and map overlay states. Then wait for approval.
```

Good reference directions to study, not copy blindly:

- Battle for Wesnoth: open-source turn-based hex strategy with strong map readability and unit-state clarity.
- TripleA: open-source strategy/board-game engine with scenario-oriented board-game UI patterns.
- Board wargame/VASSAL modules: useful for counter language, CRT presentation, log flow, and scenario charts.

Use references for structure and clarity, not for copying copyrighted assets.

## Subproject Rules

### `el-alamein/`

- Treat this as the main active wargame project.
- Keep `local-data/scenario.json` and `local-data/rules.json` as data sources.
- Do not commit real Supabase/Firebase secrets.
- Example config files are allowed.
- If changing scenario/rules data, add or update integration validation tests.
- If changing combat/movement/retreat/victory, add or update unit tests.
- Preserve GitHub Pages static deployment.

### `map-generator/`, `wargame-counter-maker/`, `wargame-sandbox/`

- These are related wargame tools. Keep their export/import JSON contracts stable.
- Do not break existing static pages while improving El Alamein.
- If changing shared formats, document compatibility and update consumers together.

### Community, Leaderboards, Firebase, And Cache Files

- Firebase Firestore is the source of truth for live community and leaderboard data.
- `data/comments.json` and `data/leaderboards.json` are cache/fallback files. Do not treat them as canonical.
- Do not commit service account JSON or private keys.
- Changes to `firestore.rules` require separate Firebase deploy outside GitHub Pages.

### Other Game Folders

- Keep edits scoped. Do not change unrelated games unless the task asks for it.
- If touching another game, run at least syntax checks for that game's JavaScript.

## Security Boundaries

- Never commit `.env`, local secrets, Firebase service accounts, Supabase keys, API tokens, or personal credentials.
- Do not add network calls that send player data or local files without explicit user approval.
- Do not weaken Firestore rules to make debugging easier.
- Do not add broad remote dependencies or CDNs without approval.
- Do not use destructive Git commands unless the user explicitly asks.
- Keep sandbox/worktree changes isolated for large experiments.

## Worktree And Subagent Guidance

Use a Codex worktree for large refactors, risky UI redesigns, or parallel experiments.

Use subagents mainly for read-only exploration and review:

- One agent checks rules correctness.
- One agent checks UI/UX clarity.
- One agent checks tests and regression risk.
- The main thread integrates decisions and performs final edits.

Do not let multiple agents edit the same files at the same time unless the work is clearly partitioned.

## Completion Report Expectations

When finishing a task, report:

- Files changed.
- Checks run and whether they passed.
- Behavior intentionally changed.
- Remaining risks or follow-up suggestions.

If checks cannot be run, explain why and name the exact command that should be run next.
