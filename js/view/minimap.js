// 小地圖：與主畫面使用同一個投影。幾何部分不依賴 DOM（可在 node 測試），其餘負責繪製與操作。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var PAD = 3;
  var REDRAW = 0.12;      // 重畫間隔（秒）
  var COLORS = {
    grass: '#6f8c43', water: '#3f74a0', tree: '#24532c', berry: '#c0316a', gold: '#ffd23f',
    rock: '#a7adb5', carcass: '#a75a48', animal: '#f4f1e6'
  };

  // 把整張地圖的投影塞進 width x height，回傳雙向轉換
  function layout(mapW, mapH, width, height) {
    var corners = [[0, 0], [mapW, 0], [mapW, mapH], [0, mapH]].map(function (c) {
      return RTS.camera.project(c[0], c[1]);
    });
    var xs = corners.map(function (p) { return p.x; }), ys = corners.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
    var bw = Math.max.apply(null, xs) - x0, bh = Math.max.apply(null, ys) - y0;
    var k = Math.min((width - PAD * 2) / bw, (height - PAD * 2) / bh);
    var ox = (width - bw * k) / 2 - x0 * k, oy = (height - bh * k) / 2 - y0 * k;
    return {
      toMini: function (wx, wy) {
        var p = RTS.camera.project(wx, wy);
        return { x: p.x * k + ox, y: p.y * k + oy };
      },
      fromMini: function (mx, my) {
        var w = RTS.camera.unproject((mx - ox) / k, (my - oy) / k);
        return { x: RTS.util.clamp(w.x, 0, mapW - 0.01), y: RTS.util.clamp(w.y, 0, mapH - 0.01) };
      }
    };
  }

  // 目前主畫面在小地圖上的框
  function viewFrame(map, cam) {
    return [[0, 0], [cam.viewW, 0], [cam.viewW, cam.viewH], [0, cam.viewH]].map(function (c) {
      var w = RTS.camera.screenToWorld(cam, c[0], c[1]);
      return map.toMini(w.x, w.y);
    });
  }

  function create(canvas, app) {
    var ctx = canvas.getContext('2d');
    var geo = null, timer = 0, dragging = false;

    function size() {
      var ratio = window.devicePixelRatio || 1;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
        timer = 0;
      }
      geo = layout(app.world.map.width, app.world.map.height, w, h);
      return ratio;
    }

    function draw() {
      var ratio = size(), world = app.world, map = world.map;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 投影是線性的：設定一次轉換矩陣後，直接用世界座標畫方格
      var o = geo.toMini(0, 0), ex = geo.toMini(1, 0), ey = geo.toMini(0, 1);
      ctx.save();
      ctx.transform(ex.x - o.x, ex.y - o.y, ey.x - o.x, ey.y - o.y, o.x, o.y);
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(0, 0, map.width, map.height);
      ctx.beginPath();     // 併成一條路徑填色，斜向格子之間才不會露出縫隙
      for (var i = 0; i < map.terrain.length; i++) {
        if (map.terrain[i] === RTS.map.TERRAIN.WATER) {
          ctx.rect(i % map.width, Math.floor(i / map.width), 1.02, 1.02);
        }
      }
      ctx.fillStyle = COLORS.water;
      ctx.fill();
      var mobiles = [];
      RTS.fog.perceived(world, app.human).forEach(function (e) {
        if (e.w === undefined) { mobiles.push(e); return; }
        ctx.fillStyle = e.kind === 'node' ? COLORS[e.type] : RTS.data.players[e.owner].color;
        ctx.fillRect(e.x, e.y, e.w + 0.05, e.h + 0.05);
      });
      // 迷霧：未探索全黑，已探索但看不見的蓋一層暗色
      // 同狀態的格子併成一條路徑一次填滿：不露縫，半透明也不會重疊加深
      [[RTS.fog.EXPLORED, 'rgba(0,0,0,0.45)'], [RTS.fog.UNEXPLORED, '#000']].forEach(function (layer) {
        ctx.beginPath();
        for (var ty = 0; ty < map.height; ty++) {
          for (var tx = 0, end = 0; tx < map.width; tx = end) {
            var seen = RTS.fog.tile(world, app.human, tx, ty);
            for (end = tx + 1; end < map.width && RTS.fog.tile(world, app.human, end, ty) === seen; end++);
            if (seen === layer[0]) ctx.rect(tx, ty, end - tx + 0.02, 1.02);
          }
        }
        ctx.fillStyle = layer[1];
        ctx.fill();
      });
      mobiles.forEach(function (e) {
        ctx.fillStyle = e.owner === null ? COLORS.animal : RTS.data.players[e.owner].color;
        var r = e.kind === 'unit' ? 1.8 : 1.1;
        ctx.fillRect(e.x - r / 2, e.y - r / 2, r, r);
      });
      ctx.restore();

      ctx.beginPath();
      viewFrame(geo, app.cam).forEach(function (p, n) { if (n) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
      ctx.closePath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawAlert(world.time);
    }

    // 交戰處的閃爍圓圈
    function drawAlert(time) {
      var spot = app.alerts && app.alerts.active();
      if (!spot) return;
      var p = geo.toMini(spot.x, spot.y), phase = (time * 1.5) % 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 + phase * 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 80, 50, ' + (1 - phase * 0.6) + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    function pointer(ev) {
      var r = canvas.getBoundingClientRect();
      size();
      return geo.fromMini(ev.clientX - r.left - canvas.clientLeft, ev.clientY - r.top - canvas.clientTop);
    }

    function jump(ev) {
      var w = pointer(ev);
      RTS.camera.centerOn(app.cam, w.x, w.y);
      timer = 0;
    }

    // 右鍵（或攻擊移動模式下的左鍵）在小地圖下指令
    function order(ev) {
      var w = pointer(ev), sel = RTS.actions.selected(app);
      var movers = sel.filter(function (e) { return e.w === undefined && e.owner === app.human; });
      if (movers.length) {
        RTS.actions.issue(app, {
          type: app.mode === 'attackMove' ? 'attackMove' : 'move',
          unitIds: app.selection, x: w.x, y: w.y
        });
      } else if (sel.length === 1 && sel[0].owner === app.human && RTS.rally.canRally(sel[0])) {
        RTS.actions.issue(app, { type: 'setRally', buildingId: sel[0].id, x: w.x, y: w.y });
      }
      app.mode = null;
    }

    canvas.addEventListener('mousedown', function (ev) {
      ev.preventDefault();
      if (app.hud.overlay()) return;
      if (ev.button === 2) {
        if (app.placement) app.placement = null; else order(ev);
      } else if (ev.button === 0) {
        if (app.mode === 'attackMove') { order(ev); return; }
        dragging = true;
        app.miniDrag = true;
        jump(ev);
      }
    });
    window.addEventListener('mousemove', function (ev) { if (dragging) jump(ev); });
    function release() { dragging = false; app.miniDrag = false; }
    window.addEventListener('mouseup', release);
    window.addEventListener('blur', release);

    return {
      update: function (dt) {
        timer -= dt;
        if (timer > 0 && !dragging) return;
        timer = REDRAW;
        draw();
      },
      refresh: function () { timer = 0; }
    };
  }

  RTS.minimap = { layout: layout, viewFrame: viewFrame, create: create };
})();
