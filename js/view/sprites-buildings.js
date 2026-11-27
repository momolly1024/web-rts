// 原創向量圖形：等角視角的建築與工地。原點在占地的 (0, 0) 角，單位為格。
// 描點、轉向與前後排序用 sprites-parts.js；圖形照朝向 0 描述，
// 這時看得到的兩個立面是左前（v 最大）與右前（u 最大）。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var D = RTS.sprites.draw;

  var P = RTS.sprites.parts;
  var at = P.at, face = P.face, edge = P.edge, onLeft = P.onLeft, onRight = P.onRight;

  // r = [u0, v0, u1, v1]；colors = [左前面, 右前面, 頂面]
  function box(ctx, r, z0, z1, colors) {
    colors = colors.map(function (color) { return RTS.civStyle.tint(style, color); });
    P.upright(r, function (w) {
      onLeft(ctx, w[3], w[0], w[2], z0, z1, colors[0]);
      onRight(ctx, w[2], w[1], w[3], z0, z1, colors[1]);
      face(ctx, [[w[0], w[1], z1], [w[2], w[1], z1], [w[2], w[3], z1], [w[0], w[3], z1]], colors[2]);
    });
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
    function paint(q) {
      if (style) style.gable(tools(ctx), q, z, rise, roof, shade, wall, plainGable.bind(null, ctx));
      else plainGable(ctx, q, z, rise, roof, shade, wall);
    }
    // 轉 90 度時屋脊跟著轉到另一軸；沒有屋脊方向的文明屋頂直接照實際矩形畫
    P.upright(r, function (w, turned) {
      if (turned && !(style && style.symmetric)) P.transposed(w, paint);
      else paint(w);
    });
  }

  function spire(ctx, r, z, rise, roof, shade) {
    P.upright(r, function (w) {
      if (style) style.spire(tools(ctx), w, z, rise, { color: roof, dark: shade }, plainSpire.bind(null, ctx));
      else plainSpire(ctx, w, z, rise, roof, shade);
    });
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
      var hall = [0.4, 0.75, s - 0.2, s - 0.5];
      var v = hall[3], mid = (hall[0] + hall[2]) / 2;
      P.layers([
        // 深度微調：轉向後角樓與大廳深度相近時，角樓畫在上面
        [0.62, 0.62, function () {
          box(ctx, [0.12, 0.12, 1.12, 1.12], 0, 2.2, ['#c9c3b8', '#a8a297', '#a8a39a']);
          spire(ctx, [0.03, 0.03, 1.21, 1.21], 2.2, 0.75, c.color, c.dark);
          flag(ctx, 0.62, 0.62, 2.95, c.color);
        }, 0.5],
        [mid, (hall[1] + v) / 2, function () {
          box(ctx, hall, 0, 1.15, ['#d3cdc1', '#a8a297', '#a8a39a']);
          gable(ctx, [0.28, 0.63, s - 0.08, s - 0.38], 1.15, 0.85, c.color, c.dark, '#bdb7ac');
          // 正門石框與雙扇木門、門兩側與山牆面的窗
          onLeft(ctx, v, mid - 0.5, mid + 0.5, 0, 0.98, '#8d877d');
          onLeft(ctx, v, mid - 0.38, mid + 0.38, 0, 0.86, '#4a3220');
          if (P.front()) edge(ctx, [mid, v, 0], [mid, v, 0.86], '#2b1d12', 0.05);
          [mid - 0.88, mid + 0.66].forEach(function (u) { onLeft(ctx, v, u, u + 0.22, 0.4, 0.75, '#3a4a5c'); });
          onRight(ctx, hall[2], (hall[1] + v) / 2 - 0.2, (hall[1] + v) / 2 + 0.2, 0.4, 0.8, '#3a4a5c');
        }],
        // 門前石階
        [mid, v + 0.14, function () {
          box(ctx, [mid - 0.55, v, mid + 0.55, v + 0.28], 0, 0.08, ['#8d877d', '#77726a', '#bdb7ac']);
        }]
      ]);
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
      P.layers([
        [s / 2, (r[1] + r[3]) / 2, function () {
          box(ctx, r, 0, 0.9, ['#8f8a82', '#716c65', '#807b73']);
          onLeft(ctx, r[3], 0.4, 1.15, 0, 0.65, '#2b211b');
          if (P.front()) face(ctx, [[0.58, r[3], 0.04], [0.78, r[3], 0.4], [0.98, r[3], 0.04]], '#ff8c2e', false);
          gable(ctx, [0.1, 0.08, s - 0.1, s - 0.42], 0.9, 0.6, c.color, c.dark, '#716c65');
          box(ctx, [0.45, 0.45, 0.8, 0.8], 1.1, 1.95, ['#6b6158', '#524a43', '#2b211b']);
          var smoke = at(0.62, 0.62, 2.2);
          D.disc(ctx, smoke[0], smoke[1], 0.2, 0.13, 'rgba(220,220,220,0.6)', false);
        }],
        // 屋前的鐵砧
        [1.56, 1.7, function () {
          box(ctx, [1.45, 1.6, 1.65, 1.8], 0, 0.2, ['#4a3220', '#3a2618', '#4a3220']);
          box(ctx, [1.28, 1.55, 1.85, 1.85], 0.2, 0.34, ['#545b63', '#3d4248', '#6a727b']);
        }]
      ]);
    },
    barracks: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var r = [0.2, 0.3, s - 0.2, s - 0.3];
      box(ctx, r, 0, 1.0, ['#8a5f3c', '#6f4b2f', '#7a5334']);
      for (var u = 0.55; P.front() && u < r[2] - 0.1; u += 0.4) edge(ctx, [u, r[3], 0.03], [u, r[3], 0.97], '#6a4529', 0.04);
      onLeft(ctx, r[3], 0.45, 0.95, 0, 0.7, '#33251a');
      // 掛在牆上的隊旗與交叉雙劍
      var a = s - 1.35, b = s - 0.45;
      onLeft(ctx, r[3], a, b, 0.22, 0.88, c.color);
      if (P.front()) {
        edge(ctx, [a + 0.18, r[3], 0.32], [b - 0.18, r[3], 0.78], '#e8e2d0', 0.08);
        edge(ctx, [b - 0.18, r[3], 0.32], [a + 0.18, r[3], 0.78], '#e8e2d0', 0.08);
      }
      gable(ctx, [0.08, 0.14, s - 0.08, s - 0.14], 1.0, 0.85, '#5c5852', '#45423e', '#6f4b2f');
      flag(ctx, s - 0.3, s / 2, 1.8, c.color);
    },
    // 靶場：開放式棚子加兩座草靶
    archeryRange: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var r = [0.2, 0.2, s - 0.2, 1.3];
      var shed = [s / 2, (r[1] + r[3]) / 2, function () {
        box(ctx, r, 0, 0.9, ['#8a5f3c', '#6f4b2f', '#7a5334']);
        onLeft(ctx, r[3], 0.5, s - 0.5, 0.1, 0.75, '#33251a');
        gable(ctx, [0.08, 0.08, s - 0.08, 1.42], 0.9, 0.6, c.color, c.dark, '#6f4b2f');
        flag(ctx, s - 0.3, 0.3, 1.5, c.color);
      }];
      var targets = [[0.9, s - 0.6], [s - 0.7, s - 0.6]].map(function (p) {
        return [p[0], p[1], function () {
          edge(ctx, [p[0], p[1], 0], [p[0], p[1], 0.5], '#5c4326', 0.07);
          var m = at(p[0], p[1], 0.75);
          D.disc(ctx, m[0], m[1], 0.28, 0.28, '#d9c27a');
          D.disc(ctx, m[0], m[1], 0.18, 0.18, '#efe6cf', false);
          D.disc(ctx, m[0], m[1], 0.08, 0.08, '#d0473f', false);
        }];
      });
      P.layers([shed].concat(targets));
    },
    // 馬廄：長穀倉、乾草堆、門口的馬蹄鐵招牌
    stable: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var r = [0.2, 0.3, s - 0.2, s - 0.6];
      function horseshoe() {
        var p = at(1.45, r[3], 0.85);
        ctx.beginPath();
        ctx.arc(p[0], p[1], 0.16, 0.3, Math.PI - 0.3, true);
        ctx.strokeStyle = '#c9ced4';
        ctx.lineWidth = 0.07;
        ctx.stroke();
        ctx.lineWidth = 1 / 36;
      }
      P.layers([
        [s / 2, (r[1] + r[3]) / 2, function () {
          box(ctx, r, 0, 1.0, ['#9c5b3a', '#7d472d', '#8a5034']);
          [0.5, 1.2, 1.9].forEach(function (u) { onLeft(ctx, r[3], u, u + 0.5, 0, 0.6, '#3a2618'); });
          gable(ctx, [0.08, 0.16, s - 0.08, s - 0.48], 1.0, 0.8, '#5c5852', '#45423e', '#7d472d');
          if (P.front()) horseshoe();
          flag(ctx, s - 0.3, s / 2, 1.9, c.color);
        }],
        // 乾草堆
        [s - 0.65, s - 0.28, function () {
          box(ctx, [s - 1.0, s - 0.45, s - 0.3, s - 0.1], 0, 0.35, ['#d9c27a', '#bfa860', '#e6d28c']);
        }]
      ]);
    },
    // 箭塔：一格的高石塔，頂端有垛口與旗
    tower: function (ctx, s, c, e) {
      plot(ctx, s, '#7d7262');
      box(ctx, [0.12, 0.12, s - 0.12, s - 0.12], 0, 2.1, ['#a59a87', '#857b6b', '#9a907e']);
      onLeft(ctx, s - 0.12, 0.4, 0.6, 1.3, 1.6, '#2b211b');
      onRight(ctx, s - 0.12, 0.4, 0.6, 1.5, 1.8, '#2b211b');
      box(ctx, [0.04, 0.04, s - 0.04, s - 0.04], 2.1, 2.3, ['#b3a895', '#93897a', '#a59a87']);
      P.upright([0, 0, s, s], function () {
        [[0.1, s - 0.1], [0.5, s - 0.1], [s - 0.1, 0.1], [s - 0.1, 0.5]].forEach(function (p) {
          box(ctx, [p[0] - 0.08, p[1] - 0.08, p[0] + 0.08, p[1] + 0.08], 2.3, 2.45, ['#b3a895', '#93897a', '#a59a87']);
        });
      });
      if (e && e.branch === 'range') {
        // 遠射型：加高的尖頂瞭望亭
        box(ctx, [0.28, 0.28, s - 0.28, s - 0.28], 2.3, 2.65, ['#6f4b2f', '#5f4029', '#7a5334']);
        spire(ctx, [0.18, 0.18, s - 0.18, s - 0.18], 2.65, 0.55, c.color, c.dark);
        return;
      }
      if (e && e.branch === 'damage') {
        // 高傷害型：塔身鐵箍與頂上的重弩
        P.upright([0, 0, s, s], function () {
          onLeft(ctx, s - 0.12, 0.12, s - 0.12, 1.85, 2.0, '#2f3338');
          onRight(ctx, s - 0.12, 0.12, s - 0.12, 1.85, 2.0, '#22262a');
        });
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
    // 城門：兩側石柱夾著木門，門上掛己方顏色。axis 為牆延伸的方向（見 construction.gateAxis），
    // 'x' 時石柱在 u 兩端、門在左前立面；'y' 時石柱在 v 兩端、門在右前立面
    gate: function (ctx, s, c, e, axis) {
      var pillar = ['#a59a87', '#857b6b', '#9a907e'];
      face(ctx, [[0.05, 0.05, 0], [s - 0.05, 0.05, 0], [s - 0.05, s - 0.05, 0], [0.05, s - 0.05, 0]], '#8f815f', false);
      if (axis === 'y') {
        box(ctx, [0.05, 0.05, s - 0.05, 0.3], 0, 1.2, pillar);
        box(ctx, [0.05, s - 0.3, s - 0.05, s - 0.05], 0, 1.2, pillar);
      } else {
        box(ctx, [0.05, 0.05, 0.3, s - 0.05], 0, 1.2, pillar);
        box(ctx, [s - 0.3, 0.05, s - 0.05, s - 0.05], 0, 1.2, pillar);
      }
      box(ctx, [0.05, 0.05, s - 0.05, s - 0.05], 0.95, 1.2, ['#b3a895', '#93897a', '#a59a87']);
      if (axis === 'y') {
        onRight(ctx, s - 0.05, 0.3, s - 0.3, 0, 0.95, '#6b4a2b');
        onRight(ctx, s - 0.05, 0.42, s - 0.42, 0.55, 0.85, c.color);
      } else {
        onLeft(ctx, s - 0.05, 0.3, s - 0.3, 0, 0.95, '#6b4a2b');
        onLeft(ctx, s - 0.05, 0.42, s - 0.42, 0.55, 0.85, c.color);
      }
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
      P.layers([
        [s / 2, (r[1] + r[3]) / 2, function () {
          box(ctx, r, 0, 1.1, ['#7a5334', '#5f4029', '#6f4b2f']);
          onLeft(ctx, r[3], 0.5, s - 0.5, 0, 0.85, '#2b211b');
          gable(ctx, [0.08, 0.08, s - 0.08, s - 0.78], 1.1, 0.7, c.color, c.dark, '#5f4029');
        }],
        [s / 2, s - 0.42, function () {
          box(ctx, [0.6, s - 0.55, s - 0.6, s - 0.3], 0.1, 0.35, ['#8a5f3c', '#6f4b2f', '#9c6b45']);
          [0.7, s - 0.7].forEach(function (u) {
            var p = at(u, s - 0.3, 0.1);
            D.disc(ctx, p[0], p[1], 0.14, 0.14, '#4a3220');
          });
        }]
      ]);
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

  // 依擁有者的文明與朝向畫完工建築；axis 只有城門用到。石牆各向相同、城門由 axis 決定方向，都不旋轉
  function draw(ctx, type, s, c, e, civ, axis, dir) {
    var def = RTS.data.buildings[type];
    style = RTS.civStyle.of(civ);
    P.withTurn(def.line || def.gate ? 0 : dir || 0, s, function () { buildings[type](ctx, s, c, e, axis); });
    style = null;
  }

  RTS.sprites.buildings = buildings;
  RTS.sprites.kit = { box: box, gable: gable, spire: spire, flag: flag, plot: plot };
  RTS.sprites.building = draw;
  RTS.sprites.construction = construction;
})();
