'use strict';
const assert = require('assert');
const path = require('path');
const { RTS, arena, unit, root } = require('./helpers');
require(path.join(root, 'js/view/actions.js'));

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

test('文明：蒼林伐木較快、弓兵射程 +1、騎兵較脆，只影響自己', () => {
  const w = civWorld('greenwood'), v = unit(w, 'villager', 0, 5, 5), foe = unit(w, 'villager', 1, 6, 5);
  assert.ok(Math.abs(RTS.gather.rate(w, v, 'wood') / RTS.gather.rate(w, foe, 'wood') - 1.3) < 1e-9);
  ['archer', 'skirmisher', 'longbowman', 'ranger'].forEach((type, i) => {
    const u = unit(w, type, 0, 8 + i, 8);
    assert.strictEqual(RTS.combat.rangeOf(w, u), RTS.data.units[type].attack.range + 1);
  });
  assert.strictEqual(RTS.combat.rangeOf(w, unit(w, 'swordsman', 0, 12, 12)), 0.8);
  assert.strictEqual(unit(w, 'cavalry', 0, 14, 14).maxHp, 90);
});

test('文明：鐵岩採礦較快、村民較慢、近戰護甲 +2（與鐵匠鋪疊加）、箭塔射程 +2', () => {
  const w = civWorld('ironrock');
  assert.strictEqual(RTS.research.economy(w, 0, 'gather.gold'), 0.3);
  assert.strictEqual(RTS.research.economy(w, 0, 'gather.stone'), 0.3);
  assert.strictEqual(RTS.research.economy(w, 0, 'speed'), -0.1);
  assert.strictEqual(RTS.research.bonus(w, 0, 'spearman', 'armor'), 2);
  assert.strictEqual(RTS.research.bonus(w, 0, 'archer', 'armor'), 0);
  w.players[0].upgrades.meleeArmor = 1;
  assert.strictEqual(RTS.research.bonus(w, 0, 'swordsman', 'armor'), 3);
  const tower = RTS.world.addBuilding(w, 'tower', 0, 8, 8, true);
  assert.strictEqual(RTS.towers.rangeOf(w, tower), 9);
});

test('文明：金原農田較多、村民較快、弓兵射程較短、騎兵生命 +40（與兵種升級疊加）', () => {
  const w = civWorld('goldplain');
  assert.strictEqual(RTS.farm.food(w, 0), RTS.data.buildings.farm.farm.food + 120);
  assert.strictEqual(RTS.research.economy(w, 0, 'speed'), 0.2);
  assert.strictEqual(RTS.combat.rangeOf(w, unit(w, 'archer', 0, 3, 3)), 4);
  assert.strictEqual(unit(w, 'lancer', 0, 4, 4).maxHp, 125);
  const rider = unit(w, 'cavalry', 0, 5, 5);
  assert.strictEqual(rider.maxHp, 150);
  RTS.research.complete(w, 0, 'cavalryLine', 0);
  assert.strictEqual(rider.maxHp, 190);
  assert.strictEqual(unit(w, 'cavalry', 0, 6, 6).maxHp, 190);
  assert.strictEqual(unit(w, 'cavalry', 1, 7, 7).maxHp, 110);
});

test('專屬兵種：只有所屬文明能訓練，按鈕也只出現在該文明', () => {
  RTS.data.civOrder.forEach(civ => {
    const own = RTS.data.civs[civ].unique;
    assert.strictEqual(RTS.data.units[own].civ, civ);
    const type = Object.keys(RTS.data.buildings).find(b => RTS.data.buildings[b].trains.includes(own));
    const w = civWorld(civ);
    w.players[0].upgrades.age = 1;
    RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
    const b = RTS.world.addBuilding(w, type, 0, 8, 8, true);
    const train = () => RTS.commands.issue(w, 0, { type: 'train', buildingId: b.id, unit: own });
    const app = { world: w, human: 0, selection: [b.id], placement: null, mode: null, notify() {} };
    const buttons = () => RTS.actions.list(app).map(a => a.id).filter(id => id.startsWith('train:'));
    assert.ok(buttons().includes('train:' + own));
    const keys = RTS.actions.list(app).filter(a => !a.hidden).map(a => a.hotkey);
    assert.strictEqual(new Set(keys).size, keys.length, civ + ' 快捷鍵重複：' + keys);
    assert.ok(train().ok);
    w.players[0].civ = RTS.data.civOrder.find(c => c !== civ);
    assert.strictEqual(train().reason, 'wrongCiv');
    assert.ok(!buttons().includes('train:' + own));
  });
});

test('專屬兵種：電腦會訓練自己文明的兵種', () => {
  RTS.data.civOrder.forEach(civ => {
    const own = RTS.data.civs[civ].unique;
    const type = Object.keys(RTS.data.buildings).find(b => RTS.data.buildings[b].trains.includes(own));
    const w = arena(40, { food: 5000, wood: 5000, gold: 5000, stone: 5000 });
    w.players[1].civ = civ;
    w.players[1].upgrades.age = 1;
    RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
    RTS.world.addBuilding(w, 'townCenter', 1, 30, 30, true);
    for (let i = 0; i < 4; i++) RTS.world.addBuilding(w, 'house', 1, 2 + i * 3, 36, true);
    RTS.world.addBuilding(w, type, 1, 22, 30, true);
    const ai = RTS.ai.create(1, 'normal');
    let seen = false;
    for (let i = 0; i < 4000 && !seen; i++) {
      ai.update(w, RTS.data.TICK);
      RTS.game.step(w);
      seen = RTS.world.unitsOf(w, 1).some(u => u.type === own);
    }
    assert.ok(seen, civ);
  });
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
