// 研究升級：查詢目前等級與加成、能否研究。排程沿用建築的生產佇列。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function level(world, pid, track) {
    return world.players[pid].upgrades[track] || 0;
  }

  function pending(world, pid, track) {
    var found = false;
    world.entities.forEach(function (e) {
      if (e.kind !== 'building' || e.owner !== pid) return;
      if (e.queue.some(function (q) { return q.research === track; })) found = true;
    });
    return found;
  }

  // 某兵種類別目前的加成總和；stat 為 'attack' 或 'armor'
  function bonus(world, pid, unitType, stat) {
    var cls = RTS.data.units[unitType] && RTS.data.units[unitType].upgradeClass;
    if (!cls) return 0;
    var total = 0;
    Object.keys(RTS.data.upgrades).forEach(function (track) {
      var up = RTS.data.upgrades[track];
      if (up.unitClass !== cls || up.stat !== stat) return;
      for (var i = 0; i < level(world, pid, track); i++) total += up.levels[i].bonus;
    });
    return total;
  }

  function check(world, b, track) {
    var def = RTS.data.buildings[b.type];
    if (!def.researches || def.researches.indexOf(track) < 0) return { ok: false, reason: 'cannotResearch' };
    if (!b.complete) return { ok: false, reason: 'notComplete' };
    var next = RTS.data.upgrades[track].levels[level(world, b.owner, track)];
    if (!next) return { ok: false, reason: 'maxLevel' };
    if (pending(world, b.owner, track)) return { ok: false, reason: 'alreadyResearching' };
    if (b.queue.length >= RTS.data.QUEUE_MAX) return { ok: false, reason: 'queueFull' };
    if (!RTS.world.canAfford(world, b.owner, next.cost)) return { ok: false, reason: 'notEnoughResources' };
    return { ok: true };
  }

  function enqueue(world, b, track) {
    var result = check(world, b, track);
    if (!result.ok) return result;
    var lv = level(world, b.owner, track);
    RTS.world.pay(world, b.owner, RTS.data.upgrades[track].levels[lv].cost);
    b.queue.push({ research: track, level: lv, progress: 0 });
    return result;
  }

  RTS.research = { level: level, pending: pending, bonus: bonus, check: check, enqueue: enqueue };
})();
