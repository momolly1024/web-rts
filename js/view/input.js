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

  // 游標指到的地面世界座標；地圖外（菱形四周的空白）夾回地圖內
  function ground(app, sx, sy) {
    var w = RTS.camera.screenToWorld(app.cam, sx, sy);
    return {
      x: RTS.util.clamp(w.x, 0, app.cam.mapW - 0.01),
      y: RTS.util.clamp(w.y, 0, app.cam.mapH - 0.01)
    };
  }

  function placementTile(app) {
    if (!app.placement || !app.mouse.overCanvas) return null;
    var size = RTS.data.buildings[app.placement].size;
    var w = RTS.camera.screenToWorld(app.cam, app.mouse.x, app.mouse.y);
    return { tx: Math.round(w.x - size / 2), ty: Math.round(w.y - size / 2) };
  }

  function pick(app, sx, sy) {
    return RTS.depth.pick(app.cam, app.world, app.human, sx, sy);
  }

  // 框內的己方單位與牲畜
  function ownUnitsInRect(app, x0, y0, x1, y1, type) {
    var rect = { x0: x0, y0: y0, x1: x1, y1: y1 };
    var found = RTS.depth.ownInRect(app.cam, app.world, app.human, rect, type);
    return RTS.groups.boxSelection(found).map(function (e) { return e.id; });
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
      return s.w === undefined && s.owner === app.human;
    });
    if (shift && onlyOwnUnits && e.w === undefined && e.owner === app.human) {
      var i = app.selection.indexOf(e.id);
      if (i < 0) app.selection.push(e.id); else app.selection.splice(i, 1);
    } else {
      app.selection = [e.id];
    }
  }

  function leftClickMode(app, x, y, shift) {
    var units = app.selection.slice();
    if (app.placement === 'wall') {
      // 城牆：第一下定起點，第二下定終點並沿線放工地
      var end = placementTile(app);
      if (!app.wallStart) { app.wallStart = end; return; }
      var line = RTS.actions.issue(app, {
        type: 'buildWall', unitIds: units, x0: app.wallStart.tx, y0: app.wallStart.ty, x1: end.tx, y1: end.ty
      });
      app.wallStart = null;
      if (line.ok && !shift) app.placement = null;
    } else if (app.placement) {
      var spot = placementTile(app);
      var r = RTS.actions.issue(app, {
        type: 'build', unitIds: units, building: app.placement, tx: spot.tx, ty: spot.ty
      });
      if (r.ok && !shift) app.placement = null;
    } else {
      var w = ground(app, x, y), target = pick(app, x, y);
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
      return e.w === undefined && e.owner === app.human;
    });
    // 沒選單位、只選一座生產建築時，右鍵設定集結點
    var sel = RTS.actions.selected(app);
    var producer = sel.length === 1 && sel[0].owner === app.human && RTS.rally.canRally(sel[0]) ? sel[0] : null;
    if (!hasUnits && !producer) {
      // 選著還不屬於自己的羊下指令時，說明怎麼認領，而不是毫無反應
      var stray = sel.length === 1 && sel[0].kind === 'animal' &&
        RTS.data.animals[sel[0].type].behavior === 'herd';
      if (stray) app.hud.say(sel[0].owner === null ? 'hint.claimSheep' : 'hint.enemySheep');
      return;
    }
    var w = ground(app, x, y), target = pick(app, x, y);
    var command = hasUnits ? { type: 'smart', unitIds: app.selection }
      : { type: 'setRally', buildingId: producer.id };
    command.targetId = target ? target.id : null;
    command.x = w.x;
    command.y = w.y;
    var r = RTS.actions.issue(app, command);
    if (r.ok) {
      app.world.effects.push({ type: 'order', x1: w.x, y1: w.y, x2: w.x, y2: w.y, age: 0, life: 0.35 });
    }
  }

  // Ctrl+數字（或 Alt+數字）設定編號，數字鍵選取，連按兩下跳到隊伍位置
  function groupKey(app, ev, digit) {
    var setting = ev.ctrlKey || ev.metaKey || ev.altKey;
    ev.preventDefault();      // 阻止瀏覽器用 Ctrl+數字切換分頁
    if (app.hud.overlay() || ev.repeat) return;
    if (setting) {
      var n = RTS.groups.assign(app.groups, digit, app.world, app.human, app.selection);
      if (n) app.hud.say('group.assigned', { group: digit, count: n });
      return;
    }
    var found = RTS.groups.recall(app.groups, digit, app.world, app.human, ev.timeStamp / 1000);
    if (!found) return;
    app.selection = found.ids;
    app.placement = app.mode = null;
    if (found.center) RTS.camera.centerOn(app.cam, found.center.x, found.center.y);
  }

  function onKey(app, ev) {
    var digit = /^(?:Digit|Numpad)(\d)$/.exec(ev.code);
    if (digit) { groupKey(app, ev, +digit[1]); return; }
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
    if (ev.code === 'Enter' || ev.code === 'NumpadEnter') {
      if (app.gotoAlert()) ev.preventDefault();
      return;
    }
    var idle = RTS.groups.idleKey(ev.code, ev.shiftKey);
    if (idle) { ev.preventDefault(); app.selectIdle(idle); return; }
    var key = ev.code === 'Backspace' ? 'Delete' : ev.code.replace(/^Key/, '');    // Mac 鍵盤沒有 Delete 鍵
    var action = RTS.actions.list(app).filter(function (a) { return a.hotkey === key; })[0];
    if (!action) return;
    if (key === 'Tab') ev.preventDefault();        // 切換建造選單頁，不讓瀏覽器移動焦點
    if (action.enabled) action.run(); else app.notify(action.reason);
  }

  // F11 或網頁全螢幕
  function isFullscreen() {
    return window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.innerWidth >= window.screen.width && window.innerHeight >= window.screen.height);
  }

  // 滑出視窗時，把游標位置貼到離離開點最近的那一側邊緣
  function edgeAfterLeave(x, y, w, h) {
    var px = RTS.util.clamp(x, 0, w - 1), py = RTS.util.clamp(y, 0, h - 1);
    var gaps = [px, w - 1 - px, py, h - 1 - py];
    var side = gaps.indexOf(Math.min.apply(null, gaps));
    if (side === 0) px = 0;
    else if (side === 1) px = w - 1;
    else if (side === 2) py = 0;
    else py = h - 1;
    return { x: px, y: py };
  }

  // 一般視窗：滑出去就停止邊緣捲動。全螢幕（多螢幕時滑到隔壁螢幕）：繼續朝那一側捲，
  // 滑回來或點其他視窗（blur）才停
  function leaveWindow(app, ev) {
    var m = app.mouse;
    if (!isFullscreen()) { m.inside = false; return; }
    var p = edgeAfterLeave(ev.clientX, ev.clientY, app.cam.viewW, app.cam.viewH);
    m.x = p.x;
    m.y = p.y;
    m.inside = true;
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
    document.documentElement.addEventListener('mouseleave', function (ev) { leaveWindow(app, ev); });
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
      if (e && e.w === undefined && e.owner === app.human) {
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
    if (m.inside && !app.drag && !app.miniDrag) {
      if (m.x <= EDGE) dx -= 1;
      if (m.x >= app.cam.viewW - EDGE) dx += 1;
      if (m.y <= EDGE) dy -= 1;
      if (m.y >= app.cam.viewH - EDGE) dy += 1;
    }
    if (dx || dy) {
      RTS.camera.pan(app.cam, Math.sign(dx) * SCROLL_SPEED * dt, Math.sign(dy) * SCROLL_SPEED * dt);
    }
  }

  RTS.input = { bind: bind, scroll: scroll, placementTile: placementTile, pick: pick,
    edgeAfterLeave: edgeAfterLeave, leaveWindow: leaveWindow };
})();
