// 執行方式：node tests/run-tests.js（完整）
//          node tests/run-tests.js --quick（略過用 slowTest 登記的整局模擬，開發中使用）
'use strict';
const fs = require('fs');
const path = require('path');

const quick = process.argv.includes('--quick');
const tests = [];
let skipped = 0;
globalThis.test = (name, fn) => tests.push({ name, fn, file: globalThis.currentFile });
// 超過約 1.5 秒的測試用 slowTest 登記
globalThis.slowTest = (name, fn) => {
  if (quick) skipped++;
  else globalThis.test(name, fn);
};

fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.test.js'))
  .sort()
  .forEach(f => {
    globalThis.currentFile = f;
    require(path.join(__dirname, f));
  });

let failed = 0;
for (const t of tests) {
  const started = Date.now();
  try {
    t.fn();
    console.log(`通過  [${t.file}] ${t.name} (${Date.now() - started} ms)`);
  } catch (err) {
    failed++;
    console.log(`失敗  [${t.file}] ${t.name}`);
    console.log(err && err.stack ? err.stack : err);
  }
}
console.log(`\n共 ${tests.length} 項，通過 ${tests.length - failed}，失敗 ${failed}`);
if (skipped) console.log(`快速模式略過 ${skipped} 項整局模擬；commit 前請跑完整版`);
process.exitCode = failed ? 1 : 0;
