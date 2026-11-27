// 經濟建築的向量圖形：伐木場、採礦營地、磨坊、農田、牲畜圈、市場。
// 畫法與座標同 sprites-buildings.js，共用零件由 RTS.sprites.kit 與 sprites-parts.js 提供。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var D = RTS.sprites.draw, P = RTS.sprites.parts, K = RTS.sprites.kit;
  var at = P.at, face = P.face, edge = P.edge, onLeft = P.onLeft;
  var box = K.box, gable = K.gable, spire = K.spire, flag = K.flag, plot = K.plot;

  Object.assign(RTS.sprites.buildings, {
    lumberCamp: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      // 單坡棚子：後高前低，前方堆木頭
      var r = [0.2, 0.2, s - 0.2, s - 0.75];
      P.layers([
        [s / 2, (r[1] + r[3]) / 2, function () {
          box(ctx, r, 0, 0.75, ['#7a5334', '#5f4029', '#6f4b2f']);
          // 轉向後補上屋頂下看得到的牆面，高的一邊朝向鏡頭時才不會鏤空
          if (!P.front()) {
            face(ctx, [[r[0], r[1], 0.75], [r[2], r[1], 0.75], [r[2], r[1], 1.0], [r[0], r[1], 1.0]], '#5f4029');
          }
          if (!P.front() || !P.side()) {
            var u = P.side() ? r[2] : r[0];
            face(ctx, [[u, r[1], 0.75], [u, r[3], 0.75], [u, r[1], 1.0]], '#6f4b2f');
          }
          face(ctx, [[0.08, 0.08, 1.05], [s - 0.08, 0.08, 1.05], [s - 0.08, s - 0.6, 0.75], [0.08, s - 0.6, 0.75]], c.color);
          var e = P.side() ? s - 0.08 : 0.08;
          face(ctx, [[e, 0.08, 1.05], [e, s - 0.6, 0.75], [e, s - 0.6, 0.65], [e, 0.08, 0.95]], c.dark);
        }],
        // 屋前的木頭堆
        [s / 2, s - 0.35, function () {
          [[0.35, 0], [0.75, 0], [1.15, 0], [0.55, 0.22], [0.95, 0.22]].forEach(function (l) {
            var p = at(l[0] + 0.1, s - 0.35, 0.12 + l[1]);
            D.disc(ctx, p[0], p[1], 0.17, 0.12, '#a87a4a');
            D.disc(ctx, p[0], p[1], 0.08, 0.06, '#d9b07a', false);
          });
        }]
      ]);
    },
    miningCamp: function (ctx, s, c) {
      plot(ctx, s, '#7d7262');
      var r = [0.2, 0.2, s - 0.6, s - 0.2];
      P.layers([
        [(r[0] + r[2]) / 2, s / 2, function () {
          box(ctx, r, 0, 0.8, ['#8f8a82', '#716c65', '#807b73']);
          onLeft(ctx, r[3], 0.4, 0.8, 0, 0.55, '#2b211b');
          gable(ctx, [0.1, 0.1, s - 0.5, s - 0.1], 0.8, 0.5, c.color, c.dark, '#716c65');
        }],
        // 側邊的礦車，載著石塊與金塊
        [s - 0.29, 0.85, function () {
          box(ctx, [s - 0.5, 0.5, s - 0.08, 1.2], 0.1, 0.42, ['#5c4326', '#4a3220', '#3a2618']);
          [[0.62, '#9aa0a6'], [0.85, '#ffd84a'], [1.05, '#9aa0a6']].forEach(function (g) {
            var p = at(s - 0.3, g[0], 0.48);
            D.disc(ctx, p[0], p[1], 0.11, 0.08, g[1]);
          });
        }]
      ]);
    },
    mill: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      var r = [0.35, 0.35, s - 0.35, s - 0.35];
      function sails() {
        var hub = at(s / 2, s - 0.3, 1.25);
        [0.4, 1.97, 3.54, 5.11].forEach(function (a) {
          var x = hub[0] + Math.cos(a) * 0.85, y = hub[1] + Math.sin(a) * 0.85;
          D.line(ctx, [hub[0], hub[1], x, y], '#4a3220', 0.07);
          var nx = -Math.sin(a) * 0.14, ny = Math.cos(a) * 0.14;
          var mx = hub[0] + Math.cos(a) * 0.3, my = hub[1] + Math.sin(a) * 0.3;
          D.poly(ctx, [mx, my, x, y, x + nx, y + ny, mx + nx, my + ny], '#efe6cf');
        });
        D.disc(ctx, hub[0], hub[1], 0.08, 0.08, '#4a3220');
      }
      P.layers([
        [s / 2, s / 2, function () {
          box(ctx, r, 0, 1.0, ['#d6c29c', '#b39f7c', '#c4b08b']);
          onLeft(ctx, r[3], 0.7, 1.05, 0, 0.6, '#5a3d26');
          spire(ctx, [0.25, 0.25, s - 0.25, s - 0.25], 1.0, 0.8, c.color, c.dark);
        }],
        // 風車葉片：轉到背面時被屋身擋住
        [s / 2, s - 0.3, sails]
      ]);
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
      var m = 0.12, f = s - 0.12;
      // 水槽排在後側柵欄之後、前側柵欄之前
      var trough = [s / 2, s / 2, function () {
        box(ctx, [0.25, 0.25, 0.95, 0.55], 0, 0.22, ['#6f4b2f', '#5f4029', '#4f7fa8']);
      }];
      var fences = [[[m, m], [f, m]], [[m, m], [m, f]], [[m, f], [f, f]], [[f, m], [f, f]]].map(function (ends) {
        var a = ends[0], b = ends[1];
        return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, function () {
          edge(ctx, [a[0], a[1], 0.22], [b[0], b[1], 0.22], '#7a5334', 0.05);
          edge(ctx, [a[0], a[1], 0.42], [b[0], b[1], 0.42], '#7a5334', 0.05);
          for (var t = 0; t <= 1.001; t += 1 / 3) {
            var u = a[0] + (b[0] - a[0]) * t, v = a[1] + (b[1] - a[1]) * t;
            edge(ctx, [u, v, 0], [u, v, 0.52], '#5c4326', 0.07);
          }
        }];
      });
      P.layers([trough].concat(fences, [[f, f, function () { flag(ctx, f, f, 0.5, c.color); }]]));
    },
    market: function (ctx, s, c) {
      plot(ctx, s, '#8f815f');
      // 兩個攤位，條紋遮棚用己方顏色
      var stalls = [[0.25, 0.3, 1.35, 1.2], [1.55, 1.6, s - 0.25, s - 0.3]].map(function (r) {
        return [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2, function () { stall(r); }];
      });
      function stall(r) {
        box(ctx, [r[0], r[1], r[2], r[3]], 0, 0.5, ['#8a5f3c', '#6f4b2f', '#7a5334']);
        if (!P.front()) goods(r);
        [[r[0] + 0.05, r[3] - 0.05], [r[2] - 0.05, r[3] - 0.05], [r[2] - 0.05, r[1] + 0.05]].forEach(function (p) {
          edge(ctx, [p[0], p[1], 0.5], [p[0], p[1], 1.2], '#4a3220', 0.05);
        });
        var n = 4, w = (r[2] - r[0] + 0.2) / n;
        for (var i = 0; i < n; i++) {
          var u0 = r[0] - 0.1 + i * w;
          face(ctx, [[u0, r[1] - 0.1, 1.35], [u0 + w, r[1] - 0.1, 1.35], [u0 + w, r[3] + 0.15, 1.05], [u0, r[3] + 0.15, 1.05]],
            i % 2 ? '#efe6cf' : c.color);
        }
        if (P.front()) goods(r);
      }
      // 攤上的貨物：背向鏡頭時畫在遮棚之前，才會被遮住
      function goods(r) {
        [['#b8285a', 0.3], ['#ffd84a', 0.6], ['#9aa0a6', 0.9]].forEach(function (g) {
          var p = at(r[0] + g[1], r[3] - 0.2, 0.62);
          D.disc(ctx, p[0], p[1], 0.11, 0.08, g[0]);
        });
      }
      P.layers(stalls.concat([[s / 2, s / 2, function () { flag(ctx, s / 2, s / 2, 0.2, c.color); }]]));
    }
  });
})();
