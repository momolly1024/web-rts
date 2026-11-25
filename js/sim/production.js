// 單位生產佇列：扣款、人口限制、出兵位置。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  // 能否加入佇列（介面按鈕與指令共用）
  function check(world, b, unitType) {
    var def = RTS.data.buildings[b.type], unit = RTS.data.units[unitType];
    if (!unit || def.trains.indexOf(unitType) < 0) return { ok: false, reason: '這裡無法訓練該單位' };
    if (!b.complete) return { ok: false, reason: '建築尚未完工' };
    if (b.queue.length >= RTS.data.QUEUE_MAX) return { ok: false, reason: '生產佇列已滿' };
    var pop = RTS.world.population(world, b.owner);
    if (pop.used + pop.queued + unit.pop > pop.cap) return { ok: false, reason: '人口已達上限，請蓋房屋' };
    if (!RTS.world.canAfford(world, b.owner, unit.cost)) return { ok: false, reason: '資源不足' };
    return { ok: true };
  }

  function enqueue(world, b, unitType) {
    var result = check(world, b, unitType);
    if (!result.ok) return result;
    RTS.world.pay(world, b.owner, RTS.data.units[unitType].cost);
    b.queue.push({ type: unitType, progress: 0 });
    return result;
  }

  function cancel(world, b, index) {
    var item = b.queue[index];
    if (!item) return false;
    b.queue.splice(index, 1);
    RTS.world.refund(world, b.owner, RTS.data.units[item.type].cost);
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
    var unit = RTS.data.units[item.type];
    item.progress = Math.min(1, item.progress + dt / unit.trainTime);
    if (item.progress < 1 - 1e-9) return;
    var pop = RTS.world.population(world, b.owner);
    if (pop.used + unit.pop > pop.cap) return;      // 房屋被拆時暫停在 100%
    var tile = spawnTile(world, b);
    if (!tile) return;
    RTS.world.addUnit(world, item.type, b.owner, tile.x + 0.5, tile.y + 0.5);
    b.queue.shift();
  }

  RTS.production = { check: check, enqueue: enqueue, cancel: cancel, update: update };
})();
