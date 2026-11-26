'use strict';
const assert = require('assert');
const path = require('path');
const { RTS, arena, root } = require('./helpers');
require(path.join(root, 'js/view/actions.js'));

function setup() {
  const w = arena(30, { food: 5000, wood: 5000, gold: 5000, stone: 5000 });
  const info = track => RTS.upgradeInfo.lines(w, 0, track).join('\n');
  return { w, info };
}

function inLanguage(language, fn) {
  const before = RTS.i18n.current();
  RTS.i18n.set(language);
  try { fn(); } finally { RTS.i18n.set(before); }
}

test('升級說明：兵種升級顯示目前與升級後數值（含鐵匠鋪加成），滿級只剩目前值', () => inLanguage('en', () => {
  const { w, info } = setup();
  w.players[0].upgrades.meleeAttack = 1;
  assert.ok(info('swordLine').includes('HP 75 → 90'));
  assert.ok(info('swordLine').includes('Attack 11 → 13'));
  assert.ok(info('swordLine').includes('melee 1 → 2, pierce 1 → 2'));
  assert.ok(info('archerLine').includes('Range 5.5 → 6.5'));
  w.players[0].upgrades.swordLine = 2;
  assert.ok(info('swordLine').includes('HP 110') && !info('swordLine').includes('→'));
}));

test('升級說明：鐵匠鋪列出受影響兵種，經濟與箭塔研究列出效果', () => inLanguage('en', () => {
  const { info } = setup();
  const melee = info('meleeAttack');
  assert.ok(melee.includes('Swordsman: Attack 9 → 11') && melee.includes('Cavalry: Attack 8 → 10'));
  assert.ok(!melee.includes('archer'));
  assert.ok(info('woodcutting').includes('+0% → +15%'));
  assert.ok(info('handcart').includes('carry capacity 10 → 13'));
  assert.ok(info('farmYield').includes('175 → 235'));
  assert.ok(info('towerUpgrade').includes('Tower attack 5 → 8'));
  assert.ok(info('towerUpgrade').includes('Tower range 7 → 8'));
}));

test('升級說明：升時代列出解鎖內容；每個研究的每一級在兩種語言都沒有缺字串', () => {
  inLanguage('en', () => {
    const { info } = setup();
    assert.ok(info('age').includes('Unlocks buildings:') && info('age').includes('Blacksmith'));
    assert.ok(info('age').includes('Spearman'));
  });
  ['zh-TW', 'en'].forEach(language => inLanguage(language, () => {
    const { w, info } = setup();
    Object.keys(RTS.data.upgrades).forEach(track => {
      for (let lv = 0; lv <= RTS.data.upgrades[track].levels.length; lv++) {
        w.players[0].upgrades = { [track]: lv };
        const text = info(track);
        assert.ok(!/tip\.|unit\.|unitTier\.|info\.|\{|undefined|NaN/.test(text),
          language + ' ' + track + ' ' + lv + ': ' + text);
      }
    });
  }));
});

test('升級說明：研究按鈕帶說明，含花費與不能研究的原因', () => inLanguage('en', () => {
  const { w } = setup();
  w.players[0].res.wood = 0;
  const b = RTS.world.addBuilding(w, 'lumberCamp', 0, 5, 5, true);
  const app = { world: w, human: 0, selection: [b.id], placement: null, mode: null, notify() {} };
  const text = RTS.actions.list(app).find(a => a.id === 'research:woodcutting').detail().join('\n');
  assert.ok(text.includes('Cost: ') && text.includes(RTS.i18n.t('error.notEnoughResources')));
}));
