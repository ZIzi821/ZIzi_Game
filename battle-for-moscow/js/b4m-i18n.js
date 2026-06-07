(function () {
  const STORAGE_KEY = "b4mLanguage";
  const DEFAULT_LANGUAGE = navigator.language && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  let language = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE;
  let isApplying = false;
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();

  const exact = new Map([
    ["Battle for Moscow", "台风行动"],
    ["Continue Game", "继续游戏"],
    ["Solitaire / Hotseat", "单人 / 本地双人"],
    ["Play with Tournament Rules", "使用锦标赛规则"],
    ["Setting Up", "部署阶段"],
    ["To Combat Phase", "进入战斗阶段"],
    ["To Russian Redeployment Phase", "进入苏军重新部署阶段"],
    ["Redeployment Phase", "重新部署阶段"],
    ["No more redeployment needed", "不再需要重新部署"],
    ["Undo", "撤销"],
    ["To German Combat Phase", "进入德军战斗阶段"],
    ["Combat Phase", "战斗阶段"],
    ["Go straight to movement phase", "直接进入移动阶段"],
    ["No more battle to announce", "没有更多战斗要宣告"],
    ["To Battles Resolution", "进入战斗结算"],
    ["To Movement Phase", "进入移动阶段"],
    ["Movement Phase", "移动阶段"],
    ["No more movement required", "不再需要移动"],
    ["To Other Player Turn", "进入另一方回合"],
    ["To Final Results", "进入最终结果"],
    ["Replacement Phase", "补充阶段"],
    ["No more replacement needed", "不再需要补充"],
    ["To Standard Replacement Phase", "进入标准补充阶段"],
    ["To Special Movement Phase", "进入特殊移动阶段"],
    ["Special Movement Phase", "特殊移动阶段"],
    ["No more special movement needed", "不再需要特殊移动"],
    ["New Game", "新游戏"],
    ["Sequence of Play", "游戏流程"],
    ["How To...", "如何操作"],
    ["Terrain Effects Chart", "地形效果表"],
    ["Combat Results Table", "战斗结果表"],
    ["Close", "关闭"],
    ["German Player Turn", "德军玩家回合"],
    ["Russian Player Turn", "苏军玩家回合"],
    ["... Add Battles", "……添加战斗"],
    ["... View Cities' Control", "……查看城市控制权"],
    ["German Decisive Victory!", "德军决定性胜利！"],
    ["German Major Victory!", "德军重大胜利！"],
    ["German Minor Victory!", "德军小胜！"],
    ["Russian Decisive Victory!", "苏军决定性胜利！"],
    ["Russian Major Victory!", "苏军重大胜利！"],
    ["Russian Minor Victory!", "苏军小胜！"],
    ["The German Army won!", "德军获胜！"],
    ["The Red Army won!", "苏军获胜！"],
    ["It is a draw!", "平局！"]
  ]);

  const replacements = [
    [/\"Battle for Moscow\" is a game originally designed by Frank Chadwick in 1986 to introduce players to wargaming \(rules\)\. The graphics for this version are based on the 2009 reprint by Victory Point Games\. All rights are reserved\./g, "《台风行动》原名 Battle for Moscow，由 Frank Chadwick 于 1986 年设计，用于向玩家介绍兵棋。此网页版本的图像基于 Victory Point Games 2009 年重印版。保留所有权利。"],
    [/For any question or feedback, please email/g, "如有问题或反馈，请发送邮件至"],
    [/Web-based version of the Battle for Moscow wargame/g, "台风行动网页兵棋版本"],
    [/rules/g, "规则"],
    [/Tournament Rules/g, "锦标赛规则"],
    [/vs/g, "对战"],
    [/October 2nd, 1941 - Turn 1\/7/g, "1941 年 10 月 2 日 - 第 1/7 回合"],
    [/October 10th, 1941 - Turn 2\/7/g, "1941 年 10 月 10 日 - 第 2/7 回合"],
    [/October 17th, 1941 - Turn 3\/7 \(Mud\)/g, "1941 年 10 月 17 日 - 第 3/7 回合（泥泞）"],
    [/November 1st, 1941 - Turn 4\/7 \(Mud\)/g, "1941 年 11 月 1 日 - 第 4/7 回合（泥泞）"],
    [/November 16th, 1941 - Turn 5\/7/g, "1941 年 11 月 16 日 - 第 5/7 回合"],
    [/November 23rd, 1941 - Turn 6\/7/g, "1941 年 11 月 23 日 - 第 6/7 回合"],
    [/December 1st, 1941 - Turn 7\/7/g, "1941 年 12 月 1 日 - 第 7/7 回合"],
    [/Set up one full-strength German unit on each hex containing a black cross\./g, "在每个带黑色十字的六角格上部署一个满编德军单位。"],
    [/The German army sets up one full-strength unit on each hex containing a black cross\./g, "德军会在每个带黑色十字的六角格上部署一个满编单位。"],
    [/Redeploy some, none or all three Russian \"reserve\" armies  located in the highlighted hexes\./g, "重新部署高亮格中的 0 到 3 个苏军预备集团军。"],
    [/Announce all the battles of this turn by selecting each set of defending and attacking units \(or skip combat and go to the movement phase\)\./g, "选择每组防守单位和进攻单位来宣告本回合所有战斗，也可以跳过战斗直接进入移动阶段。"],
    [/Upon choosing a defending unit, all compatible attacking units are selected\. Adjust the ones taking part in this battle by clicking on them\. Then, add each battle to the stack\./g, "选择防守单位后，所有可参战的进攻单位会被选中。点击单位可调整参战者，然后把该战斗加入待结算列表。"],
    [/The enemy is announcing the battles of this turn\.\.\./g, "敌方正在宣告本回合战斗……"],
    [/The enemy has announced all the battles for this turn\. Click below to highlight each battle or proceed to the resolution\./g, "敌方已宣告本回合所有战斗。点击下方可高亮各战斗，或继续进入结算。"],
    [/The enemy doesn't announce any battle for this turn and goes straight to the movement phase\./g, "敌方本回合不宣告战斗，直接进入移动阶段。"],
    [/Select all the units you choose to move and their destination in order to conclude the turn\./g, "选择要移动的单位及其目的地，以结束本回合。"],
    [/The enemy has chosen to complete the turn without moving any unit\./g, "敌方选择不移动任何单位并结束本回合。"],
    [/The enemy has selected units to move in order to complete this turn\./g, "敌方正在选择单位移动以结束本回合。"],
    [/Place the reinforcement unit in the eligible area of the map\./g, "把增援单位放置到地图上允许的区域。"],
    [/The enemy places the reinforcement unit in the eligible area of the map\./g, "敌方正在把增援单位放置到允许区域。"],
    [/But there is no valid location, so the only choice is to move to the next phase\./g, "但没有合法位置，因此只能进入下一阶段。"],
    [/Place new half-strength units in the eligible area of the map or flip a half-strength unit that is currently on the map over to its full-strength side\./g, "在允许区域放置新的半强度单位，或把地图上的半强度单位翻到满强度面。"],
    [/The enemy places new half-strength units in the eligible area of the map or flips half-strength units that are currently on the map over to their full-strength side\./g, "敌方正在放置新的半强度单位，或把现有半强度单位翻到满强度面。"],
    [/You have finished assigning your replacements\./g, "你已经完成补充分配。"],
    [/The enemy has finished assigning replacements\./g, "敌方已经完成补充分配。"],
    [/All units that begin this phase on a rail line may move along it\./g, "所有在铁路线上开始此阶段的单位都可以沿铁路移动。"],
    [/All armor\/panzer units may move\./g, "所有装甲/坦克单位都可以移动。"],
    [/Select the ones you choose to move and their destination\./g, "选择要移动的单位及其目的地。"],
    [/But the enemy has decided not to use this capability during this phase\./g, "但敌方决定本阶段不使用此能力。"],
    [/The battle has no effect\./g, "本次战斗无效果。"],
    [/The defending unit needs to retreat 2 hexes\./g, "防守单位需要后退 2 格。"],
    [/The defending unit loses 1 step and is retreated 2 hexes\./g, "防守单位损失 1 级并后退 2 格。"],
    [/The defending unit is eliminated\./g, "防守单位被消灭。"],
    [/Exchange!/g, "交换损失！"],
    [/One attacking unit needs to lose 1 step\./g, "一个进攻单位需要损失 1 级。"],
    [/All battles have been resolved\./g, "所有战斗已经结算。"],
    [/Select a valid destination/g, "选择一个合法目的地"],
    [/Use the option to advance/g, "可以选择前进"],
    [/or continue without/g, "或不前进并继续"],
    [/Select the attacking unit/g, "选择进攻单位"],
    [/Select the attacking unit\(s\) to match the defending unit's loss/g, "选择进攻单位以匹配防守方损失"],
    [/The selected attacking unit is eliminated during the exchange\./g, "被选中的进攻单位在交换中被消灭。"],
    [/The selected attacking unit loses 1 step during the exchange\./g, "被选中的进攻单位在交换中损失 1 级。"],
    [/The attacking unit is eliminated during the exchange\./g, "进攻单位在交换中被消灭。"],
    [/The attacking unit loses 1 step during the exchange\./g, "进攻单位在交换中损失 1 级。"],
    [/The attacking unit strength is already reduced so it is eliminated\./g, "该进攻单位已是减员面，因此被消灭。"],
    [/The defending unit strength is already reduced so it is eliminated\./g, "该防守单位已是减员面，因此被消灭。"],
    [/But its strength is already reduced so it is eliminated\./g, "但它已是减员面，因此被消灭。"],
    [/But there is no valid retreat so it is eliminated\./g, "但没有合法撤退路线，因此被消灭。"],
    [/It loses 1 step as it must retreat through an EZOC\./g, "它必须穿过敌方控制区撤退，因此损失 1 级。"],
    [/But it is in a major city, so it takes a step loss instead and doesn't retreat\./g, "但它位于主要城市，因此改为损失 1 级且不撤退。"],
    [/more point/g, "点"],
    [/to lose/g, "待损失"],
    [/replacement step/g, "个补充级数"],
    [/left to assign/g, "尚待分配"],
    [/Army in control of Moscow:/g, "莫斯科控制方："],
    [/Other cities:/g, "其他城市："],
    [/Here is a summary of the procedure of each game turn embedded in this implementation of Battle for Moscow\. For more details on this and other base characteristics of the game, please consult the rules\./g, "以下是《台风行动》每个游戏回合的流程摘要。更多基础规则请参考规则链接。"],
    [/German Replacement Phase: the Germans receive replacements \(except during turn 1\)\./g, "德军补充阶段：德军获得补充（第 1 回合除外）。"],
    [/German \(Special\) Panzer Movement Phase: all German armor\/panzer units may move\./g, "德军（特殊）坦克移动阶段：所有德军装甲/坦克单位可以移动。"],
    [/German Combat Phase: all German units may attack\./g, "德军战斗阶段：所有德军单位可以进攻。"],
    [/German Movement Phase: all German units may move \(including panzers that moved in Phase 2\)\./g, "德军移动阶段：所有德军单位可以移动（包括第 2 阶段已移动的坦克）。"],
    [/Russian Replacement Phase: the Russians receive replacements \(plus 1 reinforcement during turn 4\)\./g, "苏军补充阶段：苏军获得补充（第 4 回合另有 1 个增援）。"],
    [/Russian \(Special\) Rail Movement Phase: all Russian units that begin this Phase on a rail line may move along it\./g, "苏军（特殊）铁路移动阶段：所有在铁路线上开始此阶段的苏军单位可以沿铁路移动。"],
    [/Russian Combat Phase: all Russian units may attack\./g, "苏军战斗阶段：所有苏军单位可以进攻。"],
    [/Russian Movement Phase: all Russian units may move \(including those that moved by rail in Phase 6\)\./g, "苏军移动阶段：所有苏军单位可以移动（包括第 6 阶段已通过铁路移动的单位）。"],
    [/When entering a combat phase, start clicking on defending units that you wish to attack\./g, "进入战斗阶段后，先点击你想攻击的防守单位。"],
    [/For each of them,  all available attacking units are highlighted and the corresponding battle odds are automatically calculated and displayed on the dashboard\./g, "对每个防守单位，所有可用进攻单位会被高亮，战斗赔率会自动计算并显示在面板中。"],
    [/Click on the sign to add this battle to the list that will be resolved during the next step, and proceed to selecting the next battles of this turn if any\./g, "点击加号把该战斗加入下一步结算列表，然后继续选择本回合其他战斗。"],
    [/Who's controlling cities at the end of the game is a key victory condition: the Germans win if they control Moscow at the end of Game Turn 7\. The Russians win if they control Moscow and any one other city\. Any other result \(i\.e\., the Germans control every city but Moscow\) is a draw\./g, "游戏结束时的城市控制权是关键胜利条件：第 7 回合结束时德军控制莫斯科则德军胜；苏军控制莫斯科和任意另一座城市则苏军胜；其他结果（德军控制除莫斯科外所有城市）为平局。"],
    [/Each city's control is with the army whose units were the last ones to have entered that city\./g, "城市控制权归属于最后进入该城市的军队。"],
    [/In order to assess which city is under which army's control at any point throughout the game, simply click on the turn information bar to open a summary and highlight the cities' current status on the map\. Then, click again on the turn information to close the view\./g, "想查看当前城市控制权时，点击回合信息栏即可打开摘要并在地图上高亮城市状态；再次点击即可关闭。"],
    [/The German Army wins <strong>([0-9]+) points<\/strong> because it controls Moscow and Tula at the end of Game Turn 7\./g, "德军获得 <strong>$1 分</strong>，因为第 7 回合结束时控制莫斯科和图拉。"],
    [/The German Army wins <strong>([0-9]+) points<\/strong> because it controls Moscow at the end of Game Turn 7, while the Red Army still controls Tula\./g, "德军获得 <strong>$1 分</strong>，因为第 7 回合结束时控制莫斯科，但苏军仍控制图拉。"],
    [/The Red Army wins <strong>([0-9]+) point<\/strong> because it controls Moscow at the end of Game Turn 7, and the city is in communication, while the German Army controls Tula\./g, "苏军获得 <strong>$1 分</strong>，因为第 7 回合结束时控制莫斯科且交通线畅通，同时德军控制图拉。"],
    [/The Red Army wins <strong>([0-9]+) points<\/strong> because it controls Moscow and Tula at the end of Game Turn 7, and both cities are in communication\./g, "苏军获得 <strong>$1 分</strong>，因为第 7 回合结束时控制莫斯科和图拉，且两城交通线畅通。"],
    [/The Red Army wins <strong>([0-9]+) points<\/strong> because it controls Moscow and Tula at the end of Game Turn 7, but either or both cities are not in communication\./g, "苏军获得 <strong>$1 分</strong>，因为第 7 回合结束时控制莫斯科和图拉，但其中一城或两城交通线不畅通。"],
    [/The German Army wins <strong>([0-9]+) point<\/strong> because it controls Tula at the end of Game Turn 7, while the Red Army still controls Moscow, but Moscow is not in communication\./g, "德军获得 <strong>$1 分</strong>，因为第 7 回合结束时控制图拉，而苏军虽控制莫斯科但交通线不畅通。"],
    [/The German Army wins because it controls Moscow at the end of Game Turn 7\./g, "德军获胜，因为第 7 回合结束时控制莫斯科。"],
    [/The Red Army wins because it controls Moscow and one other city at the end of Game Turn 7\./g, "苏军获胜，因为第 7 回合结束时控制莫斯科和另一座城市。"],
    [/The Red Army still controls Moscow but the German Army controls all the other cities at the end of Game Turn 7\./g, "苏军仍控制莫斯科，但第 7 回合结束时德军控制其他所有城市，因此平局。"],
    [/Although they lost, the Germans get/g, "虽然战败，德军仍获得"],
    [/Although they lost, the Red Army gets/g, "虽然战败，苏军仍获得"],
    [/The Germans get an extra point because they have 12 or more Panzer steps on the map at the end of the game, bringing their total to/g, "德军额外获得 1 分，因为游戏结束时地图上有 12 个或更多坦克级数，总分变为"],
    [/The Red Army gets an extra point because the Germans have 7 or fewer Panzer steps on the map at the end of the game, bringing the Red Army's total to/g, "苏军额外获得 1 分，因为游戏结束时德军坦克级数为 7 或更少，苏军总分变为"],
    [/because they have 12 or more Panzer steps on the map at the end of the game\./g, "因为游戏结束时地图上有 12 个或更多坦克级数。"],
    [/because the Germans have 7 or fewer Panzer steps on the map at the end of the game\./g, "因为游戏结束时德军坦克级数为 7 或更少。"],
    [/German/g, "德军"],
    [/Germans/g, "德军"],
    [/Russian/g, "苏军"],
    [/Russians/g, "苏军"],
    [/Red Army/g, "苏军"],
    [/Moscow/g, "莫斯科"],
    [/Tula/g, "图拉"],
    [/Panzer/g, "坦克"],
    [/Combat/g, "战斗"],
    [/Movement/g, "移动"],
    [/Replacement/g, "补充"],
    [/Redeployment/g, "重新部署"],
    [/Special/g, "特殊"],
    [/Phase/g, "阶段"],
    [/Turn/g, "回合"],
    [/enemy/g, "敌方"],
    [/unit/g, "单位"],
    [/units/g, "单位"],
    [/battle/g, "战斗"],
    [/battles/g, "战斗"],
    [/points/g, "分"],
    [/point/g, "分"]
  ];

  replacements.sort((a, b) => b[0].source.length - a[0].source.length);

  function translateText(text) {
    if (language !== "zh") return text;
    const trimmed = text.trim();
    if (!trimmed) return text;
    if (exact.has(trimmed)) {
      return text.replace(trimmed, exact.get(trimmed));
    }
    let translated = text;
    replacements.forEach(([pattern, value]) => {
      translated = translated.replace(pattern, value);
    });
    return translated;
  }

  function translateTextNode(node) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const original = originalText.get(node);
    const translated = translateText(original);
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }

  function translateAttribute(element, attribute) {
    if (!element.hasAttribute(attribute)) return;
    let stored = originalAttributes.get(element);
    if (!stored) {
      stored = {};
      originalAttributes.set(element, stored);
    }
    if (!Object.prototype.hasOwnProperty.call(stored, attribute)) {
      stored[attribute] = element.getAttribute(attribute);
    }
    const translated = translateText(stored[attribute]);
    if (element.getAttribute(attribute) !== translated) element.setAttribute(attribute, translated);
  }

  function walk(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return /[A-Za-z]/.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(translateTextNode);
    root.querySelectorAll?.("[title], [aria-label], [alt], meta[content]").forEach((element) => {
      ["title", "aria-label", "alt", "content"].forEach((attribute) => translateAttribute(element, attribute));
    });
    document.title = language === "zh" ? "台风行动" : "Battle for Moscow";
  }

  function applyLanguage() {
    isApplying = true;
    walk(document);
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("#b4m_lang_switch button").forEach((button) => {
      button.classList.toggle("active", button.dataset.lang === language);
    });
    isApplying = false;
  }

  function setLanguage(nextLanguage) {
    language = nextLanguage;
    localStorage.setItem(STORAGE_KEY, language);
    applyLanguage();
  }

  function createSwitcher() {
    if (document.getElementById("b4m_lang_switch")) return;
    const switcher = document.createElement("div");
    switcher.id = "b4m_lang_switch";
    switcher.setAttribute("aria-label", "Language / 语言");
    [
      ["zh", "中文"],
      ["en", "EN"]
    ].forEach(([code, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.lang = code;
      button.textContent = label;
      button.addEventListener("click", () => setLanguage(code));
      switcher.appendChild(button);
    });
    document.body.appendChild(switcher);
  }

  document.addEventListener("DOMContentLoaded", () => {
    createSwitcher();
    applyLanguage();
    const observer = new MutationObserver((mutations) => {
      if (isApplying) return;
      const targets = new Set();
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") targets.add(mutation.target.parentElement || document);
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) targets.add(node);
          if (node.nodeType === Node.TEXT_NODE && node.parentElement) targets.add(node.parentElement);
        });
      });
      if (!targets.size) return;
      isApplying = true;
      targets.forEach((target) => walk(target));
      document.querySelectorAll("#b4m_lang_switch button").forEach((button) => {
        button.classList.toggle("active", button.dataset.lang === language);
      });
      isApplying = false;
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
