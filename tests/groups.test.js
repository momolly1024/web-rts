'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function base() {
  const w = arena(32);
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 3, 3, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 27, 27, true);
  return { w, tc, g: RTS.groups.create() };
}

test('設定與選取編號；陣亡者自動略過；只收己方', () => {
  const { w, g } = base();
  const a = unit(w, 'swordsman', 0, 10, 10), b = unit(w, 'swordsman', 0, 12, 10);
  const foe = unit(w, 'swordsman', 1, 20, 20);
  assert.strictEqual(RTS.groups.assign(g, 1, w, 0, [a.id, b.id, foe.id]), 2);
  assert.deepStrictEqual(RTS.groups.recall(g, 1, w, 0, 10).ids, [a.id, b.id]);
  assert.strictEqual(RTS.groups.assign(g, 1, w, 0, []), 0);
  RTS.world.remove(w, a);
  assert.deepStrictEqual(RTS.groups.recall(g, 1, w, 0, 20).ids, [b.id]);
  assert.strictEqual(RTS.groups.recall(g, 2, w, 0, 20), null);
});

test('連按兩下同一編號回傳隊伍中心，間隔太久或換編號不算', () => {
  const { w, g } = base();
  const a = unit(w, 'swordsman', 0, 10, 10), b = unit(w, 'swordsman', 0, 14, 12);
  RTS.groups.assign(g, 1, w, 0, [a.id, b.id]);
  RTS.groups.assign(g, 2, w, 0, [a.id]);
  assert.strictEqual(RTS.groups.recall(g, 1, w, 0, 1.0).center, null);
  assert.deepStrictEqual(RTS.groups.recall(g, 1, w, 0, 1.3).center, { x: 12.5, y: 11.5 });
  assert.strictEqual(RTS.groups.recall(g, 1, w, 0, 3).center, null);
  RTS.groups.recall(g, 2, w, 0, 3.1);
  assert.strictEqual(RTS.groups.recall(g, 1, w, 0, 3.2).center, null);
});

test('避難中的成員暫時略過，放出後仍在原編號', () => {
  const { w, tc, g } = base();
  const a = unit(w, 'swordsman', 0, 7, 4);
  RTS.groups.assign(g, 3, w, 0, [a.id]);
  RTS.commands.issue(w, 0, { type: 'garrison', unitIds: [a.id], targetId: tc.id });
  assert.ok(runUntil(w, () => RTS.garrison.count(tc) === 1, 600));
  assert.strictEqual(RTS.groups.recall(g, 3, w, 0, 1), null);
  RTS.commands.issue(w, 0, { type: 'ungarrison', buildingId: tc.id });
  assert.deepStrictEqual(RTS.groups.recall(g, 3, w, 0, 2).ids, [a.id]);
});
