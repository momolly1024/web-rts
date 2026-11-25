// 執行方式：node tests/run-tests.js
'use strict';
const fs = require('fs');
const path = require('path');

const tests = [];
globalThis.test = (name, fn) => tests.push({ name, fn, file: globalThis.currentFile });

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
process.exitCode = failed ? 1 : 0;
