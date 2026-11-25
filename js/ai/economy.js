// AI 內政：村民分工、蓋房屋與兵營、訓練單位。只透過 RTS.commands 操作遊戲。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  function gathererResource(u) {
    if (u.order.type === 'gather') return u.order.resource;
    if (u.order.type === 'build' && u.order.resume) return u.order.resume.resource;
    return null;
  }

  function nearestNode(ctx, resource) {
    var from = RTS.world.center(ctx.tc);
    return RTS.world.nearest(ctx.world, from.x, from.y, function (e) {
      return e.kind === 'node' && RTS.data.nodes[e.type].resource === resource &&
        !ctx.state.badNodes[e.id] && RTS.map.hasFreeNeighbor(ctx.world.map, e);
    });
  }

  function sendToGather(ctx, villager, resource) {
    var node = nearestNode(ctx, resource);
    if (!node) return false;
    var r = ctx.issue({ type: 'gather', unitIds: [villager.id], targetId: node.id });
    if (r.ok) ctx.state.assigned[villager.id] = { nodeId: node.id, time: ctx.world.time };
    return r.ok;
  }

  // 依缺口大小排序的資源清單
  function wanted(ctx, counts, total) {
    var ratio = RTS.data.ai.gatherRatio;
    return RTS.data.resources.slice().sort(function (a, b) {
      return (ratio[b] * total - counts[b]) - (ratio[a] * total - counts[a]);
    });
  }

  function assignVillagers(ctx) {
    var counts = { food: 0, wood: 0, gold: 0 };
    ctx.villagers.forEach(function (u) {
      var r = gathererResource(u);
      if (r) counts[r]++;
    });
    var total = ctx.villagers.length;

    ctx.villagers.forEach(function (u) {
      if (u.order.type !== 'idle') return;
      var last = ctx.state.assigned[u.id];
      // 剛派出去就閒下來：多半走不到，暫時不再派往同一個資源點
      if (last && ctx.world.time - last.time < 3) ctx.state.badNodes[last.nodeId] = true;
      var list = wanted(ctx, counts, total);
      for (var i = 0; i < list.length; i++) {
        if (sendToGather(ctx, u, list[i])) { counts[list[i]]++; break; }
      }
    });

    // 比例嚴重失衡時，每次調一個人
    var order = wanted(ctx, counts, total);
    var need = order[0], surplus = order[order.length - 1], ratio = RTS.data.ai.gatherRatio;
    if (ratio[need] * total - counts[need] >= 2 && counts[surplus] > ratio[surplus] * total) {
      var mover = ctx.villagers.filter(function (u) {
        return u.order.type === 'gather' && u.order.resource === surplus && u.carry.amount < 3;
      })[0];
      if (mover) sendToGather(ctx, mover, need);
    }
  }

  // 由主堡向外找建地，四周保留一格走道
  function findSpot(ctx, type) {
    var size = RTS.data.buildings[type].size, map = ctx.world.map, tc = ctx.tc;
    var cx = tc.x + 1, cy = tc.y + 1;
    for (var r = 4; r <= 18; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var tx = cx + dx - 1, ty = cy + dy - 1;
          if (!RTS.construction.canPlace(ctx.world, ctx.pid, type, tx, ty).ok) continue;
          if (hasMargin(map, tx, ty, size)) return { tx: tx, ty: ty };
        }
      }
    }
    return null;
  }

  function hasMargin(map, tx, ty, size) {
    for (var y = ty - 1; y <= ty + size; y++) {
      for (var x = tx - 1; x <= tx + size; x++) {
        if (!RTS.map.isWalkable(map, x, y)) return false;
      }
    }
    return true;
  }

  function pickBuilder(ctx, x, y) {
    var free = ctx.villagers.filter(function (u) { return u.order.type !== 'build'; });
    free.sort(function (a, b) {
      return RTS.util.dist(a.x, a.y, x, y) - RTS.util.dist(b.x, b.y, x, y);
    });
    return free[0] || null;
  }

  function startBuilding(ctx, type) {
    if (!RTS.world.canAfford(ctx.world, ctx.pid, RTS.data.buildings[type].cost)) return false;
    var spot = findSpot(ctx, type);
    var builder = spot && pickBuilder(ctx, spot.tx, spot.ty);
    if (!builder) return false;
    return ctx.issue({
      type: 'build', unitIds: [builder.id], building: type, tx: spot.tx, ty: spot.ty
    }).ok;
  }

  // 沒人蓋的工地補派村民；長時間沒進度就取消退款
  function tendSites(ctx) {
    ctx.buildings.forEach(function (b) {
      if (b.complete) return;
      var seen = ctx.state.sites[b.id];
      if (!seen || b.progress > seen.progress) {
        ctx.state.sites[b.id] = { progress: b.progress, time: ctx.world.time };
      } else if (ctx.world.time - seen.time > 45) {
        ctx.issue({ type: 'cancelBuild', buildingId: b.id });
        return;
      }
      var busy = ctx.villagers.some(function (u) {
        return u.order.type === 'build' && u.order.targetId === b.id;
      });
      var builder = !busy && pickBuilder(ctx, b.x, b.y);
      if (builder) ctx.issue({ type: 'assist', unitIds: [builder.id], targetId: b.id });
    });
  }

  function countType(list, type) {
    return list.filter(function (e) { return e.type === type; }).length;
  }

  function develop(ctx) {
    var cfg = RTS.data.ai;
    var pop = RTS.world.population(ctx.world, ctx.pid);
    var queuedVillagers = countType(ctx.tc.queue, 'villager');
    if (ctx.villagers.length + queuedVillagers < cfg.villagerTarget && ctx.tc.queue.length < 1) {
      ctx.issue({ type: 'train', buildingId: ctx.tc.id, unit: 'villager' });
    }

    var housePending = ctx.buildings.some(function (b) { return b.type === 'house' && !b.complete; });
    var needHouse = pop.cap - pop.used - pop.queued <= 2 && pop.cap < RTS.data.POP_MAX && !housePending;
    if (needHouse) startBuilding(ctx, 'house');

    var barracks = countType(ctx.buildings, 'barracks');
    var res = ctx.world.players[ctx.pid].res;
    if ((barracks === 0 && ctx.villagers.length >= 7) ||
        (barracks > 0 && barracks < cfg.maxBarracks && res.wood > 320)) {
      startBuilding(ctx, 'barracks');
    }
    tendSites(ctx);

    var training = 0;
    ctx.buildings.forEach(function (b) { if (b.type === 'barracks') training += b.queue.length; });
    ctx.buildings.forEach(function (b) {
      if (b.type !== 'barracks' || !b.complete || b.queue.length >= 2) return;
      if (ctx.army.length + training >= cfg.armyMax) return;
      var swords = countType(ctx.army, 'swordsman') + countType(b.queue, 'swordsman');
      var archers = countType(ctx.army, 'archer') + countType(b.queue, 'archer');
      var picks = swords <= archers ? ['swordsman', 'archer'] : ['archer', 'swordsman'];
      for (var i = 0; i < picks.length; i++) {
        // 缺房屋時不把木材花在弓箭手上
        if (needHouse && RTS.data.units[picks[i]].cost.wood) continue;
        if (ctx.issue({ type: 'train', buildingId: b.id, unit: picks[i] }).ok) { training++; break; }
      }
    });
  }

  AI.economy = { assignVillagers: assignVillagers, develop: develop };
})();
