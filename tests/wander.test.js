'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

const TICK = RTS.data.TICK;
const dist = (a, b) => RTS.util.dist(a.x, a.y, b.x, b.y);
const animals = w => RTS.world.list(w, e => e.kind === 'animal');
const standable = (w, e) => RTS.map.isWalkable(w.map, Math.floor(e.x), Math.floor(e.y));

function base() {
  const w = arena(40);
  RTS.world.addBuilding(w, 'townCenter', 0, 2, 2, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 34, 34, true);
  const animal = (type, x, y) => RTS.world.addAnimal(w, type, x + 0.5, y + 0.5);
  const steps = (n, each) => { for (let i = 0; i < n; i++) { RTS.game.step(w); if (each) each(); } };
  return { w, animal, steps };
}

slowTest('閒置的野生動物會走走停停，速度遠低於逃跑且不超出出生點半徑', () => {
  for (const seed of [1, 7, 42, 999]) {
    const w = RTS.game.create(seed);
    RTS.world.unitsOf(w, 0).concat(RTS.world.unitsOf(w, 1)).forEach(u => RTS.world.remove(w, u));
    const track = animals(w).map(a => ({ a, spawn: { x: a.x, y: a.y }, last: { x: a.x, y: a.y }, walked: 0, still: 0 }));
    for (let i = 0; i < 4800; i++) {
      RTS.game.step(w);
      for (const t of track) {
        const cfg = RTS.data.animals[t.a.type];
        const moved = dist(t.a, t.last);
        assert.ok(moved <= cfg.wander.speed * TICK + 1e-9, t.a.type + ' 太快 ' + moved);
        assert.ok(dist(t.a, t.spawn) <= cfg.wander.radius + 1e-6, t.a.type + ' 走太遠');
        assert.ok(standable(w, t.a), '踩進不可通行格');
        t.walked += moved;
        if (moved === 0) t.still++;
        t.last = { x: t.a.x, y: t.a.y };
      }
    }
    // 少數可能被地形完全包住，大多數都應走動過，也都有停下的時間
    assert.ok(track.filter(t => t.walked > 2).length >= track.length * 0.9, 'seed ' + seed);
    assert.ok(track.every(t => t.still > 1000));
    for (const cfg of Object.values(RTS.data.animals)) assert.ok(cfg.wander.speed <= cfg.speed * 0.5);
  }
});

test('同一種子重跑得到完全相同的走法', () => {
  const run = () => {
    const w = RTS.game.create(31);
    for (let i = 0; i < 1500; i++) RTS.game.step(w);
    return JSON.stringify(animals(w).map(a => [a.x, a.y]));
  };
  assert.strictEqual(run(), run());
});

test('不穿過障礙：被牆圍住的動物留在牆內', () => {
  const { w, animal, steps } = base();
  for (let i = 18; i <= 22; i++) {
    for (const [x, y] of [[i, 18], [i, 22], [18, i], [22, i]]) {
      if (RTS.map.isWalkable(w.map, x, y)) RTS.world.addNode(w, 'rock', x, y);
    }
  }
  const deer = animal('deer', 20, 20);
  steps(6000, () => {
    assert.ok(standable(w, deer));
    assert.ok(deer.x > 19 && deer.x < 22 && deer.y > 19 && deer.y < 22);
  });
});

test('玩家指令優先；到達後只在指定處附近活動，不會越走越遠', () => {
  const { w, animal, steps } = base();
  const sheep = animal('sheep', 20, 20);
  const owner = unit(w, 'villager', 0, 18, 20);
  assert.ok(runUntil(w, () => sheep.owner === 0, 100));
  RTS.world.remove(w, owner);
  assert.ok(runUntil(w, () => !!sheep.stroll, 400), '先讓牠開始閒逛');
  const from = { x: sheep.x, y: sheep.y };
  assert.ok(RTS.commands.issue(w, 0, { type: 'move', unitIds: [sheep.id], x: 30, y: 12 }).ok);
  steps(20);
  assert.ok(dist(sheep, from) > RTS.data.animals.sheep.speed * 0.8, '應以正常速度前往');
  assert.ok(runUntil(w, () => sheep.order.type === 'idle', 800));
  const placed = { x: 30.5, y: 12.5 };
  assert.ok(dist(sheep, placed) < 0.1);
  let walked = 0, last = { x: sheep.x, y: sheep.y };
  steps(20000, () => {
    assert.ok(dist(sheep, placed) <= RTS.data.animals.sheep.wander.ownedRadius + 0.1);
    walked += dist(sheep, last);
    last = { x: sheep.x, y: sheep.y };
  });
  assert.ok(walked > 2, '閒置時仍會小範圍走動');
});

test('停止指令後以停下處為定點', () => {
  const { w, animal, steps } = base();
  const sheep = animal('sheep', 20, 20);
  const owner = unit(w, 'villager', 0, 18, 20);
  runUntil(w, () => sheep.owner === 0, 100);
  RTS.world.remove(w, owner);
  RTS.commands.issue(w, 0, { type: 'move', unitIds: [sheep.id], x: 35, y: 10 });
  steps(60);
  RTS.commands.issue(w, 0, { type: 'stop', unitIds: [sheep.id] });
  const at = { x: sheep.x, y: sheep.y };
  steps(4000, () => assert.ok(dist(sheep, at) <= RTS.data.animals.sheep.wander.ownedRadius + 1e-6));
});

test('逃遠的獵物會慢慢走回出生點附近', () => {
  const { w, animal } = base();
  const deer = animal('deer', 12, 20);
  deer.x = 26.5;
  assert.ok(runUntil(w, () => RTS.util.dist(deer.x, deer.y, 12.5, 20.5) <= RTS.data.animals.deer.wander.radius, 4000));
});

test('野生牲畜繞路走回時不改變定點', () => {
  const { w, animal, steps } = base();
  for (let y = 15; y <= 25; y++) RTS.world.addNode(w, 'rock', 20, y);
  const sheep = animal('sheep', 12, 20);
  sheep.x = 26.5;
  assert.ok(runUntil(w, () => sheep.order.type === 'move', 6000), '繞路走回');
  assert.ok(runUntil(w, () => sheep.order.type === 'idle', 6000));
  steps(200);
  assert.deepStrictEqual(sheep.home, { x: 12.5, y: 20.5 });
});

test('走回途中受驚仍會逃跑', () => {
  const { w, animal } = base();
  for (let y = 15; y <= 25; y++) RTS.world.addNode(w, 'rock', 20, y);
  const deer = animal('deer', 12, 20);
  deer.x = 26.5;
  assert.ok(runUntil(w, () => deer.order.type === 'move', 6000), '繞路走回');
  unit(w, 'villager', 0, Math.floor(deer.x) + 1, Math.floor(deer.y));
  assert.ok(runUntil(w, () => deer.fleeing, 100));
});

test('村民能獵殺閒逛中的動物', () => {
  for (const type of ['sheep', 'deer', 'boar']) {
    const { w, animal, steps } = base();
    const prey = animal(type, 20, 20);
    steps(600);
    const hunters = [0, 1, 2, 3].map(i => unit(w, 'villager', 0, 10, 18 + i));
    RTS.commands.issue(w, 0, { type: 'hunt', unitIds: hunters.map(u => u.id), targetId: prey.id });
    assert.ok(runUntil(w, () => !w.entities.has(prey.id), 2000), type);
    assert.ok(RTS.world.list(w, e => e.type === 'carcass').length === 1);
  }
});
