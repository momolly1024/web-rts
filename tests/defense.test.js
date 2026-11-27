'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function field(size = 30) {
  const w = arena(size, { food: 3000, wood: 3000, gold: 3000, stone: 3000 });
  RTS.world.addBuilding(w, 'townCenter', 0, 0, 0, true);
  RTS.world.addBuilding(w, 'townCenter', 1, size - 3, size - 3, true);
  w.players.forEach(p => { p.upgrades.age = 2; });
  return w;
}

test('箭塔：射擊範圍內的敵方單位，範圍外不射；強化後傷害與射程提高', () => {
  const w = field();
  const tower = RTS.world.addBuilding(w, 'tower', 0, 10, 10, true);
  const far = unit(w, 'swordsman', 1, 10, 19);
  runUntil(w, () => false, 100);
  assert.strictEqual(far.hp, far.maxHp, '射程外');
  const near = unit(w, 'swordsman', 1, 10, 14);
  near.order = { type: 'move', x: 10, y: 14 };
  assert.ok(runUntil(w, () => near.hp < near.maxHp, 100));
  const before = RTS.towers.rangeOf(w, tower);
  w.players[0].upgrades.towerUpgrade = 1;
  assert.strictEqual(RTS.towers.rangeOf(w, tower), before + 1);
  const atk = RTS.data.buildings.tower.attack;
  assert.ok(RTS.combat.hitDamage(atk, RTS.data.units.archer, 3, 0) > RTS.combat.hitDamage(atk, RTS.data.units.archer, 0, 0));
});

test('石牆：拉一條線一次放多格工地、扣石材，村民依序蓋完', () => {
  const w = field();
  const v = unit(w, 'villager', 0, 8, 8);
  const stone = w.players[0].res.stone;
  const r = RTS.commands.issue(w, 0, { type: 'buildWall', unitIds: [v.id], x0: 10, y0: 5, x1: 10, y1: 9 });
  assert.ok(r.ok && r.count === 5, JSON.stringify(r));
  assert.strictEqual(w.players[0].res.stone, stone - 5 * RTS.data.buildings.wall.cost.stone);
  const walls = () => RTS.world.buildingsOf(w, 0, 'wall');
  assert.strictEqual(walls().length, 5);
  assert.ok(runUntil(w, () => walls().every(b => b.complete), 4000), '應全部蓋完');
  w.players[0].res.stone = 12;
  const r2 = RTS.commands.issue(w, 0, { type: 'buildWall', unitIds: [v.id], x0: 14, y0: 5, x1: 14, y1: 9 });
  assert.strictEqual(r2.count, 2, '石材只夠兩格');
  w.players[0].upgrades.age = 0;
  assert.strictEqual(RTS.commands.issue(w, 0, { type: 'buildWall', unitIds: [v.id], x0: 18, y0: 5, x1: 18, y1: 9 }).reason, 'needsFeudal');
});

// 一道貫穿地圖的牆，中間一格是 owner 的城門
function walled(owner = 0) {
  const w = field(24);
  for (let y = 0; y < 24; y++) if (y !== 12) RTS.world.addBuilding(w, 'wall', 0, 12, y, true);
  const gate = RTS.world.addBuilding(w, 'gate', owner, 12, 12, true);
  return { w, gate };
}

test('城門：自己人可以通過，敵人過不去', () => {
  const { w } = walled(0);
  const mine = unit(w, 'villager', 0, 6, 12), theirs = unit(w, 'villager', 1, 6, 11);
  RTS.commands.issue(w, 0, { type: 'move', unitIds: [mine.id], x: 18.5, y: 12.5 });
  assert.ok(runUntil(w, () => mine.x > 13, 1500), '自己人應穿過城門');
  RTS.commands.issue(w, 1, { type: 'move', unitIds: [theirs.id], x: 18.5, y: 11.5 });
  runUntil(w, () => false, 1500);
  assert.ok(theirs.x < 12, '敵人不能穿過');
  assert.ok(!RTS.path.find(w.map, 6, 11, RTS.move.pointGoal(18, 11), { owner: 1 }).reached);
  assert.ok(RTS.path.find(w.map, 6, 11, RTS.move.pointGoal(18, 11), { owner: 0 }).reached);
});

test('城門：可以直接蓋在自己的城牆上取代它；不能蓋在別人的牆上', () => {
  const w = field();
  const v = unit(w, 'villager', 0, 8, 8);
  const wall = RTS.world.addBuilding(w, 'wall', 0, 10, 10, true);
  RTS.world.addBuilding(w, 'wall', 1, 14, 10, true);
  assert.ok(RTS.construction.canPlace(w, 0, 'gate', 10, 10).ok);
  assert.strictEqual(RTS.construction.canPlace(w, 0, 'gate', 14, 10).reason, 'blocked');
  assert.strictEqual(RTS.construction.canPlace(w, 0, 'house', 10, 10).reason, 'blocked');
  const r = RTS.commands.issue(w, 0, { type: 'build', unitIds: [v.id], building: 'gate', tx: 10, ty: 10 });
  assert.ok(r.ok);
  assert.ok(!RTS.world.get(w, wall.id), '牆被取代');
  assert.strictEqual(RTS.world.get(w, r.buildingId).type, 'gate');
});

test('城門順著相鄰的城牆或城門轉向；單獨一座維持左右向', () => {
  const w = field();
  RTS.world.addBuilding(w, 'wall', 0, 10, 9, true);
  RTS.world.addBuilding(w, 'wall', 0, 10, 11, true);
  assert.strictEqual(RTS.construction.gateAxis(w, 10, 10), 'y', '上下有牆');
  RTS.world.addBuilding(w, 'wall', 0, 15, 10, true);
  RTS.world.addBuilding(w, 'wall', 0, 17, 10, true);
  assert.strictEqual(RTS.construction.gateAxis(w, 16, 10), 'x', '左右有牆');
  RTS.world.addBuilding(w, 'gate', 1, 20, 9, true);
  assert.strictEqual(RTS.construction.gateAxis(w, 20, 10), 'y', '相鄰的城門也算，不分主人');
  assert.strictEqual(RTS.construction.gateAxis(w, 5, 5), 'x', '沒有相鄰的牆');
});

test('被城牆擋住的軍隊會改打擋路的牆', () => {
  const { w } = walled(0);
  const s = unit(w, 'swordsman', 1, 8, 12);
  RTS.commands.issue(w, 1, { type: 'attackMove', unitIds: [s.id], x: 18.5, y: 12.5 });
  const hp = () => RTS.world.buildingsOf(w, 0).filter(b => b.type === 'wall' || b.type === 'gate')
    .reduce((a, b) => a + b.hp, 0);
  const before = hp();
  assert.ok(runUntil(w, () => hp() < before, 2000), '應開始拆牆或門');
});
