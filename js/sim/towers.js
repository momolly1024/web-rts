// 箭塔：完工後自動射擊範圍內最近的敵方單位。傷害與命中沿用 combat.js。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  // 這一座的分支加成；stat 為 range 或 damage
  function branchBonus(b, stat) {
    return b.branch ? RTS.data.buildings[b.type].branches[b.branch].effects[stat] || 0 : 0;
  }

  function rangeOf(world, b) {
    return RTS.data.buildings[b.type].attack.range + RTS.research.economy(world, b.owner, 'tower.range') +
      branchBonus(b, 'range');
  }

  // 全體強化與分支的攻擊加成總和
  function damageBonus(world, b) {
    return RTS.research.economy(world, b.owner, 'tower.damage') + branchBonus(b, 'damage');
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
    RTS.combat.hit(world, b, atk, damageBonus(world, b), t);
  }

  RTS.towers = { update: update, rangeOf: rangeOf, damageBonus: damageBonus, target: target };
})();
