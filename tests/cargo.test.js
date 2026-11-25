'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function base() {
  const w = arena(32, { food: 500, wood: 500, gold: 500 });
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 3, 3, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 27, 27, true);
  const v = unit(w, 'villager', 0, 12, 5);
  v.carry = { resource: 'wood', amount: 6 };
  const issue = c => RTS.commands.issue(w, 0, Object.assign({ unitIds: [v.id] }, c));
  const delivered = () => w.players[0].res.wood >= 506;
  return { w, tc, v, issue, delivered };
}

test('改採不同資源：先交貨再自動前往新資源', () => {
  const { w, v, issue, delivered } = base();
  const berry = RTS.world.addNode(w, 'berry', 14, 10);
  issue({ type: 'gather', targetId: berry.id });
  assert.ok(runUntil(w, delivered, 1000, () => assert.strictEqual(berry.amount, 200, '交貨前不可開採')));
  assert.strictEqual(w.players[0].res.wood, 506);
  assert.ok(runUntil(w, () => v.carry.resource === 'food' && v.carry.amount > 0, 1000));
});

test('同類資源未滿不必先交，接著採', () => {
  const { w, v, issue } = base();
  const tree = RTS.world.addNode(w, 'tree', 14, 5);
  issue({ type: 'gather', targetId: tree.id });
  assert.ok(runUntil(w, () => v.carry.amount > 6, 600));
  assert.strictEqual(w.players[0].res.wood, 500);
});

test('建造、協助施工、修理、狩獵：先交貨再執行', () => {
  const jobs = {
    build: () => ({ type: 'build', building: 'house', tx: 18, ty: 12 }),
    assist: w => ({ type: 'assist', targetId: RTS.world.addBuilding(w, 'house', 0, 18, 12, false).id }),
    repair: w => {
      const h = RTS.world.addBuilding(w, 'house', 0, 18, 12, true);
      h.hp = 100;
      return { type: 'repair', targetId: h.id };
    },
    hunt: w => ({ type: 'hunt', targetId: RTS.world.addAnimal(w, 'sheep', 18.5, 12.5).id })
  };
  for (const [name, make] of Object.entries(jobs)) {
    const { w, v, issue, delivered } = base();
    const command = make(w);
    assert.ok(issue(command).ok, name);
    const wood = w.players[0].res.wood;
    assert.ok(runUntil(w, () => v.carry.amount === 0, 1000), name + ' 應先交貨');
    assert.strictEqual(w.players[0].res.wood, wood + 6, name);
    assert.ok(RTS.world.distTo(v.x, v.y, RTS.world.buildingsOf(w, 0, 'townCenter')[0]) < 1.5, name);
    const done = {
      build: () => RTS.world.buildingsOf(w, 0, 'house').every(h => h.complete),
      assist: () => RTS.world.buildingsOf(w, 0, 'house').every(h => h.complete),
      repair: () => RTS.world.buildingsOf(w, 0, 'house')[0].hp === 300,
      hunt: () => RTS.world.list(w, e => e.type === 'carcass').length > 0
    }[name];
    assert.ok(runUntil(w, done, 3000), name + ' 交貨後應自動執行');
  }
});

test('移動、攻擊、進駐立即執行且保留貨物', () => {
  const { w, tc, v, issue } = base();
  const foe = unit(w, 'villager', 1, 20, 5);
  for (const command of [{ type: 'move', x: 20, y: 20 }, { type: 'attackMove', x: 20, y: 20 },
    { type: 'attack', targetId: foe.id }]) {
    issue(command);
    RTS.game.step(w);
    assert.strictEqual(v.order.type, command.type);
    assert.ok(!v.order.deliver);
    assert.deepStrictEqual(v.carry, { resource: 'wood', amount: 6 });
  }
  issue({ type: 'garrison', targetId: tc.id });
  assert.ok(runUntil(w, () => RTS.garrison.count(tc) === 1, 600));
  assert.deepStrictEqual(v.carry, { resource: 'wood', amount: 6 });
  assert.strictEqual(w.players[0].res.wood, 500);
});

test('沒有可交貨的主堡時直接執行且保留貨物', () => {
  const setup = () => {
    const s = base();
    RTS.world.remove(s.w, s.tc);
    s.w.over = false;
    return s;
  };
  const step = (w, n) => { for (let i = 0; i < n; i++) { w.over = false; RTS.game.step(w); } };

  const a = setup();
  const berry = RTS.world.addNode(a.w, 'berry', 14, 10);
  a.issue({ type: 'gather', targetId: berry.id });
  step(a.w, 600);
  assert.ok(RTS.world.distTo(a.v.x, a.v.y, berry) < 1, '仍走到資源旁');
  assert.deepStrictEqual(a.v.carry, { resource: 'wood', amount: 6 });
  assert.strictEqual(berry.amount, 200);

  const b = setup();
  b.issue({ type: 'build', building: 'house', tx: 18, ty: 12 });
  step(b.w, 1200);
  assert.ok(RTS.world.buildingsOf(b.w, 0, 'house')[0].complete);
  assert.deepStrictEqual(b.v.carry, { resource: 'wood', amount: 6 });
});

test('交貨途中再下新指令，仍以最後一個指令為準', () => {
  const { w, v, issue } = base();
  const berry = RTS.world.addNode(w, 'berry', 14, 10), gold = RTS.world.addNode(w, 'gold', 10, 12);
  issue({ type: 'gather', targetId: berry.id });
  for (let i = 0; i < 20; i++) RTS.game.step(w);
  issue({ type: 'gather', targetId: gold.id });
  assert.ok(runUntil(w, () => v.carry.resource === 'gold' && v.carry.amount > 0, 1500));
  assert.strictEqual(w.players[0].res.wood, 506);
  assert.strictEqual(berry.amount, 200);
});
