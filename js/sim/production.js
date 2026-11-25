// 單位生產佇列：扣款、人口限制、出兵位置。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  // 能否加入佇列（介面按鈕與指令共用）
  function check(world, b, unitType) {
    var def = RTS.data.buildings[b.type], unit = RTS.data.units[unitType];
    if (!unit || def.trains.indexOf(unitType) < 0) return { ok: false, reason: 'cannotTrain' };
    if (!b.complete) return { ok: false, reason: 'notComplete' };
    if (b.queue.length >= RTS.data.QUEUE_MAX) return { ok: false, reason: 'queueFull' };
    var pop = RTS.world.population(world, b.owner);
    if (pop.used + pop.queued + unit.pop > pop.cap) return { ok: false, reason: 'popCap' };
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

  // 建築外圍最靠近地圖中央的空格
  function spawnTile(world, b) {
    var map = world.map, cx = map.width / 2, cy = map.height / 2;
    for (var r = 1; r <= 4; r++) {
      var best = null, bestD = Infinity;
      for (var y = b.y - r; y < b.y + b.h + r; y++) {
        for (var x = b.x - r; x < b.x + b.w + r; x++) {
          var onRing = x === b.x - r || y === b.y - r || x === b.x + b.w + r - 1 || y === b.y + b.h + r - 1;
          if (!onRing || !RTS.map.isWalkable(map, x, y)) continue;
          var d = RTS.util.dist(x, y, cx, cy);
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
      world.players[b.owner].upgrades[item.research] = item.level + 1;
      b.queue.shift();
      return;
    }
    var unit = RTS.data.units[item.type];
    var pop = RTS.world.population(world, b.owner);
    if (pop.used + unit.pop > pop.cap) return;      // 房屋被拆時暫停在 100%
    var tile = spawnTile(world, b);
    if (!tile) return;
    RTS.world.addUnit(world, item.type, b.owner, tile.x + 0.5, tile.y + 0.5);
    b.queue.shift();
  }

  RTS.production = { check: check, enqueue: enqueue, cancel: cancel, update: update };
})();
