// 單位生產佇列：扣款、人口限制、出兵位置。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  // 能否加入佇列（介面按鈕與指令共用）
  function check(world, b, unitType) {
    var def = RTS.data.buildings[b.type], unit = RTS.data.units[unitType];
    if (!unit || def.trains.indexOf(unitType) < 0) return { ok: false, reason: 'cannotTrain' };
    if (!RTS.civs.allows(world, b.owner, unitType)) return { ok: false, reason: 'wrongCiv' };
    if (!b.complete) return { ok: false, reason: 'notComplete' };
    var tooEarly = RTS.research.ageFail(world, b.owner, unit.age);
    if (tooEarly) return tooEarly;
    if (b.queue.length >= RTS.data.QUEUE_MAX) return { ok: false, reason: 'queueFull' };
    var pop = RTS.world.population(world, b.owner);
    if (pop.used + pop.queued + unit.pop > pop.cap) {
      // 已到總上限時蓋房屋也沒用，訊息要分開
      return pop.cap >= RTS.data.POP_MAX ? { ok: false, reason: 'popMax' } : { ok: false, reason: 'popCap' };
    }
    if (!RTS.world.canAfford(world, b.owner, unit.cost)) return { ok: false, reason: 'notEnoughResources' };
    return { ok: true };
  }

  function enqueue(world, b, unitType) {
    var result = check(world, b, unitType);
    if (!result.ok) return result;
    RTS.world.pay(world, b.owner, RTS.data.units[unitType].cost);
    b.queue.push({ type: unitType, progress: 0 });
    return result;
  }

  // 佇列項目是訓練單位或研究升級
  function itemSpec(item) {
    if (item.research) return RTS.data.upgrades[item.research].levels[item.level];
    if (item.branch) return RTS.data.buildings[item.building].branches[item.branch];
    var unit = RTS.data.units[item.type];
    return { cost: unit.cost, time: unit.trainTime };
  }

  function cancel(world, b, index) {
    var item = b.queue[index];
    if (!item) return false;
    b.queue.splice(index, 1);
    RTS.world.refund(world, b.owner, itemSpec(item).cost);
    return true;
  }

  // 各朝向（b.dir 0～3）正門所在的那一側
  var DOORS = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }];

  // 建築外圍的空格：同一圈內先找正門那一側，再取離正門最近的
  function spawnTile(world, b) {
    var map = world.map, door = DOORS[b.dir || 0];
    var cx = b.x + (b.w - 1) / 2 + door.x * (b.w + 1) / 2, cy = b.y + (b.h - 1) / 2 + door.y * (b.h + 1) / 2;
    function inFront(x, y) {
      if (door.x) return door.x > 0 ? x >= b.x + b.w : x < b.x;
      return door.y > 0 ? y >= b.y + b.h : y < b.y;
    }
    for (var r = 1; r <= 4; r++) {
      var best = null, bestD = Infinity;
      for (var y = b.y - r; y < b.y + b.h + r; y++) {
        for (var x = b.x - r; x < b.x + b.w + r; x++) {
          var onRing = x === b.x - r || y === b.y - r || x === b.x + b.w + r - 1 || y === b.y + b.h + r - 1;
          if (!onRing || !RTS.map.isWalkable(map, x, y)) continue;
          var d = RTS.util.dist(x, y, cx, cy) + (inFront(x, y) ? 0 : map.width + map.height);
          if (d < bestD) { bestD = d; best = { x: x, y: y }; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function update(world, b, dt) {
    var item = b.queue[0];
    if (!b.complete || !item) return;
    item.progress = Math.min(1, item.progress + dt / itemSpec(item).time);
    if (item.progress < 1 - 1e-9) return;
    if (item.research) {
      RTS.research.complete(world, b.owner, item.research, item.level);
      b.queue.shift();
      return;
    }
    if (item.branch) {
      b.branch = item.branch;
      b.queue.shift();
      return;
    }
    var unit = RTS.data.units[item.type];
    var pop = RTS.world.population(world, b.owner);
    if (pop.used + unit.pop > pop.cap) return;      // 房屋被拆時暫停在 100%
    var tile = spawnTile(world, b);
    if (!tile) return;
    var born = RTS.world.addUnit(world, item.type, b.owner, tile.x + 0.5, tile.y + 0.5);
    b.queue.shift();
    RTS.achievements.trained(world, b.owner, item.type);
    RTS.rally.apply(world, b, born);
  }

  RTS.production = { spawnTile: spawnTile, check: check, enqueue: enqueue, cancel: cancel, update: update };
})();
