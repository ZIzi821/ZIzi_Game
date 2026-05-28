# ZIzi_Game

ZIzi 的游戏合集仓库，使用 GitHub Pages 从 `main` 分支根目录发布。

网站主页：
https://zizi821.github.io/ZIzi_Game/

更新日志：
https://zizi821.github.io/ZIzi_Game/updates.html

社区留言板：
https://zizi821.github.io/ZIzi_Game/forum.html

开发者简介：
https://zizi821.github.io/ZIzi_Game/developer.html

## Games

- [Starfall / 星陨](https://zizi821.github.io/ZIzi_Game/aetherfall-protocol/)：能量核心生存射击；尝试面对不同的波次，与不同的升级选择 坚持到最后。
- [Sentinel / 哨兵防线](https://zizi821.github.io/ZIzi_Game/starline-defense/)：路线塔防，部署单位守住核心。
- [Chomp / 大口吃](https://zizi821.github.io/ZIzi_Game/pacman-odyssey/)：吃豆游戏。

## Source Projects

- `pacman_game/`：Chomp / 大口吃 的 Pygame 源代码，包含图片、音效、音乐和运行脚本。

## Folder Layout

```text
/
  index.html
  README.md
  updates.html
  forum.html
  developer.html
  firestore.rules
  assets/
  aetherfall-protocol/
  starline-defense/
  pacman-odyssey/
  pacman_game/
```

## Leaderboards / 排行榜

All three games include a public text-only leaderboard:

- `starfall` - Starfall / 星陨
- `sentinel` - Sentinel / 哨兵防线
- `chomp` - Chomp / 大口吃

The leaderboard is a static-site feature that uses Firebase Firestore for the international version. It does not use a backend server and does not store public scores in `localStorage`.

Firebase config lives in:

```text
assets/firebase-config.js
```

Leaderboard documents are stored at:

```text
leaderboards/{gameId}/scores/{scoreId}
```

Each score record contains:

```text
nickname
score
gameId
createdAt
```

Security rules are stored in `firestore.rules`. Paste those rules into Firebase Console > Firestore Database > Rules before testing submissions.

For mainland China users, the UI already shows a fallback note. A China-compatible backend can later replace or extend the same `gameId`, `nickname`, `score`, and `createdAt` structure.

### Local Test

Run a local static server from the repository root:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8765/aetherfall-protocol/
http://127.0.0.1:8765/starline-defense/
http://127.0.0.1:8765/pacman-odyssey/
```

Open `排行榜 / Leaderboard` in each game, finish a round, enter a nickname, and submit the score. Higher scores rank first; equal scores are sorted by earlier timestamp first in the UI.

新增游戏时，在根目录创建独立文件夹，并在 `index.html` 和 `README.md` 里添加入口链接。
