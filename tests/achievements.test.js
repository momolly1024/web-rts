'use strict';
const assert = require('assert');
const { RTS, arena, runUntil, unit } = require('./helpers');

const A = () => RTS.achievements;
const ids = (world, pid = 0) => A().badges(world, pid).map(b => b.id);
// 雙方各放一座主堡，推進模擬時才不會立刻分出勝負
const keep = world => [0, 1].forEach(p => RTS.world.addBuilding(world, 'townCenter', p, 20, 1 + p * 4, true));
const win = (world, time = 1200) => { world.over = true; world.winner = 0; world.time = time; };
const hitBy = (world, attacker, target) => {
  target.hp = 0.5;
  RTS.combat.hit(world, attacker, RTS.data.units[attacker.type].attack, 0, target);
};

test('成就：擊倒單位與摧毀建築記在攻擊方，陣亡記在受害方', () => {
  const world = arena();
  const soldier = unit(world, 'swordsman', 0, 2, 2);
  hitBy(world, soldier, unit(world, 'villager', 1, 3, 2));
  hitBy(world, soldier, RTS.world.addBuilding(world, 'house', 1, 5, 5, true));
  assert.strictEqual(A().stat(world, 0, 'kills'), 1);
  assert.strictEqual(A().stat(world, 0, 'villagerKills'), 1);
  assert.strictEqual(A().stat(world, 0, 'razed'), 1);
  assert.strictEqual(A().stat(world, 1, 'lost'), 1);
  assert.strictEqual(A().stat(world, 1, 'villagersLost'), 1);
});

test('成就：村民被野豬撞死記為野豬的點心', () => {
  const world = arena();
  keep(world);
  const villager = unit(world, 'villager', 0, 5, 5);
  villager.hp = 1;
  const boar = RTS.world.addAnimal(world, 'boar', 6.5, 5.5);
  boar.targetId = villager.id;
  assert.ok(runUntil(world, () => !world.entities.has(villager.id), 100));
  assert.ok(ids(world).includes('boarSnack'));
});

test('成就：宰自己的羊、拆除、市場交易、訓練士兵都有計數', () => {
  const world = arena(24, { food: 2000, wood: 2000, gold: 2000, stone: 0 });
  keep(world);
  const villager = unit(world, 'villager', 0, 2, 2);
  const mine = RTS.world.addAnimal(world, 'sheep', 3.5, 2.5);
  mine.owner = 0;
  RTS.animals.hurt(world, mine, villager, 999);
  RTS.animals.hurt(world, RTS.world.addAnimal(world, 'sheep', 8.5, 8.5), villager, 999);
  assert.strictEqual(A().stat(world, 0, 'slaughtered'), 1, '野生的羊不算');
  RTS.pen.demolish(world, RTS.world.addBuilding(world, 'house', 0, 10, 10, true));
  assert.strictEqual(A().stat(world, 0, 'demolished'), 1);
  const market = RTS.world.addBuilding(world, 'market', 0, 12, 2, true);
  assert.ok(RTS.market.trade(world, market, 'wood', 'sell').ok);
  assert.strictEqual(A().stat(world, 0, 'trades'), 1);
  RTS.world.addBuilding(world, 'house', 0, 18, 18, true);
  const barracks = RTS.world.addBuilding(world, 'barracks', 0, 14, 10, true);
  assert.ok(RTS.production.enqueue(world, barracks, 'swordsman').ok);
  assert.ok(runUntil(world, () => !barracks.queue.length, 800));
  assert.strictEqual(A().stat(world, 0, 'soldiers'), 1);
});

test('成就：勝利類只有贏家拿得到，毫髮無傷與愛民如子擇一', () => {
  const world = arena();
  win(world, 500);
  assert.ok(ids(world).includes('blitz') && ids(world).includes('flawless') && ids(world).includes('pitchfork'));
  assert.ok(!ids(world).includes('guardian') && !ids(world).includes('pacifist'));
  assert.deepStrictEqual(ids(world, 1).filter(i => ['blitz', 'flawless', 'pitchfork'].includes(i)), []);
  A().bump(world, 0, 'lost');
  assert.ok(ids(world).includes('guardian') && !ids(world).includes('flawless'));
  A().bump(world, 0, 'villagersLost');
  assert.ok(!ids(world).includes('guardian'));
  world.time = RTS.data.achievements.need.blitz + 1;
  assert.ok(!ids(world).includes('blitz'));
});

test('成就：次數類達門檻才解鎖，沒訓練士兵的落敗要撐夠久', () => {
  const world = arena(24, { food: 0, wood: 0, gold: 0, stone: 0 });
  const need = RTS.data.achievements.need;
  world.over = true;
  world.winner = 1;
  world.time = need.pacifist - 1;
  assert.deepStrictEqual(ids(world), []);
  world.time = need.pacifist;
  assert.deepStrictEqual(ids(world), ['pacifist']);
  A().bump(world, 0, 'soldiers');
  for (let i = 1; i < need.slayer; i++) A().bump(world, 0, 'kills');
  assert.deepStrictEqual(ids(world), []);
  A().bump(world, 0, 'kills');
  world.players[0].res.gold = need.hoarder;
  world.players[0].upgrades.age = 2;
  RTS.world.addBuilding(world, 'townCenter', 0, 2, 2, true);
  RTS.world.addBuilding(world, 'townCenter', 0, 8, 8, true);
  assert.deepStrictEqual(ids(world).sort(), ['castle', 'expander', 'hoarder', 'slayer']);
});

test('成就：羊固定排第一，所有成就都有中英文字', () => {
  const world = arena();
  win(world);
  assert.strictEqual(A().summary(world, 0)[0].id, 'sheep');
  const all = ['sheep', 'blitz', 'flawless', 'guardian', 'slayer', 'razer', 'castle', 'expander', 'fullHouse',
    'merciless', 'boarSnack', 'butcher', 'demolisher', 'merchant', 'hoarder', 'pitchfork', 'pacifist'];
  for (const id of all) {
    for (const language of RTS.i18n.LANGUAGES) assert.ok(RTS.locales[language]['achievement.' + id], language + ' ' + id);
  }
});
