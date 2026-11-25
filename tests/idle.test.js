'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

test('閒置村民清單與依序輪選；忙碌、避難、士兵與敵方不算', () => {
  const w = arena(32);
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 3, 3, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 27, 27, true);
  const [a, b, c] = [0, 1, 2].map(i => unit(w, 'villager', 0, 8 + i, 4));
  unit(w, 'swordsman', 0, 15, 15);
  unit(w, 'villager', 1, 20, 20);
  const ids = () => RTS.groups.idleVillagers(w, 0).map(u => u.id);
  assert.deepStrictEqual(ids(), [a.id, b.id, c.id]);
  const next = last => (RTS.groups.nextIdle(w, 0, last) || {}).id;
  assert.deepStrictEqual([next(0), next(a.id), next(b.id), next(c.id)], [a.id, b.id, c.id, a.id]);
  RTS.commands.issue(w, 0, { type: 'move', unitIds: [b.id], x: 20, y: 10 });
  assert.deepStrictEqual(ids(), [a.id, c.id]);
  assert.strictEqual(next(a.id), c.id);
  RTS.commands.issue(w, 0, { type: 'garrison', unitIds: [a.id, c.id], targetId: tc.id });
  assert.ok(runUntil(w, () => RTS.garrison.count(tc) === 2, 600));
  assert.ok(runUntil(w, () => ids().length === 1, 600), '移動完的人又算閒置');
  RTS.world.remove(w, b);
  assert.strictEqual(next(0), undefined);
});
