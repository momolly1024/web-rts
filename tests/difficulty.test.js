'use strict';
const assert = require('assert');
const { RTS } = require('./helpers');

const AI_ID = 1;
const SEEDS = [7, 2024, 31337, 5, 88, 404];
const HORIZON = 900;     // 模擬秒數

test('普通難度就是基準參數，預設為普通', () => {
  const base = Object.assign({ difficulty: 'normal' }, RTS.data.ai);
  assert.strictEqual(RTS.data.defaultDifficulty, 'normal');
  assert.deepStrictEqual(RTS.ai.config('normal'), base);
  assert.deepStrictEqual(RTS.ai.config(undefined), base);
  assert.deepStrictEqual(RTS.ai.config('不存在'), base);
  assert.strictEqual(RTS.ai.create(AI_ID).difficulty, 'normal');
});

test('難度只覆寫 AI 行為參數，不改資源與戰鬥數值', () => {
  const tables = () => JSON.stringify([RTS.data.units, RTS.data.buildings, RTS.data.damageBonus,
    RTS.data.START_RESOURCES, RTS.data.START_VILLAGERS, RTS.data.ai]);
  const before = tables();
  for (const key of RTS.data.difficultyOrder) {
    const entry = RTS.data.difficulties[key];
    assert.deepStrictEqual(Object.keys(entry), ['ai']);
    Object.keys(entry.ai).forEach(k => assert.ok(k in RTS.data.ai, key + ' 含未知參數 ' + k));
    const world = RTS.game.create(7);
    const ai = RTS.ai.create(AI_ID, key);
    assert.deepStrictEqual(world.players[AI_ID].res, world.players[0].res);
    for (let i = 0; i < 2000; i++) { ai.update(world, RTS.data.TICK); RTS.game.step(world); }
  }
  assert.strictEqual(tables(), before);
});

// 玩家完全不動；主堡設成打不壞，讓各難度跑滿相同時間以便比較軍力
function simulate(seed, difficulty) {
  const world = RTS.game.create(seed);
  const ai = RTS.ai.create(AI_ID, difficulty);
  const target = RTS.world.buildingsOf(world, 0, 'townCenter')[0];
  target.hp = target.maxHp = 1e9;
  const log = { firstAttack: null, firstWave: 0, firstDamage: null, peakArmy: 0, trained: new Set() };
  for (let i = 0; i < HORIZON / RTS.data.TICK; i++) {
    ai.update(world, RTS.data.TICK);
    RTS.game.step(world);
    if (i % 20) continue;
    const army = RTS.world.unitsOf(world, AI_ID).filter(u => RTS.data.units[u.type].military);
    army.forEach(u => log.trained.add(u.id));
    log.peakArmy = Math.max(log.peakArmy, army.length);
    if (log.firstAttack === null && ai.state.waves > 0) {
      log.firstAttack = Math.round(world.time);
      log.firstWave = Object.keys(ai.state.wave).length;
    }
    if (log.firstDamage === null && target.hp < target.maxHp) log.firstDamage = Math.round(world.time);
  }
  log.trained = log.trained.size;
  return log;
}

for (const seed of SEEDS) {
  slowTest(`三種難度皆會進攻，強度順序 簡單 < 普通 < 困難（seed ${seed}）`, () => {
    const [easy, normal, hard] = RTS.data.difficultyOrder.map(key => {
      const log = simulate(seed, key);
      const info = key + ' ' + JSON.stringify(log);
      console.log('      ' + info);
      const cfg = RTS.ai.config(key);
      assert.ok(log.firstAttack !== null && log.firstDamage !== null, '應進攻並打到玩家 ' + info);
      assert.ok(log.firstAttack >= cfg.graceTime, '緩衝期內不可進攻 ' + info);
      assert.strictEqual(log.firstWave, cfg.attackSize, info);
      return log;
    });
    for (const field of ['firstAttack', 'firstDamage']) {
      assert.ok(easy[field] > normal[field] && normal[field] > hard[field], field + ' 應愈難愈早');
    }
    for (const field of ['firstWave', 'peakArmy', 'trained']) {
      assert.ok(easy[field] < normal[field] && normal[field] < hard[field], field + ' 應愈難愈多');
    }
  });
}

slowTest('三種難度對不動的玩家都能分出勝負', () => {
  for (const key of RTS.data.difficultyOrder) {
    const world = RTS.game.create(2024);
    const ai = RTS.ai.create(AI_ID, key);
    for (let i = 0; i < 30000 && !world.over; i++) { ai.update(world, RTS.data.TICK); RTS.game.step(world); }
    assert.strictEqual(world.winner, AI_ID, key);
  }
});

slowTest('和平世界：隱藏難度，只關掉進攻；電腦照常發展但永遠不出兵', () => {
  assert.ok(RTS.data.difficultyOrder.indexOf('peaceful') < 0, '不在一般選單');
  const entry = RTS.data.difficulties.peaceful;
  assert.deepStrictEqual(entry, { ai: { attack: false } });
  assert.strictEqual(RTS.ai.create(AI_ID, 'peaceful').difficulty, 'peaceful');
  const log = simulate(7, 'peaceful');
  assert.strictEqual(log.firstAttack, null, '不應進攻');
  assert.strictEqual(log.firstDamage, null, '玩家主堡不應受損');
  assert.ok(log.peakArmy > 0, '仍會發展軍隊防守');
});
