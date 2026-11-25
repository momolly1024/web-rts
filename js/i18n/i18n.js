// 語言選擇與取字串。不碰 DOM；瀏覽器環境由 main.js 傳入，方便在 node 測試。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var STORAGE_KEY = 'lords-at-war.language';
  var LANGUAGES = ['zh-TW', 'en'];
  var current = 'en';
  var getStorage = null;

  function detect(browserLanguage) {
    return /^zh/i.test(browserLanguage || '') ? 'zh-TW' : 'en';
  }

  // env.language：navigator.language
  // env.storage：回傳 localStorage 的函式（file:// 或隱私模式下，取用本身就可能丟例外）
  function init(env) {
    getStorage = env.storage || null;
    var saved = null;
    try { saved = getStorage().getItem(STORAGE_KEY); } catch (e) { saved = null; }
    current = LANGUAGES.indexOf(saved) >= 0 ? saved : detect(env.language);
    return current;
  }

  // 玩家主動選擇才寫入；存不進去時本次仍照常切換
  function set(language) {
    if (LANGUAGES.indexOf(language) < 0) return current;
    current = language;
    try { getStorage().setItem(STORAGE_KEY, language); } catch (e) { /* 僅本次有效 */ }
    return current;
  }

  function toggle() {
    return set(LANGUAGES[(LANGUAGES.indexOf(current) + 1) % LANGUAGES.length]);
  }

  // 取字串並代入 {參數}；缺鍵時回傳鍵名方便發現
  function t(key, params) {
    var text = RTS.locales[current][key];
    if (text === undefined) return key;
    return text.replace(/\{(\w+)\}/g, function (whole, name) {
      return params && params[name] !== undefined ? String(params[name]) : whole;
    });
  }

  RTS.i18n = {
    STORAGE_KEY: STORAGE_KEY, LANGUAGES: LANGUAGES,
    detect: detect, init: init, set: set, toggle: toggle, t: t,
    current: function () { return current; }
  };
})();
