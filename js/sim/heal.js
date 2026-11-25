// 治療者：閒置時自動找視野內受傷的己方單位回血；也可指定對象。攻城槌不能治療。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var SCAN = 0.5;

  function canHeal(healer, t) {
    return !!t && t.kind === 'unit' && t !== healer && t.owner === healer.owner && t.hp < t.maxHp &&
      !RTS.data.units[t.type].noHeal;
  }

  function findPatient(world, u) {
    var vision = RTS.data.units[u.type].vision;
    return RTS.world.nearest(world, u.x, u.y, function (e) { return canHeal(u, e); }, vision);
  }

  function updateIdle(world, u, dt) {
    if (u.nav) return;
    u.scanTimer -= dt;
    if (u.scanTimer > 0) return;
    u.scanTimer = SCAN;
    var t = findPatient(world, u);
    if (t) RTS.orders.set(u, { type: 'heal', targetId: t.id, auto: true });
  }

  function update(world, u, dt) {
    var def = RTS.data.units[u.type], t = RTS.world.get(world, u.order.targetId);
    if (!canHeal(u, t)) {
      // 這位治好或不見了：附近還有傷兵就接著治
      var next = findPatient(world, u);
      RTS.orders.set(u, next ? { type: 'heal', targetId: next.id, auto: true } : { type: 'idle' });
      return;
    }
    var status = RTS.move.approach(world, u, RTS.move.entityGoal(t, def.heal.range), dt, { eager: true });
    if (status === 'blocked') { RTS.orders.set(u, { type: 'idle' }); return; }
    if (status !== 'arrived') return;
    u.facing = t.x >= u.x ? 1 : -1;
    u.swing = (u.swing + dt) % 0.6;
    t.hp = Math.min(t.maxHp, t.hp + def.heal.rate * dt);
  }

  RTS.heal = { canHeal: canHeal, update: update, updateIdle: updateIdle };
})();
