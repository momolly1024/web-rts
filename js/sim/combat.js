// 戰鬥：傷害計算、追擊、攻擊移動、閒置軍事單位自動反擊、被城牆擋住時破牆。箭塔共用傷害與命中。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var SCAN_INTERVAL = 0.4;
  var LEASH = 5;             // 自動反擊最多追出「視野 + LEASH」格

  var BREACH = 2.5;          // 被擋住時，攻擊這個距離內擋路的敵方建築

  // attackBonus、armorBonus 為雙方的研究加成
  function damageOf(attackerType, targetDef, attackBonus, armorBonus) {
    return hitDamage(RTS.data.units[attackerType].attack, targetDef, attackBonus, armorBonus);
  }

  // 任何攻擊（單位或箭塔）對某目標的傷害
  function hitDamage(atk, targetDef, attackBonus, armorBonus) {
    var special = atk.bonus && atk.bonus[targetDef.armorType];
    var bonus = special || RTS.data.damageBonus[atk.type][targetDef.armorType];
    var armor = targetDef.armor[atk.type] + (armorBonus || 0);
    return Math.max(1, (atk.damage + (attackBonus || 0)) * bonus - armor);
  }

  // 會不會打仗：治療者沒有攻擊
  function fights(u) {
    return !!RTS.data.units[u.type].attack;
  }

  // 攻擊距離（含兵種升級的射程）
  function rangeOf(world, u) {
    return RTS.data.units[u.type].attack.range + RTS.research.tierBonus(world, u.owner, u.type, 'range');
  }

  // 視野內最近的敵人：單位優先，需要時才找建築；只打建築的（攻城槌）只找建築
  function acquire(world, u, includeBuildings) {
    var def = RTS.data.units[u.type];
    if (!def.attack) return null;
    var vision = def.vision, buildingsOnly = def.attack.buildingsOnly;
    function ok(e) {
      return e.owner !== null && e.owner !== u.owner &&
        !(u.ignore && u.ignore.id === e.id && u.ignore.until > world.time);
    }
    var found = buildingsOnly ? null
      : RTS.world.nearest(world, u.x, u.y, function (e) { return e.kind === 'unit' && ok(e); }, vision);
    if (!found && (includeBuildings || buildingsOnly)) {
      found = RTS.world.nearest(world, u.x, u.y, function (e) { return e.kind === 'building' && ok(e); }, vision);
    }
    return found;
  }

  function strike(world, u, target) {
    var atk = RTS.data.units[u.type].attack;
    var to = RTS.world.center(target);
    u.cooldown = atk.cooldown;
    u.swing = 0.25;
    u.facing = to.x >= u.x ? 1 : -1;
    world.effects.push({
      type: atk.range > 1.5 ? 'arrow' : 'hit',
      x1: u.x, y1: u.y, x2: to.x, y2: to.y, age: 0, life: 0.25
    });
    hit(world, u, atk, RTS.research.bonus(world, u.owner, u.type, 'attack'), target);
  }

  // 造成一次傷害（attacker 可為單位或箭塔），處理死亡與被打的士兵反擊
  function hit(world, attacker, atk, attackBonus, target) {
    var def = RTS.world.defOf(target), to = RTS.world.center(target);
    var armor = target.kind === 'unit' ? RTS.research.bonus(world, target.owner, target.type, 'armor') : 0;
    var damage = hitDamage(atk, def, attackBonus, armor);
    RTS.alerts.record(world, attacker, target);
    if (target.kind === 'animal') { RTS.animals.hurt(world, target, attacker, damage); return; }
    target.hp -= damage;
    if (target.kind === 'building') target.lastHit = world.time;
    if (target.hp <= 0) {
      world.effects.push({ type: 'death', x1: to.x, y1: to.y, x2: to.x, y2: to.y, age: 0, life: 0.8 });
      RTS.world.remove(world, target);
      if (target.kind === 'unit') RTS.achievements.unitDied(world, target, attacker.owner);
      else if (target.kind === 'building') RTS.achievements.bump(world, attacker.owner, 'razed');
    } else if (target.kind === 'unit' && target.order.type === 'idle' && RTS.data.units[target.type].military &&
        fights(target) && !RTS.data.units[target.type].attack.buildingsOnly) {
      RTS.orders.set(target, { type: 'attack', targetId: attacker.id, auto: true, home: { x: target.x, y: target.y } });
    }
  }

  // 擋在附近的敵方建築（城牆、城門等），被擋住時先拆它
  function blocker(world, u) {
    return RTS.world.nearest(world, u.x, u.y, function (e) {
      return e.kind === 'building' && e.owner !== null && e.owner !== u.owner && RTS.fog.sees(world, u.owner, e);
    }, BREACH);
  }

  // 目前目標結束後要做什麼
  function finish(world, u) {
    var o = u.order;
    if (o.then) { RTS.orders.set(u, o.then); return; }
    if (RTS.data.units[u.type].military && fights(u)) {
      var next = acquire(world, u, false);
      if (next) {
        RTS.orders.set(u, { type: 'attack', targetId: next.id, auto: true, home: o.home });
        return;
      }
    }
    if (o.home) goHome(u, o.home);
    else RTS.orders.set(u, { type: 'idle' });
  }

  function goHome(u, home) {
    RTS.orders.set(u, { type: 'move', x: Math.floor(home.x), y: Math.floor(home.y) });
  }

  function updateAttack(world, u, dt) {
    var o = u.order, def = RTS.data.units[u.type];
    if (!def.attack) { RTS.orders.set(u, { type: 'idle' }); return; }
    var target = RTS.world.get(world, o.targetId);
    if (!target || target.owner === u.owner) { finish(world, u); return; }
    if (o.home && RTS.util.dist(u.x, u.y, o.home.x, o.home.y) > def.vision + LEASH) {
      goHome(u, o.home);
      return;
    }
    // 追的單位或動物離開視野：走到最後看到的地方，不再鎖定
    if (target.w === undefined) {
      if (RTS.fog.sees(world, u.owner, target) || RTS.util.dist(u.x, u.y, target.x, target.y) <= def.vision) {
        o.seen = { x: target.x, y: target.y };
      } else {
        if (o.then || o.home || !o.seen) finish(world, u);
        else goHome(u, o.seen);
        return;
      }
    }
    // 攻擊移動途中拆建築時，敵軍靠近就先處理敵軍
    if (o.then && target.kind === 'building') {
      u.scanTimer -= dt;
      if (u.scanTimer <= 0) {
        u.scanTimer = SCAN_INTERVAL;
        var threat = acquire(world, u, false);
        if (threat) { RTS.orders.set(u, { type: 'attack', targetId: threat.id, auto: true, then: o.then }); return; }
      }
    }
    var range = rangeOf(world, u), ranged = range > 1.5;
    var status = RTS.move.approach(world, u, RTS.move.entityGoal(target, range), dt,
      { eager: ranged || target.kind === 'unit', spread: target.kind === 'building' && !ranged });
    if (status === 'arrived') {
      if (u.cooldown <= 0) strike(world, u, target);
    } else if (status === 'blocked') {
      var wall = blocker(world, u);
      if (wall && wall !== target) {
        RTS.orders.set(u, { type: 'attack', targetId: wall.id, auto: true, then: o });
        return;
      }
      u.ignore = { id: target.id, until: world.time + 6 };
      var ignore = u.ignore;
      finish(world, u);
      u.ignore = ignore;
    }
  }

  function updateAttackMove(world, u, dt) {
    var o = u.order;
    u.scanTimer -= dt;
    if (u.scanTimer <= 0) {
      u.scanTimer = SCAN_INTERVAL;
      var enemy = acquire(world, u, true);
      if (enemy) {
        var ignore = u.ignore;
        RTS.orders.set(u, { type: 'attack', targetId: enemy.id, auto: true, then: o });
        u.ignore = ignore;
        return;
      }
    }
    var status = RTS.move.approach(world, u, RTS.move.pointGoal(o.x, o.y), dt);
    if (status === 'blocked') {
      var wall = fights(u) && blocker(world, u);
      if (wall) { RTS.orders.set(u, { type: 'attack', targetId: wall.id, auto: true, then: o }); return; }
    }
    if (status !== 'moving') RTS.orders.set(u, { type: 'idle' });
  }

  // 閒置的軍事單位反擊附近敵人
  function updateIdle(world, u, dt) {
    if (!RTS.data.units[u.type].military || !fights(u) || u.nav) return;
    u.scanTimer -= dt;
    if (u.scanTimer > 0) return;
    u.scanTimer = SCAN_INTERVAL;
    var enemy = acquire(world, u, false);
    if (enemy) {
      RTS.orders.set(u, { type: 'attack', targetId: enemy.id, auto: true, home: { x: u.x, y: u.y } });
    }
  }

  RTS.combat = {
    damageOf: damageOf, hitDamage: hitDamage, hit: hit, rangeOf: rangeOf, fights: fights, blocker: blocker,
    acquire: acquire, updateAttack: updateAttack,
    updateAttackMove: updateAttackMove, updateIdle: updateIdle
  };
})();
