'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function field() {
  const w = arena(30, { food: 5000, wood: 5000, gold: 5000, stone: 5000 });
  RTS.world.addBuilding(w, 'townCenter', 0, 0, 0, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 27, 27, true);
  return w;
}

test('兵種升級：劍士兩級（封建、城堡），現有與新訓練的一起變強', () => {
  const w = field();
  const barracks = RTS.world.addBuilding(w, 'barracks', 0, 10, 10, true);
  const old = unit(w, 'swordsman', 0, 8, 8);
  const research = () => RTS.commands.issue(w, 0, { type: 'research', buildingId: barracks.id, track: 'swordLine' });
  assert.strictEqual(research().reason, 'needsFeudal');
  w.players[0].upgrades.age = 1;
  assert.ok(research().ok);
  assert.ok(runUntil(w, () => RTS.research.tier(w, 0, 'swordsman') === 1, 1000));
  assert.strictEqual(old.maxHp, RTS.data.units.swordsman.hp + 15);
  assert.strictEqual(RTS.research.bonus(w, 0, 'swordsman', 'attack'), 2);
  assert.strictEqual(RTS.research.bonus(w, 0, 'swordsman', 'armor'), 1);
  assert.strictEqual(research().reason, 'needsCastle');
  w.players[0].upgrades.age = 2;
  assert.ok(research().ok);
  assert.ok(runUntil(w, () => RTS.research.tier(w, 0, 'swordsman') === 2, 1500));
  const fresh = RTS.world.addUnit(w, 'swordsman', 0, 9.5, 9.5);
  assert.strictEqual(fresh.maxHp, RTS.data.units.swordsman.hp + 35);
  assert.strictEqual(RTS.research.tier(w, 1, 'swordsman'), 0, '對手不受影響');
});

test('兵種升級：精銳長弓手射程 +1、重騎兵更強', () => {
  const w = field();
  w.players[0].upgrades.archerLine = 1;
  w.players[0].upgrades.cavalryLine = 1;
  const a = unit(w, 'longbowman', 0, 5, 5);
  assert.strictEqual(RTS.combat.rangeOf(w, a), RTS.data.units.longbowman.attack.range + 1);
  assert.strictEqual(RTS.combat.rangeOf(w, unit(w, 'archer', 0, 6, 5)), RTS.data.units.archer.attack.range, '兵營的弓箭手沒有升級');
  assert.ok(RTS.research.bonus(w, 0, 'cavalry', 'attack') > 0);
});

test('治療者：自動治療附近受傷的己方單位，不治療攻城槌，也不能攻擊', () => {
  const w = field();
  const healer = unit(w, 'healer', 0, 10, 10);
  const hurt = unit(w, 'swordsman', 0, 12, 10);
  hurt.hp = 20;
  assert.ok(runUntil(w, () => hurt.hp === hurt.maxHp, 2000), '應補滿');
  const ram = unit(w, 'ram', 0, 10, 13);
  ram.hp = 50;
  runUntil(w, () => false, 300);
  assert.strictEqual(ram.hp, 50, '攻城槌不能治療');
  const enemy = unit(w, 'swordsman', 1, 20, 20);
  assert.strictEqual(RTS.commands.issue(w, 0, { type: 'attack', unitIds: [healer.id], targetId: enemy.id }).reason, 'cannotAttack');
  assert.strictEqual(RTS.combat.acquire(w, healer, true), null);
});

test('攻城槌：只打建築、拆得很快；箭只能造成最低傷害', () => {
  const w = field();
  const ram = unit(w, 'ram', 0, 12, 12);
  const enemy = unit(w, 'swordsman', 1, 13, 12);
  const house = RTS.world.addBuilding(w, 'house', 1, 15, 12, true);
  assert.strictEqual(RTS.combat.acquire(w, ram, false), house, '旁邊有敵兵也只找建築');
  assert.strictEqual(RTS.commands.issue(w, 0, { type: 'attack', unitIds: [ram.id], targetId: enemy.id }).reason, 'cannotAttack');
  const ramHit = RTS.combat.damageOf('ram', RTS.data.buildings.house);
  const swordHit = RTS.combat.damageOf('swordsman', RTS.data.buildings.house);
  assert.ok(ramHit / RTS.data.units.ram.attack.cooldown > 5 * swordHit / RTS.data.units.swordsman.attack.cooldown);
  assert.strictEqual(RTS.combat.damageOf('archer', RTS.data.units.ram), 1);
  RTS.world.remove(w, enemy);
  RTS.commands.issue(w, 0, { type: 'attack', unitIds: [ram.id], targetId: house.id });
  assert.ok(runUntil(w, () => !RTS.world.get(w, house.id), 1500), '應拆掉房屋');
});
