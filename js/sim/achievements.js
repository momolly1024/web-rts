// 成就統計：記錄對局中的里程碑，結束時顯示。只讀寫 world，不碰 DOM。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  // 某隻羊成為 pid 的資產（認領或在牲畜圈出生）；同一隻只算一次，小羊長大不重複算
  function gainSheep(world, pid, animal) {
    if (pid === null || pid === undefined) return;
    var owned = world.players[pid].sheepOwned || (world.players[pid].sheepOwned = {});
    owned[animal.id] = true;
  }

  function sheepCount(world, pid) {
    return Object.keys(world.players[pid].sheepOwned || {}).length;
  }

  // 累計一項統計；中立（pid 為 null）不記
  function bump(world, pid, key) {
    if (pid === null || pid === undefined) return;
    var stats = world.players[pid].stats || (world.players[pid].stats = {});
    stats[key] = (stats[key] || 0) + 1;
  }

  function stat(world, pid, key) {
    var stats = world.players[pid].stats;
    return (stats && stats[key]) || 0;
  }

  // 單位陣亡；killer 為擊殺者的玩家，野獸擊殺時為 null
  function unitDied(world, unit, killer) {
    var villager = unit.type === 'villager';
    bump(world, unit.owner, 'lost');
    if (villager) bump(world, unit.owner, 'villagersLost');
    bump(world, killer, 'kills');
    if (villager) bump(world, killer, 'villagerKills');
  }

  // 訓練完成：記士兵數，以及人口是否到過「客滿」成就的門檻
  function trained(world, pid, type) {
    if (RTS.data.units[type].military) bump(world, pid, 'soldiers');
    if (RTS.world.population(world, pid).used >= RTS.data.achievements.need.fullHouse) bump(world, pid, 'fullHouse');
  }

  // 依 data.js 的估計對照表內插出「贏過了幾 % 的玩家」
  function percentile(table, value) {
    if (value <= table[0][0]) return table[0][1];
    for (var i = 1; i < table.length; i++) {
      var a = table[i - 1], b = table[i];
      if (value <= b[0]) return Math.floor(a[1] + (b[1] - a[1]) * (value - a[0]) / (b[0] - a[0]));
    }
    return table[table.length - 1][1];
  }

  // 本局解鎖的成就（不含固定顯示的羊）；count 供文字帶入數字
  function badges(world, pid) {
    var need = RTS.data.achievements.need, out = [];
    var won = world.winner === pid, soldiers = stat(world, pid, 'soldiers');
    function add(id, count) { out.push({ id: id, count: count }); }
    function reach(id, count) { if (count >= need[id]) add(id, count); }

    if (won && world.time <= need.blitz) add('blitz', Math.ceil(need.blitz / 60));
    if (won && !stat(world, pid, 'lost')) add('flawless');
    else if (won && !stat(world, pid, 'villagersLost')) add('guardian');
    reach('slayer', stat(world, pid, 'kills'));
    reach('razer', stat(world, pid, 'razed'));
    if (RTS.research.age(world, pid) >= RTS.data.ages.length - 1) add('castle');
    var towns = RTS.world.buildingsOf(world, pid, 'townCenter').filter(function (b) { return b.complete; }).length;
    reach('expander', towns);
    if (stat(world, pid, 'fullHouse')) add('fullHouse', need.fullHouse);

    reach('merciless', stat(world, pid, 'villagerKills'));
    reach('boarSnack', stat(world, pid, 'boarDeaths'));
    reach('butcher', stat(world, pid, 'slaughtered'));
    reach('demolisher', stat(world, pid, 'demolished'));
    reach('merchant', stat(world, pid, 'trades'));
    var res = world.players[pid].res;
    reach('hoarder', Math.floor(RTS.data.resources.reduce(function (n, r) { return n + res[r]; }, 0)));
    if (!soldiers && won) add('pitchfork');
    else if (!soldiers && world.time >= need.pacifist) add('pacifist');
    return out;
  }

  // 結束畫面要顯示的成就清單
  function summary(world, pid) {
    var count = sheepCount(world, pid);
    return [{ id: 'sheep', count: count, percent: percentile(RTS.data.achievements.sheep, count) }]
      .concat(badges(world, pid));
  }

  RTS.achievements = {
    gainSheep: gainSheep, sheepCount: sheepCount, bump: bump, stat: stat, unitDied: unitDied, trained: trained,
    percentile: percentile, badges: badges, summary: summary
  };
})();
