'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function base(resources) {
  const w = arena(32, resources);
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 27, 27, true);
  const house = RTS.world.addBuilding(w, 'house', 0, 12, 12, true);
  const v = unit(w, 'villager', 0, 9, 12);
  const issue = c => RTS.commands.issue(w, 0, Object.assign({ unitIds: [v.id] }, c));
  return { w, tc, house, v, issue };
}

test('修理補滿生命並依受損比例收費', () => {
  const { w, house, v, issue } = base({ food: 0, wood: 100, gold: 0 });
  house.hp = house.maxHp * 0.2;
  assert.ok(issue({ type: 'repair', targetId: house.id }).ok);
  assert.ok(runUntil(w, () => house.hp === house.maxHp, 2000));
  const expected = RTS.data.buildings.house.cost.wood * RTS.data.repair.costFactor * 0.8;
  const spent = 100 - w.players[0].res.wood;
  assert.ok(spent >= Math.floor(expected) - 1 && spent <= Math.ceil(expected), '花費 ' + spent);
  RTS.game.step(w);
  assert.strictEqual(v.order.type, 'idle');
});

test('資源用完時停工，不會免費修好', () => {
  const { w, house, v, issue } = base({ food: 0, wood: 5, gold: 0 });
  house.hp = 10;
  issue({ type: 'repair', targetId: house.id });
  assert.ok(runUntil(w, () => v.order.type === 'idle', 2000));
  assert.strictEqual(w.players[0].res.wood, 0);
  assert.ok(house.hp < house.maxHp * 0.6);
});

test('完好、未完工、敵方建築不可修理；只有村民能修', () => {
  const { w, house, issue } = base();
  assert.strictEqual(issue({ type: 'repair', targetId: house.id }).reason, 'cannotRepair');
  const site = RTS.world.addBuilding(w, 'house', 0, 18, 18, false);
  assert.strictEqual(issue({ type: 'repair', targetId: site.id }).reason, 'cannotRepair');
  const theirs = RTS.world.addBuilding(w, 'house', 1, 22, 22, true);
  theirs.hp = 5;
  assert.strictEqual(issue({ type: 'repair', targetId: theirs.id }).reason, 'cannotRepair');
  house.hp = 5;
  const s = unit(w, 'swordsman', 0, 15, 15);
  assert.strictEqual(RTS.commands.issue(w, 0, { type: 'repair', unitIds: [s.id], targetId: house.id }).reason,
    'villagersOnlyRepair');
});

test('右鍵受損建築即修理，修完回去採集；攜帶資源者先交貨', () => {
  const { w, tc, house, v, issue } = base();
  const tree = RTS.world.addNode(w, 'tree', 9, 16);
  issue({ type: 'gather', targetId: tree.id });
  house.hp = house.maxHp - 20;
  issue({ type: 'smart', targetId: house.id, x: 12, y: 12 });
  assert.strictEqual(v.order.type, 'repair');
  assert.ok(runUntil(w, () => v.order.type === 'gather', 2000));
  tc.hp -= 50;
  v.carry = { resource: 'wood', amount: 4 };
  issue({ type: 'smart', targetId: tc.id, x: 2, y: 2 });
  assert.strictEqual(v.order.type, 'deposit');
  v.carry.amount = 0;
  issue({ type: 'smart', targetId: tc.id, x: 2, y: 2 });
  assert.strictEqual(v.order.type, 'repair');
});

test('AI 依難度門檻派村民修理', () => {
  for (const key of RTS.data.difficultyOrder) {
    const w = RTS.game.create(7);
    const ai = RTS.ai.create(1, key);
    const tc = RTS.world.buildingsOf(w, 1, 'townCenter')[0];
    const cfg = RTS.ai.config(key).repair;
    tc.hp = tc.maxHp * (cfg.threshold - 0.05);
    const start = tc.hp;
    for (let i = 0; i < 800; i++) { ai.update(w, RTS.data.TICK); RTS.game.step(w); }
    assert.ok(tc.hp > start + 50, key + ' 應修理主堡 ' + (tc.hp - start));
  }
});
