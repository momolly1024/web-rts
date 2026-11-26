// 集結點：生產建築出兵後自動前往指定地點或資源。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function canRally(b) {
    return !!b && b.kind === 'building' && RTS.data.buildings[b.type].trains.length > 0;
  }

  // targetId 指向建築自己代表取消
  function set(world, b, x, y, targetId) {
    if (targetId === b.id) { b.rally = null; return; }
    var t = targetId ? RTS.world.get(world, targetId) : null;
    if (t && !RTS.fog.targetable(world, b.owner, t)) t = null;
    b.rally = {
      x: RTS.util.clamp(x, 0, world.map.width - 0.01),
      y: RTS.util.clamp(y, 0, world.map.height - 0.01),
      targetId: t ? t.id : null,
      resource: t && t.kind === 'node' ? RTS.data.nodes[t.type].resource : null
    };
  }

  // 面板提示用：只有己方完工的生產建築才顯示
  function showsHint(b, owner) {
    return canRally(b) && b.complete && b.owner === owner;
  }

  // 集結目標的語言鍵；原資源已耗盡時仍回報資源種類
  function targetKey(world, b) {
    var r = b.rally;
    var target = r.targetId ? RTS.world.get(world, r.targetId) : null;
    if (target) return target.kind + '.' + target.type;
    if (r.resource) return 'resource.' + r.resource;
    return RTS.fish.isWater(world.map, Math.floor(r.x), Math.floor(r.y)) ? 'rally.water' : 'rally.ground';
  }

  // 新單位沿用右鍵智慧指令：村民到資源點會直接採集
  function apply(world, b, u) {
    var r = b.rally;
    if (!r) return;
    var target = r.targetId ? RTS.world.get(world, r.targetId) : null;
    if (!target && r.resource && RTS.data.units[u.type].canBuild) {
      target = RTS.gather.findResource(world, b.owner, r, r.resource);
    }
    RTS.commands.issue(world, b.owner, {
      type: 'smart', unitIds: [u.id], targetId: target ? target.id : null, x: r.x, y: r.y
    });
  }

  RTS.rally = {
    canRally: canRally, set: set, apply: apply, showsHint: showsHint, targetKey: targetKey
  };
})();
