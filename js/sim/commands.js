// 指令介面：玩家輸入與 AI 唯一能操作遊戲的入口。所有指令都在此驗證擁有權。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function fail(reason) { return { ok: false, reason: reason }; }
  function done(action) { return { ok: true, action: action }; }

  function ownUnits(world, pid, ids) {
    return (ids || []).map(function (id) { return RTS.world.get(world, id); }).filter(function (u) {
      return u && u.kind === 'unit' && u.owner === pid;
    });
  }

  // 己方認領的牲畜：只接受移動與停止
  function ownAnimals(world, pid, ids) {
    return (ids || []).map(function (id) { return RTS.world.get(world, id); }).filter(function (a) {
      return a && a.kind === 'animal' && a.owner === pid;
    });
  }

  function villagersIn(units) {
    return units.filter(function (u) { return RTS.data.units[u.type].canBuild; });
  }

  function ownBuilding(world, pid, id) {
    var b = RTS.world.get(world, id);
    return b && b.kind === 'building' && b.owner === pid ? b : null;
  }

  // 多單位移動：分配互不重複的目的格，離目標近的單位拿中央位置
  function moveUnits(world, units, x, y, type) {
    var map = world.map;
    var tx = RTS.util.clamp(Math.floor(x), 0, map.width - 1);
    var ty = RTS.util.clamp(Math.floor(y), 0, map.height - 1);
    var tiles = RTS.map.spreadTiles(map, tx, ty, units.length);
    if (!tiles.length) return fail('noDestination');
    units.slice().sort(function (a, b) {
      return RTS.util.dist(a.x, a.y, tx, ty) - RTS.util.dist(b.x, b.y, tx, ty);
    }).forEach(function (u, i) {
      var t = tiles[Math.min(i, tiles.length - 1)];
      if (u.kind === 'animal') RTS.animals.walk(u, t.x, t.y);
      else RTS.orders.set(u, { type: type || 'move', x: t.x, y: t.y });
    });
    return done(type || 'move');
  }

  var handlers = {
    move: function (world, pid, c, units, herd) {
      var all = units.concat(herd || []);
      return all.length ? moveUnits(world, all, c.x, c.y) : fail('noUnits');
    },
    attackMove: function (world, pid, c, units) {
      return units.length ? moveUnits(world, units, c.x, c.y, 'attackMove') : fail('noUnits');
    },
    stop: function (world, pid, c, units, herd) {
      units.forEach(function (u) { RTS.orders.set(u, { type: 'idle' }); });
      (herd || []).forEach(RTS.animals.halt);
      return done('stop');
    },
    gather: function (world, pid, c, units) {
      var node = RTS.world.get(world, c.targetId);
      if (!node || node.kind !== 'node' || !RTS.data.nodes[node.type].resource) return fail('notGatherable');
      var workers = villagersIn(units);
      if (!workers.length) return fail('villagersOnlyGather');
      workers.forEach(function (u) { RTS.orders.set(u, RTS.gather.makeOrder(node)); });
      return done('gather');
    },
    hunt: function (world, pid, c, units) {
      var t = RTS.world.get(world, c.targetId), workers = villagersIn(units);
      if (!t || t.kind !== 'animal') return fail('noHuntTarget');
      if (!workers.length) return fail('villagersOnlyHunt');
      workers.forEach(function (u) { RTS.orders.set(u, { type: 'hunt', targetId: t.id, fails: 0 }); });
      return done('hunt');
    },
    deposit: function (world, pid, c, units) {
      var carriers = units.filter(function (u) { return u.carry.amount > 0; });
      carriers.forEach(function (u) { RTS.orders.set(u, { type: 'deposit' }); });
      return carriers.length ? done('deposit') : fail('nothingCarried');
    },
    attack: function (world, pid, c, units) {
      var t = RTS.world.get(world, c.targetId);
      var wild = t && t.kind === 'animal' && t.owner !== pid;
      if (!t || (!wild && (t.owner === null || t.owner === pid))) return fail('cannotAttack');
      if (!units.length) return fail('noUnits');
      units.forEach(function (u) { RTS.orders.set(u, { type: 'attack', targetId: t.id, auto: false }); });
      return done('attack');
    },
    assist: function (world, pid, c, units) {
      var b = ownBuilding(world, pid, c.targetId), workers = villagersIn(units);
      if (!b || b.complete) return fail('nothingToBuild');
      if (!workers.length) return fail('villagersOnlyBuild');
      workers.forEach(function (u) { assignJob(u, 'build', b); });
      return done('assist');
    },
    repair: function (world, pid, c, units) {
      var b = ownBuilding(world, pid, c.targetId), workers = villagersIn(units);
      if (!RTS.repair.canRepair(b)) return fail('cannotRepair');
      if (!workers.length) return fail('villagersOnlyRepair');
      workers.forEach(function (u) { assignJob(u, 'repair', b); });
      return done('repair');
    },
    garrison: function (world, pid, c, units) {
      var b = ownBuilding(world, pid, c.targetId);
      if (!b || !b.complete || !RTS.garrison.capacity(b)) return fail('cannotGarrison');
      if (!RTS.garrison.hasRoom(b)) return fail('garrisonFull');
      if (!units.length) return fail('noUnits');
      units.forEach(function (u) { assignJob(u, 'garrison', b); });
      return done('garrison');
    },
    ungarrison: function (world, pid, c) {
      var b = ownBuilding(world, pid, c.buildingId);
      if (!b || !RTS.garrison.count(b)) return fail('nothingGarrisoned');
      return RTS.garrison.release(world, b) ? done('ungarrison') : fail('noDestination');
    },
    setRally: function (world, pid, c) {
      var b = ownBuilding(world, pid, c.buildingId);
      if (!RTS.rally.canRally(b)) return fail('cannotRally');
      RTS.rally.set(world, b, c.x, c.y, c.targetId);
      return done('setRally');
    },
    build: function (world, pid, c, units) {
      var def = RTS.data.buildings[c.building], workers = villagersIn(units);
      if (!def) return fail('unknownBuilding');
      if (!workers.length) return fail('needVillagers');
      var tx = Math.floor(c.tx), ty = Math.floor(c.ty);
      var check = RTS.construction.canPlace(world, pid, c.building, tx, ty);
      if (!check.ok) return check;
      if (!RTS.world.pay(world, pid, def.cost)) return fail('notEnoughResources');
      var b = RTS.construction.place(world, pid, c.building, tx, ty);
      workers.forEach(function (u) { assignJob(u, 'build', b); });
      return { ok: true, action: 'build', buildingId: b.id };
    },
    cancelBuild: function (world, pid, c) {
      var b = ownBuilding(world, pid, c.buildingId);
      return b && RTS.construction.cancel(world, b) ? done('cancelBuild') : fail('cannotCancel');
    },
    train: function (world, pid, c) {
      var b = ownBuilding(world, pid, c.buildingId);
      return b ? RTS.production.enqueue(world, b, c.unit) : fail('buildingNotFound');
    },
    cancelTrain: function (world, pid, c) {
      var b = ownBuilding(world, pid, c.buildingId);
      return b && RTS.production.cancel(world, b, c.index) ? done('cancelTrain') : fail('cannotCancel');
    },
    research: function (world, pid, c) {
      var b = ownBuilding(world, pid, c.buildingId);
      return b ? RTS.research.enqueue(world, b, c.track) : fail('buildingNotFound');
    },
    // 右鍵智慧指令：依目標決定移動、採集、攻擊、施工或交付
    smart: function (world, pid, c, units, herd) {
      if (!units.length) return handlers.move(world, pid, c, units, herd);
      var t = c.targetId ? RTS.world.get(world, c.targetId) : null;
      var animal = t && t.kind === 'animal';
      if (t && !animal && t.owner !== null && t.owner !== pid) return handlers.attack(world, pid, c, units);
      var left = units.slice(), result = null;
      // 把符合條件的單位分去做特定工作，其餘的照常移動
      function dispatch(type, takers) {
        if (!takers.length) return;
        result = handlers[type](world, pid, c, takers);
        left = left.filter(function (u) { return takers.indexOf(u) < 0; });
      }
      if (animal) {
        dispatch('hunt', villagersIn(left));
        // 士兵會攻擊敵方牲畜與野生的獵物、猛獸，但不殺中立或己方牲畜
        var hostile = t.owner !== pid &&
          (t.owner !== null || RTS.data.animals[t.type].behavior !== 'herd');
        if (hostile) dispatch('attack', left.slice());
      } else if (t && t.kind === 'node' && RTS.data.nodes[t.type].resource) {
        dispatch('gather', villagersIn(left));
      } else if (t && t.kind === 'building' && !t.complete) {
        dispatch('assist', villagersIn(left));
      } else if (t && t.kind === 'building') {
        if (RTS.data.buildings[t.type].dropoff) {
          dispatch('deposit', left.filter(function (u) { return u.carry.amount > 0; }));
        }
        if (RTS.repair.canRepair(t)) dispatch('repair', villagersIn(left));
        if (RTS.garrison.hasRoom(t)) dispatch('garrison', left);
      }
      var followers = left.concat((herd || []).filter(function (a) { return a !== t; }));
      if (followers.length) {
        var moved = moveUnits(world, followers, c.x, c.y);
        result = result || moved;
      }
      return result;
    }
  };

  // 施工或修理；記下原本的採集工作，做完後接續
  function assignJob(u, type, building) {
    var prev = u.order;
    var resume = prev.type === 'gather' ? prev : prev.resume || null;
    RTS.orders.set(u, { type: type, targetId: building.id, resume: resume, fails: 0 });
  }

  function issue(world, pid, command) {
    if (world.over) return fail('gameOver');
    var handler = command && Object.prototype.hasOwnProperty.call(handlers, command.type) && handlers[command.type];
    if (!handler) return fail('unknownCommand');
    return handler(world, pid, command,
      ownUnits(world, pid, command.unitIds), ownAnimals(world, pid, command.unitIds));
  }

  RTS.commands = { issue: issue };
})();
