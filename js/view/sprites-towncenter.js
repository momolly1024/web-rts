// 主堡圖形：依擁有者的時代換樣式。黑暗＝木造大廳與木瞭望台、封建＝石造大廳與一座角樓、
// 城堡＝石鋪地、高主樓加兩座側塔。座標與轉向同 sprites-buildings.js，正門前不放會遮擋的東西。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var P = RTS.sprites.parts, K = RTS.sprites.kit;
  var edge = P.edge, onLeft = P.onLeft, onRight = P.onRight;

  var WOOD = ['#a9794c', '#80592f', '#94693f'];
  var STONE = ['#d3cdc1', '#a8a297', '#a8a39a'];
  var KEEP = ['#c9c3b8', '#a8a297', '#a8a39a'];
  var DARK_STONE = ['#8d877d', '#77726a', '#bdb7ac'];
  var GOLD = '#ffd84a', WINDOW = '#3a4a5c';

  // 木料維持原色（不套文明牆面色調），黑暗時代在每個文明都看得出是木造
  function timber(ctx, r, z0, z1) {
    P.upright(r, function (w) {
      onLeft(ctx, w[3], w[0], w[2], z0, z1, WOOD[0]);
      onRight(ctx, w[2], w[1], w[3], z0, z1, WOOD[1]);
      P.face(ctx, [[w[0], w[1], z1], [w[2], w[1], z1], [w[2], w[3], z1], [w[0], w[3], z1]], WOOD[2]);
    });
  }

  // 黑暗時代：柱子撐起的木瞭望台
  function lookout(ctx, c) {
    var a = 0.22, b = 1.02;
    [[a, a], [b, a], [a, b]].forEach(function (p) { edge(ctx, [p[0], p[1], 0], [p[0], p[1], 2.05], '#5c4326', 0.1); });
    edge(ctx, [a, b, 0.2], [b, b, 1.4], '#5c4326', 0.06);
    edge(ctx, [b, b, 0.2], [b, a, 1.4], '#5c4326', 0.06);
    edge(ctx, [b, b, 0], [b, b, 1.5], '#5c4326', 0.1);
    timber(ctx, [0.14, 0.14, 1.1, 1.1], 1.45, 1.65);
    edge(ctx, [b, b, 1.65], [b, b, 2.05], '#5c4326', 0.1);
    K.spire(ctx, [0.1, 0.1, 1.14, 1.14], 2.05, 0.45, c.color, c.dark);
    K.flag(ctx, 0.62, 0.62, 2.45, c.color);
  }

  function dark(ctx, s, c) {
    K.plot(ctx, s, '#8f815f');
    var hall = [0.4, 0.85, s - 0.25, s - 0.5];
    var v = hall[3], mid = (hall[0] + hall[2]) / 2;
    P.layers([
      [0.62, 0.62, function () { lookout(ctx, c); }, 0.5],
      [mid, (hall[1] + v) / 2, function () {
        timber(ctx, hall, 0, 0.8);
        for (var u = hall[0] + 0.25; P.front() && u < hall[2] - 0.1; u += 0.3) {
          edge(ctx, [u, v, 0.03], [u, v, 0.77], '#6a4529', 0.04);
        }
        K.gable(ctx, [0.28, 0.73, s - 0.13, s - 0.38], 0.8, 0.6, c.color, c.dark, '#94693f');
        onLeft(ctx, v, mid - 0.3, mid + 0.3, 0, 0.62, '#33251a');
        onRight(ctx, hall[2], (hall[1] + v) / 2 - 0.17, (hall[1] + v) / 2 + 0.17, 0.3, 0.58, '#33251a');
      }]
    ]);
  }

  // 石造大廳：石框雙扇木門與山牆面的窗
  function stoneHall(ctx, c, hall, height, rise) {
    var v = hall[3], mid = (hall[0] + hall[2]) / 2, side = (hall[1] + v) / 2;
    K.box(ctx, hall, 0, height, STONE);
    K.gable(ctx, [hall[0] - 0.12, hall[1] - 0.12, hall[2] + 0.12, v + 0.12], height, rise, c.color, c.dark, '#bdb7ac');
    onLeft(ctx, v, mid - 0.5, mid + 0.5, 0, 0.98, '#8d877d');
    onLeft(ctx, v, mid - 0.38, mid + 0.38, 0, 0.86, '#4a3220');
    if (P.front()) edge(ctx, [mid, v, 0], [mid, v, 0.86], '#2b1d12', 0.05);
    onRight(ctx, hall[2], side - 0.2, side + 0.2, 0.4, 0.8, WINDOW);
  }

  function steps(ctx, mid, v) {
    return [mid, v + 0.14, function () { K.box(ctx, [mid - 0.55, v, mid + 0.55, v + 0.28], 0, 0.08, DARK_STONE); }];
  }

  function feudal(ctx, s, c) {
    K.plot(ctx, s, '#8f815f');
    var hall = [0.4, 0.75, s - 0.2, s - 0.5];
    var v = hall[3], mid = (hall[0] + hall[2]) / 2;
    P.layers([
      // 深度微調：轉向後角樓與大廳深度相近時，角樓畫在上面
      [0.62, 0.62, function () {
        K.box(ctx, [0.12, 0.12, 1.12, 1.12], 0, 2.2, KEEP);
        K.spire(ctx, [0.03, 0.03, 1.21, 1.21], 2.2, 0.75, c.color, c.dark);
        K.flag(ctx, 0.62, 0.62, 2.95, c.color);
      }, 0.5],
      [mid, (hall[1] + v) / 2, function () {
        stoneHall(ctx, c, hall, 1.15, 0.85);
        [mid - 0.88, mid + 0.66].forEach(function (u) { onLeft(ctx, v, u, u + 0.22, 0.4, 0.75, WINDOW); });
      }],
      steps(ctx, mid, v)
    ]);
  }

  // 方塔頂端外擴的石台與四角垛口
  function crown(ctx, r, z) {
    var o = [r[0] - 0.08, r[1] - 0.08, r[2] + 0.08, r[3] + 0.08];
    K.box(ctx, o, z, z + 0.2, DARK_STONE);
    P.upright(o, function (w) {
      [[w[0], w[1]], [w[2] - 0.18, w[1]], [w[0], w[3] - 0.18], [w[2] - 0.18, w[3] - 0.18]].forEach(function (p) {
        K.box(ctx, [p[0], p[1], p[0] + 0.18, p[1] + 0.18], z + 0.2, z + 0.4, KEEP);
      });
    });
  }

  function sideTower(ctx, r, c) {
    var u = (r[0] + r[2]) / 2, v = (r[1] + r[3]) / 2;
    K.box(ctx, r, 0, 1.75, KEEP);
    onLeft(ctx, r[3], u - 0.08, u + 0.08, 1.15, 1.5, WINDOW);
    onRight(ctx, r[2], v - 0.08, v + 0.08, 1.15, 1.5, WINDOW);
    crown(ctx, r, 1.75);
    K.spire(ctx, [r[0] + 0.06, r[1] + 0.06, r[2] - 0.06, r[3] - 0.06], 2.15, 0.65, c.color, c.dark);
  }

  function castle(ctx, s, c) {
    K.plot(ctx, s, '#aaa496');
    var hall = [0.85, 0.85, s - 0.2, s - 0.5];
    var v = hall[3], mid = (hall[0] + hall[2]) / 2;
    var keep = [0.15, 0.15, 1.2, 1.2];
    P.layers([
      [0.67, 0.67, function () {
        K.box(ctx, keep, 0, 2.7, KEEP);
        onLeft(ctx, keep[3], 0.55, 0.78, 1.95, 2.35, WINDOW);
        onRight(ctx, keep[2], 0.55, 0.78, 1.95, 2.35, WINDOW);
        crown(ctx, keep, 2.7);
        K.spire(ctx, [0.2, 0.2, 1.15, 1.15], 3.1, 0.9, c.color, c.dark);
        K.flag(ctx, 0.67, 0.67, 3.95, c.color);
      }, 0.5],
      [s - 0.47, 0.45, function () { sideTower(ctx, [s - 0.8, 0.12, s - 0.15, 0.77], c); }],
      [0.45, s - 0.47, function () { sideTower(ctx, [0.12, s - 0.8, 0.77, s - 0.15], c); }],
      [mid, (hall[1] + v) / 2, function () {
        stoneHall(ctx, c, hall, 1.35, 0.9);
        // 門楣金飾與兩側鑲金邊的隊旗
        onLeft(ctx, v, mid - 0.56, mid + 0.56, 0.98, 1.1, GOLD);
        [mid - 0.82, mid + 0.6].forEach(function (u) {
          onLeft(ctx, v, u, u + 0.22, 0.3, 1.12, GOLD);
          onLeft(ctx, v, u + 0.04, u + 0.18, 0.36, 1.08, c.color);
        });
      }],
      steps(ctx, mid, v)
    ]);
  }

  var STYLES = [dark, feudal, castle];

  // age 是擁有者的時代（0 起算）；沒給視為黑暗時代
  RTS.sprites.buildings.townCenter = function (ctx, s, c, e, axis, age) {
    STYLES[Math.min(age || 0, STYLES.length - 1)](ctx, s, c);
  };
})();
