'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function base() {
  const w = arena(32);
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 3, 3, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 27, 27, true);
  return { w, tc };
}

test('一次選取全部閒置村民；忙碌、避難、士兵與敵方不算', () => {
  const { w, tc } = base();
  const [a, b, c] = [0, 1, 2].map(i => unit(w, 'villager', 0, 8 + i, 4));
  unit(w, 'swordsman', 0, 15, 15);
  unit(w, 'villager', 1, 20, 20);
  const ids = () => (RTS.groups.allIdle(w, 0) || { ids: [] }).ids;
  assert.deepStrictEqual(ids(), [a.id, b.id, c.id]);
  RTS.commands.issue(w, 0, { type: 'move', unitIds: [b.id], x: 20, y: 10 });
  assert.deepStrictEqual(ids(), [a.id, c.id]);
  RTS.commands.issue(w, 0, { type: 'garrison', unitIds: [a.id, c.id], targetId: tc.id });
  assert.ok(runUntil(w, () => RTS.garrison.count(tc) === 2, 600));
  assert.ok(runUntil(w, () => ids().length === 1, 600), '移動完的人又算閒置');
  RTS.world.remove(w, b);
  assert.strictEqual(RTS.groups.allIdle(w, 0), null);
});

test('鏡頭落在離群體中心最近的村民身上', () => {
  const { w } = base();
  const spots = [[8, 8], [10, 9], [11, 9], [28, 8]];
  spots.forEach(([x, y]) => unit(w, 'villager', 0, x, y));
  assert.deepStrictEqual(RTS.groups.allIdle(w, 0).focus, { x: 11.5, y: 9.5 });
});

test('依序選下一位：照 id 輪替，忙碌者略過', () => {
  const { w } = base();
  const [a, b, c] = [0, 1, 2].map(i => unit(w, 'villager', 0, 8 + i, 4));
  const next = last => (RTS.groups.nextIdle(w, 0, last) || {}).id;
  assert.deepStrictEqual([next(0), next(a.id), next(b.id), next(c.id)], [a.id, b.id, c.id, a.id]);
  RTS.commands.issue(w, 0, { type: 'move', unitIds: [b.id], x: 20, y: 10 });
  assert.strictEqual(next(a.id), c.id);
  [a, c].forEach(u => RTS.world.remove(w, u));
  assert.strictEqual(next(0), undefined);
});

test('快捷鍵看實體鍵位與 Shift，不看輸入的字元', () => {
  assert.strictEqual(RTS.groups.idleKey('Period', false), 'next');
  assert.strictEqual(RTS.groups.idleKey('Period', true), 'all');
  assert.strictEqual(RTS.groups.idleKey('Comma', true), null);
  assert.strictEqual(RTS.groups.idleKey('NumpadDecimal', false), null);
});

test('兩種語言的按鈕提示都寫明兩種用法', () => {
  for (const lang of ['zh-TW', 'en']) {
    const title = RTS.locales[lang]['hud.idleTitle'];
    assert.ok(/Shift \+ \./.test(title) && /Shift \+ (點擊|click)/.test(title), title);
  }
});
