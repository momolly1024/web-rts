// 畫面繪製：地面、實體、血條、效果、放置預覽、框選框。只讀取世界狀態。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var GRASS = ['#7b9a4b', '#759447', '#80a04f'];
  var WATER = ['#3f74a0', '#4580ac'];

  function path(ctx, pts) {
    ctx.beginPath();
    pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.closePath();
  }

  function drawGround(ctx, world, cam) {
    var map = world.map, v = RTS.camera.visibleTiles(cam);
    for (var y = v.y0; y <= v.y1; y++) {
      for (var x = v.x0; x <= v.x1; x++) {
        var hash = (x * 73 + y * 151 + x * y * 7) % 17;
        var water = map.terrain[y * map.width + x] === RTS.map.TERRAIN.WATER;
        ctx.fillStyle = water ? WATER[hash % 2] : GRASS[hash % 3];
        path(ctx, RTS.camera.quad(cam, x - 0.02, y - 0.02, 1.04, 1.04));
        ctx.fill();
      }
    }
    ctx.strokeStyle = '#1c1a17';
    ctx.lineWidth = 3;
    path(ctx, RTS.camera.quad(cam, 0, 0, map.width, map.height));
    ctx.stroke();
  }

  // 在世界座標 (wx, wy) 建立以「格」為單位的繪圖座標系
  function local(ctx, cam, wx, wy, draw) {
    var p = RTS.camera.worldToScreen(cam, wx, wy);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(cam.scale, cam.scale);
    ctx.lineWidth = 1 / cam.scale;
    draw();
    ctx.restore();
  }

  function drawEntity(ctx, cam, e) {
    var players = RTS.data.players;
    if (e.kind === 'node') {
      local(ctx, cam, e.x + 0.5, e.y + 0.5, function () { RTS.sprites.nodes[e.type](ctx, e.id); });
    } else if (e.kind === 'building') {
      local(ctx, cam, e.x, e.y, function () {
        if (e.complete) RTS.sprites.buildings[e.type](ctx, e.w, players[e.owner]);
        else RTS.sprites.construction(ctx, e.w, e.progress);
      });
    } else {
      local(ctx, cam, e.x, e.y, function () {
        ctx.scale(e.facing, 1);
        var carry = e.carry.amount > 0 ? e.carry.resource : null;
        RTS.sprites.units[e.type](ctx, players[e.owner], e.swing, carry);
      });
    }
  }

  function selectionMark(ctx, cam, e, human) {
    ctx.strokeStyle = e.owner === human ? '#fff3b0' : e.owner === null ? '#ffffff' : '#ff8a7a';
    ctx.lineWidth = 2;
    if (e.kind === 'unit') {
      var p = RTS.camera.worldToScreen(cam, e.x, e.y + 0.14);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, cam.scale * 0.38, cam.scale * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      path(ctx, RTS.camera.quad(cam, e.x, e.y, e.w, e.h));
      ctx.stroke();
    }
  }

  function healthBar(ctx, cam, e) {
    var unit = e.kind === 'unit';
    var width = cam.scale * (unit ? 0.7 : e.w * 0.8);
    var top = unit
      ? RTS.camera.worldToScreen(cam, e.x, e.y - 0.78)
      : RTS.camera.worldToScreen(cam, e.x + e.w / 2, e.y - 0.45);
    var ratio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = '#1c1a17';
    ctx.fillRect(top.x - width / 2 - 1, top.y - 1, width + 2, 6);
    ctx.fillStyle = ratio > 0.6 ? '#6fd35a' : ratio > 0.3 ? '#f2c230' : '#e8503c';
    ctx.fillRect(top.x - width / 2, top.y, width * ratio, 4);
    if (!unit && !e.complete) {
      ctx.fillStyle = '#7fd0ff';
      ctx.fillRect(top.x - width / 2, top.y + 6, width * e.progress, 3);
    }
  }

  function drawEffects(ctx, cam, world) {
    world.effects.forEach(function (fx) {
      var t = fx.age / fx.life;
      var a = RTS.camera.worldToScreen(cam, fx.x1, fx.y1 - 0.25);
      var b = RTS.camera.worldToScreen(cam, fx.x2, fx.y2 - 0.2);
      ctx.lineWidth = 2;
      if (fx.type === 'arrow') {
        var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        var len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        ctx.strokeStyle = '#2b2118';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - (b.x - a.x) / len * 12, y - (b.y - a.y) / len * 12);
        ctx.stroke();
      } else {
        var r = cam.scale * (fx.type === 'death' ? 0.2 + t * 0.5 : 0.1 + t * 0.2);
        ctx.strokeStyle = fx.type === 'death' ? 'rgba(60,20,10,' + (1 - t) + ')'
          : 'rgba(255,240,200,' + (1 - t) + ')';
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  function drawPlacement(ctx, app) {
    var spot = RTS.input.placementTile(app);
    if (!spot) return;
    var cam = app.cam, type = app.placement;
    var size = RTS.data.buildings[type].size;
    var check = RTS.construction.canPlace(app.world, app.human, type, spot.tx, spot.ty);
    var ok = check.ok && RTS.world.canAfford(app.world, app.human, RTS.data.buildings[type].cost);
    ctx.globalAlpha = 0.6;
    local(ctx, cam, spot.tx, spot.ty, function () {
      RTS.sprites.buildings[type](ctx, size, RTS.data.players[app.human]);
    });
    ctx.globalAlpha = 1;
    path(ctx, RTS.camera.quad(cam, spot.tx, spot.ty, size, size));
    ctx.fillStyle = ok ? 'rgba(90,220,90,0.28)' : 'rgba(230,60,40,0.4)';
    ctx.fill();
    ctx.strokeStyle = ok ? '#c9ffb8' : '#ffb0a0';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw(ctx, app) {
    var world = app.world, cam = app.cam;
    ctx.fillStyle = '#14202b';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    drawGround(ctx, world, cam);

    var v = RTS.camera.visibleTiles(cam);
    var visible = RTS.world.list(world, function (e) {
      return e.x >= v.x0 - 3 && e.x <= v.x1 + 2 && e.y >= v.y0 - 3 && e.y <= v.y1 + 2;
    });
    var selected = new Set(app.selection);
    visible.forEach(function (e) { if (selected.has(e.id)) selectionMark(ctx, cam, e, app.human); });

    // 依腳底的螢幕高度排序，靠下的蓋住靠上的
    function depth(e) {
      var c = e.kind === 'unit' ? e : { x: e.x + e.w / 2, y: e.y + e.h - 0.3 };
      return RTS.camera.worldToScreen(cam, c.x, c.y).y;
    }
    visible.sort(function (a, b) { return depth(a) - depth(b); });
    visible.forEach(function (e) { drawEntity(ctx, cam, e); });
    visible.forEach(function (e) {
      if (e.kind !== 'node' && (selected.has(e.id) || e.hp < e.maxHp)) healthBar(ctx, cam, e);
    });
    drawEffects(ctx, cam, world);
    if (app.placement) drawPlacement(ctx, app);

    var d = app.drag;
    if (d && d.active) {
      ctx.fillStyle = 'rgba(255,243,176,0.12)';
      ctx.strokeStyle = '#fff3b0';
      ctx.lineWidth = 1;
      ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      ctx.strokeRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    }
  }

  RTS.render = { draw: draw };
})();
