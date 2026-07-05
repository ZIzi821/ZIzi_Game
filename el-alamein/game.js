(function () {
  "use strict";

  const SAVE_KEY = "zizi-el-alamein-save-v2";
  const LEGACY_SAVE_KEY = "zizi-el-alamein-save-v1";
  const CHECKPOINT_KEY = "zizi-el-alamein-turn-checkpoint-v1";
  const SESSION_KEY = "zizi-el-alamein-current-session-v1";
  const LANG_KEY = "zizi-el-alamein-lang";
  const OPPOSITE_SIDE = { axis: "allied", allied: "axis" };
  const HIGHLIGHT = {
    selected: "rgba(0, 166, 166, 0.56)",
    reachable: "rgba(34, 124, 118, 0.34)",
    attack: "rgba(168, 72, 50, 0.40)",
    defender: "rgba(178, 49, 49, 0.60)",
    declaredAttack: "rgba(34, 124, 118, 0.22)",
    declaredDefender: "rgba(168, 72, 50, 0.32)",
    currentAttack: "rgba(0, 166, 166, 0.52)",
    currentDefender: "rgba(178, 49, 49, 0.58)",
    retreat: "rgba(236, 167, 42, 0.46)",
  };

  const UNIT_EN = {
    u01: "1st South African Division, 1st Infantry Brigade",
    u02: "1st South African Division, 2nd Infantry Brigade",
    u03: "1st South African Division, 3rd Infantry Brigade",
    u04: "44th Division, 131st Infantry Brigade",
    u05: "44th Division, 132nd Infantry Brigade",
    u06: "44th Division, 133rd Infantry Brigade",
    u07: "9th Australian Division, 22nd Infantry Brigade",
    u08: "9th Australian Division, 24th Infantry Brigade",
    u09: "9th Australian Division, 26th Infantry Brigade",
    u10: "5th Indian Division, 5th Infantry Brigade",
    u11: "5th Indian Division, 9th Infantry Brigade",
    u12: "2nd New Zealand Division, 5th Infantry Brigade",
    u13: "2nd New Zealand Division, 6th Infantry Brigade",
    u14: "7th Armoured Division, 4th Armoured Brigade",
    u15: "7th Armoured Division, 7th Armoured Brigade",
    u16: "7th Armoured Division, Motor Brigade",
    u17: "8th Armoured Division, 23rd Armoured Brigade",
    u18: "10th Armoured Division, 8th Armoured Brigade",
    u19: "22nd Armoured Brigade",
    u20: "164th Division, 382nd Infantry Regiment",
    u21: "164th Division, 125th Infantry Regiment",
    u22: "164th Division, 433rd Infantry Regiment",
    u23: "15th Panzer Division, 115th Panzergrenadier Regiment",
    u24: "15th Panzer Division, 8th Panzer Regiment",
    u25: "21st Panzer Division, 5th Panzer Regiment",
    u26: "21st Panzer Division, 104th Panzergrenadier Regiment",
    u27: "21st Panzer Division, 200th Panzergrenadier Regiment",
    u28: "90th Light Division, 155th Panzergrenadier Regiment",
    u29: "90th Light Division, 361st Panzergrenadier Regiment",
    u30: "Ramcke Parachute Brigade",
    u31: "Pavia Infantry Division",
    u32: "Brescia Infantry Division",
    u33: "Trento Infantry Division",
    u34: "Bologna Infantry Division",
    u35: "Folgore Parachute Division",
    u36: "Littorio Armoured Division",
    u37: "Ariete Armoured Division",
    u38: "Trieste Motorised Division",
    u39: "161st Indian Motor Brigade",
  };

  const I18N = {
    zh: {
      app: { title: "阿拉曼战役" },
      menu: {
        eyebrow: "北非战役",
        copy: "北非战场上轴心国军队在埃及、叙利亚地区主动发起的最后一次大规模攻势，计划在同盟国增援到来而导致轴心国无法在非洲获得胜利之前借由这次战役击败英国第八集团军。",
        start: "开始战役",
        continue: "继续本回合",
        load: "读取存档",
        noSave: "没有可读取的存档。",
        noCheckpoint: "没有回合开始检查点。",
        loaded: "已读取存档。",
        continued: "已回到本回合开始。",
      },
      ui: {
        eyebrow: "本地热座兵棋",
        menu: "主菜单",
        new: "新战役",
        save: "保存",
        load: "读取",
        charts: "表格",
        aar: "战报",
        finishDeclarations: "完成宣告",
        resolveBattle: "结算下一战斗",
        done: "战斗结束",
        endPhase: "结束阶段",
        selectedUnit: "选中单位",
        combat: "战斗",
        operationsKicker: "Operations Board",
        operations: "战情板",
        log: "记录",
        openLog: "打开",
        closeLog: "收起",
        noSelection: "未选择单位",
      },
      charts: { crt: "战斗结果表", tec: "地形效果表", turn: "回合记录表" },
      aar: {
        eyebrow: "战后报告",
        returnMap: "返回地图",
        menu: "主菜单",
        title: "{side}胜利",
        pendingTitle: "战役进行中",
        subtitle: "第 {turn} 回合 · {reason}",
        losses: "损失统计",
        eliminated: "被歼灭单位",
        battles: "战斗记录",
        noEliminated: "尚无单位被歼灭。",
      },
      side: { axis: "轴心国", allied: "英军" },
      nationality: { german: "德军", italian: "意军", "british-commonwealth": "英联邦" },
      phase: {
        "axis-move": "轴心国移动阶段",
        "axis-combat": "轴心国战斗阶段",
        "allied-move": "英军移动阶段",
        "allied-combat": "英军战斗阶段",
      },
      terrain: {
        desert: "沙漠",
        highland: "高地",
        settlement: "集落",
        coast: "海岸",
        mediterranean: "地中海",
        britishPosition: "英军阵地",
      },
      text: {
        ready: "可行动",
        disrupted: "混乱",
        attack: "攻击",
        defense: "防御",
        odds: "赔率",
        die: "骰点",
        result: "结果",
        defenderHex: "守方格",
        attackerHexes: "攻击格",
        selectedDefender: "守方",
        selectedAttackers: "攻方",
        addBattle: "加入战斗",
        clear: "清除",
        noDeclared: "尚未宣告战斗。",
        declaredCount: "已宣告 {count} 场战斗。",
        phaseOrders: "阶段命令",
        currentBattle: "当前战斗",
        retreatPrompt: "{unit} 撤退：选择下一格",
        advancePrompt: "战后推进：点击参战单位进入 {hex}",
        skip: "跳过",
        undoMove: "取消移动",
        saved: "局面已保存。",
        loaded: "已读取存档。",
        noSave: "没有找到本地存档。",
        badSave: "存档无法读取。",
        newGame: "战役已开始。",
        noLegalAttackers: "该守军周围没有可参战单位。",
        battleCancelled: "已取消当前宣告。",
        battleDeclared: "宣告战斗：{attackers} 攻击 {defender}。",
        declarationsComplete: "宣告完成，进入战斗结算。",
        combatComplete: "所有宣告战斗已经结算完毕。",
        battleSkipped: "跳过一场已失效的战斗。",
        moved: "{unit} 移动到 {hex}，剩余移动力 {mp}。",
        undoMoved: "{unit} 取消移动，回到 {hex}。",
        cannotMove: "{unit} 不能移动。",
        alreadyMoved: "{unit} 本阶段已经移动。",
        targetOccupied: "目标格已有单位。",
        retreatNeeded: "{unit} 需要撤退 {steps} 格。",
        retreated: "{unit} 撤退到 {hex}。",
        retreatExtra: "{unit} 终点被友军占据，必须继续撤退 1 格。",
        eliminated: "{unit}被歼灭了！",
        advance: "{unit} 战后推进到 {hex}。",
        recover: "{unit} 从混乱中恢复。",
        enterPhase: "进入{phase}。",
        turnStart: "进入第 {turn} 回合。",
        checkpoint: "已保存本回合开始检查点。",
        noBattle: "本阶段没有宣告战斗。",
        allDone: "宣告战斗已经全部结算。",
        pendingCombat: "仍有宣告战斗未结算。",
        exitWin: "{unit} 突破德军战线。",
        fourTurnWin: "4 回合结束，轴心国未达成胜利。",
        ridgeWin: "{unit} 占领阿拉姆哈勒法岭目标阵地。",
        roadWin: "{unit} 占领阿拉曼以东沿海道路。",
      },
      result: {
        AE: "攻方歼灭",
        AR: "攻方撤退 1 格",
        DE: "守方歼灭",
        DR: "守方撤退 {steps} 格",
        Skipped: "失效",
      },
    },
    en: {
      app: { title: "El Alamein" },
      menu: {
        eyebrow: "North African Campaign",
        copy: "The final major Axis offensive launched from the North African theatre toward Egypt and Syria, intended to defeat the Eighth Army before Allied reinforcement made victory in Africa unattainable.",
        start: "Start Campaign",
        continue: "Continue Turn",
        load: "Load Save",
        noSave: "No saved game found.",
        noCheckpoint: "No turn-start checkpoint found.",
        loaded: "Saved game loaded.",
        continued: "Returned to the start of this turn.",
      },
      ui: {
        eyebrow: "Local Hotseat Wargame",
        menu: "Main Menu",
        new: "New Campaign",
        save: "Save",
        load: "Load",
        charts: "Charts",
        aar: "Report",
        finishDeclarations: "Finish Declarations",
        resolveBattle: "Resolve Next Combat",
        done: "Combat Complete",
        endPhase: "End Phase",
        selectedUnit: "Selected Unit",
        combat: "Combat",
        operationsKicker: "Operations Board",
        operations: "Operations Board",
        log: "Log",
        openLog: "Open",
        closeLog: "Close",
        noSelection: "No unit selected",
      },
      charts: { crt: "Combat Results Table", tec: "Terrain Effects Chart", turn: "Turn Record Track" },
      aar: {
        eyebrow: "After Action Report",
        returnMap: "Return to Map",
        menu: "Main Menu",
        title: "{side} Victory",
        pendingTitle: "Campaign in Progress",
        subtitle: "Turn {turn} · {reason}",
        losses: "Losses",
        eliminated: "Eliminated Units",
        battles: "Combat Record",
        noEliminated: "No units have been eliminated.",
      },
      side: { axis: "Axis", allied: "Allied" },
      nationality: { german: "German", italian: "Italian", "british-commonwealth": "British Commonwealth" },
      phase: {
        "axis-move": "Axis Movement Phase",
        "axis-combat": "Axis Combat Phase",
        "allied-move": "Allied Movement Phase",
        "allied-combat": "Allied Combat Phase",
      },
      terrain: {
        desert: "Desert",
        highland: "High Ground",
        settlement: "Settlement",
        coast: "Coast",
        mediterranean: "Mediterranean",
        britishPosition: "British Position",
      },
      text: {
        ready: "Ready",
        disrupted: "Disrupted",
        attack: "Attack",
        defense: "Defense",
        odds: "Odds",
        die: "Die",
        result: "Result",
        defenderHex: "Defender Hex",
        attackerHexes: "Attacker Hexes",
        selectedDefender: "Defender",
        selectedAttackers: "Attackers",
        addBattle: "Add Combat",
        clear: "Clear",
        noDeclared: "No combats declared.",
        declaredCount: "{count} combats declared.",
        phaseOrders: "Phase Orders",
        currentBattle: "Current Combat",
        retreatPrompt: "{unit} retreats: choose next hex",
        advancePrompt: "Advance after combat: click an attacking unit to enter {hex}",
        skip: "Skip",
        undoMove: "Undo Move",
        saved: "Game saved.",
        loaded: "Saved game loaded.",
        noSave: "No local save found.",
        badSave: "Save could not be loaded.",
        newGame: "Campaign started.",
        noLegalAttackers: "No eligible attacking units are adjacent to that defender.",
        battleCancelled: "Current declaration cancelled.",
        battleDeclared: "Declared combat: {attackers} attack {defender}.",
        declarationsComplete: "Declarations complete. Resolving combat.",
        combatComplete: "All declared combats have been resolved.",
        battleSkipped: "Skipped an invalid combat.",
        moved: "{unit} moved to {hex}, {mp} MP remaining.",
        undoMoved: "{unit} undid movement and returned to {hex}.",
        cannotMove: "{unit} cannot move.",
        alreadyMoved: "{unit} has already moved this phase.",
        targetOccupied: "The destination hex is occupied.",
        retreatNeeded: "{unit} must retreat {steps} hexes.",
        retreated: "{unit} retreated to {hex}.",
        retreatExtra: "{unit} ended on a friendly unit and must retreat 1 more hex.",
        eliminated: "{unit} was eliminated!",
        advance: "{unit} advanced after combat to {hex}.",
        recover: "{unit} recovered from disruption.",
        enterPhase: "Entered {phase}.",
        turnStart: "Turn {turn} begins.",
        checkpoint: "Turn-start checkpoint saved.",
        noBattle: "No combats were declared this phase.",
        allDone: "All declared combats are resolved.",
        pendingCombat: "Declared combats remain unresolved.",
        exitWin: "{unit} broke through the German line.",
        fourTurnWin: "Four turns ended without an Axis victory.",
        ridgeWin: "{unit} occupied an Alam Halfa Ridge objective position.",
        roadWin: "{unit} occupied the coastal road east of El Alamein.",
      },
      result: {
        AE: "Attacker Eliminated",
        AR: "Attacker Retreat 1 Hex",
        DE: "Defender Eliminated",
        DR: "Defender Retreat {steps} Hexes",
        Skipped: "Invalid",
      },
    },
  };

  Object.assign(I18N.zh.menu, {
    copy: "北非战场上轴心国军队在埃及、叙利亚地区主动发起的最后一次大规模攻势，计划在同盟国增援到来而导致轴心国无法在非洲获得胜利之前借由这次战役击败英国第八集团军。",
    continue: "继续游戏",
    continued: "已回到上次离开的局面。",
    noCheckpoint: "没有可继续的局面。",
  });
  Object.assign(I18N.en.menu, {
    copy: "The final major Axis offensive launched from the North African theatre toward Egypt and Syria, intended to defeat the Eighth Army before Allied reinforcement made victory in Africa unattainable.",
    continue: "Continue Game",
    continued: "Returned to the last saved position.",
    noCheckpoint: "No campaign position is available.",
  });
  Object.assign(I18N.zh.text, {
    currentDeclaration: "正在宣告",
    declaredBattles: "已宣告战斗",
    declareInOperations: "在战情板中选择守方和参战部队。",
    chooseDefender: "选择一支相邻有可参战单位的敌军。",
    cancel: "取消",
    defenderOnly: "受攻击地块",
    compactStatus: "阶段",
    noDeclared: "尚未宣告战斗。",
    retreatPrompt: "{unit} 撤退：选择最终撤退格",
    finalRetreat: "最终撤退格",
    combatSummary: "战斗结算",
    lossReport: "战损统计",
    initialStrength: "开局总战力",
    currentStrength: "当前总战力",
    eliminatedUnits: "被歼灭单位",
    lostStrength: "损失战力",
    eliminatedTarget: "歼灭",
    victoryImpact: "胜利宣言",
    objectives: "胜利条件",
    ridgeObjectives: "阿拉姆哈勒法岭",
    coastalRoadObjectives: "沿海道路",
    showBattleRecord: "展开战斗记录",
    hideBattleRecord: "收起战斗记录",
    axisImpact: "隆美尔和他的战士们将继续追歼残敌，在中东完成与南方面军的伟大会师！",
    alliedImpactPrefix: "",
    alliedImpactLink: "轴心军攻占苏伊士运河地区的最后希望破灭了",
    alliedImpactSuffix: "，英国第八集团军由此稳住埃及防线，并为随后转入反攻奠定基础。",
    axisFailedTitle: "德军并未实现其既定目标",
    axisFailedText: "这是蒙哥马利赢得了其接手第八集团军以来的第一场胜利，英军正从隆美尔的神话和战败的阴影中脱离。",
    alliedBreakthroughTitle: "德军的战线被突破了！",
    alliedBreakthroughText: "战争的主动权来到了我们手里，而强大的第八集团军将把非洲军团歼灭于非洲的土地上。",
  });
  Object.assign(I18N.en.text, {
    currentDeclaration: "Current Declaration",
    declaredBattles: "Declared Combats",
    declareInOperations: "Select the defender and eligible attacking units on the operations board.",
    chooseDefender: "Select an enemy unit with adjacent eligible attackers.",
    cancel: "Cancel",
    defenderOnly: "Defender Hex",
    compactStatus: "Phase",
    noDeclared: "No combats have been declared.",
    retreatPrompt: "{unit} retreat: choose final retreat hex",
    finalRetreat: "Final Retreat Hex",
    combatSummary: "Combat Resolution",
    lossReport: "Loss Report",
    initialStrength: "Initial Combat Strength",
    currentStrength: "Current Combat Strength",
    eliminatedUnits: "Eliminated Units",
    lostStrength: "Combat Strength Lost",
    eliminatedTarget: "Eliminated",
    victoryImpact: "Operational Impact",
    objectives: "Victory Conditions",
    ridgeObjectives: "Alam Halfa Ridge",
    coastalRoadObjectives: "Coastal Road",
    showBattleRecord: "Expand Combat Record",
    hideBattleRecord: "Collapse Combat Record",
    axisImpact: "Rommel and his soldiers will continue the pursuit and complete the great junction with the southern army group in the Middle East.",
    alliedImpactPrefix: "",
    alliedImpactLink: "the Axis army's final hope of seizing the Suez Canal region collapsed",
    alliedImpactSuffix: ", securing the Eighth Army's line in Egypt and opening the way to the counteroffensive.",
    axisFailedTitle: "The Germans did not achieve their stated objective",
    axisFailedText: "This was Montgomery's first victory since taking command of the Eighth Army, and the British Army began to emerge from the shadow of Rommel's legend and earlier defeats.",
    alliedBreakthroughTitle: "The German line has been broken!",
    alliedBreakthroughText: "The initiative has passed to us, and the powerful Eighth Army will destroy the Afrika Korps on African soil.",
  });
  Object.assign(I18N.zh.aar, {
    losses: "战损统计",
    battles: "战斗记录",
  });
  Object.assign(I18N.en.aar, {
    losses: "Loss Report",
    battles: "Combat Record",
  });

  Object.assign(I18N.zh.text, {
    combatSummary: "战斗结算",
    combatInstruction: "执行提示",
    advanceInstruction: "战后推进",
    retreatInstruction: "撤退执行",
    objectives: "胜利条件",
    ridgeObjectives: "阿拉姆哈勒法岭",
    coastalRoadObjectives: "沿海道路",
    ridgeNone: "未占领",
    ridgeKey: "占领重要据点",
    ridgeFull: "完全占领",
    roadOpen: "未切断",
    roadCut: "被切断",
    roadElAlamein: "占领了阿拉曼",
    roadElAlameinCut: "占领了阿拉曼并切断",
    roadCutTitle: "同盟国的沿海道路被切断",
    roadCutText: "英国第八集团军的士气会比他们的淡水先耗尽",
    roadElAlameinTitle: "非洲军团征服阿拉曼",
    roadElAlameinText: "隆美尔打开了通往亚历山大港的大门",
    ridgeControlTitle: "非洲军团控制阿拉姆哈勒法岭",
    ridgeControlText: "在一览无余的沙漠上英军失去了南翼防线最重要的支撑点",
    ridgeFullTitle: "非洲军团完全控制阿拉姆哈勒法岭",
    ridgeFullText: "在一览无余的沙漠上我们拿下了这个英军南翼防线最重要的支撑点",
    noObjectiveReached: "尚未达成胜利条件。",
    casualtyReport: "战力与歼灭单位",
    germanGroup: "德军",
    italianGroup: "意大利军",
    commonwealthGroup: "英联邦",
    mechanizedTag: "机械化",
    nonMechanizedTag: "非机械化",
    noEliminated: "无被歼灭单位",
    axisImpact: "隆美尔和他的战士们将继续追歼残敌，在中东完成与南方面军的伟大会师！",
  });
  Object.assign(I18N.en.text, {
    combatSummary: "Combat Resolution",
    combatInstruction: "Execution Note",
    advanceInstruction: "Advance After Combat",
    retreatInstruction: "Retreat Execution",
    objectives: "Victory Conditions",
    ridgeObjectives: "Alam Halfa Ridge",
    coastalRoadObjectives: "Coastal Road",
    ridgeNone: "Not occupied",
    ridgeKey: "Key position occupied",
    ridgeFull: "Fully occupied",
    roadOpen: "Not cut",
    roadCut: "Cut",
    roadElAlamein: "El Alamein occupied",
    roadElAlameinCut: "El Alamein occupied and road cut",
    roadCutTitle: "Allied coastal road cut",
    roadCutText: "The Eighth Army's morale will run out before its fresh water.",
    roadElAlameinTitle: "Afrika Korps conquers El Alamein",
    roadElAlameinText: "Rommel has opened the road to Alexandria.",
    ridgeControlTitle: "Afrika Korps controls Alam Halfa Ridge",
    ridgeControlText: "On the open desert, the British have lost the key support of their southern flank.",
    ridgeFullTitle: "Afrika Korps fully controls Alam Halfa Ridge",
    ridgeFullText: "Across the open desert, the key support of the British southern flank is ours.",
    noObjectiveReached: "No victory condition has been achieved.",
    casualtyReport: "Losses and Eliminated Units",
    germanGroup: "German",
    italianGroup: "Italian",
    commonwealthGroup: "Commonwealth",
    mechanizedTag: "Mechanized",
    nonMechanizedTag: "Non-mechanized",
    noEliminated: "No eliminated units",
  });
  Object.assign(I18N.zh.aar, {
    losses: "战力与歼灭单位",
    eliminated: "战力与歼灭单位",
  });
  Object.assign(I18N.en.aar, {
    losses: "Losses and Eliminated Units",
    eliminated: "Losses and Eliminated Units",
  });

  const el = {
    body: document.body,
    menuView: document.getElementById("menuView"),
    gameView: document.getElementById("gameView"),
    aarView: document.getElementById("aarView"),
    menuStatus: document.getElementById("menuStatus"),
    langZhButton: document.getElementById("langZhButton"),
    langEnButton: document.getElementById("langEnButton"),
    startCampaignButton: document.getElementById("startCampaignButton"),
    continueCampaignButton: document.getElementById("continueCampaignButton"),
    menuLoadButton: document.getElementById("menuLoadButton"),
    mapImage: document.getElementById("mapImage"),
    hexLayer: document.getElementById("hexLayer"),
    unitLayer: document.getElementById("unitLayer"),
    boardSurface: document.getElementById("boardSurface"),
    boardViewport: document.getElementById("boardViewport"),
    boardBadge: document.getElementById("boardBadge"),
    turnLabel: document.getElementById("turnLabel"),
    phaseLabel: document.getElementById("phaseLabel"),
    selectedUnit: document.getElementById("selectedUnit"),
    combatComposer: document.getElementById("combatComposer"),
    battleList: document.getElementById("battleList"),
    operationsFocus: document.getElementById("operationsFocus"),
    logBlock: document.getElementById("logBlock"),
    logToggleButton: document.getElementById("logToggleButton"),
    logList: document.getElementById("logList"),
    winnerBanner: document.getElementById("winnerBanner"),
    finishDeclarationsButton: document.getElementById("finishDeclarationsButton"),
    resolveBattleButton: document.getElementById("resolveBattleButton"),
    endPhaseButton: document.getElementById("endPhaseButton"),
    menuButton: document.getElementById("menuButton"),
    newGameButton: document.getElementById("newGameButton"),
    saveButton: document.getElementById("saveButton"),
    loadButton: document.getElementById("loadButton"),
    chartsButton: document.getElementById("chartsButton"),
    aarButton: document.getElementById("aarButton"),
    returnMapButton: document.getElementById("returnMapButton"),
    aarMenuButton: document.getElementById("aarMenuButton"),
    aarTitle: document.getElementById("aarTitle"),
    aarSubtitle: document.getElementById("aarSubtitle"),
    aarSummary: document.getElementById("aarSummary"),
    aarLosses: document.getElementById("aarLosses"),
    aarEliminated: document.getElementById("aarEliminated"),
    aarBattles: document.getElementById("aarBattles"),
    chartsDialog: document.getElementById("chartsDialog"),
    crtImage: document.getElementById("crtImage"),
    tecImage: document.getElementById("tecImage"),
    turnTrackImage: document.getElementById("turnTrackImage"),
    missingDataTemplate: document.getElementById("missingDataTemplate"),
  };

  const app = {
    scenario: null,
    rules: null,
    hexes: [],
    hexById: new Map(),
    state: null,
    lang: localStorage.getItem(LANG_KEY) || "zh",
    reachable: new Map(),
    legalRetreats: new Set(),
    legalRetreatSteps: new Set(),
    retreatPaths: new Map(),
    animating: false,
    logExpanded: false,
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function tr(key, params = {}) {
    const table = I18N[app.lang] || I18N.zh;
    const value = key.split(".").reduce((node, part) => node?.[part], table) ?? key;
    return String(value).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
  }

  function phase() {
    return app.rules.phases[app.state.phaseIndex];
  }

  function activeSide() {
    return phase().side;
  }

  function enemySide(side) {
    return OPPOSITE_SIDE[side];
  }

  function unitById(id) {
    return app.state.units.find((unit) => unit.id === id);
  }

  function hexById(id) {
    return app.hexById.get(id);
  }

  function terrainRule(hex) {
    return app.rules.terrain[hex?.terrain] || app.rules.terrain.desert;
  }

  function liveUnits() {
    return app.state.units.filter((unit) => !unit.eliminated);
  }

  function liveUnitsAt(hexId) {
    return liveUnits().filter((unit) => unit.hexId === hexId);
  }

  function liveUnitAt(hexId) {
    return liveUnitsAt(hexId)[0] || null;
  }

  function isCombatPhase() {
    return phase().type === "combat";
  }

  function isMovementPhase() {
    return phase().type === "movement";
  }

  function sideLabel(side) {
    return tr(`side.${side}`);
  }

  function nationalityLabel(nationality) {
    return tr(`nationality.${nationality}`);
  }

  function phaseLabel(id) {
    return tr(`phase.${id}`);
  }

  function unitName(unit) {
    if (!unit) return "--";
    return app.lang === "en" ? (UNIT_EN[unit.id] || unit.name) : unit.name;
  }

  function hexLabel(hexId) {
    const hex = hexById(hexId);
    if (!hex) return "--";
    const row = String(hex.row + 2).padStart(2, "0");
    const col = String(hex.col + 3).padStart(2, "0");
    return `${row}${col}`;
  }

  function log(message) {
    app.state.log.push(`[T${app.state.turn}] ${message}`);
    if (app.state.log.length > 180) app.state.log.shift();
  }

  function makeStats() {
    return {
      axis: { units: 0, combat: 0 },
      allied: { units: 0, combat: 0 },
    };
  }

  function totalStrengthBySide(units) {
    return units.reduce((totals, unit) => {
      if (!unit.eliminated) totals[unit.side] += Number(unit.combat || 0);
      return totals;
    }, { axis: 0, allied: 0 });
  }

  function makeInitialState() {
    const units = clone(app.scenario.units);
    return {
      version: 2,
      turn: 1,
      phaseIndex: 0,
      selectedUnitId: null,
      selectedDefenderId: null,
      selectedAttackers: [],
      combatMode: "declare",
      declaredCombats: [],
      combatCompleteNotified: false,
      movedUnits: [],
      usedAttackers: [],
      usedDefenders: [],
      lastMove: null,
      retreatTask: null,
      advanceTask: null,
      lastCombatResult: null,
      battleReports: [],
      eliminatedUnitIds: [],
      losses: makeStats(),
      initialStrength: totalStrengthBySide(units),
      log: [tr("text.newGame")],
      winner: null,
      units,
    };
  }

  function normalizeState(state, options = {}) {
    if (!state || !Array.isArray(state.units)) throw new Error("Bad state");
    const preserveTransient = Boolean(options.preserveTransient);
    state.version = 2;
    state.selectedAttackers ||= [];
    state.declaredCombats ||= [];
    state.movedUnits ||= [];
    state.usedAttackers ||= [];
    state.usedDefenders ||= [];
    state.log ||= [];
    state.combatMode ||= "declare";
    state.battleReports ||= [];
    state.eliminatedUnitIds ||= [];
    state.losses ||= makeStats();
    state.initialStrength ||= totalStrengthBySide(app.scenario?.units || state.units);
    state.lastCombatResult ||= null;
    if (!preserveTransient) {
      state.selectedUnitId = null;
      state.selectedDefenderId = null;
      state.selectedAttackers = [];
      state.lastMove = null;
      state.retreatTask = null;
      state.advanceTask = null;
    } else {
      state.selectedUnitId ||= null;
      state.selectedDefenderId ||= null;
      state.lastMove ||= null;
      state.retreatTask ||= null;
      state.advanceTask ||= null;
    }
    return state;
  }

  async function init() {
    try {
      const [scenario, rules] = await Promise.all([
        fetchJson("local-data/scenario.json"),
        fetchJson("local-data/rules.json"),
      ]);
      app.scenario = scenario;
      app.rules = rules;
      app.hexes = scenario.board.hexes;
      app.hexById = new Map(app.hexes.map((hex) => [hex.id, hex]));
      app.state = makeInitialState();
      wireUi();
      loadImages();
      applyLanguage();
      updateMenu();
      draw();
    } catch (error) {
      showMissingData(error);
    }
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json();
  }

  function showMissingData(error) {
    console.error(error);
    el.body.replaceChildren(el.missingDataTemplate.content.cloneNode(true));
  }

  function loadImages() {
    el.mapImage.src = app.scenario.board.image;
    el.crtImage.src = app.scenario.charts.crtImage;
    el.tecImage.src = app.scenario.charts.terrainImage;
    el.turnTrackImage.src = app.scenario.charts.turnTrackImage;
  }

  function wireUi() {
    el.boardSurface.addEventListener("click", onBoardClick);
    el.langZhButton.addEventListener("click", () => setLanguage("zh"));
    el.langEnButton.addEventListener("click", () => setLanguage("en"));
    el.startCampaignButton.addEventListener("click", startNewCampaign);
    el.continueCampaignButton.addEventListener("click", continueCampaign);
    el.menuLoadButton.addEventListener("click", () => loadGame({ fromMenu: true }));
    el.menuButton.addEventListener("click", showMenu);
    el.newGameButton.addEventListener("click", startNewCampaign);
    el.saveButton.addEventListener("click", saveGame);
    el.loadButton.addEventListener("click", () => loadGame({ fromMenu: false }));
    el.chartsButton.addEventListener("click", () => el.chartsDialog.showModal());
    el.aarButton.addEventListener("click", () => openAar(false));
    el.returnMapButton.addEventListener("click", showGame);
    el.aarMenuButton.addEventListener("click", showMenu);
    el.endPhaseButton.addEventListener("click", endPhase);
    el.finishDeclarationsButton.addEventListener("click", finishDeclarations);
    el.resolveBattleButton.addEventListener("click", resolveNextBattle);
    el.logToggleButton.addEventListener("click", () => {
      app.logExpanded = !app.logExpanded;
      drawLog();
    });
  }

  function setLanguage(lang) {
    app.lang = lang === "en" ? "en" : "zh";
    localStorage.setItem(LANG_KEY, app.lang);
    applyLanguage();
    updateMenu();
    draw();
    if (!el.aarView.hidden) renderAar();
  }

  function applyLanguage() {
    document.documentElement.lang = app.lang === "en" ? "en" : "zh-CN";
    el.body.dataset.lang = app.lang;
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = tr(node.dataset.i18n);
    });
    el.langZhButton.dataset.active = String(app.lang === "zh");
    el.langEnButton.dataset.active = String(app.lang === "en");
  }

  function setMenuStatus(text = "") {
    el.menuStatus.textContent = text;
  }

  function updateMenu() {
    el.continueCampaignButton.disabled = !(localStorage.getItem(SESSION_KEY) || localStorage.getItem(CHECKPOINT_KEY));
    el.menuLoadButton.disabled = !(localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY));
  }

  function setView(view) {
    el.body.dataset.view = view;
    el.aarView.hidden = view !== "aar";
    if (view === "game") window.setTimeout(centerOnOpeningFront, 30);
  }

  function showMenu() {
    saveSessionState();
    setView("menu");
    updateMenu();
  }

  function showGame() {
    setView("game");
    draw();
  }

  function startNewCampaign() {
    localStorage.removeItem(SESSION_KEY);
    app.state = makeInitialState();
    app.reachable.clear();
    app.legalRetreats.clear();
    app.legalRetreatSteps.clear();
    app.retreatPaths.clear();
    saveTurnCheckpoint();
    showGame();
    log(tr("text.newGame"));
    draw();
  }

  function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(app.state));
    log(tr("text.saved"));
    updateMenu();
    draw();
  }

  function loadGame(options = {}) {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) {
      setMenuStatus(tr("menu.noSave"));
      if (!options.fromMenu) {
        log(tr("text.noSave"));
        draw();
      }
      return;
    }
    try {
      app.state = normalizeState(JSON.parse(raw), { preserveTransient: true });
      restoreInteractiveState();
      log(tr("text.loaded"));
      setMenuStatus(tr("menu.loaded"));
      showGame();
    } catch (_) {
      setMenuStatus(tr("menu.noSave"));
      if (!options.fromMenu) log(tr("text.badSave"));
      draw();
    }
  }

  function saveTurnCheckpoint() {
    const snapshot = clone(app.state);
    snapshot.selectedUnitId = null;
    snapshot.selectedDefenderId = null;
    snapshot.selectedAttackers = [];
    snapshot.retreatTask = null;
    snapshot.advanceTask = null;
    snapshot.lastMove = null;
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(snapshot));
    updateMenu();
  }

  function saveSessionState() {
    if (!app.state) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(app.state));
    updateMenu();
  }

  function continueCampaign() {
    const sessionRaw = localStorage.getItem(SESSION_KEY);
    const checkpointRaw = localStorage.getItem(CHECKPOINT_KEY);
    const raw = sessionRaw || checkpointRaw;
    if (!raw) {
      setMenuStatus(tr("menu.noCheckpoint"));
      return;
    }
    try {
      app.state = normalizeState(JSON.parse(raw), { preserveTransient: Boolean(sessionRaw) });
      if (sessionRaw) restoreInteractiveState();
      else clearTransientState();
      setMenuStatus(tr("menu.continued"));
      showGame();
    } catch (_) {
      setMenuStatus(tr("menu.noCheckpoint"));
    }
  }

  function restoreInteractiveState() {
    app.reachable.clear();
    app.legalRetreats.clear();
    app.legalRetreatSteps.clear();
    app.retreatPaths.clear();
    if (app.state.selectedUnitId) {
      const unit = unitById(app.state.selectedUnitId);
      if (unit && isMovementPhase() && unit.side === activeSide() && !unit.disrupted && !app.state.movedUnits.includes(unit.id)) {
        app.reachable = reachableHexes(unit);
      }
    }
    if (app.state.retreatTask) prepareCurrentRetreat({ silent: true });
  }

  function clearTransientState() {
    app.state.selectedUnitId = null;
    app.state.selectedDefenderId = null;
    app.state.selectedAttackers = [];
    app.state.retreatTask = null;
    app.state.advanceTask = null;
    app.state.lastMove = null;
    app.reachable.clear();
    app.legalRetreats.clear();
    app.legalRetreatSteps.clear();
    app.retreatPaths.clear();
  }

  function centerOnOpeningFront() {
    el.boardViewport.scrollLeft = 360;
    el.boardViewport.scrollTop = 0;
  }

  function onBoardClick(event) {
    if (app.animating || el.body.dataset.view !== "game") return;
    const rect = el.boardSurface.getBoundingClientRect();
    const scaleX = app.scenario.board.width / rect.width;
    const scaleY = app.scenario.board.height / rect.height;
    const point = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
    const hex = nearestHex(point);
    if (!hex) return;
    if (app.state.retreatTask) {
      chooseRetreatHex(hex.id);
      return;
    }
    if (app.reachable.has(hex.id)) {
      attemptMove(hex.id);
      return;
    }
    if (isCombatPhase() && app.state.combatMode === "declare") {
      chooseCombatHex(hex.id);
    }
  }

  function nearestHex(point) {
    let best = null;
    for (const hex of app.hexes) {
      const score = Math.hypot(hex.center.x - point.x, hex.center.y - point.y);
      if (!best || score < best.score) best = { hex, score };
    }
    return best?.score < 58 ? best.hex : null;
  }

  function onUnitClick(event, unitId) {
    event.stopPropagation();
    if (app.animating) return;
    const unit = unitById(unitId);
    if (!unit || unit.eliminated) return;
    if (app.state.advanceTask) {
      if (app.state.advanceTask.attackerIds.includes(unit.id)) advanceUnit(unit.id);
      return;
    }
    if (app.state.retreatTask) return;
    if (isMovementPhase()) {
      if (unit.side === activeSide()) selectUnit(unit);
      return;
    }
    if (isCombatPhase() && app.state.combatMode === "declare") {
      if (unit.side === activeSide()) toggleCombatAttacker(unit);
      else setCombatDefender(unit);
      draw();
    }
  }

  function selectUnit(unit) {
    if (app.state.selectedUnitId === unit.id && !canUndoLastMove(unit)) {
      app.state.selectedUnitId = null;
      app.reachable.clear();
      draw();
      return;
    }
    app.state.selectedUnitId = unit.id;
    app.state.selectedDefenderId = null;
    app.state.selectedAttackers = [];
    app.reachable.clear();
    if (unit.side === activeSide() && !unit.disrupted && !app.state.movedUnits.includes(unit.id)) {
      app.reachable = reachableHexes(unit);
    }
    draw();
  }

  function canUndoLastMove(unit = unitById(app.state.selectedUnitId)) {
    const move = app.state.lastMove;
    return Boolean(
      move
      && unit
      && move.unitId === unit.id
      && isMovementPhase()
      && move.turn === app.state.turn
      && move.phaseIndex === app.state.phaseIndex
      && !app.state.winner
      && !app.animating
    );
  }

  const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  async function animateUnitPath(unit, path) {
    app.animating = true;
    for (const hexId of path.slice(1)) {
      unit.hexId = hexId;
      draw();
      await delay(70);
    }
    app.animating = false;
  }

  function chooseCombatHex(hexId) {
    const unit = liveUnitAt(hexId);
    if (!unit) return;
    if (unit.side !== activeSide()) setCombatDefender(unit);
    else toggleCombatAttacker(unit);
    draw();
  }

  function setCombatDefender(unit) {
    if (unit.side === activeSide() || unit.disrupted || app.state.usedDefenders.includes(unit.id)) return;
    if (app.state.selectedDefenderId === unit.id) {
      app.state.selectedDefenderId = null;
      app.state.selectedAttackers = [];
      log(tr("text.battleCancelled"));
      return;
    }
    const attackers = neighborsOf(unit.hexId)
      .map(liveUnitAt)
      .filter((attacker) => canAttack(attacker, unit));
    if (!attackers.length) {
      log(tr("text.noLegalAttackers"));
      return;
    }
    app.state.selectedDefenderId = unit.id;
    app.state.selectedAttackers = attackers.map((attacker) => attacker.id);
  }

  function toggleCombatAttacker(unit) {
    if (!unit || unit.side !== activeSide() || unit.disrupted || app.state.usedAttackers.includes(unit.id)) return;
    const defender = unitById(app.state.selectedDefenderId);
    if (defender && !canAttack(unit, defender)) return;
    if (app.state.selectedAttackers.includes(unit.id)) {
      app.state.selectedAttackers = app.state.selectedAttackers.filter((id) => id !== unit.id);
    } else {
      app.state.selectedAttackers.push(unit.id);
    }
  }

  function canAttack(attacker, defender) {
    if (!attacker || !defender) return false;
    if (attacker.side !== activeSide()) return false;
    if (attacker.disrupted || defender.disrupted) return false;
    if (app.state.usedAttackers.includes(attacker.id)) return false;
    if (app.state.usedDefenders.includes(defender.id)) return false;
    return neighborsOf(attacker.hexId).includes(defender.hexId);
  }

  function declareBattle() {
    const defender = unitById(app.state.selectedDefenderId);
    const attackers = app.state.selectedAttackers.map(unitById).filter(Boolean);
    if (!defender || !attackers.length) return;
    if (attackers.some((attacker) => !canAttack(attacker, defender))) return;
    const odds = calculateOdds(attackers, defender);
    const battle = {
      id: `b${Date.now()}-${app.state.declaredCombats.length}`,
      turn: app.state.turn,
      phaseId: phase().id,
      side: activeSide(),
      defenderId: defender.id,
      defenderHexId: defender.hexId,
      attackerIds: attackers.map((unit) => unit.id),
      attackerOrigins: Object.fromEntries(attackers.map((unit) => [unit.id, unit.hexId])),
      attackerHexIds: attackers.map((unit) => unit.hexId),
      oddsAtDeclaration: formatOddsWithDefense(odds),
      oddsShort: formatOdds(odds),
      resolved: false,
      result: null,
      events: [],
    };
    app.state.declaredCombats.push(battle);
    app.state.combatCompleteNotified = false;
    app.state.usedDefenders.push(defender.id);
    app.state.usedAttackers.push(...attackers.map((unit) => unit.id));
    log(tr("text.battleDeclared", {
      attackers: attackers.map(unitName).join(" + "),
      defender: unitName(defender),
    }));
    app.state.selectedDefenderId = null;
    app.state.selectedAttackers = [];
    draw();
  }

  function cancelDeclaredBattle(battleId) {
    if (!isCombatPhase() || app.state.combatMode !== "declare") return;
    const battle = app.state.declaredCombats.find((item) => item.id === battleId);
    if (!battle) return;
    app.state.declaredCombats = app.state.declaredCombats.filter((item) => item.id !== battleId);
    app.state.usedDefenders = app.state.usedDefenders.filter((id) => id !== battle.defenderId);
    app.state.usedAttackers = app.state.usedAttackers.filter((id) => !battle.attackerIds.includes(id));
    app.state.combatCompleteNotified = false;
    if (app.state.selectedDefenderId === battle.defenderId) {
      app.state.selectedDefenderId = null;
      app.state.selectedAttackers = [];
    }
    log(tr("text.battleCancelled"));
    draw();
  }

  function finishDeclarations() {
    if (!isCombatPhase() || app.state.combatMode !== "declare") return;
    app.state.combatMode = "resolve";
    app.state.combatCompleteNotified = !app.state.declaredCombats.length;
    log(app.state.declaredCombats.length ? tr("text.declarationsComplete") : tr("text.noBattle"));
    draw();
    if (app.state.declaredCombats.length) window.setTimeout(() => resolveNextBattle(), 90);
  }

  function currentBattle() {
    if (app.state.retreatTask) return battleById(app.state.retreatTask.battleId) || app.state.retreatTask.battle;
    if (app.state.advanceTask) return app.state.declaredCombats.find((battle) => battle.id === app.state.advanceTask.battleId) || null;
    return app.state.declaredCombats.find((item) => !item.resolved) || null;
  }

  function battleById(id) {
    return app.state.declaredCombats.find((battle) => battle.id === id) || null;
  }

  function hasPendingBattles() {
    return app.state.declaredCombats.some((item) => !item.resolved);
  }

  function markCombatCompleteOnce() {
    if (!isCombatPhase() || app.state.combatMode !== "resolve") return;
    if (app.state.retreatTask || app.state.advanceTask || hasPendingBattles()) return;
    if (!app.state.combatCompleteNotified) {
      app.state.combatCompleteNotified = true;
      log(tr("text.allDone"));
    }
  }

  function resolveNextBattle() {
    if (!isCombatPhase() || app.state.combatMode !== "resolve") return;
    if (app.state.retreatTask || app.state.advanceTask) return;
    const battle = currentBattle();
    if (!battle) {
      markCombatCompleteOnce();
      draw();
      return;
    }
    const defender = unitById(battle.defenderId);
    const attackers = battle.attackerIds.map(unitById).filter((unit) => unit && !unit.eliminated);
    if (!defender || defender.eliminated || !attackers.length) {
      battle.resolved = true;
      battle.result = "Skipped";
      app.state.lastCombatResult = { battleId: battle.id, result: "Skipped", events: [] };
      log(tr("text.battleSkipped"));
      markCombatCompleteOnce();
      draw();
      return;
    }
    const odds = calculateOdds(attackers, defender);
    const roll = Math.floor(Math.random() * 6) + 1;
    const result = app.rules.crt.rows[String(roll)][odds.columnIndex];
    battle.result = `${roll}/${odds.column}/${result}`;
    battle.resultCode = result;
    battle.roll = roll;
    battle.crtColumn = odds.column;
    battle.oddsAtResolution = formatOddsWithDefense(odds);
    battle.oddsShort = formatOdds(odds);
    battle.events = [];
    app.state.lastCombatResult = {
      battleId: battle.id,
      result,
      roll,
      column: odds.column,
      odds: formatOdds(odds),
      defenderHex: hexLabel(battle.defenderHexId),
      events: battle.events,
    };
    log(`${tr("text.currentBattle")}: ${formatBattleTitle(battle)} · ${tr("text.result")} ${combatResultLabel(result)}`);
    applyCombatResult(battle, result);
    markCombatCompleteOnce();
    draw();
  }

  function calculateOdds(attackers, defender) {
    const attack = attackers.reduce((sum, unit) => sum + unit.combat, 0);
    const defenseInfo = defenseBreakdown(defender);
    const defense = defenseInfo.total;
    const ratio = attack / Math.max(1, defense);
    const thresholds = [0.5, 1, 2, 3, 4, 5, 6];
    let columnIndex = 0;
    for (let index = 0; index < thresholds.length; index += 1) {
      if (ratio >= thresholds[index]) columnIndex = index;
    }
    return { attack, defense, defenseInfo, ratio, columnIndex, column: app.rules.crt.columns[columnIndex] };
  }

  function formatOdds(odds) {
    if (!odds) return "--";
    return `${odds.attack}:${odds.defense} / ${odds.column}`;
  }

  function formatOddsWithDefense(odds) {
    if (!odds) return "--";
    const detail = formatDefenseDetail(odds.defenseInfo);
    return detail ? `${formatOdds(odds)}; ${detail}` : formatOdds(odds);
  }

  function formatDefenseDetail(info) {
    if (!info || !info.effects.length) return "";
    const effects = info.effects.join(", ");
    return `${tr("text.defense")} ${info.base} x ${info.multiplier} = ${info.total} (${effects})`;
  }

  function defenseBreakdown(unit) {
    const hex = hexById(unit.hexId);
    const terrain = terrainRule(hex);
    const terrainMultiplier = Number(terrain.defenseMultiplier || 1);
    const effects = [];
    let multiplier = terrainMultiplier;
    if (terrainMultiplier > 1) effects.push(`${terrainName(hex?.terrain)} x${terrainMultiplier}`);

    const positionRule = app.rules.britishPosition;
    if (hex?.britishPosition && unit.side === positionRule.appliesOnlyToSide) {
      const positionMultiplier = Number(positionRule.defenseMultiplier || 1);
      if (positionMultiplier > multiplier) {
        multiplier = positionMultiplier;
        effects.length = 0;
        effects.push(`${tr("terrain.britishPosition")} x${positionMultiplier}`);
      } else if (positionMultiplier > 1 && terrainMultiplier <= 1) {
        multiplier = Math.max(multiplier, positionMultiplier);
        effects.push(`${tr("terrain.britishPosition")} x${positionMultiplier}`);
      }
    }
    return { base: unit.combat, multiplier, total: unit.combat * multiplier, effects };
  }

  function terrainName(key) {
    return tr(`terrain.${key || "desert"}`);
  }

  function previewOddsText(attackers, defender) {
    if (!defender || !attackers.length) return `${tr("text.odds")}: --`;
    return `${tr("text.odds")}: ${formatOddsWithDefense(calculateOdds(attackers, defender))}`;
  }

  function combatResultLabel(result) {
    if (result === "AE" || result === "AR" || result === "DE" || result === "Skipped") return tr(`result.${result}`);
    const match = result.match(/^DR(\d+)$/);
    if (match) return tr("result.DR", { steps: match[1] });
    return result;
  }

  function applyCombatResult(battle, result) {
    if (result === "AE") {
      for (const id of battle.attackerIds) eliminateUnit(id, battle.id);
      battle.resolved = true;
      archiveBattleReport(battle);
      return;
    }
    if (result === "DE") {
      eliminateUnit(battle.defenderId, battle.id);
      battle.resolved = true;
      startAdvanceTask(battle);
      archiveBattleReport(battle);
      return;
    }
    if (result === "AR") {
      startRetreatTask({
        battle,
        unitIds: battle.attackerIds.filter((id) => !unitById(id)?.eliminated),
        steps: 1,
        result,
        origins: battle.attackerOrigins,
        disruptAfterRetreat: false,
        advanceAfter: false,
      });
      return;
    }
    const match = result.match(/^DR(\d+)$/);
    if (match) {
      startRetreatTask({
        battle,
        unitIds: [battle.defenderId].filter((id) => !unitById(id)?.eliminated),
        steps: Number(match[1]),
        result,
        origins: { [battle.defenderId]: battle.defenderHexId },
        disruptAfterRetreat: true,
        advanceAfter: true,
      });
    }
  }

  function eliminateUnit(id, battleId = null) {
    const unit = unitById(id);
    if (!unit || unit.eliminated) return;
    unit.eliminated = true;
    unit.disrupted = false;
    app.state.eliminatedUnitIds.push(unit.id);
    app.state.losses[unit.side].units += 1;
    app.state.losses[unit.side].combat += unit.combat;
    if (battleId) addBattleEvent(battleId, { type: "eliminated", unitId: unit.id, text: tr("text.eliminated", { unit: unitName(unit) }) });
    log(tr("text.eliminated", { unit: unitName(unit) }));
  }

  function addBattleEvent(battleId, event) {
    const battle = battleById(battleId);
    if (!battle) return;
    battle.events ||= [];
    battle.events.push(event);
    if (app.state.lastCombatResult?.battleId === battleId) app.state.lastCombatResult.events = battle.events;
  }

  function archiveBattleReport(battle) {
    if (app.state.battleReports.some((item) => item.id === battle.id)) return;
    app.state.battleReports.push({
      id: battle.id,
      turn: battle.turn,
      phaseId: battle.phaseId,
      side: battle.side,
      defenderId: battle.defenderId,
      defenderHexId: battle.defenderHexId,
      attackerIds: battle.attackerIds,
      attackerHexIds: battle.attackerHexIds,
      odds: battle.oddsShort,
      roll: battle.roll,
      column: battle.crtColumn,
      result: battle.resultCode || battle.result,
      events: clone(battle.events || []),
    });
  }

  function startRetreatTask(task) {
    task.battleId = task.battle?.id || task.battleId;
    task.index = 0;
    task.remainingSteps = task.steps;
    task.origins ||= {};
    app.state.retreatTask = task;
    prepareCurrentRetreat();
  }

  function prepareCurrentRetreat(options = {}) {
    const task = app.state.retreatTask;
    if (!task) return;
    while (task.index < task.unitIds.length) {
      const unit = unitById(task.unitIds[task.index]);
      if (!unit || unit.eliminated) {
        task.index += 1;
        task.remainingSteps = task.steps;
        continue;
      }
      const originHexId = task.origins[unit.id] || unit.hexId;
      task.remainingSteps = task.steps;
      app.retreatPaths = legalRetreatPaths(unit, task.steps, originHexId);
      app.legalRetreatSteps = new Set(app.retreatPaths.keys());
      app.legalRetreats = new Set(app.retreatPaths.keys());
      if (app.retreatPaths.size) {
        if (!options.silent) log(tr("text.retreatNeeded", { unit: unitName(unit), steps: task.steps }));
        if (!options.silent) draw();
        return;
      }
      eliminateUnit(unit.id, task.battleId);
      task.index += 1;
      task.remainingSteps = task.steps;
    }
    finishRetreatTask();
  }

  async function chooseRetreatHex(hexId) {
    const task = app.state.retreatTask;
    if (!task || !app.retreatPaths.has(hexId)) return;
    const unit = unitById(task.unitIds[task.index]);
    if (!unit) return;
    const path = app.retreatPaths.get(hexId);
    app.legalRetreats.clear();
    app.legalRetreatSteps.clear();
    app.retreatPaths.clear();
    await animateUnitPath(unit, path);
    unit.hexId = hexId;
    const movedSteps = Math.max(0, path.length - 1);
    if (movedSteps > task.steps) {
      addBattleEvent(task.battleId, { type: "retreat-extra", unitId: unit.id, toHexId: hexId, text: tr("text.retreatExtra", { unit: unitName(unit) }) });
      log(tr("text.retreatExtra", { unit: unitName(unit) }));
    }
    addBattleEvent(task.battleId, { type: "retreat", unitId: unit.id, toHexId: hexId, text: tr("text.retreated", { unit: unitName(unit), hex: hexLabel(hexId) }) });
    log(tr("text.retreated", { unit: unitName(unit), hex: hexLabel(hexId) }));
    unit.disrupted = Boolean(task.disruptAfterRetreat);
    task.index += 1;
    task.remainingSteps = task.steps;
    prepareCurrentRetreat();
  }

  function finishRetreatTask() {
    const task = app.state.retreatTask;
    if (!task) return;
    const battle = battleById(task.battleId) || task.battle;
    if (battle) {
      battle.resolved = true;
      archiveBattleReport(battle);
    }
    app.state.retreatTask = null;
    app.legalRetreats.clear();
    app.legalRetreatSteps.clear();
    app.retreatPaths.clear();
    if (task.advanceAfter && battle) startAdvanceTask(battle);
    markCombatCompleteOnce();
    draw();
  }

  function startAdvanceTask(battle) {
    const targetHexId = battle.defenderHexId;
    if (liveUnitAt(targetHexId)) return;
    const eligible = battle.attackerIds.filter((id) => {
      const unit = unitById(id);
      return unit && !unit.eliminated && neighborsOf(unit.hexId).includes(targetHexId);
    });
    if (!eligible.length) return;
    app.state.advanceTask = { battleId: battle.id, targetHexId, attackerIds: eligible };
  }

  function advanceUnit(unitId) {
    const task = app.state.advanceTask;
    if (!task || unitId === "skip") {
      app.state.advanceTask = null;
      draw();
      return;
    }
    const unit = unitById(unitId);
    if (unit && !unit.eliminated && !liveUnitAt(task.targetHexId)) {
      unit.hexId = task.targetHexId;
      addBattleEvent(task.battleId, { type: "advance", unitId: unit.id, toHexId: task.targetHexId, text: tr("text.advance", { unit: unitName(unit), hex: hexLabel(task.targetHexId) }) });
      log(tr("text.advance", { unit: unitName(unit), hex: hexLabel(task.targetHexId) }));
    }
    app.state.advanceTask = null;
    markCombatCompleteOnce();
    draw();
  }

  function legalRetreatPaths(unit, requiredSteps, originHexId) {
    const result = new Map();
    const maxSteps = Math.min(app.hexes.length, requiredSteps + 18);
    const seen = new Set();
    const queue = [{ hexId: unit.hexId, steps: 0, requiredSteps, path: [unit.hexId] }];
    while (queue.length) {
      const current = queue.shift();
      const key = `${current.hexId}:${current.steps}:${current.requiredSteps}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const currentDistance = hexDistance(current.hexId, originHexId);
      if (current.steps >= maxSteps) continue;
      for (const nextId of neighborsOf(current.hexId)) {
        const nextHex = hexById(nextId);
        if (!terrainRule(nextHex).passable) continue;
        const occupant = liveUnitAt(nextId);
        if (occupant && occupant.side !== unit.side) continue;
        if (isEnemyZoc(nextId, unit.side, unit.id)) continue;
        if (hexDistance(nextId, originHexId) <= currentDistance) continue;
        const nextSteps = current.steps + 1;
        const friendlyOccupied = occupant && occupant.id !== unit.id && occupant.side === unit.side;
        const nextPath = [...current.path, nextId];
        let nextRequiredSteps = current.requiredSteps;
        if (nextSteps >= nextRequiredSteps && friendlyOccupied) nextRequiredSteps += 1;
        if (nextSteps >= nextRequiredSteps && !friendlyOccupied) {
          if (!result.has(nextId)) result.set(nextId, nextPath);
          continue;
        }
        queue.push({ hexId: nextId, steps: nextSteps, requiredSteps: nextRequiredSteps, path: nextPath });
      }
    }
    return result;
  }

  function legalRetreatDestinations(unit, requiredSteps, originHexId) {
    return new Set(legalRetreatPaths(unit, requiredSteps, originHexId).keys());
  }

  async function attemptMove(destinationHexId) {
    const unit = unitById(app.state.selectedUnitId);
    if (!unit || unit.side !== activeSide() || unit.eliminated) return;
    if (unit.disrupted) {
      log(tr("text.cannotMove", { unit: unitName(unit) }));
      draw();
      return;
    }
    if (app.state.movedUnits.includes(unit.id)) {
      log(tr("text.alreadyMoved", { unit: unitName(unit) }));
      draw();
      return;
    }
    const route = app.reachable.get(destinationHexId);
    if (!route) return;
    const occupant = liveUnitAt(destinationHexId);
    if (occupant && occupant.id !== unit.id) {
      log(tr("text.targetOccupied"));
      draw();
      return;
    }
    const fromHexId = unit.hexId;
    const path = route.path || [fromHexId, destinationHexId];
    const movedUnitsBefore = app.state.movedUnits.slice();
    app.reachable.clear();
    await animateUnitPath(unit, path);
    unit.hexId = destinationHexId;
    app.state.movedUnits.push(unit.id);
    app.state.lastMove = { unitId: unit.id, fromHexId, toHexId: destinationHexId, path, movedUnitsBefore, turn: app.state.turn, phaseIndex: app.state.phaseIndex };
    log(tr("text.moved", { unit: unitName(unit), hex: hexLabel(destinationHexId), mp: route.remaining }));
    if (unit.side === "allied" && app.scenario.objectives.alliedWestExitEdge.includes(destinationHexId) && route.remaining > 0) {
      setWinner("allied", tr("text.exitWin", { unit: unitName(unit) }), "allied-breakthrough");
    }
    app.state.selectedUnitId = unit.id;
    draw();
  }

  async function undoLastMove() {
    const move = app.state.lastMove;
    const unit = unitById(move?.unitId);
    if (!canUndoLastMove(unit)) return;
    const reversePath = (move.path || [move.fromHexId, move.toHexId]).slice().reverse();
    app.reachable.clear();
    await animateUnitPath(unit, reversePath);
    unit.hexId = move.fromHexId;
    app.state.movedUnits = move.movedUnitsBefore || app.state.movedUnits.filter((id) => id !== unit.id);
    app.state.selectedUnitId = unit.id;
    app.state.lastMove = null;
    log(tr("text.undoMoved", { unit: unitName(unit), hex: hexLabel(move.fromHexId) }));
    draw();
  }

  function reachableHexes(unit) {
    const allowance = movementAllowance(unit);
    const startHexId = unit.hexId;
    const result = new Map();
    const startInZoc = isEnemyZoc(startHexId, unit.side, unit.id);
    const queue = [{ hexId: startHexId, spent: 0, firstStep: true, path: [startHexId] }];
    const bestSpent = new Map([[startHexId, 0]]);
    while (queue.length) {
      const current = queue.shift();
      const currentInZoc = isEnemyZoc(current.hexId, unit.side, unit.id);
      if (!current.firstStep && currentInZoc) continue;
      for (const nextId of neighborsOf(current.hexId)) {
        const nextHex = hexById(nextId);
        const rule = terrainRule(nextHex);
        if (!rule.passable) continue;
        const occupant = liveUnitAt(nextId);
        if (occupant && occupant.side !== unit.side) continue;
        const nextInZoc = isEnemyZoc(nextId, unit.side, unit.id);
        if (currentInZoc && nextInZoc) continue;
        if (startInZoc && nextInZoc) continue;
        const spent = current.spent + Number(rule.movement || 1);
        if (spent > allowance) continue;
        if (bestSpent.has(nextId) && bestSpent.get(nextId) <= spent) continue;
        bestSpent.set(nextId, spent);
        const remaining = allowance - spent;
        const path = current.path.concat(nextId);
        if (!occupant || occupant.id === unit.id) result.set(nextId, { spent, remaining, path });
        queue.push({ hexId: nextId, spent, firstStep: false, path });
      }
    }
    result.delete(startHexId);
    return result;
  }

  function movementAllowance(unit) {
    let movement = unit.movement;
    if (unit.side === "allied" && app.state.turn === 1) {
      movement = Math.max(1, Math.floor(movement * app.rules.firstTurnAlliedMovementMultiplier));
    }
    return movement;
  }

  function isEnemyZoc(hexId, friendlySide, ignoreUnitId = null) {
    return liveUnits().some((unit) => {
      if (unit.id === ignoreUnitId || unit.side === friendlySide || unit.disrupted) return false;
      return neighborsOf(unit.hexId).includes(hexId);
    });
  }

  function isSideZoc(hexId, side, ignoreUnitId = null) {
    return liveUnits().some((unit) => {
      if (unit.id === ignoreUnitId || unit.side !== side || unit.disrupted) return false;
      return neighborsOf(unit.hexId).includes(hexId);
    });
  }

  function neighborsOf(hexId) {
    const hex = hexById(hexId);
    if (!hex) return [];
    const oddRow = Math.abs(hex.row % 2) === 1;
    const offsets = oddRow
      ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]]
      : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
    return offsets
      .map(([dc, dr]) => app.hexes.find((candidate) => candidate.col === hex.col + dc && candidate.row === hex.row + dr)?.id)
      .filter(Boolean);
  }

  function hexDistance(fromId, toId) {
    if (fromId === toId) return 0;
    const queue = [{ id: fromId, distance: 0 }];
    const seen = new Set([fromId]);
    while (queue.length) {
      const current = queue.shift();
      for (const next of neighborsOf(current.id)) {
        if (seen.has(next)) continue;
        if (next === toId) return current.distance + 1;
        seen.add(next);
        queue.push({ id: next, distance: current.distance + 1 });
      }
    }
    return Infinity;
  }

  function endPhase() {
    if (app.state.winner) return;
    if (app.state.retreatTask || app.state.advanceTask) {
      log(tr("text.retreatPrompt", { unit: "" }));
      draw();
      return;
    }
    if (isCombatPhase() && app.state.combatMode === "resolve" && hasPendingBattles()) {
      log(tr("text.pendingCombat"));
      draw();
      return;
    }
    if (isCombatPhase() && app.state.combatMode === "declare" && app.state.declaredCombats.length) {
      log(tr("ui.finishDeclarations"));
      draw();
      return;
    }
    if (isCombatPhase()) recoverSide(activeSide());
    clearPhaseState();
    if (app.state.phaseIndex === app.rules.phases.length - 1) {
      if (checkAxisObjectiveVictory()) {
        draw();
        return;
      }
      if (app.state.turn >= app.rules.turns.length) {
        setWinner("allied", tr("text.fourTurnWin"), "axis-failed");
      } else {
        app.state.turn += 1;
        app.state.phaseIndex = 0;
        log(tr("text.turnStart", { turn: app.state.turn }));
        saveTurnCheckpoint();
      }
    } else {
      app.state.phaseIndex += 1;
      log(tr("text.enterPhase", { phase: phaseLabel(phase().id) }));
    }
    draw();
  }

  function clearPhaseState() {
    app.state.selectedUnitId = null;
    app.state.selectedDefenderId = null;
    app.state.selectedAttackers = [];
    app.state.declaredCombats = [];
    app.state.combatCompleteNotified = false;
    app.state.usedAttackers = [];
    app.state.usedDefenders = [];
    app.state.movedUnits = [];
    app.state.lastMove = null;
    app.state.lastCombatResult = null;
    app.state.combatMode = "declare";
    app.reachable.clear();
    app.legalRetreats.clear();
    app.legalRetreatSteps.clear();
    app.retreatPaths.clear();
  }

  function recoverSide(side) {
    for (const unit of app.state.units) {
      if (!unit.eliminated && unit.side === side && unit.disrupted) {
        unit.disrupted = false;
        log(tr("text.recover", { unit: unitName(unit) }));
      }
    }
  }

  function checkAxisObjectiveVictory() {
    const axisUnits = liveUnits().filter((unit) => unit.side === "axis");
    const ridge = new Set(app.scenario.objectives.alamHalfaRidge);
    const road = new Set(app.scenario.objectives.coastalRoadEast);
    const ridgeUnit = axisUnits.find((unit) => ridge.has(unit.hexId));
    const roadUnit = axisUnits.find((unit) => road.has(unit.hexId));
    if (ridgeUnit) {
      setWinner("axis", tr("text.ridgeWin", { unit: unitName(ridgeUnit) }));
      return true;
    }
    if (roadUnit) {
      setWinner("axis", tr("text.roadWin", { unit: unitName(roadUnit) }));
      return true;
    }
    return false;
  }

  function setWinner(side, reason, type = null) {
    app.state.winner = { side, reason, type, turn: app.state.turn, report: buildAarData(side, reason, type) };
    log(`${sideLabel(side)}: ${reason}`);
    openAar(true);
  }

  function buildAarData(side = app.state.winner?.side || null, reason = app.state.winner?.reason || tr("aar.pendingTitle"), type = app.state.winner?.type || null) {
    const eliminated = app.state.eliminatedUnitIds.map(unitById).filter(Boolean);
    const eliminatedBySide = {
      axis: eliminated.filter((unit) => unit.side === "axis"),
      allied: eliminated.filter((unit) => unit.side === "allied"),
    };
    const axisUnits = liveUnits().filter((unit) => unit.side === "axis");
    const ridge = new Set(app.scenario.objectives.alamHalfaRidge);
    const road = new Set(app.scenario.objectives.coastalRoadEast);
    const ridgeOccupiedHexes = new Set(axisUnits.filter((unit) => ridge.has(unit.hexId)).map((unit) => unit.hexId));
    const ridgeStates = app.scenario.objectives.alamHalfaRidge.map((hexId) => {
      const occupant = liveUnitAt(hexId);
      return {
        hexId,
        occupantSide: occupant?.side || null,
        axisZoc: isSideZoc(hexId, "axis"),
      };
    });
    const ridgeControl = ridgeStates.some((item) => item.occupantSide === "axis");
    const ridgeFullControl = ridgeControl && ridgeStates.every((item) => {
      if (item.occupantSide === "axis") return true;
      if (item.occupantSide === "allied") return false;
      return item.axisZoc;
    });
    const roadOccupiedHexes = new Set(axisUnits.filter((unit) => road.has(unit.hexId)).map((unit) => unit.hexId));
    const elAlameinHexId = "c12r03";
    const elAlameinOccupied = roadOccupiedHexes.has(elAlameinHexId);
    const roadCut = [...roadOccupiedHexes].some((hexId) => hexId !== elAlameinHexId);
    return {
      side,
      reason,
      type,
      turn: app.state.turn,
      eliminated,
      eliminatedBySide,
      initialStrength: clone(app.state.initialStrength || totalStrengthBySide(app.scenario.units)),
      currentStrength: totalStrengthBySide(app.state.units),
      losses: clone(app.state.losses),
      objectives: {
        ridgeOccupied: ridgeOccupiedHexes.size,
        ridgeTotal: ridge.size,
        ridgeControl,
        ridgeFullControl,
        roadOccupied: roadOccupiedHexes.size,
        elAlameinOccupied,
        roadCut,
      },
      battles: clone(app.state.battleReports),
    };
  }

  function openAar(final = false) {
    renderAar(final);
    setView("aar");
  }

  function renderAar() {
    const data = buildAarData();
    const winnerSide = app.state.winner?.side || "";
    el.aarView.dataset.winner = winnerSide || "pending";
    el.aarTitle.textContent = app.state.winner ? tr("aar.title", { side: sideLabel(winnerSide) }) : tr("aar.pendingTitle");
    el.aarSubtitle.textContent = tr("aar.subtitle", { turn: data.turn, reason: data.reason });
    el.aarSummary.replaceChildren(
      victoryImpactCard(data.side),
      objectivesCard(data),
    );
    el.aarLosses.replaceChildren(casualtyReportCard(data));
    el.aarEliminated.replaceChildren();
    renderBattleRecordSection(data.battles);
  }

  function sectionTitle(text) {
    const node = document.createElement("div");
    node.className = "aar-card";
    const strong = document.createElement("strong");
    strong.textContent = text;
    node.append(strong);
    return node;
  }

  function aarCard(title, body) {
    const card = document.createElement("div");
    card.className = "aar-card";
    if (title) {
      const strong = document.createElement("strong");
      strong.textContent = title;
      card.append(strong);
    }
    if (body instanceof Node) {
      card.append(body);
    } else {
      const span = document.createElement("span");
      span.textContent = body;
      card.append(span);
    }
    return card;
  }

  function victoryImpactCard(side) {
    const body = document.createElement("span");
    if (side === "axis") {
      body.textContent = tr("text.axisImpact");
    } else if (side === "allied") {
      body.append(document.createTextNode(tr("text.alliedImpactPrefix")));
      const link = document.createElement("a");
      link.href = "https://zh.wikipedia.org/wiki/%E8%8B%8F%E4%BC%8A%E5%A3%AB%E8%BF%90%E6%B2%B3";
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = tr("text.alliedImpactLink");
      body.append(link, document.createTextNode(tr("text.alliedImpactSuffix")));
    } else {
      body.textContent = "--";
    }
    const card = aarCard("", body);
    card.classList.add("aar-impact-card");
    return card;
  }

  function objectivesCard(data) {
    const body = document.createElement("div");
    body.className = "objective-status";
    const achieved = objectiveAchievements(data);
    if (achieved.length) {
      achieved.forEach((item) => body.append(objectiveLine(item.title, item.text)));
    } else {
      body.append(objectiveLine(tr("text.objectives"), tr("text.noObjectiveReached")));
    }
    const card = aarCard(tr("text.objectives"), body);
    card.classList.add("objectives-card");
    return card;
  }

  function objectiveAchievements(data) {
    const objectives = data.objectives;
    const achieved = [];
    if (data.side === "allied") {
      if (data.type === "allied-breakthrough") {
        achieved.push({ title: tr("text.alliedBreakthroughTitle"), text: tr("text.alliedBreakthroughText") });
      } else {
        achieved.push({ title: tr("text.axisFailedTitle"), text: tr("text.axisFailedText") });
      }
      return achieved;
    }
    if (objectives.ridgeFullControl) {
      achieved.push({ title: tr("text.ridgeFullTitle"), text: tr("text.ridgeFullText") });
    } else if (objectives.ridgeControl) {
      achieved.push({ title: tr("text.ridgeControlTitle"), text: tr("text.ridgeControlText") });
    }
    if (objectives.roadCut) {
      achieved.push({ title: tr("text.roadCutTitle"), text: tr("text.roadCutText") });
    }
    if (objectives.elAlameinOccupied) {
      achieved.push({ title: tr("text.roadElAlameinTitle"), text: tr("text.roadElAlameinText") });
    }
    return achieved;
  }

  function objectiveLine(label, value) {
    const row = document.createElement("div");
    row.className = "objective-line";
    const name = document.createElement("span");
    name.textContent = label;
    const status = document.createElement("strong");
    status.textContent = value;
    row.append(name, status);
    return row;
  }

  function casualtyReportCard(data) {
    const body = document.createElement("div");
    body.className = "casualty-report";
    body.append(casualtySideCard("axis", data), casualtySideCard("allied", data));
    const card = aarCard(tr("text.casualtyReport"), body);
    card.classList.add("casualty-report-card");
    return card;
  }

  function casualtySideCard(side, data) {
    const targetSide = enemySide(side);
    const sideBox = document.createElement("section");
    sideBox.className = "casualty-side";
    sideBox.dataset.side = side;
    const heading = document.createElement("h3");
    heading.textContent = sideLabel(side);
    const target = document.createElement("p");
    target.className = "casualty-target";
    target.textContent = `${tr("text.eliminatedTarget")}: ${sideLabel(targetSide)}`;
    const loss = data.losses[targetSide] || { units: 0, combat: 0 };
    const stats = document.createElement("div");
    stats.className = "casualty-stats";
    [
      [tr("text.initialStrength"), data.initialStrength[targetSide] ?? 0],
      [tr("text.currentStrength"), data.currentStrength[targetSide] ?? 0],
      [tr("text.eliminatedUnits"), loss.units],
      [tr("text.lostStrength"), loss.combat],
    ].forEach(([label, value]) => {
      const item = document.createElement("span");
      const small = document.createElement("small");
      small.textContent = label;
      const strong = document.createElement("b");
      strong.textContent = value;
      item.append(small, strong);
      stats.append(item);
    });

    const groups = document.createElement("div");
    groups.className = "casualty-groups";
    casualtyGroupsForSide(targetSide, data.eliminatedBySide[targetSide] || []).forEach((group) => {
      groups.append(casualtyGroupLine(group.label, group.units));
    });
    sideBox.append(heading, target, stats, groups);
    return sideBox;
  }

  function casualtyGroupsForSide(side, units) {
    if (side === "axis") {
      return [
        { label: tr("text.germanGroup"), units: units.filter((unit) => unit.nationality === "german") },
        { label: tr("text.italianGroup"), units: units.filter((unit) => unit.nationality === "italian") },
      ];
    }
    return [{ label: tr("text.commonwealthGroup"), units }];
  }

  function casualtyGroupLine(label, units) {
    const line = document.createElement("div");
    line.className = "casualty-group";
    const heading = document.createElement("strong");
    heading.textContent = label;
    const list = document.createElement("div");
    list.className = "casualty-unit-list";
    const sorted = [...units].sort((a, b) => Number(isMechanizedUnit(b)) - Number(isMechanizedUnit(a)) || unitName(a).localeCompare(unitName(b)));
    if (!sorted.length) {
      const none = document.createElement("span");
      none.className = "casualty-none";
      none.textContent = tr("text.noEliminated");
      list.append(none);
    } else {
      sorted.forEach((unit) => list.append(casualtyUnitToken(unit)));
    }
    line.append(heading, list);
    return line;
  }

  function casualtyUnitToken(unit) {
    const token = document.createElement("span");
    token.className = "casualty-unit";
    token.dataset.mechanized = String(isMechanizedUnit(unit));
    const image = document.createElement("img");
    image.src = unit.image;
    image.alt = unitName(unit);
    const text = document.createElement("span");
    text.textContent = `${isMechanizedUnit(unit) ? tr("text.mechanizedTag") : tr("text.nonMechanizedTag")} · ${unitName(unit)} (${unit.combat})`;
    token.append(image, text);
    return token;
  }

  function isMechanizedUnit(unit) {
    if (!unit) return false;
    if (["armor", "mechanized"].includes(unit.unitType)) return true;
    const text = `${unit.name || ""} ${UNIT_EN[unit.id] || ""}`.toLowerCase();
    return /装甲|机械化|motor|armou?r|panzer|mechanized|mechanised/.test(text);
  }

  function renderBattleRecordSection(battles) {
    el.aarBattles.replaceChildren(sectionTitle(tr("aar.battles")));
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "aar-toggle-button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = `${tr("text.showBattleRecord")} (${battles.length})`;
    const list = document.createElement("div");
    list.className = "aar-battle-records";
    list.dataset.expanded = "false";
    list.hidden = true;
    if (!battles.length) {
      list.append(aarCard("", tr("text.noDeclared")));
    } else {
      for (const battle of battles) list.append(battleReportCard(battle));
    }
    toggle.addEventListener("click", () => {
      const expanded = list.hidden;
      list.hidden = !expanded;
      list.dataset.expanded = String(expanded);
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.textContent = `${expanded ? tr("text.hideBattleRecord") : tr("text.showBattleRecord")} (${battles.length})`;
    });
    el.aarBattles.append(toggle, list);
  }

  function battleReportCard(report) {
    const battle = battleById(report.id) || report;
    const title = `${hexLabel(report.defenderHexId)} · ${combatResultLabel(report.result || "Skipped")}`;
    const body = [
      `${tr("text.attackerHexes")}: ${(report.attackerHexIds || []).map(hexLabel).join(", ")}`,
      `${tr("text.odds")}: ${report.odds || "--"} · ${tr("text.die")}: ${report.roll || "--"}`,
      ...(battle.events || report.events || []).map((event) => event.text),
    ].filter(Boolean).join("\n");
    return aarCard(title, body);
  }

  function draw() {
    if (!app.state) return;
    applyLanguage();
    drawStatus();
    drawHexLayer();
    drawUnits();
    drawSelectedUnit();
    drawCombatPanel();
    drawOperationsBoard();
    drawLog();
    updateMenu();
  }

  function drawStatus() {
    const turn = app.rules.turns[app.state.turn - 1];
    el.turnLabel.textContent = `${turnLabel(turn)} · ${sideLabel(activeSide())}`;
    el.phaseLabel.textContent = phaseLabel(phase().id);
    el.boardBadge.textContent = boardBadgeText();
    el.finishDeclarationsButton.hidden = !(isCombatPhase() && app.state.combatMode === "declare");
    el.resolveBattleButton.hidden = !(isCombatPhase() && app.state.combatMode === "resolve");
    el.endPhaseButton.hidden = isCombatPhase() && app.state.combatMode === "declare";
    const pendingBattle = isCombatPhase() && app.state.combatMode === "resolve" ? currentBattle() : null;
    el.resolveBattleButton.disabled = Boolean(app.state.winner || app.state.retreatTask || app.state.advanceTask || !pendingBattle);
    el.resolveBattleButton.textContent = pendingBattle ? tr("ui.resolveBattle") : tr("ui.done");
    el.finishDeclarationsButton.disabled = Boolean(app.state.winner);
    el.endPhaseButton.disabled = Boolean(app.state.winner);
    if (app.state.winner) {
      el.winnerBanner.hidden = false;
      el.winnerBanner.textContent = `${sideLabel(app.state.winner.side)} · ${app.state.winner.reason}`;
    } else {
      el.winnerBanner.hidden = true;
      el.winnerBanner.textContent = "";
    }
  }

  function turnLabel(turn) {
    if (!turn) return `Turn ${app.state.turn}`;
    return app.lang === "en" ? turn.label.split(" / ")[0] : turn.label.split(" / ")[1] || turn.label;
  }

  function boardBadgeText() {
    if (app.state.retreatTask) {
      const unit = unitById(app.state.retreatTask.unitIds[app.state.retreatTask.index]);
      return unit ? tr("text.retreatPrompt", { unit: unitName(unit) }) : tr("text.retreatPrompt", { unit: "" });
    }
    if (app.state.advanceTask) return phaseLabel(phase().id);
    return phaseLabel(phase().id);
  }

  function drawBattleHighlights(ctx) {
    if (!isCombatPhase()) return;
    if (app.state.combatMode === "declare") {
      for (const battle of app.state.declaredCombats) {
        for (const attackerId of battle.attackerIds) drawHex(ctx, hexById(unitById(attackerId)?.hexId), HIGHLIGHT.declaredAttack, 3);
        drawHex(ctx, hexById(unitById(battle.defenderId)?.hexId), HIGHLIGHT.declaredDefender, 3);
      }
      return;
    }
    const battle = currentBattle();
    if (!battle) return;
    for (const attackerId of battle.attackerIds) drawHex(ctx, hexById(unitById(attackerId)?.hexId), HIGHLIGHT.currentAttack, 5);
    drawHex(ctx, hexById(unitById(battle.defenderId)?.hexId || battle.defenderHexId), HIGHLIGHT.currentDefender, 5);
  }

  function drawHexLayer() {
    const ctx = el.hexLayer.getContext("2d");
    ctx.clearRect(0, 0, el.hexLayer.width, el.hexLayer.height);
    drawBattleHighlights(ctx);
    if (app.state.selectedUnitId) drawHex(ctx, hexById(unitById(app.state.selectedUnitId)?.hexId), HIGHLIGHT.selected, 5);
    for (const hexId of app.reachable.keys()) drawHex(ctx, hexById(hexId), HIGHLIGHT.reachable, 3);
    if (app.state.selectedDefenderId) drawHex(ctx, hexById(unitById(app.state.selectedDefenderId)?.hexId), HIGHLIGHT.defender, 5);
    for (const attackerId of app.state.selectedAttackers) drawHex(ctx, hexById(unitById(attackerId)?.hexId), HIGHLIGHT.attack, 4);
    for (const hexId of app.legalRetreatSteps) drawHex(ctx, hexById(hexId), HIGHLIGHT.retreat, 4);
    if (app.state.advanceTask) drawHex(ctx, hexById(app.state.advanceTask.targetHexId), HIGHLIGHT.attack, 5);
  }

  function drawHex(ctx, hex, color, lineWidth) {
    if (!hex) return;
    const radius = 49;
    const points = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 180 * (-90 + 60 * i);
      points.push({ x: hex.center.x + Math.cos(angle) * radius, y: hex.center.y + Math.sin(angle) * radius });
    }
    ctx.save();
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.strokeStyle = color.replace(/0\.\d+\)/, "0.95)");
    ctx.lineWidth = lineWidth;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function unitBattleRole(unitId) {
    if (app.state.combatMode === "declare") {
      for (const battle of app.state.declaredCombats) {
        if (battle.defenderId === unitId) return "declared-defender";
        if (battle.attackerIds.includes(unitId)) return "declared-attacker";
      }
    } else {
      const activeBattle = currentBattle();
      if (activeBattle?.defenderId === unitId) return "current-defender";
      if (activeBattle?.attackerIds.includes(unitId)) return "current-attacker";
    }
    return "";
  }

  function drawUnits() {
    el.unitLayer.replaceChildren();
    for (const unit of liveUnits()) {
      const hex = hexById(unit.hexId);
      if (!hex) continue;
      const node = document.createElement("button");
      node.type = "button";
      node.className = "unit";
      node.dataset.side = unit.side;
      node.dataset.selected = String(unit.id === app.state.selectedUnitId || unit.id === app.state.selectedDefenderId || app.state.selectedAttackers.includes(unit.id));
      node.dataset.used = String(app.state.movedUnits.includes(unit.id) || app.state.usedAttackers.includes(unit.id) || app.state.usedDefenders.includes(unit.id));
      node.dataset.battleRole = unitBattleRole(unit.id);
      node.style.left = `${hex.center.x}px`;
      node.style.top = `${hex.center.y}px`;
      node.title = `${unitName(unit)} ${unit.combat}-${unit.movement}`;
      node.addEventListener("click", (event) => onUnitClick(event, unit.id));
      const image = document.createElement("img");
      image.src = unit.image;
      image.alt = unitName(unit);
      node.append(image);
      if (unit.disrupted) {
        const disrupted = document.createElement("span");
        disrupted.className = "disrupted";
        disrupted.textContent = "D";
        node.append(disrupted);
      }
      el.unitLayer.append(node);
    }
  }

  function drawSelectedUnit() {
    const unit = unitById(app.state.selectedUnitId) || unitById(app.state.selectedDefenderId);
    if (!unit) {
      el.selectedUnit.className = "selected-unit empty";
      el.selectedUnit.textContent = tr("ui.noSelection");
      return;
    }
    el.selectedUnit.className = "selected-unit";
    const wrap = document.createElement("div");
    wrap.className = "unit-card";
    const image = document.createElement("img");
    image.src = unit.image;
    image.alt = unitName(unit);
    const meta = document.createElement("div");
    meta.className = "unit-meta";
    const title = document.createElement("strong");
    title.textContent = unitName(unit);
    const stats = document.createElement("span");
    stats.textContent = `${sideLabel(unit.side)} · ${nationalityLabel(unit.nationality)} · ${unit.combat}-${unit.movement}`;
    const state = document.createElement("span");
    state.textContent = unit.disrupted ? tr("text.disrupted") : tr("text.ready");
    meta.append(title, stats, state);
    wrap.append(image, meta);
    if (canUndoLastMove(unit)) {
      const undo = document.createElement("button");
      undo.type = "button";
      undo.className = "undo-move-button";
      undo.textContent = tr("text.undoMove");
      undo.addEventListener("click", undoLastMove);
      wrap.append(undo);
    }
    el.selectedUnit.replaceChildren(wrap);
  }

  function drawCombatPanel() {
    el.combatComposer.replaceChildren();
    if (!isCombatPhase()) {
      el.combatComposer.textContent = "--";
      return;
    }
    if (app.state.combatMode === "declare") {
      el.combatComposer.textContent = tr("text.declareInOperations");
      return;
    }
    const battle = currentBattle();
    if (!battle) {
      el.combatComposer.textContent = app.state.declaredCombats.length ? tr("text.allDone") : tr("text.noBattle");
      return;
    }
    const card = document.createElement("div");
    card.className = "composer-card";
    const title = document.createElement("strong");
    title.textContent = `${tr("text.currentBattle")} · ${hexLabel(battle.defenderHexId)}`;
    const detail = document.createElement("span");
    detail.textContent = compactOddsText(battle.oddsAtResolution || battle.oddsAtDeclaration || "--");
    card.append(title, detail);
    el.combatComposer.append(card);
  }

  function drawCombatComposer() {
    const defender = unitById(app.state.selectedDefenderId);
    const attackers = app.state.selectedAttackers.map(unitById).filter(Boolean);
    const card = document.createElement("div");
    card.className = "composer-card";
    card.append(line(`${tr("text.selectedDefender")}: ${defender ? `${unitName(defender)} · ${hexLabel(defender.hexId)}` : "--"}`));
    const row = document.createElement("div");
    row.className = "pill-row";
    if (attackers.length) attackers.forEach((unit) => row.append(pill(`${unitName(unit)} · ${hexLabel(unit.hexId)}`)));
    else row.append(pill("--"));
    const odds = document.createElement("div");
    odds.className = "odds-preview";
    odds.textContent = previewOddsText(attackers, defender);
    const actions = document.createElement("div");
    actions.className = "composer-actions";
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = tr("text.addBattle");
    add.disabled = !defender || !attackers.length;
    add.addEventListener("click", declareBattle);
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = tr("text.clear");
    clear.addEventListener("click", () => {
      app.state.selectedDefenderId = null;
      app.state.selectedAttackers = [];
      draw();
    });
    actions.append(add, clear);
    card.append(line(`${tr("text.selectedAttackers")}:`), row, odds, actions);
    el.combatComposer.append(card);
  }

  function declarationFocusCard() {
    const defender = unitById(app.state.selectedDefenderId);
    const attackers = app.state.selectedAttackers.map(unitById).filter(Boolean);
    const card = document.createElement("div");
    card.className = "operation-card declaration-focus";
    if (defender) card.dataset.severity = "good";

    const title = document.createElement("strong");
    title.textContent = tr("text.currentDeclaration");
    card.append(title);
    card.append(line(`${tr("text.defenderOnly")}: ${defender ? hexLabel(defender.hexId) : "--"}`));

    const row = document.createElement("div");
    row.className = "pill-row";
    if (attackers.length) attackers.forEach((unit) => row.append(pill(hexLabel(unit.hexId))));
    else row.append(pill("--"));

    const odds = document.createElement("div");
    odds.className = "odds-preview";
    odds.textContent = previewOddsText(attackers, defender);

    const actions = document.createElement("div");
    actions.className = "composer-actions";
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = tr("text.addBattle");
    add.disabled = !defender || !attackers.length;
    add.addEventListener("click", declareBattle);
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = tr("text.clear");
    clear.addEventListener("click", () => {
      app.state.selectedDefenderId = null;
      app.state.selectedAttackers = [];
      draw();
    });
    actions.append(add, clear);

    card.append(line(`${tr("text.selectedAttackers")}:`), row, odds, actions);
    if (!defender) card.append(line(tr("text.chooseDefender")));
    return card;
  }

  function drawOperationsBoard() {
    el.operationsFocus.replaceChildren();
    el.battleList.replaceChildren();
    if (isCombatPhase() && app.state.combatMode === "resolve" && (app.state.retreatTask || app.state.advanceTask)) {
      appendCombatResolutionFocus();
      appendCombatListForCurrentMode();
      return;
    }
    if (isCombatPhase() && app.state.combatMode === "declare") {
      el.operationsFocus.append(declarationFocusCard());
      appendBattleListTitle(tr("text.declaredBattles"));
      if (!app.state.declaredCombats.length) {
        el.battleList.append(operationCard("", tr("text.noDeclared"), ""));
      } else {
        app.state.declaredCombats.forEach((battle, index) => el.battleList.append(declaredBattleRow(battle, index)));
      }
      return;
    }
    if (app.state.lastCombatResult) {
      appendCombatResolutionFocus();
    } else if (isCombatPhase() && app.state.combatMode === "resolve") {
      const battle = currentBattle();
      const details = battle
        ? [
          `${tr("text.defenderHex")}: ${hexLabel(battle.defenderHexId)}`,
          `${tr("text.odds")}: ${battle.oddsShort || compactOddsText(battle.oddsAtDeclaration)}`,
        ].join("\n")
        : tr("text.allDone");
      el.operationsFocus.append(operationCard(tr("text.combatSummary"), details, battle ? "" : "good"));
    } else {
      el.operationsFocus.append(operationCard(tr("text.phaseOrders"), phaseLabel(phase().id), ""));
      if (isMovementPhase() && canUndoLastMove(unitById(app.state.lastMove?.unitId))) {
        el.operationsFocus.append(lastMoveUndoCard());
      }
    }
    if (isCombatPhase() && app.state.combatMode === "declare") {
      if (!app.state.declaredCombats.length) {
        el.battleList.append(operationCard("", tr("text.noDeclared"), ""));
      } else {
        app.state.declaredCombats.forEach((battle, index) => el.battleList.append(declaredBattleRow(battle, index)));
      }
    } else if (isCombatPhase()) {
      appendBattleListTitle(tr("text.declaredBattles"));
      app.state.declaredCombats.forEach((battle) => el.battleList.append(resolutionBattleRow(battle)));
    }
  }

  function appendCombatResolutionFocus() {
    el.operationsFocus.append(combatResolutionFocusCard());
    const instruction = pendingCombatInstructionCard();
    if (instruction) el.operationsFocus.append(instruction);
  }

  function combatResolutionFocusCard() {
    const result = app.state.lastCombatResult;
    if (result) {
      const details = [
        `${tr("text.defenderHex")}: ${result.defenderHex}`,
        `${tr("text.odds")}: ${result.odds} · ${tr("text.die")}: ${result.roll}`,
        `${tr("text.result")}: ${combatResultLabel(result.result)}`,
        ...(result.events || []).map((event) => event.text),
      ].join("\n");
      const card = operationCard(tr("text.combatSummary"), details, result.events?.some((event) => event.type === "eliminated") ? "danger" : "good");
      card.classList.add("combat-resolution-focus");
      return card;
    }
    const battle = currentBattle();
    const details = battle
      ? [
        `${tr("text.defenderHex")}: ${hexLabel(battle.defenderHexId)}`,
        `${tr("text.odds")}: ${battle.oddsShort || compactOddsText(battle.oddsAtDeclaration)}`,
      ].join("\n")
      : tr("text.allDone");
    const card = operationCard(tr("text.combatSummary"), details, battle ? "" : "good");
    card.classList.add("combat-resolution-focus");
    return card;
  }

  function pendingCombatInstructionCard() {
    if (app.state.retreatTask) {
      const unit = unitById(app.state.retreatTask.unitIds[app.state.retreatTask.index]);
      const card = operationCard(tr("text.retreatInstruction"), tr("text.retreatPrompt", { unit: unitName(unit) }), "danger");
      card.classList.add("operation-instruction-card");
      return card;
    }
    if (app.state.advanceTask) {
      const card = operationCard(tr("text.advanceInstruction"), tr("text.advancePrompt", { hex: hexLabel(app.state.advanceTask.targetHexId) }), "good");
      card.classList.add("operation-instruction-card");
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "inline-skip-button";
      skip.textContent = tr("text.skip");
      skip.addEventListener("click", () => advanceUnit("skip"));
      card.append(skip);
      return card;
    }
    return null;
  }

  function lastMoveUndoCard() {
    const move = app.state.lastMove;
    const unit = unitById(move?.unitId);
    const card = operationCard(
      tr("text.undoMove"),
      unit ? `${unitName(unit)}: ${hexLabel(move.toHexId)} -> ${hexLabel(move.fromHexId)}` : "--",
      "good",
    );
    card.classList.add("operation-instruction-card");
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "inline-skip-button";
    undo.textContent = tr("text.undoMove");
    undo.addEventListener("click", undoLastMove);
    card.append(undo);
    return card;
  }

  function appendCombatListForCurrentMode() {
    if (!isCombatPhase()) return;
    appendBattleListTitle(tr("text.declaredBattles"));
    if (app.state.combatMode === "declare") {
      if (!app.state.declaredCombats.length) el.battleList.append(operationCard("", tr("text.noDeclared"), ""));
      else app.state.declaredCombats.forEach((battle, index) => el.battleList.append(declaredBattleRow(battle, index)));
      return;
    }
    app.state.declaredCombats.forEach((battle) => el.battleList.append(resolutionBattleRow(battle)));
  }

  function appendBattleListTitle(text) {
    const title = document.createElement("div");
    title.className = "battle-list-title";
    title.textContent = text;
    el.battleList.append(title);
  }

  function operationCard(title, body, severity = "") {
    const card = document.createElement("div");
    card.className = "operation-card";
    if (severity) card.dataset.severity = severity;
    if (title) {
      const strong = document.createElement("strong");
      strong.textContent = title;
      card.append(strong);
    }
    String(body || "").split("\n").forEach((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      if (text.includes("歼灭") || text.includes("eliminated")) p.className = "eliminated-line";
      card.append(p);
    });
    return card;
  }

  function declaredBattleRow(battle, index) {
    const row = document.createElement("div");
    row.className = "battle-row";
    row.dataset.declaration = "true";
    const title = document.createElement("strong");
    title.textContent = `#${index + 1} · ${hexLabel(battle.defenderHexId)}`;
    const meta = document.createElement("div");
    meta.className = "operation-meta";
    [battle.oddsShort || compactOddsText(battle.oddsAtDeclaration), phaseLabel(battle.phaseId)].forEach((text) => {
      const item = document.createElement("span");
      item.textContent = text;
      meta.append(item);
    });
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "battle-cancel-button";
    cancel.textContent = "X";
    cancel.title = tr("text.cancel");
    cancel.addEventListener("click", () => cancelDeclaredBattle(battle.id));
    row.append(title, meta, cancel);
    return row;
  }

  function resolutionBattleRow(battle) {
    const row = document.createElement("div");
    row.className = "battle-row";
    row.dataset.resolved = String(battle.resolved);
    row.dataset.current = String(currentBattle()?.id === battle.id);
    const title = document.createElement("strong");
    title.textContent = `${hexLabel(battle.defenderHexId)} · ${battle.resultCode ? combatResultLabel(battle.resultCode) : compactOddsText(battle.oddsShort || battle.oddsAtDeclaration)}`;
    const detail = document.createElement("small");
    detail.textContent = battle.roll ? `${tr("text.die")}: ${battle.roll}` : phaseLabel(battle.phaseId);
    row.append(title, detail);
    return row;
  }

  function compactOddsText(text) {
    return String(text || "--").split(";")[0];
  }

  function formatBattleTitle(battle) {
    return `${battle.attackerHexIds.map(hexLabel).join(", ")} -> ${hexLabel(battle.defenderHexId)}`;
  }

  function pill(text) {
    const node = document.createElement("span");
    node.className = "pill";
    node.textContent = text;
    return node;
  }

  function line(text) {
    const node = document.createElement("div");
    node.textContent = text;
    return node;
  }

  function drawLog() {
    el.logBlock.dataset.expanded = String(app.logExpanded);
    el.logToggleButton.textContent = app.logExpanded ? tr("ui.closeLog") : tr("ui.openLog");
    el.logList.replaceChildren();
    const messages = app.logExpanded ? app.state.log.slice(-80) : app.state.log.slice(-1);
    for (const message of messages) {
      const item = document.createElement("p");
      item.textContent = message;
      el.logList.append(item);
    }
    if (app.logExpanded) el.logList.scrollTop = el.logList.scrollHeight;
  }

  init();
})();
