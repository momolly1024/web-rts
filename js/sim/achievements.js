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

  // 依 data.js 的估計對照表內插出「贏過了幾 % 的玩家」
  function percentile(table, value) {
    if (value <= table[0][0]) return table[0][1];
    for (var i = 1; i < table.length; i++) {
      var a = table[i - 1], b = table[i];
      if (value <= b[0]) return Math.floor(a[1] + (b[1] - a[1]) * (value - a[0]) / (b[0] - a[0]));
    }
    return table[table.length - 1][1];
  }

  // 結束畫面要顯示的成就清單
  function summary(world, pid) {
    var count = sheepCount(world, pid);
    return [{ id: 'sheep', count: count, percent: percentile(RTS.data.achievements.sheep, count) }];
  }

  RTS.achievements = { gainSheep: gainSheep, sheepCount: sheepCount, percentile: percentile, summary: summary };
})();
