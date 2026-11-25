'use strict';
const assert = require('assert');
const { RTS, arena, runUntil } = require('./helpers');

function base() {
  const w = arena(32);
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 3, 3, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 27, 27, true);
  const barracks = RTS.world.addBuilding(w, 'barracks', 0, 10, 3, true);
  const issue = c => RTS.commands.issue(w, 0, c);
  const rally = (b, x, y, targetId) => issue({ type: 'setRally', buildingId: b.id, x, y, targetId });
  const train = (b, unit) => issue({ type: 'train', buildingId: b.id, unit });
  const newest = type => RTS.world.unitsOf(w, 0).filter(u => u.type === type).pop();
  return { w, tc, barracks, issue, rally, train, newest };
}

test('只有己方完工的主堡與兵營顯示集結點提示，並回報目前目標', () => {
  const { w, tc, barracks, rally } = base();
  const show = b => RTS.rally.showsHint(b, 0);
  assert.ok(show(tc) && show(barracks));
  assert.strictEqual(show(RTS.world.addBuilding(w, 'blacksmith', 0, 20, 3, true)), false);
  assert.strictEqual(show(RTS.world.addBuilding(w, 'house', 0, 24, 3, true)), false);
  assert.strictEqual(show(RTS.world.addBuilding(w, 'barracks', 0, 3, 20, false)), false);
  assert.strictEqual(show(RTS.world.buildingsOf(w, 1)[0]), false);
  const key = () => RTS.rally.targetKey(w, tc);
  const tree = RTS.world.addNode(w, 'tree', 12, 12);
  rally(tc, 20.5, 20.5);
  assert.strictEqual(key(), 'rally.ground');
  rally(tc, 12.5, 12.5, tree.id);
  assert.strictEqual(key(), 'node.tree');
  RTS.world.remove(w, tree);
  assert.strictEqual(key(), 'resource.wood');
  rally(tc, barracks.x, barracks.y, barracks.id);
  assert.strictEqual(key(), 'building.barracks');
  for (const k of ['rally.ground', 'node.tree', 'resource.wood', 'building.barracks']) {
    assert.ok(k in RTS.locales.en && k in RTS.locales['zh-TW'], k);
  }
  for (const lang of ['zh-TW', 'en']) {
    assert.ok(RTS.locales[lang]['info.rallySet'].includes('{target}'));
    assert.ok(/集結點|rally point/i.test(RTS.locales[lang]['info.rallyHint']));
  }
});

test('士兵出兵後走到集結點', () => {
  const { w, barracks, rally, train, newest } = base();
  assert.ok(rally(barracks, 18.5, 14.5).ok);
  train(barracks, 'swordsman');
  assert.ok(runUntil(w, () => {
    const u = newest('swordsman');
    return u && u.order.type === 'idle' && Math.floor(u.x) === 18 && Math.floor(u.y) === 14;
  }, 2000));
});

test('村民集結到資源點自動採集；原資源耗盡改採附近同類', () => {
  const { w, tc, rally, train, newest } = base();
  const first = RTS.world.addNode(w, 'tree', 10, 12);
  const second = RTS.world.addNode(w, 'tree', 12, 13);
  rally(tc, 10.5, 12.5, first.id);
  train(tc, 'villager');
  assert.ok(runUntil(w, () => !!newest('villager'), 400));
  assert.strictEqual(newest('villager').order.type, 'gather');
  assert.strictEqual(newest('villager').order.targetId, first.id);
  RTS.world.remove(w, first);
  RTS.world.remove(w, newest('villager'));
  train(tc, 'villager');
  assert.ok(runUntil(w, () => !!newest('villager'), 400));
  assert.strictEqual(newest('villager').order.targetId, second.id);
});

test('集結點可取消；沒有生產能力的建築與敵方建築不可設定', () => {
  const { w, tc, rally, train, newest, issue } = base();
  rally(tc, 20, 20);
  assert.ok(tc.rally);
  assert.ok(rally(tc, 4, 4, tc.id).ok);
  assert.strictEqual(tc.rally, null);
  train(tc, 'villager');
  assert.ok(runUntil(w, () => !!newest('villager'), 400));
  assert.strictEqual(newest('villager').order.type, 'idle');
  const house = RTS.world.addBuilding(w, 'house', 0, 15, 15, true);
  assert.strictEqual(rally(house, 20, 20).reason, 'cannotRally');
  const enemy = RTS.world.buildingsOf(w, 1)[0];
  assert.strictEqual(issue({ type: 'setRally', buildingId: enemy.id, x: 1, y: 1 }).reason, 'cannotRally');
});
