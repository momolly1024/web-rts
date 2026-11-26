// 戰況提示的時機：遭攻擊警告（連續受擊合併成一場交戰）與敵方主堡被毀。不碰 DOM。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var QUIET = 8;      // 秒：超過這麼久沒被打，視為交戰結束
  var AREA = 14;      // 格：離目前交戰超過這個距離算另一處
  var GAP = 4;        // 秒：兩次提示至少間隔

  function create() {
    var world = null, episode = null, warned = -Infinity;

    // 每個畫面呼叫一次；需要跳出新提示時回傳 true
    function update(current, pid) {
      if (current !== world) { world = current; episode = null; warned = -Infinity; }
      var hit = world.players[pid].attacked;
      if (!hit || (episode && hit.time <= episode.time)) return false;
      var fresh = !episode || hit.time - episode.time > QUIET ||
        Math.hypot(hit.x - episode.x, hit.y - episode.y) > AREA;
      episode = { x: hit.x, y: hit.y, time: hit.time };
      if (!fresh || hit.time - warned < GAP) return false;
      warned = hit.time;
      return true;
    }

    // 進行中的交戰位置，沒有就回傳 null
    function active() {
      return episode && world.time - episode.time < QUIET ? episode : null;
    }

    return { update: update, active: active };
  }

  // 盯著敵方完工主堡：有一座消失且還有剩時回傳剩下幾座，否則回傳 0（全毀由勝利畫面接手）
  function watchTowns() {
    var world = null, known = [];
    return function (current, pid) {
      var now = current.players.filter(function (p) { return p.id !== pid; }).reduce(function (ids, p) {
        return ids.concat(RTS.world.buildingsOf(current, p.id, 'townCenter')
          .filter(function (b) { return b.complete; }).map(function (b) { return b.id; }));
      }, []);
      var lost = current === world && known.some(function (id) { return now.indexOf(id) < 0; });
      world = current;
      known = now;
      return lost ? now.length : 0;
    };
  }

  RTS.alert = { create: create, watchTowns: watchTowns };
})();
