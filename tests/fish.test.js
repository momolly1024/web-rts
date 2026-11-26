'use strict';
const assert = require('assert');
const { RTS, arena, unit, runUntil } = require('./helpers');

// 空地上挖一個 3x2 水池（左上角 10,10），主堡在左上
function setup() {
  const w = arena(30, { food: 0, wood: 1000, gold: 1000 });
  for (let y = 10; y < 12; y++) {
    for (let x = 10; x < 13; x++) w.map.terrain[y * 30 + x] = RTS.map.TERRAIN.WATER;
  }
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 2, 2, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 26, 26, true);
  return { w, tc };
}

const issue = (w, units, x, y, type = 'smart') =>
  RTS.commands.issue(w, 0, { type, unitIds: units.map(u => u.id), targetId: null, x, y });

// 讓下一次抽到指定收穫
function rig(w, id) {
  const catches = RTS.data.fishing.catches;
  const total = catches.reduce((n, c) => n + c.weight, 0);
  const before = catches.slice(0, catches.findIndex(c => c.id === id)).reduce((n, c) => n + c.weight, 0);
  w.fishRand = () => (before + 0.01) / total;
}

test('釣魚：村民右鍵水面各自站到岸邊不同格，手上掛釣魚指令', () => {
  const { w } = setup();
  const crew = [unit(w, 'villager', 0, 8, 8), unit(w, 'villager', 0, 8, 9), unit(w, 'villager', 0, 9, 8)];
  assert.strictEqual(issue(w, crew, 11.5, 10.5).action, 'fish');
  const spots = new Set(crew.map(u => u.order.sx + ',' + u.order.sy));
  assert.strictEqual(spots.size, 3);
  crew.forEach(u => {
    const o = u.order;
    assert.strictEqual(o.type, 'fish');
    assert.ok(RTS.fish.isWater(w.map, o.wx, o.wy));
    assert.strictEqual(Math.abs(o.sx - o.wx) + Math.abs(o.sy - o.wy), 1, '站在水邊');
    assert.ok(RTS.map.isWalkable(w.map, o.sx, o.sy));
  });
  assert.ok(runUntil(w, () => crew.every(u => u.order.casting), 800), '走到後開始拋竿');
});

test('釣魚：等待時間隨機、上鉤後手上多食物，滿載送回主堡再回來釣', () => {
  const { w } = setup();
  const v = unit(w, 'villager', 0, 9, 9);
  issue(w, [v], 10.5, 10.5);
  rig(w, 'big');
  assert.ok(runUntil(w, () => v.order.casting && v.order.timer > 0, 400));
  const [min, max] = RTS.data.fishing.wait;
  assert.ok(v.order.timer >= min - 0.1 && v.order.timer <= max);
  assert.ok(runUntil(w, () => v.carry.amount > 0, 1200));
  assert.strictEqual(v.carry.resource, 'food');
  assert.strictEqual(v.carry.amount, 20, '大魚超過負重也整條帶走');
  assert.ok(w.effects.some(fx => fx.type === 'catch' && fx.fish === 'big' && fx.food === 20));
  assert.ok(runUntil(w, () => w.players[0].res.food === 20, 800), '送回主堡');
  assert.ok(runUntil(w, () => v.order.type === 'fish' && v.order.casting, 800), '回到岸邊繼續');
});

test('釣魚：破靴子沒有食物；收穫依權重抽出四種', () => {
  const { w } = setup();
  const v = unit(w, 'villager', 0, 9, 9);
  issue(w, [v], 10.5, 10.5);
  rig(w, 'boot');
  assert.ok(runUntil(w, () => w.effects.some(fx => fx.type === 'catch'), 1600));
  assert.strictEqual(v.carry.amount, 0);
  delete w.fishRand;
  const seen = {};
  for (let i = 0; i < 2000; i++) {
    const id = RTS.fish.roll(w).id;
    seen[id] = (seen[id] || 0) + 1;
  }
  assert.deepStrictEqual(Object.keys(seen).sort(), ['big', 'boot', 'golden', 'small']);
  assert.ok(seen.small > seen.big && seen.big > seen.golden);
});

test('釣魚：士兵照常移動；沒看過的水面不能釣；沒有村民不能下釣魚指令', () => {
  const { w } = setup();
  const s = unit(w, 'swordsman', 0, 8, 8);
  assert.strictEqual(issue(w, [s], 11.5, 10.5).action, 'move');
  assert.strictEqual(issue(w, [s], 11.5, 10.5, 'fish').reason, 'villagersOnlyGather');
  const v = unit(w, 'villager', 0, 8, 9);
  assert.strictEqual(issue(w, [v], 20.5, 20.5, 'fish').reason, 'cannotFish', '陸地');
  RTS.fog.enable(w);
  w.fog[0].state.fill(RTS.fog.UNEXPLORED);
  assert.strictEqual(issue(w, [v], 11.5, 10.5, 'fish').reason, 'cannotFish', '黑霧');
});

test('釣魚：被派去蓋房子後回來繼續釣；集結點設在水池，新村民直接去釣', () => {
  const { w, tc } = setup();
  const v = unit(w, 'villager', 0, 9, 9);
  issue(w, [v], 10.5, 10.5);
  assert.ok(runUntil(w, () => v.order.casting, 400));
  assert.ok(RTS.commands.issue(w, 0, { type: 'build', unitIds: [v.id], building: 'house', tx: 6, ty: 14 }).ok);
  assert.ok(runUntil(w, () => v.order.type === 'fish' && v.order.casting, 1600));
  RTS.commands.issue(w, 0, { type: 'setRally', buildingId: tc.id, x: 11.5, y: 11.5, targetId: null });
  assert.strictEqual(RTS.rally.targetKey(w, tc), 'rally.water');
  const fresh = unit(w, 'villager', 0, 5, 5);
  RTS.rally.apply(w, tc, fresh);
  assert.strictEqual(fresh.order.type, 'fish');
});

test('釣魚：選村民時游標在水面顯示釣魚，士兵不顯示', () => {
  const { w } = setup();
  const v = unit(w, 'villager', 0, 8, 8), s = unit(w, 'swordsman', 0, 8, 9);
  const app = { world: w, human: 0, selection: [v.id], placement: null, mode: null };
  assert.strictEqual(RTS.cursor.actionFor(app, null, { x: 11.5, y: 10.5 }), 'fish');
  assert.strictEqual(RTS.cursor.actionFor(app, null, { x: 20.5, y: 20.5 }), null);
  app.selection = [s.id];
  assert.strictEqual(RTS.cursor.actionFor(app, null, { x: 11.5, y: 10.5 }), null);
});

test('釣魚：每張地圖雙方家旁都有一個對稱的水池，村民走得到', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const w = RTS.game.create(seed);
    const { map } = w;
    let near = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const water = RTS.fish.isWater(map, x, y);
        assert.strictEqual(water, RTS.fish.isWater(map, map.width - 1 - x, map.height - 1 - y), '對稱 ' + seed);
        if (water && Math.hypot(x - 9, y - 9) < 13) near++;
      }
    }
    assert.ok(near >= 6, '家旁水池 seed ' + seed);
  }
});
