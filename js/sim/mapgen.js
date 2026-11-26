// 隨機地圖：以地圖中心做 180 度點對稱，雙方資源與地形完全相同。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var START = { x: 8, y: 8 };      // 玩家 0 主堡左上角；玩家 1 取對稱位置
  var HOME_RADIUS = 13;
  var HOME_STONES = 4;             // 每方家園石材固定數量

  function startPositions(map) {
    var s = RTS.data.buildings.townCenter.size;
    return [
      { x: START.x, y: START.y },
      { x: map.width - START.x - s, y: map.height - START.y - s }
    ];
  }

  function homeDist(x, y) {
    return Math.hypot(x + 0.5 - (START.x + 1.5), y + 0.5 - (START.y + 1.5));
  }

  // 從種子格隨機向外長出一團，每格套用 place（自動放置對稱格）
  function blob(rand, map, cx, cy, size, allowed, place) {
    var frontier = [{ x: cx, y: cy }], placed = 0, guard = 0;
    while (frontier.length && placed < size && guard++ < 600) {
      var i = placed === 0 ? 0 : Math.floor(rand() * frontier.length);
      var c = frontier.splice(i, 1)[0];
      var mx = map.width - 1 - c.x, my = map.height - 1 - c.y;
      if (!allowed(c.x, c.y) || !RTS.map.isWalkable(map, c.x, c.y) || !RTS.map.isWalkable(map, mx, my)) {
        if (placed === 0) {   // 種子格不可用時往旁邊找
          frontier.push({ x: c.x + Math.floor(rand() * 3) - 1, y: c.y + Math.floor(rand() * 3) - 1 });
        }
        continue;
      }
      place(c.x, c.y);
      if (mx !== c.x || my !== c.y) place(mx, my);
      placed++;
      frontier.push({ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y },
                    { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 });
    }
    return placed;
  }

  // 石材團放在其他家園資源之間；數量不足時換角度補滿
  function placeHomeStone(rand, map, base, allowed, place) {
    var left = HOME_STONES;
    for (var i = 0; i < 12 && left > 0; i++) {
      var a = base + Math.PI / 4 + i * Math.PI / 2 + (i >= 4 ? 0.35 : 0);
      var cx = RTS.util.clamp(Math.round(START.x + 1 + Math.cos(a) * 9), 1, map.width - 2);
      var cy = RTS.util.clamp(Math.round(START.y + 1 + Math.sin(a) * 9), 1, map.height - 2);
      left -= blob(rand, map, cx, cy, left, allowed, place);
    }
  }

  function populate(world, rand) {
    var map = world.map, W = map.width, H = map.height;
    function node(type) {
      return function (x, y) { RTS.world.addNode(world, type, x, y); };
    }
    function water(x, y) { map.terrain[y * W + x] = RTS.map.TERRAIN.WATER; }
    function homeOk(x, y) {
      var d = homeDist(x, y);
      return d >= 4.8 && d < HOME_RADIUS;
    }
    function wildOk(x, y) {
      return x + y < W - 1 && homeDist(x, y) >= HOME_RADIUS;
    }

    // 家園資源：四個方向各一團，角度加一點抖動
    var base = rand() * Math.PI * 2;
    [['berry', 6, 6.5], ['tree', 18, 8.5], ['gold', 5, 7.5], ['tree', 16, 9.5]].forEach(function (spec, i) {
      var a = base + i * Math.PI / 2 + (rand() - 0.5) * 0.35;
      var cx = Math.round(START.x + 1 + Math.cos(a) * spec[2]);
      var cy = Math.round(START.y + 1 + Math.sin(a) * spec[2]);
      cx = RTS.util.clamp(cx, 1, W - 2);
      cy = RTS.util.clamp(cy, 1, H - 2);
      blob(rand, map, cx, cy, spec[1], homeOk, node(spec[0]));
    });
    placeHomeStone(rand, map, base, homeOk, node('rock'));

    function scatter(count, min, max, place) {
      for (var i = 0; i < count; i++) {
        for (var tries = 0; tries < 40; tries++) {
          var x = Math.floor(rand() * W), y = Math.floor(rand() * H);
          if (!wildOk(x, y)) continue;
          blob(rand, map, x, y, min + Math.floor(rand() * (max - min + 1)), wildOk, place);
          break;
        }
      }
    }
    scatter(4, 6, 16, water);
    scatter(4, 4, 6, node('gold'));
    scatter(2, 4, 6, node('berry'));
    scatter(15, 8, 24, node('tree'));
    scatter(10, 1, 4, node('rock'));
  }

  // 雙方家旁各一個小水池（3x2，四周留岸）。找不到空地回傳 false
  function placeHomePond(world, rand) {
    var map = world.map, base = rand() * Math.PI * 2;
    function clear(x, y) {
      var d = homeDist(x, y);
      return d >= 5.5 && d < HOME_RADIUS && RTS.map.isWalkable(map, x, y) &&
        RTS.map.isWalkable(map, map.width - 1 - x, map.height - 1 - y);
    }
    for (var i = 0; i < 60; i++) {
      var a = base + i * 0.7, r = 8 + (i % 4);
      var x0 = Math.round(START.x + 1.5 + Math.cos(a) * r) - 1;
      var y0 = Math.round(START.y + 1.5 + Math.sin(a) * r) - 1;
      var ok = true;
      for (var y = y0 - 1; y <= y0 + 2 && ok; y++) {
        for (var x = x0 - 1; x <= x0 + 3 && ok; x++) ok = clear(x, y);
      }
      if (!ok) continue;
      for (var py = y0; py < y0 + 2; py++) {
        for (var px = x0; px < x0 + 3; px++) {
          map.terrain[py * map.width + px] = RTS.map.TERRAIN.WATER;
          map.terrain[(map.height - 1 - py) * map.width + map.width - 1 - px] = RTS.map.TERRAIN.WATER;
        }
      }
      return true;
    }
    return false;
  }

  // 在出生點周圍的環帶放動物，另一方取對稱位置
  function placeWildlife(world, rand) {
    var map = world.map, taken = {};
    RTS.data.wildlife.forEach(function (spec) {
      var placed = 0;
      for (var tries = 0; tries < 600 && placed < spec[1]; tries++) {
        var a = rand() * Math.PI * 2, r = spec[2] + rand() * (spec[3] - spec[2]);
        var x = Math.floor(START.x + 1.5 + Math.cos(a) * r), y = Math.floor(START.y + 1.5 + Math.sin(a) * r);
        var mx = map.width - 1 - x, my = map.height - 1 - y;
        if (x + y >= map.width - 1 || taken[x + ',' + y]) continue;
        if (!RTS.map.isWalkable(map, x, y) || !RTS.map.isWalkable(map, mx, my)) continue;
        taken[x + ',' + y] = true;
        RTS.world.addAnimal(world, spec[0], x + 0.5, y + 0.5);
        RTS.world.addAnimal(world, spec[0], mx + 0.5, my + 0.5);
        placed++;
      }
    });
  }

  // 四方向洪水填充，回傳可達格
  function flood(map, from) {
    var seen = new Uint8Array(map.width * map.height);
    var queue = [from];
    seen[from.y * map.width + from.x] = 1;
    for (var head = 0; head < queue.length; head++) {
      var c = queue[head];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var x = c.x + d[0], y = c.y + d[1];
        if (!RTS.map.isWalkable(map, x, y) || seen[y * map.width + x]) return;
        seen[y * map.width + x] = 1;
        queue.push({ x: x, y: y });
      });
    }
    return seen;
  }

  // 雙方相連，且每種家園資源都有足夠數量走得到
  function isPlayable(world) {
    var map = world.map, starts = startPositions(map), size = RTS.data.buildings.townCenter.size;
    var a = RTS.map.nearestFree(map, starts[0].x + size, starts[0].y + size);
    var b = RTS.map.nearestFree(map, starts[1].x - 1, starts[1].y - 1);
    if (!a || !b) return false;
    var seen = flood(map, a);
    if (!seen[b.y * map.width + b.x]) return false;
    var reach = { wood: 0, food: 0, gold: 0, stone: 0 };
    var stones = 0;
    world.entities.forEach(function (e) {
      var res = e.kind === 'node' && RTS.data.nodes[e.type].resource;
      if (!res || homeDist(e.x, e.y) >= HOME_RADIUS) return;
      if (res === 'stone') stones++;
      var open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) {
        var x = e.x + d[0], y = e.y + d[1];
        return RTS.map.inBounds(map, x, y) && seen[y * map.width + x];
      });
      if (open) reach[res]++;
    });
    return reach.food >= 4 && reach.gold >= 3 && reach.wood >= 12 &&
      stones === HOME_STONES && reach.stone >= 2;
  }

  // 產生含雙方主堡與村民的完整對局；地圖不合格就換種子重來
  function generate(seed, opts) {
    var world = null;
    for (var attempt = 0; attempt < 60; attempt++) {
      world = RTS.world.create(opts);
      var size = RTS.data.buildings.townCenter.size;
      var starts = startPositions(world.map);
      starts.forEach(function (p, pid) {
        RTS.world.addBuilding(world, 'townCenter', pid, p.x, p.y, true);
      });
      var rand = RTS.util.rng(seed + attempt * 7919);
      populate(world, rand);
      if (!placeHomePond(world, RTS.util.rng(seed * 13 + attempt)) || !isPlayable(world)) continue;
      placeWildlife(world, rand);
      starts.forEach(function (p, pid) {
        var sx = pid === 0 ? p.x + size : p.x - 1;
        var sy = pid === 0 ? p.y + size : p.y - 1;
        RTS.map.spreadTiles(world.map, sx, sy, RTS.data.START_VILLAGERS).forEach(function (t) {
          RTS.world.addUnit(world, 'villager', pid, t.x + 0.5, t.y + 0.5);
        });
      });
      world.seed = seed;
      if (!opts || opts.fog !== false) RTS.fog.enable(world);
      return world;
    }
    throw new Error('mapgen failed: no playable map for seed ' + seed);
  }

  RTS.mapgen = { generate: generate, startPositions: startPositions, isPlayable: isPlayable };
})();
