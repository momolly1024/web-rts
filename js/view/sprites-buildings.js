// 原創向量圖形：等角視角的建築與工地。原點在占地的 (0, 0) 角，單位為格。
// 以「占地座標 (u, v) 加高度 z」描點，投影交給 camera.js；
// 看得到的兩個立面是左前（v 最大）與右前（u 最大）。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var D = RTS.sprites.draw;

  function at(u, v, z) {
    var p = RTS.camera.project(u, v);
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

  // 左前立面上的矩形：沿 u 從 a 到 b、高度 z0 到 z1
  function onLeft(ctx, v, a, b, z0, z1, fill) {
    face(ctx, [[a, v, z0], [b, v, z0], [b, v, z1], [a, v, z1]], fill);
  }

  function onRight(ctx, u, a, b, z0, z1, fill) {
    face(ctx, [[u, a, z0], [u, b, z0], [u, b, z1], [u, a, z1]], fill);
  }

  // r = [u0, v0, u1, v1]；colors = [左前面, 右前面, 頂面]
  function box(ctx, r, z0, z1, colors) {
    onLeft(ctx, r[3], r[0], r[2], z0, z1, colors[0]);
    onRight(ctx, r[2], r[1], r[3], z0, z1, colors[1]);
    face(ctx, [[r[0], r[1], z1], [r[2], r[1], z1], [r[2], r[3], z1], [r[0], r[3], z1]], colors[2]);
  }

  // 屋脊沿 u 方向的雙坡屋頂
  function gable(ctx, r, z, rise, roof, shade, wall) {
    var u0 = r[0], v0 = r[1], u1 = r[2], v1 = r[3], mid = (v0 + v1) / 2, top = z + rise;
    face(ctx, [[u0, v0, z], [u1, v0, z], [u1, mid, top], [u0, mid, top]], shade);
    face(ctx, [[u1, v0, z], [u1, v1, z], [u1, mid, top]], wall);
    face(ctx, [[u0, v1, z], [u1, v1, z], [u1, mid, top], [u0, mid, top]], roof);
    edge(ctx, [u1, v0, z], [u1, mid, top], shade, 0.09);
  }

  // 四角尖頂：先畫背面兩片，再畫看得到的兩片
  function spire(ctx, r, z, rise, roof, shade) {
    var apex = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2, z + rise];
    face(ctx, [[r[0], r[1], z], [r[2], r[1], z], apex], shade);
    face(ctx, [[r[0], r[1], z], [r[0], r[3], z], apex], roof);
    face(ctx, [[r[0], r[3], z], [r[2], r[3], z], apex], roof);
    face(ctx, [[r[2], r[1], z], [r[2], r[3], z], apex], shade);
  }

  function flag(ctx, u, v, z, color) {
    var p = at(u, v, z), x = p[0], y = p[1];
    D.line(ctx, [x, y, x, y - 0.7], '#1c1a17', 0.06);
    D.poly(ctx, [x, y - 0.7, x + 0.5, y - 0.57, x, y - 0.42], color);
  }

  // 占地的泥土基座，讓格子範圍一眼可見
  function plot(ctx, s, fill) {
    face(ctx, [[0.04, 0.04, 0], [s - 0.04, 0.04, 0], [s - 0.04, s - 0.04, 0], [0.04, s - 0.04, 0]], fill, false);
  }

  var buildings = {
    townCenter: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var hall = [0.45, 0.45, s - 0.45, s - 0.45];
      box(ctx, hall, 0, 1.2, ['#bdb7ac', '#9d978d', '#a8a39a']);
      onLeft(ctx, hall[3], s / 2 - 0.35, s / 2 + 0.35, 0, 0.8, '#4a3220');
      onRight(ctx, hall[2], s / 2 - 0.2, s / 2 + 0.2, 0.45, 0.85, '#3a4a5c');
      gable(ctx, [0.3, 0.3, s - 0.3, s - 0.3], 1.2, 1.0, c.color, c.dark, '#bdb7ac');
      flag(ctx, s / 2, s / 2, 2.2, c.color);
      // 左右角樓
      [[0.1, s - 0.85, 0.85, s - 0.1], [s - 0.85, 0.1, s - 0.1, 0.85]].forEach(function (t) {
        box(ctx, t, 0, 1.75, ['#c9c3b8', '#a8a297', '#a8a39a']);
        onLeft(ctx, t[3], t[0] + 0.28, t[0] + 0.47, 1.1, 1.45, '#3a322c');
        spire(ctx, [t[0] - 0.07, t[1] - 0.07, t[2] + 0.07, t[3] + 0.07], 1.75, 0.85, c.color, c.dark);
      });
    },
    house: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var r = [0.25, 0.3, s - 0.25, s - 0.3];
      box(ctx, r, 0, 0.8, ['#d6c29c', '#b39f7c', '#c4b08b']);
      onLeft(ctx, r[3], 0.55, 0.95, 0, 0.58, '#5a3d26');
      onLeft(ctx, r[3], 1.2, 1.5, 0.25, 0.55, '#3a4a5c');
      gable(ctx, [0.12, 0.16, s - 0.12, s - 0.16], 0.8, 0.75, c.color, c.dark, '#c4a97c');
    },
    blacksmith: function (ctx, s, c) {
      plot(ctx, s, '#7d7262');
      var r = [0.2, 0.2, s - 0.2, s - 0.55];
      box(ctx, r, 0, 0.9, ['#8f8a82', '#716c65', '#807b73']);
      onLeft(ctx, r[3], 0.4, 1.15, 0, 0.65, '#2b211b');
      face(ctx, [[0.58, r[3], 0.04], [0.78, r[3], 0.4], [0.98, r[3], 0.04]], '#ff8c2e', false);
      gable(ctx, [0.1, 0.08, s - 0.1, s - 0.42], 0.9, 0.6, c.color, c.dark, '#716c65');
      box(ctx, [0.45, 0.45, 0.8, 0.8], 1.1, 1.95, ['#6b6158', '#524a43', '#2b211b']);
      var smoke = at(0.62, 0.62, 2.2);
      D.disc(ctx, smoke[0], smoke[1], 0.2, 0.13, 'rgba(220,220,220,0.6)', false);
      // 屋前的鐵砧
      box(ctx, [1.45, 1.6, 1.65, 1.8], 0, 0.2, ['#4a3220', '#3a2618', '#4a3220']);
      box(ctx, [1.28, 1.55, 1.85, 1.85], 0.2, 0.34, ['#545b63', '#3d4248', '#6a727b']);
    },
    barracks: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var r = [0.2, 0.3, s - 0.2, s - 0.3];
      box(ctx, r, 0, 1.0, ['#8a5f3c', '#6f4b2f', '#7a5334']);
      for (var u = 0.55; u < r[2] - 0.1; u += 0.4) edge(ctx, [u, r[3], 0.03], [u, r[3], 0.97], '#6a4529', 0.04);
      onLeft(ctx, r[3], 0.45, 0.95, 0, 0.7, '#33251a');
      // 掛在牆上的隊旗與交叉雙劍
      var a = s - 1.35, b = s - 0.45;
      onLeft(ctx, r[3], a, b, 0.22, 0.88, c.color);
      edge(ctx, [a + 0.18, r[3], 0.32], [b - 0.18, r[3], 0.78], '#e8e2d0', 0.08);
      edge(ctx, [b - 0.18, r[3], 0.32], [a + 0.18, r[3], 0.78], '#e8e2d0', 0.08);
      gable(ctx, [0.08, 0.14, s - 0.08, s - 0.14], 1.0, 0.85, '#5c5852', '#45423e', '#6f4b2f');
      flag(ctx, s - 0.3, s / 2, 1.8, c.color);
    }
  };

  function construction(ctx, s, progress) {
    plot(ctx, s, '#9b7f58');
    var m = 0.3, far = s - m;
    function post(u, v) { edge(ctx, [u, v, 0], [u, v, 1.3], '#5c4326', 0.09); }
    post(m, m);
    box(ctx, [m + 0.08, m + 0.08, far - 0.08, far - 0.08], 0, 0.15 + progress, ['#c3ad84', '#a3906c', '#8f7a55']);
    post(m, far);
    post(far, m);
    post(far, far);
    edge(ctx, [m, far, 0.2], [far, far, 1.2], '#5c4326', 0.06);
    edge(ctx, [far, far, 0.2], [far, m, 1.2], '#5c4326', 0.06);
  }

  RTS.sprites.buildings = buildings;
  RTS.sprites.construction = construction;
})();
