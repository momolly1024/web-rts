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
    },
    lumberCamp: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      // 單坡棚子：後高前低，前方堆木頭
      var r = [0.2, 0.2, s - 0.2, s - 0.75];
      box(ctx, r, 0, 0.75, ['#7a5334', '#5f4029', '#6f4b2f']);
      face(ctx, [[0.08, 0.08, 1.05], [s - 0.08, 0.08, 1.05], [s - 0.08, s - 0.6, 0.75], [0.08, s - 0.6, 0.75]], c.color);
      face(ctx, [[s - 0.08, 0.08, 1.05], [s - 0.08, s - 0.6, 0.75], [s - 0.08, s - 0.6, 0.65], [s - 0.08, 0.08, 0.95]], c.dark);
      [[0.35, 0], [0.75, 0], [1.15, 0], [0.55, 0.22], [0.95, 0.22]].forEach(function (l) {
        var p = at(l[0] + 0.1, s - 0.35, 0.12 + l[1]);
        D.disc(ctx, p[0], p[1], 0.17, 0.12, '#a87a4a');
        D.disc(ctx, p[0], p[1], 0.08, 0.06, '#d9b07a', false);
      });
    },
    miningCamp: function (ctx, s, c) {
      plot(ctx, s, '#7d7262');
      var r = [0.2, 0.2, s - 0.6, s - 0.2];
      box(ctx, r, 0, 0.8, ['#8f8a82', '#716c65', '#807b73']);
      onLeft(ctx, r[3], 0.4, 0.8, 0, 0.55, '#2b211b');
      gable(ctx, [0.1, 0.1, s - 0.5, s - 0.1], 0.8, 0.5, c.color, c.dark, '#716c65');
      // 側邊的礦車，載著石塊與金塊
      box(ctx, [s - 0.5, 0.5, s - 0.08, 1.2], 0.1, 0.42, ['#5c4326', '#4a3220', '#3a2618']);
      [[0.62, '#9aa0a6'], [0.85, '#ffd84a'], [1.05, '#9aa0a6']].forEach(function (g) {
        var p = at(s - 0.3, g[0], 0.48);
        D.disc(ctx, p[0], p[1], 0.11, 0.08, g[1]);
      });
    },
    mill: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var r = [0.35, 0.35, s - 0.35, s - 0.35];
      box(ctx, r, 0, 1.0, ['#d6c29c', '#b39f7c', '#c4b08b']);
      onLeft(ctx, r[3], 0.7, 1.05, 0, 0.6, '#5a3d26');
      spire(ctx, [0.25, 0.25, s - 0.25, s - 0.25], 1.0, 0.8, c.color, c.dark);
      // 風車葉片
      var hub = at(s / 2, s - 0.3, 1.25);
      [0.4, 1.97, 3.54, 5.11].forEach(function (a) {
        var x = hub[0] + Math.cos(a) * 0.85, y = hub[1] + Math.sin(a) * 0.85;
        D.line(ctx, [hub[0], hub[1], x, y], '#4a3220', 0.07);
        var nx = -Math.sin(a) * 0.14, ny = Math.cos(a) * 0.14;
        var mx = hub[0] + Math.cos(a) * 0.3, my = hub[1] + Math.sin(a) * 0.3;
        D.poly(ctx, [mx, my, x, y, x + nx, y + ny, mx + nx, my + ny], '#efe6cf');
      });
      D.disc(ctx, hub[0], hub[1], 0.08, 0.08, '#4a3220');
    },
    // 農田：田畦顏色隨剩餘食物由綠轉黃，四角插己方小旗
    farm: function (ctx, s, c, e) {
      face(ctx, [[0.05, 0.05, 0], [s - 0.05, 0.05, 0], [s - 0.05, s - 0.05, 0], [0.05, s - 0.05, 0]], '#7a5a36');
      var full = e && e.amount !== undefined && e.complete ? e.amount / RTS.data.buildings.farm.farm.food : 1;
      var crop = full > 0.66 ? '#6c9a3a' : full > 0.33 ? '#a9a23c' : '#c9a646';
      for (var v = 0.35; v < s - 0.2; v += 0.45) {
        face(ctx, [[0.25, v - 0.1, 0], [s - 0.25, v - 0.1, 0], [s - 0.25, v + 0.1, 0.06], [0.25, v + 0.1, 0.06]], crop, false);
      }
      edge(ctx, [0.05, s - 0.05, 0], [0.05, s - 0.05, 0.35], '#4a3220', 0.05);
      edge(ctx, [s - 0.05, 0.05, 0], [s - 0.05, 0.05, 0.35], '#4a3220', 0.05);
      var p = at(s - 0.05, s - 0.05, 0);
      D.line(ctx, [p[0], p[1], p[0], p[1] - 0.45], '#1c1a17', 0.05);
      D.poly(ctx, [p[0], p[1] - 0.45, p[0] + 0.3, p[1] - 0.37, p[0], p[1] - 0.29], c.color);
    },
    market: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      // 兩個攤位，條紋遮棚用己方顏色
      [[0.25, 0.3, 1.35, 1.2], [1.55, 1.6, s - 0.25, s - 0.3]].forEach(function (r) {
        box(ctx, [r[0], r[1], r[2], r[3]], 0, 0.5, ['#8a5f3c', '#6f4b2f', '#7a5334']);
        [[r[0] + 0.05, r[3] - 0.05], [r[2] - 0.05, r[3] - 0.05], [r[2] - 0.05, r[1] + 0.05]].forEach(function (p) {
          edge(ctx, [p[0], p[1], 0.5], [p[0], p[1], 1.2], '#4a3220', 0.05);
        });
        var n = 4, w = (r[2] - r[0] + 0.2) / n;
        for (var i = 0; i < n; i++) {
          var u0 = r[0] - 0.1 + i * w;
          face(ctx, [[u0, r[1] - 0.1, 1.35], [u0 + w, r[1] - 0.1, 1.35], [u0 + w, r[3] + 0.15, 1.05], [u0, r[3] + 0.15, 1.05]],
            i % 2 ? '#efe6cf' : c.color);
        }
        // 攤上的貨物
        [['#b8285a', 0.3], ['#ffd84a', 0.6], ['#9aa0a6', 0.9]].forEach(function (g) {
          var p = at(r[0] + g[1], r[3] - 0.2, 0.62);
          D.disc(ctx, p[0], p[1], 0.11, 0.08, g[0]);
        });
      });
      flag(ctx, s / 2, s / 2, 0.2, c.color);
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
