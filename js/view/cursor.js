// 游標提示：依目前選取與滑鼠下的目標，預判右鍵會做什麼，換成對應的原創游標圖示。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var OUT = '#1c1a17';
  // 32x32 的 SVG 內容與熱點；外框加深色描邊，在草地與建築上都看得清楚
  var ICONS = {
    wood: ['<path d="M9 28 L22 9" stroke="#8a5f3c" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M17 6 Q27 4 29 13 L21 14 Z" fill="#c9ced4"/>', 4, 4],
    mine: ['<path d="M10 28 L21 12" stroke="#8a5f3c" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M6 13 Q18 2 30 11 Q18 7 6 13 Z" fill="#c9ced4"/>', 4, 4],
    food: ['<path d="M6 14 H26 L23 28 H9 Z" fill="#c79a5b"/>' +
      '<path d="M10 14 Q16 4 22 14" fill="none" stroke="#8a5f3c" stroke-width="3"/>' +
      '<circle cx="12" cy="12" r="3.5" fill="#b8285a"/><circle cx="19" cy="11" r="3.5" fill="#d0473f"/>', 16, 16],
    hunt: ['<path d="M5 27 L25 7" stroke="#8a5f3c" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M22 4 L29 3 L28 10 Z" fill="#c9ced4"/>', 28, 4],
    attack: ['<path d="M5 5 L22 22" stroke="#e8e2d0" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M18 26 L26 18" stroke="#8a5f3c" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M23 23 L28 28" stroke="#8a5f3c" stroke-width="4" stroke-linecap="round"/>', 4, 4],
    build: ['<path d="M10 28 L19 15" stroke="#8a5f3c" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M12 6 L27 14 L23 21 L9 12 Z" fill="#9aa0a6"/>', 4, 4],
    repair: ['<path d="M10 28 L19 15" stroke="#8a5f3c" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M12 6 L27 14 L23 21 L9 12 Z" fill="#9aa0a6"/>' +
      '<path d="M24 26 H31 M27.5 22.5 V29.5" stroke="#6fd35a" stroke-width="3"/>', 4, 4],
    deposit: ['<path d="M8 12 Q16 8 24 12 L26 27 H6 Z" fill="#c79a5b"/>' +
      '<path d="M16 3 V13 M11 9 L16 14 L21 9" fill="none" stroke="#fff3b0" stroke-width="3"/>', 16, 16],
    garrison: ['<path d="M16 3 L28 7 V16 Q28 25 16 30 Q4 25 4 16 V7 Z" fill="#3b82d6"/>' +
      '<path d="M16 8 V25" stroke="#fff3b0" stroke-width="3"/>', 16, 16],
    pen: ['<path d="M4 12 H28 M4 22 H28" stroke="#8a5f3c" stroke-width="3"/>' +
      '<path d="M7 8 V28 M16 8 V28 M25 8 V28" stroke="#6b4a2b" stroke-width="4"/>', 16, 16]
  };

  function css(name) {
    var icon = ICONS[name];
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
      '<g stroke="' + OUT + '" stroke-width="1.5">' + icon[0] + '</g></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + icon[1] + ' ' + icon[2] + ', pointer';
  }

  var GATHER_ICON = { wood: 'wood', gold: 'mine', stone: 'mine', food: 'food' };

  // 右鍵會執行的動作代號；沒有特別動作（移動或沒選東西）回傳 null。與 commands.smart 的判斷一致
  function actionFor(app, target) {
    if (app.placement) return null;
    if (app.mode === 'attackMove') return 'attack';
    var world = app.world, pid = app.human, data = RTS.data;
    var own = app.selection.map(function (id) { return RTS.world.get(world, id); }).filter(function (e) {
      return e && e.owner === pid && e.w === undefined;
    });
    var units = own.filter(function (e) { return e.kind === 'unit'; });
    var herd = own.filter(function (e) { return e.kind === 'animal'; });
    if (!target) return null;
    if (herd.length && RTS.pen.isPen(target) && target.owner === pid && target.complete) return 'pen';
    if (!units.length) return null;
    var villagers = units.some(function (u) { return data.units[u.type].canBuild; });

    if (target.kind === 'animal') {
      var def = data.animals[target.type];
      if (def.young) return target.owner !== pid && target.owner !== null ? 'attack' : null;
      if (villagers) return 'hunt';
      var hostile = target.owner !== pid && (target.owner !== null || def.behavior !== 'herd');
      return hostile ? 'attack' : null;
    }
    if (target.owner !== null && target.owner !== pid) return 'attack';
    var resource = RTS.gather.resourceOf(target);
    if (target.kind === 'node') return resource && villagers ? GATHER_ICON[resource] : null;
    if (target.kind !== 'building') return null;
    if (!target.complete) return villagers ? 'build' : null;
    if (RTS.farm.isFarm(target)) return villagers ? 'food' : null;
    var carrying = units.some(function (u) { return u.carry.amount > 0 && RTS.gather.accepts(target, u.carry.resource); });
    if (carrying) return 'deposit';
    if (villagers && RTS.repair.canRepair(target)) return 'repair';
    if (RTS.garrison.hasRoom(target)) return 'garrison';
    return null;
  }

  // 每幀呼叫：只在游標真的要換時才改樣式
  function update(app, canvas) {
    var m = app.mouse, name = null;
    if (m.inside && m.overCanvas && !app.drag) {
      name = actionFor(app, RTS.depth.pick(app.cam, app.world, app.human, m.x, m.y));
    }
    if (name === app.cursorName) return;
    app.cursorName = name;
    canvas.style.cursor = name ? css(name) : '';
  }

  RTS.cursor = { ICONS: ICONS, actionFor: actionFor, update: update, css: css };
})();
