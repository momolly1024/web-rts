// 資料表：所有單位、建築、資源、成本、相剋與 AI 參數。調整平衡只改這裡。
// 顯示名稱不放這裡，一律在 js/i18n/ 以代號查找。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  RTS.data = {
    TICK: 0.05,            // 固定時間步長（秒）
    MAP_SIZE: 64,
    QUEUE_MAX: 5,
    START_VILLAGERS: 4,
    START_RESOURCES: { food: 200, wood: 200, gold: 100, stone: 0 },

    resources: ['food', 'wood', 'gold', 'stone'],

    // 時代：0 黑暗、1 封建、2 城堡。單位、建築與各級研究可用 age 標註最低時代（未標為 0）
    ages: ['dark', 'feudal', 'castle'],

    players: [
      { color: '#3b82d6', dark: '#1d4b85' },    // 藍旗
      { color: '#d0473f', dark: '#7e211c' }     // 紅旗
    ],

    // 文明：開局決定的被動加成。effects 沿用研究效果代號（見下方 upgrades 說明），
    // classBonus 依兵種類別（upgradeClass）、unitBonus 依單一兵種，可加 hp、attack、armor、range
    civOrder: ['greenwood', 'ironrock', 'goldplain'],
    // 負值是弱點。unique 為只有該文明能訓練的兵種（單位以 civ 標註）
    civs: {
      greenwood: {
        unique: 'ranger', effects: { 'gather.wood': 0.3 },
        classBonus: { ranged: { range: 1 } }, unitBonus: { cavalry: { hp: -20 } }
      },
      ironrock: {
        unique: 'stoneguard', effects: { 'gather.gold': 0.3, 'gather.stone': 0.3, 'tower.range': 2, speed: -0.1 },
        classBonus: { melee: { armor: 2 } }
      },
      goldplain: {
        unique: 'lancer', effects: { farmFood: 120, speed: 0.2 },
        classBonus: { ranged: { range: -0.5 } }, unitBonus: { cavalry: { hp: 40 }, lancer: { hp: 40 } }
      }
    },

    // 地圖上的天然物件
    nodes: {
      tree:  { resource: 'wood', amount: 100 },
      berry: { resource: 'food', amount: 200 },
      gold:  { resource: 'gold', amount: 700 },
      rock:  { resource: 'stone', amount: 300 },
      carcass: { resource: 'food', amount: 0 }      // 獸肉，份量由動物決定
    },

    // 電腦用的相剋表：兵種 → 它適合對付的敵方兵種
    counters: {
      swordsman: ['archer', 'spearman', 'skirmisher'],
      stoneguard: ['archer', 'spearman', 'skirmisher'],
      spearman: ['cavalry', 'lancer'],
      skirmisher: ['archer', 'longbowman', 'ranger'],
      archer: ['spearman'],
      longbowman: ['spearman'],
      ranger: ['spearman'],
      cavalry: ['archer', 'longbowman', 'ranger', 'skirmisher'],
      lancer: ['archer', 'longbowman', 'ranger', 'skirmisher']
    },

    // 傷害 = max(1, 攻擊力 * 相剋倍率 - 該攻擊類型的護甲)
    // 單位的 attack.bonus 可針對特定護甲類型覆寫倍率（例如長槍兵對騎兵）
    damageBonus: {
      melee:  { civilian: 1.0,  infantry: 1.0,  ranged: 1.4,  cavalry: 1.0,  siege: 1.0, building: 0.8, animal: 1.0 },
      pierce: { civilian: 1.0,  infantry: 1.25, ranged: 0.9,  cavalry: 0.75, siege: 0.2, building: 0.3, animal: 1.0 }
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
      // 長槍兵：便宜、對騎兵傷害極高，但打不過劍士與弓箭手
      spearman: {
        cost: { food: 35, wood: 25 }, trainTime: 12, pop: 1, hotkey: 'F', age: 1,
        hp: 45, speed: 2.4, vision: 5, armorType: 'infantry', armor: { melee: 0, pierce: 0 },
        attack: { type: 'melee', damage: 4, range: 0.9, cooldown: 1.2, bonus: { cavalry: 5.5 } },
        military: true, upgradeClass: 'melee'
      },
      // 騎兵：快、血厚、穿刺護甲高，衝散弓箭手
      cavalry: {
        cost: { food: 80, gold: 50 }, trainTime: 22, pop: 1, hotkey: 'Q', age: 1,
        hp: 110, speed: 3.4, vision: 6, armorType: 'cavalry', armor: { melee: 2, pierce: 2 },
        attack: { type: 'melee', damage: 8, range: 0.8, cooldown: 1.4 },
        military: true, upgradeClass: 'melee'
      },
      // 治療者：不能攻擊，自動替附近受傷的己方單位回血（攻城槌除外）
      healer: {
        cost: { gold: 100 }, trainTime: 30, pop: 1, hotkey: 'Q', age: 2,
        hp: 30, speed: 2.1, vision: 8, armorType: 'civilian', armor: { melee: 0, pierce: 0 },
        attack: null, heal: { rate: 1.5, range: 4 }, military: true
      },
      // 攻城槌：只打建築、傷害極高，幾乎不怕箭；慢
      ram: {
        cost: { wood: 160, gold: 75 }, trainTime: 30, pop: 1, hotkey: 'Q', age: 2,
        hp: 200, speed: 1.4, vision: 4, armorType: 'siege', armor: { melee: 0, pierce: 8 },
        attack: { type: 'melee', damage: 3, range: 0.9, cooldown: 3, bonus: { building: 40 }, buildingsOnly: true },
        military: true, noHeal: true
      },
      // 標槍兵：便宜、不用黃金，對弓箭手傷害極高、穿刺護甲高，但很怕近戰
      skirmisher: {
        cost: { food: 25, wood: 35 }, trainTime: 14, pop: 1, hotkey: 'Q', age: 1,
        hp: 35, speed: 2.4, vision: 6, armorType: 'ranged', armor: { melee: 0, pierce: 3 },
        attack: { type: 'pierce', damage: 3, range: 4, cooldown: 2, bonus: { ranged: 3.5 } },
        military: true, upgradeClass: 'ranged'
      },
      // 長弓手：靶場的強化弓兵，射得更遠更痛也更耐打，較貴
      longbowman: {
        cost: { wood: 50, gold: 45 }, trainTime: 18, pop: 1, hotkey: 'E', age: 1,
        hp: 55, speed: 2.3, vision: 8, armorType: 'ranged', armor: { melee: 0, pierce: 1 },
        attack: { type: 'pierce', damage: 7, range: 5.5, cooldown: 1.6 },
        military: true, upgradeClass: 'ranged'
      },
      archer: {
        cost: { wood: 40, gold: 35 }, trainTime: 16, pop: 1, hotkey: 'E',
        hp: 45, speed: 2.4, vision: 7, armorType: 'ranged', armor: { melee: 0, pierce: 0 },
        attack: { type: 'pierce', damage: 6, range: 4.5, cooldown: 1.6 },
        military: true, upgradeClass: 'ranged'
      },
      // 蒼林專屬。游獵手：跑得快、看得遠、射得勤，但單發輕、血薄
      ranger: {
        civ: 'greenwood', cost: { wood: 45, gold: 30 }, trainTime: 15, pop: 1, hotkey: 'F', age: 1,
        hp: 40, speed: 3.0, vision: 9, armorType: 'ranged', armor: { melee: 0, pierce: 0 },
        attack: { type: 'pierce', damage: 5, range: 4.5, cooldown: 1.4 },
        military: true, upgradeClass: 'ranged'
      },
      // 鐵岩專屬。岩衛：血厚甲重的步兵，很慢
      stoneguard: {
        civ: 'ironrock', cost: { food: 70, gold: 35 }, trainTime: 20, pop: 1, hotkey: 'C', age: 1,
        hp: 120, speed: 1.9, vision: 5, armorType: 'infantry', armor: { melee: 2, pierce: 3 },
        attack: { type: 'melee', damage: 9, range: 0.8, cooldown: 1.5 },
        military: true, upgradeClass: 'melee'
      },
      // 金原專屬。槍騎兵：最快，專衝弓兵與村民，比騎兵脆
      lancer: {
        civ: 'goldplain', cost: { food: 70, gold: 45 }, trainTime: 18, pop: 1, hotkey: 'R', age: 1,
        hp: 85, speed: 3.8, vision: 6, armorType: 'cavalry', armor: { melee: 1, pierce: 1 },
        attack: { type: 'melee', damage: 8, range: 0.9, cooldown: 1.3, bonus: { ranged: 2, civilian: 1.6 } },
        military: true, upgradeClass: 'melee'
      }
    },

    // 釣魚：每次等待 wait 秒（隨機）後依 weight 抽一種收穫；最後 bite 秒是上鉤提示。水池不會枯竭
    // 滑鼠滾輪縮放：各級倍率與開局使用的那一級
    zoom: { levels: [0.9, 1, 1.1, 1.2, 1.3], start: 1 },

    fishing: {
      wait: [10, 40], bite: 1.5,
      catches: [
        { id: 'boot', weight: 15, food: 0 },
        { id: 'small', weight: 55, food: 8 },
        { id: 'big', weight: 25, food: 20 },
        { id: 'golden', weight: 5, food: 60 }
      ]
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
        researches: ['handcart', 'age'],
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
        pop: 0, vision: 4, trains: ['swordsman', 'archer', 'spearman', 'stoneguard'], dropoff: false, hotkey: 'B', researches: ['swordLine'],
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      },
      blacksmith: {
        cost: { wood: 130 }, size: 2, hp: 450, buildTime: 28, age: 1,
        pop: 0, vision: 4, trains: [], dropoff: false, hotkey: 'K',
        researches: ['meleeAttack', 'rangedAttack', 'meleeArmor', 'rangedArmor'],
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      },
      archeryRange: {
        cost: { wood: 150 }, size: 3, hp: 600, buildTime: 30, age: 1,
        pop: 0, vision: 4, trains: ['skirmisher', 'longbowman', 'ranger'], dropoff: false, hotkey: 'R', researches: ['archerLine'],
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      },
      stable: {
        cost: { wood: 150 }, size: 3, hp: 600, buildTime: 30, age: 1,
        pop: 0, vision: 4, trains: ['cavalry', 'lancer'], dropoff: false, hotkey: 'V', researches: ['cavalryLine'],
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      },
      // 箭塔：自動射擊範圍內的敵方單位
      tower: {
        cost: { wood: 25, stone: 125 }, size: 1, hp: 700, buildTime: 30, age: 1,
        pop: 0, vision: 8, trains: [], dropoff: false, hotkey: 'I', researches: ['towerUpgrade'],
        attack: { type: 'pierce', damage: 5, range: 7, cooldown: 2 },
        // 單座改建：兩種擇一、只影響這一座，可與全體強化並存
        branches: {
          range: { hotkey: 'E', age: 1, cost: { wood: 50, stone: 50 }, time: 30, effects: { range: 2 } },
          damage: { hotkey: 'R', age: 1, cost: { stone: 50, gold: 40 }, time: 30, effects: { damage: 4 } }
        },
        armorType: 'building', armor: { melee: 2, pierce: 4 }
      },
      // 石牆：一格，拖一條線一次放多格
      wall: {
        cost: { stone: 5 }, size: 1, hp: 600, buildTime: 5, age: 1,
        pop: 0, vision: 1, trains: [], dropoff: false, hotkey: 'Z', line: true,
        armorType: 'building', armor: { melee: 4, pierce: 6 }
      },
      // 城門：自己人可通過、別人不行；可蓋在空地或直接取代自己的城牆
      gate: {
        cost: { stone: 30 }, size: 1, hp: 900, buildTime: 10, age: 1,
        pop: 0, vision: 2, trains: [], dropoff: false, hotkey: 'U', gate: true, walkable: true,
        armorType: 'building', armor: { melee: 4, pierce: 6 }
      },
      temple: {
        cost: { wood: 175 }, size: 3, hp: 700, buildTime: 40, age: 2,
        pop: 0, vision: 5, trains: ['healer'], dropoff: false, hotkey: 'J',
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      },
      siegeWorkshop: {
        cost: { wood: 200 }, size: 3, hp: 700, buildTime: 40, age: 2,
        pop: 0, vision: 4, trains: ['ram'], dropoff: false, hotkey: 'E',
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
      // 牲畜圈：圈內有 parents 隻以上己方白羊時計時，每 interval 秒生一隻小黑羊；圈內羊（含小羊）達 cap 隻就暫停
      pen: {
        cost: { wood: 120 }, size: 3, hp: 350, buildTime: 25,
        pop: 0, vision: 3, trains: [], dropoff: false, hotkey: 'O',
        walkable: true, pen: { interval: 50, cap: 6, parents: 2 },
        armorType: 'building', armor: { melee: 0, pierce: 1 }
      },
      market: {
        cost: { wood: 175 }, size: 3, hp: 700, buildTime: 40, age: 1,
        pop: 0, vision: 5, trains: [], dropoff: false, hotkey: 'Y', market: true,
        armorType: 'building', armor: { melee: 1, pierce: 1 }
      }
    },

    // 村民的建造選單分兩頁（Tab 切換），快捷鍵兩頁都有效
    buildPages: {
      eco: ['house', 'townCenter', 'lumberCamp', 'miningCamp', 'mill', 'farm', 'pen', 'market'],
      mil: ['barracks', 'archeryRange', 'stable', 'blacksmith', 'tower', 'wall', 'gate', 'temple', 'siegeWorkshop']
    },
    buildOrderList: ['house', 'barracks', 'blacksmith', 'townCenter',
      'lumberCamp', 'miningCamp', 'mill', 'farm', 'market', 'pen', 'archeryRange', 'stable',
      'tower', 'wall', 'gate', 'temple', 'siegeWorkshop'],

    // 人口沒有上限，房屋蓋多少就加多少
    // 成就：「贏過了幾 % 的玩家」用的對照表 [數量, 百分比]。沒有真實玩家資料，這是估計值，可自行調整
    achievements: {
      // 其他成就的門檻：blitz、pacifist 為秒數，hoarder 為結束時四種資源總和，其餘為次數
      need: {
        blitz: 600, slayer: 30, razer: 10, expander: 2, merciless: 10, boarSnack: 1, butcher: 5,
        demolisher: 3, merchant: 10, hoarder: 2000, pacifist: 300, fullHouse: 50
      },
      sheep: [[0, 0], [1, 10], [2, 25], [4, 45], [6, 62], [8, 75], [10, 84], [12, 90], [15, 95], [20, 98], [30, 99]]
    },

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
      // 時代升級：在主堡研究；needs 為需先完工的本時代建築（from 其中 count 種）
      age: {
        age: true, hotkey: 'R', levels: [
          { cost: { food: 400 }, time: 60, needs: { count: 2, from: ['barracks', 'lumberCamp', 'miningCamp', 'mill'] } },
          { cost: { food: 700, gold: 200 }, time: 90, needs: { count: 2, from: ['blacksmith', 'archeryRange', 'stable', 'market'] } }]
      },
      farmYield: {
        economy: true, hotkey: 'Q', levels: [
          { effects: { farmFood: 60 }, cost: { food: 75, wood: 75 }, time: 20 },
          { age: 1, effects: { farmFood: 75 }, cost: { food: 125, wood: 125 }, time: 35 },
          { age: 2, effects: { farmFood: 100 }, cost: { wood: 250, gold: 150 }, time: 50 }]
      },
      woodcutting: {
        economy: true, hotkey: 'Q', levels: [
          { effects: { 'gather.wood': 0.15 }, cost: { food: 100, wood: 50 }, time: 25 },
          { age: 1, effects: { 'gather.wood': 0.15 }, cost: { food: 150, wood: 100 }, time: 35 },
          { age: 2, effects: { 'gather.wood': 0.1 }, cost: { food: 300, wood: 200 }, time: 50 }]
      },
      goldMining: {
        economy: true, hotkey: 'Q', levels: [
          { effects: { 'gather.gold': 0.15 }, cost: { food: 100, wood: 75 }, time: 25 },
          { age: 1, effects: { 'gather.gold': 0.15 }, cost: { food: 200, wood: 150 }, time: 40 }]
      },
      stoneMining: {
        economy: true, hotkey: 'E', levels: [
          { effects: { 'gather.stone': 0.15 }, cost: { food: 100, wood: 75 }, time: 25 },
          { age: 1, effects: { 'gather.stone': 0.15 }, cost: { food: 200, wood: 150 }, time: 40 }]
      },
      handcart: {
        economy: true, hotkey: 'E', levels: [
          { age: 1, effects: { carry: 3, speed: 0.1 }, cost: { food: 150, wood: 50 }, time: 30 },
          { age: 2, effects: { carry: 5, speed: 0.1 }, cost: { food: 250, wood: 150 }, time: 45 }]
      },
      // 兵種升級：unitType 的現有與之後訓練的單位一起變強，名稱與外觀改變。tier 為該級增加量
      swordLine: {
        unitType: 'swordsman', hotkey: 'R', levels: [
          { age: 1, tier: { hp: 15, attack: 2, armor: 1 }, cost: { food: 100, gold: 40 }, time: 30 },
          { age: 2, tier: { hp: 20, attack: 2, armor: 1 }, cost: { food: 200, gold: 100 }, time: 45 }]
      },
      archerLine: {
        unitType: 'longbowman', hotkey: 'R', levels: [
          { age: 2, tier: { hp: 10, attack: 1, range: 1 }, cost: { food: 150, gold: 100 }, time: 40 }]
      },
      cavalryLine: {
        unitType: 'cavalry', hotkey: 'E', levels: [
          { age: 2, tier: { hp: 40, attack: 3, armor: 1 }, cost: { food: 250, gold: 150 }, time: 50 }]
      },
      // 箭塔強化：在箭塔研究，所有箭塔攻擊與射程提高
      towerUpgrade: {
        hotkey: 'Q', levels: [
          { age: 2, effects: { 'tower.damage': 3, 'tower.range': 1 }, cost: { food: 100, stone: 100 }, time: 40 }]
      },
      meleeAttack: {
        unitClass: 'melee', stat: 'attack', hotkey: 'Q', levels: [
          { age: 1, bonus: 2, cost: { food: 100, gold: 50 }, time: 30 },
          { age: 2, bonus: 2, cost: { food: 170, gold: 100 }, time: 45 }]
      },
      rangedAttack: {
        unitClass: 'ranged', stat: 'attack', hotkey: 'E', levels: [
          { age: 1, bonus: 1, cost: { wood: 100, gold: 50 }, time: 30 },
          { age: 2, bonus: 1, cost: { wood: 170, gold: 100 }, time: 45 }]
      },
      meleeArmor: {
        unitClass: 'melee', stat: 'armor', hotkey: 'R', levels: [
          { age: 1, bonus: 1, cost: { food: 90, gold: 40 }, time: 25 },
          { age: 2, bonus: 1, cost: { food: 150, gold: 80 }, time: 40 }]
      },
      rangedArmor: {
        unitClass: 'ranged', stat: 'armor', hotkey: 'F', levels: [
          { age: 1, bonus: 1, cost: { wood: 90, gold: 40 }, time: 25 },
          { age: 2, bonus: 1, cost: { wood: 150, gold: 80 }, time: 40 }]
      }
    },

    // 難度：只能覆寫下方 ai 的行為參數，不得改資源或戰鬥數值。普通即基準值
    difficultyOrder: ['easy', 'normal', 'hard'],
    // 隱藏難度：在難度選單連點「困難」五次才出現
    hiddenDifficulties: ['peaceful'],
    secretClicks: 5,
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
          economy: { campAt: 4, millAt: 11, maxFarms: 8, reseedBuffer: 1, techAt: 12, techLevel: 1 },
          age: { at: [10, 99], army: [4, 10], maxAge: 1 },
          military: { towers: 0, rams: 0, tiers: false },
          expand: { towns: 1, minAge: 1, minVillagers: 10, minArmy: 6, extraVillagers: 0 },
          counter: { bias: 0, memory: 60 },
          late: null
        }
      },
      normal: { ai: {} },
      // 和平世界：電腦照常發展、會防守，但永遠不進攻
      peaceful: { ai: { attack: false } },
      hard: {
        ai: {
          thinkInterval: 0.5, graceTime: 240, villagerTarget: 18, attackSize: 8, waveGrowth: 3,
          attackSizeMax: 20, waveInterval: 55, armyMax: 26, maxBarracks: 3,
          blacksmith: { atArmy: 5, maxLevel: 2 },
          repair: { threshold: 0.9, workers: 3 },
          shelter: { radius: 10, minEnemies: 2, woundedBelow: 0.5 },
          hunt: { prey: true, range: 20, boarParty: 4 },
          scoutStart: 45,
          economy: { campAt: 3, millAt: 8, maxFarms: 16, reseedBuffer: 3, techAt: 10, techLevel: 3 },
          age: { at: [14, 17], army: [8, 26], maxAge: 2 },
          military: { towers: 2, rams: 3, tiers: true },
          expand: { towns: 2, minAge: 1, minVillagers: 15, minArmy: 8, extraVillagers: 6 },
          counter: { bias: 3, memory: 150 },
          late: null
        }
      }
    },

    // AI 基準參數
    ai: {
      attack: true,          // false 時永遠不發動進攻（和平世界）
      thinkInterval: 1.0,
      graceTime: 360,        // 開局緩衝（秒），此前 AI 不進攻
      villagerTarget: 14,
      gatherRatio: { food: 0.42, wood: 0.32, gold: 0.18, stone: 0.08 },   // 封建以後也採石材（箭塔）
      gatherRatioDark: { food: 0.45, wood: 0.35, gold: 0.2 },  // 黑暗時代用不到石材
      attackSize: 6,         // 第一波人數
      waveGrowth: 1,
      attackSizeMax: 10,
      waveInterval: 100,     // 兩波之間至少間隔（秒）
      armyMax: 14,           // 軍隊人數上限（含訓練中）
      // 後期成長（null 表示不成長）：開局 after 秒後，每 every 秒軍隊上限與單波上限各加 step 人，
      // 分別最多到這裡的 armyMax、attackSizeMax。成長期間存錢升時代時，仍每 drip 秒補一名士兵
      late: { after: 600, every: 60, step: 2, armyMax: 24, attackSizeMax: 16, drip: 30 },
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
      economy: { campAt: 3, millAt: 9, maxFarms: 12, reseedBuffer: 2, techAt: 12, techLevel: 2 },
      // 升時代：村民達 at[目前時代] 人、軍隊達 army[目前時代] 人才開始準備（存錢期間不訓練；封建取第一波人數，城堡取軍隊上限，滿編才存錢），最多升到 maxAge（at 不可超過 villagerTarget）
      age: { at: [12, 14], army: [6, 14], maxAge: 2 },
      // 封建後蓋幾座箭塔、城堡時代最多幾台攻城槌、是否研究兵種升級
      military: { towers: 1, rams: 2, tiers: true },
      // 擴張：最多幾座主堡、蓋第二座需要的時代／村民／軍隊人數、有兩座後村民目標增加幾人
      expand: { towns: 2, minAge: 1, minVillagers: 14, minArmy: 6, extraVillagers: 4 },
      // 兵種應對：bias 越大越偏向剋制兵種（0 表示不調整比例）、memory 為記得敵軍幾秒
      counter: { bias: 1, memory: 100 }
    }
  };
})();
