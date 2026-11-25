// 地圖外的裝飾景觀：菱形邊界外畫變暗的草地、水與樹，取代單一底色。
// 純裝飾，不讀也不改世界狀態；不能通行、點選或建造，也不受迷霧影響。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var GRASS = ['#56693a', '#52653a', '#5a6e3d'];
  var WATER = ['#2f5878', '#335d7e'];
  var TRUNK = '#4a3622';
  var LEAVES = ['#24502d', '#2d5c2b'];
  var OUTLINE = '#141210';
  var SHADES = 6;            // 離地圖越遠越暗，分幾階
  var FADE_PER_SHADE = 3;    // 每幾格暗一階
  var MAX_DARKEN = 0.5;      // 最暗時混入黑色的比例
  var LAKE_CELL = 7;         // 水塘雜訊的格距（格）
  var WATER_LEVEL = 0.72;    // 雜訊高於此值為水
  var TREE_CHANCE = 0.22;    // 草地長樹的機率
  var FAR_GAP = 1;           // 地圖後方（上側兩邊）樹與邊界的最小距離
  var NEAR_GAP = 4;          // 地圖前方（下側兩邊）的距離較大，樹冠才不會蓋到地圖
  var BLEED = 0.02;

  function hash(x, y, salt) {
    var h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // 平滑的值雜訊：讓水成片出現，而不是零星斑點
  function lakeNoise(x, y) {
    var gx = Math.floor(x / LAKE_CELL), gy = Math.floor(y / LAKE_CELL);
    var fx = x / LAKE_CELL - gx, fy = y / LAKE_CELL - gy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    var a = hash(gx, gy, 1), b = hash(gx + 1, gy, 1);
    var c = hash(gx, gy + 1, 1), d = hash(gx + 1, gy + 1, 1);
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  }

  // 與地圖的格距（地圖內為 0）
  function distanceOut(x, y, mapW, mapH) {
    var dx = x < 0 ? -x : x >= mapW ? x - mapW + 1 : 0;
    var dy = y < 0 ? -y : y >= mapH ? y - mapH + 1 : 0;
    return Math.max(dx, dy);
  }

  // 某格的景觀；地圖內回傳 null。前方 = 下側兩邊（x 或 y 超出最大值）。
  function tileAt(x, y, mapW, mapH) {
    var d = distanceOut(x, y, mapW, mapH);
    if (d === 0) return null;
    var water = lakeNoise(x, y) > WATER_LEVEL;
    var nearSide = x >= mapW || y >= mapH;
    var tree = !water && d >= (nearSide ? NEAR_GAP : FAR_GAP) && hash(x, y, 2) < TREE_CHANCE;
    return {
      water: water,
      tree: tree,
      variant: Math.floor(hash(x, y, 3) * 6),
      shade: Math.min(SHADES - 1, Math.floor((d - 1) / FADE_PER_SHADE))
    };
  }

  function darken(hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    var k = 1 - amount;
    var r = Math.round((n >> 16 & 255) * k), g = Math.round((n >> 8 & 255) * k), b = Math.round((n & 255) * k);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // 每個顏色預先算好各階暗色，繪圖時只查表
  function shaded(list) {
    return list.map(function (hex) {
      var out = [];
      for (var s = 0; s < SHADES; s++) out.push(darken(hex, MAX_DARKEN * s / (SHADES - 1)));
      return out;
    });
  }
  var GRASS_S = shaded(GRASS), WATER_S = shaded(WATER), LEAVES_S = shaded(LEAVES), TRUNK_S = shaded([TRUNK])[0];

  function trace(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }

  function tri(ctx, a, b, c, d, e, f, fill) {
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.lineTo(c, d);
    ctx.lineTo(e, f);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  }

  // 比資源樹簡單、顏色更暗，一眼看得出不能砍
  function tree(ctx, cam, x, y, t) {
    var p = RTS.camera.worldToScreen(cam, x + 0.5, y + 0.5);
    var s = cam.scale * RTS.depth.NODE_SCALE;
    var leaves = LEAVES_S[t.variant % 2][t.shade];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(s, s);
    ctx.lineWidth = 1 / 40;
    ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = TRUNK_S[t.shade];
    ctx.fillRect(-0.06, 0, 0.12, 0.32);
    var h = 1 + (t.variant % 3) * 0.08;     // 高度略有變化
    ctx.scale(h, h);
    tri(ctx, -0.44, 0.1, 0, -0.46, 0.44, 0.1, leaves);
    tri(ctx, -0.34, -0.2, 0, -0.74, 0.34, -0.2, leaves);
    ctx.restore();
  }

  // 畫面內所有地圖外的格子（不夾在地圖範圍內）
  function screenTiles(cam) {
    var xs = [], ys = [];
    [[0, 0], [cam.viewW, 0], [0, cam.viewH], [cam.viewW, cam.viewH]].forEach(function (c) {
      var w = RTS.camera.screenToWorld(cam, c[0], c[1]);
      xs.push(w.x);
      ys.push(w.y);
    });
    return {
      x0: Math.floor(Math.min.apply(null, xs)) - 1, x1: Math.ceil(Math.max.apply(null, xs)) + 1,
      y0: Math.floor(Math.min.apply(null, ys)) - 1, y1: Math.ceil(Math.max.apply(null, ys)) + 1
    };
  }

  function draw(ctx, cam) {
    var mapW = cam.mapW, mapH = cam.mapH, v = screenTiles(cam), trees = [];
    for (var y = v.y0; y <= v.y1; y++) {
      for (var x = v.x0; x <= v.x1; x++) {
        if (x >= 0 && y >= 0 && x < mapW && y < mapH) continue;
        var mid = RTS.camera.worldToScreen(cam, x + 0.5, y + 0.5);
        // 下緣多留樹的高度，畫面外的樹冠才不會被剔掉
        if (!RTS.camera.onScreen(cam, mid, cam.scale * 1.1, cam.scale * 1.8)) continue;
        var t = tileAt(x, y, mapW, mapH);
        var colors = t.water ? WATER_S : GRASS_S;
        ctx.fillStyle = colors[t.variant % colors.length][t.shade];
        trace(ctx, RTS.camera.quad(cam, x - BLEED, y - BLEED, 1 + BLEED * 2, 1 + BLEED * 2));
        ctx.fill();
        if (t.tree) trees.push({ x: x, y: y, t: t });
      }
    }
    // 由後往前畫，前面的樹蓋住後面的
    trees.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y) || a.x - b.x; });
    trees.forEach(function (k) { tree(ctx, cam, k.x, k.y, k.t); });
  }

  RTS.scenery = { draw: draw, tileAt: tileAt, distanceOut: distanceOut, NEAR_GAP: NEAR_GAP };
})();
