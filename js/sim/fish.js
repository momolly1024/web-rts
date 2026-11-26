// 釣魚：村民站在岸邊拋竿，等魚上鉤。收穫隨機、水池不會枯竭；滿載就送回收食物的建築。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var POND_REACH = 8;      // 從點到的水格沿水面找岸邊的最遠步數
  var SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function isWater(map, x, y) {
    return RTS.map.inBounds(map, x, y) && map.terrain[y * map.width + x] === RTS.map.TERRAIN.WATER;
  }

  // 玩家指得到的水面：看過的水格
  function fishable(world, pid, x, y) {
    var tx = Math.floor(x), ty = Math.floor(y);
    return isWater(world.map, tx, ty) && RTS.fog.tile(world, pid, tx, ty) !== RTS.fog.UNEXPLORED;
  }

  // 其他釣客佔住的岸邊格
  function taken(world, self) {
    var set = {};
    world.entities.forEach(function (u) {
      if (u !== self && u.kind === 'unit' && u.order.type === 'fish') set[u.order.sx + ',' + u.order.sy] = true;
    });
    return set;
  }

  // 沿著同一片水面找岸邊空位：離指定水格近、也離村民近者優先。沒有回傳 null
  function findSpot(world, u, from, skip) {
    var map = world.map, busy = taken(world, u), seen = {}, best = null, bestD = Infinity;
    var queue = [{ x: from.x, y: from.y, step: 0 }];
    seen[from.x + ',' + from.y] = true;
    for (var head = 0; head < queue.length; head++) {
      var w = queue[head];
      for (var i = 0; i < SIDES.length; i++) {
        var x = w.x + SIDES[i][0], y = w.y + SIDES[i][1], key = x + ',' + y;
        if (isWater(map, x, y)) {
          if (!seen[key] && w.step < POND_REACH) {
            seen[key] = true;
            queue.push({ x: x, y: y, step: w.step + 1 });
          }
        } else if (!busy[key] && !(skip && skip[key]) && RTS.map.passable(map, x, y, u.owner)) {
          var d = w.step * 2 + RTS.util.dist(u.x, u.y, x + 0.5, y + 0.5) * 0.3;
          if (d < bestD) { bestD = d; best = { sx: x, sy: y, wx: w.x, wy: w.y }; }
        }
      }
    }
    return best;
  }

  // sx, sy 為站立的岸邊格；wx, wy 為下竿的水格
  function makeOrder(spot) {
    return {
      type: 'fish', resource: 'food', sx: spot.sx, sy: spot.sy, wx: spot.wx, wy: spot.wy,
      timer: 0, casting: false, returning: false, skip: {}
    };
  }

  function random(world) {
    if (!world.fishRand) world.fishRand = RTS.util.rng((world.seed || 1) * 31 + 17);
    return world.fishRand();
  }

  // 依權重抽一次收穫
  function roll(world) {
    var catches = RTS.data.fishing.catches;
    var left = random(world) * catches.reduce(function (n, c) { return n + c.weight; }, 0);
    for (var i = 0; i < catches.length; i++) {
      left -= catches[i].weight;
      if (left < 0) return catches[i];
    }
    return catches[catches.length - 1];
  }

  function land(world, u) {
    var o = u.order, got = roll(world);
    if (got.food) {
      u.carry.resource = 'food';
      u.carry.amount += got.food;      // 大魚可以超過負重，下一步就先送回去
    }
    world.effects.push({
      type: 'catch', fish: got.id, food: got.food,
      x1: o.wx + 0.5, y1: o.wy + 0.5, x2: u.x, y2: u.y, age: 0, life: 1.8
    });
  }

  // 岸邊位置到不了：換一格，整片水面都不行就停手
  function relocate(world, u) {
    var o = u.order;
    o.skip[o.sx + ',' + o.sy] = true;
    var spot = findSpot(world, u, { x: o.wx, y: o.wy }, o.skip);
    if (!spot) { RTS.orders.set(u, { type: 'idle' }); return; }
    o.sx = spot.sx;
    o.sy = spot.sy;
    o.wx = spot.wx;
    o.wy = spot.wy;
    u.nav = null;
  }

  function update(world, u, dt) {
    var o = u.order;
    var other = u.carry.amount > 0 && u.carry.resource !== 'food';
    if (o.returning || other || u.carry.amount >= RTS.gather.capacity(world, u)) {
      o.returning = true;
      o.casting = false;
      var r = RTS.gather.returnCargo(world, u, dt);
      if (r === 'done') o.returning = false;
      else if (r === 'none') RTS.orders.set(u, { type: 'idle' });
      return;
    }
    var status = RTS.move.approach(world, u, RTS.move.pointGoal(o.sx, o.sy), dt);
    o.casting = status === 'arrived';
    if (status === 'blocked') { relocate(world, u); return; }
    if (!o.casting) return;
    // 面向水面（等角畫面的左右由 x - y 決定）
    u.facing = (o.wx - o.wy) > (o.sx - o.sy) ? 1 : -1;
    if (o.timer <= 0) {
      var wait = RTS.data.fishing.wait;
      o.timer = wait[0] + random(world) * (wait[1] - wait[0]);
      return;
    }
    o.timer -= dt;
    if (o.timer <= 0) land(world, u);
  }

  RTS.fish = {
    isWater: isWater, fishable: fishable, findSpot: findSpot, makeOrder: makeOrder, roll: roll, update: update
  };
})();
