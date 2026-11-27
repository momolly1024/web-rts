// 建築：放置檢查、放下工地、村民施工、取消工地。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  // 己方完工的城牆（城門可以直接蓋在上面取代它）
  function ownWallAt(world, owner, x, y) {
    var e = RTS.world.get(world, RTS.map.occupantAt(world.map, x, y));
    return e && e.kind === 'building' && e.type === 'wall' && e.owner === owner && e.complete ? e : null;
  }

  // 這格是城牆或城門（城門可走，記在 floor 而不是 occupant）
  function isWallOrGate(world, x, y) {
    var wall = RTS.world.get(world, RTS.map.occupantAt(world.map, x, y));
    if (wall && wall.kind === 'building' && wall.type === 'wall') return true;
    var gate = RTS.world.get(world, RTS.map.floorAt(world.map, x, y));
    return !!gate && gate.type === 'gate';
  }

  // 放在 (tx, ty) 附近的城門該順著哪個方向：兩軸各看半個門長再多一格內的牆與門，
  // 上下較多為 'y'、左右較多為 'x'
  function gateAxis(world, tx, ty, dir) {
    var alongX = 0, alongY = 0, reach = Math.floor(RTS.data.buildings.gate.length / 2) + 1;
    for (var d = 1; d <= reach; d++) {
      if (isWallOrGate(world, tx - d, ty)) alongX++;
      if (isWallOrGate(world, tx + d, ty)) alongX++;
      if (isWallOrGate(world, tx, ty - d)) alongY++;
      if (isWallOrGate(world, tx, ty + d)) alongY++;
    }
    if (alongX !== alongY) return alongY > alongX ? 'y' : 'x';
    return dir % 2 ? 'y' : 'x';      // 沒有相鄰的牆或兩向一樣多時，照城門自己的朝向
  }

  // 城牆一條線上的格子（八方向的直線，斜線也連得起來）
  function lineTiles(x0, y0, x1, y1) {
    var out = [], dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy, x = x0, y = y0;
    for (;;) {
      out.push({ x: x, y: y });
      if (x === x1 && y === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return out;
  }

  // 預覽與指令共用同一套判斷
  function canPlace(world, owner, type, tx, ty, dir) {
    var area = RTS.world.footprint(type, dir | 0), map = world.map;
    for (var y = ty; y < ty + area.h; y++) {
      for (var x = tx; x < tx + area.w; x++) {
        if (!RTS.map.inBounds(map, x, y)) return { ok: false, reason: 'outOfMap' };
        if (RTS.fog.tile(world, owner, x, y) === RTS.fog.UNEXPLORED) return { ok: false, reason: 'unexplored' };
        var free = RTS.map.isWalkable(map, x, y) && !RTS.map.floorAt(map, x, y);
        if (!free && !(type === 'gate' && ownWallAt(world, owner, x, y))) return { ok: false, reason: 'blocked' };
      }
    }
    var enemy = false;
    world.entities.forEach(function (u) {
      if (u.kind === 'unit' && u.owner !== owner && RTS.fog.sees(world, owner, u) &&
          u.x >= tx && u.x < tx + area.w && u.y >= ty && u.y < ty + area.h) enemy = true;
    });
    return enemy ? { ok: false, reason: 'enemyUnit' } : { ok: true };
  }

  // 時代與前置建築（目前只有農田需要完工的磨坊）。缺少時回傳失敗結果，否則 null
  function missingRequirement(world, owner, type) {
    var tooEarly = RTS.research.ageFail(world, owner, RTS.data.buildings[type].age);
    if (tooEarly) return tooEarly;
    var need = RTS.data.buildings[type].requires;
    if (!need) return null;
    var has = RTS.world.buildingsOf(world, owner, need).some(function (b) { return b.complete; });
    return has ? null : { ok: false, reason: 'needsMill' };
  }

  function place(world, owner, type, tx, ty, dir) {
    if (type === 'gate') {                      // 城門取代占地內的城牆，牆不退款
      var area = RTS.world.footprint(type, dir | 0);
      for (var y = ty; y < ty + area.h; y++) {
        for (var x = tx; x < tx + area.w; x++) {
          var old = ownWallAt(world, owner, x, y);
          if (old) RTS.world.remove(world, old);
        }
      }
    }
    var b = RTS.world.addBuilding(world, type, owner, tx, ty, false, dir);
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
      if (!RTS.data.buildings[b.type].walkable) RTS.move.lean(u, b, dt);
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
    canPlace: canPlace, missingRequirement: missingRequirement, ownWallAt: ownWallAt, gateAxis: gateAxis, lineTiles: lineTiles, place: place, cancel: cancel, beginTick: beginTick, update: update,
    nextJob: nextJob
  };
})();
