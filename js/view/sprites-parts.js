// 建築圖形的基本零件與轉向：以「占地座標 (u, v) 加高度 z」描點，投影交給 camera.js。
// 圖形一律照朝向 0（正門在左前立面，v 最大）描述，其他朝向在描點時旋轉占地座標：
// 1 正門在右前、2 在右後、3 在左後。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var D = RTS.sprites.draw;

  var dir = 0, size = 0;
  var flipped = false;      // u、v 對調，用來畫屋脊沿另一軸的屋頂

  // 圖形座標 → 實際占地座標
  function point(u, v) {
    if (flipped) return [v, u];
    if (dir === 1) return [v, size - u];
    if (dir === 2) return [size - u, size - v];
    if (dir === 3) return [size - v, u];
    return [u, v];
  }

  // r = [u0, v0, u1, v1]
  function rect(r) {
    var a = point(r[0], r[1]), b = point(r[2], r[3]);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  }

  // 正面（v 大的立面）與側面（u 大的立面）轉向後是否還朝著鏡頭
  function front() { return dir < 2; }
  function side() { return dir === 0 || dir === 3; }

  function withTurn(d, s, fn) {
    var saved = [dir, size, flipped];
    dir = d;
    size = s;
    flipped = false;
    fn();
    dir = saved[0];
    size = saved[1];
    flipped = saved[2];
  }

  // 左右對稱的零件（箱體、屋頂）：把矩形轉到實際位置後照原本方向畫，明暗面才不會跟著轉
  function upright(r, fn) {
    var turned = dir % 2 === 1, w = rect(r);
    withTurn(0, size, function () { fn(w, turned); });
  }

  // 在 u、v 對調的座標系裡畫；r 為實際占地矩形
  function transposed(r, fn) {
    var saved = flipped;
    flipped = true;
    fn([r[1], r[0], r[3], r[2]]);
    flipped = saved;
  }

  // 彼此前後遮擋的部件：每個是 [u, v, 畫法, 深度微調]。轉向後依深度由後往前畫，朝向 0 照列出順序
  function layers(parts) {
    function depth(p) {
      var q = point(p[0], p[1]);
      return q[0] + q[1] + (p[3] || 0);
    }
    var order = dir ? parts.slice().sort(function (a, b) { return depth(a) - depth(b); }) : parts;
    order.forEach(function (p) { p[2](); });
  }

  function at(u, v, z) {
    var q = point(u, v), p = RTS.camera.project(q[0], q[1]);
    return [p.x, p.y - z];
  }

  // 頂點為 [u, v, z] 的多邊形
  function face(ctx, pts, fill, stroke) {
    var flat = [];
    pts.forEach(function (p) { flat.push.apply(flat, at(p[0], p[1], p[2])); });
    D.poly(ctx, flat, fill, stroke);
  }

  function edge(ctx, a, b, color, width) {
    D.line(ctx, at(a[0], a[1], a[2]).concat(at(b[0], b[1], b[2])), color, width);
  }

  // 正面上的矩形：沿 u 從 a 到 b、高度 z0 到 z1；轉到背面時不畫
  function onLeft(ctx, v, a, b, z0, z1, fill) {
    if (front()) face(ctx, [[a, v, z0], [b, v, z0], [b, v, z1], [a, v, z1]], fill);
  }

  function onRight(ctx, u, a, b, z0, z1, fill) {
    if (side()) face(ctx, [[u, a, z0], [u, b, z0], [u, b, z1], [u, a, z1]], fill);
  }

  RTS.sprites.parts = {
    at: at, face: face, edge: edge, onLeft: onLeft, onRight: onRight, front: front, side: side,
    rect: rect, withTurn: withTurn, upright: upright, transposed: transposed, layers: layers
  };
})();
