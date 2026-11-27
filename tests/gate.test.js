'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function field(size = 30) {
  const w = arena(size, { food: 3000, wood: 3000, gold: 3000, stone: 3000 });
  w.players.forEach(p => { p.upgrades.age = 2; });
  return w;
}
const wall = (w, owner, x, y) => RTS.world.addBuilding(w, 'wall', owner, x, y, true);
const build = (w, v, tx, ty, dir) =>
  RTS.commands.issue(w, 0, { type: 'build', unitIds: [v.id], building: 'gate', tx, ty, dir });

test('城門占地：4 格長、1 格厚，依朝向沿 x 或 y', () => {
  assert.deepStrictEqual(RTS.world.footprint('gate', 0), { w: 4, h: 1 });
  assert.deepStrictEqual(RTS.world.footprint('gate', 1), { w: 1, h: 4 });
  assert.deepStrictEqual(RTS.world.footprint('gate', 2), { w: 4, h: 1 });
  assert.deepStrictEqual(RTS.world.footprint('house', 1), { w: 2, h: 2 });
});

test('城門：城牆與空地可混合，占地內的牆全部取代、不退款，占地外的牆保留', () => {
  const w = field();
  const v = unit(w, 'villager', 0, 8, 8);
  const inside = [wall(w, 0, 10, 10), wall(w, 0, 12, 10)];
  const outside = wall(w, 0, 14, 10);
  const stone = w.players[0].res.stone;
  const r = build(w, v, 10, 10, 0);
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(w.players[0].res.stone, stone - RTS.data.buildings.gate.cost.stone);
  inside.forEach(b => assert.ok(!RTS.world.get(w, b.id)));
  assert.ok(RTS.world.get(w, outside.id));
  const gate = RTS.world.get(w, r.buildingId);
  assert.deepStrictEqual([gate.w, gate.h], [4, 1]);
  for (let x = 10; x < 14; x++) assert.strictEqual(RTS.map.floorAt(w.map, x, 10), gate.id, 'x ' + x);
});

test('城門：占地任一格被擋住（別人的牆、建築、地圖外）就不能放', () => {
  const w = field();
  wall(w, 1, 13, 10);
  assert.strictEqual(RTS.construction.canPlace(w, 0, 'gate', 10, 10, 0).reason, 'blocked');
  assert.ok(RTS.construction.canPlace(w, 0, 'gate', 10, 10, 1).ok, '直向避開那格');
  assert.strictEqual(RTS.construction.canPlace(w, 0, 'gate', 27, 5, 0).reason, 'outOfMap');
  RTS.world.addBuilding(w, 'gate', 0, 4, 20, true);
  assert.strictEqual(RTS.construction.canPlace(w, 0, 'gate', 7, 20, 0).reason, 'blocked', '不能疊在城門上');
});

test('城門：整段只讓自己人通過；拆毀後四格都解除', () => {
  const w = field(24);
  RTS.world.addBuilding(w, 'townCenter', 0, 0, 0, true);    // 沒有主堡會立刻分出勝負
  RTS.world.addBuilding(w, 'townCenter', 1, 21, 21, true);
  for (let y = 0; y < 24; y++) if (y < 10 || y > 13) wall(w, 0, 12, y);
  const gate = RTS.world.addBuilding(w, 'gate', 0, 12, 10, true, 1);
  for (let y = 10; y <= 13; y++) {
    assert.ok(RTS.map.passable(w.map, 12, y, 0), '自己人 y ' + y);
    assert.ok(!RTS.map.passable(w.map, 12, y, 1), '敵人 y ' + y);
  }
  const mine = unit(w, 'villager', 0, 6, 13);
  RTS.commands.issue(w, 0, { type: 'move', unitIds: [mine.id], x: 18.5, y: 13.5 });
  assert.ok(runUntil(w, () => mine.x > 13, 1500), '自己人應穿過城門');
  RTS.world.remove(w, gate);
  for (let y = 10; y <= 13; y++) {
    assert.ok(RTS.map.passable(w.map, 12, y, 1));
    assert.strictEqual(RTS.map.floorAt(w.map, 12, y), 0);
  }
});

test('城門方向：缺口兩側隔幾格的牆也能對齊', () => {
  const w = field();
  wall(w, 0, 10, 7);
  wall(w, 0, 10, 12);
  assert.strictEqual(RTS.construction.gateAxis(w, 10, 10, 0), 'y');
});

test('城門放置：游標在牆上時順著牆置中，空地照 Q 的方向', () => {
  const w = field();
  for (let y = 6; y <= 14; y++) wall(w, 0, 10, y);
  const at = (x, y, placeDir) => {
    const cam = RTS.camera.create(w.map.width, w.map.height);
    const mouse = Object.assign({ overCanvas: true }, RTS.camera.worldToScreen(cam, x, y));
    return RTS.input.placementTile({ placement: 'gate', placeDir, world: w, cam, mouse });
  };
  assert.deepStrictEqual(at(10.5, 10.2, 0), { tx: 10, ty: 8, dir: 1 });
  assert.deepStrictEqual(at(20.2, 20.5, 0), { tx: 18, ty: 20, dir: 0 });
  assert.deepStrictEqual(at(20.5, 20.2, 1), { tx: 20, ty: 18, dir: 1 });
});

test('城門繪圖：拆成 4 段各自排序，單位在門後先畫、門前後畫', () => {
  const w = field();
  const gate = RTS.world.addBuilding(w, 'gate', 0, 10, 10, true);
  const parts = RTS.depth.slices(gate);
  assert.deepStrictEqual(parts.map(p => [p.x, p.y, p.w, p.h, p.part.index]),
    [[10, 10, 1, 1, 0], [11, 10, 1, 1, 1], [12, 10, 1, 1, 2], [13, 10, 1, 1, 3]]);
  const behind = unit(w, 'swordsman', 0, 13, 9), ahead = unit(w, 'swordsman', 0, 10, 12);
  const order = RTS.depth.sort(parts.concat([behind, ahead]));
  assert.ok(order.indexOf(behind) < order.indexOf(parts[3]));
  assert.ok(order.indexOf(ahead) > order.indexOf(parts[0]));
  const house = RTS.world.addBuilding(w, 'house', 0, 2, 2, true);
  assert.deepStrictEqual(RTS.depth.slices(house), [house]);
});
