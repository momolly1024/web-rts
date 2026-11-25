// AI 狩獵：把認領到的牲畜帶回家，沒有現成獸肉時依難度派村民打獵。只透過指令介面操作。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});
  var AI = RTS.ai || (RTS.ai = {});

  var HOME = 6;        // 牲畜離主堡多遠內算到家
  var GIVE_UP = 40;    // 追太久就放棄（秒）

  function distHome(ctx, e) {
    return RTS.world.distTo(e.x, e.y, ctx.tc);
  }

  function bringHome(ctx, herd) {
    var strays = herd.filter(function (a) { return a.order.type === 'idle' && distHome(ctx, a) > HOME; });
    if (!strays.length) return;
    ctx.issue({
      type: 'move', unitIds: strays.map(function (a) { return a.id; }),
      x: ctx.tc.x + ctx.tc.w + 1, y: ctx.tc.y + ctx.tc.h + 1
    });
  }

  function nearestAnimal(ctx, filter, range) {
    var c = RTS.world.center(ctx.tc);
    return RTS.world.nearest(ctx.world, c.x, c.y, function (e) {
      return e.kind === 'animal' && !ctx.state.badPrey[e.id] &&
        RTS.fog.sees(ctx.world, ctx.pid, e) && filter(e);
    }, range);
  }

  // 依序考慮：家門口的牲畜、附近獵物、猛獸（需多人）
  function chooseTarget(ctx) {
    var cfg = ctx.cfg.hunt, pid = ctx.pid;
    function kind(a) { return RTS.data.animals[a.type].behavior; }
    var sheep = nearestAnimal(ctx, function (a) {
      return kind(a) === 'herd' && a.owner === pid && !RTS.data.animals[a.type].young;
    }, HOME + 1);
    if (sheep) return { animal: sheep, party: 1 };
    // 獵物與猛獸取離主堡較近者
    function wanted(type) {
      var behavior = RTS.data.animals[type].behavior;
      if (behavior === 'flee') return cfg.prey;
      return behavior === 'fight' && cfg.boarParty > 0 && ctx.villagers.length >= 10;
    }
    function party(type) { return RTS.data.animals[type].behavior === 'fight' ? cfg.boarParty : 2; }
    var wild = nearestAnimal(ctx, function (a) { return wanted(a.type); }, cfg.range);
    if (wild) return { animal: wild, party: party(wild.type) };
    // 眼前沒有，就走去記得看過獵物的地方
    var home = RTS.world.center(ctx.tc), best = null, bestD = cfg.range;
    Object.keys(ctx.state.sightings).forEach(function (id) {
      var s = ctx.state.sightings[id], d = RTS.util.dist(home.x, home.y, s.x, s.y);
      if (!ctx.state.badPrey[id] && wanted(s.type) && d <= bestD) { bestD = d; best = s; }
    });
    return best ? { spot: best, party: party(best.type) } : null;
  }

  // 記下看到過的野生動物；回到記錄位置卻沒看到就忘掉
  function remember(ctx) {
    var seen = ctx.state.sightings;
    Object.keys(seen).forEach(function (id) {
      var s = seen[id], a = RTS.world.get(ctx.world, +id);
      var there = RTS.fog.tile(ctx.world, ctx.pid, Math.floor(s.x), Math.floor(s.y)) === RTS.fog.VISIBLE;
      if (there && !(a && RTS.fog.sees(ctx.world, ctx.pid, a))) delete seen[id];
    });
    ctx.world.entities.forEach(function (a) {
      if (a.kind === 'animal' && a.owner === null && RTS.fog.sees(ctx.world, ctx.pid, a)) {
        seen[a.id] = { type: a.type, x: a.x, y: a.y };
      }
    });
  }

  // 有獸肉沒人採時派一位採食物的村民過去，避免打到的肉擺著不吃
  function tendMeat(ctx) {
    var c = RTS.world.center(ctx.tc);
    var meat = RTS.world.nearest(ctx.world, c.x, c.y, function (e) {
      return e.kind === 'node' && e.type === 'carcass' && !ctx.state.badNodes[e.id] &&
        RTS.fog.knows(ctx.world, ctx.pid, e);
    }, ctx.cfg.hunt.range);
    if (!meat) return false;
    var busy = ctx.villagers.some(function (u) {
      return u.order.type === 'gather' && u.order.targetId === meat.id;
    });
    if (!busy) {
      var worker = ctx.villagers.filter(function (u) {
        return u.order.type === 'idle' || (u.order.type === 'gather' && u.order.resource === 'food');
      })[0];
      if (worker) ctx.issue({ type: 'gather', unitIds: [worker.id], targetId: meat.id });
    }
    return true;
  }

  function develop(ctx) {
    var herd = RTS.world.list(ctx.world, function (e) { return e.kind === 'animal' && e.owner === ctx.pid; });
    bringHome(ctx, herd);
    remember(ctx);

    var hunters = ctx.villagers.filter(function (u) { return u.order.type === 'hunt'; });
    if (hunters.length) {
      if (ctx.world.time - ctx.state.huntStart > GIVE_UP) {
        hunters.forEach(function (u) { ctx.state.badPrey[u.order.targetId] = true; });
        ctx.issue({ type: 'stop', unitIds: hunters.map(function (u) { return u.id; }) });
      }
      return;
    }
    if (tendMeat(ctx)) return;
    var plan = chooseTarget(ctx);
    if (!plan) return;
    var workers = ctx.villagers.filter(function (u) {
      return u.order.type === 'idle' || (u.order.type === 'gather' && u.order.resource === 'food');
    });
    var where = plan.animal || plan.spot;
    workers.sort(function (a, b) {
      return RTS.util.dist(a.x, a.y, where.x, where.y) - RTS.util.dist(b.x, b.y, where.x, where.y);
    });
    if (workers.length < plan.party) return;
    var ids = workers.slice(0, plan.party).map(function (u) { return u.id; });
    if (plan.spot) {
      // 一次只派一批過去查看
      if (ctx.world.time - ctx.state.lookTime < 30) return;
      ctx.state.lookTime = ctx.world.time;
      ctx.issue({ type: 'move', unitIds: ids, x: where.x, y: where.y });
      return;
    }
    var sent = ctx.issue({ type: 'hunt', targetId: plan.animal.id, unitIds: ids });
    if (sent.ok) ctx.state.huntStart = ctx.world.time;
  }

  AI.hunt = { develop: develop };
})();
