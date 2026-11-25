// 閒逛：動物沒事時在定點附近慢慢走一小段、停一陣子。直線小步移動，不使用尋路額度。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var TRIES = 6;

  // 依地圖種子、動物與第幾次決定亂數，重播同一局會得到相同走法
  function dice(world, a) {
    a.strolls++;
    var seed = (world.seed || 0) ^ Math.imul(a.id, 2654435761) ^ Math.imul(a.strolls, 40503);
    return RTS.util.rng(seed);
  }

  // 以目前位置為定點（牲畜被認領或走到主人指定處時）
  function anchor(a) {
    a.home = { x: a.x, y: a.y };
    a.stroll = null;
  }

  function radiusOf(a) {
    var cfg = RTS.data.animals[a.type].wander;
    return a.owner === null ? cfg.radius : cfg.ownedRadius;
  }

  function walkable(world, x, y) {
    return RTS.map.isWalkable(world.map, Math.floor(x), Math.floor(y));
  }

  function clearLine(world, a, x, y) {
    var steps = Math.ceil(RTS.util.dist(a.x, a.y, x, y) / 0.2);
    for (var i = 1; i <= steps; i++) {
      var px = a.x + (x - a.x) * i / steps, py = a.y + (y - a.y) * i / steps;
      // 斜越格角時兩側也要可走，避免穿過牆角
      if (!walkable(world, px, py) || !walkable(world, px, a.y + (y - a.y) * (i - 1) / steps) ||
          !walkable(world, a.x + (x - a.x) * (i - 1) / steps, py)) return false;
    }
    return true;
  }

  // 下一個落點：一定在定點半徑內；已在圈外（例如逃跑後）則朝定點走回去
  function pickSpot(world, a, rand) {
    var cfg = RTS.data.animals[a.type].wander, radius = radiusOf(a);
    var away = RTS.util.dist(a.x, a.y, a.home.x, a.home.y);
    for (var i = 0; i < TRIES; i++) {
      var angle = rand() * Math.PI * 2, length = cfg.step * (0.4 + rand() * 0.6);
      if (away > radius) angle = Math.atan2(a.home.y - a.y, a.home.x - a.x) + (rand() - 0.5) * i * 0.5;
      var x = a.x + Math.cos(angle) * length, y = a.y + Math.sin(angle) * length;
      var after = RTS.util.dist(x, y, a.home.x, a.home.y);
      if ((after <= radius || (away > radius && after < away)) && clearLine(world, a, x, y)) return { x: x, y: y };
    }
    return null;
  }

  function begin(world, a) {
    var cfg = RTS.data.animals[a.type].wander;
    var rand = dice(world, a);
    a.pause = cfg.pause[0] + rand() * (cfg.pause[1] - cfg.pause[0]);
    a.stroll = pickSpot(world, a, rand);
    // 圈外且直線走不回去：改用尋路慢慢走回定點
    if (!a.stroll && RTS.util.dist(a.x, a.y, a.home.x, a.home.y) > radiusOf(a)) {
      var tile = RTS.map.nearestFree(world.map, Math.floor(a.home.x), Math.floor(a.home.y), 3);
      if (tile) a.order = { type: 'move', x: tile.x, y: tile.y, speed: cfg.speed };
    }
  }

  function update(world, a, dt) {
    var spot = a.stroll;
    if (!spot) {
      a.pause -= dt;
      if (a.pause <= 0) begin(world, a);
      return;
    }
    var dx = spot.x - a.x, dy = spot.y - a.y, d = Math.hypot(dx, dy);
    var step = RTS.data.animals[a.type].wander.speed * dt;
    var nx = d <= step ? spot.x : a.x + dx / d * step;
    var ny = d <= step ? spot.y : a.y + dy / d * step;
    if (!walkable(world, nx, ny)) { a.stroll = null; return; }    // 途中蓋了建築
    if (Math.abs(dx) > 0.01) a.facing = dx > 0 ? 1 : -1;
    a.x = nx;
    a.y = ny;
    if (d <= step) a.stroll = null;
  }

  RTS.wander = { update: update, anchor: anchor };
})();
