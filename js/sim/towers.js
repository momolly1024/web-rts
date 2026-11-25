// 箭塔：完工後自動射擊範圍內最近的敵方單位。傷害與命中沿用 combat.js。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function rangeOf(world, b) {
    return RTS.data.buildings[b.type].attack.range + RTS.research.economy(world, b.owner, 'tower.range');
  }

  function target(world, b) {
    var c = RTS.world.center(b), range = rangeOf(world, b);
    return RTS.world.nearest(world, c.x, c.y, function (e) {
      return e.kind === 'unit' && e.owner !== b.owner;
    }, range);
  }

  function update(world, b, dt) {
    var atk = RTS.data.buildings[b.type].attack;
    if (!atk || !b.complete) return;
    b.cooldown = Math.max(0, (b.cooldown || 0) - dt);
    if (b.cooldown > 0) return;
    var t = target(world, b);
    if (!t) return;
    b.cooldown = atk.cooldown;
    var c = RTS.world.center(b);
    world.effects.push({ type: 'arrow', x1: c.x, y1: c.y - 1, x2: t.x, y2: t.y, age: 0, life: 0.3 });
    RTS.combat.hit(world, b, atk, RTS.research.economy(world, b.owner, 'tower.damage'), t);
  }

  RTS.towers = { update: update, rangeOf: rangeOf, target: target };
})();
