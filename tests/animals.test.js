'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function base() {
  const w = arena(40);
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 2, 2, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 34, 34, true);
  const animal = (type, x, y) => RTS.world.addAnimal(w, type, x + 0.5, y + 0.5);
  const issue = c => RTS.commands.issue(w, 0, c);
  const hunt = (units, a) => issue({ type: 'hunt', unitIds: units.map(u => u.id), targetId: a.id });
  const carcass = () => RTS.world.list(w, e => e.type === 'carcass')[0];
  return { w, tc, animal, issue, hunt, carcass };
}

test('地圖上三種動物雙方數量與位置點對稱', () => {
  for (const seed of [1, 2, 7, 42, 999]) {
    const w = RTS.game.create(seed);
    const all = RTS.world.list(w, e => e.kind === 'animal');
    const key = (t, x, y) => `${t}@${x.toFixed(1)},${y.toFixed(1)}`;
    const set = new Set(all.map(a => key(a.type, a.x, a.y)));
    all.forEach(a => assert.ok(set.has(key(a.type, w.map.width - a.x, w.map.height - a.y))));
    for (const type of Object.keys(RTS.data.animals)) {
      const n = all.filter(a => a.type === type).length;
      assert.ok(n >= 2 && n % 2 === 0, type + ' ' + n);
    }
    assert.ok(all.every(a => a.owner === null));
  }
});

test('牲畜被靠近者認領，可帶回家；主人在旁邊時搶不走', () => {
  const { w, animal, issue } = base();
  const sheep = animal('sheep', 20, 20);
  const mine = unit(w, 'villager', 0, 18, 20);
  runUntil(w, () => sheep.owner === 0, 100);
  assert.strictEqual(sheep.owner, 0);
  const foe = unit(w, 'villager', 1, 22, 20);
  runUntil(w, () => false, 40);
  assert.strictEqual(sheep.owner, 0);
  RTS.world.remove(w, foe);
  assert.ok(issue({ type: 'move', unitIds: [sheep.id], x: 7, y: 7 }).ok);
  assert.ok(runUntil(w, () => Math.floor(sheep.x) === 7 && Math.floor(sheep.y) === 7, 800));
  assert.strictEqual(RTS.world.population(w, 0).used, 1, '牲畜不佔人口');
  RTS.world.remove(w, mine);
  unit(w, 'villager', 1, 8, 7);
  assert.ok(runUntil(w, () => sheep.owner === 1, 100));
  assert.strictEqual(issue({ type: 'move', unitIds: [sheep.id], x: 1, y: 8 }).ok, false);
});

test('打倒後成為獸肉，村民自動採肉送回主堡', () => {
  const { w, animal, hunt, carcass } = base();
  const sheep = animal('sheep', 8, 4);
  const v = unit(w, 'villager', 0, 6, 8);
  const food = w.players[0].res.food;
  assert.ok(hunt([v], sheep).ok);
  assert.ok(runUntil(w, () => !!carcass(), 600));
  assert.strictEqual(carcass().amount <= RTS.data.animals.sheep.food, true);
  assert.strictEqual(v.order.type, 'gather');
  assert.ok(runUntil(w, () => w.players[0].res.food >= food + 20, 1500));
});

test('獵物會逃跑，但喘息時追得上', () => {
  const { w, animal, hunt, carcass } = base();
  const deer = animal('deer', 15, 15);
  const v = unit(w, 'villager', 0, 10, 15);
  hunt([v], deer);
  let farthest = 0;
  assert.ok(runUntil(w, () => !!carcass(), 2000, () => {
    farthest = Math.max(farthest, RTS.util.dist(deer.x, deer.y, 15.5, 15.5));
  }));
  assert.ok(farthest > 3, '鹿應該逃跑過 ' + farthest);
});

test('猛獸反擊：單人會戰死，多人可獵得', () => {
  const solo = base();
  const boar = solo.animal('boar', 15, 15);
  const v = unit(solo.w, 'villager', 0, 11, 15);
  solo.hunt([v], boar);
  assert.ok(runUntil(solo.w, () => !solo.w.entities.has(v.id), 1500), '單一村民應不敵');
  assert.ok(solo.w.entities.has(boar.id));

  const team = base();
  const second = team.animal('boar', 15, 15);
  const party = [0, 1, 2, 3].map(i => unit(team.w, 'villager', 0, 11, 13 + i));
  team.hunt(party, second);
  assert.ok(runUntil(team.w, () => !!team.carcass(), 1500));
  assert.ok(party.filter(u => team.w.entities.has(u.id)).length >= 3);
});

test('猛獸不主動攻擊；士兵不會自動打動物', () => {
  const { w, animal } = base();
  const boar = animal('boar', 15, 15);
  const sheep = animal('sheep', 17, 15);
  const v = unit(w, 'villager', 0, 14, 15);
  const s = unit(w, 'swordsman', 1, 16, 17);
  RTS.world.remove(w, v);
  runUntil(w, () => false, 200);
  assert.strictEqual(boar.hp, boar.maxHp);
  assert.strictEqual(s.hp, s.maxHp);
  assert.strictEqual(sheep.hp, sheep.maxHp);
});

test('右鍵：村民狩獵、士兵移向中立牲畜；非村民不能下狩獵指令', () => {
  const { w, animal, issue } = base();
  const sheep = animal('sheep', 15, 15);
  const v = unit(w, 'villager', 0, 8, 8), s = unit(w, 'swordsman', 0, 9, 8);
  issue({ type: 'smart', unitIds: [v.id, s.id], targetId: sheep.id, x: 15, y: 15 });
  assert.deepStrictEqual([v.order.type, s.order.type], ['hunt', 'move']);
  assert.strictEqual(issue({ type: 'hunt', unitIds: [s.id], targetId: sheep.id }).reason, 'villagersOnlyHunt');
  assert.strictEqual(issue({ type: 'hunt', unitIds: [v.id], targetId: v.id }).reason, 'noHuntTarget');
});

test('可在動物身上放建築，動物會被移開', () => {
  const { w, animal, issue } = base();
  const sheep = animal('sheep', 15, 15);
  const v = unit(w, 'villager', 0, 12, 12);
  assert.ok(issue({ type: 'build', unitIds: [v.id], building: 'house', tx: 15, ty: 15 }).ok);
  assert.ok(RTS.map.isWalkable(w.map, Math.floor(sheep.x), Math.floor(sheep.y)));
});

test('AI 依難度狩獵並取得食物', () => {
  const result = {};
  for (const key of RTS.data.difficultyOrder) {
    const hunted = { sheep: 0, deer: 0, boar: 0 };
    for (const seed of [7, 2024, 5]) {
      const w = RTS.game.create(seed);
      const ai = RTS.ai.create(1, key);
      // 動物只會因為被打倒而消失
      const start = RTS.world.list(w, e => e.kind === 'animal');
      for (let i = 0; i < 6000; i++) { ai.update(w, RTS.data.TICK); RTS.game.step(w); }
      start.filter(x => !w.entities.has(x.id)).forEach(x => hunted[x.type]++);
    }
    result[key] = hunted;
  }
  console.log('      狩獵數 ' + JSON.stringify(result));
  assert.ok(result.normal.sheep + result.normal.deer > 0, JSON.stringify(result));
  assert.strictEqual(result.easy.deer + result.easy.boar, 0);
  assert.strictEqual(result.normal.boar, 0);
  assert.ok(result.hard.sheep + result.hard.deer + result.hard.boar > 0);
});

test('AI 對 AI（各難度組合）能分出勝負且無例外', () => {
  for (const [a, b, seed] of [['normal', 'normal', 7], ['normal', 'normal', 101], ['normal', 'normal', 303],
    ['easy', 'hard', 202], ['hard', 'easy', 5], ['hard', 'hard', 88]]) {
    const w = RTS.game.create(seed);
    const ais = [RTS.ai.create(0, a), RTS.ai.create(1, b)];
    for (let i = 0; i < 60000 && !w.over; i++) { ais.forEach(x => x.update(w, RTS.data.TICK)); RTS.game.step(w); }
    assert.ok(w.over, `${a} vs ${b} seed ${seed} 未分出勝負`);
    console.log(`      ${a} vs ${b} seed ${seed}: 勝方 ${w.winner}，${Math.round(w.time)} 秒`);
  }
});

test('只有困難 AI 會組隊圍獵野豬', () => {
  for (const key of RTS.data.difficultyOrder) {
    const w = RTS.game.create(7);
    RTS.world.list(w, e => e.kind === 'animal' && e.type !== 'boar').forEach(a => RTS.world.remove(w, a));
    const ai = RTS.ai.create(1, key);
    const boars = RTS.world.list(w, e => e.kind === 'animal').length;
    let party = 0;
    for (let i = 0; i < 8000; i++) {
      ai.update(w, RTS.data.TICK);
      RTS.game.step(w);
      party = Math.max(party, RTS.world.unitsOf(w, 1).filter(u => u.order.type === 'hunt').length);
    }
    const killed = boars - RTS.world.list(w, e => e.kind === 'animal').length;
    if (key === 'hard') assert.ok(party >= 3 && killed >= 1, `困難應獵得野豬 party=${party} killed=${killed}`);
    else assert.strictEqual(party + killed, 0, key);
  }
});
