// 牲畜圈與小羊：圈定時長出己方小黑羊，小羊長大後變成一般綿羊。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function isPen(e) {
    return !!(e && e.kind === 'building' && RTS.data.buildings[e.type].pen);
  }

  // 圈附近己方的羊（含小羊）
  function flock(world, pen) {
    var cfg = RTS.data.buildings[pen.type].pen, c = RTS.world.center(pen);
    return RTS.world.list(world, function (e) {
      return e.kind === 'animal' && e.owner === pen.owner && RTS.data.animals[e.type].behavior === 'herd' &&
        RTS.util.dist(e.x, e.y, c.x, c.y) <= cfg.radius;
    });
  }

  function full(world, pen) {
    return flock(world, pen).length >= RTS.data.buildings[pen.type].pen.cap;
  }

  // 每步累積時間；羊滿時停在即將出生的狀態，空出位置就馬上補
  function update(world, pen, dt) {
    if (!isPen(pen) || !pen.complete) return;
    var cfg = RTS.data.buildings[pen.type].pen;
    pen.breed = Math.min(cfg.interval, (pen.breed || 0) + dt);
    if (pen.breed < cfg.interval || full(world, pen)) return;
    pen.breed = 0;
    var c = RTS.world.center(pen);
    var lamb = RTS.world.addAnimal(world, 'lamb', c.x, c.y);
    lamb.owner = pen.owner;
    lamb.age = 0;
  }

  function secondsLeft(pen) {
    return Math.max(0, Math.ceil(RTS.data.buildings[pen.type].pen.interval - (pen.breed || 0)));
  }

  // 小羊長大：原地換成白羊，保留主人、位置與活動範圍
  function grow(a, dt) {
    var g = RTS.data.animals[a.type].grows;
    if (!g) return;
    a.age = (a.age || 0) + dt;
    if (a.age < g.time) return;
    var ratio = a.hp / a.maxHp;
    a.type = g.into;
    a.maxHp = RTS.data.animals[g.into].hp;
    a.hp = Math.max(1, Math.round(a.maxHp * ratio));
    delete a.age;
  }

  function growLeft(a) {
    var g = RTS.data.animals[a.type].grows;
    return g ? Math.max(0, Math.ceil(g.time - (a.age || 0))) : 0;
  }

  // 拆除：退回部分造價，佇列中的項目全額退
  function refundOf(b) {
    var cost = RTS.data.buildings[b.type].cost, out = {}, k = RTS.data.demolish.refund * Math.max(0, b.hp) / b.maxHp;
    Object.keys(cost).forEach(function (r) { out[r] = Math.floor(cost[r] * k); });
    return out;
  }

  function canDemolish(b) {
    return !!(b && b.kind === 'building' && b.complete && RTS.data.demolish.exclude.indexOf(b.type) < 0);
  }

  function demolish(world, b) {
    if (!canDemolish(b)) return { ok: false, reason: 'cannotDemolish' };
    while (b.queue.length) RTS.production.cancel(world, b, b.queue.length - 1);
    RTS.world.refund(world, b.owner, refundOf(b));
    RTS.world.remove(world, b);
    world.entities.forEach(function (e) { if (e.w === undefined) RTS.move.rescue(world, e); });
    return { ok: true };
  }

  RTS.pen = {
    isPen: isPen, flock: flock, full: full, update: update, secondsLeft: secondsLeft,
    grow: grow, growLeft: growLeft, refundOf: refundOf, canDemolish: canDemolish, demolish: demolish
  };
})();
