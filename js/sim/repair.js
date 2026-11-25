// 村民修理受損的己方完工建築，邊修邊付資源。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function canRepair(b) {
    return !!b && b.kind === 'building' && b.complete && b.hp < b.maxHp - 1e-6;
  }

  // 本步要付的整數資源；不足一單位的零頭記在建築上，換人修也不會漏收
  function charge(world, b, gain) {
    var cost = RTS.data.buildings[b.type].cost;
    var owed = b.repairOwed || (b.repairOwed = {});
    var bill = {}, rest = {};
    Object.keys(cost).forEach(function (k) {
      var total = (owed[k] || 0) + gain / b.maxHp * cost[k] * RTS.data.repair.costFactor;
      bill[k] = Math.floor(total + 1e-9);
      rest[k] = total - bill[k];
    });
    if (!RTS.world.pay(world, b.owner, bill)) return false;
    b.repairOwed = rest;
    return true;
  }

  function update(world, u, dt) {
    var o = u.order;
    var b = RTS.world.get(world, o.targetId);
    if (!canRepair(b) || b.owner !== u.owner) { RTS.construction.nextJob(world, u); return; }
    if (u.wait > 0) { u.wait -= dt; return; }
    var status = RTS.move.approach(world, u, RTS.move.entityGoal(b, 0.75), dt, { spread: true });
    if (status === 'blocked') {
      o.fails = (o.fails || 0) + 1;
      u.wait = 1.0;
      if (o.fails >= 3) RTS.orders.set(u, { type: 'idle' });
    } else if (status === 'arrived') {
      var def = RTS.data.buildings[b.type];
      var factor = b.builders === 0 ? 1 : 0.5;     // 與施工相同：第二人起效率減半
      b.builders++;
      var gain = Math.min(b.maxHp - b.hp,
        b.maxHp / def.buildTime * RTS.data.repair.speed * factor * dt);
      if (!charge(world, b, gain)) { RTS.orders.set(u, { type: 'idle' }); return; }
      b.hp = Math.min(b.maxHp, b.hp + gain);
      u.facing = b.x + b.w / 2 > u.x ? 1 : -1;
      u.swing = (u.swing + dt) % 0.6;
      if (!canRepair(b)) { b.hp = b.maxHp; RTS.construction.nextJob(world, u); }
    }
  }

  RTS.repair = { canRepair: canRepair, update: update };
})();
