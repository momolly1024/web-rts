'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { RTS, root } = require('./helpers');

const CJK = /[　-〿㐀-鿿豈-﫿＀-￯]/;
const zh = RTS.locales['zh-TW'];
const en = RTS.locales.en;

const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function files(dir, ext) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(d => {
    const rel = dir + '/' + d.name;
    return d.isDirectory() ? files(rel, ext) : rel.endsWith(ext) ? [rel] : [];
  });
}

// 移除註解、保留字串
function stripJsComments(code) {
  return code.replace(/('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    (match, str) => str || '');
}

const placeholders = text => (text.match(/\{\w+\}/g) || []).sort();

test('兩種語言鍵值完全一致、沒有空字串、參數相同', () => {
  assert.deepStrictEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const key of Object.keys(zh)) {
    assert.ok(zh[key].trim() && en[key].trim(), '空字串 ' + key);
    assert.deepStrictEqual(placeholders(en[key]), placeholders(zh[key]), '參數不一致 ' + key);
  }
});

test('語言檔內沒有重複定義的鍵', () => {
  for (const file of ['js/i18n/zh-TW.js', 'js/i18n/en.js']) {
    const keys = [...read(file).matchAll(/^\s*'([\w.-]+)':/gm)].map(m => m[1]);
    assert.strictEqual(new Set(keys).size, keys.length, file);
  }
});

test('英文字串沒有殘留中文（切換鈕上的語言名稱除外）', () => {
  for (const [key, text] of Object.entries(en)) {
    if (key !== 'lang.switch') assert.ok(!CJK.test(text), key + ': ' + text);
  }
});

test('語言檔以外的程式、頁面與樣式沒有寫死的中文', () => {
  const targets = files('js', '.js').filter(f => !f.startsWith('js/i18n/') || f.endsWith('i18n.js'));
  const found = [];
  const scan = (file, code) => code.split('\n').forEach((line, i) => {
    if (CJK.test(line)) found.push(`${file}:${i + 1} ${line.trim()}`);
  });
  targets.forEach(f => scan(f, stripJsComments(read(f))));
  scan('index.html', read('index.html').replace(/<!--[\s\S]*?-->/g, ''));
  files('css', '.css').forEach(f => scan(f, read(f).replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.deepStrictEqual(found, []);
});

test('index.html 的文字都來自存在的鍵', () => {
  const html = read('index.html');
  const keys = [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map(m => m[1]);
  assert.ok(keys.length > 30);
  keys.forEach(k => assert.ok(k in zh, '缺少 ' + k));
  // 除了程式動態填入的數字，標籤之間不應有寫死的文字
  const body = html.slice(html.indexOf('<body>'));
  const literal = body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '\n')
    .split('\n').map(s => s.trim()).filter(s => /[A-Za-z㐀-鿿]/.test(s));
  assert.deepStrictEqual(literal, []);
});

test('介面程式用到的鍵都存在', () => {
  const used = new Set();
  for (const file of files('js/view', '.js').concat('js/main.js')) {
    const code = stripJsComments(read(file));
    // 任何形如 '分類.名稱' 的字串，只要分類屬於語言檔就必須是完整的鍵
    const groups = new Set(Object.keys(zh).map(k => k.split('.')[0]));
    for (const [, key, group] of code.matchAll(/'(([a-zA-Z]+)\.[a-zA-Z]+)'/g)) {
      if (groups.has(group)) used.add(key);
    }
  }
  assert.ok(used.size > 30);
  used.forEach(k => assert.ok(k in zh, '缺少 ' + k));
});

test('資料表的每個代號都有名稱', () => {
  const d = RTS.data;
  const need = [
    ...d.resources.map(k => 'resource.' + k),
    ...Object.keys(d.nodes).map(k => 'node.' + k),
    ...Object.keys(d.units).map(k => 'unit.' + k),
    ...Object.keys(d.buildings).map(k => 'building.' + k),
    ...Object.keys(d.damageBonus).map(k => 'attackType.' + k),
    ...Object.values(d.damageBonus).flatMap(Object.keys).map(k => 'armorType.' + k),
    ...d.difficultyOrder.map(k => 'difficulty.' + k)
  ];
  need.forEach(k => assert.ok(k in zh && k in en, '缺少 ' + k));
  // 指令狀態機認得的每種狀態
  const orders = [...read('js/sim/orders.js').matchAll(/case '(\w+)'/g)].map(m => m[1]).concat('idle');
  orders.forEach(k => assert.ok('order.' + k in zh, '缺少 order.' + k));
});

test('模擬層回傳的錯誤代碼都有對應訊息，且沒有多餘的', () => {
  const codes = new Set();
  for (const file of files('js/sim', '.js')) {
    const code = stripJsComments(read(file));
    for (const m of code.matchAll(/(?:fail\(|reason: )'(\w+)'/g)) codes.add(m[1]);
  }
  const defined = Object.keys(zh).filter(k => k.startsWith('error.')).map(k => k.slice(6));
  assert.deepStrictEqual([...codes].sort(), defined.sort());
});

test('預設語言依瀏覽器：zh 開頭用繁中，否則英文', () => {
  for (const lang of ['zh-TW', 'zh', 'ZH-cn', 'zh-Hant-HK']) assert.strictEqual(RTS.i18n.detect(lang), 'zh-TW');
  for (const lang of ['en-US', 'ja', '', undefined]) assert.strictEqual(RTS.i18n.detect(lang), 'en');
});

test('記住玩家選擇；無效的儲存值忽略', () => {
  const memory = {};
  const storage = () => ({ getItem: k => memory[k] || null, setItem: (k, v) => { memory[k] = v; } });
  assert.strictEqual(RTS.i18n.init({ language: 'zh-TW', storage }), 'zh-TW');
  assert.deepStrictEqual(memory, {}, '沒有主動選擇前不寫入');
  assert.strictEqual(RTS.i18n.toggle(), 'en');
  assert.strictEqual(memory[RTS.i18n.STORAGE_KEY], 'en');
  assert.strictEqual(RTS.i18n.init({ language: 'zh-TW', storage }), 'en');
  memory[RTS.i18n.STORAGE_KEY] = 'klingon';
  assert.strictEqual(RTS.i18n.init({ language: 'zh-TW', storage }), 'zh-TW');
  assert.strictEqual(RTS.i18n.set('klingon'), 'zh-TW');
});

test('localStorage 不可用時安全退回', () => {
  const broken = [
    () => { throw new Error('SecurityError'); },
    () => null,
    () => ({ getItem() { throw new Error('x'); }, setItem() { throw new Error('quota'); } }),
    undefined
  ];
  for (const storage of broken) {
    assert.strictEqual(RTS.i18n.init({ language: 'en-GB', storage }), 'en');
    assert.strictEqual(RTS.i18n.toggle(), 'zh-TW');
    assert.strictEqual(RTS.i18n.t('app.title'), '領主之戰');
  }
});

test('取字串會代入參數，缺鍵回傳鍵名', () => {
  RTS.i18n.init({ language: 'en' });
  assert.strictEqual(RTS.i18n.t('selection.many', { count: 3 }), '3 units selected');
  assert.strictEqual(RTS.i18n.t('app.title'), 'Lords at War');
  assert.strictEqual(RTS.i18n.t('no.such.key'), 'no.such.key');
});
