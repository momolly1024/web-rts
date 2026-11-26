// 文明：開局決定的被動加成。數值在 data.js；沒指定文明（null）時沒有任何加成。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function of(world, pid) {
    var player = world.players[pid];
    return player && player.civ ? RTS.data.civs[player.civ] : null;
  }

  // 與研究效果同一組代號（'gather.wood'、'speed'、'farmFood'、'tower.range' 等）
  function effect(world, pid, key) {
    var civ = of(world, pid);
    return (civ && civ.effects && civ.effects[key]) || 0;
  }

  // 兵種數值加成（兵種類別 + 單一兵種）；stat 為 hp、attack、armor、range
  function unitBonus(world, pid, unitType, stat) {
    var civ = of(world, pid), def = RTS.data.units[unitType];
    if (!civ || !def) return 0;
    var byClass = civ.classBonus && civ.classBonus[def.upgradeClass];
    var byType = civ.unitBonus && civ.unitBonus[unitType];
    return ((byClass && byClass[stat]) || 0) + ((byType && byType[stat]) || 0);
  }

  function pick(random) {
    var order = RTS.data.civOrder;
    return order[Math.min(order.length - 1, Math.floor(random() * order.length))];
  }

  // 玩家選定（或 'random'），其他玩家一律隨機。開局前呼叫
  function assign(world, humanId, choice, random) {
    world.players.forEach(function (player, pid) {
      player.civ = pid === humanId && RTS.data.civs[choice] ? choice : pick(random);
    });
  }

  RTS.civs = { effect: effect, unitBonus: unitBonus, assign: assign };
})();
