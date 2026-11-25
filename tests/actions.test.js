'use strict';
const assert = require('assert');
const path = require('path');
const { RTS, arena, unit, root } = require('./helpers');
require(path.join(root, 'js/view/actions.js'));

function setup() {
  const w = arena(30, { food: 5000, wood: 5000, gold: 5000, stone: 5000 });
  RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 26, 26, true);
  const app = { world: w, human: 0, selection: [], placement: null, mode: null, buildPage: 'mil', notify() {} };
  const shown = () => RTS.actions.list(app).filter(a => !a.hidden).map(a => a.id);
  const all = () => RTS.actions.list(app).map(a => a.id);
  return { w, app, shown, all };
}

test('按鈕：還沒到時代的建築、兵種、研究先不顯示，升級後出現', () => {
  const { w, app, shown, all } = setup();
  const v = unit(w, 'villager', 0, 8, 8);
  app.selection = [v.id];
  assert.ok(shown().includes('build:barracks'));
  ['archeryRange', 'stable', 'blacksmith', 'tower', 'wall', 'gate', 'temple', 'siegeWorkshop'].forEach(type => {
    assert.ok(!shown().includes('build:' + type), type + ' 黑暗時代不顯示');
    assert.ok(all().includes('build:' + type), type + ' 快捷鍵仍在清單裡');
  });
  const barracks = RTS.world.addBuilding(w, 'barracks', 0, 12, 12, true);
  app.selection = [barracks.id];
  assert.deepStrictEqual(shown().filter(id => id.startsWith('train:')), ['train:swordsman', 'train:archer']);
  assert.ok(!shown().includes('research:swordLine'));
  w.players[0].upgrades.age = 1;
  assert.ok(shown().includes('train:spearman') && shown().includes('research:swordLine'));
  app.selection = [v.id];
  assert.ok(shown().includes('build:archeryRange') && !shown().includes('build:temple'));
  w.players[0].upgrades.age = 2;
  assert.ok(shown().includes('build:temple') && shown().includes('build:siegeWorkshop'));
});

test('按鈕：不是時代的條件（農田要磨坊）照樣顯示但不能按', () => {
  const { w, app, shown } = setup();
  const v = unit(w, 'villager', 0, 8, 8);
  app.selection = [v.id];
  app.buildPage = 'eco';
  const farm = RTS.actions.list(app).find(a => a.id === 'build:farm');
  assert.ok(shown().includes('build:farm') && !farm.enabled && farm.reason === 'needsMill');
});
