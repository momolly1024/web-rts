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
    b.rally = {
      x: RTS.util.clamp(x, 0, world.map.width - 0.01),
      y: RTS.util.clamp(y, 0, world.map.height - 0.01),
      targetId: t ? t.id : null,
      resource: t && t.kind === 'node' ? RTS.data.nodes[t.type].resource : null
    };
  }

  // 新單位沿用右鍵智慧指令：村民到資源點會直接採集
  function apply(world, b, u) {
    var r = b.rally;
    if (!r) return;
    var target = r.targetId ? RTS.world.get(world, r.targetId) : null;
    if (!target && r.resource && RTS.data.units[u.type].canBuild) {
      target = RTS.gather.findResource(world, r, r.resource);
    }
    RTS.commands.issue(world, b.owner, {
      type: 'smart', unitIds: [u.id], targetId: target ? target.id : null, x: r.x, y: r.y
    });
  }

  RTS.rally = { canRally: canRally, set: set, apply: apply };
})();
