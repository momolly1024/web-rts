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
    colors = colors.map(function (color) { return RTS.civStyle.tint(style, color); });
    onLeft(ctx, r[3], r[0], r[2], z0, z1, colors[0]);
    onRight(ctx, r[2], r[1], r[3], z0, z1, colors[1]);
    face(ctx, [[r[0], r[1], z1], [r[2], r[1], z1], [r[2], r[3], z1], [r[0], r[3], z1]], colors[2]);
  }

  // 繪製中的文明風格（null 為原本樣式）
  var style = null;

  function tools(ctx) {
    return {
      face: face.bind(null, ctx), edge: edge.bind(null, ctx),
      // 屋頂零件用自己的顏色，不套牆面色調
      box: function (r, z0, z1, colors) {
        var saved = style;
        style = null;
        box(ctx, r, z0, z1, colors);
        style = saved;
      }
    };
  }

  function gable(ctx, r, z, rise, roof, shade, wall) {
    wall = RTS.civStyle.tint(style, wall);
    if (style) style.gable(tools(ctx), r, z, rise, roof, shade, wall, plainGable.bind(null, ctx));
    else plainGable(ctx, r, z, rise, roof, shade, wall);
  }

  function spire(ctx, r, z, rise, roof, shade) {
    if (style) style.spire(tools(ctx), r, z, rise, { color: roof, dark: shade }, plainSpire.bind(null, ctx));
    else plainSpire(ctx, r, z, rise, roof, shade);
  }

  // 屋脊沿 u 方向的雙坡屋頂
  function plainGable(ctx, r, z, rise, roof, shade, wall) {
    var u0 = r[0], v0 = r[1], u1 = r[2], v1 = r[3], mid = (v0 + v1) / 2, top = z + rise;
    face(ctx, [[u0, v0, z], [u1, v0, z], [u1, mid, top], [u0, mid, top]], shade);
    face(ctx, [[u1, v0, z], [u1, v1, z], [u1, mid, top]], wall);
    face(ctx, [[u0, v1, z], [u1, v1, z], [u1, mid, top], [u0, mid, top]], roof);
    edge(ctx, [u1, v0, z], [u1, mid, top], shade, 0.09);
  }

  // 四角尖頂：先畫背面兩片，再畫看得到的兩片
  function plainSpire(ctx, r, z, rise, roof, shade) {
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
      // 主樓立在後方角落，大廳在前，正門前不放任何會遮擋的東西
      var tower = [0.12, 0.12, 1.12, 1.12];
      box(ctx, tower, 0, 2.2, ['#c9c3b8', '#a8a297', '#a8a39a']);
      spire(ctx, [0.03, 0.03, 1.21, 1.21], 2.2, 0.75, c.color, c.dark);
      flag(ctx, 0.62, 0.62, 2.95, c.color);
      var hall = [0.4, 0.75, s - 0.2, s - 0.5];
      box(ctx, hall, 0, 1.15, ['#d3cdc1', '#a8a297', '#a8a39a']);
      gable(ctx, [0.28, 0.63, s - 0.08, s - 0.38], 1.15, 0.85, c.color, c.dark, '#bdb7ac');
      // 正門：石框、雙扇木門與門前石階
      var v = hall[3], mid = (hall[0] + hall[2]) / 2;
      onLeft(ctx, v, mid - 0.5, mid + 0.5, 0, 0.98, '#8d877d');
      onLeft(ctx, v, mid - 0.38, mid + 0.38, 0, 0.86, '#4a3220');
      edge(ctx, [mid, v, 0], [mid, v, 0.86], '#2b1d12', 0.05);
      box(ctx, [mid - 0.55, v, mid + 0.55, v + 0.28], 0, 0.08, ['#8d877d', '#77726a', '#bdb7ac']);
      // 門兩側與山牆面的窗
      [mid - 0.88, mid + 0.66].forEach(function (u) { onLeft(ctx, v, u, u + 0.22, 0.4, 0.75, '#3a4a5c'); });
      onRight(ctx, hall[2], (hall[1] + v) / 2 - 0.2, (hall[1] + v) / 2 + 0.2, 0.4, 0.8, '#3a4a5c');
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
    // 靶場：開放式棚子加兩座草靶
    archeryRange: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var r = [0.2, 0.2, s - 0.2, 1.3];
      box(ctx, r, 0, 0.9, ['#8a5f3c', '#6f4b2f', '#7a5334']);
      onLeft(ctx, r[3], 0.5, s - 0.5, 0.1, 0.75, '#33251a');
      gable(ctx, [0.08, 0.08, s - 0.08, 1.42], 0.9, 0.6, c.color, c.dark, '#6f4b2f');
      [[0.9, s - 0.6], [s - 0.7, s - 0.6]].forEach(function (p) {
        edge(ctx, [p[0], p[1], 0], [p[0], p[1], 0.5], '#5c4326', 0.07);
        var m = at(p[0], p[1], 0.75);
        D.disc(ctx, m[0], m[1], 0.28, 0.28, '#d9c27a');
        D.disc(ctx, m[0], m[1], 0.18, 0.18, '#efe6cf', false);
        D.disc(ctx, m[0], m[1], 0.08, 0.08, '#d0473f', false);
      });
      flag(ctx, s - 0.3, 0.3, 1.5, c.color);
    },
    // 馬廄：長穀倉、乾草堆、門口的馬蹄鐵招牌
    stable: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var r = [0.2, 0.3, s - 0.2, s - 0.6];
      box(ctx, r, 0, 1.0, ['#9c5b3a', '#7d472d', '#8a5034']);
      [0.5, 1.2, 1.9].forEach(function (u) { onLeft(ctx, r[3], u, u + 0.5, 0, 0.6, '#3a2618'); });
      gable(ctx, [0.08, 0.16, s - 0.08, s - 0.48], 1.0, 0.8, '#5c5852', '#45423e', '#7d472d');
      box(ctx, [s - 1.0, s - 0.45, s - 0.3, s - 0.1], 0, 0.35, ['#d9c27a', '#bfa860', '#e6d28c']);
      var p = at(1.45, r[3], 0.85);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 0.16, 0.3, Math.PI - 0.3, true);
      ctx.strokeStyle = '#c9ced4';
      ctx.lineWidth = 0.07;
      ctx.stroke();
      ctx.lineWidth = 1 / 36;
      flag(ctx, s - 0.3, s / 2, 1.9, c.color);
    },
    // 箭塔：一格的高石塔，頂端有垛口與旗
    tower: function (ctx, s, c, e) {
      plot(ctx, s, '#7d7262');
      box(ctx, [0.12, 0.12, s - 0.12, s - 0.12], 0, 2.1, ['#a59a87', '#857b6b', '#9a907e']);
      onLeft(ctx, s - 0.12, 0.4, 0.6, 1.3, 1.6, '#2b211b');
      onRight(ctx, s - 0.12, 0.4, 0.6, 1.5, 1.8, '#2b211b');
      box(ctx, [0.04, 0.04, s - 0.04, s - 0.04], 2.1, 2.3, ['#b3a895', '#93897a', '#a59a87']);
      [[0.1, s - 0.1], [0.5, s - 0.1], [s - 0.1, 0.1], [s - 0.1, 0.5]].forEach(function (p) {
        box(ctx, [p[0] - 0.08, p[1] - 0.08, p[0] + 0.08, p[1] + 0.08], 2.3, 2.45, ['#b3a895', '#93897a', '#a59a87']);
      });
      if (e && e.branch === 'range') {
        // 遠射型：加高的尖頂瞭望亭
        box(ctx, [0.28, 0.28, s - 0.28, s - 0.28], 2.3, 2.65, ['#6f4b2f', '#5f4029', '#7a5334']);
        spire(ctx, [0.18, 0.18, s - 0.18, s - 0.18], 2.65, 0.55, c.color, c.dark);
        return;
      }
      if (e && e.branch === 'damage') {
        // 高傷害型：塔身鐵箍與頂上的重弩
        onLeft(ctx, s - 0.12, 0.12, s - 0.12, 1.85, 2.0, '#2f3338');
        onRight(ctx, s - 0.12, 0.12, s - 0.12, 1.85, 2.0, '#22262a');
        edge(ctx, [0.25, s / 2, 2.65], [s - 0.05, s / 2, 2.65], '#2f3338', 0.12);
        edge(ctx, [s / 2, 0.15, 2.65], [s - 0.15, s / 2, 2.65], '#7a5334', 0.09);
        edge(ctx, [s / 2, s - 0.15, 2.65], [s - 0.15, s / 2, 2.65], '#7a5334', 0.09);
      }
      flag(ctx, s / 2, s / 2, 2.45, c.color);
    },
    // 石牆：一格厚牆，上緣有垛口
    wall: function (ctx, s, c) {
      box(ctx, [0.08, 0.08, s - 0.08, s - 0.08], 0, 0.9, ['#a59a87', '#857b6b', '#9a907e']);
      [[0.15, 0.85], [0.85, 0.85], [0.85, 0.15]].forEach(function (p) {
        box(ctx, [p[0] - 0.1, p[1] - 0.1, p[0] + 0.1, p[1] + 0.1], 0.9, 1.05, ['#b3a895', '#93897a', '#a59a87']);
      });
      onLeft(ctx, s - 0.08, 0.35, 0.65, 0.35, 0.5, c.color);
    },
    // 城門：兩側石柱夾著木門，門上掛己方顏色
    gate: function (ctx, s, c) {
      face(ctx, [[0.05, 0.05, 0], [s - 0.05, 0.05, 0], [s - 0.05, s - 0.05, 0], [0.05, s - 0.05, 0]], '#8f815f', false);
      box(ctx, [0.05, 0.05, 0.3, s - 0.05], 0, 1.2, ['#a59a87', '#857b6b', '#9a907e']);
      box(ctx, [s - 0.3, 0.05, s - 0.05, s - 0.05], 0, 1.2, ['#a59a87', '#857b6b', '#9a907e']);
      box(ctx, [0.05, 0.05, s - 0.05, s - 0.05], 0.95, 1.2, ['#b3a895', '#93897a', '#a59a87']);
      onLeft(ctx, s - 0.05, 0.3, s - 0.3, 0, 0.95, '#6b4a2b');
      onLeft(ctx, s - 0.05, 0.42, s - 0.42, 0.55, 0.85, c.color);
    },
    // 修道院：白牆、圓頂、鐘
    temple: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var r = [0.35, 0.35, s - 0.35, s - 0.35];
      box(ctx, r, 0, 1.2, ['#efe6cf', '#d6ccb2', '#e3d9bf']);
      onLeft(ctx, r[3], s / 2 - 0.3, s / 2 + 0.3, 0, 0.8, '#5a3d26');
      onRight(ctx, r[2], s / 2 - 0.2, s / 2 + 0.2, 0.5, 0.9, '#3a4a5c');
      spire(ctx, [0.25, 0.25, s - 0.25, s - 0.25], 1.2, 0.9, c.color, c.dark);
      var top = at(s / 2, s / 2, 2.3);
      D.disc(ctx, top[0], top[1], 0.16, 0.16, '#ffd84a');
    },
    // 攻城工坊：大木棚與一根攻城槌的木頭
    siegeWorkshop: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var r = [0.2, 0.2, s - 0.2, s - 0.9];
      box(ctx, r, 0, 1.1, ['#7a5334', '#5f4029', '#6f4b2f']);
      onLeft(ctx, r[3], 0.5, s - 0.5, 0, 0.85, '#2b211b');
      gable(ctx, [0.08, 0.08, s - 0.08, s - 0.78], 1.1, 0.7, c.color, c.dark, '#5f4029');
      box(ctx, [0.6, s - 0.55, s - 0.6, s - 0.3], 0.1, 0.35, ['#8a5f3c', '#6f4b2f', '#9c6b45']);
      [0.7, s - 0.7].forEach(function (u) {
        var p = at(u, s - 0.3, 0.1);
        D.disc(ctx, p[0], p[1], 0.14, 0.14, '#4a3220');
      });
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
    // 牲畜圈：乾草地面、四周木柵欄、角落水槽
    pen: function (ctx, s, c) {
      face(ctx, [[0.05, 0.05, 0], [s - 0.05, 0.05, 0], [s - 0.05, s - 0.05, 0], [0.05, s - 0.05, 0]], '#b9a46a', false);
      box(ctx, [0.25, 0.25, 0.95, 0.55], 0, 0.22, ['#6f4b2f', '#5f4029', '#4f7fa8']);
      var m = 0.12, f = s - 0.12;
      [[[m, m], [f, m]], [[m, m], [m, f]], [[m, f], [f, f]], [[f, m], [f, f]]].forEach(function (side) {
        var a = side[0], b = side[1];
        edge(ctx, [a[0], a[1], 0.22], [b[0], b[1], 0.22], '#7a5334', 0.05);
        edge(ctx, [a[0], a[1], 0.42], [b[0], b[1], 0.42], '#7a5334', 0.05);
        for (var t = 0; t <= 1.001; t += 1 / 3) {
          var u = a[0] + (b[0] - a[0]) * t, v = a[1] + (b[1] - a[1]) * t;
          edge(ctx, [u, v, 0], [u, v, 0.52], '#5c4326', 0.07);
        }
      });
      flag(ctx, f, f, 0.5, c.color);
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

  // 依擁有者的文明畫完工建築
  function draw(ctx, type, s, c, e, civ) {
    style = RTS.civStyle.of(civ);
    buildings[type](ctx, s, c, e);
    style = null;
  }

  RTS.sprites.buildings = buildings;
  RTS.sprites.building = draw;
  RTS.sprites.construction = construction;
})();
