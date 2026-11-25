// 戰爭迷霧：每位玩家各自的探索／視野格，以及離開視野後仍記得的建築與資源。
// world.fog 為 null 時（空白測試場地）一律視為看得見。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var UNEXPLORED = 0, EXPLORED = 1, VISIBLE = 2;
  var PERIOD = 4;       // 每隔幾個時間步更新一次視野（雙方錯開）

  function enable(world) {
    var n = world.map.width * world.map.height;
    world.fog = world.players.map(function () {
      return { state: new Uint8Array(n), memory: new Map() };
    });
    world.players.forEach(function (p) { update(world, p.id); });
  }

  function reveal(state, map, rect, radius) {
    var reach = radius + 0.5;
    var x0 = Math.max(0, Math.floor(rect.x - reach)), x1 = Math.min(map.width - 1, Math.floor(rect.x + rect.w + reach));
    var y0 = Math.max(0, Math.floor(rect.y - reach)), y1 = Math.min(map.height - 1, Math.floor(rect.y + rect.h + reach));
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var dx = Math.max(rect.x - x - 0.5, 0, x + 0.5 - rect.x - rect.w);
        var dy = Math.max(rect.y - y - 0.5, 0, y + 0.5 - rect.y - rect.h);
        if (dx * dx + dy * dy <= reach * reach) state[y * map.width + x] = VISIBLE;
      }
    }
  }

  function anyVisible(state, width, e) {
    for (var y = e.y; y < e.y + e.h; y++) {
      for (var x = e.x; x < e.x + e.w; x++) if (state[y * width + x] === VISIBLE) return true;
    }
    return false;
  }

  function snapshot(e) {
    var s = { id: e.id, kind: e.kind, type: e.type, owner: e.owner, x: e.x, y: e.y, w: e.w, h: e.h, ghost: true };
    if (e.kind === 'node') s.amount = e.amount;
    else {
      s.complete = e.complete;
      s.progress = e.progress;
      s.hp = e.hp;
      s.maxHp = e.maxHp;
    }
    return s;
  }

  function update(world, pid) {
    var fog = world.fog[pid], state = fog.state, map = world.map;
    for (var i = 0; i < state.length; i++) if (state[i] === VISIBLE) state[i] = EXPLORED;
    var fixed = [];
    world.entities.forEach(function (e) {
      if (e.w !== undefined) fixed.push(e);
      if (e.owner !== pid) return;
      var rect = e.w !== undefined ? e : { x: e.x, y: e.y, w: 0, h: 0 };
      reveal(state, map, rect, RTS.world.defOf(e).vision);
    });
    // 看得到的就更新記憶；看得到原位置卻已經沒東西的就忘掉
    fog.memory.forEach(function (m, id) {
      if (!world.entities.has(id) && anyVisible(state, map.width, m)) fog.memory.delete(id);
    });
    fixed.forEach(function (e) {
      if (e.owner !== pid && anyVisible(state, map.width, e)) fog.memory.set(e.id, snapshot(e));
    });
  }

  function step(world) {
    if (!world.fog) return;
    world.players.forEach(function (p) {
      if (world.tick % PERIOD === p.id * 2) update(world, p.id);
    });
  }

  function tile(world, pid, x, y) {
    if (!world.fog) return VISIBLE;
    if (!RTS.map.inBounds(world.map, x, y)) return UNEXPLORED;
    return world.fog[pid].state[y * world.map.width + x];
  }

  // 目前看得見（自己的東西永遠看得見）
  function sees(world, pid, e) {
    if (!world.fog || e.owner === pid) return true;
    if (e.w === undefined) return tile(world, pid, Math.floor(e.x), Math.floor(e.y)) === VISIBLE;
    return anyVisible(world.fog[pid].state, world.map.width, e);
  }

  // 看得見，或記得它在那裡
  function knows(world, pid, e) {
    return sees(world, pid, e) || world.fog[pid].memory.has(e.id);
  }

  // 能否當作指令或點選目標：天然資源記得就行，其餘必須看得見
  function targetable(world, pid, e) {
    return e.kind === 'node' ? knows(world, pid, e) : sees(world, pid, e);
  }

  // 玩家眼中的世界：看得見的實體，加上記憶中的舊樣貌（ghost）
  function perceived(world, pid) {
    var out = [];
    world.entities.forEach(function (e) { if (sees(world, pid, e)) out.push(e); });
    if (!world.fog) return out;
    world.fog[pid].memory.forEach(function (m, id) {
      var real = world.entities.get(id);
      if (!real || !sees(world, pid, real)) out.push(m);
    });
    return out;
  }

  RTS.fog = {
    UNEXPLORED: UNEXPLORED, EXPLORED: EXPLORED, VISIBLE: VISIBLE,
    enable: enable, update: update, step: step, tile: tile, sees: sees, knows: knows,
    targetable: targetable, perceived: perceived
  };
})();
