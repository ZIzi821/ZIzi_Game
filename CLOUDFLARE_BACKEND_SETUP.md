# Cloudflare Worker + D1 Backend Setup

This project now uses a Cloudflare Worker API first for comments and leaderboards. Firebase is still kept in the frontend service as fallback.

## 1. Create the D1 database

In Cloudflare Dashboard:

1. Open Workers & Pages.
2. Open D1 SQL Database.
3. Create a database named `zizi_game`.

You already created this database.

## 2. Required tables

The Worker expects these tables:

```sql
CREATE TABLE IF NOT EXISTS leaderboards (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  level_id TEXT,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  region TEXT DEFAULT 'global',
  source TEXT DEFAULT 'cloudflare',
  external_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  message TEXT NOT NULL,
  region TEXT DEFAULT 'global',
  source TEXT DEFAULT 'cloudflare',
  external_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  id TEXT PRIMARY KEY,
  source TEXT,
  last_synced_at TEXT,
  updated_at TEXT
);
```

Helpful indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_leaderboards_game_score ON leaderboards (game_id, score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_leaderboards_game_level_score ON leaderboards (game_id, level_id, score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments (created_at DESC);
```

## 3. Bind D1 to the Worker

Open the Worker named `zizi-game-api`.

Add a D1 database binding:

- Variable name: `DB`
- D1 database: `zizi_game`

The binding name must be exactly `DB`, because `cloudflare-worker/index.js` uses `env.DB`.

## 4. Worker code to paste

Copy the full contents of:

```text
cloudflare-worker/index.js
```

Paste it into Cloudflare Dashboard -> Worker -> Edit code, then deploy.

If you use Wrangler instead, copy `cloudflare-worker/wrangler.toml.example` to `cloudflare-worker/wrangler.toml`, replace `REPLACE_WITH_YOUR_D1_DATABASE_ID`, then deploy from the `cloudflare-worker` folder.

## 5. Test the API

After deployment, test these URLs in a browser or terminal:

```text
https://zizi-game-api.ehsshshhs526272828272828.workers.dev/health
https://zizi-game-api.ehsshshhs526272828272828.workers.dev/comments
https://zizi-game-api.ehsshshhs526272828272828.workers.dev/leaderboards?gameId=chomp
```

Expected `/health` response:

```json
{
  "ok": true,
  "service": "zizi-game-api"
}
```

## 6. Frontend API address

The frontend API base URL is defined at the top of:

```text
assets/data/zizi-data-service.js
```

Change this line if your actual Worker URL is different:

```js
const API_BASE = "https://zizi-game-api.ehsshshhs526272828272828.workers.dev";
```

## 7. Frontend behavior

These functions are exposed as `window.ZiZiData`:

- `ZiZiData.getLeaderboard(gameId, options)`
- `ZiZiData.submitScore(gameId, scoreData)`
- `ZiZiData.getLeaderboardOverview(options)`
- `ZiZiData.getComments(options)`
- `ZiZiData.addComment(commentData)`

The service tries Cloudflare first. If Cloudflare fails, it falls back to the existing Firebase implementation where possible.
