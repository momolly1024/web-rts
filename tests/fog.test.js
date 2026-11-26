'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

const F = RTS.fog;

function base() {
  const w = arena(40);
  const mine = RTS.world.addBuilding(w, 'townCenter', 0, 2, 2, true);
  const theirs = RTS.world.addBuilding(w, 'townCenter', 1, 33, 33, true);
  F.enable(w);
  const step = (n = 8) => { for (let i = 0; i < n; i++) RTS.game.step(w); };
  const issue = c => RTS.commands.issue(w, 0, c);
  return { w, mine, theirs, step, issue };
}

test('未探索、視野內、離開後已探索三種狀態，視野依資料表', () => {
  const { w, step } = base();
  assert.strictEqual(F.tile(w, 0, 20, 20), F.UNEXPLORED);
  const u = unit(w, 'villager', 0, 20, 20);
  step();
  const r = RTS.data.units.villager.vision;
  assert.strictEqual(F.tile(w, 0, 20 + r, 20), F.VISIBLE);
  assert.strictEqual(F.tile(w, 0, 20 + r + 2, 20), F.UNEXPLORED);
  assert.strictEqual(F.tile(w, 1, 20, 20), F.UNEXPLORED, '雙方視野分開');
  RTS.world.remove(w, u);
  step();
  assert.strictEqual(F.tile(w, 0, 20, 20), F.EXPLORED);
});

test('敵方單位只在視野內看得見；建築與資源離開後保留最後看到的樣子', () => {
  const { w, theirs, step } = base();
  const foe = unit(w, 'villager', 1, 30, 30);
  const tree = RTS.world.addNode(w, 'tree', 27, 28);
  step();
  assert.ok(!F.sees(w, 0, foe) && !F.knows(w, 0, theirs) && !F.knows(w, 0, tree));
  const scout = unit(w, 'villager', 0, 30, 30);
  step();
  assert.ok(F.sees(w, 0, foe) && F.sees(w, 0, theirs) && F.sees(w, 0, tree));
  RTS.world.remove(w, scout);
  step();
  theirs.hp = 10;
  step();
  assert.ok(!F.sees(w, 0, foe) && !F.sees(w, 0, theirs));
  const seen = F.perceived(w, 0);
  assert.ok(!seen.some(e => e.id === foe.id), '不顯示看不到的敵方單位');
  const ghost = seen.find(e => e.id === theirs.id);
  assert.ok(ghost.ghost && ghost.hp === theirs.maxHp, '記得的是舊樣貌');
  // 離開視野期間被摧毀：記憶保留到再次看見原位置為止
  RTS.world.remove(w, tree);
  step();
  assert.ok(F.perceived(w, 0).some(e => e.id === tree.id));
  unit(w, 'villager', 0, 28, 29);
  step();
  assert.ok(!F.perceived(w, 0).some(e => e.id === tree.id));
});

test('指令不能鎖定看不見的目標', () => {
  const { w, theirs, step, issue } = base();
  const s = unit(w, 'swordsman', 0, 6, 6), v = unit(w, 'villager', 0, 7, 6);
  const foe = unit(w, 'villager', 1, 30, 30);
  const sheep = RTS.world.addAnimal(w, 'sheep', 25.5, 25.5);
  const gold = RTS.world.addNode(w, 'gold', 24, 30);
  step();
  assert.strictEqual(issue({ type: 'attack', unitIds: [s.id], targetId: foe.id }).reason, 'cannotAttack');
  assert.strictEqual(issue({ type: 'attack', unitIds: [s.id], targetId: theirs.id }).ok, false);
  assert.strictEqual(issue({ type: 'hunt', unitIds: [v.id], targetId: sheep.id }).ok, false);
  assert.strictEqual(issue({ type: 'gather', unitIds: [v.id], targetId: gold.id }).ok, false);
  assert.ok(issue({ type: 'smart', unitIds: [s.id, v.id], targetId: foe.id, x: 30, y: 30 }).ok);
  assert.deepStrictEqual([s.order.type, v.order.type], ['move', 'move']);
  assert.strictEqual(issue({ type: 'build', unitIds: [v.id], building: 'house', tx: 20, ty: 20 }).reason, 'unexplored');
});

test('記得的資源可以下令採集；追擊目標離開視野會停在最後看到處', () => {
  const { w, step, issue } = base();
  const tree = RTS.world.addNode(w, 'tree', 20, 6);
  const eye = unit(w, 'villager', 0, 18, 6);
  step();
  RTS.world.remove(w, eye);
  step();
  const v = unit(w, 'villager', 0, 7, 6);
  assert.ok(issue({ type: 'gather', unitIds: [v.id], targetId: tree.id }).ok);

  const hunter = unit(w, 'swordsman', 0, 10, 12);
  const prey = unit(w, 'villager', 1, 13, 12);
  step();
  assert.ok(issue({ type: 'attack', unitIds: [hunter.id], targetId: prey.id }).ok);
  step(2);
  prey.x = 38.5;
  prey.y = 5.5;
  assert.ok(runUntil(w, () => hunter.order.type !== 'attack', 100));
  assert.ok(runUntil(w, () => hunter.order.type === 'idle', 600));
  assert.ok(RTS.util.dist(hunter.x, hunter.y, 13.5, 12.5) < 3);
});

test('正式對局啟用迷霧，開局看不到敵方', () => {
  const w = RTS.game.create(7);
  assert.ok(w.fog);
  assert.ok(RTS.world.list(w, e => e.owner === 1).every(e => !F.sees(w, 0, e)));
  assert.ok(RTS.world.list(w, e => e.owner === 0).every(e => F.sees(w, 0, e)));
  assert.strictEqual(RTS.game.create(7, { fog: false }).fog, null);
});

slowTest('AI 不看全圖：開局不知道敵堡，偵查後才知道，且不在發現前進攻', () => {
  for (const key of RTS.data.difficultyOrder) {
    for (const seed of [7, 2024, 31337]) {
      const w = RTS.game.create(seed), ai = RTS.ai.create(1, key);
      const tc = RTS.world.buildingsOf(w, 0, 'townCenter')[0];
      tc.hp = tc.maxHp = 1e9;
      assert.ok(!F.knows(w, 1, tc));
      const issue = RTS.commands.issue;
      const cheats = [];
      RTS.commands.issue = (world, pid, c) => {
        const t = c.targetId && world.entities.get(c.targetId);
        if (pid === 1 && t && !F.targetable(world, 1, t)) cheats.push(c.type);
        return issue(world, pid, c);
      };
      let found = null;
      try {
        for (let i = 0; i < 12000; i++) {
          ai.update(w, RTS.data.TICK);
          RTS.game.step(w);
          if (found === null && F.knows(w, 1, tc)) found = w.time;
          if (ai.state.waves) assert.ok(found !== null, '進攻前必須先發現');
        }
      } finally { RTS.commands.issue = issue; }
      assert.ok(found !== null && found < RTS.ai.config(key).graceTime, `${key} ${seed} 發現於 ${found}`);
      assert.deepStrictEqual(cheats, [], 'AI 指到看不見的目標');
    }
  }
});

test('迷霧更新的效能在可接受範圍', () => {
  const w = RTS.game.create(5);
  for (let i = 0; i < 60; i++) RTS.world.addUnit(w, 'swordsman', i % 2, 20.5 + i % 10, 20.5 + Math.floor(i / 10));
  const t = process.hrtime.bigint();
  for (let i = 0; i < 400; i++) F.update(w, i % 2);
  const ms = Number(process.hrtime.bigint() - t) / 1e6 / 400;
  console.log('      單次單方視野更新 ' + ms.toFixed(3) + ' ms（約 68 個單位）');
  assert.ok(ms < 8, ms);
});
