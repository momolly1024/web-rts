'use strict';
const assert = require('assert');
const { RTS, arena, unit } = require('./helpers');

function setup() {
  const w = arena(30);
  RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 26, 26, true);
  const app = { world: w, human: 0, selection: [], placement: null, mode: null };
  return { w, app };
}

test('游標：選村民時依目標顯示砍樹、挖礦、採集、狩獵、施工、修理、交貨、進駐、攻擊', () => {
  const { w, app } = setup();
  const v = unit(w, 'villager', 0, 10, 10);
  app.selection = [v.id];
  const at = t => RTS.cursor.actionFor(app, t);
  assert.strictEqual(at(null), null, '空地就是移動');
  assert.strictEqual(at(RTS.world.addNode(w, 'tree', 12, 12)), 'wood');
  assert.strictEqual(at(RTS.world.addNode(w, 'gold', 13, 12)), 'mine');
  assert.strictEqual(at(RTS.world.addNode(w, 'rock', 14, 12)), 'mine');
  assert.strictEqual(at(RTS.world.addNode(w, 'berry', 15, 12)), 'food');
  assert.strictEqual(at(RTS.world.addBuilding(w, 'farm', 0, 16, 16, true)), 'food');
  assert.strictEqual(at(RTS.world.addAnimal(w, 'deer', 20.5, 5.5)), 'hunt');
  const site = RTS.world.addBuilding(w, 'house', 0, 5, 20, false);
  assert.strictEqual(at(site), 'build');
  const house = RTS.world.addBuilding(w, 'house', 0, 8, 20, true);
  assert.strictEqual(at(house), null, '完好的房屋沒有動作');
  house.hp = 10;
  assert.strictEqual(at(house), 'repair');
  const camp = RTS.world.addBuilding(w, 'lumberCamp', 0, 11, 20, true);
  v.carry = { resource: 'wood', amount: 5 };
  assert.strictEqual(at(camp), 'deposit');
  v.carry = { resource: 'gold', amount: 5 };
  assert.strictEqual(at(camp), null, '伐木場不收黃金');
  const tc = RTS.world.buildingsOf(w, 0, 'townCenter')[0];
  assert.strictEqual(at(tc), 'deposit');
  v.carry = { resource: null, amount: 0 };
  assert.strictEqual(at(tc), 'garrison');
  assert.strictEqual(at(RTS.world.buildingsOf(w, 1, 'townCenter')[0]), 'attack');
});

test('游標：士兵、小羊、牲畜圈、攻擊移動與放置模式', () => {
  const { w, app } = setup();
  const s = unit(w, 'swordsman', 0, 10, 10);
  app.selection = [s.id];
  const at = t => RTS.cursor.actionFor(app, t);
  assert.strictEqual(at(RTS.world.addNode(w, 'tree', 12, 12)), null, '士兵不採集');
  const sheep = RTS.world.addAnimal(w, 'sheep', 15.5, 15.5);
  assert.strictEqual(at(sheep), null, '士兵不殺中立的羊');
  sheep.owner = 1;
  assert.strictEqual(at(sheep), 'attack');
  const lamb = RTS.world.addAnimal(w, 'lamb', 16.5, 15.5);
  lamb.owner = 0;
  const v = unit(w, 'villager', 0, 11, 11);
  app.selection = [v.id];
  assert.strictEqual(at(lamb), null, '自己的小羊不能宰');
  const pen = RTS.world.addBuilding(w, 'pen', 0, 20, 10, true);
  const mine = RTS.world.addAnimal(w, 'sheep', 5.5, 15.5);
  mine.owner = 0;
  app.selection = [mine.id];
  assert.strictEqual(at(pen), 'pen');
  app.selection = [s.id];
  app.mode = 'attackMove';
  assert.strictEqual(at(null), 'attack');
  app.mode = null;
  app.placement = 'house';
  assert.strictEqual(at(RTS.world.buildingsOf(w, 1, 'townCenter')[0]), null);
});

test('游標：每個圖示都產生合法的 CSS 游標值', () => {
  Object.keys(RTS.cursor.ICONS).forEach(name => {
    const value = RTS.cursor.css(name);
    assert.ok(/^url\("data:image\/svg\+xml,[^"]+"\) \d+ \d+, pointer$/.test(value), name);
    assert.ok(decodeURIComponent(value).includes('<svg'), name);
  });
});

test('游標：治療者指向受傷的自己人是治療；攻城槌只對建築顯示攻擊', () => {
  const { w, app } = setup();
  const healer = unit(w, 'healer', 0, 10, 10);
  const hurt = unit(w, 'swordsman', 0, 12, 10);
  app.selection = [healer.id];
  assert.strictEqual(RTS.cursor.actionFor(app, hurt), null, '沒受傷不用治療');
  hurt.hp = 5;
  assert.strictEqual(RTS.cursor.actionFor(app, hurt), 'heal');
  assert.strictEqual(RTS.cursor.actionFor(app, unit(w, 'swordsman', 1, 14, 10)), null, '治療者不能攻擊');
  const ram = unit(w, 'ram', 0, 10, 12);
  app.selection = [ram.id];
  assert.strictEqual(RTS.cursor.actionFor(app, unit(w, 'archer', 1, 15, 10)), null);
  assert.strictEqual(RTS.cursor.actionFor(app, RTS.world.buildingsOf(w, 1, 'townCenter')[0]), 'attack');
});
