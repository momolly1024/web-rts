// 測試共用：依 index.html 的順序載入模擬層（不含 view/main），並提供情境工具。
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);

scripts
  .filter(s => !/^js\/(view\/|main\.js)/.test(s) || /view\/(camera|groups|minimap|depth|scenery|cursor|upgrade-info|input|alert|sound-events|sound)\.js$/.test(s))
  .forEach(s => require(path.join(root, s)));

const RTS = globalThis.RTS;

// 空白測試場地（無天然物件、雙方資源充足）
function arena(size = 24, resources = { food: 1000, wood: 1000, gold: 1000 }) {
  return RTS.world.create({ width: size, height: size, resources });
}

// 推進模擬直到條件成立或步數用完，回傳是否成立
function runUntil(world, predicate, maxSteps = 4000, onStep) {
  for (let i = 0; i < maxSteps; i++) {
    if (predicate()) return true;
    if (onStep) onStep();
    RTS.game.step(world);
  }
  return predicate();
}

function unit(world, type, owner, tx, ty) {
  return RTS.world.addUnit(world, type, owner, tx + 0.5, ty + 0.5);
}

module.exports = { RTS, scripts, root, arena, runUntil, unit };
