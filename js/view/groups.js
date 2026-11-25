// 選取規則與部隊編號：框選過濾、數字鍵儲存與取回（連按兩下回傳鏡頭位置）。不碰 DOM。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var DOUBLE_TAP = 0.4;     // 秒

  function create() {
    return { slots: {}, last: null, lastTime: 0 };
  }

  function ownEntities(world, owner, ids) {
    return (ids || []).map(function (id) { return RTS.world.get(world, id); }).filter(function (e) {
      return e && e.owner === owner;
    });
  }

  // 只收己方實體；回傳編入數量。沒有可編入的就保留原編號
  function assign(groups, digit, world, owner, ids) {
    var list = ownEntities(world, owner, ids);
    if (!list.length) return 0;
    groups.slots[digit] = list.map(function (e) { return e.id; });
    return list.length;
  }

  // now 以秒為單位。回傳 null 代表該編號目前沒有可選的成員（例如全數陣亡或都在避難）
  function recall(groups, digit, world, owner, now) {
    var list = ownEntities(world, owner, groups.slots[digit]);
    if (!list.length) return null;
    var again = groups.last === digit && now - groups.lastTime <= DOUBLE_TAP;
    groups.last = digit;
    groups.lastTime = now;
    var center = null;
    if (again) {
      center = { x: 0, y: 0 };
      list.forEach(function (e) {
        var c = RTS.world.center(e);
        center.x += c.x / list.length;
        center.y += c.y / list.length;
      });
    }
    return { ids: list.map(function (e) { return e.id; }), center: center };
  }

  // 框到的己方移動物：一般全選（村民可連同牲畜一起趕）；框內有軍事單位時不帶牲畜上戰場
  function boxSelection(found) {
    var fighting = found.some(function (e) { return e.kind === 'unit' && RTS.data.units[e.type].military; });
    return fighting ? found.filter(function (e) { return e.kind === 'unit'; }) : found;
  }

  // 地圖上待命的村民（依 id 排序）；避難中的不算
  function idleVillagers(world, owner) {
    return RTS.world.unitsOf(world, owner).filter(function (u) {
      return RTS.data.units[u.type].canBuild && u.order.type === 'idle';
    }).sort(function (a, b) { return a.id - b.id; });
  }

  // 輪流挑下一位：id 比上次大的第一位，沒有就回到開頭
  function nextIdle(world, owner, lastId) {
    var list = idleVillagers(world, owner);
    return list.filter(function (u) { return u.id > (lastId || 0); })[0] || list[0] || null;
  }

  RTS.groups = { create: create, assign: assign, recall: recall, boxSelection: boxSelection,
    idleVillagers: idleVillagers, nextIdle: nextIdle };
})();
