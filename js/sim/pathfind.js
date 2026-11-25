// A* 尋路（八方向、不穿牆角）。目標是「與矩形距離 <= range 的格子」。
// 走不到時回傳通往「最接近目標的可達格」的路徑，reached 為 false。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var DIRS = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]
  ];
  var buf = null;

  function buffers(n) {
    if (!buf || buf.n !== n) {
      buf = {
        n: n, gen: 0,
        g: new Float64Array(n), from: new Int32Array(n),
        seen: new Uint32Array(n), closed: new Uint32Array(n)
      };
    }
    buf.gen++;
    return buf;
  }

  // 最小堆：存 [優先度, 格索引]
  function push(heap, f, node) {
    var i = heap.length;
    heap.push(null);
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (heap[p][0] <= f) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = [f, node];
  }

  function pop(heap) {
    var top = heap[0], last = heap.pop();
    if (heap.length) {
      var i = 0, n = heap.length;
      for (;;) {
        var c = i * 2 + 1;
        if (c >= n) break;
        if (c + 1 < n && heap[c + 1][0] < heap[c][0]) c++;
        if (heap[c][0] >= last[0]) break;
        heap[i] = heap[c];
        i = c;
      }
      heap[i] = last;
    }
    return top;
  }

  // 八方向距離估計：到矩形最近點扣掉 range
  function heuristic(x, y, goal) {
    var cx = x + 0.5, cy = y + 0.5;
    var dx = Math.max(goal.x - cx, 0, cx - (goal.x + goal.w));
    var dy = Math.max(goal.y - cy, 0, cy - (goal.y + goal.h));
    var h = Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy) - goal.range * Math.SQRT2;
    return h > 0 ? h : 0;
  }

  function inGoal(x, y, goal) {
    return RTS.util.distToRect(x + 0.5, y + 0.5, goal) <= goal.range + 1e-6;
  }

  // opts.avoid：Set(格索引)，這些格子可以經過但不能當終點（讓單位分散站位）
  function find(map, sx, sy, goal, opts) {
    var w = map.width, h = map.height;
    var avoid = opts && opts.avoid;
    var maxNodes = (opts && opts.maxNodes) || w * h;
    var b = buffers(w * h), gen = b.gen;
    var start = sy * w + sx;
    var heap = [];
    var best = start, bestH = Infinity, bestG = Infinity, found = -1, count = 0;

    b.g[start] = 0;
    b.from[start] = -1;
    b.seen[start] = gen;
    push(heap, heuristic(sx, sy, goal), start);

    while (heap.length && count < maxNodes) {
      var cur = pop(heap)[1];
      if (b.closed[cur] === gen) continue;
      b.closed[cur] = gen;
      count++;
      var x = cur % w, y = (cur - x) / w;

      if (inGoal(x, y, goal) && !(avoid && avoid.has(cur))) { found = cur; break; }

      var hv = heuristic(x, y, goal);
      if (hv < bestH - 1e-9 || (Math.abs(hv - bestH) <= 1e-9 && b.g[cur] < bestG)) {
        bestH = hv; bestG = b.g[cur]; best = cur;
      }

      for (var i = 0; i < 8; i++) {
        var nx = x + DIRS[i][0], ny = y + DIRS[i][1];
        if (!RTS.map.isWalkable(map, nx, ny)) continue;
        if (i >= 4 && (!RTS.map.isWalkable(map, x, ny) || !RTS.map.isWalkable(map, nx, y))) continue;
        var ni = ny * w + nx;
        if (b.closed[ni] === gen) continue;
        var g = b.g[cur] + DIRS[i][2];
        if (b.seen[ni] !== gen || g < b.g[ni]) {
          b.seen[ni] = gen;
          b.g[ni] = g;
          b.from[ni] = cur;
          push(heap, g + heuristic(nx, ny, goal), ni);
        }
      }
    }

    var end = found >= 0 ? found : best;
    var path = [];
    for (var n = end; n !== start && n !== -1; n = b.from[n]) {
      path.push({ x: n % w, y: Math.floor(n / w) });
    }
    path.reverse();
    return { path: path, reached: found >= 0 };
  }

  RTS.path = { find: find, inGoal: inGoal };
})();
