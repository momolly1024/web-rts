// 村民採集：前往資源、採收、送回主堡、資源耗盡後找附近同類。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var SEARCH_RADIUS = 14;
  var RETRY_WAIT = 1.0;

  // 找離 from 最近、且旁邊有空位的同類資源
  function findResource(world, from, resource, skip) {
    return RTS.world.nearest(world, from.x, from.y, function (e) {
      return e.kind === 'node' && RTS.data.nodes[e.type].resource === resource &&
        !(skip && skip[e.id]) && RTS.map.hasFreeNeighbor(world.map, e);
    }, SEARCH_RADIUS);
  }

  function makeOrder(node) {
    return {
      type: 'gather', targetId: node.id, resource: RTS.data.nodes[node.type].resource,
      last: { x: node.x + 0.5, y: node.y + 0.5 }, returning: false, progress: 0, skip: {}
    };
  }

  // 回傳 'done'（已入庫或沒東西要交）、'going'、'none'（沒有可交付的主堡）
  function returnCargo(world, u, dt) {
    if (u.carry.amount <= 0) return 'done';
    if (u.wait > 0) { u.wait -= dt; return 'going'; }
    var skip = u.order.dropSkip || (u.order.dropSkip = {});
    function isDrop(e) {
      return e.kind === 'building' && e.owner === u.owner && e.complete && RTS.data.buildings[e.type].dropoff;
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
    var o = u.order, def = RTS.data.units[u.type];
    var full = u.carry.resource === o.resource && u.carry.amount >= def.carry;
    if (o.returning || full) {
      o.returning = true;
      var r = returnCargo(world, u, dt);
      if (r === 'done') o.returning = false;
      else if (r === 'none') RTS.orders.set(u, { type: 'idle' });
      return;
    }

    var node = RTS.world.get(world, o.targetId);
    if (!node) {
      var next = findResource(world, o.last, o.resource, o.skip);
      if (!next) {
        if (u.carry.amount > 0) o.returning = true;
        else RTS.orders.set(u, { type: 'idle' });
        return;
      }
      o.targetId = next.id;
      o.last = { x: next.x + 0.5, y: next.y + 0.5 };
      u.nav = null;
      node = next;
    }

    var status = RTS.move.approach(world, u, RTS.move.entityGoal(node, 0.75), dt, { spread: true });
    if (status === 'blocked') {
      o.skip[node.id] = true;
      o.targetId = 0;
    } else if (status === 'arrived') {
      harvest(world, u, node, dt);
    }
  }

  function harvest(world, u, node, dt) {
    var o = u.order, def = RTS.data.units[u.type];
    if (u.carry.resource !== o.resource) {    // 改採別種資源時丟棄原本手上的
      u.carry.resource = o.resource;
      u.carry.amount = 0;
    }
    u.facing = node.x + 0.5 > u.x ? 1 : -1;
    u.swing = (u.swing + dt) % 0.6;
    o.progress += def.gatherRate[o.resource] * dt;
    while (o.progress >= 1 && node.amount > 0 && u.carry.amount < def.carry) {
      o.progress -= 1;
      node.amount -= 1;
      u.carry.amount += 1;
    }
    if (node.amount <= 0) RTS.world.remove(world, node);
  }

  function updateDeposit(world, u, dt) {
    if (returnCargo(world, u, dt) !== 'going') RTS.orders.set(u, { type: 'idle' });
  }

  RTS.gather = {
    findResource: findResource, makeOrder: makeOrder,
    update: updateGather, updateDeposit: updateDeposit
  };
})();
