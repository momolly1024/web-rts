// 放置預覽：用自己民族的建築樣式
'use strict';
const assert = require('assert');
const path = require('path');
const { RTS, arena, root, scripts } = require('./helpers');

scripts.filter(s => /view\/(sprites[\w-]*|render)\.js$/.test(s)).forEach(s => require(path.join(root, s)));

test('放置預覽：建築套用自己的民族樣式', () => {
  const world = arena(40);
  world.players[0].civ = 'ironrock';
  world.players[1].civ = 'greenwood';
  const cam = RTS.camera.create(40, 40);
  const app = { world, cam, human: 0, placement: 'house', placeDir: 0, mouse: { overCanvas: true, x: 400, y: 300 } };
  const ctx = new Proxy({}, { get: (t, key) => key in t ? t[key] : () => {}, set: (t, key, v) => { t[key] = v; return true; } });
  const original = RTS.sprites.building, seen = [];
  RTS.sprites.building = (c, type, s, color, e, civ) => seen.push(civ);
  try {
    RTS.render.placement(ctx, app);
  } finally {
    RTS.sprites.building = original;
  }
  assert.deepStrictEqual(seen, ['ironrock']);
});
