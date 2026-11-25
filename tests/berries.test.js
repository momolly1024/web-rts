'use strict';
const assert = require('assert');
const { RTS } = require('./helpers');

const HOME_BERRIES = 6;
const HOME_RADIUS = 13;

function homeBerries(w, mirrored) {
  const c = mirrored ? w.map.width - 9.5 : 9.5;
  return RTS.world.list(w, e => e.type === 'berry' && Math.hypot(e.x + 0.5 - c, e.y + 0.5 - c) < HOME_RADIUS);
}

test('每個種子雙方家園都有固定數量、位置點對稱的果叢', () => {
  for (let seed = 1; seed <= 600; seed++) {
    const w = RTS.game.create(seed);
    const mine = homeBerries(w, false), theirs = homeBerries(w, true);
    assert.strictEqual(mine.length, HOME_BERRIES, 'seed ' + seed);
    assert.strictEqual(theirs.length, HOME_BERRIES, 'seed ' + seed);
    mine.forEach(b => {
      const twin = RTS.world.get(w, RTS.map.occupantAt(w.map, w.map.width - 1 - b.x, w.map.height - 1 - b.y));
      assert.ok(twin && twin.type === 'berry', 'seed ' + seed);
      assert.strictEqual(b.amount, RTS.data.nodes.berry.amount);
    });
  }
});

test('沒人採集時果叢不會消失（含動物走動、死亡與在旁蓋房）', () => {
  for (const seed of [3, 7, 42]) {
    const w = RTS.game.create(seed);
    const before = homeBerries(w, false).concat(homeBerries(w, true)).map(b => b.id);
    RTS.world.list(w, e => e.kind === 'unit').forEach(u => RTS.world.remove(w, u));
    for (let i = 0; i < 3000; i++) RTS.game.step(w);
    RTS.world.list(w, e => e.kind === 'animal').forEach(a => RTS.animals.die(w, a));
    before.forEach(id => {
      const b = RTS.world.get(w, id);
      assert.ok(b && RTS.map.occupantAt(w.map, b.x, b.y) === id, 'seed ' + seed);
    });
    const bush = RTS.world.get(w, before[0]);
    assert.strictEqual(RTS.construction.canPlace(w, 0, 'house', bush.x, bush.y).ok, false);
  }
});
