// 單位指令狀態機：依 order.type 分派到各系統。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function set(unit, order) {
    unit.order = order;
    unit.nav = null;
    unit.wait = 0;
    unit.ignore = null;
  }

  function updateMove(world, u, dt) {
    var status = RTS.move.approach(world, u, RTS.move.pointGoal(u.order.x, u.order.y), dt);
    if (status !== 'moving') set(u, { type: 'idle' });
  }

  function update(world, u, dt) {
    if (u.cooldown > 0) u.cooldown -= dt;
    var type = u.order.type;
    if (type !== 'gather' && type !== 'build' && u.swing > 0) u.swing = Math.max(0, u.swing - dt);
    switch (type) {
      case 'move': updateMove(world, u, dt); break;
      case 'gather': RTS.gather.update(world, u, dt); break;
      case 'deposit': RTS.gather.updateDeposit(world, u, dt); break;
      case 'build': RTS.construction.update(world, u, dt); break;
      case 'attack': RTS.combat.updateAttack(world, u, dt); break;
      case 'attackMove': RTS.combat.updateAttackMove(world, u, dt); break;
      default: RTS.combat.updateIdle(world, u, dt);
    }
  }

  RTS.orders = { set: set, update: update };
})();
