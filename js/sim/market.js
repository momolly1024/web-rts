// 市場：用黃金買賣其他資源。每位玩家有自己的價格，買會漲、賣會跌，之後慢慢回穩。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function cfg() { return RTS.data.market; }

  function prices(world, pid) {
    var p = world.players[pid];
    if (!p.prices) {
      p.prices = {};
      cfg().goods.forEach(function (r) { p.prices[r] = cfg().base; });
    }
    return p.prices;
  }

  // side 為 'buy'（付黃金得資源）或 'sell'（付資源得黃金）；回傳一次交易的黃金數
  function quote(world, pid, resource, side) {
    var base = prices(world, pid)[resource];
    return side === 'buy' ? Math.ceil(base * (1 + cfg().fee)) : Math.floor(base * (1 - cfg().fee));
  }

  function check(world, b, resource, side) {
    if (!b || !RTS.data.buildings[b.type].market) return { ok: false, reason: 'cannotTrade' };
    if (cfg().goods.indexOf(resource) < 0 || (side !== 'buy' && side !== 'sell')) {
      return { ok: false, reason: 'cannotTrade' };
    }
    if (!b.complete) return { ok: false, reason: 'notComplete' };
    var res = world.players[b.owner].res;
    var enough = side === 'buy' ? res.gold >= quote(world, b.owner, resource, 'buy') : res[resource] >= cfg().lot;
    return enough ? { ok: true } : { ok: false, reason: 'notEnoughResources' };
  }

  function trade(world, b, resource, side) {
    var r = check(world, b, resource, side);
    if (!r.ok) return r;
    var pid = b.owner, res = world.players[pid].res, gold = quote(world, pid, resource, side);
    var p = prices(world, pid), c = cfg();
    if (side === 'buy') {
      res.gold -= gold;
      res[resource] += c.lot;
      p[resource] = Math.min(c.max, p[resource] + c.step);
    } else {
      res[resource] -= c.lot;
      res.gold += gold;
      p[resource] = Math.max(c.min, p[resource] - c.step);
    }
    return { ok: true, gold: gold };
  }

  // 價格每秒往基準價靠近
  function step(world, dt) {
    var c = cfg(), move = c.recover * dt;
    world.players.forEach(function (player) {
      if (!player.prices) return;
      c.goods.forEach(function (r) {
        var d = c.base - player.prices[r];
        player.prices[r] += Math.abs(d) <= move ? d : move * Math.sign(d);
      });
    });
  }

  RTS.market = { prices: prices, quote: quote, check: check, trade: trade, step: step };
})();
