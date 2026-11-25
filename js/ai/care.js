// AI 維護：派村民修理受損建築。只透過指令介面操作。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  var DANGER = 6;       // 敵人在建築幾格內時不派人去修

  function enemyNear(ctx, b, radius) {
    var found = false;
    ctx.world.entities.forEach(function (e) {
      if (e.kind === 'unit' && e.owner !== ctx.pid && RTS.world.distTo(e.x, e.y, b) <= radius) found = true;
    });
    return found;
  }

  function repair(ctx) {
    var cfg = ctx.cfg.repair;
    ctx.buildings.forEach(function (b) {
      if (!RTS.repair.canRepair(b) || b.hp / b.maxHp >= cfg.threshold || enemyNear(ctx, b, DANGER)) return;
      var res = ctx.world.players[ctx.pid].res;
      var cost = RTS.data.buildings[b.type].cost;
      // 手上資源太少時不修，免得村民走到就停工
      if (Object.keys(cost).some(function (k) { return res[k] < 10; })) return;
      var working = ctx.villagers.filter(function (u) {
        return u.order.type === 'repair' && u.order.targetId === b.id;
      }).length;
      for (var i = working; i < cfg.workers; i++) {
        var worker = AI.economy.pickBuilder(ctx, b.x, b.y);
        if (!worker || !ctx.issue({ type: 'repair', unitIds: [worker.id], targetId: b.id }).ok) break;
      }
    });
  }

  AI.care = { repair: repair, enemyNear: enemyNear };
})();
