// 對局迴圈：固定時間步長推進模擬並判定勝負。不依賴 DOM。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function create(seed, opts) {
    return RTS.mapgen.generate(seed, opts);
  }

  // 失去所有完工主堡者落敗
  function checkVictory(world) {
    var alive = world.players.map(function () { return false; });
    world.entities.forEach(function (e) {
      if (e.kind === 'building' && e.type === 'townCenter' && e.complete) alive[e.owner] = true;
    });
    var losers = alive.filter(function (a) { return !a; }).length;
    if (!losers) return;
    world.over = true;
    var winner = alive.indexOf(true);
    world.winner = winner < 0 ? null : winner;
  }

  function step(world) {
    if (world.over) return;
    var dt = RTS.data.TICK;
    world.tick++;
    world.time = world.tick * dt;
    RTS.move.beginTick(world);
    RTS.construction.beginTick(world);

    var all = RTS.world.list(world);
    // 每步輪替起始位置，尋路額度不會永遠被同一批單位用完
    var offset = all.length ? world.tick % all.length : 0;
    for (var i = 0; i < all.length; i++) {
      var e = all[(i + offset) % all.length];
      if (!world.entities.has(e.id)) continue;      // 本步稍早已被摧毀
      if (e.kind === 'unit') RTS.orders.update(world, e, dt);
      else if (e.kind === 'animal') RTS.animals.update(world, e, dt);
      else if (e.kind === 'building') {
        RTS.production.update(world, e, dt);
        RTS.pen.update(world, e, dt);
        RTS.towers.update(world, e, dt);
        RTS.garrison.heal(e, dt);
      }
    }
    RTS.market.step(world, dt);
    RTS.move.separate(world, dt);
    RTS.fog.step(world);

    world.effects = world.effects.filter(function (fx) {
      fx.age += dt;
      return fx.age < fx.life;
    });
    checkVictory(world);
  }

  RTS.game = { create: create, step: step, checkVictory: checkVictory };
})();
