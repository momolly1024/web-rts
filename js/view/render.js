// 畫面繪製（地圖外景觀見 scenery.js、地面見 ground.js）：實體、血條、效果、放置預覽、框選框。只讀取世界狀態。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function path(ctx, pts) {
    ctx.beginPath();
    pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.closePath();
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

  // 已認領的牲畜：腳下色環加上方小旗，一眼看出是誰的
  function ownerMark(ctx, player) {
    ctx.beginPath();
    ctx.ellipse(0, 0.17, 0.42, 0.17, 0, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.lineWidth = 0.04;
    ctx.strokeStyle = '#f4f1e6';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.04, -0.28);
    ctx.lineTo(-0.04, -0.66);
    ctx.strokeStyle = '#1c1a17';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.04, -0.66);
    ctx.lineTo(0.26, -0.57);
    ctx.lineTo(-0.04, -0.48);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1 / 36;
    ctx.stroke();
  }

  // 兵種升級：頭頂加羽飾，第一級白、第二級金
  var HEAD = { ranger: -0.6, stoneguard: -0.6, lancer: -0.74, swordsman: -0.52, spearman: -0.5, archer: -0.58, longbowman: -0.58, cavalry: -0.74 };
  function plume(ctx, type, tier) {
    if (!tier || HEAD[type] === undefined) return;
    var y = HEAD[type];
    ctx.beginPath();
    ctx.moveTo(-0.02, y);
    ctx.quadraticCurveTo(-0.2, y - 0.2, -0.1, y - 0.3);
    ctx.quadraticCurveTo(0.02, y - 0.16, 0.04, y);
    ctx.closePath();
    ctx.fillStyle = tier >= 2 ? '#ffd84a' : '#f4f1e6';
    ctx.fill();
    ctx.strokeStyle = '#1c1a17';
    ctx.stroke();
  }

  function drawEntity(ctx, cam, e, world) {
    var players = RTS.data.players;
    if (e.kind === 'node') {
      local(ctx, cam, e.x + 0.5, e.y + 0.5, function () {
        ctx.scale(RTS.depth.NODE_SCALE, RTS.depth.NODE_SCALE);
        RTS.sprites.nodes[e.type](ctx, e.id);
      });
    } else if (e.kind === 'building') {
      local(ctx, cam, e.x, e.y, function () {
        var civ = world ? world.players[e.owner].civ : null;
        var axis = e.type === 'gate' && world ? RTS.construction.gateAxis(world, e.x, e.y) : 'x';
        if (e.complete) RTS.sprites.building(ctx, e.type, e.w, players[e.owner], e, civ, axis);
        else RTS.sprites.construction(ctx, e.w, e.progress);
      });
    } else if (e.kind === 'animal') {
      local(ctx, cam, e.x, e.y, function () {
        if (e.owner !== null) ownerMark(ctx, players[e.owner]);
        ctx.scale(e.facing, 1);
        RTS.sprites.animals[e.type](ctx, e.owner === null ? null : players[e.owner].color);
      });
    } else {
      local(ctx, cam, e.x, e.y, function () {
        ctx.scale(e.facing, 1);
        var carry = e.carry.amount > 0 ? e.carry.resource : null;
        RTS.sprites.units[e.type](ctx, players[e.owner], e.swing, carry, RTS.fishingView.isCasting(e));
        if (world) plume(ctx, e.type, RTS.research.tier(world, e.owner, e.type));
      });
      if (world) RTS.fishingView.rod(ctx, cam, e, world.time);
    }
  }

  function isFlat(e) {
    var def = e.kind === 'building' && RTS.data.buildings[e.type];
    return !!def && !!def.walkable && !def.gate;       // 城門有柱子，照一般建築排序
  }

  function selectionMark(ctx, cam, e, human) {
    ctx.strokeStyle = e.owner === human ? '#fff3b0' : e.owner === null ? '#ffffff' : '#ff8a7a';
    ctx.lineWidth = 2;
    if (e.w === undefined) {
      var p = RTS.camera.worldToScreen(cam, e.x, e.y);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + cam.scale * 0.14, cam.scale * 0.38, cam.scale * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      path(ctx, RTS.camera.quad(cam, e.x, e.y, e.w, e.h));
      ctx.stroke();
    }
  }

  // 實體正上方的螢幕位置（height 以格的投影單位計）
  function above(cam, e, height) {
    var c = e.w === undefined ? e : { x: e.x + e.w / 2, y: e.y + e.h / 2 };
    var p = RTS.camera.worldToScreen(cam, c.x, c.y);
    return { x: p.x, y: p.y - height * cam.scale };
  }

  function healthBar(ctx, cam, e) {
    var unit = e.w === undefined;
    var width = cam.scale * (unit ? 0.7 : e.w * 0.8);
    var top = above(cam, e, unit ? 0.78 : RTS.depth.topOf(e) + 0.15);
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

  // 建築內有避難單位時，在屋頂上方標人數
  function garrisonBadge(ctx, cam, b) {
    var p = above(cam, b, RTS.depth.topOf(b) + 0.55);
    ctx.fillStyle = '#14202b';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(RTS.garrison.count(b)), p.x, p.y + 1);
  }

  // 選取生產建築時顯示集結旗
  function rallyFlag(ctx, cam, b, color) {
    var from = RTS.camera.worldToScreen(cam, b.x + b.w / 2, b.y + b.h / 2);
    var to = RTS.camera.worldToScreen(cam, b.rally.x, b.rally.y);
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x, to.y - 24);
    ctx.stroke();
    path(ctx, [{ x: to.x, y: to.y - 24 }, { x: to.x + 16, y: to.y - 19 }, { x: to.x, y: to.y - 13 }]);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  }

  function drawEffects(ctx, cam, world, human) {
    world.effects.forEach(function (fx) {
      if (RTS.fog.tile(world, human, Math.floor(fx.x2), Math.floor(fx.y2)) !== RTS.fog.VISIBLE) return;
      if (fx.type === 'catch') { RTS.fishingView.catchEffect(ctx, cam, fx); return; }
      var t = fx.age / fx.life;
      var a = RTS.camera.worldToScreen(cam, fx.x1, fx.y1);
      var b = RTS.camera.worldToScreen(cam, fx.x2, fx.y2);
      var ground = fx.type === 'order';      // 下令標記貼在地面，戰鬥效果畫在身體高度
      if (!ground) {
        a.y -= cam.scale * 0.25;
        b.y -= cam.scale * 0.2;
      }
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
        ctx.ellipse(b.x, b.y, r, ground ? r / 2 : r, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  // 城牆預覽：從起點到游標的每一格，可放綠、不可放紅
  function drawWallLine(ctx, app, spot) {
    var cam = app.cam, start = app.wallStart || spot;
    var tiles = RTS.construction.lineTiles(start.tx, start.ty, spot.tx, spot.ty);
    var stone = app.world.players[app.human].res.stone, cost = RTS.data.buildings.wall.cost.stone;
    tiles.forEach(function (t, i) {
      var ok = RTS.construction.canPlace(app.world, app.human, 'wall', t.x, t.y).ok && stone >= cost * (i + 1);
      path(ctx, RTS.camera.quad(cam, t.x, t.y, 1, 1));
      ctx.fillStyle = ok ? 'rgba(90,220,90,0.45)' : 'rgba(230,60,40,0.55)';
      ctx.fill();
      ctx.strokeStyle = ok ? '#c9ffb8' : '#ffb0a0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  function drawPlacement(ctx, app) {
    var spot = RTS.input.placementTile(app);
    if (!spot) return;
    if (app.placement === 'wall') { drawWallLine(ctx, app, spot); return; }
    var cam = app.cam, type = app.placement;
    var size = RTS.data.buildings[type].size;
    var check = RTS.construction.canPlace(app.world, app.human, type, spot.tx, spot.ty);
    var ok = check.ok && RTS.world.canAfford(app.world, app.human, RTS.data.buildings[type].cost);
    path(ctx, RTS.camera.quad(cam, spot.tx, spot.ty, size, size));
    ctx.fillStyle = ok ? 'rgba(90,220,90,0.4)' : 'rgba(230,60,40,0.55)';
    ctx.fill();
    ctx.globalAlpha = 0.6;
    var axis = type === 'gate' ? RTS.construction.gateAxis(app.world, spot.tx, spot.ty) : 'x';
    local(ctx, cam, spot.tx, spot.ty, function () {
      RTS.sprites.buildings[type](ctx, size, RTS.data.players[app.human], null, axis);
    });
    ctx.globalAlpha = 1;
    path(ctx, RTS.camera.quad(cam, spot.tx, spot.ty, size, size));
    ctx.strokeStyle = ok ? '#c9ffb8' : '#ffb0a0';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw(ctx, app) {
    var world = app.world, cam = app.cam;
    ctx.fillStyle = '#14202b';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    RTS.scenery.draw(ctx, cam);
    RTS.ground.draw(ctx, world, cam, app.human);

    var visible = RTS.depth.sort(RTS.fog.perceived(world, app.human).filter(function (e) {
      return RTS.depth.inView(cam, e);
    }));
    // 農田這類平地建築貼在地面，先畫，站在上面的單位才不會被蓋住
    var flat = visible.filter(isFlat);
    visible = visible.filter(function (e) { return !isFlat(e); });
    flat.forEach(function (e) {
      if (e.ghost) ctx.globalAlpha = 0.55;
      drawEntity(ctx, cam, e, world);
      ctx.globalAlpha = 1;
    });
    var selected = new Set(app.selection);
    flat.concat(visible).forEach(function (e) { if (selected.has(e.id)) selectionMark(ctx, cam, e, app.human); });

    visible.forEach(function (e) {
      if (e.ghost) ctx.globalAlpha = 0.55;      // 記憶中的舊樣貌畫淡一些
      drawEntity(ctx, cam, e, world);
      ctx.globalAlpha = 1;
    });
    flat.concat(visible).forEach(function (e) {
      if (e.kind !== 'node' && !e.ghost && (selected.has(e.id) || e.hp < e.maxHp)) healthBar(ctx, cam, e);
    });
    visible.forEach(function (e) {
      if (e.owner === app.human && e.garrison && e.garrison.length) garrisonBadge(ctx, cam, e);
    });
    app.selection.forEach(function (id) {
      var b = RTS.world.get(world, id);
      if (b && b.owner === app.human && b.rally) rallyFlag(ctx, cam, b, RTS.data.players[b.owner].color);
    });
    drawEffects(ctx, cam, world, app.human);
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
