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

  function develop(ctx) {
    var cfg = ctx.cfg.blacksmith;
    if (!cfg || ctx.army.length < cfg.atArmy) return;
    var smiths = ctx.buildings.filter(function (b) { return b.type === 'blacksmith'; });
    if (!smiths.length) {
      AI.economy.startBuilding(ctx, 'blacksmith');
      return;
    }
    var smith = smiths[0], track = nextTrack(ctx, cfg.maxLevel);
    if (!track || !smith.complete || smith.queue.length) return;
    ctx.issue({ type: 'research', buildingId: smith.id, track: track });
  }

  AI.tech = { develop: develop };
})();
