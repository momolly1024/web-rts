'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

// 雙方都有主堡的場地（少了敵方主堡會立刻判定勝負）
function field(size = 30) {
  const w = arena(size);
  RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
  RTS.world.addBuilding(w, 'townCenter', 1, size - 4, size - 4, true);
  return w;
}

test('收集建築：只收自己負責的資源，主堡全收', () => {
  const w = field();
  const camp = RTS.world.addBuilding(w, 'lumberCamp', 0, 14, 14, true);
  const mine = RTS.world.addBuilding(w, 'miningCamp', 0, 14, 18, true);
  const mill = RTS.world.addBuilding(w, 'mill', 0, 18, 14, true);
  const tc = RTS.world.list(w, e => e.type === 'townCenter' && e.owner === 0)[0];
  assert.ok(RTS.gather.accepts(camp, 'wood') && !RTS.gather.accepts(camp, 'food'));
  assert.ok(RTS.gather.accepts(mine, 'gold') && RTS.gather.accepts(mine, 'stone') && !RTS.gather.accepts(mine, 'wood'));
  assert.ok(RTS.gather.accepts(mill, 'food') && !RTS.gather.accepts(mill, 'gold'));
  ['food', 'wood', 'gold', 'stone'].forEach(r => assert.ok(RTS.gather.accepts(tc, r)));
  assert.ok(!RTS.gather.accepts(RTS.world.addBuilding(w, 'house', 0, 20, 20, true), 'wood'));
});

test('收集建築：村民把木材交到旁邊的伐木場，不跑回主堡', () => {
  const w = field();
  const tree = RTS.world.addNode(w, 'tree', 20, 16);
  RTS.world.addBuilding(w, 'lumberCamp', 0, 20, 13, true);
  RTS.world.addBuilding(w, 'mill', 0, 22, 17, true);     // 磨坊更近但不收木材
  const v = unit(w, 'villager', 0, 19, 16);
  RTS.commands.issue(w, 0, { type: 'gather', unitIds: [v.id], targetId: tree.id });
  const wood = w.players[0].res.wood;
  let farthest = 0;
  assert.ok(runUntil(w, () => w.players[0].res.wood > wood, 2000, () => {
    farthest = Math.max(farthest, Math.hypot(v.x - 20.5, v.y - 16.5));
  }));
  assert.ok(farthest < 6, '跑得太遠：' + farthest.toFixed(1));
});

test('農田：需要完工的磨坊；可行走但不能在上面蓋別的建築', () => {
  const w = field();
  const v = unit(w, 'villager', 0, 8, 8);
  const order = { type: 'build', unitIds: [v.id], building: 'farm', tx: 10, ty: 10 };
  assert.strictEqual(RTS.commands.issue(w, 0, order).reason, 'needsMill');
  const mill = RTS.world.addBuilding(w, 'mill', 0, 14, 10, false);
  assert.strictEqual(RTS.commands.issue(w, 0, order).reason, 'needsMill', '工地不算');
  mill.complete = true;
  const r = RTS.commands.issue(w, 0, order);
  assert.ok(r.ok);
  for (let y = 10; y < 13; y++) {
    for (let x = 10; x < 13; x++) assert.ok(RTS.map.isWalkable(w.map, x, y));
  }
  assert.strictEqual(RTS.construction.canPlace(w, 0, 'house', 11, 11).reason, 'blocked');
  assert.strictEqual(RTS.construction.canPlace(w, 0, 'farm', 12, 12).reason, 'blocked');
});

test('農田：蓋好的村民直接耕作，食物送到磨坊；拆掉後地面恢復可建', () => {
  const w = field();
  RTS.world.addBuilding(w, 'mill', 0, 14, 10, true);
  const v = unit(w, 'villager', 0, 8, 8);
  const r = RTS.commands.issue(w, 0, { type: 'build', unitIds: [v.id], building: 'farm', tx: 10, ty: 10 });
  const farm = RTS.world.get(w, r.buildingId);
  assert.ok(runUntil(w, () => farm.complete, 2000));
  assert.strictEqual(farm.amount, RTS.data.buildings.farm.farm.food);
  assert.strictEqual(v.order.type, 'gather');
  assert.strictEqual(v.order.targetId, farm.id);
  const food = w.players[0].res.food;
  assert.ok(runUntil(w, () => w.players[0].res.food > food, 2000));
  assert.ok(farm.amount < RTS.data.buildings.farm.farm.food);
  RTS.world.remove(w, farm);
  assert.ok(RTS.construction.canPlace(w, 0, 'house', 11, 11).ok);
});

test('農田：一次只有一位村民耕作，第二位改去空著的農田', () => {
  const w = field();
  RTS.world.addBuilding(w, 'mill', 0, 14, 10, true);
  const a = RTS.world.addBuilding(w, 'farm', 0, 10, 10, true);
  const b = RTS.world.addBuilding(w, 'farm', 0, 10, 14, true);
  const v1 = unit(w, 'villager', 0, 9, 9), v2 = unit(w, 'villager', 0, 9, 8);
  RTS.commands.issue(w, 0, { type: 'smart', unitIds: [v1.id, v2.id], targetId: a.id, x: 11, y: 11 });
  runUntil(w, () => false, 300);
  assert.ok(a.amount < RTS.data.buildings.farm.farm.food && b.amount < RTS.data.buildings.farm.farm.food,
    `兩塊都有人種：${a.amount} ${b.amount}`);
  const farmers = [RTS.farm.farmerOf(w, a), RTS.farm.farmerOf(w, b)].map(u => u && u.id).sort();
  assert.deepStrictEqual(farmers, [v1.id, v2.id].sort());
});

test('農田：種完沒有預約就消失；有預約則補滿並扣一次', () => {
  const w = field();
  const mill = RTS.world.addBuilding(w, 'mill', 0, 14, 10, true);
  const farm = RTS.world.addBuilding(w, 'farm', 0, 10, 10, true);
  const v = unit(w, 'villager', 0, 11, 11);
  RTS.commands.issue(w, 0, { type: 'gather', unitIds: [v.id], targetId: farm.id });
  const wood = w.players[0].res.wood;
  assert.ok(RTS.commands.issue(w, 0, { type: 'reseed', buildingId: mill.id }).ok);
  assert.strictEqual(w.players[0].res.wood, wood - RTS.data.buildings.farm.cost.wood);
  assert.strictEqual(w.players[0].reseeds, 1);
  farm.amount = 2;
  assert.ok(runUntil(w, () => w.players[0].reseeds === 0, 400));
  assert.ok(RTS.world.get(w, farm.id), '重種後還在');
  assert.strictEqual(farm.amount, RTS.data.buildings.farm.farm.food);
  farm.amount = 2;
  assert.ok(runUntil(w, () => !RTS.world.get(w, farm.id), 400));
  assert.ok(RTS.map.isWalkable(w.map, 11, 11) && !RTS.map.floorAt(w.map, 11, 11));
});

test('磨坊預約重種：可取消退款，工地與其他建築不能預約', () => {
  const w = field();
  const mill = RTS.world.addBuilding(w, 'mill', 0, 14, 10, true);
  const wood = w.players[0].res.wood;
  RTS.commands.issue(w, 0, { type: 'reseed', buildingId: mill.id });
  RTS.commands.issue(w, 0, { type: 'reseed', buildingId: mill.id });
  assert.ok(RTS.commands.issue(w, 0, { type: 'cancelReseed' }).ok);
  assert.strictEqual(w.players[0].reseeds, 1);
  assert.strictEqual(w.players[0].res.wood, wood - RTS.data.buildings.farm.cost.wood);
  const house = RTS.world.addBuilding(w, 'house', 0, 20, 20, true);
  assert.strictEqual(RTS.commands.issue(w, 0, { type: 'reseed', buildingId: house.id }).reason, 'cannotReseed');
  const site = RTS.world.addBuilding(w, 'mill', 0, 20, 10, false);
  assert.strictEqual(RTS.commands.issue(w, 0, { type: 'reseed', buildingId: site.id }).reason, 'notComplete');
  assert.strictEqual(RTS.commands.issue(w, 1, { type: 'reseed', buildingId: mill.id }).reason, 'buildingNotFound');
});

test('經濟科技：伐木加速、搬運推車加負重與速度、豐收田增加新農田食物', () => {
  const w = field();
  const v = unit(w, 'villager', 0, 8, 8);
  const rate = RTS.gather.rate(w, v, 'wood'), cap = RTS.gather.capacity(w, v), speed = RTS.move.speedOf(w, v);
  w.players[0].upgrades.woodcutting = 2;
  w.players[0].upgrades.handcart = 1;
  w.players[0].upgrades.farmYield = 1;
  assert.ok(Math.abs(RTS.gather.rate(w, v, 'wood') - rate * 1.3) < 1e-9);
  assert.strictEqual(RTS.gather.rate(w, v, 'gold'), RTS.data.units.villager.gatherRate.gold, '只加木材');
  assert.strictEqual(RTS.gather.capacity(w, v), cap + 3);
  assert.ok(Math.abs(RTS.move.speedOf(w, v) - speed * 1.1) < 1e-9);
  const sword = unit(w, 'swordsman', 0, 9, 9);
  assert.strictEqual(RTS.move.speedOf(w, sword), RTS.data.units.swordsman.speed, '士兵不受影響');
  assert.strictEqual(RTS.farm.food(w, 0), RTS.data.buildings.farm.farm.food + 60);
  assert.strictEqual(RTS.farm.food(w, 1), RTS.data.buildings.farm.farm.food, '對手不受影響');
});

test('經濟科技：在對應建築研究，完成後等級提升', () => {
  const w = field();
  const camp = RTS.world.addBuilding(w, 'lumberCamp', 0, 14, 14, true);
  assert.strictEqual(RTS.commands.issue(w, 0, { type: 'research', buildingId: camp.id, track: 'goldMining' }).reason,
    'cannotResearch');
  assert.ok(RTS.commands.issue(w, 0, { type: 'research', buildingId: camp.id, track: 'woodcutting' }).ok);
  assert.ok(runUntil(w, () => RTS.research.level(w, 0, 'woodcutting') === 1, 1000));
  const tc = RTS.world.list(w, e => e.type === 'townCenter' && e.owner === 0)[0];
  assert.ok(RTS.commands.issue(w, 0, { type: 'research', buildingId: tc.id, track: 'handcart' }).ok);
});
