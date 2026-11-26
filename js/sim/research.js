// 研究升級：查詢目前等級與加成、能否研究。排程沿用建築的生產佇列。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function level(world, pid, track) {
    return world.players[pid].upgrades[track] || 0;
  }

  // 目前時代（0 黑暗、1 封建、2 城堡）
  function age(world, pid) {
    return level(world, pid, 'age');
  }

  // 時代不夠時的失敗結果；夠就回傳 null
  function ageFail(world, pid, need) {
    if (!need || age(world, pid) >= need) return null;
    return need === 1 ? { ok: false, reason: 'needsFeudal' } : { ok: false, reason: 'needsCastle' };
  }

  // 升時代需要的建築：from 中已完工的種類數
  function needsMet(world, pid, needs) {
    var have = needs.from.filter(function (type) {
      return RTS.world.buildingsOf(world, pid, type).some(function (b) { return b.complete; });
    });
    return { have: have, ok: have.length >= needs.count };
  }

  function pending(world, pid, track) {
    var found = false;
    world.entities.forEach(function (e) {
      if (e.kind !== 'building' || e.owner !== pid) return;
      if (e.queue.some(function (q) { return q.research === track; })) found = true;
    });
    return found;
  }

  // 兵種升級的等級（0 為未升級）與該項數值累計加成；stat 為 hp、attack、armor、range
  function tierTrack(unitType) {
    var found = null;
    Object.keys(RTS.data.upgrades).forEach(function (track) {
      if (RTS.data.upgrades[track].unitType === unitType) found = track;
    });
    return found;
  }

  function tier(world, pid, unitType) {
    var track = tierTrack(unitType);
    return track ? level(world, pid, track) : 0;
  }

  // 含文明的兵種加成
  function tierBonus(world, pid, unitType, stat) {
    var track = tierTrack(unitType), total = RTS.civs.unitBonus(world, pid, unitType, stat);
    if (!track) return total;
    for (var i = 0; i < level(world, pid, track); i++) total += RTS.data.upgrades[track].levels[i].tier[stat] || 0;
    return total;
  }

  // 某兵種目前的攻擊或護甲加成總和（鐵匠鋪 + 兵種升級）；stat 為 'attack' 或 'armor'
  function bonus(world, pid, unitType, stat) {
    var cls = RTS.data.units[unitType] && RTS.data.units[unitType].upgradeClass;
    var total = tierBonus(world, pid, unitType, stat);
    if (!cls) return total;
    Object.keys(RTS.data.upgrades).forEach(function (track) {
      var up = RTS.data.upgrades[track];
      if (up.unitClass !== cls || up.stat !== stat) return;
      for (var i = 0; i < level(world, pid, track); i++) total += up.levels[i].bonus;
    });
    return total;
  }

  // 研究與文明效果（effects）的加成總和，key 例如 'gather.wood'、'carry'、'speed'、'farmFood'、'tower.damage'
  function economy(world, pid, key) {
    var total = RTS.civs.effect(world, pid, key);
    Object.keys(RTS.data.upgrades).forEach(function (track) {
      var up = RTS.data.upgrades[track];
      if (!up.levels[0].effects) return;
      for (var i = 0; i < level(world, pid, track); i++) total += up.levels[i].effects[key] || 0;
    });
    return total;
  }

  function check(world, b, track) {
    var def = RTS.data.buildings[b.type];
    if (!def.researches || def.researches.indexOf(track) < 0) return { ok: false, reason: 'cannotResearch' };
    if (!b.complete) return { ok: false, reason: 'notComplete' };
    var next = RTS.data.upgrades[track].levels[level(world, b.owner, track)];
    if (!next) return { ok: false, reason: 'maxLevel' };
    var tooEarly = ageFail(world, b.owner, next.age);
    if (tooEarly) return tooEarly;
    if (next.needs && !needsMet(world, b.owner, next.needs).ok) return { ok: false, reason: 'needsBuildings' };
    if (pending(world, b.owner, track)) return { ok: false, reason: 'alreadyResearching' };
    if (b.queue.length >= RTS.data.QUEUE_MAX) return { ok: false, reason: 'queueFull' };
    if (!RTS.world.canAfford(world, b.owner, next.cost)) return { ok: false, reason: 'notEnoughResources' };
    return { ok: true };
  }

  function enqueue(world, b, track) {
    var result = check(world, b, track);
    if (!result.ok) return result;
    var lv = level(world, b.owner, track);
    RTS.world.pay(world, b.owner, RTS.data.upgrades[track].levels[lv].cost);
    b.queue.push({ research: track, level: lv, progress: 0 });
    return result;
  }

  // 研究完成：兵種升級讓場上同類單位的生命上限與目前生命一起增加
  function complete(world, pid, track, lv) {
    world.players[pid].upgrades[track] = lv + 1;
    var up = RTS.data.upgrades[track], gain = up.unitType && up.levels[lv].tier.hp;
    if (!gain) return;
    world.entities.forEach(function (e) {
      if (e.kind === 'unit' && e.owner === pid && e.type === up.unitType) { e.maxHp += gain; e.hp += gain; }
    });
  }

  // 單座建築的分支改建
  function checkBranch(world, b, key) {
    var branches = RTS.data.buildings[b.type].branches, next = branches && branches[key];
    if (!next) return { ok: false, reason: 'cannotResearch' };
    if (!b.complete) return { ok: false, reason: 'notComplete' };
    if (b.branch) return { ok: false, reason: 'alreadyBranched' };
    var tooEarly = ageFail(world, b.owner, next.age);
    if (tooEarly) return tooEarly;
    if (b.queue.some(function (q) { return q.branch; })) return { ok: false, reason: 'alreadyResearching' };
    if (b.queue.length >= RTS.data.QUEUE_MAX) return { ok: false, reason: 'queueFull' };
    if (!RTS.world.canAfford(world, b.owner, next.cost)) return { ok: false, reason: 'notEnoughResources' };
    return { ok: true };
  }

  function enqueueBranch(world, b, key) {
    var result = checkBranch(world, b, key);
    if (!result.ok) return result;
    RTS.world.pay(world, b.owner, RTS.data.buildings[b.type].branches[key].cost);
    b.queue.push({ branch: key, building: b.type, progress: 0 });
    return result;
  }

  RTS.research = {
    checkBranch: checkBranch, enqueueBranch: enqueueBranch,
    tier: tier, tierTrack: tierTrack, tierBonus: tierBonus, complete: complete,
    level: level, age: age, ageFail: ageFail, needsMet: needsMet, pending: pending, bonus: bonus, economy: economy, check: check, enqueue: enqueue
  };
})();
