// 原創的 Canvas 向量圖形：天然物件、單位（建築見 sprites-buildings.js）。座標以「一格」為單位縮放。
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
    // 石材：灰色岩石（金礦帶黃色亮點，一眼可分）
    rock: function (ctx, v) {
      disc(ctx, 0.03, 0.26, 0.45, 0.16, 'rgba(0,0,0,0.25)', false);
      var top = v % 2 ? -0.34 : -0.24;
      poly(ctx, [-0.46, 0.26, -0.34, -0.1, -0.06, top, 0.28, -0.16, 0.46, 0.24, 0.1, 0.36], '#7d8288');
      poly(ctx, [-0.34, -0.1, -0.06, top, 0.02, 0.02], '#9aa0a6', false);
    }
  };

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
        var col = { food: '#b8285a', wood: '#8a5f3c', gold: '#ffd84a', stone: '#9aa0a6' }[carry];
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
    // 長槍兵：圓盾加長槍，攻擊時槍尖往前刺
    spearman: function (ctx, c, swing) {
      body(ctx, c, '#7a6a4a');
      disc(ctx, 0, -0.38, 0.14, 0.1, '#8f8a82');
      var a = swing > 0 ? 0.16 : 0;
      line(ctx, [-0.05 + a, 0.12, 0.3 + a, -0.78], '#6b4a2b', 0.05);
      poly(ctx, [0.3 + a, -0.78, 0.26 + a, -0.64, 0.36 + a, -0.66], '#e4e8ec');
      disc(ctx, -0.22, -0.06, 0.14, 0.17, c.color);
      disc(ctx, -0.22, -0.06, 0.05, 0.06, '#e8e2d0', false);
    },
    // 騎兵：馬身加騎士，原點在馬腳下
    cavalry: function (ctx, c, swing) {
      disc(ctx, 0, 0.18, 0.42, 0.1, 'rgba(0,0,0,0.3)', false);
      [-0.28, -0.14, 0.16, 0.3].forEach(function (x) { line(ctx, [x, -0.06, x, 0.17], '#4a3220', 0.06); });
      disc(ctx, 0, -0.12, 0.38, 0.15, '#8a5a32');
      poly(ctx, [0.28, -0.2, 0.42, -0.48, 0.56, -0.44, 0.44, -0.14], '#8a5a32');
      poly(ctx, [-0.12, -0.24, 0.12, -0.24, 0.1, -0.08, -0.1, -0.08], c.color);
      poly(ctx, [-0.08, -0.24, -0.06, -0.52, 0.08, -0.52, 0.1, -0.24], c.dark);
      disc(ctx, 0.01, -0.6, 0.11, 0.1, '#aeb6bf');
      var a = swing > 0 ? 0.2 : 0;
      line(ctx, [0.06, -0.38, 0.4 + a, -0.62 + a], '#e4e8ec', 0.06);
      line(ctx, [-0.38, -0.14, -0.48, 0.02], '#3a2618', 0.06);
    },
    // 治療者：長袍、兜帽、手杖，杖頭發光
    healer: function (ctx, c, swing) {
      disc(ctx, 0, 0.16, 0.24, 0.09, 'rgba(0,0,0,0.3)', false);
      poly(ctx, [-0.22, 0.16, -0.12, -0.24, 0.12, -0.24, 0.22, 0.16], '#efe6cf');
      line(ctx, [-0.12, -0.05, 0.12, -0.05], c.color, 0.06);
      disc(ctx, 0, -0.32, 0.13, 0.13, '#e5b98f');
      poly(ctx, [-0.15, -0.3, 0, -0.5, 0.15, -0.3, 0, -0.38], '#d6ccb2');
      line(ctx, [0.22, 0.14, 0.26, -0.55], '#6b4a2b', 0.05);
      disc(ctx, 0.26, -0.6, swing > 0 ? 0.1 : 0.07, swing > 0 ? 0.1 : 0.07, '#9cf27a');
    },
    // 攻城槌：有頂棚的木車，前端是包鐵的撞木
    ram: function (ctx, c, swing) {
      disc(ctx, 0, 0.2, 0.55, 0.13, 'rgba(0,0,0,0.3)', false);
      var a = swing > 0 ? 0.12 : 0;
      poly(ctx, [-0.2 + a, -0.18, 0.62 + a, -0.18, 0.62 + a, -0.06, -0.2 + a, -0.06], '#8a5f3c');
      poly(ctx, [0.6 + a, -0.22, 0.72 + a, -0.12, 0.6 + a, -0.02], '#9aa0a6');
      poly(ctx, [-0.5, 0.08, 0.45, 0.08, 0.35, -0.42, -0.4, -0.42], '#6f4b2f');
      poly(ctx, [-0.55, -0.4, 0.5, -0.4, 0.3, -0.62, -0.35, -0.62], c.color);
      [-0.32, 0.28].forEach(function (x) { disc(ctx, x, 0.1, 0.12, 0.12, '#4a3220'); });
    },
    // 標槍兵：輕裝、背著一束標槍，攻擊時把標槍舉過肩
    skirmisher: function (ctx, c, swing) {
      body(ctx, c, '#8a6a3a');
      line(ctx, [-0.13, -0.13, 0.13, 0.04], c.color, 0.09);
      [-0.2, -0.15, -0.1].forEach(function (x) { line(ctx, [x, 0.05, x - 0.06, -0.55], '#6b4a2b', 0.03); });
      var a = swing > 0 ? 0.2 : 0;
      line(ctx, [0.12, -0.1 - a, 0.42, -0.5 - a], '#6b4a2b', 0.04);
      poly(ctx, [0.42, -0.5 - a, 0.38, -0.42 - a, 0.47, -0.43 - a], '#e4e8ec');
    },
    longbowman: function (ctx, c, swing) {
      body(ctx, c, '#3e5a2c');
      poly(ctx, [-0.18, -0.26, 0, -0.6, 0.18, -0.26, 0, -0.4], '#2f4a22');
      line(ctx, [-0.13, -0.13, 0.13, 0.04], c.color, 0.09);
      ctx.beginPath();
      ctx.arc(0.12, -0.12, 0.42, -1.3, 1.3);
      ctx.strokeStyle = '#5c3d22';
      ctx.lineWidth = 0.07;
      ctx.stroke();
      ctx.lineWidth = 1 / 36;
      var pull = swing > 0 ? 0.3 : 0.12;
      line(ctx, [0.23, -0.52, pull, -0.12, 0.23, 0.28], '#e8e2d0', 0.025);
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

  // 游獵手：綠斗篷、短弓、背後箭袋
  units.ranger = function (ctx, c, swing) {
    disc(ctx, 0, 0.16, 0.24, 0.09, 'rgba(0,0,0,0.3)', false);
    poly(ctx, [-0.32, 0.12, -0.1, -0.26, 0.04, -0.2, -0.08, 0.14], '#2f6b3a');
    body(ctx, c, '#5a7a3a');
    poly(ctx, [-0.2, -0.28, 0.02, -0.56, 0.2, -0.32, 0, -0.4], '#2f6b3a');
    line(ctx, [0.02, -0.52, -0.16, -0.7], '#e8503c', 0.05);
    line(ctx, [-0.13, -0.13, 0.13, 0.04], c.color, 0.09);
    ctx.beginPath();
    ctx.arc(0.18, -0.08, 0.26, -1.25, 1.25);
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 0.07;
    ctx.stroke();
    ctx.lineWidth = 1 / 36;
    var pull = swing > 0 ? 0.24 : 0.1;
    line(ctx, [0.26, -0.33, pull, -0.08, 0.26, 0.17], '#e8e2d0', 0.025);
  };

  // 岩衛：全身鐵甲、大塔盾、戰鎚
  units.stoneguard = function (ctx, c, swing) {
    disc(ctx, 0, 0.18, 0.32, 0.1, 'rgba(0,0,0,0.3)', false);
    poly(ctx, [-0.24, 0.18, -0.17, -0.24, 0.17, -0.24, 0.24, 0.18], '#7e8893');
    disc(ctx, 0, -0.36, 0.17, 0.15, '#9aa4ae');
    line(ctx, [-0.09, -0.36, 0.11, -0.36], '#1c1a17', 0.05);
    poly(ctx, [-0.08, -0.5, 0, -0.62, 0.08, -0.5], c.color);
    var a = swing > 0 ? 0.2 : 0;
    line(ctx, [0.18, 0.02, 0.34 + a, -0.4 + a], '#4a3220', 0.07);
    poly(ctx, [0.22 + a, -0.52 + a, 0.48 + a, -0.46 + a, 0.44 + a, -0.3 + a, 0.18 + a, -0.36 + a], '#545b63');
    poly(ctx, [-0.42, -0.3, -0.06, -0.3, -0.06, 0.12, -0.24, 0.24, -0.42, 0.12], c.color);
    line(ctx, [-0.24, -0.24, -0.24, 0.14], '#c9ced4', 0.05);
  };

  // 槍騎兵：淺色馬、金色鞍布、平舉長槍
  units.lancer = function (ctx, c, swing) {
    disc(ctx, 0, 0.18, 0.42, 0.1, 'rgba(0,0,0,0.3)', false);
    [-0.28, -0.14, 0.16, 0.3].forEach(function (x) { line(ctx, [x, -0.06, x, 0.17], '#8a6a3a', 0.055); });
    disc(ctx, 0, -0.12, 0.37, 0.14, '#d9b878');
    poly(ctx, [0.27, -0.2, 0.42, -0.48, 0.56, -0.44, 0.43, -0.14], '#d9b878');
    poly(ctx, [-0.18, -0.25, 0.16, -0.25, 0.14, -0.02, -0.16, -0.02], '#d9b44a');
    poly(ctx, [-0.08, -0.24, -0.06, -0.52, 0.08, -0.52, 0.1, -0.24], c.color);
    disc(ctx, 0.01, -0.6, 0.1, 0.09, '#e5b98f');
    poly(ctx, [-0.14, -0.62, 0.01, -0.76, 0.16, -0.62], '#d9b44a');
    var a = swing > 0 ? 0.22 : 0;
    line(ctx, [-0.3 + a, -0.3, 0.72 + a, -0.5], '#6b4a2b', 0.05);
    poly(ctx, [0.72 + a, -0.5, 0.64 + a, -0.55, 0.86 + a, -0.53, 0.66 + a, -0.43], '#e4e8ec');
    poly(ctx, [0.46 + a, -0.46, 0.34 + a, -0.34, 0.54 + a, -0.47], c.color);
    line(ctx, [-0.37, -0.14, -0.48, 0.02], '#8a6a3a', 0.06);
  };

  RTS.sprites = { nodes: nodes, units: units, draw: { poly: poly, disc: disc, line: line } };
})();
