// 鏡頭與座標轉換。全專案只有這裡知道「世界座標怎麼對應到螢幕」。
// 日後改等角視角：改 worldToScreen / screenToWorld / clamp，再調整繪圖。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var TILE = 36;          // 一格的像素大小
  var INSET_TOP = 48;     // 被上方資源列蓋住的高度
  var INSET_BOTTOM = 180; // 被下方面板蓋住的高度
  var MARGIN = 24;

  function create(mapW, mapH) {
    return { x: 0, y: 0, viewW: 800, viewH: 600, scale: TILE, mapW: mapW, mapH: mapH };
  }

  function worldToScreen(cam, wx, wy) {
    return { x: (wx - cam.x) * cam.scale, y: (wy - cam.y) * cam.scale };
  }

  function screenToWorld(cam, sx, sy) {
    return { x: sx / cam.scale + cam.x, y: sy / cam.scale + cam.y };
  }

  // 地面矩形的四個螢幕頂點（左上起順時針）
  function quad(cam, x, y, w, h) {
    return [
      worldToScreen(cam, x, y), worldToScreen(cam, x + w, y),
      worldToScreen(cam, x + w, y + h), worldToScreen(cam, x, y + h)
    ];
  }

  function clampAxis(v, lo, hi) {
    return lo > hi ? (lo + hi) / 2 : RTS.util.clamp(v, lo, hi);
  }

  function clamp(cam) {
    var s = cam.scale;
    cam.x = clampAxis(cam.x, -MARGIN / s, cam.mapW - (cam.viewW - MARGIN) / s);
    cam.y = clampAxis(cam.y, -(INSET_TOP + MARGIN) / s,
      cam.mapH - (cam.viewH - INSET_BOTTOM - MARGIN) / s);
  }

  function pan(cam, dxPixels, dyPixels) {
    cam.x += dxPixels / cam.scale;
    cam.y += dyPixels / cam.scale;
    clamp(cam);
  }

  function centerOn(cam, wx, wy) {
    cam.x = wx - cam.viewW / 2 / cam.scale;
    cam.y = wy - (cam.viewH - INSET_BOTTOM + INSET_TOP) / 2 / cam.scale;
    clamp(cam);
  }

  function resize(cam, w, h) {
    cam.viewW = w;
    cam.viewH = h;
    clamp(cam);
  }

  // 畫面內可能看得到的格子範圍
  function visibleTiles(cam) {
    var pts = [[0, 0], [cam.viewW, 0], [0, cam.viewH], [cam.viewW, cam.viewH]].map(function (p) {
      return screenToWorld(cam, p[0], p[1]);
    });
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    return {
      x0: Math.max(0, Math.floor(Math.min.apply(null, xs))),
      y0: Math.max(0, Math.floor(Math.min.apply(null, ys))),
      x1: Math.min(cam.mapW - 1, Math.floor(Math.max.apply(null, xs))),
      y1: Math.min(cam.mapH - 1, Math.floor(Math.max.apply(null, ys)))
    };
  }

  RTS.camera = {
    create: create, worldToScreen: worldToScreen, screenToWorld: screenToWorld, quad: quad,
    pan: pan, centerOn: centerOn, resize: resize, visibleTiles: visibleTiles
  };
})();
