// AI 主控與軍事：防守、集結、分波進攻。對遊戲的任何改變都走指令介面。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  // 基準參數套上該難度的覆寫值；未知難度一律視為預設
  function config(difficulty) {
    var data = RTS.data;
    var key = data.difficultyOrder.indexOf(difficulty) >= 0 ? difficulty : data.defaultDifficulty;
    return Object.assign({ difficulty: key }, data.ai, data.difficulties[key].ai);
  }

  // 依對局時間套上後期成長後的參數
  function effective(cfg, time) {
    var late = cfg.late, steps = late ? Math.floor((time - late.after) / late.every) : 0;
    if (steps <= 0) return cfg;
    var add = steps * late.step;
    return Object.assign({}, cfg, {
      growing: true,
      attackSizeMax: Math.min(late.attackSizeMax, cfg.attackSizeMax + add)
    });
  }

  function findThreat(ctx) {
    var radius = ctx.cfg.defendRadius, threat = null;
    ctx.world.entities.forEach(function (e) {
      if (threat || e.kind !== 'unit' || e.owner === ctx.pid || !RTS.fog.sees(ctx.world, ctx.pid, e)) return;
      var near = ctx.buildings.some(function (b) { return RTS.world.distTo(e.x, e.y, b) <= radius; });
      if (near) threat = e;
    });
    return threat;
  }

  // 只從看得到與記得的敵方建築裡挑（主堡優先、近者優先）；沒看過就沒有目標
  function enemyTarget(ctx) {
    var from = RTS.world.center(ctx.tc);
    function rank(b) {
      return (b.type === 'townCenter' ? 0 : 1000) + RTS.world.distTo(from.x, from.y, b);
    }
    return RTS.fog.perceived(ctx.world, ctx.pid).filter(function (e) {
      return e.kind === 'building' && e.owner !== ctx.pid;
    }).sort(function (a, b) { return rank(a) - rank(b); })[0] || null;
  }

  // 讓抵達或閒下來的進攻部隊繼續推進
  function driveWave(ctx, target) {
    var march = [], assault = [];
    var c = RTS.world.center(target);
    ctx.army.forEach(function (u) {
      if (!ctx.state.wave[u.id] || u.order.type !== 'idle') return;
      if (!target.ghost && RTS.world.distTo(u.x, u.y, target) <= 6) assault.push(u.id);
      else march.push(u.id);
    });
    if (march.length) ctx.issue({ type: 'attackMove', unitIds: march, x: c.x, y: c.y });
    if (assault.length) ctx.issue({ type: 'attack', unitIds: assault, targetId: target.id });
  }

  function command(ctx) {
    var cfg = ctx.cfg, state = ctx.state;
    var threat = findThreat(ctx);
    if (threat) {
      var defenders = ctx.army.filter(function (u) {
        return !state.wave[u.id] && u.order.type === 'idle';
      }).map(function (u) { return u.id; });
      if (defenders.length) ctx.issue({ type: 'attackMove', unitIds: defenders, x: threat.x, y: threat.y });
    }

    var target = enemyTarget(ctx);
    AI.scout.develop(ctx, !!target && target.type === 'townCenter');
    if (!target) return;
    if (cfg.attack && ctx.world.time >= cfg.graceTime && !threat) {
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

  function think(world, pid, state, cfg) {
    var buildings = RTS.world.buildingsOf(world, pid);
    var towns = buildings.filter(function (b) { return b.type === 'townCenter' && b.complete; });
    var tc = towns[0];
    if (!tc) return;
    // 偵查中的單位由偵查模組管，其他模組不指派它
    var units = RTS.world.unitsOf(world, pid).filter(function (u) { return u.id !== state.scoutId; });
    var ctx = {
      world: world, pid: pid, state: state, cfg: effective(cfg, world.time), tc: tc, towns: towns, buildings: buildings,
      away: RTS.world.unitsOf(world, pid).filter(function (u) { return u.id === state.scoutId; }),
      villagers: units.filter(function (u) { return !RTS.data.units[u.type].military; }),
      army: units.filter(function (u) { return RTS.data.units[u.type].military; }),
      issue: function (cmd) { return RTS.commands.issue(world, pid, cmd); }
    };
    AI.age.develop(ctx);       // 升時代優先：條件齊了就暫停訓練存資源
    AI.tech.develop(ctx);      // 排在訓練之前，軍隊成形後科技優先拿資源
    AI.counter.observe(ctx);
    AI.expand.develop(ctx);    // 排在訓練之前，替主堡保留的資源才有效
    AI.economy.develop(ctx);
    AI.camps.develop(ctx);
    AI.hunt.develop(ctx);
    AI.economy.assignVillagers(ctx);
    AI.care.repair(ctx);
    AI.care.shelter(ctx);
    command(ctx);
  }

  AI.config = config;
  AI.effective = effective;

  AI.create = function (pid, difficulty) {
    var cfg = config(difficulty);
    var state = { timer: 0, waves: 0, lastWave: 0, lastDrip: 0, lastTrain: -Infinity, wave: {}, assigned: {}, badNodes: {}, sites: {},
      campTry: {}, needFarm: false, mostTowns: 1, enemies: {},
      badPrey: {}, huntStart: 0, sightings: {}, lookTime: -60, scoutId: 0, route: null, heading: null, leg: 0, laps: 0 };
    return {
      difficulty: cfg.difficulty,
      state: state,
      update: function (world, dt) {
        if (world.over) return;
        state.timer -= dt;
        if (state.timer > 0) return;
        state.timer = cfg.thinkInterval;
        think(world, pid, state, cfg);
      }
    };
  };
})();
