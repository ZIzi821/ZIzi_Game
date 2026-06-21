# ZIzi Game 兵棋地图生成器交接文档

这份文档用于让新的 ChatGPT/Codex 账号在不了解此前对话的情况下，继续开发 ZIzi Game 的兵棋地图生成器。请先阅读全文，再检查实际仓库状态；不要仅凭本文假定线上或本地文件没有变化。

## 1. 项目位置

- 本地仓库：`C:\Users\ZI\Documents\Code\ZIzi_Game`
- GitHub：`ZIzi821/ZIzi_Game`
- 主分支：`main`
- GitHub Pages：`https://zizi821.github.io/ZIzi_Game/`
- 地图生成器：`map-generator/index.html`
- 共享地图契约：`assets/operation-typhoon-map.js`
- 台风行动游戏：`battle-for-moscow/`
- 更新日志：`updates.html`

开始工作前运行：

```powershell
git -C C:\Users\ZI\Documents\Code\ZIzi_Game status --short --branch
git -C C:\Users\ZI\Documents\Code\ZIzi_Game log -5 --oneline
```

不要撤销不属于当前任务的用户修改。提交时必须明确暂存目标文件，不能默认使用 `git add -A`。

## 2. 用户目标

用户正在制作自己的兵棋游戏，并希望地图生成器像代码编辑器一样使用：

- 左侧选择地形或工具。
- 右侧在规则六边形网格上绘制地图。
- 地块必须无缝拼接。
- 界面全部使用 `中文 / English` 双语。
- 同时导出 PNG 图片和可供台风行动规则引擎读取的地图 JSON。
- 未来可能有很多地图，但继续由同一套台风行动规则运行。

当前阶段不要把自定义地图真正加载进台风行动游戏。游戏加载器集成属于后续任务。

## 3. 当前已完成的功能

### 地图编辑

- 默认地图为 `14 x 11`，全部是开阔地。
- 支持调整到 4-24 列、4-18 行。
- 支持点击和拖动绘制地块。
- 支持撤销、重做和清空。
- 地块纹理从 `battle-for-moscow/assets/terrain.png` 裁切。
- 地块按 cover 方式居中铺满六边形，并略微覆盖共享边，避免露出背景缝隙。
- 地块纹理和六边形边线分两轮绘制，边线始终位于纹理上方。

### 河流工具

- River 不是整格地块，而是六边形边工具。
- 用户选择 River 后可以切换 `绘制 / Draw` 和 `擦除 / Erase`。
- 鼠标会吸附到最近的六边形边。
- 连续河段使用圆角、多层描边绘制，相交端点不会出现断口。
- 内部状态只保存一条共享边，JSON 导出时会自动写入相邻两格的相反方向。
- 支持六个方向：`N`、`NE`、`SE`、`S`、`SW`、`NW`。
- 不允许原游戏数据中偶尔出现的无效方向 `E`。

### 统一导出

- 右上角只有一个 `导出 / Export` 主按钮。
- 点击后在按钮下方向下展开菜单。
- 菜单包含：
  - `导出 PNG / Export PNG`
  - `导出地图数据 / Export Map Data`
- 点击页面外部或按 `Escape` 会关闭菜单。
- 复制、导入和应用 JSON 继续留在左侧 JSON 区，它们不是导出功能。

### 响应式布局

- 桌面使用左侧工具栏和右侧画布。
- 900px 以下改为上下布局。
- 560px 以下地块列表改为单列，顶部工具栏不会横向溢出。

## 4. 地图 JSON 契约

当前格式版本为 2：

```json
{
  "version": 2,
  "format": "zizi-operation-typhoon-map",
  "ruleset": "operation-typhoon-v1",
  "terrainSheet": "battle-for-moscow/assets/terrain.png",
  "grid": {
    "cols": 14,
    "rows": 11,
    "orientation": "flat",
    "offset": 1
  },
  "hexes": [
    {
      "x": 0,
      "y": 0,
      "visual": "major-city",
      "terrain": "open",
      "city": "major",
      "river": ["N", "NE"]
    }
  ]
}
```

关键设计：

- `visual` 负责显示。
- `terrain`、`city`、`river` 负责游戏语义。
- 视觉与规则必须分离。未来莫斯科和图拉可以使用不同视觉，但共享大城市战斗规则。
- 新地图必须声明统一规则集 `operation-typhoon-v1`，不能让每张地图任意修改规则。
- 版本 1 的 `tiles` 矩阵仍可导入。
- 旧版整格 `river` 会迁移为开阔地加 `N / NE / SE` 三条河流边。

## 5. 已实现规则

规则集中在 `assets/operation-typhoon-map.js`：

- `Open`
  - 移动消耗 1。
  - 无战斗修正。
- `Forest`
  - 普通移动消耗 2。
  - 俄军铁路移动消耗 1。
  - 战斗赔率左移一栏。
- `City`
  - 移动消耗 1。
  - 无战斗修正。
- `Major City`
  - 移动消耗 1。
  - 战斗赔率左移一栏。
  - 守军撤退结果改为损失一个步骤。
- `River`
  - 不影响移动。
  - 只有所有攻击单位都跨越守方对应河流边时，战斗赔率左移一栏。

公开函数：

```js
OperationTyphoonMap.createMap(cols, rows)
OperationTyphoonMap.normalizeMap(document)
OperationTyphoonMap.neighborOf(x, y, direction)
OperationTyphoonMap.getMovementCost(hex, context)
OperationTyphoonMap.getCombatEffects(defenderHex, attackDirections, defenderArmy)
```

`Fortification`、`Railroad`、`Setup` 目前只保留视觉，在界面中标记 `规则待实现 / Rules pending`，导出时暂按开阔地语义处理。

## 6. 台风行动现有实现

台风行动位于 `battle-for-moscow/`，当前仍使用硬编码地图：

- 引擎脚本：`battle-for-moscow/js/b4m.min.js`
- 六边形库：`battle-for-moscow/js/honeycomb.min.js`
- 原地图大小：`14 x 11`
- 原地图格子已经使用 `terrain`、`city`、`river` 方向数组。
- 原战斗判定已经能识别森林、大城市和“全部攻击者跨河”。

不要直接编辑压缩脚本来接地图。后续应先设计一个加载适配层：读取版本 2 JSON，验证 `ruleset`，再建立 Honeycomb grid，并保留现有单位、回合、胜利条件与地图外格规则。

## 7. 更新日志状态

`updates.html` 已添加：

- `2026-06-10`
- `兵棋地图生成器 / Wargame Map Generator`
- 内容：新增兵棋地图生成器。

只添加了这一条，没有改动其他日志。

## 8. 验证方法

### JavaScript 语法

```powershell
node --check C:\Users\ZI\Documents\Code\ZIzi_Game\assets\operation-typhoon-map.js
```

地图生成器是单文件内嵌脚本，可提取 `<script>` 内容并交给 `new Function(...)` 检查语法。

### 必测行为

- 首次打开时为 14 x 11 全开阔地。
- Forest 导出 `terrain: "forest"`。
- Major City 导出 `city: "major"`。
- 河流共享边在两格中生成相反方向。
- 河流绘制、擦除、撤销、重做都同步 JSON。
- 缩小地图会移除越界河流，撤销会恢复尺寸和河流。
- 清空会同时清除地块与河流。
- 版本 1 JSON 能迁移为版本 2。
- PNG 和地图 JSON 都能下载。
- 导出菜单有展开动画，点外部和按 Escape 可以关闭。
- 430px 手机宽度下没有横向溢出。

### Git 范围

提交前运行：

```powershell
git -C C:\Users\ZI\Documents\Code\ZIzi_Game diff --check
git -C C:\Users\ZI\Documents\Code\ZIzi_Game status --short --branch
```

用户通常要求直接推送 `main`，并明确表示不需要轮询 GitHub Pages 渲染状态。每次仍应以用户最新要求为准。

## 9. 后续建议

合理的后续顺序：

1. 为地图添加名称、作者、说明和稳定 ID。
2. 实现城市视觉变体，例如 Moscow、Tula，同时保持共享规则。
3. 将铁路改成类似河流的边/连接工具，并实现俄军铁路移动。
4. 实现筑垒战斗规则和部署区域数据。
5. 为台风行动增加地图加载适配层，而不是替换或复制整个游戏。
6. 增加地图选择界面，让同一台风行动引擎运行多张地图。

## 10. 给新账号的开场提示

可以把下面这段直接发给新的账号：

> 请继续开发本地仓库 `C:\Users\ZI\Documents\Code\ZIzi_Game` 的兵棋地图生成器。先完整阅读仓库根目录的 `MAP_GENERATOR_HANDOFF.md`，然后检查 `git status`、最近提交、`map-generator/index.html` 和 `assets/operation-typhoon-map.js` 的当前内容。不要修改台风行动游戏加载逻辑，除非我明确要求。保持所有用户界面中文/英文双语，保持地块无缝拼接，并且只提交本次任务明确涉及的文件。
