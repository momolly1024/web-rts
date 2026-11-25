// AI 升時代：村民夠多就補齊前置建築、存食物，然後在主堡研究下一個時代。只透過指令介面操作。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  function develop(ctx) {
    var cfg = ctx.cfg.age, world = ctx.world, pid = ctx.pid;
    var current = RTS.research.age(world, pid);
    ctx.state.saving = false;
    if (current >= cfg.maxAge || RTS.research.pending(world, pid, 'age')) return;
    // 村民夠多、手上也有基本兵力才開始準備，避免存錢期間毫無防備
    if (ctx.villagers.length < cfg.at[current] || ctx.army.length < cfg.army[current]) return;
    var next = RTS.data.upgrades.age.levels[current];
    var met = RTS.research.needsMet(world, pid, next.needs);
    if (!met.ok) {
      // 依序補還沒有的前置建築（工地也算在蓋了）
      var missing = next.needs.from.filter(function (type) {
        return !ctx.buildings.some(function (b) { return b.type === type; });
      });
      var building = ctx.buildings.filter(function (b) {
        return !b.complete && next.needs.from.indexOf(b.type) >= 0;
      }).length;
      if (met.have.length + building < next.needs.count && missing.length) {
        AI.economy.startBuilding(ctx, missing[0]);
      }
      return;
    }
    // 條件都齊了：暫停訓練存資源，夠了就研究
    if (ctx.issue({ type: 'research', buildingId: ctx.tc.id, track: 'age' }).ok) return;
    ctx.state.saving = true;
  }

  AI.age = { develop: develop };
})();
