// 部隊編號：把目前選取存到數字鍵，再按取回；連按兩下回傳鏡頭應跳往的位置。不碰 DOM。
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

  RTS.groups = { create: create, assign: assign, recall: recall };
})();
