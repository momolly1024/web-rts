'use strict';
const assert = require('assert');
const { RTS, arena, unit } = require('./helpers');

test('人口滿時回傳可提示蓋房屋的代碼；到總上限時改用另一個代碼', () => {
  const w = arena(40);
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 3, 3, true);
  for (let i = 0; i < 5; i++) unit(w, 'villager', 0, 10 + i, 10);
  const train = () => RTS.commands.issue(w, 0, { type: 'train', buildingId: tc.id, unit: 'villager' });
  assert.strictEqual(train().reason, 'popCap');
  for (let i = 0; i < 10; i++) RTS.world.addBuilding(w, 'house', 0, 3 + i * 3, 30, true);
  for (let i = 0; i < RTS.data.POP_MAX - 5; i++) unit(w, 'villager', 0, 10 + i % 20, 12 + Math.floor(i / 20));
  assert.strictEqual(train().reason, 'popMax');
});

test('兩種語言的人口提示都寫明做法', () => {
  for (const lang of ['zh-TW', 'en']) {
    const text = RTS.locales[lang]['error.popCap'];
    assert.ok(/H/.test(text) && /(房屋|House)/.test(text), text);
  }
});
