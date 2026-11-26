// AI 擴張：在遠處資源旁蓋第二座主堡，被毀一座就重建。只透過指令介面操作。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  var MIN_TOWN = 14;     // 新主堡的資源點離己方主堡至少幾格
  var MIN_ENEMY = 18;    // 離已知敵方建築至少幾格
  var GROVE = 6;         // 附近至少幾棵樹才算值得擴張的樹林
  var BACKUP = 12;       // 找不到合適資源點時，往地圖中央幾格處蓋

  function nearestDist(list, x, y) {
    return list.reduce(function (best, b) { return Math.min(best, RTS.world.distTo(x, y, b)); }, Infinity);
  }

  // 值得擴張的位置：金礦優先、其次樹林，各自由近到遠；只用看過的資源與敵方建築
  function sites(ctx) {
    var world = ctx.world, home = RTS.world.center(ctx.tc);
    var towns = ctx.buildings.filter(function (b) { return b.type === 'townCenter'; });
    var enemies = RTS.fog.perceived(world, ctx.pid).filter(function (e) {
      return e.kind === 'building' && e.owner !== ctx.pid;
    });
    var known = RTS.world.list(world, function (e) {
      return e.kind === 'node' && (e.type === 'gold' || e.type === 'tree') && RTS.fog.knows(world, ctx.pid, e);
    });
    var trees = known.filter(function (e) { return e.type === 'tree'; });
    function safe(e) {
      var c = RTS.world.center(e);
      return nearestDist(towns, c.x, c.y) >= MIN_TOWN && nearestDist(enemies, c.x, c.y) >= MIN_ENEMY;
    }
    function byHome(a, b) {
      return RTS.world.distTo(home.x, home.y, a) - RTS.world.distTo(home.x, home.y, b);
    }
    var gold = known.filter(function (e) { return e.type === 'gold' && safe(e); }).sort(byHome);
    var groves = trees.filter(safe).sort(byHome).filter(function (e) {
      return trees.filter(function (t) { return RTS.util.dist(t.x, t.y, e.x, e.y) <= 4; }).length >= GROVE;
    });
    var list = gold.concat(groves.slice(0, 3)).map(function (e) { return RTS.world.center(e); });
    var dx = world.map.width / 2 - home.x, dy = world.map.height / 2 - home.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    list.push({ x: home.x + dx / len * BACKUP, y: home.y + dy / len * BACKUP });
    return list;
  }

  // 正在存錢升時代時，下一個時代要用的資源不能動
  function spendable(ctx, cost) {
    if (!ctx.state.saving) return true;
    var next = RTS.data.upgrades.age.levels[RTS.research.age(ctx.world, ctx.pid)].cost;
    var res = ctx.world.players[ctx.pid].res;
    return Object.keys(cost).every(function (k) { return res[k] - cost[k] >= (next[k] || 0); });
  }

  function develop(ctx) {
    var cfg = ctx.cfg.expand, state = ctx.state;
    ctx.reserve = null;
    var all = ctx.buildings.filter(function (b) { return b.type === 'townCenter'; });
    state.mostTowns = Math.max(state.mostTowns, ctx.towns.length);
    if (all.length >= cfg.towns) return;
    // 失去過主堡就直接重建，不再檢查發展程度
    var rebuild = state.mostTowns > all.length;
    if (!rebuild && (RTS.research.age(ctx.world, ctx.pid) < cfg.minAge ||
        ctx.villagers.length < cfg.minVillagers || ctx.army.length < cfg.minArmy)) return;
    var cost = RTS.data.buildings.townCenter.cost;
    if (!RTS.world.canAfford(ctx.world, ctx.pid, cost) || !spendable(ctx, cost)) {
      // 兵力足夠時才替主堡存錢，免得存錢期間毫無防備
      if (ctx.army.length >= cfg.minArmy) ctx.reserve = cost;
      return;
    }
    var list = sites(ctx);
    for (var i = 0; i < list.length; i++) {
      var spot = AI.camps.spotNear(ctx, 'townCenter', list[i].x, list[i].y, 7, true);
      if (!spot) continue;
      var builder = AI.economy.pickBuilder(ctx, spot.tx, spot.ty);
      if (builder && ctx.issue({
        type: 'build', unitIds: [builder.id], building: 'townCenter', tx: spot.tx, ty: spot.ty
      }).ok) return;
    }
  }

  AI.expand = { develop: develop, sites: sites };
})();
