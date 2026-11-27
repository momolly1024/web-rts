// 建築四向轉向：放置時的朝向、正門出口、城門方向、迷霧記憶、放置時按 Q
'use strict';
const assert = require('assert');
const { RTS, arena, unit } = require('./helpers');

function setup() {
  const w = arena(24, { food: 1000, wood: 1000, gold: 1000, stone: 1000 });
  return { w, v: unit(w, 'villager', 0, 4, 4) };
}

function build(w, v, dir) {
  const r = RTS.commands.issue(w, 0, { type: 'build', unitIds: [v.id], building: 'barracks', tx: 10, ty: 10, dir });
  assert.ok(r.ok, r.reason);
  return RTS.world.get(w, r.buildingId);
}

test('轉向：放置時指定朝向；沒給是 0，超出範圍取餘數', () => {
  for (const [given, expected] of [[undefined, 0], [1, 1], [3, 3], [5, 1], [-1, 3]]) {
    const { w, v } = setup();
    assert.strictEqual(build(w, v, given).dir, expected, String(given));
  }
});

test('轉向：單位從正門那一側出來', () => {
  // 占地 10..12 的三格建築，四個朝向的正門外中央格
  [[11, 13], [13, 11], [11, 9], [9, 11]].forEach(([x, y], dir) => {
    const w = arena(24);
    const b = RTS.world.addBuilding(w, 'barracks', 0, 10, 10, true);
    b.dir = dir;
    assert.deepStrictEqual(RTS.production.spawnTile(w, b), { x, y }, 'dir ' + dir);
  });
});

test('轉向：正門前被擋住時改找旁邊的空格', () => {
  const w = arena(24);
  const b = RTS.world.addBuilding(w, 'barracks', 0, 10, 10, true);
  for (let x = 9; x <= 13; x++) RTS.world.addBuilding(w, 'wall', 0, x, 13, true);
  const side = RTS.production.spawnTile(w, b);
  assert.strictEqual(side.y, 12, '緊鄰正門的側邊');
  assert.ok(side.x === 9 || side.x === 13);
});

test('轉向：訓練出的單位站在正門側', () => {
  const w = arena(24);
  RTS.world.addBuilding(w, 'house', 0, 2, 2, true);
  const b = RTS.world.addBuilding(w, 'barracks', 0, 10, 10, true);
  b.dir = 2;
  assert.ok(RTS.commands.issue(w, 0, { type: 'train', buildingId: b.id, unit: 'swordsman' }).ok);
  const born = () => [...w.entities.values()].find(e => e.type === 'swordsman');
  for (let i = 0; i < 400 && !born(); i++) RTS.production.update(w, b, RTS.data.TICK);
  assert.ok(born() && born().y < b.y, '正門朝 -y');
});

test('轉向：單獨的城門照放置朝向，旁邊有牆時自動對齊', () => {
  const w = arena(24);
  assert.strictEqual(RTS.construction.gateAxis(w, 5, 5, 1), 'y');
  assert.strictEqual(RTS.construction.gateAxis(w, 5, 5, 2), 'x');
  RTS.world.addBuilding(w, 'wall', 0, 4, 5, true);
  assert.strictEqual(RTS.construction.gateAxis(w, 5, 5, 1), 'x', '左右有牆時不看朝向');
});

test('轉向：迷霧記憶保留敵方建築的朝向', () => {
  const w = arena(40);
  const scout = unit(w, 'villager', 0, 12, 12);
  const b = RTS.world.addBuilding(w, 'barracks', 1, 13, 12, true);
  b.dir = 3;
  RTS.fog.enable(w);
  scout.x = scout.y = 35.5;
  RTS.fog.update(w, 0);
  assert.strictEqual(w.fog[0].memory.get(b.id).dir, 3);
});

test('轉向：放置時按 Q 依序換四個方向；蓋石牆時不作用', () => {
  const listeners = {};
  const saved = { window: globalThis.window, document: globalThis.document, actions: RTS.actions };
  globalThis.window = { addEventListener: (name, fn) => { listeners[name] = fn; } };
  globalThis.document = { addEventListener() {}, documentElement: { addEventListener() {} } };
  RTS.actions = { list: () => [] };
  try {
    const app = { placement: 'house', placeDir: 0, mouse: {}, keys: {}, hud: { overlay: () => null } };
    RTS.input.bind(app, { addEventListener() {} });
    const press = () => listeners.keydown({ code: 'KeyQ', preventDefault() {}, repeat: false });
    assert.deepStrictEqual([1, 2, 3, 4].map(() => { press(); return app.placeDir; }), [1, 2, 3, 0]);
    app.placement = 'wall';
    press();
    assert.strictEqual(app.placeDir, 0);
  } finally {
    Object.assign(globalThis, { window: saved.window, document: saved.document });
    RTS.actions = saved.actions;
  }
});
