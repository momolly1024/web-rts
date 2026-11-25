'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function base(resources) {
  const w = arena(32, resources);
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 3, 3, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 26, 26, true);
  return { w, tc };
}
const zero = { food: 0, wood: 0, gold: 0 };

test('村民採集食物、木材、黃金並送回主堡入庫', () => {
  for (const [type, resource] of [['berry', 'food'], ['tree', 'wood'], ['gold', 'gold']]) {
    const { w } = base(zero);
    const node = RTS.world.addNode(w, type, 12, 5);
    const u = unit(w, 'villager', 0, 7, 5);
    const r = RTS.commands.issue(w, 0, { type: 'gather', unitIds: [u.id], targetId: node.id });
    assert.ok(r.ok);
    assert.ok(runUntil(w, () => w.players[0].res[resource] >= 20, 3000), resource + ' 應入庫');
    const total = w.players[0].res[resource] + u.carry.amount + node.amount;
    assert.strictEqual(total, RTS.data.nodes[type].amount, '資源總量守恆');
  }
});

test('資源耗盡後自動找附近同類資源', () => {
  const { w } = base(zero);
  const first = RTS.world.addNode(w, 'tree', 10, 5);
  const second = RTS.world.addNode(w, 'tree', 12, 8);
  first.amount = 4;
  const u = unit(w, 'villager', 0, 7, 5);
  RTS.commands.issue(w, 0, { type: 'gather', unitIds: [u.id], targetId: first.id });
  assert.ok(runUntil(w, () => w.players[0].res.wood >= 10, 3000));
  assert.strictEqual(RTS.world.get(w, first.id), null);
  assert.ok(second.amount < 100);
  assert.ok(RTS.map.isWalkable(w.map, 10, 5), '耗盡的資源格要讓出通道');
});

test('點到被包住的資源時改採附近可到達的同類', () => {
  const { w } = base(zero);
  for (let y = 9; y <= 11; y++) {
    for (let x = 13; x <= 15; x++) RTS.world.addNode(w, 'tree', x, y);
  }
  const inner = RTS.world.get(w, RTS.map.occupantAt(w.map, 14, 10));
  const u = unit(w, 'villager', 0, 8, 8);
  RTS.commands.issue(w, 0, { type: 'gather', unitIds: [u.id], targetId: inner.id });
  assert.ok(runUntil(w, () => w.players[0].res.wood >= 10, 3000));
});

test('建造扣資源、村民施工完成、提高人口上限', () => {
  const { w } = base({ food: 0, wood: 120, gold: 0 });
  const u = unit(w, 'villager', 0, 8, 8);
  const r = RTS.commands.issue(w, 0, { type: 'build', unitIds: [u.id], building: 'house', tx: 10, ty: 10 });
  assert.ok(r.ok, r.reason);
  assert.strictEqual(w.players[0].res.wood, 70);
  const house = RTS.world.get(w, r.buildingId);
  assert.strictEqual(house.complete, false);
  assert.strictEqual(RTS.world.population(w, 0).cap, 5);
  assert.ok(runUntil(w, () => house.complete, 2000));
  assert.strictEqual(house.hp, house.maxHp);
  assert.strictEqual(RTS.world.population(w, 0).cap, 10);
});

test('建造失敗時不扣資源；取消工地全額退款', () => {
  const { w } = base({ food: 0, wood: 60, gold: 0 });
  const u = unit(w, 'villager', 0, 8, 8);
  const build = cmd => RTS.commands.issue(w, 0, Object.assign({ type: 'build', unitIds: [u.id] }, cmd));
  assert.strictEqual(build({ building: 'house', tx: 3, ty: 3 }).ok, false, '重疊主堡');
  assert.strictEqual(build({ building: 'house', tx: 31, ty: 31 }).ok, false, '超出地圖');
  assert.strictEqual(build({ building: 'barracks', tx: 10, ty: 10 }).ok, false, '木材不足');
  assert.strictEqual(w.players[0].res.wood, 60);
  const r = build({ building: 'house', tx: 10, ty: 10 });
  assert.ok(r.ok);
  assert.ok(RTS.commands.issue(w, 0, { type: 'cancelBuild', buildingId: r.buildingId }).ok);
  assert.strictEqual(w.players[0].res.wood, 60);
  assert.ok(RTS.map.isWalkable(w.map, 10, 10));
});

test('放下建築時，壓到的己方單位會移到空地', () => {
  const { w } = base();
  const u = unit(w, 'villager', 0, 11, 11);
  const r = RTS.commands.issue(w, 0, { type: 'build', unitIds: [u.id], building: 'barracks', tx: 10, ty: 10 });
  assert.ok(r.ok);
  assert.ok(RTS.map.isWalkable(w.map, Math.floor(u.x), Math.floor(u.y)));
});

test('蓋完房屋後村民回去採集', () => {
  const { w } = base();
  const tree = RTS.world.addNode(w, 'tree', 12, 5);
  const u = unit(w, 'villager', 0, 8, 5);
  RTS.commands.issue(w, 0, { type: 'gather', unitIds: [u.id], targetId: tree.id });
  const r = RTS.commands.issue(w, 0, { type: 'build', unitIds: [u.id], building: 'house', tx: 10, ty: 10 });
  assert.ok(runUntil(w, () => RTS.world.get(w, r.buildingId).complete, 2000));
  assert.strictEqual(u.order.type, 'gather');
});

test('人口上限限制訓練，蓋房屋後解除', () => {
  const { w, tc } = base();
  for (let i = 0; i < 4; i++) unit(w, 'villager', 0, 10 + i, 3);
  const train = () => RTS.commands.issue(w, 0, { type: 'train', buildingId: tc.id, unit: 'villager' });
  assert.ok(train().ok);
  const food = w.players[0].res.food;
  const refused = train();
  assert.strictEqual(refused.ok, false);
  assert.strictEqual(refused.reason, 'popCap');
  assert.strictEqual(w.players[0].res.food, food);
  assert.ok(runUntil(w, () => RTS.world.unitsOf(w, 0).length === 5, 1000));
  assert.strictEqual(train().ok, false);
  RTS.world.addBuilding(w, 'house', 0, 15, 15, true);
  assert.ok(train().ok);
});

test('訓練受資源限制、取消佇列退款、房屋被毀時暫停出兵', () => {
  const { w, tc } = base({ food: 50, wood: 0, gold: 0 });
  const issue = c => RTS.commands.issue(w, 0, Object.assign({ buildingId: tc.id }, c));
  assert.ok(issue({ type: 'train', unit: 'villager' }).ok);
  assert.strictEqual(issue({ type: 'train', unit: 'villager' }).ok, false);
  assert.ok(issue({ type: 'cancelTrain', index: 0 }).ok);
  assert.strictEqual(w.players[0].res.food, 50);

  const house = RTS.world.addBuilding(w, 'house', 0, 15, 15, true);
  for (let i = 0; i < 5; i++) unit(w, 'villager', 0, 10 + i, 3);
  assert.ok(issue({ type: 'train', unit: 'villager' }).ok);
  RTS.world.remove(w, house);
  runUntil(w, () => false, 400);
  assert.strictEqual(RTS.world.unitsOf(w, 0).length, 5);
  assert.strictEqual(tc.queue[0].progress, 1);
});

test('不能指揮對方的單位與建築', () => {
  const { w, tc } = base();
  const mine = unit(w, 'villager', 0, 8, 8);
  assert.strictEqual(RTS.commands.issue(w, 1, { type: 'move', unitIds: [mine.id], x: 1, y: 1 }).ok, false);
  assert.strictEqual(RTS.commands.issue(w, 1, { type: 'train', buildingId: tc.id, unit: 'villager' }).ok, false);
});

test('右鍵智慧指令依目標決定行動', () => {
  const { w, tc } = base();
  const v = unit(w, 'villager', 0, 8, 8);
  const s = unit(w, 'swordsman', 0, 9, 8);
  const tree = RTS.world.addNode(w, 'tree', 12, 5);
  const enemy = unit(w, 'villager', 1, 20, 20);
  const smart = (target, x, y) => RTS.commands.issue(w, 0,
    { type: 'smart', unitIds: [v.id, s.id], targetId: target && target.id, x, y });
  smart(tree, 12, 5);
  assert.deepStrictEqual([v.order.type, s.order.type], ['gather', 'move']);
  smart(enemy, 20, 20);
  assert.deepStrictEqual([v.order.type, s.order.type], ['attack', 'attack']);
  smart(null, 15, 15);
  assert.deepStrictEqual([v.order.type, s.order.type], ['move', 'move']);
  v.carry = { resource: 'wood', amount: 5 };
  smart(tc, 4, 4);
  assert.deepStrictEqual([v.order.type, s.order.type], ['deposit', 'move']);
  const site = RTS.world.addBuilding(w, 'house', 0, 15, 15, false);
  smart(site, 15, 15);
  assert.deepStrictEqual([v.order.type, s.order.type], ['build', 'move']);
});
