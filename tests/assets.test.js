'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { root } = require('./helpers');

// 大小寫必須與實際檔名完全一致（GitHub Pages 區分大小寫，Windows 不會提醒）
function existsExact(rel) {
  let dir = root;
  return rel.split('/').every(part => {
    const ok = fs.readdirSync(dir).includes(part);
    dir = path.join(dir, part);
    return ok;
  });
}

test('頁面資源都用相對路徑且大小寫相符（可放在子路徑下）', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
    .filter(r => !r.startsWith('data:'));
  assert.ok(refs.length > 20);
  for (const ref of refs) {
    assert.ok(!/^(\/|\\|[a-z]+:)/i.test(ref), '應為相對路徑 ' + ref);
    assert.ok(existsExact(ref), '找不到或大小寫不符 ' + ref);
  }
  const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
  assert.ok(!/url\(|@import/.test(css), '樣式不引用外部資源');
});
