'use strict';
const assert = require('assert');
const { RTS, arena } = require('./helpers');

function field() {
  const w = arena(30, { food: 500, wood: 500, gold: 1000, stone: 500 });
  RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 26, 26, true);
  return { w, market: RTS.world.addBuilding(w, 'market', 0, 12, 12, true) };
}

const trade = (w, b, resource, side, pid = 0) =>
  RTS.commands.issue(w, pid, { type: 'trade', buildingId: b.id, resource, side });

test('市場：買價高於賣價，買進付黃金得資源', () => {
  const { w, market } = field();
  const buy = RTS.market.quote(w, 0, 'wood', 'buy'), sell = RTS.market.quote(w, 0, 'wood', 'sell');
  assert.ok(buy > sell);
  const res = w.players[0].res, gold = res.gold, wood = res.wood;
  assert.ok(trade(w, market, 'wood', 'buy').ok);
  assert.strictEqual(res.gold, gold - buy);
  assert.strictEqual(res.wood, wood + RTS.data.market.lot);
});

test('市場：買會漲、賣會跌，有上下限，各資源獨立', () => {
  const { w, market } = field();
  const before = RTS.market.quote(w, 0, 'food', 'buy');
  trade(w, market, 'food', 'buy');
  assert.ok(RTS.market.quote(w, 0, 'food', 'buy') > before);
  assert.strictEqual(RTS.market.prices(w, 0).wood, RTS.data.market.base, '木材不受影響');
  for (let i = 0; i < 40; i++) trade(w, market, 'stone', 'sell');
  w.players[0].res.stone = 10000;
  for (let i = 0; i < 40; i++) trade(w, market, 'stone', 'sell');
  assert.strictEqual(RTS.market.prices(w, 0).stone, RTS.data.market.min);
});

test('市場：價格隨時間回到基準價', () => {
  const { w, market } = field();
  for (let i = 0; i < 5; i++) trade(w, market, 'wood', 'buy');
  assert.ok(RTS.market.prices(w, 0).wood > RTS.data.market.base);
  const seconds = (RTS.market.prices(w, 0).wood - RTS.data.market.base) / RTS.data.market.recover;
  for (let t = 0; t <= seconds + 1; t += RTS.data.TICK) RTS.market.step(w, RTS.data.TICK);
  assert.strictEqual(RTS.market.prices(w, 0).wood, RTS.data.market.base);
});

test('市場：雙方價格各自獨立', () => {
  const { w, market } = field();
  trade(w, market, 'food', 'buy');
  assert.strictEqual(RTS.market.quote(w, 1, 'food', 'buy'), Math.ceil(RTS.data.market.base * (1 + RTS.data.market.fee)));
});

test('市場：錢或貨不夠、未完工、交易黃金或別人的市場都會被拒絕', () => {
  const { w, market } = field();
  w.players[0].res.gold = 10;
  assert.strictEqual(trade(w, market, 'food', 'buy').reason, 'notEnoughResources');
  w.players[0].res.food = 99;
  assert.strictEqual(trade(w, market, 'food', 'sell').reason, 'notEnoughResources');
  assert.strictEqual(trade(w, market, 'gold', 'sell').reason, 'cannotTrade');
  assert.strictEqual(trade(w, market, 'wood', 'steal').reason, 'cannotTrade');
  assert.strictEqual(trade(w, market, 'wood', 'sell', 1).reason, 'buildingNotFound');
  const site = RTS.world.addBuilding(w, 'market', 0, 18, 12, false);
  assert.strictEqual(trade(w, site, 'wood', 'sell').reason, 'notComplete');
  const house = RTS.world.addBuilding(w, 'house', 0, 18, 18, true);
  assert.strictEqual(trade(w, house, 'wood', 'sell').reason, 'cannotTrade');
});
