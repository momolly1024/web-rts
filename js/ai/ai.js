// AI 主控與軍事：防守、集結、分波進攻。對遊戲的任何改變都走指令介面。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  function findThreat(ctx) {
    var radius = RTS.data.ai.defendRadius, threat = null;
    ctx.world.entities.forEach(function (e) {
      if (threat || e.kind !== 'unit' || e.owner === ctx.pid) return;
      var near = ctx.buildings.some(function (b) { return RTS.world.distTo(e.x, e.y, b) <= radius; });
      if (near) threat = e;
    });
    return threat;
  }

  function enemyTarget(ctx) {
    var from = RTS.world.center(ctx.tc);
    function enemy(type) {
      return RTS.world.nearest(ctx.world, from.x, from.y, function (e) {
        return e.kind === 'building' && e.owner !== ctx.pid && (!type || e.type === type);
      });
    }
    return enemy('townCenter') || enemy(null);
  }

  // 讓抵達或閒下來的進攻部隊繼續推進
  function driveWave(ctx, target) {
    var march = [], assault = [];
    var c = RTS.world.center(target);
    ctx.army.forEach(function (u) {
      if (!ctx.state.wave[u.id] || u.order.type !== 'idle') return;
      if (RTS.world.distTo(u.x, u.y, target) <= 6) assault.push(u.id);
      else march.push(u.id);
    });
    if (march.length) ctx.issue({ type: 'attackMove', unitIds: march, x: c.x, y: c.y });
    if (assault.length) ctx.issue({ type: 'attack', unitIds: assault, targetId: target.id });
  }

  function command(ctx) {
    var cfg = RTS.data.ai, state = ctx.state;
    var threat = findThreat(ctx);
    if (threat) {
      var defenders = ctx.army.filter(function (u) {
        return !state.wave[u.id] && u.order.type === 'idle';
      }).map(function (u) { return u.id; });
      if (defenders.length) ctx.issue({ type: 'attackMove', unitIds: defenders, x: threat.x, y: threat.y });
    }

    var target = enemyTarget(ctx);
    if (!target) return;
    if (ctx.world.time >= cfg.graceTime && !threat) {
      var reserve = ctx.army.filter(function (u) { return !state.wave[u.id]; });
      var size = Math.min(cfg.attackSize + state.waves * cfg.waveGrowth, cfg.attackSizeMax);
      // 資源枯竭湊不滿一波時，過了很久就帶現有兵力出擊
      var desperate = reserve.length > 0 && ctx.world.time - state.lastWave > 240 &&
        ctx.world.time > cfg.graceTime + 240;
      var rested = state.waves === 0 || ctx.world.time - state.lastWave >= cfg.waveInterval;
      if (rested && (reserve.length >= size || desperate)) {
        reserve = reserve.slice(0, size);      // 其餘留守，等下一波
        reserve.forEach(function (u) { state.wave[u.id] = true; });
        state.waves++;
        state.lastWave = ctx.world.time;
        var c = RTS.world.center(target);
        ctx.issue({
          type: 'attackMove', x: c.x, y: c.y,
          unitIds: reserve.map(function (u) { return u.id; })
        });
      }
    }
    driveWave(ctx, target);
  }

  function think(world, pid, state) {
    var buildings = RTS.world.buildingsOf(world, pid);
    var tc = buildings.filter(function (b) { return b.type === 'townCenter' && b.complete; })[0];
    if (!tc) return;
    var units = RTS.world.unitsOf(world, pid);
    var ctx = {
      world: world, pid: pid, state: state, tc: tc, buildings: buildings,
      villagers: units.filter(function (u) { return !RTS.data.units[u.type].military; }),
      army: units.filter(function (u) { return RTS.data.units[u.type].military; }),
      issue: function (cmd) { return RTS.commands.issue(world, pid, cmd); }
    };
    AI.economy.develop(ctx);
    AI.economy.assignVillagers(ctx);
    command(ctx);
  }

  AI.create = function (pid) {
    var state = { timer: 0, waves: 0, lastWave: 0, wave: {}, assigned: {}, badNodes: {}, sites: {} };
    return {
      state: state,
      update: function (world, dt) {
        if (world.over) return;
        state.timer -= dt;
        if (state.timer > 0) return;
        state.timer = RTS.data.ai.thinkInterval;
        think(world, pid, state);
      }
    };
  };
})();
