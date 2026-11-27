// AI 經濟建設：收集建築、磨坊與農田、預約重種、經濟科技。只透過指令介面操作。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  var CAMP_FOR = { wood: 'lumberCamp', gold: 'miningCamp', stone: 'miningCamp' };
  var FAR_DROP = 6;          // 採集點離最近收取建築超過幾格就蓋收集建築
  var RETRY = 20;            // 同一種建築失敗後隔幾秒再試
  var TECH_ORDER = ['woodcutting', 'farmYield', 'goldMining', 'handcart', 'stoneMining'];
  var TECH_SPARE = 150;      // 研究後每種資源至少還要留多少

  // 以 (cx, cy) 為中心由近到遠找建地；margin 為四周要留的走道
  function spotNear(ctx, type, cx, cy, maxR, margin) {
    var size = RTS.data.buildings[type].size;
    for (var r = 1; r <= maxR; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var tx = Math.round(cx + dx - size / 2), ty = Math.round(cy + dy - size / 2);
          if (!RTS.construction.canPlace(ctx.world, ctx.pid, type, tx, ty).ok) continue;
          if (!margin || AI.economy.hasMargin(ctx.world.map, tx, ty, size)) return { tx: tx, ty: ty };
        }
      }
    }
    return null;
  }

  function tryBuild(ctx, type, spot) {
    var state = ctx.state, last = state.campTry[type] || -Infinity;
    if (!spot || ctx.world.time - last < RETRY) return false;
    if (!RTS.world.canAfford(ctx.world, ctx.pid, RTS.data.buildings[type].cost)) return false;
    state.campTry[type] = ctx.world.time;
    var builder = AI.economy.pickBuilder(ctx, spot.tx, spot.ty);
    if (!builder) return false;
    return ctx.issue({ type: 'build', unitIds: [builder.id], building: type, tx: spot.tx, ty: spot.ty }).ok;
  }

  function pending(ctx, type) {
    return ctx.buildings.some(function (b) { return b.type === type && !b.complete; });
  }

  // 有一群人採同一種資源、而且離收取建築很遠：在資源旁蓋收集建築
  function camps(ctx, cfg) {
    ['wood', 'gold', 'stone'].forEach(function (resource) {
      var type = CAMP_FOR[resource];
      if (pending(ctx, type)) return;
      var workers = ctx.villagers.filter(function (u) {
        return u.order.type === 'gather' && u.order.resource === resource;
      });
      if (workers.length < cfg.campAt) return;
      var node = RTS.world.get(ctx.world, workers[0].order.targetId);
      if (!node || node.kind !== 'node') return;
      var c = RTS.world.center(node);
      var drop = RTS.world.nearest(ctx.world, c.x, c.y, function (e) {
        return e.kind === 'building' && e.owner === ctx.pid && RTS.gather.accepts(e, resource);
      });
      if (drop && RTS.world.distTo(c.x, c.y, drop) <= FAR_DROP) return;
      tryBuild(ctx, type, spotNear(ctx, type, c.x, c.y, 6, true));
    });
  }

  // 野外食物不夠時蓋磨坊與農田，並預付重種
  function farming(ctx, cfg) {
    var mills = ctx.buildings.filter(function (b) { return b.type === 'mill'; });
    var needFood = ctx.state.needFarm || ctx.villagers.length >= cfg.millAt;
    if (!mills.length) {
      if (needFood) AI.economy.startBuilding(ctx, 'mill');
      return;
    }
    var mill = mills.filter(function (b) { return b.complete; })[0];
    if (!mill) return;
    var farms = ctx.buildings.filter(function (b) { return b.type === 'farm'; });
    var sites = farms.filter(function (b) { return !b.complete; }).length;
    if (ctx.state.needFarm && sites < 2 && farms.length < cfg.maxFarms) {
      var c = RTS.world.center(mill);
      if (tryBuild(ctx, 'farm', spotNear(ctx, 'farm', c.x, c.y, 10, false))) ctx.state.needFarm = false;
      ctx.state.campTry.farm = -Infinity;      // 農田可以連續蓋
    }
    var res = ctx.world.players[ctx.pid].res;
    if (farms.length >= 2 && ctx.world.players[ctx.pid].reseeds < cfg.reseedBuffer && res.wood > 250) {
      ctx.issue({ type: 'reseed', buildingId: mill.id });
    }
  }

  // 村民夠多之後，資源有餘就依序研究經濟科技
  function research(ctx, cfg) {
    if (ctx.villagers.length < cfg.techAt) return;
    var res = ctx.world.players[ctx.pid].res;
    for (var i = 0; i < TECH_ORDER.length; i++) {
      var track = TECH_ORDER[i];
      var level = RTS.research.level(ctx.world, ctx.pid, track);
      var next = RTS.data.upgrades[track].levels[level];
      if (!next || level >= cfg.techLevel) continue;
      var spare = Object.keys(next.cost).every(function (k) { return res[k] - next.cost[k] >= TECH_SPARE; });
      if (!spare || AI.age.holds(ctx, next.cost)) continue;
      var at = ctx.buildings.filter(function (b) {
        var r = RTS.data.buildings[b.type].researches;
        return b.complete && !b.queue.length && r && r.indexOf(track) >= 0;
      })[0];
      if (at && ctx.issue({ type: 'research', buildingId: at.id, track: track }).ok) return;
    }
  }

  function develop(ctx) {
    var cfg = ctx.cfg.economy;
    camps(ctx, cfg);
    farming(ctx, cfg);
    research(ctx, cfg);
  }

  AI.camps = { develop: develop, spotNear: spotNear };
})();
