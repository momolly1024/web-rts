'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function base(resources) {
  const w = arena(32, resources);
  RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 27, 27, true);
  const smith = RTS.world.addBuilding(w, 'blacksmith', 0, 10, 10, true);
  const research = track => RTS.commands.issue(w, 0, { type: 'research', buildingId: smith.id, track });
  return { w, smith, research };
}

test('研究花資源與時間，完成後等級提升', () => {
  const { w, smith, research } = base();
  const cost = RTS.data.upgrades.meleeAttack.levels[0].cost;
  const before = Object.assign({}, w.players[0].res);
  assert.ok(research('meleeAttack').ok);
  for (const k of Object.keys(cost)) assert.strictEqual(w.players[0].res[k], before[k] - cost[k]);
  assert.strictEqual(RTS.research.level(w, 0, 'meleeAttack'), 0);
  assert.strictEqual(research('meleeAttack').reason, 'alreadyResearching');
  assert.ok(runUntil(w, () => RTS.research.level(w, 0, 'meleeAttack') === 1, 2000));
  assert.ok(w.time >= RTS.data.upgrades.meleeAttack.levels[0].time - 0.1);
  assert.strictEqual(smith.queue.length, 0);
});

test('兩級為上限；取消研究全額退款；資源不足被拒', () => {
  const { w, smith, research } = base({ food: 2000, wood: 2000, gold: 2000 });
  for (let lv = 1; lv <= 2; lv++) {
    assert.ok(research('rangedArmor').ok);
    assert.ok(runUntil(w, () => RTS.research.level(w, 0, 'rangedArmor') === lv, 2000));
  }
  assert.strictEqual(research('rangedArmor').reason, 'maxLevel');
  const res = JSON.stringify(w.players[0].res);
  assert.ok(research('rangedAttack').ok);
  assert.ok(RTS.commands.issue(w, 0, { type: 'cancelTrain', buildingId: smith.id, index: 0 }).ok);
  assert.strictEqual(JSON.stringify(w.players[0].res), res);
  w.players[0].res.gold = 0;
  assert.strictEqual(research('meleeArmor').reason, 'notEnoughResources');
  assert.strictEqual(RTS.world.population(w, 0).queued, 0, '研究不佔人口');
});

test('升級對現有與之後訓練的同類單位都生效', () => {
  const { w } = base();
  const d = (atk, def, aPid, dPid) => RTS.combat.damageOf(atk, RTS.data.units[def],
    RTS.research.bonus(w, aPid, atk, 'attack'), RTS.research.bonus(w, dPid, def, 'armor'));
  const plain = d('swordsman', 'swordsman', 1, 1);
  const plainArrow = d('archer', 'swordsman', 1, 1);
  w.players[0].upgrades = { meleeAttack: 2, meleeArmor: 1, rangedAttack: 1 };
  assert.ok(d('swordsman', 'swordsman', 0, 1) > plain);
  assert.ok(d('swordsman', 'swordsman', 1, 0) < plain);
  assert.ok(d('archer', 'swordsman', 0, 1) > plainArrow);
  assert.strictEqual(d('villager', 'swordsman', 0, 1), d('villager', 'swordsman', 1, 1), '村民不受軍事升級');
  const a = unit(w, 'swordsman', 0, 15, 15);
  const b = unit(w, 'swordsman', 1, 16, 15);
  const hp = b.hp;
  RTS.commands.issue(w, 0, { type: 'attack', unitIds: [a.id], targetId: b.id });
  assert.ok(runUntil(w, () => b.hp < hp, 100));
  assert.strictEqual(hp - b.hp, d('swordsman', 'swordsman', 0, 1));
});

test('AI 依難度蓋鐵匠鋪並研究', () => {
  const reached = {};
  for (const key of RTS.data.difficultyOrder) {
    const w = RTS.game.create(7);
    const ai = RTS.ai.create(1, key);
    const target = RTS.world.buildingsOf(w, 0, 'townCenter')[0];
    target.hp = target.maxHp = 1e9;
    for (let i = 0; i < 24000; i++) { ai.update(w, RTS.data.TICK); RTS.game.step(w); }
    reached[key] = Object.values(w.players[1].upgrades).reduce((a, b) => a + b, 0);
    const max = RTS.ai.config(key).blacksmith.maxLevel;
    assert.ok(Object.values(w.players[1].upgrades).every(v => v <= max), key);
  }
  console.log('      研究總級數 ' + JSON.stringify(reached));
  assert.ok(reached.easy >= 1 && reached.normal >= 3 && reached.hard >= reached.normal, JSON.stringify(reached));
});
