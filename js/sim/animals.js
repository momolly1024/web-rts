// 動物：牲畜可認領帶走、獵物會逃、猛獸受攻擊會反擊；死後成為可採肉的資源。含村民狩獵。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var SCAN = 0.4;

  function def(a) {
    return RTS.data.animals[a.type];
  }

  function walk(a, x, y) {
    a.order = { type: 'move', x: x, y: y };
    a.nav = null;
    a.stroll = null;
  }

  function stand(a) {
    a.order = { type: 'idle' };
    a.nav = null;
    a.stroll = null;
  }

  // 停止指令：停在原地並以此為新的活動定點
  function halt(a) {
    stand(a);
    RTS.wander.anchor(a);
  }

  // 走向目前的移動目的地；回傳是否仍在走
  function travel(world, a, dt) {
    if (a.order.type !== 'move') return false;
    if (RTS.move.approach(world, a, RTS.move.pointGoal(a.order.x, a.order.y), dt) === 'moving') return true;
    stand(a);
    return false;
  }

  function nearestUnit(world, a, radius, owner) {
    return RTS.world.nearest(world, a.x, a.y, function (e) {
      return e.kind === 'unit' && (owner === undefined || e.owner === owner);
    }, radius);
  }

  // 牲畜歸附近的人所有；原主人在旁邊時別人搶不走
  function updateHerd(world, a, dt) {
    a.timer -= dt;
    if (a.timer <= 0) {
      a.timer = SCAN;
      var radius = def(a).claimRadius;
      // 圈在自己牲畜圈裡的羊搶不走
      if (!RTS.pen.penOf(world, a) && (a.owner === null || !nearestUnit(world, a, radius, a.owner))) {
        var u = nearestUnit(world, a, radius);
        if (u && u.owner !== a.owner) { a.owner = u.owner; halt(a); }
      }
    }
    // 走到主人指定處後，就在那附近活動
    var commanded = a.order.type === 'move' && !a.order.speed;    // 自己慢走回定點不算
    if (!travel(world, a, dt) && commanded) RTS.wander.anchor(a);
  }

  // 獵物：受驚就跑一段，之後要喘息，這段空檔追得上
  function updateFlee(world, a, dt) {
    var d = def(a);
    // 慢走回定點的路上一樣會受驚
    if (a.order.speed && (a.threat || nearestUnit(world, a, d.fleeRadius))) stand(a);
    if (travel(world, a, dt)) return;
    if (a.fleeing) { a.fleeing = false; a.rest = d.rest; a.threat = 0; }
    if (a.rest > 0) { a.rest -= dt; return; }
    a.timer -= dt;
    if (a.timer > 0) return;
    a.timer = SCAN;
    var threat = RTS.world.get(world, a.threat) || nearestUnit(world, a, d.fleeRadius);
    if (!threat) return;
    var dx = a.x - threat.x, dy = a.y - threat.y, len = Math.hypot(dx, dy) || 1;
    if (RTS.util.dist(a.x, a.y, a.home.x, a.home.y) > d.leash) {
      dx = a.home.x - a.x;
      dy = a.home.y - a.y;
      len = Math.hypot(dx, dy) || 1;
    }
    var spot = RTS.map.nearestFree(world.map,
      Math.floor(RTS.util.clamp(a.x + dx / len * d.fleeDistance, 0, world.map.width - 1)),
      Math.floor(RTS.util.clamp(a.y + dy / len * d.fleeDistance, 0, world.map.height - 1)), 6);
    if (!spot) return;
    a.fleeing = true;
    walk(a, spot.x, spot.y);
  }

  function goHome(a) {
    a.targetId = 0;
    walk(a, Math.floor(a.home.x), Math.floor(a.home.y));
  }

  function updateFight(world, a, dt) {
    var d = def(a);
    if (!a.targetId) { travel(world, a, dt); return; }
    var target = RTS.world.get(world, a.targetId);
    if (!target || RTS.util.dist(a.x, a.y, a.home.x, a.home.y) > d.leash) { goHome(a); return; }
    var status = RTS.move.approach(world, a, RTS.move.entityGoal(target, d.attack.range), dt, { eager: true });
    if (status === 'blocked') goHome(a);
    else if (status === 'arrived' && a.cooldown <= 0) bite(world, a, target);
  }

  function bite(world, a, u) {
    var atk = def(a).attack;
    var armor = RTS.data.units[u.type].armor[atk.type] + RTS.research.bonus(world, u.owner, u.type, 'armor');
    a.cooldown = atk.cooldown;
    a.swing = 0.25;
    a.facing = u.x >= a.x ? 1 : -1;
    u.hp -= Math.max(1, atk.damage - armor);
    world.effects.push({ type: 'hit', x1: a.x, y1: a.y, x2: u.x, y2: u.y, age: 0, life: 0.25 });
    if (u.hp <= 0) {
      world.effects.push({ type: 'death', x1: u.x, y1: u.y, x2: u.x, y2: u.y, age: 0, life: 0.8 });
      RTS.world.remove(world, u);
    } else if (u.order.type === 'idle' && RTS.data.units[u.type].military) {
      RTS.orders.set(u, { type: 'attack', targetId: a.id, auto: true, home: { x: u.x, y: u.y } });
    }
  }

  // 屍體變成食物資源；正在獵牠的村民直接開始採肉
  function die(world, a) {
    RTS.world.remove(world, a);
    if (!(def(a).food > 0)) return null;      // 小羊沒有肉
    var t = RTS.map.nearestFree(world.map, Math.floor(a.x), Math.floor(a.y));
    if (!t) return null;
    var carcass = RTS.world.addNode(world, 'carcass', t.x, t.y);
    carcass.amount = def(a).food;
    carcass.animal = a.type;
    world.entities.forEach(function (e) {
      if (e.kind !== 'unit' && e.kind !== 'animal') return;
      RTS.move.rescue(world, e);
      if (e.order.type === 'hunt' && e.order.targetId === a.id) RTS.orders.set(e, RTS.gather.makeOrder(carcass));
    });
    return carcass;
  }

  function hurt(world, a, attacker, damage) {
    a.hp -= damage;
    if (a.hp <= 0) { die(world, a); return; }
    if (def(a).behavior === 'fight') { a.targetId = attacker.id; stand(a); }
    else if (def(a).behavior === 'flee') a.threat = attacker.id;
  }

  function update(world, a, dt) {
    if (a.cooldown > 0) a.cooldown -= dt;
    if (a.swing > 0) a.swing = Math.max(0, a.swing - dt);
    RTS.pen.grow(a, dt);
    var behavior = def(a).behavior;
    if (behavior === 'herd') updateHerd(world, a, dt);
    else if (behavior === 'flee') updateFlee(world, a, dt);
    else updateFight(world, a, dt);
    // 沒有指令、沒受驚也不在戰鬥或喘息時才閒逛
    if (a.order.type === 'idle' && !a.targetId && !a.threat && !a.fleeing && !(a.rest > 0)) {
      RTS.wander.update(world, a, dt);
    }
  }

  // 村民狩獵指令：投擲攻擊，打倒後自動轉為採肉
  function updateHunt(world, u, dt) {
    var o = u.order, hunt = RTS.data.units[u.type].hunt;
    var a = RTS.world.get(world, o.targetId);
    if (!a || a.kind !== 'animal') { RTS.orders.set(u, { type: 'idle' }); return; }
    // 獵物跑出視野太遠就放棄
    if (!RTS.fog.sees(world, u.owner, a) &&
        RTS.util.dist(u.x, u.y, a.x, a.y) > RTS.data.units[u.type].vision + 3) {
      RTS.orders.set(u, { type: 'idle' });
      return;
    }
    if (u.wait > 0) { u.wait -= dt; return; }
    var status = RTS.move.approach(world, u, RTS.move.entityGoal(a, hunt.range), dt, { eager: true });
    if (status === 'blocked') {
      o.fails = (o.fails || 0) + 1;
      u.wait = 1.0;
      if (o.fails >= 3) RTS.orders.set(u, { type: 'idle' });
    } else if (status === 'arrived' && u.cooldown <= 0) {
      u.cooldown = hunt.cooldown;
      u.swing = 0.25;
      u.facing = a.x >= u.x ? 1 : -1;
      world.effects.push({ type: 'arrow', x1: u.x, y1: u.y, x2: a.x, y2: a.y, age: 0, life: 0.25 });
      hurt(world, a, u, hunt.damage);
    }
  }

  RTS.animals = {
    update: update, hurt: hurt, die: die, walk: walk, stand: stand, halt: halt, updateHunt: updateHunt
  };
})();
