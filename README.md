# ZIzi_Game

ZIzi Game Collection is published with GitHub Pages from the repository root on the `main` branch.

Site: https://zizi821.github.io/ZIzi_Game/

Community: https://zizi821.github.io/ZIzi_Game/forum.html

Updates: https://zizi821.github.io/ZIzi_Game/updates.html

Developer: https://zizi821.github.io/ZIzi_Game/developer.html

## Games

- [Starfall / 星坠](https://zizi821.github.io/ZIzi_Game/aetherfall-protocol/)
- [Sentinel / 哨兵防线](https://zizi821.github.io/ZIzi_Game/starline-defense/)
- [Chomp / 大口吞](https://zizi821.github.io/ZIzi_Game/pacman-odyssey/)

## Unified Community

`forum.html` is the only community entry point.

- Reads comments from Firebase Firestore first.
- Falls back to `data/comments.json` if Firebase fails or times out.
- Writes new comments to Firebase first.
- If a write fails, the browser creates a `ZIZI-SYNC` code and opens a GitHub Issue submission URL.

The older `forum-mainland.html` and `forum-international.html` pages redirect to `forum.html`.

## Unified Leaderboards

Firebase Firestore is the only official leaderboard database. JSON files are read-only cache backups.

Score documents are stored at:

```text
leaderboards/{gameId}/scores/{scoreId}
leaderboards/chomp/levels/{levelId}/scores/{scoreId}
```

Supported game IDs:

```text
starfall
sentinel
chomp
```

Supported Chomp level IDs:

```text
level1
level2
level3
```

Each score record contains:

```text
nickname
score
gameId
createdAt
```

Synced fallback records may also contain:

```text
syncId
sourceRegion
syncedAt
sourceIssueNumber
```

## Cache Files

The cache files are exported from Firebase by GitHub Actions:

```text
data/comments.json
data/leaderboards.json
```

They are only used when Firebase reads fail. Do not treat them as the source of truth.

## GitHub Actions

`export-cache.yml` exports Firebase comments and leaderboard scores on a schedule or manual run.

`zizi-sync.yml` processes Issues with titles containing `[ZIzi Sync]`, writes validated sync items to Firebase, exports cache JSON, comments on the Issue, labels it, and closes it when successful.

Required GitHub Actions secret:

```text
FIREBASE_SERVICE_ACCOUNT_JSON
```

This must be the full Firebase Admin service account JSON. Do not commit it to the repository.

## Local Test

Run a local static server from the repository root:

```powershell
node local-static-server.js
```

Then open:

```text
http://127.0.0.1:8000/
http://127.0.0.1:8000/forum.html
http://127.0.0.1:8000/aetherfall-protocol/
http://127.0.0.1:8000/starline-defense/
http://127.0.0.1:8000/pacman-odyssey/
```
