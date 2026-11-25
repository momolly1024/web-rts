// 原創的 Canvas 向量圖形：天然物件、建築、單位。座標以「一格」為單位縮放。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var OUTLINE = '#1c1a17';

  function poly(ctx, pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke !== false) { ctx.strokeStyle = stroke || OUTLINE; ctx.stroke(); }
  }

  function disc(ctx, x, y, rx, ry, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke !== false) { ctx.strokeStyle = stroke || OUTLINE; ctx.stroke(); }
  }

  function line(ctx, pts, color, width) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.lineWidth = 1 / 36;
  }

  // 以下天然物件：原點在格子中心，單位為格
  var nodes = {
    tree: function (ctx, v) {
      disc(ctx, 0.05, 0.3, 0.38, 0.14, 'rgba(0,0,0,0.25)', false);
      poly(ctx, [-0.07, 0.35, -0.05, 0, 0.05, 0, 0.07, 0.35], '#6b4a2b');
      var g = v % 2 ? '#2f6b3a' : '#3b7a38';
      poly(ctx, [-0.46, 0.12, 0, -0.5, 0.46, 0.12], g);
      poly(ctx, [-0.36, -0.2, 0, -0.78, 0.36, -0.2], g);
    },
    berry: function (ctx) {
      disc(ctx, 0, 0.25, 0.42, 0.14, 'rgba(0,0,0,0.25)', false);
      disc(ctx, -0.17, 0.08, 0.25, 0.23, '#4f8a42');
      disc(ctx, 0.18, 0.1, 0.24, 0.22, '#4f8a42');
      disc(ctx, 0, -0.1, 0.27, 0.24, '#5c9a49');
      [[-0.22, 0.02], [0.02, -0.18], [0.2, 0.04], [-0.02, 0.14], [0.16, -0.08]].forEach(function (p) {
        disc(ctx, p[0], p[1], 0.065, 0.065, '#b8285a', false);
      });
    },
    gold: function (ctx) {
      disc(ctx, 0, 0.28, 0.45, 0.15, 'rgba(0,0,0,0.25)', false);
      poly(ctx, [-0.45, 0.28, -0.3, -0.12, -0.08, -0.3, 0.06, 0.02, 0, 0.32], '#8d8374');
      poly(ctx, [-0.08, 0.3, 0.1, -0.2, 0.34, -0.08, 0.46, 0.27], '#a59a87');
      poly(ctx, [-0.28, -0.04, -0.14, -0.2, -0.08, -0.02], '#f2c230');
      poly(ctx, [0.1, -0.08, 0.28, -0.02, 0.16, 0.1], '#ffd84a');
      poly(ctx, [-0.18, 0.12, -0.04, 0.1, -0.1, 0.24], '#f2c230');
    },
    rock: function (ctx, v) {
      disc(ctx, 0.03, 0.26, 0.45, 0.16, 'rgba(0,0,0,0.25)', false);
      var top = v % 2 ? -0.34 : -0.24;
      poly(ctx, [-0.46, 0.26, -0.34, -0.1, -0.06, top, 0.28, -0.16, 0.46, 0.24, 0.1, 0.36], '#7d8288');
      poly(ctx, [-0.34, -0.1, -0.06, top, 0.02, 0.02], '#9aa0a6', false);
    }
  };

  // 建築：原點在占地左上角，size 為邊長（格）
  function flag(ctx, x, y, color) {
    line(ctx, [x, y, x, y - 0.7], OUTLINE, 0.06);
    poly(ctx, [x, y - 0.7, x + 0.5, y - 0.57, x, y - 0.42], color);
  }

  var buildings = {
    townCenter: function (ctx, s, c) {
      poly(ctx, [0.2, 1.1, s - 0.2, 1.1, s - 0.2, s - 0.15, 0.2, s - 0.15], '#a8a39a');
      [0.08, s - 0.78].forEach(function (x) {
        poly(ctx, [x, 0.55, x + 0.7, 0.55, x + 0.7, s - 0.1, x, s - 0.1], '#bdb7ac');
        poly(ctx, [x - 0.06, 0.55, x + 0.35, -0.05, x + 0.76, 0.55], c.color);
      });
      poly(ctx, [0.7, 1.15, s / 2, 0.25, s - 0.7, 1.15], c.dark);
      poly(ctx, [s / 2 - 0.35, s - 0.15, s / 2 - 0.35, s - 0.8, s / 2, s - 1.05,
                 s / 2 + 0.35, s - 0.8, s / 2 + 0.35, s - 0.15], '#4a3220');
      flag(ctx, s / 2, 0.28, c.color);
    },
    house: function (ctx, s, c) {
      poly(ctx, [0.2, 0.95, s - 0.2, 0.95, s - 0.2, s - 0.14, 0.2, s - 0.14], '#d6c29c');
      poly(ctx, [0.06, 1.0, 0.45, 0.2, s - 0.45, 0.2, s - 0.06, 1.0], c.color);
      line(ctx, [0.28, 0.6, s - 0.28, 0.6], c.dark, 0.07);
      poly(ctx, [0.8, s - 0.14, 0.8, 1.25, 1.2, 1.25, 1.2, s - 0.14], '#5a3d26');
      poly(ctx, [0.35, 1.2, 0.62, 1.2, 0.62, 1.45, 0.35, 1.45], '#3a4a5c');
    },
    barracks: function (ctx, s, c) {
      poly(ctx, [0.15, 1.0, s - 0.15, 1.0, s - 0.15, s - 0.15, 0.15, s - 0.15], '#8a5f3c');
      for (var x = 0.5; x < s - 0.3; x += 0.4) line(ctx, [x, 1.02, x, s - 0.17], '#6a4529', 0.05);
      poly(ctx, [0.04, 1.08, 0.35, 0.3, s - 0.35, 0.3, s - 0.04, 1.08], '#4d4a46');
      poly(ctx, [s / 2 - 0.42, 0.95, s / 2 + 0.42, 0.95, s / 2 + 0.42, 1.55, s / 2, 1.85,
                 s / 2 - 0.42, 1.55], c.color);
      line(ctx, [s / 2 - 0.25, 1.1, s / 2 + 0.25, 1.6], '#e8e2d0', 0.08);
      line(ctx, [s / 2 + 0.25, 1.1, s / 2 - 0.25, 1.6], '#e8e2d0', 0.08);
      poly(ctx, [0.35, s - 0.15, 0.35, s - 0.85, 0.85, s - 0.85, 0.85, s - 0.15], '#33251a');
      flag(ctx, s - 0.55, 0.32, c.color);
    }
  };

  function construction(ctx, s, progress) {
    poly(ctx, [0.15, 0.15, s - 0.15, 0.15, s - 0.15, s - 0.15, 0.15, s - 0.15], '#9b7f58');
    var h = (s - 0.5) * progress;
    poly(ctx, [0.35, s - 0.25 - h, s - 0.35, s - 0.25 - h, s - 0.35, s - 0.25, 0.35, s - 0.25], '#c3ad84');
    [0.25, s / 2, s - 0.25].forEach(function (x) { line(ctx, [x, 0.2, x, s - 0.2], '#5c4326', 0.09); });
    line(ctx, [0.25, 0.4, s - 0.25, s - 0.4], '#5c4326', 0.06);
  }

  // 單位：原點在腳下。swing > 0 時揮動手上的工具
  function body(ctx, c, tunic) {
    disc(ctx, 0, 0.16, 0.24, 0.09, 'rgba(0,0,0,0.3)', false);
    poly(ctx, [-0.2, 0.16, -0.13, -0.2, 0.13, -0.2, 0.2, 0.16], tunic);
    disc(ctx, 0, -0.32, 0.13, 0.13, '#e5b98f');
  }

  var units = {
    villager: function (ctx, c, swing, carry) {
      body(ctx, c, c.color);
      poly(ctx, [-0.2, -0.37, 0, -0.54, 0.2, -0.37], '#c9a24a');
      var a = swing > 0 ? Math.sin(swing * 21) * 0.18 : 0;
      line(ctx, [0.13, -0.02, 0.32, -0.28 + a], '#6b4a2b', 0.06);
      poly(ctx, [0.24, -0.34 + a, 0.42, -0.3 + a, 0.34, -0.2 + a], '#9aa0a6');
      if (carry) {
        var col = { food: '#b8285a', wood: '#8a5f3c', gold: '#ffd84a' }[carry];
        disc(ctx, -0.22, -0.1, 0.1, 0.1, col);
      }
    },
    swordsman: function (ctx, c, swing) {
      body(ctx, c, c.dark);
      disc(ctx, 0, -0.38, 0.15, 0.11, '#aeb6bf');
      line(ctx, [0, -0.5, 0, -0.62], c.color, 0.09);
      var a = swing > 0 ? 0.22 : 0;
      line(ctx, [0.15, -0.02, 0.3 + a, -0.48 + a * 1.4], '#e4e8ec', 0.07);
      line(ctx, [0.09, -0.06, 0.24, 0.02], '#4a3220', 0.07);
      poly(ctx, [-0.34, -0.18, -0.08, -0.18, -0.08, 0.04, -0.21, 0.14, -0.34, 0.04], c.color);
    },
    archer: function (ctx, c, swing) {
      body(ctx, c, '#4f6b3a');
      poly(ctx, [-0.18, -0.28, 0, -0.55, 0.18, -0.28, 0, -0.4], c.color);
      line(ctx, [-0.13, -0.13, 0.13, 0.04], c.color, 0.09);
      ctx.beginPath();
      ctx.arc(0.17, -0.1, 0.3, -1.25, 1.25);
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 0.07;
      ctx.stroke();
      ctx.lineWidth = 1 / 36;
      var pull = swing > 0 ? 0.26 : 0.1;
      line(ctx, [0.27, -0.38, pull, -0.1, 0.27, 0.18], '#e8e2d0', 0.025);
    }
  };

  RTS.sprites = { nodes: nodes, buildings: buildings, construction: construction, units: units };
})();
