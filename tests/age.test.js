'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

function field() {
  const w = arena(30, { food: 3000, wood: 3000, gold: 3000, stone: 0 });
  const tc = RTS.world.addBuilding(w, 'townCenter', 0, 1, 1, true);
  RTS.world.addBuilding(w, 'townCenter', 1, 26, 26, true);
  return { w, tc };
}

const research = (w, b, track = 'age') => RTS.commands.issue(w, 0, { type: 'research', buildingId: b.id, track });

test('升時代：需要兩種本時代建築，在主堡研究完成後時代加一', () => {
  const { w, tc } = field();
  assert.strictEqual(RTS.research.age(w, 0), 0);
  assert.strictEqual(research(w, tc).reason, 'needsBuildings');
  RTS.world.addBuilding(w, 'barracks', 0, 10, 10, true);
  assert.strictEqual(research(w, tc).reason, 'needsBuildings', '只有一種');
  RTS.world.addBuilding(w, 'mill', 0, 15, 10, false);
  assert.strictEqual(research(w, tc).reason, 'needsBuildings', '工地不算');
  RTS.world.addBuilding(w, 'lumberCamp', 0, 15, 14, true);
  const food = w.players[0].res.food;
  assert.ok(research(w, tc).ok);
  assert.strictEqual(w.players[0].res.food, food - RTS.data.upgrades.age.levels[0].cost.food);
  assert.strictEqual(research(w, tc).reason, 'alreadyResearching');
  assert.ok(runUntil(w, () => RTS.research.age(w, 0) === 1, 2000));
  assert.strictEqual(research(w, tc).reason, 'needsBuildings', '城堡要封建建築');
  RTS.world.addBuilding(w, 'stable', 0, 20, 10, true);
  RTS.world.addBuilding(w, 'market', 0, 20, 15, true);
  assert.ok(research(w, tc).ok);
  assert.ok(runUntil(w, () => RTS.research.age(w, 0) === 2, 3000));
  assert.strictEqual(research(w, tc).reason, 'maxLevel');
  assert.strictEqual(RTS.research.age(w, 1), 0, '對手不受影響');
});

test('時代限制：建築、兵種、各級研究都要到對應時代', () => {
  const { w, tc } = field();
  const v = unit(w, 'villager', 0, 8, 8);
  const build = type => RTS.commands.issue(w, 0, { type: 'build', unitIds: [v.id], building: type, tx: 12, ty: 12 });
  ['archeryRange', 'stable', 'blacksmith', 'market'].forEach(type => assert.strictEqual(build(type).reason, 'needsFeudal', type));
  const barracks = RTS.world.addBuilding(w, 'barracks', 0, 16, 16, true);
  const train = (b, u) => RTS.commands.issue(w, 0, { type: 'train', buildingId: b.id, unit: u });
  assert.ok(train(barracks, 'swordsman').ok);
  assert.strictEqual(train(barracks, 'spearman').reason, 'needsFeudal');
  assert.strictEqual(research(w, tc, 'handcart').reason, 'needsFeudal');
  const camp = RTS.world.addBuilding(w, 'lumberCamp', 0, 20, 20, true);
  assert.ok(research(w, camp, 'woodcutting').ok, '經濟科技第一級黑暗時代就能研究');
  w.players[0].upgrades.age = 1;
  assert.ok(train(barracks, 'spearman').ok);
  assert.ok(build('archeryRange').ok);
  const smith = RTS.world.addBuilding(w, 'blacksmith', 0, 5, 20, true);
  assert.ok(research(w, smith, 'meleeAttack').ok);
  w.players[0].upgrades.meleeAttack = 1;
  smith.queue = [];
  assert.strictEqual(research(w, smith, 'meleeAttack').reason, 'needsCastle');
});

test('兵種相剋：長槍兵剋騎兵、騎兵剋弓箭手、弓箭手剋長槍兵；劍士近身剋弓箭手也打贏長槍兵', () => {
  const def = t => RTS.data.units[t];
  const hit = (a, b) => RTS.combat.damageOf(a, def(b));
  assert.ok(hit('spearman', 'cavalry') > hit('spearman', 'swordsman') * 2.5, '長槍兵對騎兵有大加成');
  assert.ok(hit('cavalry', 'archer') > hit('archer', 'cavalry') * 2, '騎兵打弓箭手遠比被射痛');
  // 實際對打：同樣花費等級的一對一
  function duel(a, b) {
    const w = arena(16);
    RTS.world.addBuilding(w, 'townCenter', 0, 0, 0, true);
    RTS.world.addBuilding(w, 'townCenter', 1, 13, 13, true);
    const x = unit(w, a, 0, 6, 8), y = unit(w, b, 1, a === 'archer' || b === 'archer' ? 11 : 7, 8);
    RTS.commands.issue(w, 0, { type: 'attack', unitIds: [x.id], targetId: y.id });
    RTS.commands.issue(w, 1, { type: 'attack', unitIds: [y.id], targetId: x.id });
    runUntil(w, () => !RTS.world.get(w, x.id) || !RTS.world.get(w, y.id), 3000);
    return RTS.world.get(w, x.id) ? a : b;
  }
  assert.strictEqual(duel('spearman', 'cavalry'), 'spearman');
  assert.strictEqual(duel('cavalry', 'archer'), 'cavalry');
  assert.strictEqual(duel('archer', 'spearman'), 'archer');
  assert.strictEqual(duel('swordsman', 'archer'), 'swordsman');
  assert.strictEqual(duel('swordsman', 'spearman'), 'swordsman');
});

test('AI 會升到封建時代並訓練新兵種', () => {
  const world = RTS.game.create(7);
  const ai = RTS.ai.create(1);
  const target = RTS.world.buildingsOf(world, 0, 'townCenter')[0];
  target.hp = target.maxHp = 1e9;      // 玩家主堡打不壞，讓對局拉長
  const types = new Set();
  for (let i = 0; i < 16000 && !world.over; i++) {
    ai.update(world, RTS.data.TICK);
    RTS.game.step(world);
    if (i % 100 === 0) RTS.world.unitsOf(world, 1).forEach(u => types.add(u.type));
  }
  assert.ok(RTS.research.age(world, 1) >= 1, '應升到封建時代');
  assert.ok(types.has('spearman') || types.has('archer') || types.has('cavalry'), [...types].join(','));
});
