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

  // 時代還不夠的東西先不顯示，升級後才出現（快捷鍵仍會提示需要哪個時代）
  function ageLocked(reason) {
    return reason === 'needsFeudal' || reason === 'needsCastle';
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
      var page = app.buildPage === 'mil' ? 'mil' : 'eco';
      out.push({
        id: 'buildPage', label: t(page === 'eco' ? 'action.pageMil' : 'action.pageEco'), hotkey: 'Tab',
        cost: t(page === 'eco' ? 'action.pageMilNote' : 'action.pageEcoNote'), enabled: true,
        run: function () { app.buildPage = page === 'eco' ? 'mil' : 'eco'; }
      });
      data.buildPages.eco.concat(data.buildPages.mil).forEach(function (type) {
        var def = data.buildings[type];
        var missing = RTS.construction.missingRequirement(app.world, app.human, type);
        var reason = missing ? missing.reason : (RTS.world.canAfford(app.world, app.human, def.cost) ? '' : 'notEnoughResources');
        out.push({
          id: 'build:' + type, label: t('action.build', { name: t('building.' + type) }),
          hotkey: def.hotkey, cost: costText(def.cost),
          enabled: !reason, reason: reason, active: app.placement === type,
          hidden: data.buildPages[page].indexOf(type) < 0 || ageLocked(reason),
          run: function () { app.placement = type; app.placeDir = 0; app.mode = null; app.wallStart = null; }
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

  // 單座建築改建：兩種擇一，做完就不再顯示
  function branchActions(app, b) {
    var def = RTS.data.buildings[b.type];
    if (!def.branches || b.branch) return [];
    return Object.keys(def.branches).map(function (key) {
      var next = def.branches[key];
      var check = RTS.research.checkBranch(app.world, b, key);
      var label = t('action.branch', { name: t('branch.' + key) });
      var cost = costText(next.cost);
      return {
        id: 'branch:' + key, hotkey: next.hotkey, label: label,
        cost: cost, enabled: check.ok, reason: check.reason || '', hidden: ageLocked(check.reason),
        detail: function () {
          var lines = [label].concat(RTS.upgradeInfo.branchLines(app.world, b, key), t('tip.cost', { list: cost }));
          if (check.reason) lines.push(t('error.' + check.reason));
          return lines;
        },
        run: function () { issue(app, { type: 'branch', buildingId: b.id, branch: key }); }
      };
    });
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
    return researchActions(app, b).concat(branchActions(app, b), reseedActions(app, b), marketActions(app, b),
      demolishActions(app, b), data.buildings[b.type].trains.filter(function (type) {
      return RTS.civs.allows(app.world, app.human, type);
    }).map(function (type) {
      var def = data.units[type];
      var check = RTS.production.check(app.world, b, type);
      return {
        id: 'train:' + type, label: t('action.train', { name: unitName(app.world, app.human, type) }),
        hotkey: def.hotkey, cost: costText(def.cost),
        enabled: check.ok, reason: check.reason || '', hidden: ageLocked(check.reason),
        run: function () { issue(app, { type: 'train', buildingId: b.id, unit: type }); }
      };
    }), garrisonActions(app, b));
  }

  function demolishActions(app, b) {
    if (!RTS.pen.canDemolish(b)) return [];
    return [{
      id: 'demolish', label: t('action.demolish'), hotkey: 'Delete',
      cost: t('action.demolishRefund', { list: costText(RTS.pen.refundOf(b)) }), enabled: true,
      run: function () { issue(app, { type: 'demolish', buildingId: b.id }); }
    }];
  }

  // 磨坊：預付農田重種
  function reseedActions(app, b) {
    if (!RTS.data.buildings[b.type].reseed) return [];
    var count = app.world.players[app.human].reseeds;
    var check = RTS.farm.checkReseed(app.world, b);
    return [{
      id: 'reseed', label: t('action.reseed', { count: count }), hotkey: 'E',
      cost: costText(RTS.data.buildings.farm.cost), enabled: check.ok, reason: check.reason || '',
      run: function () { issue(app, { type: 'reseed', buildingId: b.id }); }
    }, {
      id: 'cancelReseed', label: t('action.cancelReseed'), hotkey: 'X',
      cost: t('action.refundOne'), enabled: count > 0, reason: count > 0 ? '' : 'cannotCancel',
      run: function () { issue(app, { type: 'cancelReseed' }); }
    }];
  }

  // 市場：每種資源一個買、一個賣
  function marketActions(app, b) {
    var m = RTS.data.market;
    if (!RTS.data.buildings[b.type].market) return [];
    var out = [];
    ['buy', 'sell'].forEach(function (side) {
      m.goods.forEach(function (res, i) {
        var gold = RTS.market.quote(app.world, app.human, res, side);
        var check = RTS.market.check(app.world, b, res, side);
        out.push({
          id: side + ':' + res, hotkey: m.hotkeys[side][i],
          label: t('action.' + side, { amount: m.lot, name: t('resource.' + res) }),
          cost: t('action.' + side + 'Price', { gold: gold }),
          enabled: check.ok, reason: check.reason || '',
          run: function () { issue(app, { type: 'trade', buildingId: b.id, resource: res, side: side }); }
        });
      });
    });
    return out;
  }

  function researchActions(app, b) {
    return (RTS.data.buildings[b.type].researches || []).map(function (track) {
      var up = RTS.data.upgrades[track];
      var level = RTS.research.level(app.world, app.human, track);
      var next = up.levels[level];
      var check = RTS.research.check(app.world, b, track);
      var label = next ? t('action.research', { name: RTS.upgradeInfo.upgradeName(track, level + 1) })
        : t('action.maxed', { name: t('upgrade.' + track) });
      var cost = next ? costText(next.cost) : '';
      return {
        id: 'research:' + track, hotkey: up.hotkey, label: label,
        cost: cost, enabled: check.ok, reason: check.reason || '',
        // 浮動說明：標題、效果、花費、不能研究的原因
        detail: function () {
          var lines = [label].concat(RTS.upgradeInfo.lines(app.world, app.human, track));
          if (cost) lines.push(t('tip.cost', { list: cost }));
          if (next && check.reason) lines.push(t('error.' + check.reason));
          return lines;
        },
        hidden: ageLocked(check.reason),
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

  function unitName(world, owner, type) {
    return RTS.upgradeInfo.unitName(world, owner, type);
  }

  function nameOf(e, world) {
    if (e.branch) return t('branch.' + e.branch);
    return e.kind === 'unit' && world ? unitName(world, e.owner, e.type) : t(e.kind + '.' + e.type);
  }

  function describeUnit(app, e, def) {
    var atk = RTS.research.bonus(app.world, e.owner, e.type, 'attack');
    var arm = RTS.research.bonus(app.world, e.owner, e.type, 'armor');
    function plus(base, extra) { return extra ? base + '+' + extra : base; }
    var range = def.attack ? RTS.research.tierBonus(app.world, e.owner, e.type, 'range') : 0;
    var lines = [
      def.attack ? t('info.attack', {
        type: t('attackType.' + def.attack.type), damage: plus(def.attack.damage, atk),
        armor: t('armorType.' + def.armorType)
      }) + (range ? t('info.rangeUp', { amount: range }) : '') : t('info.heal', { rate: def.heal.rate }),
      t('info.defense', {
        melee: plus(def.armor.melee, arm), pierce: plus(def.armor.pierce, arm), vision: def.vision
      })
    ];
    if (e.owner === app.human) {
      var carry = e.carry.amount > 0
        ? t('info.carry', { resource: t('resource.' + e.carry.resource), amount: e.carry.amount }) : '';
      var delivering = e.order.deliver || e.order.returning;
      lines.push(t(delivering ? 'order.deposit' : 'order.' + e.order.type) + carry);
    }
    return lines;
  }

  function describeAnimal(app, e, def) {
    if (e.owner === app.human && RTS.pen.penOf(app.world, e)) {
      return [t('info.penned'), t(def.young ? 'info.young' : 'info.food', def.young
        ? { seconds: RTS.pen.growLeft(e) } : { amount: def.food })];
    }
    var owner = e.owner === null ? 'info.animal.' + def.behavior
      : e.owner === app.human ? 'info.animalOwn' : 'info.animalEnemy';
    if (def.young) return [t(owner), t('info.young', { seconds: RTS.pen.growLeft(e) })];
    return [t(owner), t('info.food', { amount: def.food })];
  }

  function describeBuilding(app, e, def) {
    var human = app.human;
    var lines = [];
    if (!e.complete) lines.push(t('info.progress', { percent: Math.floor(e.progress * 100) }));
    if (def.pop) lines.push(t('info.providesPop', { amount: def.pop }));
    if (e.type === 'townCenter' && e.owner === human && e.complete) lines = lines.concat(ageLines(app));
    if (def.dropoff && e.type !== 'townCenter') {
      lines.push(t('info.dropoff', { list: def.dropoff.map(function (r) { return t('resource.' + r); })
        .join(t('list.separator')) }));
    }
    if (def.farm && e.complete) {
      lines.push(t('info.remaining', { resource: t('resource.food'), amount: e.amount }));
      if (e.owner === human) lines.push(t(RTS.farm.farmerOf(app.world, e) ? 'info.farmBusy' : 'info.farmFree'));
    }
    if (def.reseed && e.owner === human) {
      lines.push(t('info.reseeds', { count: app.world.players[human].reseeds }));
    }
    if (def.market && e.owner === human) lines.push(t('info.market'));
    if (def.attack && e.complete && e.owner === human) {
      lines.push(t('info.towerStats', {
        damage: def.attack.damage + RTS.towers.damageBonus(app.world, e), range: RTS.towers.rangeOf(app.world, e)
      }));
    }
    if (def.pen && e.complete && e.owner === human) {
      var count = RTS.pen.flock(app.world, e).length, grown = RTS.pen.adults(app.world, e);
      lines.push(grown < def.pen.parents ? t('info.penNeed', { adults: grown, need: def.pen.parents })
        : count >= def.pen.cap ? t('info.penFull', { count: count, max: def.pen.cap })
        : t('info.pen', { count: count, max: def.pen.cap, seconds: RTS.pen.secondsLeft(e) }));
    }
    if (e.complete && e.owner === human && def.trains.length) {
      var pop = RTS.world.population(app.world, human);
      if (pop.used + pop.queued >= pop.cap) {
        lines.push(t(pop.cap >= RTS.data.POP_MAX ? 'error.popMax' : 'error.popCap'));
      }
    }
    if (def.garrison && e.owner === human) {
      lines.push(t('info.garrison', { count: RTS.garrison.count(e), max: def.garrison.capacity }));
    }
    if (RTS.repair.canRepair(e) && e.owner === human) lines.push(t('info.repairHint'));
    return lines;
  }

  // 主堡：目前時代與升下一個時代的條件
  function ageLines(app) {
    var world = app.world, human = app.human, age = RTS.research.age(world, human);
    var lines = [t('info.age', { name: t('age.' + age) })];
    var next = RTS.data.upgrades.age.levels[age];
    if (!next) return lines.concat(t('info.ageMax'));
    var met = RTS.research.needsMet(world, human, next.needs);
    lines.push(t('info.ageNeeds', {
      name: t('age.' + (age + 1)), count: next.needs.count, have: met.have.length,
      list: next.needs.from.map(function (type) { return t('building.' + type); }).join(t('list.separator'))
    }));
    return lines;
  }

  // 生產建築的集結點提示（獨立一行，窄視窗也看得到）
  function rallyNote(app) {
    var sel = selected(app);
    if (sel.length !== 1 || !RTS.rally.showsHint(sel[0], app.human)) return '';
    if (!sel[0].rally) return t('info.rallyHint');
    return t('info.rallySet', { target: t(RTS.rally.targetKey(app.world, sel[0])) });
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
          return t('selection.countLine', { name: unitName(app.world, app.human, type), count: counts[type] });
        })
      };
    }
    var e = sel[0], def = RTS.world.defOf(e);
    if (e.kind === 'node') {
      return {
        title: nameOf(e),
        lines: [t('info.remaining', { resource: t('resource.' + def.resource), amount: e.amount })]
      };
    }
    var enemy = e.owner !== app.human && e.owner !== null;
    var title = enemy ? t('selection.enemy', { name: nameOf(e, app.world) }) : nameOf(e, app.world);
    if (e.kind === 'animal' && def.behavior === 'herd' && !enemy) {
      title = t(e.owner === null ? 'selection.unclaimed' : 'selection.own', { name: nameOf(e) });
    }
    var lines = [t('info.hp', { hp: Math.ceil(e.hp), max: e.maxHp })];
    return {
      title: title,
      lines: lines.concat(e.kind === 'unit' ? describeUnit(app, e, def)
        : e.kind === 'animal' ? describeAnimal(app, e, def) : describeBuilding(app, e, def))
    };
  }

  // 生產佇列項目的顯示名稱
  function queueName(item) {
    if (item.branch) return t('branch.' + item.branch);
    return item.research ? RTS.upgradeInfo.upgradeName(item.research, item.level + 1) : t('unit.' + item.type);
  }

  RTS.actions = { rallyNote: rallyNote, list: list, describe: describe, selected: selected, issue: issue, queueName: queueName };
})();
