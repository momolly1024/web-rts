// 鏡頭與座標轉換。全專案只有這裡知道「世界座標怎麼對應到螢幕」：
// 世界（格） -> project -> 投影平面 -> 減鏡頭位置、乘縮放 -> 螢幕像素。換視角只改 project/unproject。
// 目前是 2:1 等角視角：一格畫成寬 2、高 1（投影單位）的菱形，面積與正方格相同。
// +x 朝右下、+y 朝左下；x + y 越大越靠近觀看者。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var SCALE = 36;         // 投影平面一單位的像素大小
  var INSET_TOP = 48;     // 被上方資源列蓋住的高度
  var INSET_BOTTOM = 180; // 被下方面板蓋住的高度

  function project(wx, wy) {
    return { x: wx - wy, y: (wx + wy) / 2 };
  }

  function unproject(px, py) {
    return { x: py + px / 2, y: py - px / 2 };
  }

  function create(mapW, mapH) {
    var zoom = RTS.data.zoom;
    return {
      x: 0, y: 0, viewW: 800, viewH: 600, scale: SCALE * zoom.levels[zoom.start], level: zoom.start,
      mapW: mapW, mapH: mapH
    };
  }

  function worldToScreen(cam, wx, wy) {
    var p = project(wx, wy);
    return { x: (p.x - cam.x) * cam.scale, y: (p.y - cam.y) * cam.scale };
  }

  function screenToWorld(cam, sx, sy) {
    return unproject(sx / cam.scale + cam.x, sy / cam.scale + cam.y);
  }

  // 地面矩形的四個螢幕頂點（左上起順時針）
  function quad(cam, x, y, w, h) {
    return [
      worldToScreen(cam, x, y), worldToScreen(cam, x + w, y),
      worldToScreen(cam, x + w, y + h), worldToScreen(cam, x, y + h)
    ];
  }

  // 沒被上下面板蓋住的區域中心
  function focusPoint(cam) {
    return { x: cam.viewW / 2, y: (cam.viewH - INSET_BOTTOM + INSET_TOP) / 2 };
  }

  // 邊界：可視區域中心必須落在地圖上，任何投影下都適用
  function clamp(cam) {
    var f = focusPoint(cam);
    var w = screenToWorld(cam, f.x, f.y);
    var cx = RTS.util.clamp(w.x, 0, cam.mapW), cy = RTS.util.clamp(w.y, 0, cam.mapH);
    if (cx === w.x && cy === w.y) return;
    var p = project(cx, cy);
    cam.x = p.x - f.x / cam.scale;
    cam.y = p.y - f.y / cam.scale;
  }

  function pan(cam, dxPixels, dyPixels) {
    cam.x += dxPixels / cam.scale;
    cam.y += dyPixels / cam.scale;
    clamp(cam);
  }

  function centerOn(cam, wx, wy) {
    var p = project(wx, wy), f = focusPoint(cam);
    cam.x = p.x - f.x / cam.scale;
    cam.y = p.y - f.y / cam.scale;
    clamp(cam);
  }

  // 放大（steps > 0）或縮小幾級，螢幕上 (sx, sy) 指到的地面位置不動
  function zoomAt(cam, steps, sx, sy) {
    var levels = RTS.data.zoom.levels;
    var level = RTS.util.clamp(cam.level + steps, 0, levels.length - 1);
    if (level === cam.level) return;
    var scale = SCALE * levels[level];
    cam.x += sx / cam.scale - sx / scale;
    cam.y += sy / cam.scale - sy / scale;
    cam.level = level;
    cam.scale = scale;
    clamp(cam);
  }

  function resize(cam, w, h) {
    cam.viewW = w;
    cam.viewH = h;
    clamp(cam);
  }

  // 螢幕座標是否在畫面內（四周放寬 marginX、marginY 像素）
  function onScreen(cam, p, marginX, marginY) {
    return p.x >= -marginX && p.x <= cam.viewW + marginX && p.y >= -marginY && p.y <= cam.viewH + marginY;
  }

  // 畫面內可能看得到的格子範圍（世界座標的外接矩形）
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
    project: project, unproject: unproject, create: create,
    worldToScreen: worldToScreen, screenToWorld: screenToWorld, quad: quad, focusPoint: focusPoint,
    pan: pan, centerOn: centerOn, zoomAt: zoomAt, resize: resize, visibleTiles: visibleTiles, onScreen: onScreen
  };
})();
