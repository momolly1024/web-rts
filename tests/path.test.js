'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function wall(world, x, y0, y1) {
  for (let y = y0; y <= y1; y++) RTS.world.addNode(world, 'rock', x, y);
}

test('尋路繞過障礙且不穿牆', () => {
  const w = arena();
  wall(w, 10, 0, 20);
  const res = RTS.path.find(w.map, 5, 5, RTS.move.pointGoal(15, 5));
  assert.ok(res.reached);
  assert.ok(res.path.every(p => RTS.map.isWalkable(w.map, p.x, p.y)));
  assert.ok(res.path.some(p => p.y > 20), '應從牆的下方缺口繞過');
});

test('斜向移動不穿過牆角', () => {
  const w = arena();
  RTS.world.addNode(w, 'rock', 6, 5);
  RTS.world.addNode(w, 'rock', 5, 6);
  const res = RTS.path.find(w.map, 5, 5, RTS.move.pointGoal(6, 6));
  assert.ok(res.path.length > 1);
});

test('單位實際走到牆的另一側', () => {
  const w = arena();
  wall(w, 10, 0, 20);
  const u = unit(w, 'villager', 0, 5, 5);
  RTS.commands.issue(w, 0, { type: 'move', unitIds: [u.id], x: 15, y: 5 });
  RTS.world.addBuilding(w, 'townCenter', 0, 0, 20, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 20, 0, true);
  const ok = runUntil(w, () => u.order.type === 'idle', 2000, () => {
    assert.ok(RTS.map.isWalkable(w.map, Math.floor(u.x), Math.floor(u.y)), '單位不可踩進障礙');
  });
  assert.ok(ok);
  assert.deepStrictEqual([Math.floor(u.x), Math.floor(u.y)], [15, 5]);
});

test('不可達目標：回傳最接近的路徑，單位停下不卡死', () => {
  const w = arena();
  wall(w, 12, 0, 23);
  const res = RTS.path.find(w.map, 3, 3, RTS.move.pointGoal(20, 3));
  assert.strictEqual(res.reached, false);
  assert.strictEqual(res.path[res.path.length - 1].x, 11);

  RTS.world.addBuilding(w, 'townCenter', 0, 0, 20, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 20, 0, true);
  const u = unit(w, 'villager', 0, 3, 3);
  RTS.commands.issue(w, 0, { type: 'move', unitIds: [u.id], x: 20, y: 3 });
  assert.ok(runUntil(w, () => u.order.type === 'idle', 1000));
  assert.strictEqual(Math.floor(u.x), 11);
});

test('大量單位前往不可達目標仍在合理時間內結束', () => {
  const w = RTS.world.create({ width: 64, height: 64 });
  wall(w, 40, 0, 63);
  RTS.world.addBuilding(w, 'townCenter', 0, 0, 0, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 60, 60, true);
  const ids = [];
  for (let i = 0; i < 50; i++) ids.push(unit(w, 'swordsman', 0, 5 + i % 10, 10 + Math.floor(i / 10)).id);
  RTS.commands.issue(w, 0, { type: 'move', unitIds: ids, x: 55, y: 30 });
  const started = Date.now();
  assert.ok(runUntil(w, () => ids.every(id => RTS.world.get(w, id).order.type === 'idle'), 1500));
  assert.ok(Date.now() - started < 15000);
  assert.ok(ids.every(id => RTS.world.get(w, id).x > 30), '應走到牆邊附近才停下');
});

test('多單位移動分散站位、不全部疊在一起', () => {
  const w = arena();
  RTS.world.addBuilding(w, 'townCenter', 0, 0, 20, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 20, 0, true);
  const ids = [];
  for (let i = 0; i < 9; i++) ids.push(unit(w, 'swordsman', 0, 2 + i, 2).id);
  RTS.commands.issue(w, 0, { type: 'move', unitIds: ids, x: 12, y: 12 });
  assert.ok(runUntil(w, () => ids.every(id => RTS.world.get(w, id).order.type === 'idle'), 1500));
  const tiles = new Set(ids.map(id => {
    const u = RTS.world.get(w, id);
    return Math.floor(u.x) + ',' + Math.floor(u.y);
  }));
  assert.strictEqual(tiles.size, 9);
});

test('目標是被佔住的格子時改走到旁邊', () => {
  const w = arena();
  RTS.world.addBuilding(w, 'townCenter', 0, 0, 20, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 10, 10, true);
  const u = unit(w, 'villager', 0, 2, 2);
  RTS.commands.issue(w, 0, { type: 'move', unitIds: [u.id], x: 11, y: 11 });
  assert.ok(runUntil(w, () => u.order.type === 'idle', 1000));
  assert.ok(RTS.world.distTo(u.x, u.y, { kind: 'building', x: 10, y: 10, w: 3, h: 3 }) < 1);
});

test('隨機地圖雙方公平（點對稱）且可遊玩', () => {
  for (const seed of [1, 2, 3, 42, 999, 123456]) {
    const w = RTS.game.create(seed);
    const { width: W, height: H } = w.map;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = y * W + x, b = (H - 1 - y) * W + (W - 1 - x);
        assert.strictEqual(w.map.terrain[a], w.map.terrain[b]);
        const ea = RTS.world.get(w, w.map.occupant[a]), eb = RTS.world.get(w, w.map.occupant[b]);
        assert.strictEqual(ea && ea.type, eb && eb.type);
      }
    }
    assert.strictEqual(RTS.world.unitsOf(w, 0).length, RTS.data.START_VILLAGERS);
    assert.strictEqual(RTS.world.unitsOf(w, 1).length, RTS.data.START_VILLAGERS);
    for (const type of ['tree', 'berry', 'gold']) {
      assert.ok(RTS.world.list(w, e => e.type === type).length > 0, type + ' 存在');
    }
  }
});
