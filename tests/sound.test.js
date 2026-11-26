'use strict';
const assert = require('assert');
const { RTS, arena, unit, runUntil } = require('./helpers');

function scene() {
  const w = arena(30);
  RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 26, 26, true);
  const cam = RTS.camera.create(30, 30);
  RTS.camera.resize(cam, 1200, 800);
  RTS.camera.centerOn(cam, 10, 10);
  return { world: w, human: 0, cam };
}

// 推進模擬並收集聽到的聲音
function listen(app, events, steps) {
  const heard = new Set();
  for (let i = 0; i < steps; i++) {
    RTS.game.step(app.world);
    events.collect(app).forEach(name => heard.add(name));
  }
  return heard;
}

test('音效：採集依資源出聲，建造出敲打聲', () => {
  const app = scene(), w = app.world, events = RTS.soundEvents.create();
  const tree = RTS.world.addNode(w, 'tree', 10, 10), rock = RTS.world.addNode(w, 'rock', 13, 10);
  const a = unit(w, 'villager', 0, 9, 10), b = unit(w, 'villager', 0, 12, 10);
  const site = RTS.world.addBuilding(w, 'house', 0, 8, 13, false);
  const c = unit(w, 'villager', 0, 7, 13);
  RTS.commands.issue(w, 0, { type: 'gather', unitIds: [a.id], targetId: tree.id });
  RTS.commands.issue(w, 0, { type: 'gather', unitIds: [b.id], targetId: rock.id });
  RTS.commands.issue(w, 0, { type: 'assist', unitIds: [c.id], targetId: site.id });
  const heard = listen(app, events, 120);
  ['chop', 'mine', 'hammer'].forEach(name => assert.ok(heard.has(name), name));
});

test('音效：戰鬥出聲且同一個效果只報一次；畫面外不出聲', () => {
  const app = scene(), w = app.world, events = RTS.soundEvents.create();
  unit(w, 'swordsman', 0, 10, 10);
  unit(w, 'villager', 1, 11, 10);
  assert.ok(runUntil(w, () => w.effects.some(fx => fx.type === 'hit'), 100));
  assert.ok(events.collect(app).includes('melee'));
  assert.deepStrictEqual(events.collect(app), []);
  assert.ok(listen(app, events, 200).has('fall'));

  const far = scene(), farEvents = RTS.soundEvents.create();
  far.cam.x += 1000;
  unit(far.world, 'archer', 0, 10, 10);
  unit(far.world, 'villager', 1, 13, 10);
  assert.strictEqual(listen(far, farEvents, 100).size, 0);
});

test('音效開關：記住設定；沒有音訊功能時不出錯', () => {
  const store = {};
  const env = { storage: () => ({ getItem: k => store[k], setItem: (k, v) => { store[k] = v; } }) };
  const sound = RTS.sound.create(env);
  assert.ok(sound.enabled());
  assert.strictEqual(sound.toggle(), false);
  assert.strictEqual(RTS.sound.create(env).enabled(), false);
  sound.toggle();
  sound.unlock();
  assert.strictEqual(sound.play('alert'), false);
  assert.ok(RTS.sound.create({ storage: () => { throw new Error('blocked'); } }).enabled());
});

test('音效播放：同一種聲音有最短間隔，關閉後不播', () => {
  let started = 0;
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, start() { started++; }, stop() {}, gain: param(), frequency: param() });
  function Fake() {
    return Object.assign(this, {
      state: 'running', currentTime: 0, sampleRate: 100, destination: {},
      createBuffer: () => ({ getChannelData: () => new Float32Array(10) }),
      createGain: node, createBufferSource: node, createBiquadFilter: node, createOscillator: node
    });
  }
  let ctx;
  const sound = RTS.sound.create({ storage: () => null, AudioContext: function () { ctx = this; Fake.call(this); } });
  sound.unlock();
  assert.ok(sound.play('chop'));
  assert.ok(!sound.play('chop'));
  ctx.currentTime = 1;
  assert.ok(sound.play('chop'));
  assert.strictEqual(started, 2 * RTS.sound.SOUNDS.chop.parts.length);
  sound.toggle();
  ctx.currentTime = 2;
  assert.ok(!sound.play('chop'));
});
