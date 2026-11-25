// 原創向量圖形：動物（原點在腳下，單位為格）與獸肉。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function disc(ctx, x, y, rx, ry, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke !== false) { ctx.strokeStyle = '#1c1a17'; ctx.stroke(); }
  }

  function legs(ctx, xs, top, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.06;
    xs.forEach(function (x) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, 0.18);
      ctx.stroke();
    });
    ctx.lineWidth = 1 / 36;
  }

  // collar：已認領時掛上主人顏色的項圈
  var animals = {
    sheep: function (ctx, collar) {
      disc(ctx, 0, 0.18, 0.3, 0.09, 'rgba(0,0,0,0.25)', false);
      legs(ctx, [-0.15, 0.12], 0.02, '#3a322c');
      disc(ctx, -0.02, -0.06, 0.3, 0.2, '#ecebe4');
      disc(ctx, 0.27, -0.16, 0.12, 0.11, '#4a403a');
      if (collar) disc(ctx, 0.19, -0.06, 0.07, 0.07, collar);
    },
    deer: function (ctx) {
      disc(ctx, 0, 0.18, 0.32, 0.09, 'rgba(0,0,0,0.25)', false);
      legs(ctx, [-0.18, -0.08, 0.1, 0.19], -0.04, '#6e4a2c');
      disc(ctx, -0.02, -0.12, 0.28, 0.14, '#b07a45');
      disc(ctx, 0.27, -0.34, 0.11, 0.1, '#bd8a52');
      disc(ctx, -0.28, -0.16, 0.06, 0.06, '#f0e6d2', false);
      ctx.strokeStyle = '#5a3d24';
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.moveTo(0.25, -0.42); ctx.lineTo(0.18, -0.62); ctx.lineTo(0.08, -0.62);
      ctx.moveTo(0.31, -0.42); ctx.lineTo(0.38, -0.65); ctx.lineTo(0.48, -0.62);
      ctx.stroke();
      ctx.lineWidth = 1 / 36;
    },
    boar: function (ctx) {
      disc(ctx, 0, 0.18, 0.38, 0.11, 'rgba(0,0,0,0.3)', false);
      legs(ctx, [-0.2, -0.08, 0.12, 0.22], 0, '#241c17');
      disc(ctx, -0.05, -0.1, 0.34, 0.23, '#54413a');
      disc(ctx, 0.26, -0.04, 0.17, 0.14, '#463530');
      disc(ctx, 0.4, 0, 0.07, 0.06, '#8a6a62');
      disc(ctx, 0.34, 0.07, 0.03, 0.07, '#f4ecd8', false);
      disc(ctx, 0.26, -0.1, 0.025, 0.025, '#ffb347', false);
    }
  };

  RTS.sprites.animals = animals;
  RTS.sprites.nodes.carcass = function (ctx) {
    disc(ctx, 0, 0.22, 0.42, 0.14, 'rgba(0,0,0,0.25)', false);
    disc(ctx, -0.08, 0.08, 0.28, 0.17, '#8c4a3c');
    disc(ctx, 0.16, 0.14, 0.2, 0.12, '#a75a48');
    disc(ctx, 0.08, 0.02, 0.09, 0.05, '#f0e6d2');
  };
})();
