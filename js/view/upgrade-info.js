// 研究項目的名稱與效果說明：由資料表算出「目前 → 升級後」，調整數值不必另外改文字。不碰 DOM。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var PERCENT = /^(speed|gather\.)/;

  function t(key, params) {
    return RTS.i18n.t(key, params);
  }

  function list(names) {
    return names.join(t('list.separator'));
  }

  // 單位名稱含兵種升級（例如劍士升級後叫重裝劍士）
  function unitName(world, owner, type) {
    var tier = RTS.data.units[type] ? RTS.research.tier(world, owner, type) : 0;
    return tier ? t('unitTier.' + type + '.' + tier) : t((RTS.data.units[type] ? 'unit.' : 'animal.') + type);
  }

  // 時代研究顯示時代名稱，兵種升級顯示升級後的名稱，其他顯示「名稱 等級」
  function upgradeName(track, level) {
    if (track === 'age') return t('age.' + level);
    var unitType = RTS.data.upgrades[track].unitType;
    if (unitType) return t('unitTier.' + unitType + '.' + level);
    return t('upgrade.' + track) + ' ' + level;
  }

  // 已滿級（gain 為 0）只顯示目前值
  function change(now, gain, format) {
    var f = format || String;
    return gain ? f(now) + ' → ' + f(now + gain) : f(now);
  }

  function signed(value) {
    return (value < 0 ? '' : '+') + value;
  }

  function percent(value) {
    return signed(Math.round(value * 100)) + '%';
  }

  // 某單位各項數值的目前值（含已研究的加成）
  function statNow(world, pid, type, stat) {
    var def = RTS.data.units[type];
    if (stat === 'hp') return def.hp + RTS.research.tierBonus(world, pid, type, 'hp');
    if (stat === 'range') return def.attack.range + RTS.research.tierBonus(world, pid, type, 'range');
    if (stat === 'attack') return def.attack.damage + RTS.research.bonus(world, pid, type, 'attack');
    return def.armor[stat] + RTS.research.bonus(world, pid, type, 'armor');   // stat 為 melee 或 pierce
  }

  function statLine(world, pid, type, stat, gain) {
    if (stat !== 'armor') return t('tip.' + stat, { value: change(statNow(world, pid, type, stat), gain) });
    return t('tip.armor', {
      melee: change(statNow(world, pid, type, 'melee'), gain),
      pierce: change(statNow(world, pid, type, 'pierce'), gain)
    });
  }

  // 兵種升級：逐項列出生命、攻擊、護甲、射程
  function tierLines(world, pid, up, next) {
    var stats = ['hp', 'attack', 'armor', 'range'].filter(function (stat) {
      return up.levels.some(function (lv) { return lv.tier[stat]; });
    });
    return [t('tip.tierNote', { name: unitName(world, pid, up.unitType) })].concat(stats.map(function (stat) {
      return statLine(world, pid, up.unitType, stat, next ? next.tier[stat] || 0 : 0);
    }));
  }

  // 鐵匠鋪：列出每個受影響兵種的數值
  function classLines(world, pid, up, next) {
    return Object.keys(RTS.data.units).filter(function (type) {
      return RTS.data.units[type].upgradeClass === up.unitClass && RTS.civs.allows(world, pid, type);
    }).map(function (type) {
      return t('tip.unitStat', {
        name: unitName(world, pid, type),
        stat: statLine(world, pid, type, up.stat, next ? next.bonus : 0)
      });
    });
  }

  // 效果代號對應的基準值（百分比類以 0 為基準）
  function effectBase(key) {
    var data = RTS.data;
    if (key === 'farmFood') return data.buildings.farm.farm.food;
    if (key === 'carry') return data.units.villager.carry;
    if (key === 'tower.damage') return data.buildings.tower.attack.damage;
    if (key === 'tower.range') return data.buildings.tower.attack.range;
    return 0;
  }

  function effectLines(world, pid, up, next) {
    var keys = [];
    up.levels.forEach(function (lv) {
      Object.keys(lv.effects).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    });
    return keys.map(function (key) {
      var now = effectBase(key) + RTS.research.economy(world, pid, key);
      var value = change(now, next ? next.effects[key] || 0 : 0, PERCENT.test(key) ? percent : null);
      var resource = key.indexOf('gather.') === 0 ? key.slice(7) : null;
      return resource ? t('tip.gather', { resource: t('resource.' + resource), value: value })
        : t('tip.' + key, { value: value });
    });
  }

  // 升時代：列出解鎖的建築、兵種、研究，以及需要的建築
  function ageLines(world, pid, level, next) {
    if (!next) return [t('info.ageMax')];
    var data = RTS.data, age = level + 1, lines = [];
    function unlocked(table, prefix) {
      return Object.keys(table).filter(function (type) {
        return table[type].age === age && (!table[type].civ || table[type].civ === world.players[pid].civ);
      })
        .map(function (type) { return t(prefix + type); });
    }
    var buildings = unlocked(data.buildings, 'building.');
    var units = unlocked(data.units, 'unit.');
    var researches = [];
    Object.keys(data.upgrades).forEach(function (track) {
      data.upgrades[track].levels.forEach(function (lv, i) {
        if (lv.age === age) researches.push(upgradeName(track, i + 1));
      });
    });
    if (buildings.length) lines.push(t('tip.unlockBuildings', { list: list(buildings) }));
    if (units.length) lines.push(t('tip.unlockUnits', { list: list(units) }));
    if (researches.length) lines.push(t('tip.unlockResearches', { list: list(researches) }));
    var met = RTS.research.needsMet(world, pid, next.needs);
    lines.push(t('tip.needs', {
      count: next.needs.count, have: met.have.length,
      list: list(next.needs.from.map(function (type) { return t('building.' + type); }))
    }));
    return lines;
  }

  function effectsOf(world, pid, up, level, next) {
    if (up.age) return ageLines(world, pid, level, next);
    if (up.unitType) return tierLines(world, pid, up, next);
    if (up.unitClass) return classLines(world, pid, up, next);
    return effectLines(world, pid, up, next);
  }

  function lines(world, pid, track) {
    var up = RTS.data.upgrades[track], level = RTS.research.level(world, pid, track);
    var next = up.levels[level];
    var body = effectsOf(world, pid, up, level, next);
    return next ? body.concat(t('tip.time', { seconds: next.time })) : body;
  }

  // 單座箭塔改建後的數值變化
  function branchLines(world, b, key) {
    var next = RTS.data.buildings[b.type].branches[key];
    var damage = RTS.data.buildings[b.type].attack.damage + RTS.towers.damageBonus(world, b);
    return [
      t('tip.branchNote'),
      t('tip.tower.damage', { value: change(damage, next.effects.damage || 0) }),
      t('tip.tower.range', { value: change(RTS.towers.rangeOf(world, b), next.effects.range || 0) }),
      t('tip.time', { seconds: next.time })
    ];
  }

  // 文明加成說明，一項一句
  function civLines(key) {
    var civ = RTS.data.civs[key];
    var lines = Object.keys(civ.effects || {}).map(function (effect) {
      var gain = civ.effects[effect];
      var value = PERCENT.test(effect) ? percent(gain) : signed(gain);
      var resource = effect.indexOf('gather.') === 0 ? effect.slice(7) : null;
      return resource ? t('civBonus.gather', { resource: t('resource.' + resource), value: value })
        : t('civBonus.' + effect, { value: value });
    });
    function units(table, prefix) {
      Object.keys(table || {}).forEach(function (name) {
        Object.keys(table[name]).forEach(function (stat) {
          lines.push(t('civBonus.unit', { name: t(prefix + name), stat: t('civStat.' + stat), value: signed(table[name][stat]) }));
        });
      });
    }
    units(civ.classBonus, 'civClass.');
    units(civ.unitBonus, 'unit.');
    lines.push(t('civBonus.unique', { name: t('unit.' + civ.unique) }));
    return lines;
  }

  RTS.upgradeInfo = { civLines: civLines, branchLines: branchLines, lines: lines, unitName: unitName, upgradeName: upgradeName };
})();
