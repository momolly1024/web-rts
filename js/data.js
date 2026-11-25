// 資料表：所有單位、建築、資源、成本、相剋與 AI 參數。調整平衡只改這裡。
// 顯示名稱不放這裡，一律在 js/i18n/ 以代號查找。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  RTS.data = {
    TICK: 0.05,            // 固定時間步長（秒）
    MAP_SIZE: 64,
    POP_MAX: 50,
    QUEUE_MAX: 5,
    START_VILLAGERS: 4,
    START_RESOURCES: { food: 200, wood: 200, gold: 100, stone: 0 },

    resources: ['food', 'wood', 'gold', 'stone'],

    players: [
      { color: '#3b82d6', dark: '#1d4b85' },    // 藍旗
      { color: '#d0473f', dark: '#7e211c' }     // 紅旗
    ],

    // 地圖上的天然物件
    nodes: {
      tree:  { resource: 'wood', amount: 100 },
      berry: { resource: 'food', amount: 200 },
      gold:  { resource: 'gold', amount: 700 },
      rock:  { resource: 'stone', amount: 300 },
      carcass: { resource: 'food', amount: 0 }      // 獸肉，份量由動物決定
    },

    // 傷害 = max(1, 攻擊力 * 相剋倍率 - 該攻擊類型的護甲)
    damageBonus: {
      melee:  { civilian: 1.0,  infantry: 1.0,  ranged: 1.4,  building: 0.8, animal: 1.0 },
      pierce: { civilian: 1.0,  infantry: 1.25, ranged: 0.9,  building: 0.3, animal: 1.0 }
    },

    units: {
      villager: {
        cost: { food: 50 }, trainTime: 12, pop: 1, hotkey: 'Q',
        hp: 40, speed: 2.4, vision: 5, armorType: 'civilian', armor: { melee: 0, pierce: 0 },
        attack: { type: 'melee', damage: 3, range: 0.8, cooldown: 1.6 },
        military: false, canBuild: true, carry: 10, gatherRate: { food: 0.9, wood: 0.8, gold: 0.7, stone: 0.7 },
        hunt: { range: 3.2, damage: 6, cooldown: 1.5 }     // 狩獵時的投擲攻擊
      },
      swordsman: {
        cost: { food: 60, gold: 20 }, trainTime: 14, pop: 1, hotkey: 'Q',
        hp: 75, speed: 2.3, vision: 5, armorType: 'infantry', armor: { melee: 1, pierce: 1 },
        attack: { type: 'melee', damage: 9, range: 0.8, cooldown: 1.2 },
        military: true, upgradeClass: 'melee'
      },
      archer: {
        cost: { wood: 40, gold: 35 }, trainTime: 16, pop: 1, hotkey: 'E',
        hp: 45, speed: 2.4, vision: 7, armorType: 'ranged', armor: { melee: 0, pierce: 0 },
        attack: { type: 'pierce', damage: 6, range: 4.5, cooldown: 1.6 },
        military: true, upgradeClass: 'ranged'
      }
    },

    // 動物：herd 可認領帶走、flee 受驚逃跑、fight 受攻擊反擊。food 為打倒後的獸肉量
    // wander：閒逛速度、離定點最遠距離（ownedRadius 為歸玩家後）、單次步長、停留秒數範圍
    animals: {
      sheep: {
        behavior: 'herd', hp: 14, speed: 1.6, food: 90, vision: 3, claimRadius: 3,
        wander: { speed: 0.5, radius: 2.5, ownedRadius: 1.2, step: 1.2, pause: [3, 8] },
        armorType: 'animal', armor: { melee: 0, pierce: 0 }
      },
      // 牲畜圈長出的小黑羊：不能宰，grows 秒後長成白羊
      lamb: {
        behavior: 'herd', young: true, hp: 8, speed: 1.4, food: 0, vision: 2, claimRadius: 3,
        grows: { into: 'sheep', time: 60 },
        wander: { speed: 0.4, radius: 2.5, ownedRadius: 1.2, step: 1, pause: [3, 8] },
        armorType: 'animal', armor: { melee: 0, pierce: 0 }
      },
      deer: {
        behavior: 'flee', hp: 24, speed: 3.0, food: 130, vision: 5,
        fleeRadius: 3, fleeDistance: 5, rest: 2.5, leash: 10,
        wander: { speed: 0.8, radius: 3.5, step: 1.5, pause: [2, 6] },
        armorType: 'animal', armor: { melee: 0, pierce: 0 }
      },
      boar: {
        behavior: 'fight', hp: 65, speed: 2.2, food: 260, vision: 4, leash: 9,
        wander: { speed: 0.6, radius: 3, step: 1.2, pause: [3, 7] },
        attack: { type: 'melee', damage: 7, range: 0.9, cooldown: 1.5 },
        armorType: 'animal', armor: { melee: 0, pierce: 0 }
      }
    },
    // 開局每一方的動物：[種類, 數量, 離出生點最近距離, 最遠距離]
    wildlife: [['sheep', 4, 5, 7], ['sheep', 2, 14, 20], ['deer', 4, 10, 14], ['boar', 2, 14, 19]],

    buildings: {
      townCenter: {
        cost: { wood: 300, gold: 100 }, size: 3, hp: 1200, buildTime: 80,
        pop: 5, vision: 7, trains: ['villager'], dropoff: ['food', 'wood', 'gold', 'stone'], hotkey: 'T',
        researches: ['handcart'],
        garrison: { capacity: 10, healRate: 1.5 },
        armorType: 'building', armor: { melee: 1, pierce: 2 }
      },
      house: {
        cost: { wood: 50 }, size: 2, hp: 300, buildTime: 16,
        pop: 5, vision: 3, trains: [], dropoff: false, hotkey: 'H',
        armorType: 'building', armor: { melee: 0, pierce: 1 }
      },
      barracks: {
        cost: { wood: 150 }, size: 3, hp: 600, buildTime: 30,
        pop: 0, vision: 4, trains: ['swordsman', 'archer'], dropoff: false, hotkey: 'B',
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      },
      blacksmith: {
        cost: { wood: 130 }, size: 2, hp: 450, buildTime: 28,
        pop: 0, vision: 4, trains: [], dropoff: false, hotkey: 'K',
        researches: ['meleeAttack', 'rangedAttack', 'meleeArmor', 'rangedArmor'],
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      },
      // 收集建築：dropoff 列出收取的資源
      lumberCamp: {
        cost: { wood: 100 }, size: 2, hp: 400, buildTime: 22,
        pop: 0, vision: 4, trains: [], dropoff: ['wood'], hotkey: 'L',
        researches: ['woodcutting'],
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      },
      miningCamp: {
        cost: { wood: 100 }, size: 2, hp: 400, buildTime: 22,
        pop: 0, vision: 4, trains: [], dropoff: ['gold', 'stone'], hotkey: 'N',
        researches: ['goldMining', 'stoneMining'],
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      },
      mill: {
        cost: { wood: 100 }, size: 2, hp: 400, buildTime: 22,
        pop: 0, vision: 4, trains: [], dropoff: ['food'], hotkey: 'M',
        researches: ['farmYield'], reseed: true,
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      },
      // 農田：可行走的平地建築，一次一人耕作，food 為每塊的食物量；需先有完工的磨坊
      farm: {
        cost: { wood: 60 }, size: 3, hp: 240, buildTime: 15,
        pop: 0, vision: 2, trains: [], dropoff: false, hotkey: 'C',
        walkable: true, farm: { food: 175 }, requires: 'mill',
        armorType: 'building', armor: { melee: 0, pierce: 0 }
      },
      // 牲畜圈：每 interval 秒長出一隻小黑羊；圈附近 radius 格內己方羊（含小羊）達 cap 隻就暫停
      pen: {
        cost: { wood: 120 }, size: 3, hp: 350, buildTime: 25,
        pop: 0, vision: 3, trains: [], dropoff: false, hotkey: 'O',
        walkable: true, pen: { interval: 50, cap: 5, radius: 4 },
        armorType: 'building', armor: { melee: 0, pierce: 1 }
      },
      market: {
        cost: { wood: 175 }, size: 3, hp: 700, buildTime: 40,
        pop: 0, vision: 5, trains: [], dropoff: false, hotkey: 'Y', market: true,
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      }
    },

    buildOrderList: ['house', 'barracks', 'blacksmith', 'townCenter',
      'lumberCamp', 'miningCamp', 'mill', 'farm', 'market', 'pen'],

    // 拆除完工建築：退回造價 × refund × 剩餘生命比例（無條件捨去）
    demolish: { refund: 0.75, exclude: ['townCenter', 'farm'] },

    // 市場：一次交易 lot 單位。price 為每 lot 的黃金基準價，買價 = price × (1 + fee)、賣價 = price × (1 - fee)。
    // 每次買進漲 step、賣出跌 step，限制在 min..max，之後每秒往 base 回穩 recover
    market: { lot: 100, base: 100, fee: 0.15, step: 6, min: 20, max: 300, recover: 0.4,
      goods: ['food', 'wood', 'stone'], hotkeys: { buy: ['Q', 'E', 'R'], sell: ['Z', 'C', 'V'] } },

    // 修理：修滿全部生命的花費為造價的 costFactor 倍；speed 為相對施工速度
    repair: { costFactor: 0.5, speed: 0.8 },

    // 鐵匠鋪研究：對該類別所有單位（現有與之後訓練的）生效。bonus 為該級增加量
    // 經濟研究：effects 為該級增加量。gather.<資源> 為採集速度比例、carry 為村民負重、
    // speed 為村民移動速度比例、farmFood 為之後完成或重種的農田食物量
    upgrades: {
      farmYield: {
        economy: true, hotkey: 'Q', levels: [
          { effects: { farmFood: 60 }, cost: { food: 75, wood: 75 }, time: 20 },
          { effects: { farmFood: 75 }, cost: { food: 125, wood: 125 }, time: 35 },
          { effects: { farmFood: 100 }, cost: { wood: 250, gold: 150 }, time: 50 }]
      },
      woodcutting: {
        economy: true, hotkey: 'Q', levels: [
          { effects: { 'gather.wood': 0.15 }, cost: { food: 100, wood: 50 }, time: 25 },
          { effects: { 'gather.wood': 0.15 }, cost: { food: 150, wood: 100 }, time: 35 },
          { effects: { 'gather.wood': 0.1 }, cost: { food: 300, wood: 200 }, time: 50 }]
      },
      goldMining: {
        economy: true, hotkey: 'Q', levels: [
          { effects: { 'gather.gold': 0.15 }, cost: { food: 100, wood: 75 }, time: 25 },
          { effects: { 'gather.gold': 0.15 }, cost: { food: 200, wood: 150 }, time: 40 }]
      },
      stoneMining: {
        economy: true, hotkey: 'E', levels: [
          { effects: { 'gather.stone': 0.15 }, cost: { food: 100, wood: 75 }, time: 25 },
          { effects: { 'gather.stone': 0.15 }, cost: { food: 200, wood: 150 }, time: 40 }]
      },
      handcart: {
        economy: true, hotkey: 'E', levels: [
          { effects: { carry: 3, speed: 0.1 }, cost: { food: 150, wood: 50 }, time: 30 },
          { effects: { carry: 5, speed: 0.1 }, cost: { food: 250, wood: 150 }, time: 45 }]
      },
      meleeAttack: {
        unitClass: 'melee', stat: 'attack', hotkey: 'Q', levels: [
          { bonus: 2, cost: { food: 100, gold: 50 }, time: 30 },
          { bonus: 2, cost: { food: 170, gold: 100 }, time: 45 }]
      },
      rangedAttack: {
        unitClass: 'ranged', stat: 'attack', hotkey: 'E', levels: [
          { bonus: 1, cost: { wood: 100, gold: 50 }, time: 30 },
          { bonus: 1, cost: { wood: 170, gold: 100 }, time: 45 }]
      },
      meleeArmor: {
        unitClass: 'melee', stat: 'armor', hotkey: 'R', levels: [
          { bonus: 1, cost: { food: 90, gold: 40 }, time: 25 },
          { bonus: 1, cost: { food: 150, gold: 80 }, time: 40 }]
      },
      rangedArmor: {
        unitClass: 'ranged', stat: 'armor', hotkey: 'F', levels: [
          { bonus: 1, cost: { wood: 90, gold: 40 }, time: 25 },
          { bonus: 1, cost: { wood: 150, gold: 80 }, time: 40 }]
      }
    },

    // 難度：只能覆寫下方 ai 的行為參數，不得改資源或戰鬥數值。普通即基準值
    difficultyOrder: ['easy', 'normal', 'hard'],
    defaultDifficulty: 'normal',
    difficulties: {
      easy: {
        ai: {
          thinkInterval: 2.5, graceTime: 480, villagerTarget: 10, attackSize: 4, waveGrowth: 1,
          attackSizeMax: 8, waveInterval: 150, armyMax: 10, maxBarracks: 1,
          blacksmith: { atArmy: 7, maxLevel: 1 },
          repair: { threshold: 0.4, workers: 1 },
          shelter: { radius: 6, minEnemies: 3, woundedBelow: 0 },
          hunt: { prey: false, range: 14, boarParty: 0 },
          scoutStart: 180,
          economy: { campAt: 4, millAt: 11, maxFarms: 8, reseedBuffer: 1, techAt: 12, techLevel: 1 }
        }
      },
      normal: { ai: {} },
      hard: {
        ai: {
          thinkInterval: 0.5, graceTime: 240, villagerTarget: 18, attackSize: 8, waveGrowth: 3,
          attackSizeMax: 20, waveInterval: 55, armyMax: 26, maxBarracks: 3,
          blacksmith: { atArmy: 5, maxLevel: 2 },
          repair: { threshold: 0.9, workers: 3 },
          shelter: { radius: 10, minEnemies: 2, woundedBelow: 0.5 },
          hunt: { prey: true, range: 20, boarParty: 4 },
          scoutStart: 45,
          economy: { campAt: 3, millAt: 8, maxFarms: 16, reseedBuffer: 3, techAt: 10, techLevel: 3 }
        }
      }
    },

    // AI 基準參數
    ai: {
      thinkInterval: 1.0,
      graceTime: 300,        // 開局緩衝（秒），此前 AI 不進攻
      villagerTarget: 14,
      gatherRatio: { food: 0.45, wood: 0.35, gold: 0.20 },
      attackSize: 6,         // 第一波人數
      waveGrowth: 2,
      attackSizeMax: 14,
      waveInterval: 75,      // 兩波之間至少間隔（秒）
      armyMax: 18,           // 軍隊人數上限（含訓練中）
      defendRadius: 11,
      maxBarracks: 2,
      blacksmith: { atArmy: 6, maxLevel: 2 },  // 軍隊達幾人後投資科技、最多研究到幾級
      repair: { threshold: 0.7, workers: 2 },  // 生命低於此比例就派幾位村民修理
      // 敵兵進入主堡 radius 格且達 minEnemies 人時村民避難；士兵生命低於 woundedBelow 時回堡療傷
      shelter: { radius: 8, minEnemies: 2, woundedBelow: 0.3 },
      // 是否獵鹿、獵食範圍、獵猛獸的人數（0 表示不獵）
      hunt: { prey: true, range: 16, boarParty: 0 },
      scoutStart: 90,        // 開局多久後開始偵查敵人（秒）
      // 經濟建設：幾人採同一資源且離收取建築遠就蓋收集建築、村民達幾人蓋磨坊、農田上限、
      // 預付重種保持幾次、村民達幾人開始研究經濟科技、經濟科技最多研究到幾級
      economy: { campAt: 3, millAt: 9, maxFarms: 12, reseedBuffer: 2, techAt: 12, techLevel: 2 }
    }
  };
})();
