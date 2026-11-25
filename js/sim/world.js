// 世界狀態：實體的建立/移除、玩家資源與人口、常用查詢。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function create(opts) {
    opts = opts || {};
    var data = RTS.data;
    var players = data.players.map(function (p, id) {
      var res = {};
      var start = opts.resources || data.START_RESOURCES;
      data.resources.forEach(function (r) { res[r] = start[r] || 0; });
      return { id: id, res: res, upgrades: {} };
    });
    return {
      map: RTS.map.create(opts.width || data.MAP_SIZE, opts.height || data.MAP_SIZE),
      players: players,
      entities: new Map(),
      nextId: 1,
      time: 0,
      tick: 0,
      effects: [],        // 繪圖用的短暫效果（箭矢、打擊）
      pathBudget: 0,
      over: false,
      winner: null
    };
  }

  function add(world, e) {
    e.id = world.nextId++;
    world.entities.set(e.id, e);
    return e;
  }

  function addNode(world, type, tx, ty) {
    var def = RTS.data.nodes[type];
    var e = add(world, { kind: 'node', type: type, owner: null, x: tx, y: ty, w: 1, h: 1, amount: def.amount });
    RTS.map.setOccupant(world.map, e, e.id);
    return e;
  }

  // complete=false 代表剛放下的工地
  function addBuilding(world, type, owner, tx, ty, complete) {
    var def = RTS.data.buildings[type];
    var e = add(world, {
      kind: 'building', type: type, owner: owner, x: tx, y: ty, w: def.size, h: def.size,
      maxHp: def.hp, hp: complete ? def.hp : def.hp * 0.1,
      progress: complete ? 1 : 0, complete: !!complete, queue: [], builders: 0
    });
    RTS.map.setOccupant(world.map, e, e.id);
    return e;
  }

  // x, y 為連續座標（格中心是 n + 0.5）
  function addUnit(world, type, owner, x, y) {
    var def = RTS.data.units[type];
    return add(world, {
      kind: 'unit', type: type, owner: owner, x: x, y: y, hp: def.hp, maxHp: def.hp,
      order: { type: 'idle' }, nav: null, cooldown: 0, carry: { resource: null, amount: 0 },
      scanTimer: 0, facing: 1, swing: 0
    });
  }

  function addAnimal(world, type, x, y) {
    var def = RTS.data.animals[type];
    return add(world, {
      kind: 'animal', type: type, owner: null, x: x, y: y, hp: def.hp, maxHp: def.hp,
      home: { x: x, y: y }, order: { type: 'idle' }, nav: null, targetId: 0, threat: 0,
      cooldown: 0, timer: 0, rest: 0, fleeing: false, facing: 1, swing: 0
    });
  }

  function remove(world, e) {
    if (!world.entities.has(e.id)) return;
    world.entities.delete(e.id);
    if (e.kind === 'node' || e.kind === 'building') RTS.map.setOccupant(world.map, e, 0);
    if (e.kind === 'building') RTS.garrison.onDestroyed(world, e);
  }

  function get(world, id) {
    return world.entities.get(id) || null;
  }

  function list(world, filter) {
    var out = [];
    world.entities.forEach(function (e) { if (!filter || filter(e)) out.push(e); });
    return out;
  }

  function unitsOf(world, owner) {
    return list(world, function (e) { return e.kind === 'unit' && e.owner === owner; });
  }

  function buildingsOf(world, owner, type) {
    return list(world, function (e) {
      return e.kind === 'building' && e.owner === owner && (!type || e.type === type);
    });
  }

  function defOf(e) {      // units / buildings / nodes / animals
    return RTS.data[e.kind + 's'][e.type];
  }

  // 沒有占地寬度者（單位、動物）以點座標表示
  function center(e) {
    return e.w === undefined ? { x: e.x, y: e.y } : { x: e.x + e.w / 2, y: e.y + e.h / 2 };
  }

  // 點到實體外緣的距離
  function distTo(x, y, e) {
    if (e.w === undefined) return RTS.util.dist(x, y, e.x, e.y);
    return RTS.util.distToRect(x, y, e);
  }

  function nearest(world, x, y, filter, maxDist) {
    var best = null, bestD = maxDist === undefined ? Infinity : maxDist;
    world.entities.forEach(function (e) {
      if (!filter(e)) return;
      var d = distTo(x, y, e);
      if (d <= bestD) { bestD = d; best = e; }
    });
    return best;
  }

  function canAfford(world, pid, cost) {
    var res = world.players[pid].res;
    return Object.keys(cost).every(function (k) { return res[k] >= cost[k]; });
  }

  function pay(world, pid, cost) {
    if (!canAfford(world, pid, cost)) return false;
    var res = world.players[pid].res;
    Object.keys(cost).forEach(function (k) { res[k] -= cost[k]; });
    return true;
  }

  function refund(world, pid, cost) {
    var res = world.players[pid].res;
    Object.keys(cost).forEach(function (k) { res[k] += cost[k]; });
  }

  // used：存活單位；queued：生產佇列中；cap：完工建築提供的上限
  function population(world, pid) {
    var used = 0, queued = 0, cap = 0;
    world.entities.forEach(function (e) {
      if (e.owner !== pid) return;
      if (e.kind === 'unit') used += RTS.data.units[e.type].pop;
      else if (e.kind === 'building') {
        if (e.complete) cap += RTS.data.buildings[e.type].pop;
        if (e.garrison) e.garrison.forEach(function (u) { used += RTS.data.units[u.type].pop; });
        e.queue.forEach(function (q) { if (!q.research) queued += RTS.data.units[q.type].pop; });
      }
    });
    return { used: used, queued: queued, cap: Math.min(cap, RTS.data.POP_MAX) };
  }

  RTS.world = {
    create: create, addNode: addNode, addBuilding: addBuilding, addUnit: addUnit, addAnimal: addAnimal,
    remove: remove, get: get, list: list, unitsOf: unitsOf, buildingsOf: buildingsOf,
    defOf: defOf, center: center, distTo: distTo, nearest: nearest,
    canAfford: canAfford, pay: pay, refund: refund, population: population
  };
})();
