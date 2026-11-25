// AI 偵查：還不知道敵人在哪裡時，派一個單位依序探索地圖。只透過指令介面操作。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  var GRID = 8;      // 偵查點間距（格）

  // 全圖格點，從主堡的對角方向開始找（對手通常在遠端，這是推測而非偷看）
  function waypoints(ctx) {
    var map = ctx.world.map, c = RTS.world.center(ctx.tc), out = [];
    for (var y = GRID; y < map.height; y += GRID) {
      for (var x = GRID; x < map.width; x += GRID) out.push({ x: x, y: y });
    }
    var fx = map.width - c.x, fy = map.height - c.y;
    return out.sort(function (a, b) {
      return RTS.util.dist(a.x, a.y, fx, fy) - RTS.util.dist(b.x, b.y, fx, fy);
    });
  }

  function pickScout(ctx) {
    var idleArmy = ctx.army.filter(function (u) { return !ctx.state.wave[u.id] && u.order.type === 'idle'; })[0];
    if (idleArmy) return idleArmy;
    if (ctx.villagers.length < 6) return null;
    return ctx.villagers.filter(function (u) {
      return u.order.type === 'idle' || (u.order.type === 'gather' && u.order.resource === 'wood');
    })[0] || null;
  }

  // knowsEnemy：是否已知任何敵方主堡
  function develop(ctx, knowsEnemy) {
    var s = ctx.state;
    if (knowsEnemy || ctx.world.time < ctx.cfg.scoutStart) {
      // 任務完成：叫斥候回家，不讓它留在敵營邊
      if (s.scoutId && RTS.world.get(ctx.world, s.scoutId)) {
        ctx.issue({ type: 'move', unitIds: [s.scoutId], x: ctx.tc.x + ctx.tc.w + 1, y: ctx.tc.y + ctx.tc.h + 1 });
      }
      s.scoutId = 0;
      return;
    }
    var scout = s.scoutId && RTS.world.get(ctx.world, s.scoutId);
    if (!scout) {
      scout = pickScout(ctx);
      if (!scout) return;
      s.scoutId = scout.id;
      s.heading = null;
    }
    if (!s.route) { s.route = waypoints(ctx); s.leg = 0; s.laps = 0; }
    // 抵達（或走不過去而停下）就換下一點；第一輪跳過已探索的點
    var arrived = s.heading && scout.order.type !== 'move';
    if (!s.heading || arrived) {
      if (arrived) s.leg++;
      for (var n = 0; n < s.route.length * 2; n++, s.leg++) {
        if (s.leg >= s.route.length) { s.leg = 0; s.laps++; }
        var p = s.route[s.leg];
        if (s.laps > 0 || RTS.fog.tile(ctx.world, ctx.pid, p.x, p.y) === RTS.fog.UNEXPLORED) break;
      }
      s.heading = s.route[s.leg];
      ctx.issue({ type: 'move', unitIds: [scout.id], x: s.heading.x, y: s.heading.y });
    }
  }

  AI.scout = { develop: develop };
})();
