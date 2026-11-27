// 主堡隨時代換樣式：三種圖形、四向與三文明都畫得出來、迷霧記住看到時的樣子、血條高度
'use strict';
const assert = require('assert');
const path = require('path');
const { RTS, arena, unit, root, scripts } = require('./helpers');

scripts.filter(s => /view\/sprites[\w-]*\.js$/.test(s)).forEach(s => require(path.join(root, s)));

// 只記錄畫了什麼的假畫布
function record(age, civ, dir) {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, key) => key in t ? t[key] : (...args) => { calls.push(key + ' ' + args.join(',')); },
    set: (t, key, value) => { calls.push(key + '=' + value); t[key] = value; return true; }
  });
  RTS.sprites.building(ctx, 'townCenter', 3, RTS.data.players[0], null, civ, 'x', dir, age);
  return calls.join('\n');
}

test('主堡樣式：三個時代的圖形都不同（各文明、各朝向）', () => {
  assert.strictEqual(RTS.data.ages.length, 3);
  for (const civ of [null, 'greenwood', 'ironrock', 'goldplain']) {
    for (let dir = 0; dir < 4; dir++) {
      const drawn = [0, 1, 2].map(age => record(age, civ, dir));
      assert.strictEqual(new Set(drawn).size, 3, civ + ' dir ' + dir);
      drawn.forEach(d => assert.ok(!/NaN|undefined/.test(d), civ + ' dir ' + dir));
    }
  }
});

test('主堡樣式：沒給時代畫黑暗時代，超過上限畫城堡時代', () => {
  assert.strictEqual(record(undefined, null, 0), record(0, null, 0));
  assert.strictEqual(record(9, null, 0), record(2, null, 0));
});

test('主堡樣式：迷霧記憶保留最後看到時的時代', () => {
  const w = arena(40);
  const scout = unit(w, 'villager', 0, 12, 12);
  const b = RTS.world.addBuilding(w, 'townCenter', 1, 13, 12, true);
  w.players[1].upgrades.age = 1;
  RTS.fog.enable(w);
  scout.x = scout.y = 35.5;
  RTS.fog.update(w, 0);
  w.players[1].upgrades.age = 2;
  RTS.fog.update(w, 0);
  assert.strictEqual(w.fog[0].memory.get(b.id).age, 1);
});

test('主堡樣式：時代越高血條位置越高，工地不受影響', () => {
  const b = { type: 'townCenter', complete: true, h: 3 };
  const tops = [0, 1, 2].map(age => RTS.depth.topOf(b, age));
  assert.ok(tops[0] < tops[1] && tops[1] < tops[2], tops.join());
  const site = { type: 'townCenter', complete: false, h: 3 };
  assert.strictEqual(RTS.depth.topOf(site, 2), RTS.depth.topOf(site, 0));
});
