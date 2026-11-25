// AI 維護：派村民修理受損建築、遇襲避難與療傷。只透過指令介面操作。
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

  // 遇襲時村民躲進主堡；平時讓重傷士兵回堡療傷
  function shelter(ctx) {
    var cfg = ctx.cfg.shelter, tc = ctx.tc;
    var raiders = 0, lurking = false;
    ctx.world.entities.forEach(function (e) {
      if (e.kind !== 'unit' || e.owner === ctx.pid || !RTS.data.units[e.type].military) return;
      var d = RTS.world.distTo(e.x, e.y, tc);
      if (d <= cfg.radius) raiders++;
      if (d <= cfg.radius + 3) lurking = true;
    });
    var room = RTS.garrison.capacity(tc) - RTS.garrison.count(tc);
    function send(units) {
      units = units.filter(function (u) { return u.order.type !== 'garrison'; }).slice(0, room);
      if (!units.length) return;
      ctx.issue({ type: 'garrison', targetId: tc.id, unitIds: units.map(function (u) { return u.id; }) });
    }
    function near(u, radius) { return RTS.world.distTo(u.x, u.y, tc) <= radius; }

    if (raiders >= cfg.minEnemies) {
      send(ctx.villagers.filter(function (u) { return near(u, cfg.radius + 4); }));
      return;
    }
    if (lurking) return;
    var inside = tc.garrison || [];
    var healed = inside.every(function (u) { return u.hp >= u.maxHp * 0.9; });
    var workers = inside.some(function (u) { return !RTS.data.units[u.type].military; });
    if (inside.length && (workers || healed)) {
      ctx.issue({ type: 'ungarrison', buildingId: tc.id });
      return;
    }
    send(ctx.army.filter(function (u) {
      return !ctx.state.wave[u.id] && u.hp < u.maxHp * cfg.woundedBelow && near(u, 16);
    }));
  }

  AI.care = { repair: repair, shelter: shelter, enemyNear: enemyNear };
})();
