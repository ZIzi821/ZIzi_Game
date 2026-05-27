# Pacman Odyssey: Neon Expedition

一个从吃豆人出发、扩展成多目标霓虹迷宫远征的 Pygame 游戏。

## 新玩法

- 4 个关卡，每关胜利条件不同。
- 冲刺技能：`Space` 触发，有冷却，适合穿过危险窗口。
- 能量豆：短时间反吃幽灵，连吃会提高得分。
- 护盾：抵挡一次幽灵或陷阱伤害。
- 水晶门、反应堆核心、传送门、陷阱和 Boss 巡逻场。
- 设置界面可切换 `玩家音乐` / `枫叶人音乐`，默认是玩家音乐。

## 操作

- 移动：方向键或 `WASD`
- 冲刺：`Space`
- 暂停/返回：`Esc`
- 选关：主菜单进入后点击关卡，或按数字键 `1-4`

## Windows 运行

源码运行：

```bat
python main.py
```

无命令行窗口运行：

```bat
START_GAME.bat
```

打包成朋友无需安装依赖的 exe：

```bat
build_windows.bat
```

生成结果会放在 `C:\Users\ZI\Documents\Code\PacmanGame_For_Friends.exe`。

## Mac 运行

Mac 上安装 Python 3 后，在项目目录执行：

```bash
python3 -m pip install -r requirements.txt
python3 main.py
```

也可以执行：

```bash
chmod +x run_game.command
./run_game.command
```

## Mac 打包

Mac 应用需要在 Mac 机器上打包：

```bash
python3 -m pip install -r requirements.txt pyinstaller
chmod +x build_macos.sh
./build_macos.sh
```

结果会生成在项目的 `dist/` 目录。
