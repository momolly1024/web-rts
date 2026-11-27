// AI 科技：軍隊成形後蓋鐵匠鋪並依序研究。只透過指令介面操作。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  var ORDER = ['meleeAttack', 'rangedAttack', 'meleeArmor', 'rangedArmor'];
  var UNIT_LINES = ['swordLine', 'archerLine', 'cavalryLine'];

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
      if (AI.age.holds(ctx, cost)) return;
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
    if (track && smith.complete && !smith.queue.length) research(ctx, smith, track);
    upgradeUnits(ctx);
  }

  function research(ctx, b, track) {
    var next = RTS.data.upgrades[track].levels[RTS.research.level(ctx.world, ctx.pid, track)];
    if (next && !AI.age.holds(ctx, next.cost)) ctx.issue({ type: 'research', buildingId: b.id, track: track });
  }

  // 兵種升級：在對應的生產建築研究，排在出兵前面（研究期間該建築不出兵）
  function upgradeUnits(ctx) {
    if (!ctx.cfg.military.tiers) return;
    UNIT_LINES.forEach(function (track) {
      var b = ctx.buildings.filter(function (e) {
        var r = RTS.data.buildings[e.type].researches;
        return e.complete && !e.queue.length && r && r.indexOf(track) >= 0;
      })[0];
      if (b && RTS.research.check(ctx.world, b, track).ok) research(ctx, b, track);
    });
  }

  // 現在就能研究、頂多缺資源的話回傳花費（建築要完工且閒著）
  function costOf(ctx, track) {
    var b = ctx.buildings.filter(function (e) {
      var r = RTS.data.buildings[e.type].researches;
      return e.complete && !e.queue.length && r && r.indexOf(track) >= 0;
    })[0];
    if (!b) return null;
    var r = RTS.research.check(ctx.world, b, track);
    if (!r.ok && r.reason !== 'notEnoughResources') return null;
    return RTS.data.upgrades[track].levels[RTS.research.level(ctx.world, ctx.pid, track)].cost;
  }

  // 軍隊達 techSaveAt 人後，替下一個研究保留資源，免得全花在出兵上
  function reserve(ctx) {
    if (ctx.army.length < ctx.cfg.techSaveAt) return null;
    var cfg = ctx.cfg.blacksmith;
    var tracks = cfg ? [nextTrack(ctx, cfg.maxLevel)] : [];
    if (ctx.cfg.military.tiers) tracks = tracks.concat(UNIT_LINES);
    for (var i = 0; i < tracks.length; i++) {
      var cost = tracks[i] && costOf(ctx, tracks[i]);
      if (cost) return cost;
    }
    return AI.camps.pendingCost(ctx);
  }

  AI.tech = { develop: develop, reserve: reserve };
})();
