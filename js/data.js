// 資料表：所有單位、建築、資源、成本、相剋與 AI 參數。調整平衡只改這裡。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  RTS.data = {
    TICK: 0.05,            // 固定時間步長（秒）
    MAP_SIZE: 64,
    POP_MAX: 50,
    QUEUE_MAX: 5,
    START_VILLAGERS: 4,
    START_RESOURCES: { food: 200, wood: 200, gold: 100 },

    resources: ['food', 'wood', 'gold'],
    resourceNames: { food: '食物', wood: '木材', gold: '黃金' },

    players: [
      { name: '藍旗領主', color: '#3b82d6', dark: '#1d4b85' },
      { name: '紅旗領主', color: '#d0473f', dark: '#7e211c' }
    ],

    // 地圖上的天然物件
    nodes: {
      tree:  { name: '樹木', resource: 'wood', amount: 100 },
      berry: { name: '果叢', resource: 'food', amount: 200 },
      gold:  { name: '金礦', resource: 'gold', amount: 500 },
      rock:  { name: '岩石', resource: null,   amount: 0 }
    },

    // 傷害 = max(1, 攻擊力 * 相剋倍率 - 該攻擊類型的護甲)
    attackTypes: { melee: '近戰', pierce: '穿刺' },
    armorTypes: { civilian: '平民', infantry: '步兵', ranged: '射手', building: '建築' },
    damageBonus: {
      melee:  { civilian: 1.0,  infantry: 1.0,  ranged: 1.4,  building: 0.8 },
      pierce: { civilian: 1.0,  infantry: 1.25, ranged: 0.9,  building: 0.3 }
    },

    units: {
      villager: {
        name: '村民', cost: { food: 50 }, trainTime: 12, pop: 1, hotkey: 'Q',
        hp: 40, speed: 2.4, vision: 5, armorType: 'civilian', armor: { melee: 0, pierce: 0 },
        attack: { type: 'melee', damage: 3, range: 0.8, cooldown: 1.6 },
        military: false, canBuild: true, carry: 10, gatherRate: { food: 0.9, wood: 0.8, gold: 0.7 }
      },
      swordsman: {
        name: '劍士', cost: { food: 60, gold: 20 }, trainTime: 14, pop: 1, hotkey: 'Q',
        hp: 75, speed: 2.3, vision: 5, armorType: 'infantry', armor: { melee: 1, pierce: 1 },
        attack: { type: 'melee', damage: 9, range: 0.8, cooldown: 1.2 },
        military: true
      },
      archer: {
        name: '弓箭手', cost: { wood: 40, gold: 35 }, trainTime: 16, pop: 1, hotkey: 'E',
        hp: 45, speed: 2.4, vision: 7, armorType: 'ranged', armor: { melee: 0, pierce: 0 },
        attack: { type: 'pierce', damage: 6, range: 4.5, cooldown: 1.6 },
        military: true
      }
    },

    buildings: {
      townCenter: {
        name: '主堡', cost: { wood: 300, gold: 100 }, size: 3, hp: 1200, buildTime: 80,
        pop: 5, vision: 7, trains: ['villager'], dropoff: true, hotkey: 'T',
        armorType: 'building', armor: { melee: 1, pierce: 2 }
      },
      house: {
        name: '房屋', cost: { wood: 50 }, size: 2, hp: 300, buildTime: 16,
        pop: 5, vision: 3, trains: [], dropoff: false, hotkey: 'H',
        armorType: 'building', armor: { melee: 0, pierce: 1 }
      },
      barracks: {
        name: '兵營', cost: { wood: 150 }, size: 3, hp: 600, buildTime: 30,
        pop: 0, vision: 4, trains: ['swordsman', 'archer'], dropoff: false, hotkey: 'B',
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      }
    },

    buildOrderList: ['house', 'barracks', 'townCenter'],

    // 難度：只能覆寫下方 ai 的行為參數，不得改資源或戰鬥數值。普通即基準值
    difficultyOrder: ['easy', 'normal', 'hard'],
    defaultDifficulty: 'normal',
    difficulties: {
      easy: {
        name: '簡單',
        ai: {
          thinkInterval: 2.5, graceTime: 480, villagerTarget: 10, attackSize: 4, waveGrowth: 1,
          attackSizeMax: 8, waveInterval: 150, armyMax: 10, maxBarracks: 1
        }
      },
      normal: { name: '普通', ai: {} },
      hard: {
        name: '困難',
        ai: {
          thinkInterval: 0.5, graceTime: 240, villagerTarget: 18, attackSize: 8, waveGrowth: 3,
          attackSizeMax: 20, waveInterval: 55, armyMax: 26, maxBarracks: 3
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
      maxBarracks: 2
    }
  };
})();
