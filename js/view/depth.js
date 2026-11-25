// 等角畫面的螢幕幾何：圖形高度、前後遮擋順序、點選與框選命中。不碰 DOM。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var NODE_SCALE = 1.25;      // 天然物件放大，填滿寬 2 單位的菱形格
  var UNIT_LIFT = 0.15;       // 單位命中點比位置高一點（畫面單位 = 格）
  var UNIT_REACH = 0.5;
  // 建築牆身高度（點牆面可選取），天然物件外形高度與半寬
  var WALL = {
    townCenter: 1.7, house: 1.0, blacksmith: 1.0, barracks: 1.1,
    lumberCamp: 0.9, miningCamp: 0.9, mill: 1.0, farm: 0.05, market: 1.0, pen: 0.5
  };
  var NODE = { tree: 0.95, berry: 0.4, gold: 0.4, rock: 0.45, carcass: 0.3 };
  var NODE_HALF = 0.42;
  // 建築圖形最高處（屋頂、旗子）高出占地中心的高度，血條畫在它上面
  var TOP = {
    townCenter: 3.4, house: 2.0, blacksmith: 2.0, barracks: 2.5,
    lumberCamp: 1.8, miningCamp: 1.9, mill: 2.6, farm: 0.6, market: 2.0, pen: 1.3
  };

  function topOf(e) {
    return e.complete ? TOP[e.type] || e.h : Math.max(e.h / 2, 1.2);
  }

  // 占地中心的 x + y。單位與建築、正方形占地彼此之間，比中心值即得正確的前後關係
  function key(e) {
    return e.w === undefined ? e.x + e.y : e.x + e.y + (e.w + e.h) / 2;
  }

  // 由遠到近排序（原地排序並回傳）
  function sort(list) {
    return list.sort(function (a, b) { return key(a) - key(b) || a.id - b.id; });
  }

  function center(e) {
    return e.w === undefined ? e : { x: e.x + e.w / 2, y: e.y + e.h / 2 };
  }

  // 圖形是否可能出現在畫面內
  function inView(cam, e) {
    var c = center(e), margin = cam.scale * 5;
    return RTS.camera.onScreen(cam, RTS.camera.worldToScreen(cam, c.x, c.y), margin, margin);
  }

  function unitAnchor(cam, e) {
    var p = RTS.camera.worldToScreen(cam, e.x, e.y);
    return { x: p.x, y: p.y - UNIT_LIFT * cam.scale };
  }

  // 線段 a-b 是否碰到矩形（Liang-Barsky）
  function crosses(a, b, x0, y0, x1, y1) {
    var lo = 0, hi = 1, dx = b.x - a.x, dy = b.y - a.y;
    return [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]].every(function (s) {
      if (s[0] === 0) return s[1] >= 0;
      var t = s[1] / s[0];
      if (s[0] < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
      return lo <= hi;
    });
  }

  // 螢幕點是否落在建築或天然物件上
  function hits(cam, e, sx, sy) {
    var ground = RTS.camera.screenToWorld(cam, sx, sy);
    if (e.kind === 'building') {
      // 占地往上拉出牆高的立體：把游標往下移 0..牆高，看有沒有經過占地
      var wall = (WALL[e.type] || 1) * (e.complete ? 1 : 0.2 + 0.8 * e.progress);
      var low = RTS.camera.screenToWorld(cam, sx, sy + wall * cam.scale);
      return crosses(ground, low, e.x, e.y, e.x + e.w, e.y + e.h);
    }
    if (Math.floor(ground.x) === e.x && Math.floor(ground.y) === e.y) return true;
    var c = center(e), p = RTS.camera.worldToScreen(cam, c.x, c.y);
    return Math.abs(sx - p.x) <= NODE_HALF * cam.scale &&
      sy <= p.y && sy >= p.y - (NODE[e.type] || 0.3) * cam.scale;
  }

  // 螢幕點到的實體：單位與動物優先，其次是畫在最前面的建築或天然物件
  function pick(cam, world, pid, sx, sy) {
    var unit = null, bestD = cam.scale * UNIT_REACH, fixed = null;
    world.entities.forEach(function (e) {
      if (e.w === undefined) {
        if (!RTS.fog.sees(world, pid, e)) return;
        var p = unitAnchor(cam, e), d = Math.hypot(p.x - sx, p.y - sy);
        if (d < bestD) { bestD = d; unit = e; }
      } else if (RTS.fog.targetable(world, pid, e) && hits(cam, e, sx, sy)) {
        if (!fixed || key(e) > key(fixed)) fixed = e;
      }
    });
    return unit || fixed;
  }

  // 命中點落在螢幕矩形內的己方單位與牲畜
  function ownInRect(cam, world, pid, rect, type) {
    return RTS.world.list(world, function (e) {
      if (e.w !== undefined || e.owner !== pid || (type && e.type !== type)) return false;
      var p = unitAnchor(cam, e);
      return p.x >= rect.x0 && p.x <= rect.x1 && p.y >= rect.y0 && p.y <= rect.y1;
    });
  }

  RTS.depth = {
    NODE_SCALE: NODE_SCALE, topOf: topOf, key: key, sort: sort, inView: inView,
    unitAnchor: unitAnchor, hits: hits, pick: pick, ownInRect: ownInRect
  };
})();
