'use strict';
const assert = require('assert');
const { RTS } = require('./helpers');

const SIZE = 64;

// 記錄每次填色的路徑頂點，用來檢查畫在哪裡
function recorder() {
  const fills = [];
  let pts = [];
  const noop = () => {};
  return {
    fills,
    ctx: {
      beginPath() { pts = []; },
      moveTo(x, y) { pts.push({ x, y }); },
      lineTo(x, y) { pts.push({ x, y }); },
      closePath: noop, stroke: noop, save: noop, restore: noop,
      translate: noop, scale: noop, fillRect: noop,
      fill() { fills.push(pts.slice()); }
    }
  };
}

function ring(span, fn) {
  for (let y = -span; y < SIZE + span; y++) {
    for (let x = -span; x < SIZE + span; x++) fn(x, y);
  }
}

test('地圖外景觀：地圖內沒有景觀，地圖外每格都有且結果固定', () => {
  ring(20, (x, y) => {
    const inside = x >= 0 && y >= 0 && x < SIZE && y < SIZE;
    const t = RTS.scenery.tileAt(x, y, SIZE, SIZE);
    if (inside) return assert.strictEqual(t, null);
    assert.ok(t, `${x},${y}`);
    assert.deepStrictEqual(RTS.scenery.tileAt(x, y, SIZE, SIZE), t);
  });
});

test('地圖外景觀：有草地、水與樹，樹不長在水上也不貼著邊界', () => {
  let water = 0, trees = 0, grass = 0;
  ring(20, (x, y) => {
    const t = RTS.scenery.tileAt(x, y, SIZE, SIZE);
    if (!t) return;
    if (t.water) water++; else grass++;
    if (!t.tree) return;
    trees++;
    assert.ok(!t.water);
    const d = RTS.scenery.distanceOut(x, y, SIZE, SIZE);
    const nearSide = x >= SIZE || y >= SIZE;
    assert.ok(d >= (nearSide ? RTS.scenery.NEAR_GAP : 1), `${x},${y} 距離 ${d}`);
  });
  assert.ok(water > 50 && trees > 50 && grass > water, `草 ${grass} 水 ${water} 樹 ${trees}`);
});

test('地圖外景觀：越遠越暗', () => {
  const near = RTS.scenery.tileAt(-1, 10, SIZE, SIZE);
  const far = RTS.scenery.tileAt(-19, 10, SIZE, SIZE);
  assert.strictEqual(near.shade, 0);
  assert.ok(far.shade > near.shade);
});

test('地圖外景觀：前方的樹冠不會蓋到地圖', () => {
  const cam = RTS.camera.create(SIZE, SIZE);
  RTS.camera.resize(cam, 1280, 800);
  RTS.camera.centerOn(cam, SIZE, SIZE);
  const top = 0.74 * 1.16 * RTS.depth.NODE_SCALE * cam.scale;    // 最高的樹
  const half = 0.44 * 1.16 * RTS.depth.NODE_SCALE * cam.scale;
  ring(12, (x, y) => {
    const t = RTS.scenery.tileAt(x, y, SIZE, SIZE);
    if (!t || !t.tree) return;
    const p = RTS.camera.worldToScreen(cam, x + 0.5, y + 0.5);
    for (const [dx, dy] of [[0, -top], [-half, -top * 0.4], [half, -top * 0.4]]) {
      const w = RTS.camera.screenToWorld(cam, p.x + dx, p.y + dy);
      const onMap = w.x >= 0 && w.y >= 0 && w.x < SIZE && w.y < SIZE;
      assert.ok(!onMap, `${x},${y} 的樹冠落在地圖上`);
    }
  });
});

test('地圖外景觀：四個角落繪製時只畫在地圖外', () => {
  const cam = RTS.camera.create(SIZE, SIZE);
  RTS.camera.resize(cam, 1280, 800);
  for (const [cx, cy] of [[0, 0], [SIZE, 0], [0, SIZE], [SIZE, SIZE], [SIZE / 2, SIZE / 2]]) {
    RTS.camera.centerOn(cam, cx, cy);
    const { ctx, fills } = recorder();
    RTS.scenery.draw(ctx, cam);
    if (cx === SIZE / 2) {
      assert.strictEqual(fills.length, 0, '地圖中央看不到邊界外');
      continue;
    }
    assert.ok(fills.length > 100, `${cx},${cy} 只畫了 ${fills.length} 格`);
    fills.filter(f => f.length === 4).forEach(f => {
      const c = { x: (f[0].x + f[2].x) / 2, y: (f[0].y + f[2].y) / 2 };
      const w = RTS.camera.screenToWorld(cam, c.x, c.y);
      assert.ok(w.x < 0 || w.y < 0 || w.x > SIZE || w.y > SIZE, `${cx},${cy}: ${w.x},${w.y}`);
    });
  }
});
