// 釣魚的畫面：釣竿、釣線、浮標、上鉤提示與收穫動畫。只讀取世界狀態。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var OUT = '#1c1a17';
  var FISH = {
    small: { size: 0.17, body: '#9fd0e8' },
    big: { size: 0.32, body: '#5f8fb8' },
    golden: { size: 0.36, body: '#ffd84a' }
  };

  function isCasting(e) {
    return e.kind === 'unit' && e.order.type === 'fish' && e.order.casting;
  }

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  }

  function line(ctx, a, b, color, width, sag) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    if (sag) ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag, b.x, b.y);
    else ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function label(ctx, text, x, y, size, color) {
    ctx.font = 'bold ' + Math.max(11, size) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUT;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  // 拋竿中的村民：快上鉤時浮標亂跳、竿子彎下去、頭上冒驚嘆號
  function rod(ctx, cam, u, time) {
    if (!isCasting(u)) return;
    var o = u.order, s = cam.scale;
    var bite = o.timer > 0 && o.timer <= RTS.data.fishing.bite;
    var p = RTS.camera.worldToScreen(cam, u.x, u.y);
    // 浮標落在水格中靠岸的位置
    var water = RTS.camera.worldToScreen(cam, o.wx + 0.5 + (u.x - o.wx - 0.5) * 0.2,
      o.wy + 0.5 + (u.y - o.wy - 0.5) * 0.2);
    var phase = time * (bite ? 22 : 2.5) + u.id;
    var bob = { x: water.x, y: water.y + Math.sin(phase) * s * (bite ? 0.09 : 0.025) };
    var hand = { x: p.x + u.facing * s * 0.13, y: p.y - s * 0.04 };
    var tip = { x: hand.x + u.facing * s * 0.5, y: hand.y - s * (bite ? 0.34 : 0.62) };
    ctx.save();
    ctx.lineCap = 'round';
    line(ctx, hand, tip, '#6b4a2b', Math.max(1.5, s * 0.06));
    line(ctx, tip, bob, 'rgba(240,240,230,0.9)', 1, bite ? 0 : s * 0.22);
    var ring = (time * (bite ? 2.4 : 0.6) + u.id * 0.37) % 1;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(225,244,255,' + (0.8 * (1 - ring)) + ')';
    ellipse(ctx, water.x, water.y + s * 0.04, s * (0.08 + ring * 0.3), s * (0.04 + ring * 0.15));
    ctx.stroke();
    ctx.fillStyle = '#e8503c';
    ellipse(ctx, bob.x, bob.y, s * 0.07, s * 0.07);
    ctx.fill();
    ctx.fillStyle = '#f4f1e6';
    ellipse(ctx, bob.x, bob.y - s * 0.05, s * 0.045, s * 0.035);
    ctx.fill();
    if (bite) label(ctx, '!', p.x, p.y - s * (1.05 + Math.abs(Math.sin(time * 9)) * 0.15), s * 0.55, '#ffd84a');
    ctx.restore();
  }

  function fishShape(ctx, size, color, flap) {
    ctx.fillStyle = color;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1;
    ellipse(ctx, 0, 0, size, size * 0.52);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.85, 0);
    ctx.lineTo(-size * 1.6, -size * (0.5 + flap));
    ctx.lineTo(-size * 1.6, size * (0.5 - flap));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = OUT;
    ellipse(ctx, size * 0.5, -size * 0.1, size * 0.1, size * 0.1);
    ctx.fill();
  }

  function bootShape(ctx, size) {
    ctx.beginPath();
    [[-0.5, -1], [0.2, -1], [0.2, -0.1], [1, 0.15], [1, 0.7], [-0.5, 0.7]].forEach(function (p, i) {
      if (i) ctx.lineTo(p[0] * size, p[1] * size);
      else ctx.moveTo(p[0] * size, p[1] * size);
    });
    ctx.closePath();
    ctx.fillStyle = '#6f4b2f';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function splash(ctx, at, s, t) {
    ctx.fillStyle = 'rgba(225,244,255,' + (1 - t) + ')';
    for (var i = -2; i <= 2; i++) {
      var up = s * (0.5 - Math.abs(i) * 0.1) * Math.sin(t * Math.PI);
      ellipse(ctx, at.x + i * s * 0.18 * t, at.y - up, s * 0.045, s * 0.06);
      ctx.fill();
    }
  }

  function caption(ctx, fx, at, s, rise) {
    if (fx.fish === 'boot') return;      // 破靴子只有飛上岸的動畫
    var golden = fx.fish === 'golden';
    var y = at.y - s * (0.9 + rise * 0.6);
    ctx.globalAlpha = 1 - rise * rise;
    label(ctx, '+' + fx.food, at.x, y, s * (golden ? 0.5 : 0.38), golden ? '#ffd84a' : '#c9ffb8');
    if (!golden) return;
    for (var j = 0; j < 6; j++) {
      var angle = j * Math.PI / 3 + fx.age * 4;
      label(ctx, '*', at.x + Math.cos(angle) * s * 1.3, y + Math.sin(angle) * s * 0.5, s * 0.4, '#fff3b0');
    }
  }

  // 收穫：東西從水裡翻滾飛向村民、濺起水花，接著浮出文字
  function catchEffect(ctx, cam, fx) {
    var s = cam.scale, t = fx.age / fx.life;
    var a = RTS.camera.worldToScreen(cam, fx.x1, fx.y1);
    var b = RTS.camera.worldToScreen(cam, fx.x2, fx.y2);
    var fly = Math.min(1, t / 0.55);
    ctx.save();
    if (t < 0.35) splash(ctx, a, s, t / 0.35);
    if (fly < 1) {
      var lift = Math.sin(fly * Math.PI) * s * 1.3;
      ctx.translate(a.x + (b.x - a.x) * fly, a.y + (b.y - s * 0.4 - a.y) * fly - lift);
      ctx.rotate(fly * Math.PI * (fx.fish === 'boot' ? 4 : 2) * (b.x > a.x ? 1 : -1));
      if (fx.fish === 'boot') bootShape(ctx, s * 0.22);
      else fishShape(ctx, s * FISH[fx.fish].size, FISH[fx.fish].body, Math.sin(fx.age * 30) * 0.3);
    } else {
      caption(ctx, fx, b, s, (t - 0.55) / 0.45);
    }
    ctx.restore();
  }

  RTS.fishingView = { isCasting: isCasting, rod: rod, catchEffect: catchEffect };
})();
