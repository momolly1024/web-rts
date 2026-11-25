// 滑鼠與鍵盤：選取、右鍵指令、建築放置、鏡頭捲動、快捷鍵。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var SCROLL_SPEED = 720;   // 像素／秒
  var EDGE = 10;
  var SCROLL_KEYS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0]
  };

  function placementTile(app) {
    if (!app.placement || !app.mouse.overCanvas) return null;
    var size = RTS.data.buildings[app.placement].size;
    var w = RTS.camera.screenToWorld(app.cam, app.mouse.x, app.mouse.y);
    return { tx: Math.round(w.x - size / 2), ty: Math.round(w.y - size / 2) };
  }

  // 螢幕點到的實體：單位優先，其次是該格的建築或天然物件
  function pick(app, sx, sy) {
    var best = null, bestD = app.cam.scale * 0.5;
    app.world.entities.forEach(function (e) {
      if (e.kind !== 'unit') return;
      var p = RTS.camera.worldToScreen(app.cam, e.x, e.y - 0.15);
      var d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bestD) { bestD = d; best = e; }
    });
    if (best) return best;
    var w = RTS.camera.screenToWorld(app.cam, sx, sy);
    return RTS.world.get(app.world, RTS.map.occupantAt(app.world.map, Math.floor(w.x), Math.floor(w.y)));
  }

  function ownUnitsInRect(app, x0, y0, x1, y1, type) {
    return RTS.world.list(app.world, function (e) {
      if (e.kind !== 'unit' || e.owner !== app.human || (type && e.type !== type)) return false;
      var p = RTS.camera.worldToScreen(app.cam, e.x, e.y - 0.15);
      return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
    }).map(function (e) { return e.id; });
  }

  function finishSelection(app, drag, shift) {
    if (drag.active) {
      var ids = ownUnitsInRect(app, Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1),
        Math.max(drag.x0, drag.x1), Math.max(drag.y0, drag.y1));
      if (shift) ids = app.selection.concat(ids.filter(function (id) { return app.selection.indexOf(id) < 0; }));
      app.selection = ids;
      return;
    }
    var e = pick(app, drag.x1, drag.y1);
    if (!e) { if (!shift) app.selection = []; return; }
    var onlyOwnUnits = RTS.actions.selected(app).every(function (s) {
      return s.kind === 'unit' && s.owner === app.human;
    });
    if (shift && onlyOwnUnits && e.kind === 'unit' && e.owner === app.human) {
      var i = app.selection.indexOf(e.id);
      if (i < 0) app.selection.push(e.id); else app.selection.splice(i, 1);
    } else {
      app.selection = [e.id];
    }
  }

  function leftClickMode(app, x, y, shift) {
    var units = app.selection.slice();
    if (app.placement) {
      var spot = placementTile(app);
      var r = RTS.actions.issue(app, {
        type: 'build', unitIds: units, building: app.placement, tx: spot.tx, ty: spot.ty
      });
      if (r.ok && !shift) app.placement = null;
    } else {
      var w = RTS.camera.screenToWorld(app.cam, x, y), target = pick(app, x, y);
      var enemy = target && target.owner !== null && target.owner !== app.human;
      RTS.actions.issue(app, enemy
        ? { type: 'attack', unitIds: units, targetId: target.id }
        : { type: 'attackMove', unitIds: units, x: w.x, y: w.y });
      app.mode = null;
    }
  }

  function rightClick(app, x, y) {
    if (app.placement || app.mode) { app.placement = null; app.mode = null; return; }
    var hasUnits = RTS.actions.selected(app).some(function (e) {
      return e.kind === 'unit' && e.owner === app.human;
    });
    if (!hasUnits) return;
    var w = RTS.camera.screenToWorld(app.cam, x, y), target = pick(app, x, y);
    var r = RTS.actions.issue(app, {
      type: 'smart', unitIds: app.selection, targetId: target ? target.id : null, x: w.x, y: w.y
    });
    if (r.ok) {
      app.world.effects.push({ type: 'hit', x1: w.x, y1: w.y + 0.2, x2: w.x, y2: w.y + 0.2, age: 0, life: 0.35 });
    }
  }

  function onKey(app, ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (app.hud.overlay() && SCROLL_KEYS[ev.code]) return;    // 讓方向鍵能切換難度選項
    if (SCROLL_KEYS[ev.code]) { app.keys[ev.code] = true; ev.preventDefault(); return; }
    if (ev.code === 'F1') { ev.preventDefault(); app.toggleHelp(); return; }
    if (ev.code === 'KeyP' || ev.code === 'Space') {
      ev.preventDefault();
      if (!ev.repeat) app.togglePause();
      return;
    }
    if (ev.code === 'Escape') {
      if (app.hud.overlay()) app.closeOverlay();
      else if (app.placement || app.mode) { app.placement = null; app.mode = null; }
      else app.selection = [];
      return;
    }
    if (app.hud.overlay() || ev.repeat) return;
    var key = ev.code.replace(/^Key/, '');
    var action = RTS.actions.list(app).filter(function (a) { return a.hotkey === key; })[0];
    if (!action) return;
    if (action.enabled) action.run(); else app.notify(action.reason);
  }

  function bind(app, canvas) {
    var m = app.mouse;
    window.addEventListener('mousemove', function (ev) {
      m.x = ev.clientX;
      m.y = ev.clientY;
      m.inside = true;
      m.overCanvas = ev.target === canvas;
      if (app.drag) {
        app.drag.x1 = m.x;
        app.drag.y1 = m.y;
        if (Math.abs(m.x - app.drag.x0) + Math.abs(m.y - app.drag.y0) > 6) app.drag.active = true;
      }
    });
    document.documentElement.addEventListener('mouseleave', function () { m.inside = false; });
    canvas.addEventListener('mousedown', function (ev) {
      m.x = ev.clientX;
      m.y = ev.clientY;
      m.overCanvas = true;
      if (app.hud.overlay()) return;
      if (ev.button === 2) rightClick(app, ev.clientX, ev.clientY);
      else if (ev.button === 0) {
        if (app.placement || app.mode) leftClickMode(app, m.x, m.y, ev.shiftKey);
        else app.drag = { x0: m.x, y0: m.y, x1: m.x, y1: m.y, active: false };
      }
    });
    window.addEventListener('mouseup', function (ev) {
      if (ev.button !== 0 || !app.drag) return;
      finishSelection(app, app.drag, ev.shiftKey);
      app.drag = null;
    });
    canvas.addEventListener('dblclick', function (ev) {
      var e = pick(app, ev.clientX, ev.clientY);
      if (e && e.kind === 'unit' && e.owner === app.human) {
        app.selection = ownUnitsInRect(app, 0, 0, app.cam.viewW, app.cam.viewH, e.type);
      }
    });
    document.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    window.addEventListener('keydown', function (ev) { onKey(app, ev); });
    window.addEventListener('keyup', function (ev) { delete app.keys[ev.code]; });
    window.addEventListener('blur', function () {
      app.keys = {};
      app.drag = null;
      m.inside = false;
    });
  }

  function scroll(app, dt) {
    if (app.hud.overlay()) return;
    var dx = 0, dy = 0, m = app.mouse;
    Object.keys(app.keys).forEach(function (code) {
      dx += SCROLL_KEYS[code][0];
      dy += SCROLL_KEYS[code][1];
    });
    if (m.inside && !app.drag) {
      if (m.x <= EDGE) dx -= 1;
      if (m.x >= app.cam.viewW - EDGE) dx += 1;
      if (m.y <= EDGE) dy -= 1;
      if (m.y >= app.cam.viewH - EDGE) dy += 1;
    }
    if (dx || dy) {
      RTS.camera.pan(app.cam, Math.sign(dx) * SCROLL_SPEED * dt, Math.sign(dy) * SCROLL_SPEED * dt);
    }
  }

  RTS.input = { bind: bind, scroll: scroll, placementTile: placementTile, pick: pick };
})();
