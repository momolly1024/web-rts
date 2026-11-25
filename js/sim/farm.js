// 農田：每塊的食物量、一次一位耕作者、磨坊預付重種。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var RESEED_MAX = 30;      // 預付重種的上限

  // 新完成或重種的農田有多少食物（含磨坊研究）
  function food(world, pid) {
    return RTS.data.buildings.farm.farm.food + RTS.research.economy(world, pid, 'farmFood');
  }

  function isFarm(e) {
    return !!(e && e.kind === 'building' && RTS.data.buildings[e.type].farm);
  }

  // 目前真的在這塊田工作的村民（離開或改做別的就不算）
  function farmerOf(world, farm) {
    var u = farm.farmer ? RTS.world.get(world, farm.farmer) : null;
    if (!u || u.order.type !== 'gather' || u.order.targetId !== farm.id) return null;
    return u;
  }

  function freeFor(world, farm, u) {
    var f = farmerOf(world, farm);
    return !f || f === u;
  }

  // 食物用完：有預付重種就補滿，否則農田消失。回傳 true 代表還在
  function deplete(world, farm) {
    var player = world.players[farm.owner];
    if (player.reseeds > 0) {
      player.reseeds--;
      farm.amount = food(world, farm.owner);
      return true;
    }
    RTS.world.remove(world, farm);
    return false;
  }

  function checkReseed(world, mill) {
    if (!mill || !RTS.data.buildings[mill.type].reseed) return { ok: false, reason: 'cannotReseed' };
    if (!mill.complete) return { ok: false, reason: 'notComplete' };
    if (world.players[mill.owner].reseeds >= RESEED_MAX) return { ok: false, reason: 'reseedFull' };
    if (!RTS.world.canAfford(world, mill.owner, RTS.data.buildings.farm.cost)) {
      return { ok: false, reason: 'notEnoughResources' };
    }
    return { ok: true };
  }

  function reseed(world, mill) {
    var r = checkReseed(world, mill);
    if (!r.ok) return r;
    RTS.world.pay(world, mill.owner, RTS.data.buildings.farm.cost);
    world.players[mill.owner].reseeds++;
    return r;
  }

  function cancelReseed(world, pid) {
    var player = world.players[pid];
    if (player.reseeds <= 0) return false;
    player.reseeds--;
    RTS.world.refund(world, pid, RTS.data.buildings.farm.cost);
    return true;
  }

  RTS.farm = {
    RESEED_MAX: RESEED_MAX, food: food, isFarm: isFarm, farmerOf: farmerOf, freeFor: freeFor,
    deplete: deplete, checkReseed: checkReseed, reseed: reseed, cancelReseed: cancelReseed
  };
})();
