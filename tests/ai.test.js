'use strict';
const assert = require('assert');
const { RTS } = require('./helpers');

const AI_ID = 1;

// AI 對上完全不動的玩家，記錄發展與進攻時間
function simulate(seed, maxSteps) {
  const world = RTS.game.create(seed);
  const ai = RTS.ai.create(AI_ID);
  const log = { world, ai, firstAttack: null, firstDamage: null, peakVillagers: 0, peakArmy: 0, barracks: false, firstWaveSize: 0 };
  const enemyTc = RTS.world.buildingsOf(world, 0, 'townCenter')[0];
  for (let i = 0; i < maxSteps && !world.over; i++) {
    ai.update(world, RTS.data.TICK);
    RTS.game.step(world);
    if (i % 20) continue;
    const units = RTS.world.unitsOf(world, AI_ID);
    const army = units.filter(u => RTS.data.units[u.type].military);
    log.peakVillagers = Math.max(log.peakVillagers, units.length - army.length);
    log.peakArmy = Math.max(log.peakArmy, army.length);
    log.barracks = log.barracks || RTS.world.buildingsOf(world, AI_ID, 'barracks').some(b => b.complete);
    if (log.firstAttack === null && ai.state.waves > 0) {
      log.firstAttack = world.time;
      log.firstWaveSize = Object.keys(ai.state.wave).length;
    }
    if (log.firstDamage === null && enemyTc.hp < enemyTc.maxHp) log.firstDamage = world.time;
  }
  return log;
}

for (const seed of [7, 2024, 31337, 5, 88]) {
  test(`AI 對不動的玩家：發展、在緩衝期後進攻並獲勝（seed ${seed}）`, () => {
    const log = simulate(seed, 20000);
    const info = JSON.stringify({
      time: log.world.time, firstAttack: log.firstAttack, firstDamage: log.firstDamage,
      villagers: log.peakVillagers, army: log.peakArmy, waves: log.ai.state.waves,
      winner: log.world.winner
    });
    console.log('      ' + info);
    assert.ok(log.peakVillagers >= 10, 'AI 應增加村民 ' + info);
    assert.ok(log.barracks, 'AI 應蓋好兵營 ' + info);
    assert.ok(log.firstAttack !== null, 'AI 應發起進攻 ' + info);
    assert.ok(log.firstAttack >= RTS.data.ai.graceTime, '緩衝期內不可進攻 ' + info);
    assert.strictEqual(log.firstWaveSize, RTS.data.ai.attackSize, '第一波人數固定 ' + info);
    assert.ok(log.firstDamage !== null, '玩家主堡應受到攻擊 ' + info);
    assert.strictEqual(log.world.winner, AI_ID, info);
  });
}

for (const difficulty of RTS.data.difficultyOrder) {
  test(`AI 只透過指令介面操作（拒絕所有指令時世界不被 AI 改動，${difficulty}）`, () => {
    const world = RTS.game.create(11);
    const ai = RTS.ai.create(AI_ID, difficulty);
    const original = RTS.commands.issue;
    const seen = [];
    const snapshot = () => JSON.stringify({
      p: world.players,
      e: [...world.entities.values()].map(e => [e.id, e.x, e.y, e.hp, e.order, e.queue])
    });
    RTS.commands.issue = (w, pid, cmd) => { seen.push(pid); return { ok: false }; };
    try {
      const before = snapshot();
      for (let i = 0; i < 400; i++) ai.update(world, 3);
      assert.strictEqual(snapshot(), before);
      assert.ok(seen.length > 0 && seen.every(pid => pid === AI_ID));
    } finally {
      RTS.commands.issue = original;
    }
  });
}

test('AI 經濟建設：長局中蓋磨坊、伐木場，野外食物不夠時種田並研究經濟科技', () => {
  const world = RTS.game.create(7);
  const ais = [RTS.ai.create(0), RTS.ai.create(1)];
  let farmed = false;
  for (let i = 0; i < 16000 && !world.over; i++) {
    ais.forEach(a => a.update(world, RTS.data.TICK));
    RTS.game.step(world);
    if (i % 100 === 0 && !farmed) {
      farmed = RTS.world.list(world, e => e.kind === 'unit' && e.order.type === 'gather' &&
        RTS.farm.isFarm(RTS.world.get(world, e.order.targetId))).length > 0;
    }
  }
  const built = type => [0, 1].some(p => RTS.world.buildingsOf(world, p, type).length > 0);
  assert.ok(built('mill') && built('lumberCamp'), '應蓋磨坊與伐木場');
  assert.ok(farmed, '應有村民在種田');
  const tracks = ['woodcutting', 'farmYield', 'goldMining', 'handcart', 'stoneMining'];
  assert.ok(world.players.some(p => tracks.some(t => p.upgrades[t])), '應研究經濟科技');
});
