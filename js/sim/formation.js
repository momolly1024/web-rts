// 混合兵種移動時的排位：近戰在前，遠程次之，治療者與村民殿後。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var RANGED = 1.5;     // 射程超過此值算遠程

  function rank(u) {
    var def = RTS.data.units[u.type];
    if (def.canBuild) return 3;
    if (!def.attack) return 2;
    return def.attack.range > RANGED ? 1 : 0;
  }

  function mixed(units) {
    return units.some(function (u) { return rank(u) !== rank(units[0]); });
  }

  // 回傳與 units 同順序的目的格；tiles 的數量可能少於單位數
  function assign(units, tiles, tx, ty) {
    var cx = 0, cy = 0;
    units.forEach(function (u) { cx += u.x / units.length; cy += u.y / units.length; });
    var dx = tx + 0.5 - cx, dy = ty + 0.5 - cy, len = Math.hypot(dx, dy);
    if (len < 0.5) { dx = 0; dy = 1; len = 1; }
    dx /= len;
    dy /= len;
    function forward(p) { return p.x * dx + p.y * dy; }
    function side(p) { return p.y * dx - p.x * dy; }

    // 最前面的格子排最前
    var slots = tiles.slice().sort(function (a, b) { return forward(b) - forward(a); });
    while (slots.length < units.length) slots.push(slots[slots.length - 1]);
    var ordered = units.slice().sort(function (a, b) { return rank(a) - rank(b) || forward(b) - forward(a); });
    var result = new Array(units.length), start = 0;
    while (start < ordered.length) {
      var end = start + 1;
      while (end < ordered.length && rank(ordered[end]) === rank(ordered[start])) end++;
      // 同一排內依左右位置配對，走位才不會交叉
      var row = ordered.slice(start, end).sort(function (a, b) { return side(a) - side(b); });
      var spots = slots.slice(start, end).sort(function (a, b) { return side(a) - side(b); });
      for (var i = 0; i < row.length; i++) result[units.indexOf(row[i])] = spots[i];
      start = end;
    }
    return result;
  }

  RTS.formation = { rank: rank, mixed: mixed, assign: assign };
})();
