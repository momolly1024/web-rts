'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function field(size = 30) {
  const w = arena(size);
  RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
  RTS.world.addBuilding(w, 'townCenter', 1, size - 4, size - 4, true);
  return w;
}

const lambs = (w, owner) => RTS.world.list(w, e => e.kind === 'animal' && e.type === 'lamb' && e.owner === owner);
const steps = seconds => Math.ceil(seconds / RTS.data.TICK);

// 在圈中央放幾隻己方白羊
function sheepIn(w, pen, n, owner = 0) {
  const c = RTS.world.center(pen);
  return Array.from({ length: n }, () => {
    const s = RTS.world.addAnimal(w, 'sheep', c.x, c.y);
    s.owner = owner;
    return s;
  });
}

test('牲畜圈：圈內有兩隻白羊才計時，時間到生出己方小黑羊', () => {
  const w = field();
  const cfg = RTS.data.buildings.pen.pen;
  const pen = RTS.world.addBuilding(w, 'pen', 0, 10, 10, true);
  runUntil(w, () => false, steps(cfg.interval) + 20);
  assert.strictEqual(lambs(w, 0).length, 0, '空圈不生');
  sheepIn(w, pen, 1);
  runUntil(w, () => false, steps(cfg.interval) + 20);
  assert.strictEqual(lambs(w, 0).length, 0, '只有一隻不生');
  assert.strictEqual(pen.breed || 0, 0, '不到兩隻不計時');
  sheepIn(w, pen, 1);
  runUntil(w, () => false, steps(cfg.interval) - 5);
  assert.strictEqual(lambs(w, 0).length, 0, '還沒到時間');
  assert.ok(runUntil(w, () => lambs(w, 0).length === 1, 20));
  const lamb = lambs(w, 0)[0];
  assert.ok(RTS.pen.within(pen, lamb), '生在圈裡');
  assert.ok(RTS.map.isWalkable(w.map, 11, 11), '圈內可行走');
  assert.strictEqual(RTS.construction.canPlace(w, 0, 'house', 10, 10).reason, 'blocked');
});

test('牲畜圈：圈外的羊、小羊、別人的羊都不算種羊；工地不會生', () => {
  const w = field();
  const cfg = RTS.data.buildings.pen.pen;
  const pen = RTS.world.addBuilding(w, 'pen', 0, 10, 10, true);
  const outside = RTS.world.addAnimal(w, 'sheep', 9.5, 9.5);
  outside.owner = 0;
  const lamb = RTS.world.addAnimal(w, 'lamb', 11.5, 11.5);
  lamb.owner = 0;
  sheepIn(w, pen, 1, 1).concat(sheepIn(w, pen, 1));
  assert.strictEqual(RTS.pen.adults(w, pen), 1);
  const site = RTS.world.addBuilding(w, 'pen', 0, 20, 10, false);
  sheepIn(w, site, 2);
  runUntil(w, () => false, steps(cfg.interval) + 20);
  assert.strictEqual(lambs(w, 0).length, 1, '只有原本那隻小羊');
});

test('牲畜圈：圈內羊達上限就暫停，空出位置後立刻補', () => {
  const w = field();
  const cfg = RTS.data.buildings.pen.pen;
  const pen = RTS.world.addBuilding(w, 'pen', 0, 10, 10, true);
  const flock = sheepIn(w, pen, cfg.cap);
  runUntil(w, () => false, steps(cfg.interval) + 40);
  assert.strictEqual(lambs(w, 0).length, 0, '滿了不生');
  assert.ok(flock.every(s => RTS.pen.within(pen, s)), '閒逛不會走出圈');
  RTS.world.remove(w, flock[0]);
  runUntil(w, () => false, 2);
  assert.strictEqual(lambs(w, 0).length, 1);
});

test('牲畜圈：選羊右鍵點圈子，羊走進圈裡並留在裡面', () => {
  const w = field();
  const pen = RTS.world.addBuilding(w, 'pen', 0, 10, 10, true);
  const herd = [RTS.world.addAnimal(w, 'sheep', 16.5, 16.5), RTS.world.addAnimal(w, 'sheep', 17.5, 16.5)];
  herd.forEach(s => { s.owner = 0; });
  const r = RTS.commands.issue(w, 0, { type: 'smart', unitIds: herd.map(s => s.id), targetId: pen.id, x: 10.2, y: 10.2 });
  assert.ok(r.ok);
  assert.ok(runUntil(w, () => herd.every(s => RTS.pen.within(pen, s)), 1200));
  runUntil(w, () => false, 1200);
  assert.ok(herd.every(s => RTS.pen.within(pen, s)), '待一陣子仍在圈裡');
});

test('牲畜圈：羊進去就出不來，移動只在圈內；敵人搶不走；拆掉圈後恢復自由', () => {
  const w = field();
  const pen = RTS.world.addBuilding(w, 'pen', 0, 10, 10, true);
  const herd = sheepIn(w, pen, 2);
  runUntil(w, () => false, 2);
  assert.ok(herd.every(s => RTS.pen.penOf(w, s) === pen));
  RTS.commands.issue(w, 0, { type: 'move', unitIds: herd.map(s => s.id), x: 20.5, y: 20.5 });
  runUntil(w, () => false, 600);
  assert.ok(herd.every(s => RTS.pen.within(pen, s)), '帶不出圈');
  const thief = unit(w, 'villager', 1, 12, 13);
  runUntil(w, () => false, 100);
  assert.ok(herd.every(s => s.owner === 0), '敵方村民搶不走');
  RTS.world.remove(w, thief);
  const lamb = runUntil(w, () => lambs(w, 0).length > 0, steps(60)) && lambs(w, 0)[0];
  assert.ok(lamb && RTS.pen.penOf(w, lamb) === pen, '新生小羊也在圈裡');
  RTS.commands.issue(w, 0, { type: 'demolish', buildingId: pen.id });
  RTS.commands.issue(w, 0, { type: 'move', unitIds: [herd[0].id], x: 20.5, y: 20.5 });
  assert.ok(runUntil(w, () => RTS.util.dist(herd[0].x, herd[0].y, 20.5, 20.5) < 1.5, 1200), '拆圈後可以帶走');
});

test('小黑羊：時間到長成白羊，保留主人', () => {
  const w = field();
  const lamb = RTS.world.addAnimal(w, 'lamb', 12.5, 12.5);
  lamb.owner = 0;
  lamb.age = 0;
  runUntil(w, () => false, steps(RTS.data.animals.lamb.grows.time) - 5);
  assert.strictEqual(lamb.type, 'lamb');
  assert.ok(runUntil(w, () => lamb.type === 'sheep', 20));
  assert.strictEqual(lamb.owner, 0);
  assert.strictEqual(lamb.hp, RTS.data.animals.sheep.hp);
});

test('小黑羊：村民不能宰，右鍵只會走過去；敵方士兵殺掉也沒有肉', () => {
  const w = field();
  const lamb = RTS.world.addAnimal(w, 'lamb', 12.5, 12.5);
  lamb.owner = 0;
  const v = unit(w, 'villager', 0, 12, 11);     // 主人在旁邊，敵人搶不走
  assert.strictEqual(RTS.commands.issue(w, 0, { type: 'hunt', unitIds: [v.id], targetId: lamb.id }).reason, 'tooYoung');
  const r = RTS.commands.issue(w, 0, { type: 'smart', unitIds: [v.id], targetId: lamb.id, x: 12.5, y: 12.5 });
  assert.ok(r.ok && r.action === 'move');
  const sword = unit(w, 'swordsman', 1, 13, 13);
  assert.ok(RTS.commands.issue(w, 1, { type: 'smart', unitIds: [sword.id], targetId: lamb.id, x: 12.5, y: 12.5 }).ok);
  assert.ok(runUntil(w, () => !RTS.world.get(w, lamb.id), 400));
  assert.strictEqual(RTS.world.list(w, e => e.type === 'carcass').length, 0);
});

test('拆除：退回造價的 75%，受損時依剩餘生命再打折；佇列全額退', () => {
  const w = field();
  const res = w.players[0].res;
  const house = RTS.world.addBuilding(w, 'house', 0, 10, 10, true);
  let wood = res.wood;
  assert.ok(RTS.commands.issue(w, 0, { type: 'demolish', buildingId: house.id }).ok);
  assert.strictEqual(res.wood, wood + Math.floor(50 * 0.75));
  assert.ok(!RTS.world.get(w, house.id) && RTS.map.isWalkable(w.map, 10, 10));
  const barracks = RTS.world.addBuilding(w, 'barracks', 0, 14, 14, true);
  barracks.hp = barracks.maxHp / 2;
  RTS.commands.issue(w, 0, { type: 'train', buildingId: barracks.id, unit: 'swordsman' });
  wood = res.wood;
  const food = res.food;
  RTS.commands.issue(w, 0, { type: 'demolish', buildingId: barracks.id });
  assert.strictEqual(res.wood, wood + Math.floor(150 * 0.75 * 0.5));
  assert.strictEqual(res.food, food + RTS.data.units.swordsman.cost.food, '訓練中的單位全額退');
});

test('拆除：主堡、農田、工地與別人的建築不能拆；牲畜圈拆掉後地面可再蓋', () => {
  const w = field();
  const tc = RTS.world.buildingsOf(w, 0, 'townCenter')[0];
  const farm = RTS.world.addBuilding(w, 'farm', 0, 10, 10, true);
  const site = RTS.world.addBuilding(w, 'house', 0, 20, 10, false);
  const demolish = (id, pid = 0) => RTS.commands.issue(w, pid, { type: 'demolish', buildingId: id });
  assert.strictEqual(demolish(tc.id).reason, 'cannotDemolish');
  assert.strictEqual(demolish(farm.id).reason, 'cannotDemolish');
  assert.strictEqual(demolish(site.id).reason, 'cannotDemolish');
  const pen = RTS.world.addBuilding(w, 'pen', 0, 14, 14, true);
  assert.strictEqual(demolish(pen.id, 1).reason, 'buildingNotFound');
  assert.ok(demolish(pen.id).ok);
  assert.ok(RTS.construction.canPlace(w, 0, 'house', 14, 14).ok);
});


test('宰完一隻自己的羊、肉採完後，村民接著宰附近下一隻（小羊不宰）', () => {
  const w = field();
  w.players[0].res.food = 0;
  const pen = RTS.world.addBuilding(w, 'pen', 0, 10, 10, true);
  RTS.world.addBuilding(w, 'mill', 0, 14, 10, true);
  const herd = sheepIn(w, pen, 2);
  const lamb = RTS.world.addAnimal(w, 'lamb', 11.5, 11.5);
  lamb.owner = 0;
  lamb.age = -1e9;                       // 測試期間不會長大
  const v = unit(w, 'villager', 0, 13, 13);
  RTS.commands.issue(w, 0, { type: 'smart', unitIds: [v.id], targetId: herd[0].id, x: 11.5, y: 11.5 });
  assert.ok(runUntil(w, () => herd.every(s => !RTS.world.get(w, s.id)), 8000), '兩隻都應被宰');
  assert.ok(RTS.world.get(w, lamb.id), '小羊還在');
  assert.ok(runUntil(w, () => v.order.type === 'idle' || v.order.resource !== 'food', 4000));
  assert.ok(w.players[0].res.food >= 2 * RTS.data.animals.sheep.food - 20, '兩隻的肉都送回來了');
});
