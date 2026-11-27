'use strict';
const assert = require('assert');
const { RTS, arena, unit } = require('./helpers');

test('人口滿時回傳可提示蓋房屋的代碼；沒有總上限，蓋多少房屋就加多少', () => {
  const w = arena(64);
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 3, 3, true);
  for (let i = 0; i < 5; i++) unit(w, 'villager', 0, 10 + i, 10);
  const train = () => RTS.commands.issue(w, 0, { type: 'train', buildingId: tc.id, unit: 'villager' });
  assert.strictEqual(train().reason, 'popCap');
  for (let i = 0; i < 30; i++) {
    RTS.world.addBuilding(w, 'house', 0, 3 + (i % 15) * 3, 30 + Math.floor(i / 15) * 3, true);
  }
  assert.strictEqual(RTS.world.population(w, 0).cap, 155);
  for (let i = 0; i < 60; i++) unit(w, 'villager', 0, 10 + i % 20, 12 + Math.floor(i / 20));
  assert.ok(train().ok, '超過 50 人仍可訓練');
});

test('兩種語言的人口提示都寫明做法', () => {
  for (const lang of ['zh-TW', 'en']) {
    const text = RTS.locales[lang]['error.popCap'];
    assert.ok(/H/.test(text) && /(房屋|House)/.test(text), text);
  }
});
