// 全域命名空間與共用小工具。所有檔案都掛在 RTS 底下，瀏覽器與 node 皆可載入。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  RTS.util = {
    // mulberry32：可重現的亂數，地圖生成與測試用
    rng: function (seed) {
      var s = seed >>> 0;
      return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        var t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    clamp: function (v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    },

    dist: function (ax, ay, bx, by) {
      return Math.hypot(ax - bx, ay - by);
    },

    // 點到軸對齊矩形的最短距離（在矩形內為 0）
    distToRect: function (px, py, r) {
      var dx = Math.max(r.x - px, 0, px - (r.x + r.w));
      var dy = Math.max(r.y - py, 0, py - (r.y + r.h));
      return Math.hypot(dx, dy);
    }
  };
})();
