'use strict';
const assert = require('assert');
const path = require('path');
const { RTS, arena, unit, runUntil, root } = require('./helpers');
require(path.join(root, 'js/view/actions.js'));

function bases() {
  const w = arena(30, { food: 5000, wood: 5000, gold: 5000, stone: 5000 });
  RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 26, 26, true);
  return w;
}

test('警告：被敵人打到才記錄；同一場交戰只提示一次，換地點或隔久了再提示', () => {
  const w = bases(), alerts = RTS.alert.create();
  assert.ok(!alerts.update(w, 0) && !alerts.active());
  const mine = unit(w, 'villager', 0, 10, 10), foe = unit(w, 'swordsman', 1, 11, 10);
  assert.ok(runUntil(w, () => w.players[0].attacked, 200));
  assert.ok(!w.players[1].attacked || w.players[1].attacked.time >= 0);
  assert.ok(alerts.update(w, 0));
  assert.ok(Math.hypot(alerts.active().x - mine.x, alerts.active().y - mine.y) < 3);
  const hit = (x, y, time) => { w.time = time; w.players[0].attacked = { x, y, time }; return alerts.update(w, 0); };
  const t = w.time;
  assert.ok(!hit(10, 10, t + 2), '同一處連續受擊不重複提示');
  assert.ok(hit(28, 5, t + 8), '另一處要提示');
  assert.ok(hit(28, 5, t + 30), '隔很久再提示');
  w.time = t + 60;
  assert.strictEqual(alerts.active(), null);
  assert.ok(foe);
});

test('警告：打自己人或中立目標不記錄', () => {
  const w = bases();
  const a = unit(w, 'swordsman', 0, 10, 10), b = unit(w, 'villager', 0, 11, 10);
  RTS.alerts.record(w, a, b);
  RTS.alerts.record(w, a, { kind: 'animal', owner: null, x: 1, y: 1 });
  assert.ok(!w.players[0].attacked);
});

test('隊形：混合兵種移動時近戰在前、遠程在後，各自有不同目的格', () => {
  const w = bases();
  const group = ['archer', 'swordsman', 'archer', 'swordsman', 'healer', 'swordsman', 'archer']
    .map((type, i) => unit(w, type, 0, 5 + i % 3, 5 + Math.floor(i / 3)));
  const r = RTS.commands.issue(w, 0, { type: 'move', unitIds: group.map(u => u.id), x: 20, y: 6 });
  assert.ok(r.ok);
  const along = u => (u.order.x - 6) + (u.order.y - 6) * 0.05;
  const of = type => group.filter(u => u.type === type).map(along);
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(avg(of('swordsman')) > avg(of('archer')), '劍士在弓箭手前方');
  assert.ok(avg(of('archer')) >= avg(of('healer')), '治療者殿後');
  assert.strictEqual(new Set(group.map(u => u.order.x + ',' + u.order.y)).size, group.length);
});

test('隊形：單一兵種維持原本分配，攻擊移動同樣排位', () => {
  const w = bases();
  const same = [0, 1, 2].map(i => unit(w, 'swordsman', 0, 5 + i, 5));
  assert.ok(!RTS.formation.mixed(same));
  const archer = unit(w, 'archer', 0, 12, 10), sword = unit(w, 'swordsman', 0, 5, 10);
  RTS.commands.issue(w, 0, { type: 'attackMove', unitIds: [archer.id, sword.id], x: 20, y: 10 });
  assert.ok(sword.order.x > archer.order.x);
});

test('箭塔分支：單座改建、兩種擇一，不影響其他箭塔，取消退款', () => {
  const w = bases();
  w.players[0].upgrades.age = 1;
  const a = RTS.world.addBuilding(w, 'tower', 0, 8, 8, true), b = RTS.world.addBuilding(w, 'tower', 0, 12, 8, true);
  const issue = c => RTS.commands.issue(w, 0, Object.assign({ buildingId: a.id }, c));
  const stone = w.players[0].res.stone;
  assert.ok(issue({ type: 'branch', branch: 'range' }).ok);
  assert.strictEqual(issue({ type: 'branch', branch: 'damage' }).reason, 'alreadyResearching');
  assert.strictEqual(RTS.world.population(w, 0).queued, 0, '改建中不佔人口');
  assert.ok(issue({ type: 'cancelTrain', index: 0 }).ok);
  assert.strictEqual(w.players[0].res.stone, stone);
  issue({ type: 'branch', branch: 'range' });
  assert.ok(runUntil(w, () => a.branch === 'range', 800));
  assert.strictEqual(RTS.towers.rangeOf(w, a), 9);
  assert.strictEqual(RTS.towers.rangeOf(w, b), 7);
  assert.strictEqual(issue({ type: 'branch', branch: 'damage' }).reason, 'alreadyBranched');
  w.players[0].upgrades.towerUpgrade = 1;
  assert.strictEqual(RTS.towers.rangeOf(w, a), 10);
  assert.strictEqual(RTS.towers.damageBonus(w, a), 3);
});

test('箭塔分支：重弩塔實際打得更痛，按鈕有說明、改建後消失', () => {
  const w = bases();
  w.players[0].upgrades.age = 1;
  const tower = RTS.world.addBuilding(w, 'tower', 0, 8, 8, true);
  const app = { world: w, human: 0, selection: [tower.id], placement: null, mode: null, notify() {} };
  const before = RTS.actions.list(app).find(x => x.id === 'branch:damage');
  assert.ok(before.enabled && before.detail().join(' ').includes('5 → 9'));
  tower.branch = 'damage';
  assert.ok(!RTS.actions.list(app).some(x => x.id.startsWith('branch:')));
  const foe = unit(w, 'swordsman', 1, 11, 8), hp = foe.hp;
  RTS.towers.update(w, tower, RTS.data.TICK);
  assert.strictEqual(hp - foe.hp, RTS.combat.hitDamage(RTS.data.buildings.tower.attack,
    RTS.data.units.swordsman, 4, 0));
});
