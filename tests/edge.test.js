'use strict';
const assert = require('assert');
const { RTS } = require('./helpers');

// 在假的 document 下呼叫滑出視窗的處理
function leave(focused, x, y) {
  const before = globalThis.document;
  globalThis.document = { hasFocus: () => focused };
  try {
    const app = { cam: { viewW: 1000, viewH: 600 }, mouse: { x: 500, y: 300, inside: true } };
    RTS.input.leaveWindow(app, { clientX: x, clientY: y });
    return app.mouse;
  } finally {
    globalThis.document = before;
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

test('邊緣捲動：滑出視窗後繼續捲（不分是否全螢幕）；視窗沒有焦點時停止', () => {
  assert.deepStrictEqual(leave(true, -5, 450), { x: 0, y: 450, inside: true });
  assert.strictEqual(leave(false, -5, 450).inside, false);
});
