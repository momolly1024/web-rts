'use strict';
const assert = require('assert');
const { RTS } = require('./helpers');

// 在假的 window 下呼叫滑出視窗的處理
function leave(fullscreen, x, y) {
  const before = globalThis.window;
  globalThis.window = {
    matchMedia: () => ({ matches: fullscreen }),
    innerWidth: 1000, innerHeight: 600, screen: { width: 1920, height: 1080 }
  };
  try {
    const app = { cam: { viewW: 1000, viewH: 600 }, mouse: { x: 500, y: 300, inside: true } };
    RTS.input.leaveWindow(app, { clientX: x, clientY: y });
    return app.mouse;
  } finally {
    globalThis.window = before;
  }
}

test('邊緣捲動：離開點貼到最近的那一側', () => {
  const edge = (x, y) => RTS.input.edgeAfterLeave(x, y, 1000, 600);
  assert.deepStrictEqual(edge(-40, 450), { x: 0, y: 450 });
  assert.deepStrictEqual(edge(4, 450), { x: 0, y: 450 });
  assert.deepStrictEqual(edge(1030, 100), { x: 999, y: 100 });
  assert.deepStrictEqual(edge(500, -3), { x: 500, y: 0 });
  assert.deepStrictEqual(edge(500, 640), { x: 500, y: 599 });
  assert.deepStrictEqual(edge(-10, -10), { x: 0, y: 0 });
});

test('邊緣捲動：全螢幕滑出視窗後繼續捲，一般視窗則停止', () => {
  assert.deepStrictEqual(leave(true, -5, 450), { x: 0, y: 450, inside: true });
  assert.strictEqual(leave(false, -5, 450).inside, false);
});
