// AI 內政：村民分工、蓋房屋與兵營、訓練單位。只透過 RTS.commands 操作遊戲。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  function gathererResource(u) {
    if (u.order.type === 'gather') return u.order.resource;
    if (u.order.type === 'hunt') return 'food';
    if (u.order.resume) return u.order.resume.resource;
    return null;
  }

  // 從離村民最近的主堡找起，那座附近沒有才換下一座
  function nearestNode(ctx, resource, villager) {
    var towns = ctx.towns.slice().sort(function (a, b) {
      return RTS.world.distTo(villager.x, villager.y, a) - RTS.world.distTo(villager.x, villager.y, b);
    });
    for (var i = 0; i < towns.length; i++) {
      var node = nodeNear(ctx, resource, towns[i]);
      if (node) return node;
    }
    return null;
  }

  // 最近的資源；食物也包含己方空著的農田
  function nodeNear(ctx, resource, town) {
    var from = RTS.world.center(town);
    return RTS.world.nearest(ctx.world, from.x, from.y, function (e) {
      if (RTS.farm.isFarm(e)) {
        return resource === 'food' && e.owner === ctx.pid && e.complete && e.amount > 0 &&
          !ctx.state.badNodes[e.id] && !RTS.farm.farmerOf(ctx.world, e);
      }
      return e.kind === 'node' && RTS.data.nodes[e.type].resource === resource &&
        !ctx.state.badNodes[e.id] && RTS.fog.knows(ctx.world, ctx.pid, e) &&
        RTS.map.hasFreeNeighbor(ctx.world.map, e);
    });
  }

  function sendToGather(ctx, villager, resource) {
    var node = nearestNode(ctx, resource, villager);
    if (!node) {
      if (resource === 'food') ctx.state.needFarm = true;      // 野外食物與空農田都沒了
      return false;
    }
    var r = ctx.issue({ type: 'gather', unitIds: [villager.id], targetId: node.id });
    if (r.ok) ctx.state.assigned[villager.id] = { nodeId: node.id, time: ctx.world.time };
    return r.ok;
  }

  // 依缺口大小排序的資源清單
  function ratioOf(ctx) {
    return RTS.research.age(ctx.world, ctx.pid) === 0 ? ctx.cfg.gatherRatioDark : ctx.cfg.gatherRatio;
  }

  function wanted(ctx, counts, total) {
    var ratio = ratioOf(ctx);
    // 只分配 AI 會採的資源（比例表裡有的）
    return Object.keys(ratio).sort(function (a, b) {
      return (ratio[b] * total - counts[b]) - (ratio[a] * total - counts[a]);
    });
  }

  function assignVillagers(ctx) {
    var counts = { food: 0, wood: 0, gold: 0, stone: 0 };
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
    var need = order[0], surplus = order[order.length - 1], ratio = ratioOf(ctx);
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
    var free = ctx.villagers.filter(function (u) {
      return ['build', 'repair', 'garrison', 'hunt'].indexOf(u.order.type) < 0;
    });
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

  // 正在替新主堡或下一個研究存錢時，不花掉保留的資源
  function eatsReserve(ctx, cost) {
    var res = ctx.world.players[ctx.pid].res;
    return [ctx.reserve, ctx.techReserve].some(function (keep) {
      return !!keep && Object.keys(cost).some(function (k) { return keep[k] && res[k] - cost[k] < keep[k]; });
    });
  }

  function countType(list, type) {
    return list.filter(function (e) { return e.type === type; }).length;
  }

  function develop(ctx) {
    var cfg = ctx.cfg;
    var pop = RTS.world.population(ctx.world, ctx.pid);
    // 避難中與外出偵查的單位也要算進目標人數
    var inside = ctx.away, queuedVillagers = 0;
    ctx.towns.forEach(function (tc) {
      inside = inside.concat(tc.garrison || []);
      queuedVillagers += countType(tc.queue, 'villager');
    });
    queuedVillagers += countType(inside, 'villager');
    var saving = ctx.state.saving;
    var target = cfg.villagerTarget + (ctx.towns.length > 1 ? cfg.expand.extraVillagers : 0);
    ctx.towns.forEach(function (tc) {
      if (saving || ctx.villagers.length + queuedVillagers >= target || countType(tc.queue, 'villager') >= 1) return;
      if (ctx.issue({ type: 'train', buildingId: tc.id, unit: 'villager' }).ok) queuedVillagers++;
    });

    var housePending = ctx.buildings.some(function (b) { return b.type === 'house' && !b.complete; });
    var needHouse = pop.cap - pop.used - pop.queued <= 2 && !housePending;
    if (needHouse) startBuilding(ctx, 'house');

    var barracks = countType(ctx.buildings, 'barracks');
    var res = ctx.world.players[ctx.pid].res;
    if ((barracks === 0 && ctx.villagers.length >= 7) ||
        (barracks > 0 && barracks < cfg.maxBarracks && res.wood > 320)) {
      startBuilding(ctx, 'barracks');
    }
    // 封建時代後各蓋一座靶場與馬廄，再補箭塔；城堡時代要攻城槌時蓋攻城工坊
    var age = RTS.research.age(ctx.world, ctx.pid);
    if (age >= 1 && barracks > 0 && !saving) {
      ['archeryRange', 'stable'].forEach(function (type) {
        if (!countType(ctx.buildings, type) && res.wood > 160) startBuilding(ctx, type);
      });
      var towersPending = ctx.buildings.some(function (b) { return b.type === 'tower' && !b.complete; });
      if (countType(ctx.buildings, 'tower') < cfg.military.towers && !towersPending) startBuilding(ctx, 'tower');
      if (age >= 2 && cfg.military.rams > 0 && !countType(ctx.buildings, 'siegeWorkshop') &&
          ctx.army.length >= cfg.attackSize) startBuilding(ctx, 'siegeWorkshop');
    }
    tendSites(ctx);
    // 存錢升時代時暫停訓練；後期成長中仍每隔一段時間補一名士兵，軍隊才長得起來
    var drip = saving && !!cfg.growing && ctx.world.time - ctx.state.lastDrip >= cfg.late.drip;
    if (saving && !drip) return;

    var trainers = ctx.buildings.filter(function (b) {
      return b.complete && RTS.data.buildings[b.type].trains.some(function (u) { return RTS.data.units[u].military; });
    });
    var queued = [];
    trainers.forEach(function (b) { queued = queued.concat(b.queue); });
    function count(type) { return countType(ctx.army, type) + countType(queued, type); }
    var enemy = AI.counter.tally(ctx);
    ctx.techReserve = AI.tech.reserve(ctx);
    function wanted(type) {
      if (!RTS.civs.allows(ctx.world, ctx.pid, type)) return false;
      // 長槍兵、標槍兵是專門剋制用的：看到對應的敵軍才訓練，人數不超過對方
      if (type === 'spearman' || type === 'skirmisher') return count(type) < enemy.against(type);
      if (type === 'ram') return count(type) < cfg.military.rams;
      return !RTS.data.units[type].heal;          // AI 不訓練治療者
    }
    // 能訓練剋制兵種的建築先拿到軍隊名額
    function best(b) {
      return Math.max.apply(null, [0].concat(RTS.data.buildings[b.type].trains.filter(wanted).map(enemy.weight)));
    }
    // 相對於比重人數最少的兵種優先；沒看到敵軍時各兵種大致平均
    function need(type) { return (count(type) + 1) / enemy.weight(type); }
    // 同樣能剋制敵軍時，最缺人的建築先訓練；有訓練間隔時才不會永遠輪到第一座
    function lack(b) {
      return Math.min.apply(null, [Infinity].concat(RTS.data.buildings[b.type].trains.filter(wanted).map(need)));
    }
    function resting() { return ctx.world.time - ctx.state.lastTrain < cfg.trainGap; }
    trainers.slice().sort(function (a, b) { return best(b) - best(a) || lack(a) - lack(b); }).forEach(function (b) {
      if (b.queue.length >= 2 || (saving && !drip) || resting()) return;
      var picks = RTS.data.buildings[b.type].trains.filter(wanted).sort(function (x, y) { return need(x) - need(y); });
      for (var i = 0; i < picks.length; i++) {
        // 缺房屋時不把木材花在要木材的兵種上
        if (needHouse && RTS.data.units[picks[i]].cost.wood) continue;
        if (eatsReserve(ctx, RTS.data.units[picks[i]].cost)) continue;
        if (ctx.issue({ type: 'train', buildingId: b.id, unit: picks[i] }).ok) {
          ctx.state.lastTrain = ctx.world.time;
          queued.push({ type: picks[i] });
          if (saving) { drip = false; ctx.state.lastDrip = ctx.world.time; }
          break;
        }
      }
    });
  }

  AI.economy = { assignVillagers: assignVillagers, develop: develop, startBuilding: startBuilding,
    pickBuilder: pickBuilder, hasMargin: hasMargin };
})();
