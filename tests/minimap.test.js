'use strict';
const assert = require('assert');
const { RTS } = require('./helpers');

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('小地圖座標可互逆，整張地圖落在畫布內', () => {
  for (const [w, h] of [[220, 120], [150, 90], [110, 70], [200, 200]]) {
    const geo = RTS.minimap.layout(64, 64, w, h);
    for (const [x, y] of [[0.5, 0.5], [63, 1], [1, 63], [63.5, 63.5], [20.25, 41.5]]) {
      const m = geo.toMini(x, y);
      assert.ok(m.x >= 0 && m.x <= w && m.y >= 0 && m.y <= h, `${w}x${h} ${x},${y}`);
      const back = geo.fromMini(m.x, m.y);
      assert.ok(near(back.x, x) && near(back.y, y));
    }
    const out = geo.fromMini(-50, -50);
    assert.ok(out.x >= 0 && out.y >= 0 && out.x < 64 && out.y < 64, '點到邊框外要夾回地圖');
  }
});

test('點小地圖跳轉後，視野框中心對準該點', () => {
  const cam = RTS.camera.create(64, 64);
  RTS.camera.resize(cam, 1280, 800);
  const geo = RTS.minimap.layout(64, 64, 220, 130);
  const target = geo.toMini(40, 25);
  const world = geo.fromMini(target.x, target.y);
  RTS.camera.centerOn(cam, world.x, world.y);
  const f = RTS.camera.focusPoint(cam);
  const seen = RTS.camera.screenToWorld(cam, f.x, f.y);
  assert.ok(near(seen.x, 40) && near(seen.y, 25));
  const frame = RTS.minimap.viewFrame(geo, cam);
  assert.strictEqual(frame.length, 4);
  const xs = frame.map(p => p.x), ys = frame.map(p => p.y);
  assert.ok(target.x > Math.min(...xs) && target.x < Math.max(...xs));
  assert.ok(target.y > Math.min(...ys) && target.y < Math.max(...ys));
});

test('鏡頭邊界：可視區中心永遠留在地圖上', () => {
  const cam = RTS.camera.create(64, 64);
  for (const [vw, vh] of [[1920, 960], [800, 600], [390, 700]]) {
    RTS.camera.resize(cam, vw, vh);
    for (const [dx, dy] of [[-1e6, 0], [1e6, 0], [0, -1e6], [0, 1e6], [-1e6, -1e6], [1e6, 1e6]]) {
      RTS.camera.pan(cam, dx, dy);
      const f = RTS.camera.focusPoint(cam), w = RTS.camera.screenToWorld(cam, f.x, f.y);
      assert.ok(w.x >= -1e-6 && w.x <= 64 + 1e-6 && w.y >= -1e-6 && w.y <= 64 + 1e-6);
    }
  }
});
