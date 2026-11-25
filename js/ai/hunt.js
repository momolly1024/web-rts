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
      return e.kind === 'animal' && !ctx.state.badPrey[e.id] && filter(e);
    }, range);
  }

  // 依序考慮：家門口的牲畜、附近獵物、猛獸（需多人）
  function chooseTarget(ctx) {
    var cfg = ctx.cfg.hunt, pid = ctx.pid;
    function kind(a) { return RTS.data.animals[a.type].behavior; }
    var sheep = nearestAnimal(ctx, function (a) { return kind(a) === 'herd' && a.owner === pid; }, HOME + 1);
    if (sheep) return { animal: sheep, party: 1 };
    // 獵物與猛獸取離主堡較近者
    var wild = nearestAnimal(ctx, function (a) {
      if (kind(a) === 'flee') return cfg.prey;
      return kind(a) === 'fight' && cfg.boarParty > 0 && ctx.villagers.length >= 10;
    }, cfg.range);
    if (!wild) return null;
    return { animal: wild, party: kind(wild) === 'fight' ? cfg.boarParty : 2 };
  }

  // 有獸肉沒人採時派一位採食物的村民過去，避免打到的肉擺著不吃
  function tendMeat(ctx) {
    var c = RTS.world.center(ctx.tc);
    var meat = RTS.world.nearest(ctx.world, c.x, c.y, function (e) {
      return e.kind === 'node' && e.type === 'carcass' && !ctx.state.badNodes[e.id];
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
    workers.sort(function (a, b) {
      return RTS.util.dist(a.x, a.y, plan.animal.x, plan.animal.y) -
        RTS.util.dist(b.x, b.y, plan.animal.x, plan.animal.y);
    });
    if (workers.length < plan.party) return;
    var sent = ctx.issue({
      type: 'hunt', targetId: plan.animal.id,
      unitIds: workers.slice(0, plan.party).map(function (u) { return u.id; })
    });
    if (sent.ok) ctx.state.huntStart = ctx.world.time;
  }

  AI.hunt = { develop: develop };
})();
