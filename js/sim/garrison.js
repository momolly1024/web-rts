// 進駐避難：單位進入建築後從地圖上移除（暫存在 building.garrison），緩慢回血，可全部放出。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function capacity(b) {
    var def = b && b.kind === 'building' && RTS.data.buildings[b.type].garrison;
    return def ? def.capacity : 0;
  }

  function count(b) {
    return b.garrison ? b.garrison.length : 0;
  }

  function hasRoom(b) {
    return !!b && b.complete && count(b) < capacity(b);
  }

  function enter(world, b, u) {
    var resume = u.order.resume || null;      // 出來後回去做原本的工作
    world.entities.delete(u.id);
    RTS.orders.set(u, { type: 'idle' });
    u.saved = resume;
    (b.garrison || (b.garrison = [])).push(u);
  }

  function update(world, u, dt) {
    var o = u.order;
    var b = RTS.world.get(world, o.targetId);
    if (!b || b.owner !== u.owner || !hasRoom(b)) { RTS.orders.set(u, { type: 'idle' }); return; }
    if (u.wait > 0) { u.wait -= dt; return; }
    var status = RTS.move.approach(world, u, RTS.move.entityGoal(b, 0.75), dt);
    if (status === 'blocked') {
      o.fails = (o.fails || 0) + 1;
      u.wait = 1.0;
      if (o.fails >= 3) RTS.orders.set(u, { type: 'idle' });
    } else if (status === 'arrived') {
      enter(world, b, u);
    }
  }

  // 把單位放回以 from 為起點的相連空格；放不下的留在回傳清單
  function place(world, units, from) {
    var tiles = from ? RTS.map.spreadTiles(world.map, from.x, from.y, units.length) : [];
    tiles.forEach(function (t, i) {
      var u = units[i];
      u.x = t.x + 0.5;
      u.y = t.y + 0.5;
      var job = u.saved;
      u.saved = null;
      if (job) job.returning = u.carry.amount > 0;
      RTS.orders.set(u, job || { type: 'idle' });
      world.entities.set(u.id, u);
    });
    return units.slice(tiles.length);
  }

  // 全部放出；周圍沒有空位的單位繼續留在裡面。回傳放出人數
  function release(world, b) {
    var inside = b.garrison || [];
    if (!inside.length) return 0;
    b.garrison = place(world, inside, RTS.production.spawnTile(world, b));
    return inside.length - b.garrison.length;
  }

  // 建築被毀：占地已清空，單位原地逃出並保留目前生命
  function onDestroyed(world, b) {
    if (!count(b)) return;
    var from = { x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2) };
    b.garrison = place(world, b.garrison, from);
  }

  function heal(b, dt) {
    if (!count(b)) return;
    var rate = RTS.data.buildings[b.type].garrison.healRate;
    b.garrison.forEach(function (u) { u.hp = Math.min(u.maxHp, u.hp + rate * dt); });
  }

  RTS.garrison = {
    capacity: capacity, count: count, hasRoom: hasRoom, update: update,
    release: release, onDestroyed: onDestroyed, heal: heal
  };
})();
