'use strict';
const assert = require('assert');
const { RTS, arena, unit } = require('./helpers');

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const camera = (x = 12, y = 12, w = 1280, h = 800) => {
  const cam = RTS.camera.create(24, 24);
  RTS.camera.resize(cam, w, h);
  RTS.camera.centerOn(cam, x, y);
  return cam;
};
const screen = (cam, x, y, lift = 0) => {
  const p = RTS.camera.worldToScreen(cam, x, y);
  return { x: p.x, y: p.y - lift * cam.scale };
};
const pick = (cam, w, p) => RTS.depth.pick(cam, w, 0, p.x, p.y);

test('等角投影：一格是寬高 2:1 的菱形，座標雙向互逆', () => {
  const cam = camera();
  const [top, right, bottom, left] = RTS.camera.quad(cam, 10, 10, 1, 1);
  assert.ok(near(top.x, bottom.x) && near(left.y, right.y));
  assert.ok(near(right.x - left.x, 2 * (bottom.y - top.y)));
  for (let x = 0; x <= 24; x += 3.7) {
    for (let y = 0; y <= 24; y += 4.3) {
      const p = RTS.camera.project(x, y), w = RTS.camera.unproject(p.x, p.y);
      assert.ok(near(w.x, x) && near(w.y, y));
      const s = screen(cam, x, y), back = RTS.camera.screenToWorld(cam, s.x, s.y);
      assert.ok(near(back.x, x) && near(back.y, y));
    }
  }
});

test('等角鏡頭：四個角落都能到達，推出邊界後停在地圖上', () => {
  const cam = camera();
  const focus = () => {
    const f = RTS.camera.focusPoint(cam);
    return RTS.camera.screenToWorld(cam, f.x, f.y);
  };
  for (const [cx, cy] of [[0, 0], [24, 0], [0, 24], [24, 24]]) {
    RTS.camera.centerOn(cam, cx, cy);
    assert.ok(near(focus().x, cx) && near(focus().y, cy));
    RTS.camera.centerOn(cam, cx * 3 - 24, cy * 3 - 24);
    assert.ok(near(focus().x, cx) && near(focus().y, cy));
  }
  // 沿著菱形斜邊推：仍在地圖上，而且可以滑動
  RTS.camera.centerOn(cam, 6, 0);
  RTS.camera.pan(cam, 72, 0);
  assert.ok(near(focus().y, 0) && focus().x > 6);
});

test('可見格範圍涵蓋畫面內所有地面', () => {
  const cam = camera(7, 15);
  const v = RTS.camera.visibleTiles(cam);
  for (let sx = 0; sx <= 1280; sx += 160) {
    for (let sy = 0; sy <= 800; sy += 100) {
      const w = RTS.camera.screenToWorld(cam, sx, sy);
      if (w.x < 0 || w.y < 0 || w.x >= 24 || w.y >= 24) continue;
      assert.ok(w.x >= v.x0 && w.x < v.x1 + 1 && w.y >= v.y0 && w.y < v.y1 + 1);
    }
  }
});

test('前後遮擋：建築四邊的單位排序正確', () => {
  const w = arena();
  const building = RTS.world.addBuilding(w, 'barracks', 0, 10, 10, true);
  const front = [unit(w, 'villager', 0, 13, 10), unit(w, 'villager', 0, 10, 13)];
  const back = [unit(w, 'villager', 0, 9, 12), unit(w, 'villager', 0, 12, 9)];
  const order = RTS.depth.sort([building, ...front, ...back]).map(e => e.id);
  const at = e => order.indexOf(e.id);
  back.forEach(u => assert.ok(at(u) < at(building)));
  front.forEach(u => assert.ok(at(u) > at(building)));
});

test('點選：單位、地面、牆面與樹冠都能命中，前方物件優先', () => {
  const w = arena();
  const cam = camera();
  const u = unit(w, 'villager', 0, 5, 12);
  assert.strictEqual(pick(cam, w, screen(cam, u.x, u.y, 0.15)), u);
  const b = RTS.world.addBuilding(w, 'house', 0, 12, 12, true);
  assert.strictEqual(pick(cam, w, screen(cam, 13, 13)), b);
  assert.strictEqual(pick(cam, w, screen(cam, 13.5, 14, 0.7)), b, '左前牆面');
  assert.strictEqual(pick(cam, w, screen(cam, 14, 13.5, 0.7)), b, '右前牆面');
  assert.strictEqual(pick(cam, w, screen(cam, 15.5, 15.5)), null);
  const tree = RTS.world.addNode(w, 'tree', 8, 8);
  assert.strictEqual(pick(cam, w, screen(cam, 8.5, 8.5, 0.8)), tree, '樹冠');
  const behind = RTS.world.addNode(w, 'tree', 7, 7);
  assert.strictEqual(pick(cam, w, screen(cam, 8.5, 8.5, 0.8)), tree, '重疊時選前面那棵');
  assert.strictEqual(pick(cam, w, screen(cam, 7.5, 7.5, 0.8)), behind);
});

test('框選：用螢幕矩形，只收框內的己方單位', () => {
  const w = arena();
  const cam = camera();
  // a、b 在螢幕上左右並排；low 在畫面下方
  const a = unit(w, 'villager', 0, 10, 14);
  const b = unit(w, 'villager', 0, 14, 10);
  const low = unit(w, 'villager', 0, 15, 15);
  const enemy = unit(w, 'villager', 1, 12, 12);
  const pa = RTS.depth.unitAnchor(cam, a), pb = RTS.depth.unitAnchor(cam, b);
  const ids = RTS.depth.ownInRect(cam, w, 0,
    { x0: pa.x - 5, y0: pa.y - 5, x1: pb.x + 5, y1: pb.y + 5 }).map(e => e.id);
  assert.deepStrictEqual(ids.sort(), [a.id, b.id].sort());
  assert.ok(!ids.includes(low.id) && !ids.includes(enemy.id));
});

test('小地圖是菱形，視野框在小地圖上是矩形', () => {
  const geo = RTS.minimap.layout(24, 24, 220, 130);
  assert.ok(near(geo.toMini(0, 0).x, geo.toMini(24, 24).x));
  assert.ok(near(geo.toMini(24, 0).y, geo.toMini(0, 24).y));
  const [a, b, c, d] = RTS.minimap.viewFrame(geo, camera());
  assert.ok(near(a.y, b.y) && near(b.x, c.x) && near(c.y, d.y) && near(d.x, a.x));
});
