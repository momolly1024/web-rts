// 建築：放置檢查、放下工地、村民施工、取消工地。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  // 預覽與指令共用同一套判斷
  function canPlace(world, owner, type, tx, ty) {
    var size = RTS.data.buildings[type].size, map = world.map;
    for (var y = ty; y < ty + size; y++) {
      for (var x = tx; x < tx + size; x++) {
        if (!RTS.map.inBounds(map, x, y)) return { ok: false, reason: 'outOfMap' };
        if (RTS.fog.tile(world, owner, x, y) === RTS.fog.UNEXPLORED) return { ok: false, reason: 'unexplored' };
        if (!RTS.map.isWalkable(map, x, y) || RTS.map.floorAt(map, x, y)) return { ok: false, reason: 'blocked' };
      }
    }
    var enemy = false;
    world.entities.forEach(function (u) {
      if (u.kind === 'unit' && u.owner !== owner && RTS.fog.sees(world, owner, u) &&
          u.x >= tx && u.x < tx + size && u.y >= ty && u.y < ty + size) enemy = true;
    });
    return enemy ? { ok: false, reason: 'enemyUnit' } : { ok: true };
  }

  // 前置建築：目前只有農田需要完工的磨坊。缺少時回傳失敗結果，否則 null
  function missingRequirement(world, owner, type) {
    var need = RTS.data.buildings[type].requires;
    if (!need) return null;
    var has = RTS.world.buildingsOf(world, owner, need).some(function (b) { return b.complete; });
    return has ? null : { ok: false, reason: 'needsMill' };
  }

  function place(world, owner, type, tx, ty) {
    var b = RTS.world.addBuilding(world, type, owner, tx, ty, false);
    world.entities.forEach(function (u) {
      if (u.w === undefined) RTS.move.rescue(world, u);
    });
    return b;
  }

  function cancel(world, b) {
    if (b.complete) return false;
    RTS.world.remove(world, b);
    RTS.world.refund(world, b.owner, RTS.data.buildings[b.type].cost);
    return true;
  }

  function beginTick(world) {
    world.entities.forEach(function (e) { if (e.kind === 'building') e.builders = 0; });
  }

  // 蓋完後：先支援附近工地，否則回去做原本的採集
  function nextJob(world, u) {
    var resume = u.order.resume;
    var site = RTS.world.nearest(world, u.x, u.y, function (e) {
      return e.kind === 'building' && e.owner === u.owner && !e.complete;
    }, 10);
    if (site) RTS.orders.set(u, { type: 'build', targetId: site.id, resume: resume, fails: 0 });
    else if (resume) { resume.returning = u.carry.amount > 0; RTS.orders.set(u, resume); }
    else RTS.orders.set(u, { type: 'idle' });
  }

  function update(world, u, dt) {
    var o = u.order;
    var b = RTS.world.get(world, o.targetId);
    if (!b || b.complete) { nextJob(world, u); return; }
    if (u.wait > 0) { u.wait -= dt; return; }
    var status = RTS.move.approach(world, u, RTS.move.entityGoal(b, 0.75), dt, { spread: true });
    if (status === 'blocked') {
      o.fails = (o.fails || 0) + 1;
      u.wait = 1.0;
      if (o.fails >= 3) RTS.orders.set(u, { type: 'idle' });
    } else if (status === 'arrived') {
      var def = RTS.data.buildings[b.type];
      var factor = b.builders === 0 ? 1 : 0.5;     // 第二人起效率減半
      b.builders++;
      var delta = Math.min(1 - b.progress, dt / def.buildTime * factor);
      b.progress += delta;
      b.hp = Math.min(b.maxHp, b.hp + delta * 0.9 * b.maxHp);
      u.facing = b.x + b.w / 2 > u.x ? 1 : -1;
      u.swing = (u.swing + dt) % 0.6;
      if (b.progress >= 1 - 1e-9) {
        b.progress = 1;
        b.complete = true;
        if (b.maxHp - b.hp < 0.01) b.hp = b.maxHp;    // 消除浮點累加誤差
        if (def.farm) {          // 蓋好農田的村民直接耕作
          b.amount = RTS.farm.food(world, b.owner);
          RTS.orders.set(u, RTS.gather.makeOrder(b));
          return;
        }
        nextJob(world, u);
      }
    }
  }

  RTS.construction = {
    canPlace: canPlace, missingRequirement: missingRequirement, place: place, cancel: cancel, beginTick: beginTick, update: update,
    nextJob: nextJob
  };
})();
