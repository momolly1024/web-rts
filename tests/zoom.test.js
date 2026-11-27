'use strict';
const assert = require('assert');
const { RTS } = require('./helpers');

const camera = () => {
  const cam = RTS.camera.create(64, 64);
  RTS.camera.resize(cam, 1280, 800);
  RTS.camera.centerOn(cam, 32, 32);
  return cam;
};

test('縮放：開局是 100%，只能在設定的各級之間', () => {
  const cam = camera(), base = cam.scale, levels = RTS.data.zoom.levels;
  assert.strictEqual(levels[RTS.data.zoom.start], 1);
  RTS.camera.zoomAt(cam, 99, 640, 400);
  assert.strictEqual(cam.scale, base * levels[levels.length - 1]);
  RTS.camera.zoomAt(cam, -99, 640, 400);
  assert.strictEqual(cam.scale, base * levels[0]);
});

test('縮放：可以縮小到 70%、80%、90%，放大到 130%', () => {
  assert.deepStrictEqual(RTS.data.zoom.levels, [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3]);
});

test('縮放：游標指到的地面位置不動', () => {
  const cam = camera(), before = RTS.camera.screenToWorld(cam, 900, 250);
  for (const steps of [1, 1, 1, -1, -1, -1, -1]) {
    RTS.camera.zoomAt(cam, steps, 900, 250);
    const after = RTS.camera.screenToWorld(cam, 900, 250);
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 1e-9);
  }
});

test('滾輪：往上放大、往下縮小；小量累積後才換級；Ctrl 與開著視窗時不縮放', () => {
  let overlay = null;
  const app = { cam: camera(), hud: { overlay: () => overlay } };
  const start = app.cam.level;
  const roll = (deltaY, extra) => RTS.input.wheel(app, Object.assign(
    { deltaY, deltaMode: 0, clientX: 640, clientY: 400, preventDefault() {} }, extra));
  roll(-100);
  assert.strictEqual(app.cam.level, start + 1);
  roll(100);
  assert.strictEqual(app.cam.level, start);
  roll(-20); roll(-20);
  assert.strictEqual(app.cam.level, start, '累積不足');
  roll(-20);
  assert.strictEqual(app.cam.level, start + 1);
  roll(3, { deltaMode: 1 });
  assert.strictEqual(app.cam.level, start, '以行回報');
  roll(-100, { ctrlKey: true });
  overlay = 'pause';
  roll(-100);
  assert.strictEqual(app.cam.level, start);
});
