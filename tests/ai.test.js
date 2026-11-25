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

// AI 對 AI 一場長局，回傳整局出現過的建築、有沒有人種田、雙方的研究
function longGame(seed) {
  const world = RTS.game.create(seed);
  const ais = [RTS.ai.create(0), RTS.ai.create(1)];
  const ever = new Set();          // 結束時建築可能已被打掉，所以邊跑邊記
  let farmed = false;
  for (let i = 0; i < 16000 && !world.over; i++) {
    ais.forEach(a => a.update(world, RTS.data.TICK));
    RTS.game.step(world);
    if (i % 100) continue;
    RTS.world.list(world, e => e.kind === 'building').forEach(b => ever.add(b.type));
    farmed = farmed || RTS.world.list(world, e => e.kind === 'unit' && e.order.type === 'gather' &&
      RTS.farm.isFarm(RTS.world.get(world, e.order.targetId))).length > 0;
  }
  return { ever, farmed, upgrades: world.players.map(p => p.upgrades) };
}

test('AI 經濟建設：長局中蓋磨坊與伐木場', () => {
  // 伐木場只在樹林離收取建築遠時才蓋，所以用樹林較遠的地圖
  const g = longGame(303);
  assert.ok(g.ever.has('mill') && g.ever.has('lumberCamp'), [...g.ever].join(','));
});

test('AI 經濟建設：沒有野外食物時蓋磨坊與農田並派人耕作', () => {
  const world = RTS.game.create(7);
  RTS.world.list(world, e => e.kind === 'animal' || e.type === 'berry').forEach(e => RTS.world.remove(world, e));
  const target = RTS.world.buildingsOf(world, 0, 'townCenter')[0];
  target.hp = target.maxHp = 1e9;      // 玩家不動也不會輸，專心看 AI 的經濟
  const ai = RTS.ai.create(1);
  const farming = () => RTS.world.unitsOf(world, 1).some(u => u.order.type === 'gather' &&
    RTS.farm.isFarm(RTS.world.get(world, u.order.targetId)));
  let ok = false;
  for (let i = 0; i < 8000 && !ok; i++) {
    ai.update(world, RTS.data.TICK);
    RTS.game.step(world);
    if (i % 50 === 0) ok = farming();
  }
  assert.ok(ok, '應有村民在種田');
});

test('AI 經濟建設：資源有餘時研究經濟科技', () => {
  const g = longGame(7);
  const tracks = ['woodcutting', 'farmYield', 'goldMining', 'handcart', 'stoneMining'];
  assert.ok(g.upgrades.some(u => tracks.some(t => u[t])), JSON.stringify(g.upgrades));
});
