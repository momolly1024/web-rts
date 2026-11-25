// 牲畜圈與小羊：圈內有兩隻以上己方白羊時，過一段時間生出小黑羊；小羊長大後變成一般綿羊。另含拆除建築。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function isPen(e) {
    return !!(e && e.kind === 'building' && RTS.data.buildings[e.type].pen);
  }

  function within(pen, e) {
    return e.x >= pen.x && e.x < pen.x + pen.w && e.y >= pen.y && e.y < pen.y + pen.h;
  }

  // 圈內己方的羊（含小羊）
  function flock(world, pen) {
    return RTS.world.list(world, function (e) {
      return e.kind === 'animal' && e.owner === pen.owner && RTS.data.animals[e.type].behavior === 'herd' &&
        within(pen, e);
    });
  }

  function adults(world, pen) {
    return flock(world, pen).filter(function (a) { return !RTS.data.animals[a.type].young; }).length;
  }

  function full(world, pen) {
    return flock(world, pen).length >= RTS.data.buildings[pen.type].pen.cap;
  }

  // 白羊夠才計時（不夠就暫停、不歸零）；羊滿時停在即將出生的狀態，空出位置就馬上補
  function update(world, pen, dt) {
    if (!isPen(pen) || !pen.complete) return;
    var cfg = RTS.data.buildings[pen.type].pen, c = RTS.world.center(pen);
    // 進了圈的羊就被圈住：以圈中央為活動中心，之後的移動都限制在圈內
    flock(world, pen).forEach(function (a) {
      a.penId = pen.id;
      if (a.order.type === 'idle') { a.home.x = c.x; a.home.y = c.y; }
    });
    if (adults(world, pen) < cfg.parents) return;
    pen.breed = Math.min(cfg.interval, (pen.breed || 0) + dt);
    if (pen.breed < cfg.interval || full(world, pen)) return;
    pen.breed = 0;
    var lamb = RTS.world.addAnimal(world, 'lamb', c.x, c.y);
    lamb.owner = pen.owner;
    lamb.age = 0;
    lamb.penId = pen.id;
  }

  // 圈住這隻羊的牲畜圈；圈被拆或換了主人就放開
  function penOf(world, a) {
    var pen = a.penId ? RTS.world.get(world, a.penId) : null;
    if (pen && pen.owner === a.owner) return pen;
    a.penId = 0;
    return null;
  }

  // 被圈住的羊：把目的格限制在圈內
  function confine(world, a, tile) {
    var pen = penOf(world, a);
    if (!pen) return tile;
    return {
      x: RTS.util.clamp(tile.x, pen.x, pen.x + pen.w - 1),
      y: RTS.util.clamp(tile.y, pen.y, pen.y + pen.h - 1)
    };
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
    isPen: isPen, within: within, penOf: penOf, confine: confine, flock: flock, adults: adults, full: full, update: update, secondsLeft: secondsLeft,
    grow: grow, growLeft: growLeft, refundOf: refundOf, canDemolish: canDemolish, demolish: demolish
  };
})();
