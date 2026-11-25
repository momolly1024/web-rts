// 格子地圖：地形與佔用資訊。座標單位是「格」。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var TERRAIN = { GRASS: 0, WATER: 1 };

  function create(width, height) {
    var n = width * height;
    return {
      width: width,
      height: height,
      terrain: new Uint8Array(n),
      occupant: new Int32Array(n),  // 佔用該格的實體 id（天然物件或建築），0 表示空
      floor: new Int32Array(n)      // 可行走的平地建築（農田）id；不擋路，但不能再蓋東西
    };
  }

  function inBounds(map, x, y) {
    return x >= 0 && y >= 0 && x < map.width && y < map.height;
  }

  function isWalkable(map, x, y) {
    if (!inBounds(map, x, y)) return false;
    var i = y * map.width + x;
    return map.terrain[i] === TERRAIN.GRASS && map.occupant[i] === 0;
  }

  function setOccupant(map, rect, id) {
    for (var y = rect.y; y < rect.y + rect.h; y++) {
      for (var x = rect.x; x < rect.x + rect.w; x++) {
        if (inBounds(map, x, y)) map.occupant[y * map.width + x] = id;
      }
    }
  }

  function setFloor(map, rect, id) {
    for (var y = rect.y; y < rect.y + rect.h; y++) {
      for (var x = rect.x; x < rect.x + rect.w; x++) {
        if (inBounds(map, x, y)) map.floor[y * map.width + x] = id;
      }
    }
  }

  function floorAt(map, x, y) {
    return inBounds(map, x, y) ? map.floor[y * map.width + x] : 0;
  }

  function occupantAt(map, x, y) {
    return inBounds(map, x, y) ? map.occupant[y * map.width + x] : 0;
  }

  // 由近到遠找可走的格子（環狀掃描，同一圈取歐氏距離最近者）
  function nearestFree(map, tx, ty, maxRadius) {
    var limit = maxRadius === undefined ? Math.max(map.width, map.height) : maxRadius;
    for (var r = 0; r <= limit; r++) {
      var best = null, bestD = Infinity;
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!isWalkable(map, tx + dx, ty + dy)) continue;
          var d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = { x: tx + dx, y: ty + dy }; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // 從目標附近以 BFS 取出 count 個相連且互不相同的可走格，用於多單位移動分散站位
  function spreadTiles(map, tx, ty, count) {
    var start = nearestFree(map, tx, ty);
    if (!start) return [];
    var seen = new Uint8Array(map.width * map.height);
    var queue = [start], out = [], head = 0;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    seen[start.y * map.width + start.x] = 1;
    while (head < queue.length && out.length < count) {
      var cur = queue[head++];
      out.push(cur);
      for (var i = 0; i < dirs.length; i++) {
        var nx = cur.x + dirs[i][0], ny = cur.y + dirs[i][1];
        if (!isWalkable(map, nx, ny) || seen[ny * map.width + nx]) continue;
        // 斜向擴張同樣不可穿牆角
        if (!isWalkable(map, cur.x, ny) || !isWalkable(map, nx, cur.y)) continue;
        seen[ny * map.width + nx] = 1;
        queue.push({ x: nx, y: ny });
      }
    }
    return out;
  }

  // 矩形外圍是否有可站立的格子（資源或建築是否可接近）
  function hasFreeNeighbor(map, rect) {
    for (var y = rect.y - 1; y <= rect.y + rect.h; y++) {
      for (var x = rect.x - 1; x <= rect.x + rect.w; x++) {
        if (isWalkable(map, x, y)) return true;
      }
    }
    return false;
  }

  RTS.map = {
    TERRAIN: TERRAIN,
    create: create,
    inBounds: inBounds,
    isWalkable: isWalkable,
    setOccupant: setOccupant,
    setFloor: setFloor,
    floorAt: floorAt,
    occupantAt: occupantAt,
    nearestFree: nearestFree,
    spreadTiles: spreadTiles,
    hasFreeNeighbor: hasFreeNeighbor
  };
})();
