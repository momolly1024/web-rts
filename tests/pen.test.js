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

test('牲畜圈：定時在圈裡長出己方小黑羊，工地不會長', () => {
  const w = field();
  const cfg = RTS.data.buildings.pen.pen;
  const site = RTS.world.addBuilding(w, 'pen', 0, 20, 10, false);
  const pen = RTS.world.addBuilding(w, 'pen', 0, 10, 10, true);
  runUntil(w, () => false, steps(cfg.interval) - 5);
  assert.strictEqual(lambs(w, 0).length, 0, '還沒到時間');
  assert.ok(runUntil(w, () => lambs(w, 0).length === 1, 20));
  const lamb = lambs(w, 0)[0];
  assert.ok(lamb.x >= pen.x && lamb.x <= pen.x + pen.w && lamb.y >= pen.y && lamb.y <= pen.y + pen.h);
  assert.ok(RTS.pen.flock(w, site).length === 0 || site.x - pen.x > cfg.radius);
  assert.ok(RTS.map.isWalkable(w.map, 11, 11), '圈內可行走');
  assert.strictEqual(RTS.construction.canPlace(w, 0, 'house', 10, 10).reason, 'blocked');
});

test('牲畜圈：附近己方羊達上限就暫停，空出位置後立刻補', () => {
  const w = field();
  const cfg = RTS.data.buildings.pen.pen;
  const pen = RTS.world.addBuilding(w, 'pen', 0, 10, 10, true);
  for (let i = 0; i < cfg.cap; i++) {
    const s = RTS.world.addAnimal(w, 'sheep', 11.5, 11.5);
    s.owner = 0;
  }
  runUntil(w, () => false, steps(cfg.interval) + 40);
  assert.strictEqual(lambs(w, 0).length, 0, '滿了不長');
  RTS.world.remove(w, RTS.pen.flock(w, pen)[0]);
  runUntil(w, () => false, 2);
  assert.strictEqual(lambs(w, 0).length, 1);
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

