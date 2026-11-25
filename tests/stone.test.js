'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

const HOME_STONES = 4;

function base() {
  const w = arena(32, { food: 0, wood: 0, gold: 0 });
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 3, 3, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 27, 27, true);
  const v = unit(w, 'villager', 0, 8, 5);
  const issue = c => RTS.commands.issue(w, 0, Object.assign({ unitIds: [v.id] }, c));
  return { w, tc, v, issue };
}

test('開局石材為 0；右鍵採集、入庫、採完消失並改採附近同類', () => {
  assert.strictEqual(RTS.data.START_RESOURCES.stone, 0);
  const { w, v, issue } = base();
  const first = RTS.world.addNode(w, 'rock', 12, 5), second = RTS.world.addNode(w, 'rock', 13, 8);
  first.amount = 4;
  assert.strictEqual(w.players[0].res.stone, 0);
  assert.ok(issue({ type: 'smart', targetId: first.id, x: 12, y: 5 }).ok);
  assert.strictEqual(v.order.type, 'gather');
  assert.ok(runUntil(w, () => w.players[0].res.stone >= 10, 2000));
  assert.strictEqual(RTS.world.get(w, first.id), null);
  assert.ok(RTS.map.isWalkable(w.map, 12, 5));
  assert.strictEqual(w.players[0].res.stone + v.carry.amount + second.amount, 4 + RTS.data.nodes.rock.amount);
});

test('帶貨規則與集結點對石材一樣適用', () => {
  const { w, tc, v, issue } = base();
  const rock = RTS.world.addNode(w, 'rock', 12, 5);
  v.carry = { resource: 'wood', amount: 5 };
  issue({ type: 'gather', targetId: rock.id });
  assert.ok(runUntil(w, () => v.carry.resource === 'stone' && v.carry.amount > 0, 1500));
  assert.strictEqual(w.players[0].res.wood, 5);
  w.players[0].res.wood = 100;
  issue({ type: 'build', building: 'house', tx: 18, ty: 12 });
  assert.strictEqual(v.order.deliver, true, '帶石材去蓋房屋要先交貨');
  w.players[0].res.food = 100;
  RTS.commands.issue(w, 0, { type: 'setRally', buildingId: tc.id, x: 12.5, y: 5.5, targetId: rock.id });
  RTS.commands.issue(w, 0, { type: 'train', buildingId: tc.id, unit: 'villager' });
  assert.ok(runUntil(w, () => RTS.world.unitsOf(w, 0).length === 2, 600));
  const born = RTS.world.unitsOf(w, 0).find(u => u.id !== v.id);
  assert.deepStrictEqual([born.order.type, born.order.resource], ['gather', 'stone']);
});

test('各種子雙方家園石材固定數量、點對稱，且地圖可通行', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const w = RTS.game.create(seed);
    const W = w.map.width, H = w.map.height;
    const home = c => RTS.world.list(w, e => e.type === 'rock' && Math.hypot(e.x + 0.5 - c, e.y + 0.5 - c) < 13);
    const mine = home(9.5);
    assert.strictEqual(mine.length, HOME_STONES, 'seed ' + seed);
    assert.strictEqual(home(W - 9.5).length, HOME_STONES, 'seed ' + seed);
    mine.forEach(r => {
      const twin = RTS.world.get(w, RTS.map.occupantAt(w.map, W - 1 - r.x, H - 1 - r.y));
      assert.ok(twin && twin.type === 'rock', 'seed ' + seed);
    });
    assert.ok(RTS.mapgen.isPlayable(w), 'seed ' + seed);
    const from = RTS.map.nearestFree(w.map, 12, 12), to = RTS.map.nearestFree(w.map, W - 13, H - 13);
    const res = RTS.path.find(w.map, from.x, from.y, RTS.move.pointGoal(to.x, to.y));
    assert.ok(res.reached, '雙方應相通 seed ' + seed);
  }
});

test('AI 不採石材，經濟照常運作', () => {
  const w = RTS.game.create(7), ai = RTS.ai.create(1);
  for (let i = 0; i < 3000; i++) { ai.update(w, RTS.data.TICK); RTS.game.step(w); }
  assert.strictEqual(w.players[1].res.stone, 0);
  assert.ok(RTS.world.unitsOf(w, 1).every(u => u.order.resource !== 'stone'));
  assert.ok(RTS.world.unitsOf(w, 1).length >= 8);
});
