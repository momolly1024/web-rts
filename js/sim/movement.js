// 單位移動：向目標靠近、沿路徑前進、重新尋路、站位分散。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var PATHS_PER_TICK = 24;   // 每個時間步最多尋路次數，避免大量單位同時重算造成卡頓

  function beginTick(world) {
    world.pathBudget = PATHS_PER_TICK;
  }

  // 目前有人站著、或正要走去當終點的格子
  function claimedTiles(world, self) {
    var set = new Set(), w = world.map.width;
    world.entities.forEach(function (u) {
      if (u.kind !== 'unit' || u === self) return;
      var p = u.nav && u.nav.path.length ? u.nav.path[u.nav.path.length - 1] : null;
      set.add(p ? p.y * w + p.x : Math.floor(u.y) * w + Math.floor(u.x));
    });
    return set;
  }

  function segmentClear(map, ax, ay, bx, by) {
    for (var i = 1; i <= 6; i++) {
      var t = i / 6;
      if (!RTS.map.isWalkable(map, Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t))) return false;
    }
    return true;
  }

  function plan(world, unit, goal, spread) {
    var map = world.map, sx = Math.floor(unit.x), sy = Math.floor(unit.y);
    var res = null;
    var owner = unit.owner;
    if (spread) res = RTS.path.find(map, sx, sy, goal, { avoid: claimedTiles(world, unit), owner: owner });
    if (!res || !res.reached) res = RTS.path.find(map, sx, sy, goal, { owner: owner });
    var path = res.path;
    if (path.length) {
      // 單位偏離格中心時，直接走向下一格可能擦進障礙，先回到本格中心
      if (!segmentClear(map, unit.x, unit.y, path[0].x + 0.5, path[0].y + 0.5)) path.unshift({ x: sx, y: sy });
    } else if (res.reached) {
      path = [{ x: sx, y: sy }];
    }
    return { goal: { x: goal.x, y: goal.y, w: goal.w }, path: path, reached: res.reached };
  }

  function isInRange(unit, goal) {
    if (goal.center) {
      return RTS.util.dist(unit.x, unit.y, goal.x + 0.5, goal.y + 0.5) < 0.05;
    }
    return RTS.util.distToRect(unit.x, unit.y, goal) <= goal.range + 1e-3;
  }

  function goalChanged(a, b) {
    return Math.abs(a.x - b.x) > 0.9 || Math.abs(a.y - b.y) > 0.9 || a.w !== b.w;
  }

  // 村民的移動速度含主堡研究加成
  function speedOf(world, unit) {
    var def = RTS.world.defOf(unit);
    if (unit.kind !== 'unit' || !def.canBuild) return def.speed;
    return def.speed * (1 + RTS.research.economy(world, unit.owner, 'speed'));
  }

  function follow(world, unit, dt) {
    var path = unit.nav.path;
    var step = (unit.order.speed || speedOf(world, unit)) * dt;    // order.speed：慢走
    while (step > 1e-9 && path.length) {
      var next = path[0];
      if (!RTS.map.passable(world.map, next.x, next.y, unit.owner)) { unit.nav = null; return; }
      var dx = next.x + 0.5 - unit.x, dy = next.y + 0.5 - unit.y;
      var d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.01) unit.facing = dx > 0 ? 1 : -1;
      if (d <= step) {
        unit.x = next.x + 0.5;
        unit.y = next.y + 0.5;
        step -= d;
        path.shift();
      } else {
        unit.x += dx / d * step;
        unit.y += dy / d * step;
        step = 0;
      }
    }
  }

  // 回傳 'arrived'（已在範圍內）、'moving'、'blocked'（走到最近處仍到不了）
  // opts.eager：一進入範圍就停（追擊、遠程攻擊）；opts.spread：避開別人佔的站位
  function approach(world, unit, goal, dt, opts) {
    opts = opts || {};
    var inRange = isInRange(unit, goal);
    if (inRange && (opts.eager || !unit.nav || !unit.nav.path.length)) {
      unit.nav = null;
      return 'arrived';
    }
    if (!unit.nav || goalChanged(unit.nav.goal, goal)) {
      if (world.pathBudget <= 0) return 'moving';
      world.pathBudget--;
      unit.nav = plan(world, unit, goal, opts.spread);
    }
    if (!unit.nav.path.length) {
      var reached = unit.nav.reached;
      unit.nav = null;
      return reached ? 'moving' : 'blocked';
    }
    follow(world, unit, dt);
    return 'moving';
  }

  function pointGoal(tx, ty) {
    return { x: tx, y: ty, w: 1, h: 1, range: 0, center: true };
  }

  // 靠近某個實體所需的目標矩形
  function entityGoal(target, range) {
    if (target.w === undefined) {
      return { x: target.x - 0.2, y: target.y - 0.2, w: 0.4, h: 0.4, range: Math.max(0.6, range - 0.2) };
    }
    return { x: target.x, y: target.y, w: target.w, h: target.h, range: range };
  }

  // 單位被建築壓住時移到最近的空格
  function rescue(world, unit) {
    var tx = Math.floor(unit.x), ty = Math.floor(unit.y);
    if (RTS.map.passable(world.map, tx, ty, unit.owner)) return;
    var t = RTS.map.nearestFree(world.map, tx, ty, undefined, unit.owner);
    if (!t) return;
    unit.x = t.x + 0.5;
    unit.y = t.y + 0.5;
    unit.nav = null;
  }

  // 把重疊的靜止單位輕輕推開。工作中的單位只在原本的格子內挪動
  function separate(world, dt) {
    var still = RTS.world.list(world, function (e) { return e.kind === 'unit' && !e.nav; });
    var MIN = 0.5;
    for (var i = 0; i < still.length; i++) {
      for (var j = i + 1; j < still.length; j++) {
        var a = still[i], b = still[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) >= MIN || Math.abs(dy) >= MIN) continue;
        var d = Math.hypot(dx, dy);
        if (d >= MIN) continue;
        if (d < 1e-4) { dx = Math.cos(b.id * 2.4); dy = Math.sin(b.id * 2.4); d = 1; }
        var push = Math.min((MIN - d) / 2, dt * 0.8);
        nudge(world, a, -dx / d * push, -dy / d * push);
        nudge(world, b, dx / d * push, dy / d * push);
      }
    }
  }

  function nudge(world, u, dx, dy) {
    var nx = u.x + dx, ny = u.y + dy;
    var same = Math.floor(nx) === Math.floor(u.x) && Math.floor(ny) === Math.floor(u.y);
    if (!same && (u.order.type !== 'idle' || !RTS.map.passable(world.map, Math.floor(nx), Math.floor(ny), u.owner))) return;
    u.x = nx;
    u.y = ny;
  }

  RTS.move = {
    beginTick: beginTick, speedOf: speedOf, approach: approach, pointGoal: pointGoal, entityGoal: entityGoal,
    rescue: rescue, separate: separate
  };
})();
