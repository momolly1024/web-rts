'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

const CAP = RTS.data.buildings.townCenter.garrison.capacity;

function base() {
  const w = arena(32);
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 10, 10, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 27, 27, true);
  const issue = c => RTS.commands.issue(w, 0, c);
  const enter = units => issue({ type: 'garrison', unitIds: units.map(u => u.id), targetId: tc.id });
  return { w, tc, issue, enter };
}

test('進駐後離開地圖、仍佔人口、緩慢回血，可全部放出', () => {
  const { w, tc, issue, enter } = base();
  const v = unit(w, 'villager', 0, 7, 11);
  const s = unit(w, 'swordsman', 0, 7, 12);
  s.hp = 30;
  assert.ok(enter([v, s]).ok);
  assert.ok(runUntil(w, () => RTS.garrison.count(tc) === 2, 1000));
  assert.strictEqual(RTS.world.get(w, v.id), null);
  assert.strictEqual(RTS.world.population(w, 0).used, 2);
  for (let i = 0; i < 200; i++) RTS.game.step(w);
  assert.ok(s.hp > 40 && s.hp < s.maxHp, '10 秒回血 ' + s.hp);
  assert.ok(issue({ type: 'ungarrison', buildingId: tc.id }).ok);
  assert.strictEqual(RTS.garrison.count(tc), 0);
  const tiles = [v, s].map(u => {
    assert.strictEqual(RTS.world.get(w, u.id), u);
    assert.ok(RTS.map.isWalkable(w.map, Math.floor(u.x), Math.floor(u.y)));
    return Math.floor(u.x) + ',' + Math.floor(u.y);
  });
  assert.strictEqual(new Set(tiles).size, 2);
  assert.strictEqual(issue({ type: 'ungarrison', buildingId: tc.id }).reason, 'nothingGarrisoned');
});

test('容量上限：超出的單位留在外面且不卡住', () => {
  const { w, tc, enter } = base();
  const units = [];
  for (let i = 0; i < CAP + 3; i++) units.push(unit(w, 'villager', 0, 3 + i % 7, 3 + Math.floor(i / 7)));
  assert.ok(enter(units).ok);
  assert.ok(runUntil(w, () => units.every(u => !w.entities.has(u.id) || u.order.type === 'idle'), 2000));
  assert.strictEqual(RTS.garrison.count(tc), CAP);
  assert.strictEqual(RTS.world.unitsOf(w, 0).length, 3);
  assert.strictEqual(enter([RTS.world.unitsOf(w, 0)[0]]).reason, 'garrisonFull');
});

test('出來後村民回去採集', () => {
  const { w, tc, issue, enter } = base();
  const tree = RTS.world.addNode(w, 'tree', 6, 6);
  const v = unit(w, 'villager', 0, 8, 8);
  issue({ type: 'gather', unitIds: [v.id], targetId: tree.id });
  enter([v]);
  assert.ok(runUntil(w, () => RTS.garrison.count(tc) === 1, 1000));
  issue({ type: 'ungarrison', buildingId: tc.id });
  assert.strictEqual(v.order.type, 'gather');
});

test('四周被堵死時留在裡面，不會憑空消失', () => {
  const { w, tc, issue, enter } = base();
  const v = unit(w, 'villager', 0, 8, 11);
  enter([v]);
  assert.ok(runUntil(w, () => RTS.garrison.count(tc) === 1, 1000));
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) if (RTS.map.isWalkable(w.map, x, y)) RTS.world.addNode(w, 'rock', x, y);
  }
  assert.strictEqual(issue({ type: 'ungarrison', buildingId: tc.id }).reason, 'noDestination');
  assert.strictEqual(RTS.garrison.count(tc), 1);
});

test('主堡被毀時單位全部逃到原占地附近', () => {
  const { w, tc, enter } = base();
  RTS.world.addBuilding(w, 'townCenter', 0, 2, 20, true);
  const units = [0, 1, 2, 3].map(i => unit(w, 'villager', 0, 7, 9 + i));
  enter(units);
  assert.ok(runUntil(w, () => RTS.garrison.count(tc) === 4, 1000));
  tc.hp = 3;
  const foe = unit(w, 'swordsman', 1, 14, 11);
  RTS.commands.issue(w, 1, { type: 'attack', unitIds: [foe.id], targetId: tc.id });
  assert.ok(runUntil(w, () => !w.entities.has(tc.id), 500));
  units.forEach(u => {
    assert.ok(w.entities.has(u.id), '單位應回到地圖');
    assert.ok(RTS.util.dist(u.x, u.y, 11.5, 11.5) < 4);
    assert.ok(u.hp > 0);
  });
});

test('右鍵己方主堡即進駐（村民先交貨、受損時村民改為修理）', () => {
  const { w, tc, issue } = base();
  const v = unit(w, 'villager', 0, 7, 11);
  const s = unit(w, 'swordsman', 0, 7, 12);
  const smart = () => issue({ type: 'smart', unitIds: [v.id, s.id], targetId: tc.id, x: 11, y: 11 });
  smart();
  assert.deepStrictEqual([v.order.type, s.order.type], ['garrison', 'garrison']);
  tc.hp -= 100;
  smart();
  assert.deepStrictEqual([v.order.type, s.order.type], ['repair', 'garrison']);
  v.carry = { resource: 'food', amount: 3 };
  smart();
  assert.deepStrictEqual([v.order.type, s.order.type], ['deposit', 'garrison']);
});

test('AI 遇襲時讓村民避難，威脅解除後放出', () => {
  for (const key of RTS.data.difficultyOrder) {
    const w = RTS.game.create(7);
    const ai = RTS.ai.create(1, key);
    const tc = RTS.world.buildingsOf(w, 1, 'townCenter')[0];
    const step = n => { for (let i = 0; i < n; i++) { ai.update(w, RTS.data.TICK); RTS.game.step(w); } };
    step(200);
    const raiders = RTS.map.spreadTiles(w.map, tc.x - 3, tc.y - 1, 4)
      .map(t => RTS.world.addUnit(w, 'swordsman', 0, t.x + 0.5, t.y + 0.5));
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      raiders.forEach(r => { r.hp = r.maxHp; r.order = { type: 'idle' }; r.scanTimer = 99; });
      step(5);
      peak = Math.max(peak, RTS.garrison.count(tc));
    }
    assert.ok(peak >= 2, key + ' 應有村民進駐 ' + peak);
    raiders.forEach(r => RTS.world.remove(w, r));
    step(200);
    assert.strictEqual(RTS.garrison.count(tc), 0, key + ' 威脅解除後應放出');
  }
});
