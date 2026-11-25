'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function field() {
  const w = arena(32);
  const mine = RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
  const theirs = RTS.world.addBuilding(w, 'townCenter', 1, 27, 27, true);
  return { w, mine, theirs };
}

test('相剋倍率與護甲', () => {
  const d = (a, b) => RTS.combat.damageOf(a, RTS.data.units[b] || RTS.data.buildings[b]);
  assert.ok(d('swordsman', 'archer') > d('swordsman', 'swordsman'));
  assert.ok(d('archer', 'swordsman') > d('archer', 'archer') - 1);
  assert.ok(d('swordsman', 'townCenter') > d('archer', 'townCenter'));
  assert.ok(d('villager', 'townCenter') >= 1);
});

test('戰鬥致死並移除單位', () => {
  const { w } = field();
  const a = unit(w, 'swordsman', 0, 10, 10);
  const b = unit(w, 'villager', 1, 14, 10);
  RTS.commands.issue(w, 0, { type: 'attack', unitIds: [a.id], targetId: b.id });
  assert.ok(runUntil(w, () => !RTS.world.get(w, b.id), 1000));
  assert.ok(RTS.world.get(w, a.id));
});

test('弓箭手在射程外靠近、在射程內停下射擊', () => {
  const { w } = field();
  const a = unit(w, 'archer', 0, 5, 10);
  const b = unit(w, 'villager', 1, 15, 10);
  RTS.commands.issue(w, 0, { type: 'attack', unitIds: [a.id], targetId: b.id });
  assert.ok(runUntil(w, () => b.hp < b.maxHp, 500));
  assert.ok(RTS.util.dist(a.x, a.y, b.x, b.y) > 3);
});

test('閒置軍事單位反擊附近敵人，村民不會', () => {
  const { w } = field();
  const guard = unit(w, 'swordsman', 0, 10, 10);
  const worker = unit(w, 'villager', 0, 10, 12);
  const intruder = unit(w, 'villager', 1, 13, 10);
  assert.ok(runUntil(w, () => !RTS.world.get(w, intruder.id), 1000));
  assert.ok(RTS.world.get(w, guard.id));
  assert.strictEqual(worker.order.type, 'idle');
});

test('建築可被摧毀並釋放格子', () => {
  const { w } = field();
  const house = RTS.world.addBuilding(w, 'house', 1, 12, 12, true);
  const ids = [0, 1, 2].map(i => unit(w, 'swordsman', 0, 8, 10 + i).id);
  RTS.commands.issue(w, 0, { type: 'attack', unitIds: ids, targetId: house.id });
  assert.ok(runUntil(w, () => !RTS.world.get(w, house.id), 3000));
  assert.ok(RTS.map.isWalkable(w.map, 12, 12));
});

test('打不到的目標不會讓單位卡住', () => {
  const { w } = field();
  for (let y = 0; y < 32; y++) RTS.world.addNode(w, 'rock', 16, y);
  const a = unit(w, 'swordsman', 0, 10, 10);
  const b = unit(w, 'villager', 1, 22, 10);
  RTS.commands.issue(w, 0, { type: 'attack', unitIds: [a.id], targetId: b.id });
  assert.ok(runUntil(w, () => a.order.type === 'idle', 1000));
});

test('摧毀敵方主堡獲勝，之後模擬停止', () => {
  const { w, theirs } = field();
  theirs.hp = 20;
  const a = unit(w, 'swordsman', 0, 24, 28);
  RTS.commands.issue(w, 0, { type: 'attack', unitIds: [a.id], targetId: theirs.id });
  assert.ok(runUntil(w, () => w.over, 1000));
  assert.strictEqual(w.winner, 0);
  const tick = w.tick;
  RTS.game.step(w);
  assert.strictEqual(w.tick, tick);
  assert.strictEqual(RTS.commands.issue(w, 0, { type: 'stop', unitIds: [a.id] }).ok, false);
});

test('己方主堡被毀則失敗；未完工的主堡不算數', () => {
  const { w, mine } = field();
  RTS.world.addBuilding(w, 'townCenter', 0, 10, 20, false);
  RTS.game.step(w);
  assert.strictEqual(w.over, false);
  RTS.world.remove(w, mine);
  RTS.game.step(w);
  assert.strictEqual(w.over, true);
  assert.strictEqual(w.winner, 1);
});

test('鏡頭座標轉換可互逆且限制在地圖範圍', () => {
  const cam = RTS.camera.create(64, 64);
  RTS.camera.resize(cam, 1280, 720);
  RTS.camera.centerOn(cam, 20, 30);
  const s = RTS.camera.worldToScreen(cam, 22.25, 31.5);
  const back = RTS.camera.screenToWorld(cam, s.x, s.y);
  assert.ok(Math.abs(back.x - 22.25) < 1e-9 && Math.abs(back.y - 31.5) < 1e-9);
  RTS.camera.pan(cam, -99999, -99999);
  const first = { x: cam.x, y: cam.y };
  RTS.camera.pan(cam, -10, -10);
  assert.deepStrictEqual({ x: cam.x, y: cam.y }, first);
});
