// AI 兵種應對：記住最近看到的敵軍，剋制得了他們的兵種提高訓練比重。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  // 更新目擊紀錄：超過記憶時間，或看得到最後位置而該單位已經不在，就忘掉
  function observe(ctx) {
    var world = ctx.world, seen = ctx.state.enemies;
    world.entities.forEach(function (e) {
      if (e.kind !== 'unit' || e.owner === ctx.pid || !RTS.data.units[e.type].military) return;
      if (RTS.fog.sees(world, ctx.pid, e)) seen[e.id] = { type: e.type, x: e.x, y: e.y, time: world.time };
    });
    Object.keys(seen).forEach(function (id) {
      var s = seen[id];
      var gone = !world.entities.has(Number(id)) &&
        RTS.fog.tile(world, ctx.pid, Math.floor(s.x), Math.floor(s.y)) === RTS.fog.VISIBLE;
      if (gone || world.time - s.time > ctx.cfg.counter.memory) delete seen[id];
    });
  }

  function tally(ctx) {
    var counts = {}, total = 0;
    Object.keys(ctx.state.enemies).forEach(function (id) {
      var type = ctx.state.enemies[id].type;
      // 敵方的治療者與攻城槌不算進比例
      if (type === 'healer' || type === 'ram') return;
      counts[type] = (counts[type] || 0) + 1;
      total++;
    });
    function against(type) {
      return (RTS.data.counters[type] || []).reduce(function (n, t) { return n + (counts[t] || 0); }, 0);
    }
    return {
      against: against,
      // 訓練比重：1 為基準，能剋制的敵軍占比越高越大
      weight: function (type) { return total ? 1 + ctx.cfg.counter.bias * against(type) / total : 1; }
    };
  }

  AI.counter = { observe: observe, tally: tally };
})();
