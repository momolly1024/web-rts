// 依目前選取產生資訊文字與指令按鈕清單（面板按鈕與快捷鍵共用）。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function selected(app) {
    return app.selection.map(function (id) { return RTS.world.get(app.world, id); }).filter(Boolean);
  }

  function t(key, params) {
    return RTS.i18n.t(key, params);
  }

  function costText(cost) {
    return Object.keys(cost).map(function (k) { return t('resource.' + k) + ' ' + cost[k]; })
      .join(t('list.separator'));
  }

  function issue(app, command) {
    var result = RTS.commands.issue(app.world, app.human, command);
    if (!result.ok) app.notify(result.reason);
    return result;
  }

  // 離單位最近、還有空位的己方避難建築
  function nearestShelter(app, u) {
    return RTS.world.nearest(app.world, u.x, u.y, function (e) {
      return e.kind === 'building' && e.owner === app.human && RTS.garrison.hasRoom(e);
    });
  }

  function garrisonActions(app, b) {
    if (!RTS.garrison.capacity(b)) return [];
    var inside = RTS.garrison.count(b);
    return [{
      id: 'ungarrison', label: t('action.ungarrison'), hotkey: 'U',
      cost: t('action.garrisonCount', { count: inside, max: RTS.garrison.capacity(b) }),
      enabled: inside > 0, reason: inside ? '' : 'nothingGarrisoned',
      run: function () { issue(app, { type: 'ungarrison', buildingId: b.id }); }
    }];
  }

  // movers 含己方牲畜；建造、戰鬥等指令只看單位
  function unitActions(app, movers) {
    var data = RTS.data, out = [];
    var ids = movers.map(function (u) { return u.id; });
    var units = movers.filter(function (u) { return u.kind === 'unit'; });
    if (units.some(function (u) { return data.units[u.type].canBuild; })) {
      data.buildOrderList.forEach(function (type) {
        var def = data.buildings[type];
        var ok = RTS.world.canAfford(app.world, app.human, def.cost);
        out.push({
          id: 'build:' + type, label: t('action.build', { name: t('building.' + type) }),
          hotkey: def.hotkey, cost: costText(def.cost),
          enabled: ok, reason: ok ? '' : 'notEnoughResources', active: app.placement === type,
          run: function () { app.placement = type; app.mode = null; }
        });
      });
    }
    if (units.some(function (u) { return data.units[u.type].military; })) {
      out.push({
        id: 'attackMove', label: t('action.attackMove'), hotkey: 'F',
        cost: t('action.attackMoveNote'), enabled: true,
        active: app.mode === 'attackMove',
        run: function () { app.mode = 'attackMove'; app.placement = null; }
      });
    }
    var shelter = units.length && nearestShelter(app, units[0]);
    if (shelter) {
      out.push({
        id: 'garrison', label: t('action.garrison'), hotkey: 'G', cost: '', enabled: true,
        run: function () { issue(app, { type: 'garrison', unitIds: ids, targetId: shelter.id }); }
      });
    }
    out.push({
      id: 'stop', label: t('action.stop'), hotkey: 'X', cost: '', enabled: true,
      run: function () { issue(app, { type: 'stop', unitIds: ids }); }
    });
    return out;
  }

  function buildingActions(app, b) {
    var data = RTS.data;
    if (!b.complete) {
      return [{
        id: 'cancelBuild', label: t('action.cancelBuild'), hotkey: 'X',
        cost: t('action.refundAll'), enabled: true,
        run: function () { issue(app, { type: 'cancelBuild', buildingId: b.id }); }
      }];
    }
    return researchActions(app, b).concat(data.buildings[b.type].trains.map(function (type) {
      var def = data.units[type];
      var check = RTS.production.check(app.world, b, type);
      return {
        id: 'train:' + type, label: t('action.train', { name: t('unit.' + type) }),
        hotkey: def.hotkey, cost: costText(def.cost),
        enabled: check.ok, reason: check.reason || '',
        run: function () { issue(app, { type: 'train', buildingId: b.id, unit: type }); }
      };
    }), garrisonActions(app, b));
  }

  function upgradeName(track, level) {
    return t('upgrade.' + track) + ' ' + level;
  }

  function researchActions(app, b) {
    return (RTS.data.buildings[b.type].researches || []).map(function (track) {
      var up = RTS.data.upgrades[track];
      var level = RTS.research.level(app.world, app.human, track);
      var next = up.levels[level];
      var check = RTS.research.check(app.world, b, track);
      return {
        id: 'research:' + track, hotkey: up.hotkey,
        label: next ? t('action.research', { name: upgradeName(track, level + 1) })
          : t('action.maxed', { name: t('upgrade.' + track) }),
        cost: next ? costText(next.cost) : '', enabled: check.ok, reason: check.reason || '',
        run: function () { issue(app, { type: 'research', buildingId: b.id, track: track }); }
      };
    });
  }

  function list(app) {
    var sel = selected(app);
    var own = sel.filter(function (e) { return e.owner === app.human; });
    var units = own.filter(function (e) { return e.w === undefined; });
    var out = units.length ? unitActions(app, units)
      : own.length === 1 && own[0].kind === 'building' ? buildingActions(app, own[0]) : [];
    if (app.placement || app.mode) {
      out.push({
        id: 'cancelMode', label: t('action.cancel'), hotkey: 'Esc', cost: '', enabled: true,
        run: function () { app.placement = null; app.mode = null; }
      });
    }
    return out;
  }

  function nameOf(e) {
    return t(e.kind + '.' + e.type);
  }

  function describeUnit(app, e, def) {
    var atk = RTS.research.bonus(app.world, e.owner, e.type, 'attack');
    var arm = RTS.research.bonus(app.world, e.owner, e.type, 'armor');
    function plus(base, extra) { return extra ? base + '+' + extra : base; }
    var lines = [
      t('info.attack', {
        type: t('attackType.' + def.attack.type), damage: plus(def.attack.damage, atk),
        armor: t('armorType.' + def.armorType)
      }),
      t('info.defense', {
        melee: plus(def.armor.melee, arm), pierce: plus(def.armor.pierce, arm), vision: def.vision
      })
    ];
    if (e.owner === app.human) {
      var carry = e.carry.amount > 0
        ? t('info.carry', { resource: t('resource.' + e.carry.resource), amount: e.carry.amount }) : '';
      lines.push(t(e.order.deliver ? 'order.deposit' : 'order.' + e.order.type) + carry);
    }
    return lines;
  }

  function describeAnimal(app, e, def) {
    var owner = e.owner === null ? 'info.animal.' + def.behavior
      : e.owner === app.human ? 'info.animalOwn' : 'info.animalEnemy';
    return [t(owner), t('info.food', { amount: def.food })];
  }

  function describeBuilding(e, def, human) {
    var lines = [];
    if (!e.complete) lines.push(t('info.progress', { percent: Math.floor(e.progress * 100) }));
    if (def.pop) lines.push(t('info.providesPop', { amount: def.pop }));
    if (e.complete && e.owner === human && RTS.rally.canRally(e)) {
      lines.push(t(e.rally ? 'info.rallySet' : 'info.rallyHint'));
    }
    if (def.garrison && e.owner === human) {
      lines.push(t('info.garrison', { count: RTS.garrison.count(e), max: def.garrison.capacity }));
    }
    if (RTS.repair.canRepair(e) && e.owner === human) lines.push(t('info.repairHint'));
    return lines;
  }

  function describe(app) {
    var sel = selected(app);
    if (!sel.length) return { title: t('selection.none'), lines: [t('selection.hint')] };
    if (sel.length > 1) {
      var counts = {};
      sel.forEach(function (e) { counts[e.type] = (counts[e.type] || 0) + 1; });
      return {
        title: t('selection.many', { count: sel.length }),
        lines: Object.keys(counts).map(function (type) {
          var kind = RTS.data.units[type] ? 'unit.' : 'animal.';
          return t('selection.countLine', { name: t(kind + type), count: counts[type] });
        })
      };
    }
    var e = sel[0], def = RTS.world.defOf(e);
    if (e.kind === 'node') {
      return {
        title: nameOf(e),
        lines: [def.resource
          ? t('info.remaining', { resource: t('resource.' + def.resource), amount: e.amount })
          : t('info.impassable')]
      };
    }
    var enemy = e.owner !== app.human && e.owner !== null;
    var title = enemy ? t('selection.enemy', { name: nameOf(e) }) : nameOf(e);
    var lines = [t('info.hp', { hp: Math.ceil(e.hp), max: e.maxHp })];
    return {
      title: title,
      lines: lines.concat(e.kind === 'unit' ? describeUnit(app, e, def)
        : e.kind === 'animal' ? describeAnimal(app, e, def) : describeBuilding(e, def, app.human))
    };
  }

  // 生產佇列項目的顯示名稱
  function queueName(item) {
    return item.research ? upgradeName(item.research, item.level + 1) : t('unit.' + item.type);
  }

  RTS.actions = { list: list, describe: describe, selected: selected, issue: issue, queueName: queueName };
})();
