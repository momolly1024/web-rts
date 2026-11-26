'use strict';
const assert = require('assert');
const { RTS, arena, unit } = require('./helpers');

const AI_ID = 1;

// 電腦主堡在左上、玩家主堡在右下，右上有一座遠處金礦
function setup(opts = {}) {
  const world = arena(48, opts.resources || { food: 2000, wood: 2000, gold: 2000, stone: 0 });
  const home = RTS.world.addBuilding(world, 'townCenter', AI_ID, 4, 4, true);
  const enemy = RTS.world.addBuilding(world, 'townCenter', 0, 40, 40, true);
  const mine = RTS.world.addNode(world, 'gold', 28, 6);
  for (let i = 0; i < 5; i++) RTS.world.addBuilding(world, 'house', AI_ID, 1 + i * 3, 14, true);
  const villagers = [];
  const count = opts.villagers === undefined ? 14 : opts.villagers;
  for (let i = 0; i < count; i++) villagers.push(unit(world, 'villager', AI_ID, 2 + i % 10, 9 + Math.floor(i / 10)));
  const army = [];
  const soldiers = opts.army === undefined ? 6 : opts.army;
  for (let i = 0; i < soldiers; i++) army.push(unit(world, 'swordsman', AI_ID, 10 + i, 2));
  world.players[AI_ID].upgrades.age = opts.age === undefined ? 1 : opts.age;
  return { world, home, enemy, mine, villagers, army };
}

// 只讓電腦思考一次
function think(world, ai) {
  ai.state.timer = 0;
  ai.update(world, 0);
}

const towns = world => RTS.world.buildingsOf(world, AI_ID, 'townCenter');
const queued = (world, type) => RTS.world.buildingsOf(world, AI_ID)
  .reduce((n, b) => n + b.queue.filter(q => q.type === type).length, 0);

test('AI 擴張：發展成形後在遠處金礦旁蓋第二座主堡', () => {
  const s = setup();
  think(s.world, RTS.ai.create(AI_ID));
  const second = towns(s.world).find(b => b !== s.home);
  assert.ok(second, '應放下第二座主堡');
  assert.ok(RTS.world.distTo(28.5, 6.5, second) <= 8, `應蓋在金礦旁 (${second.x},${second.y})`);
});

test('AI 擴張：黑暗時代、村民或軍隊不足、簡單難度都不擴張', () => {
  for (const [opts, difficulty] of [[{ age: 0 }], [{ villagers: 8 }], [{ army: 2 }], [{}, 'easy']]) {
    const s = setup(opts);
    think(s.world, RTS.ai.create(AI_ID, difficulty));
    assert.strictEqual(towns(s.world).length, 1, JSON.stringify([opts, difficulty]));
  }
});

test('AI 擴張：最多兩座主堡', () => {
  const s = setup();
  RTS.world.addBuilding(s.world, 'townCenter', AI_ID, 26, 12, true);
  const ai = RTS.ai.create(AI_ID);
  think(s.world, ai);
  assert.strictEqual(towns(s.world).length, 2);
});

test('AI 重建：兩座主堡被毀一座後，即使發展不足也重建', () => {
  for (const lost of [0, 1]) {
    const s = setup({ villagers: 5, army: 0, age: 0 });
    const second = RTS.world.addBuilding(s.world, 'townCenter', AI_ID, 26, 12, true);
    const ai = RTS.ai.create(AI_ID);
    think(s.world, ai);
    RTS.world.remove(s.world, [s.home, second][lost]);
    think(s.world, ai);
    assert.strictEqual(towns(s.world).length, 2, `毀掉第 ${lost + 1} 座`);
    assert.strictEqual(towns(s.world).filter(b => !b.complete).length, 1);
  }
});

test('勝負：兩座主堡都被毀才落敗', () => {
  const s = setup();
  const second = RTS.world.addBuilding(s.world, 'townCenter', AI_ID, 26, 12, true);
  RTS.world.remove(s.world, s.home);
  RTS.game.checkVictory(s.world);
  assert.strictEqual(s.world.over, false);
  RTS.world.remove(s.world, second);
  RTS.game.checkVictory(s.world);
  assert.strictEqual(s.world.winner, 0);
});

test('AI 兩座主堡：都訓練村民，且村民目標提高', () => {
  const s = setup({ villagers: 16 });
  RTS.world.addBuilding(s.world, 'townCenter', AI_ID, 26, 12, true);
  s.world.players[AI_ID].upgrades.age = 2;      // 不再準備升時代
  think(s.world, RTS.ai.create(AI_ID));
  assert.strictEqual(queued(s.world, 'villager'), 2);
});

test('AI 兩座主堡：分基地遇襲時附近村民躲進分基地', () => {
  const s = setup({ villagers: 0, army: 0 });
  const second = RTS.world.addBuilding(s.world, 'townCenter', AI_ID, 30, 20, true);
  const worker = unit(s.world, 'villager', AI_ID, 28, 21);
  unit(s.world, 'swordsman', 0, 36, 21);
  unit(s.world, 'swordsman', 0, 36, 23);
  think(s.world, RTS.ai.create(AI_ID));
  assert.strictEqual(worker.order.type, 'garrison');
  assert.strictEqual(worker.order.targetId, second.id);
});

test('AI 擴張：存錢升時代時只用時代用不到的餘額蓋主堡', () => {
  // 升城堡要黃金 200，主堡要黃金 100
  for (const [gold, expected] of [[250, 1], [400, 2]]) {
    const s = setup({ resources: { food: 100, wood: 1000, gold, stone: 0 }, army: 18 });
    RTS.world.addBuilding(s.world, 'barracks', AI_ID, 14, 8, true);
    RTS.world.addBuilding(s.world, 'lumberCamp', AI_ID, 20, 14, true);
    RTS.world.addBuilding(s.world, 'blacksmith', AI_ID, 24, 14, true);
    RTS.world.addBuilding(s.world, 'stable', AI_ID, 28, 14, true);
    const ai = RTS.ai.create(AI_ID);
    think(s.world, ai);
    assert.ok(ai.state.saving, '應正在存錢升時代');
    assert.strictEqual(towns(s.world).length, expected, '黃金 ' + gold);
  }
});

test('AI 擴張：替主堡存錢時不把資源花在軍隊上', () => {
  const resources = { food: 500, wood: 250, gold: 90, stone: 0 };
  for (const [army, expected] of [[6, 0], [2, 1]]) {
    const s = setup({ resources, army });
    RTS.world.addBuilding(s.world, 'barracks', AI_ID, 14, 8, true);
    think(s.world, RTS.ai.create(AI_ID));
    const trained = queued(s.world, 'swordsman') + queued(s.world, 'archer') + queued(s.world, 'spearman');
    assert.strictEqual(Math.min(trained, 1), expected, `軍隊 ${army} 人`);
  }
});

// 讓電腦看到一批敵軍後，回傳指定建築第一個訓練的兵種
function firstPick(difficulty, enemies, building) {
  const s = setup({ army: 0, villagers: 8 });
  const b = RTS.world.addBuilding(s.world, building, AI_ID, 14, 8, true);
  enemies.forEach((type, i) => unit(s.world, type, 0, 30 + i, 30));
  think(s.world, RTS.ai.create(AI_ID, difficulty));
  return b.queue[0] && b.queue[0].type;
}

test('AI 兵種應對：敵方騎兵多時普通難度優先長槍兵，簡單難度維持平均', () => {
  const cavalry = ['cavalry', 'cavalry', 'cavalry', 'cavalry', 'cavalry', 'cavalry'];
  assert.strictEqual(firstPick('normal', cavalry, 'barracks'), 'spearman');
  assert.notStrictEqual(firstPick('easy', cavalry, 'barracks'), 'spearman');
});

test('AI 兵種應對：敵方弓兵多時剋弓兵的兵種比重提高', () => {
  const s = setup();
  for (let i = 0; i < 4; i++) unit(s.world, 'archer', 0, 30 + i, 30);
  unit(s.world, 'ram', 0, 30, 32);
  const ai = RTS.ai.create(AI_ID);
  think(s.world, ai);
  const t = RTS.ai.counter.tally({ state: ai.state, cfg: RTS.ai.config('normal') });
  assert.strictEqual(t.weight('cavalry'), 1 + RTS.data.ai.counter.bias);
  assert.strictEqual(t.weight('spearman'), 1);
  assert.strictEqual(t.against('skirmisher'), 4);
});

test('AI 兵種應對：超過記憶時間就忘掉看過的敵軍', () => {
  const world = arena(48);
  RTS.fog.enable(world);
  RTS.world.addBuilding(world, 'townCenter', AI_ID, 4, 4, true);
  const scout = unit(world, 'cavalry', 0, 8, 8);
  RTS.fog.update(world, AI_ID);
  const ai = RTS.ai.create(AI_ID);
  think(world, ai);
  assert.ok(ai.state.enemies[scout.id]);
  scout.x = scout.y = 40.5;                       // 走出視野
  world.time = RTS.data.ai.counter.memory - 1;
  think(world, ai);
  assert.ok(ai.state.enemies[scout.id], '記憶時間內仍記得');
  world.time = RTS.data.ai.counter.memory + 1;
  think(world, ai);
  assert.ok(!ai.state.enemies[scout.id]);
});

test('相剋表只列出實際存在的兵種', () => {
  for (const [type, list] of Object.entries(RTS.data.counters)) {
    [type, ...list].forEach(t => assert.ok(RTS.data.units[t], t));
  }
});

// 整局：電腦對上不動的玩家，過程中應蓋出第二座主堡
slowTest('AI 擴張：整局中蓋好第二座主堡', () => {
  for (const seed of [7, 2024]) {
    const world = RTS.game.create(seed);
    const target = RTS.world.buildingsOf(world, 0, 'townCenter')[0];
    target.hp = target.maxHp = 1e9;
    const ai = RTS.ai.create(AI_ID);
    let built = 0;
    for (let i = 0; i < 24000 && !built; i++) {
      ai.update(world, RTS.data.TICK);
      RTS.game.step(world);
      if (i % 100 === 0 && towns(world).filter(b => b.complete).length >= 2) built = world.time;
    }
    console.log(`      seed ${seed} 第二座主堡完工於 ${built} 秒`);
    assert.ok(built, `seed ${seed}`);
  }
});

test('AI 後期成長：普通難度 10 分鐘後每分鐘增兵，到上限為止', () => {
  const cfg = RTS.ai.config('normal'), late = cfg.late;
  const at = time => {
    const c = RTS.ai.effective(cfg, time);
    return [c.armyMax, c.attackSizeMax];
  };
  const base = [cfg.armyMax, cfg.attackSizeMax];
  assert.deepStrictEqual(at(0), base);
  assert.deepStrictEqual(at(late.after + late.every - 1), base);
  assert.deepStrictEqual(at(late.after + late.every), [base[0] + late.step, base[1] + late.step]);
  assert.deepStrictEqual(at(99999), [late.armyMax, late.attackSizeMax]);
  assert.strictEqual(cfg.armyMax, base[0], '不改動原本的設定');
});

test('AI 後期成長：簡單與困難不隨時間改變', () => {
  for (const difficulty of ['easy', 'hard']) {
    const cfg = RTS.ai.config(difficulty);
    assert.strictEqual(RTS.ai.effective(cfg, 99999), cfg, difficulty);
  }
});

test('AI 後期成長：普通難度後期超過原上限仍繼續出兵', () => {
  for (const [time, expected] of [[0, 0], [2000, 1]]) {
    const s = setup({ army: RTS.data.ai.armyMax });
    const b = RTS.world.addBuilding(s.world, 'barracks', AI_ID, 14, 8, true);
    RTS.world.addBuilding(s.world, 'townCenter', AI_ID, 26, 12, true);
    s.world.players[AI_ID].upgrades.age = 2;
    s.world.time = time;
    think(s.world, RTS.ai.create(AI_ID));
    assert.strictEqual(Math.min(b.queue.length, 1), expected, 'time ' + time);
  }
});

test('提示：敵方主堡被毀且還有剩時回報剩幾座，只報一次', () => {
  const world = arena(48);
  RTS.world.addBuilding(world, 'townCenter', 0, 2, 2, true);
  const first = RTS.world.addBuilding(world, 'townCenter', AI_ID, 10, 10, true);
  const second = RTS.world.addBuilding(world, 'townCenter', AI_ID, 20, 20, true);
  RTS.world.addBuilding(world, 'townCenter', AI_ID, 30, 30, false);
  const watch = RTS.alert.watchTowns();
  assert.strictEqual(watch(world, 0), 0);
  RTS.world.remove(world, first);
  assert.strictEqual(watch(world, 0), 1, '工地不算');
  assert.strictEqual(watch(world, 0), 0);
  RTS.world.remove(world, second);
  assert.strictEqual(watch(world, 0), 0, '全毀交給勝利畫面');
});

test('提示：換新對局或失去自己的主堡不提示', () => {
  const make = () => {
    const world = arena(48);
    const own = [2, 12].map(x => RTS.world.addBuilding(world, 'townCenter', 0, x, 2, true));
    RTS.world.addBuilding(world, 'townCenter', AI_ID, 30, 30, true);
    return { world, own };
  };
  const watch = RTS.alert.watchTowns();
  const a = make();
  watch(a.world, 0);
  RTS.world.remove(a.world, a.own[0]);
  assert.strictEqual(watch(a.world, 0), 0);
  assert.strictEqual(watch(make().world, 0), 0);
});
