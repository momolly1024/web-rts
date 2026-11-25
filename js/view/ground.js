// 地面與迷霧繪製：只畫畫面內、已探索的菱形格。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var GRASS = ['#7b9a4b', '#759447', '#80a04f'];
  var WATER = ['#3f74a0', '#4580ac'];
  // 已探索但不在視野內的暗色
  var GRASS_DIM = ['#45562a', '#425229', '#48592d'];
  var WATER_DIM = ['#23415a', '#264761'];
  var BLEED = 0.02;       // 每格向外多畫一點，蓋住相鄰格之間的接縫

  function trace(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }

  function draw(ctx, world, cam, human) {
    var map = world.map, v = RTS.camera.visibleTiles(cam);
    var outline = RTS.camera.quad(cam, 0, 0, map.width, map.height);
    // 整張地圖先塗黑，未探索的格子就不必逐格畫
    trace(ctx, outline);
    ctx.fillStyle = '#000';
    ctx.fill();
    for (var y = v.y0; y <= v.y1; y++) {
      for (var x = v.x0; x <= v.x1; x++) {
        // 外接矩形的四角落在畫面外，逐格剔除
        var mid = RTS.camera.worldToScreen(cam, x + 0.5, y + 0.5);
        if (!RTS.camera.onScreen(cam, mid, cam.scale * 1.1, cam.scale * 0.6)) continue;
        var seen = RTS.fog.tile(world, human, x, y);
        if (seen === RTS.fog.UNEXPLORED) continue;
        var hash = (x * 73 + y * 151 + x * y * 7) % 17;
        var water = map.terrain[y * map.width + x] === RTS.map.TERRAIN.WATER;
        var dim = seen === RTS.fog.EXPLORED;
        var colors = water ? (dim ? WATER_DIM : WATER) : (dim ? GRASS_DIM : GRASS);
        ctx.fillStyle = colors[hash % colors.length];
        trace(ctx, RTS.camera.quad(cam, x - BLEED, y - BLEED, 1 + BLEED * 2, 1 + BLEED * 2));
        ctx.fill();
      }
    }
    // 邊界線：外圈深色粗線加內圈淡色細線，與地圖外景觀清楚分開
    trace(ctx, outline);
    ctx.strokeStyle = '#1c1a17';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(244,231,190,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  RTS.ground = { draw: draw };
})();
