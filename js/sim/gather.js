// 村民採集：前往資源或農田、採收、送回收取該資源的建築、資源耗盡後找附近同類。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var SEARCH_RADIUS = 14;
  var RETRY_WAIT = 1.0;

  // 可採集目標（天然資源或農田）產出的資源，不可採集則為 null
  function resourceOf(e) {
    if (!e) return null;
    if (e.kind === 'node') return RTS.data.nodes[e.type].resource || null;
    return RTS.farm.isFarm(e) ? 'food' : null;
  }

  // u 能不能採這塊己方農田：完工、還有食物、沒有別人在種
  function farmOpen(world, farm, owner, u) {
    return farm.owner === owner && farm.complete && farm.amount > 0 && RTS.farm.freeFor(world, farm, u);
  }

  // 找離 from 最近、且旁邊有空位的同類資源（食物也包含空著的己方農田）
  // owner 只會找到自己看過的資源
  function findResource(world, owner, from, resource, skip, u) {
    return RTS.world.nearest(world, from.x, from.y, function (e) {
      if (skip && skip[e.id]) return false;
      if (RTS.farm.isFarm(e)) return resource === 'food' && farmOpen(world, e, owner, u);
      return e.kind === 'node' && RTS.data.nodes[e.type].resource === resource &&
        RTS.fog.knows(world, owner, e) && RTS.map.hasFreeNeighbor(world.map, e);
    }, SEARCH_RADIUS);
  }

  function makeOrder(target) {
    var c = RTS.world.center(target);
    return {
      type: 'gather', targetId: target.id, resource: resourceOf(target),
      last: { x: c.x, y: c.y }, returning: false, progress: 0, skip: {},
      livestock: target.type === 'carcass' && !!target.animal &&
        RTS.data.animals[target.animal] && RTS.data.animals[target.animal].behavior === 'herd'
    };
  }

  var HERD_RADIUS = 10;

  // 宰完的牲畜吃完後，接著宰附近下一隻自己的成年牲畜（小羊不宰）
  function nextLivestock(world, u, from) {
    return RTS.world.nearest(world, from.x, from.y, function (e) {
      return e.kind === 'animal' && e.owner === u.owner && RTS.data.animals[e.type].behavior === 'herd' &&
        !RTS.data.animals[e.type].young;
    }, HERD_RADIUS);
  }

  function accepts(b, resource) {
    var drop = RTS.data.buildings[b.type].dropoff;
    return !!drop && (!resource || drop.indexOf(resource) >= 0);
  }

  function capacity(world, u) {
    return RTS.data.units[u.type].carry + RTS.research.economy(world, u.owner, 'carry');
  }

  function rate(world, u, resource) {
    return RTS.data.units[u.type].gatherRate[resource] * (1 + RTS.research.economy(world, u.owner, 'gather.' + resource));
  }

  // 農田站到中央格耕作，其他資源站在旁邊
  function goalFor(target) {
    if (RTS.farm.isFarm(target)) {
      return RTS.move.pointGoal(target.x + Math.floor(target.w / 2), target.y + Math.floor(target.h / 2));
    }
    return RTS.move.entityGoal(target, 0.75);
  }

  // 回傳 'done'（已入庫或沒東西要交）、'going'、'none'（沒有可交付的主堡）
  function returnCargo(world, u, dt) {
    if (u.carry.amount <= 0) return 'done';
    if (u.wait > 0) { u.wait -= dt; return 'going'; }
    var skip = u.order.dropSkip || (u.order.dropSkip = {});
    function isDrop(e) {
      return e.kind === 'building' && e.owner === u.owner && e.complete && accepts(e, u.carry.resource);
    }
    var drop = RTS.world.nearest(world, u.x, u.y, function (e) { return isDrop(e) && !skip[e.id]; });
    if (!drop) {
      if (!RTS.world.nearest(world, u.x, u.y, isDrop)) return 'none';
      u.order.dropSkip = {};       // 全部暫時到不了：稍後再試
      u.wait = RETRY_WAIT;
      return 'going';
    }
    var status = RTS.move.approach(world, u, RTS.move.entityGoal(drop, 0.75), dt, { spread: true });
    if (status === 'arrived') {
      world.players[u.owner].res[u.carry.resource] += u.carry.amount;
      u.carry.amount = 0;
      u.order.dropSkip = {};
      return 'done';
    }
    if (status === 'blocked') skip[drop.id] = true;
    return 'going';
  }

  function updateGather(world, u, dt) {
    var o = u.order;
    var other = u.carry.amount > 0 && u.carry.resource !== o.resource;
    var full = !other && u.carry.amount >= capacity(world, u);
    // 滿載或手上是別種資源：先交貨
    if (o.returning || full || other) {
      o.returning = true;
      var r = returnCargo(world, u, dt);
      if (r === 'done') o.returning = false;
      if (r !== 'none') return;
      if (!other) { RTS.orders.set(u, { type: 'idle' }); return; }
      o.returning = false;      // 沒有主堡可交：照樣前往新資源，貨物留著
    }

    var node = RTS.world.get(world, o.targetId);
    if (node && RTS.farm.isFarm(node) && !farmOpen(world, node, u.owner, u)) {
      o.skip[node.id] = true;       // 已有人在種或被拆了：改找別塊
      node = null;
    }
    if (!node && o.livestock) {
      var animal = nextLivestock(world, u, o.last);
      if (animal) {
        RTS.orders.set(u, { type: 'hunt', targetId: animal.id, fails: 0, deliver: u.carry.amount > 0 });
        return;
      }
    }
    if (!node) {
      var next = findResource(world, u.owner, o.last, o.resource, o.skip, u);
      if (!next) {
        if (u.carry.amount > 0) o.returning = true;
        else RTS.orders.set(u, { type: 'idle' });
        return;
      }
      o.targetId = next.id;
      o.last = RTS.world.center(next);
      u.nav = null;
      node = next;
    }

    if (RTS.farm.isFarm(node)) node.farmer = u.id;      // 走過去的路上就先佔住
    var status = RTS.move.approach(world, u, goalFor(node), dt, { spread: true });
    if (status === 'blocked') {
      if (node.farmer === u.id) node.farmer = 0;
      o.skip[node.id] = true;
      o.targetId = 0;
    } else if (status === 'arrived') {
      harvest(world, u, node, dt);
    }
  }

  function harvest(world, u, node, dt) {
    var o = u.order, cap = capacity(world, u);
    // 手上還有別種資源（沒地方交）時不開採，避免貨物被蓋掉
    if (u.carry.resource !== o.resource) {
      if (u.carry.amount > 0) return;
      u.carry.resource = o.resource;
    }
    var c = RTS.world.center(node);
    if (!RTS.farm.isFarm(node)) RTS.move.lean(u, node, dt);     // 農田站在田中央，不必靠
    if (Math.abs(c.x - u.x) > 0.05) u.facing = c.x > u.x ? 1 : -1;
    u.swing = (u.swing + dt) % 0.6;
    o.progress += rate(world, u, o.resource) * dt;
    while (o.progress >= 1 && node.amount > 0 && u.carry.amount < cap) {
      o.progress -= 1;
      node.amount -= 1;
      u.carry.amount += 1;
    }
    if (node.amount > 0) return;
    if (RTS.farm.isFarm(node)) RTS.farm.deplete(world, node);
    else RTS.world.remove(world, node);
  }

  function updateDeposit(world, u, dt) {
    if (returnCargo(world, u, dt) !== 'going') RTS.orders.set(u, { type: 'idle' });
  }

  RTS.gather = {
    resourceOf: resourceOf, findResource: findResource, makeOrder: makeOrder, accepts: accepts,
    capacity: capacity, rate: rate, returnCargo: returnCargo,
    update: updateGather, updateDeposit: updateDeposit
  };
})();
