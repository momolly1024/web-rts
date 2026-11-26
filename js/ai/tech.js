// AI 科技：軍隊成形後蓋鐵匠鋪並依序研究。只透過指令介面操作。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  var ORDER = ['meleeAttack', 'rangedAttack', 'meleeArmor', 'rangedArmor'];

  // 先把所有項目的第一級做完，再做第二級
  function nextTrack(ctx, maxLevel) {
    for (var lv = 0; lv < maxLevel; lv++) {
      for (var i = 0; i < ORDER.length; i++) {
        if (RTS.research.level(ctx.world, ctx.pid, ORDER[i]) === lv) return ORDER[i];
      }
    }
    return null;
  }

  // 資源寬裕（兩倍花費）時把箭塔改建成高傷害型
  function branchTowers(ctx) {
    ctx.buildings.forEach(function (b) {
      var branches = RTS.data.buildings[b.type].branches;
      if (!branches || b.branch || b.queue.length || !b.complete) return;
      var cost = branches.damage.cost, res = ctx.world.players[ctx.pid].res;
      if (Object.keys(cost).every(function (k) { return res[k] >= cost[k] * 2; })) {
        ctx.issue({ type: 'branch', buildingId: b.id, branch: 'damage' });
      }
    });
  }

  function develop(ctx) {
    branchTowers(ctx);
    var cfg = ctx.cfg.blacksmith;
    if (!cfg || ctx.army.length < cfg.atArmy) return;
    var smiths = ctx.buildings.filter(function (b) { return b.type === 'blacksmith'; });
    if (!smiths.length) {
      AI.economy.startBuilding(ctx, 'blacksmith');
      return;
    }
    var smith = smiths[0], track = nextTrack(ctx, cfg.maxLevel);
    if (track && smith.complete && !smith.queue.length) ctx.issue({ type: 'research', buildingId: smith.id, track: track });
    upgradeUnits(ctx);
  }

  // 兵種升級：在對應的生產建築研究，排在出兵前面（研究期間該建築不出兵）
  function upgradeUnits(ctx) {
    if (!ctx.cfg.military.tiers) return;
    ['swordLine', 'archerLine', 'cavalryLine'].forEach(function (track) {
      var b = ctx.buildings.filter(function (e) {
        var r = RTS.data.buildings[e.type].researches;
        return e.complete && !e.queue.length && r && r.indexOf(track) >= 0;
      })[0];
      if (b && RTS.research.check(ctx.world, b, track).ok) ctx.issue({ type: 'research', buildingId: b.id, track: track });
    });
  }

  AI.tech = { develop: develop };
})();
