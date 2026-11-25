// 依目前選取產生資訊文字與指令按鈕清單（面板按鈕與快捷鍵共用）。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function selected(app) {
    return app.selection.map(function (id) { return RTS.world.get(app.world, id); }).filter(Boolean);
  }

  function costText(cost) {
    return Object.keys(cost).map(function (k) { return RTS.data.resourceNames[k] + ' ' + cost[k]; }).join('、');
  }

  function issue(app, command) {
    var result = RTS.commands.issue(app.world, app.human, command);
    if (!result.ok) app.notify(result.reason);
    return result;
  }

  function unitActions(app, units) {
    var data = RTS.data, out = [];
    var ids = units.map(function (u) { return u.id; });
    if (units.some(function (u) { return data.units[u.type].canBuild; })) {
      data.buildOrderList.forEach(function (type) {
        var def = data.buildings[type];
        var ok = RTS.world.canAfford(app.world, app.human, def.cost);
        out.push({
          id: 'build:' + type, label: '建造' + def.name, hotkey: def.hotkey, cost: costText(def.cost),
          enabled: ok, reason: ok ? '' : '資源不足', active: app.placement === type,
          run: function () { app.placement = type; app.mode = null; }
        });
      });
    }
    if (units.some(function (u) { return data.units[u.type].military; })) {
      out.push({
        id: 'attackMove', label: '攻擊移動', hotkey: 'F', cost: '沿途迎敵', enabled: true,
        active: app.mode === 'attackMove',
        run: function () { app.mode = 'attackMove'; app.placement = null; }
      });
    }
    out.push({
      id: 'stop', label: '停止', hotkey: 'X', cost: '', enabled: true,
      run: function () { issue(app, { type: 'stop', unitIds: ids }); }
    });
    return out;
  }

  function buildingActions(app, b) {
    var data = RTS.data;
    if (!b.complete) {
      return [{
        id: 'cancelBuild', label: '取消建造', hotkey: 'X', cost: '退回全部資源', enabled: true,
        run: function () { issue(app, { type: 'cancelBuild', buildingId: b.id }); }
      }];
    }
    return data.buildings[b.type].trains.map(function (type) {
      var def = data.units[type];
      var check = RTS.production.check(app.world, b, type);
      return {
        id: 'train:' + type, label: '訓練' + def.name, hotkey: def.hotkey, cost: costText(def.cost),
        enabled: check.ok, reason: check.reason || '',
        run: function () { issue(app, { type: 'train', buildingId: b.id, unit: type }); }
      };
    });
  }

  function list(app) {
    var sel = selected(app);
    var own = sel.filter(function (e) { return e.owner === app.human; });
    var units = own.filter(function (e) { return e.kind === 'unit'; });
    var out = units.length ? unitActions(app, units)
      : own.length === 1 && own[0].kind === 'building' ? buildingActions(app, own[0]) : [];
    if (app.placement || app.mode) {
      out.push({
        id: 'cancelMode', label: '取消', hotkey: 'Esc', cost: '', enabled: true,
        run: function () { app.placement = null; app.mode = null; }
      });
    }
    return out;
  }

  var ORDER_TEXT = {
    idle: '待命', move: '移動中', gather: '採集中', deposit: '運送中',
    build: '施工中', attack: '作戰中', attackMove: '攻擊移動中'
  };

  function describe(app) {
    var data = RTS.data, sel = selected(app);
    if (!sel.length) {
      return { title: '尚未選取', lines: ['左鍵點選或拖曳框選，右鍵下達指令。'] };
    }
    if (sel.length > 1) {
      var counts = {};
      sel.forEach(function (e) { counts[e.type] = (counts[e.type] || 0) + 1; });
      return {
        title: '已選取 ' + sel.length + ' 個單位',
        lines: Object.keys(counts).map(function (t) { return data.units[t].name + ' × ' + counts[t]; })
      };
    }
    var e = sel[0], def = RTS.world.defOf(e), lines = [];
    if (e.kind === 'node') {
      lines.push(def.resource ? '剩餘' + data.resourceNames[def.resource] + ' ' + e.amount : '無法通行');
      return { title: def.name, lines: lines };
    }
    var title = def.name + (e.owner === app.human ? '' : '（敵方）');
    lines.push('生命 ' + Math.ceil(e.hp) + ' / ' + e.maxHp);
    if (e.kind === 'unit') {
      lines.push(data.attackTypes[def.attack.type] + '攻擊 ' + def.attack.damage +
        '　護甲類型 ' + data.armorTypes[def.armorType]);
      lines.push('護甲 近戰 ' + def.armor.melee + '／穿刺 ' + def.armor.pierce + '　視野 ' + def.vision);
      if (e.owner === app.human) {
        var carry = e.carry.amount > 0
          ? '　攜帶' + data.resourceNames[e.carry.resource] + ' ' + e.carry.amount : '';
        lines.push((ORDER_TEXT[e.order.type] || '') + carry);
      }
    } else {
      if (!e.complete) lines.push('施工進度 ' + Math.floor(e.progress * 100) + '%（右鍵派村民協助）');
      if (def.pop) lines.push('提供人口 ' + def.pop);
    }
    return { title: title, lines: lines };
  }

  RTS.actions = { list: list, describe: describe, selected: selected, issue: issue };
})();
