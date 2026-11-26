// 受攻擊紀錄：記下每位玩家最近一次被敵方打到的位置與時間，供介面發警告。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  // 野生動物反擊不算（走另一條傷害路徑）；打中立目標也不算
  function record(world, attacker, target) {
    if (target.owner === null || attacker.owner === undefined || attacker.owner === null) return;
    if (attacker.owner === target.owner) return;
    var c = RTS.world.center(target);
    world.players[target.owner].attacked = { x: c.x, y: c.y, time: world.time };
  }

  RTS.alerts = { record: record };
})();
