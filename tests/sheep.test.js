'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function base() {
  const w = arena(40);
  RTS.world.addBuilding(w, 'townCenter', 0, 2, 2, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 34, 34, true);
  const sheep = RTS.world.addAnimal(w, 'sheep', 15.5, 15.5);
  const v = unit(w, 'villager', 0, 13, 15);
  const issue = c => RTS.commands.issue(w, 0, c);
  const claim = () => assert.ok(runUntil(w, () => sheep.owner === 0, 100));
  return { w, sheep, v, issue, claim };
}

test('未認領的羊不接受指令；村民走近即認領，之後右鍵地面可移動', () => {
  const { w, sheep, issue, claim } = base();
  const smart = () => issue({ type: 'smart', unitIds: [sheep.id], targetId: null, x: 25, y: 20 });
  assert.strictEqual(smart().ok, false);
  claim();
  assert.ok(smart().ok);
  assert.ok(runUntil(w, () => Math.floor(sheep.x) === 25 && Math.floor(sheep.y) === 20, 600));
});

test('框選：村民與牲畜一起選；有軍事單位時不帶牲畜', () => {
  const { w, sheep, v } = base();
  const s = unit(w, 'swordsman', 0, 12, 15);
  const ids = list => RTS.groups.boxSelection(list).map(e => e.id);
  assert.deepStrictEqual(ids([v, sheep]), [v.id, sheep.id]);
  assert.deepStrictEqual(ids([sheep]), [sheep.id]);
  assert.deepStrictEqual(ids([v, sheep, s]), [v.id, s.id]);
  assert.deepStrictEqual(ids([]), []);
});

test('混合選取：右鍵地面一起走；右鍵資源或建築時羊留在原地', () => {
  const { w, sheep, v, issue, claim } = base();
  claim();
  const smart = (targetId, x, y) => issue({ type: 'smart', unitIds: [v.id, sheep.id], targetId, x, y });
  assert.ok(smart(null, 25, 20).ok);
  assert.deepStrictEqual([v.order.type, sheep.order.type], ['move', 'move']);
  issue({ type: 'stop', unitIds: [v.id, sheep.id] });
  const tree = RTS.world.addNode(w, 'tree', 20, 10);
  smart(tree.id, 20, 10);
  assert.deepStrictEqual([v.order.type, sheep.order.type], ['gather', 'idle']);
  const tc = RTS.world.buildingsOf(w, 0)[0];
  smart(tc.id, 3, 3);
  assert.strictEqual(sheep.order.type, 'idle');
  // 只選羊時，點到樹旁仍照常移動
  issue({ type: 'smart', unitIds: [sheep.id], targetId: tree.id, x: 20, y: 10 });
  assert.strictEqual(sheep.order.type, 'move');
});

test('閒逛中下令不會被蓋掉', () => {
  const { w, sheep, v, issue, claim } = base();
  claim();
  RTS.world.remove(w, v);
  for (const [x, y] of [[25, 15], [8, 25], [30, 8]]) {
    assert.ok(runUntil(w, () => !!sheep.stroll, 600));
    issue({ type: 'move', unitIds: [sheep.id], x, y });
    assert.ok(runUntil(w, () => Math.floor(sheep.x) === x && Math.floor(sheep.y) === y, 900), x + ',' + y);
  }
});
