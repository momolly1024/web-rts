// 看世界狀態決定這一幀該出什麼聲音（只收畫面內、看得見的事件）。不碰 DOM 與音訊。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var COMBAT = { hit: 'melee', arrow: 'arrow', death: 'fall', catch: 'splash' };
  var GATHER = { wood: 'chop', gold: 'mine', stone: 'mine', food: 'forage' };

  function audible(app, x, y) {
    var world = app.world;
    if (world.fog && RTS.fog.tile(world, app.human, Math.floor(x), Math.floor(y)) !== RTS.fog.VISIBLE) return false;
    return RTS.camera.onScreen(app.cam, RTS.camera.worldToScreen(app.cam, x, y), 0, 0);
  }

  function workSound(u) {
    var type = u.order.type;
    if (type === 'gather') return GATHER[u.order.resource] || null;
    return type === 'build' || type === 'repair' ? 'hammer' : null;
  }

  function create() {
    var world = null, heard = null, swings = null;

    // 回傳這一幀要播的聲音代號（不重複）
    function collect(app) {
      if (app.world !== world) {
        world = app.world;
        heard = new WeakSet();
        swings = new Map();
      }
      var out = [];
      function add(name) { if (out.indexOf(name) < 0) out.push(name); }

      world.effects.forEach(function (fx) {
        if (heard.has(fx)) return;
        heard.add(fx);
        if (COMBAT[fx.type] && audible(app, fx.x2, fx.y2)) add(COMBAT[fx.type]);
      });

      // 工作中的村民每揮完一下（swing 歸零重來）出一次聲
      var now = new Map();
      world.entities.forEach(function (u) {
        if (u.kind !== 'unit') return;
        var name = workSound(u);
        if (!name) return;
        now.set(u.id, u.swing);
        if (swings.get(u.id) - u.swing > 0.3 && audible(app, u.x, u.y)) add(name);
      });
      swings = now;
      return out;
    }

    return { collect: collect };
  }

  RTS.soundEvents = { create: create };
})();
