'use strict';
const assert = require('assert');
const { RTS, arena, unit } = require('./helpers');

function civWorld(civ) {
  const w = arena(30);
  w.players[0].civ = civ;
  return w;
}

test('文明：沒指定時沒有任何加成', () => {
  const w = arena(30);
  assert.strictEqual(w.players[0].civ, null);
  assert.strictEqual(RTS.research.economy(w, 0, 'gather.wood'), 0);
  assert.strictEqual(RTS.research.tierBonus(w, 0, 'cavalry', 'hp'), 0);
  assert.strictEqual(RTS.research.bonus(w, 0, 'swordsman', 'armor'), 0);
});

test('文明：蒼林伐木較快、三種弓兵射程 +0.5，只影響自己', () => {
  const w = civWorld('greenwood'), v = unit(w, 'villager', 0, 5, 5), foe = unit(w, 'villager', 1, 6, 5);
  assert.ok(Math.abs(RTS.gather.rate(w, v, 'wood') / RTS.gather.rate(w, foe, 'wood') - 1.15) < 1e-9);
  ['archer', 'skirmisher', 'longbowman'].forEach((type, i) => {
    const u = unit(w, type, 0, 8 + i, 8);
    assert.strictEqual(RTS.combat.rangeOf(w, u), RTS.data.units[type].attack.range + 0.5);
  });
  assert.strictEqual(RTS.combat.rangeOf(w, unit(w, 'swordsman', 0, 12, 12)), 0.8);
});

test('文明：鐵岩採礦較快、近戰護甲 +1（與鐵匠鋪疊加）、箭塔射程 +1', () => {
  const w = civWorld('ironrock');
  assert.strictEqual(RTS.research.economy(w, 0, 'gather.gold'), 0.15);
  assert.strictEqual(RTS.research.economy(w, 0, 'gather.stone'), 0.15);
  assert.strictEqual(RTS.research.bonus(w, 0, 'spearman', 'armor'), 1);
  assert.strictEqual(RTS.research.bonus(w, 0, 'archer', 'armor'), 0);
  w.players[0].upgrades.meleeArmor = 1;
  assert.strictEqual(RTS.research.bonus(w, 0, 'swordsman', 'armor'), 2);
  const tower = RTS.world.addBuilding(w, 'tower', 0, 8, 8, true);
  assert.strictEqual(RTS.towers.rangeOf(w, tower), 8);
});

test('文明：金原農田較多、村民較快、騎兵生命 +20（與兵種升級疊加）', () => {
  const w = civWorld('goldplain');
  assert.strictEqual(RTS.farm.food(w, 0), RTS.data.buildings.farm.farm.food + 60);
  assert.strictEqual(RTS.research.economy(w, 0, 'speed'), 0.1);
  const rider = unit(w, 'cavalry', 0, 5, 5);
  assert.strictEqual(rider.maxHp, 130);
  RTS.research.complete(w, 0, 'cavalryLine', 0);
  assert.strictEqual(rider.maxHp, 170);
  assert.strictEqual(unit(w, 'cavalry', 0, 6, 6).maxHp, 170);
  assert.strictEqual(unit(w, 'cavalry', 1, 7, 7).maxHp, 110);
});

test('文明分配：玩家照選擇，電腦與「隨機」由亂數決定', () => {
  const w = arena(24);
  RTS.civs.assign(w, 0, 'ironrock', () => 0.99);
  assert.deepStrictEqual(w.players.map(p => p.civ), ['ironrock', 'goldplain']);
  RTS.civs.assign(w, 0, 'random', () => 0);
  assert.deepStrictEqual(w.players.map(p => p.civ), ['greenwood', 'greenwood']);
});

test('文明：每個文明在兩種語言都有名稱與完整加成說明', () => {
  const before = RTS.i18n.current();
  RTS.i18n.LANGUAGES.forEach(lang => {
    RTS.i18n.set(lang);
    RTS.data.civOrder.forEach(key => {
      assert.ok(RTS.i18n.t('civ.' + key) !== 'civ.' + key);
      const lines = RTS.upgradeInfo.civLines(key);
      assert.ok(lines.length >= 2);
      lines.forEach(line => assert.ok(!/civ|\{|undefined/i.test(line), lang + ': ' + line));
    });
  });
  RTS.i18n.set(before);
});
