// 開局畫面的文明卡片、戰場左上角的雙方文明標示，以及依自己文明換色的上方列。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var SVG = 'http://www.w3.org/2000/svg';
  // 徽記路徑（24×24）：葉、山岩、麥穗、問號
  var EMBLEMS = {
    greenwood: 'M20 3C10 3 4 8 4 15c0 1.6.4 3 1 4l-2 2 1.4 1.4 2-2c1 .6 2.4 1 3.8 1C17 21.400 21 14 20 3ZM8 16.600 7 15.600 15 8l1 1Z',
    ironrock: 'M2 20 9 6l3.500 6L15 9l7 11ZM9 10l-2 4 2-1 2 2Z',
    goldplain: 'M11 22v-6C7 16 5 13.500 5 11c3 0 5 1 6 3v-3C8 11 6.500 8.500 6.500 6c2.500 0 4 1 4.500 2.500C10 6 10.500 4 12 2c1.500 2 2 4 1 6.500C13.500 7 15 6 17.500 6c0 2.500-1.500 5-4.500 5v3c1-2 3-3 6-3 0 2.500-2 5-6 5v6Z',
    random: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 16h-2.400v-2.400H13Zm-.1-4.200h-2.200c0-3.300 3-3.200 3-5.100 0-.9-.7-1.600-1.700-1.600s-1.7.7-1.800 1.800L8 8.600C8.200 6.400 9.900 5 12.100 5c2.400 0 4 1.400 4 3.500 0 2.800-3.200 3.100-3.200 5.300Z'
  };

  function t(key, params) {
    return RTS.i18n.t(key, params);
  }

  function el(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function emblem(key) {
    var svg = document.createElementNS(SVG, 'svg'), path = document.createElementNS(SVG, 'path');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', EMBLEMS[key]);
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('fill-rule', 'evenodd');
    svg.appendChild(path);
    return svg;
  }

  function summary(key) {
    return key === 'random' ? [t('civ.randomSummary')] : RTS.upgradeInfo.civLines(key);
  }

  // 說明行的樣式：弱點（含負值）與專屬兵種分色
  function lineClass(key, index, line) {
    if (key === 'random') return '';
    if (index === summary(key).length - 1) return 'unique';
    return /-\d/.test(line) ? 'weak' : '';
  }

  // box：選擇用的 fieldset；badge：顯示雙方文明的元素；bar：上方列
  function create(app, box, badge, bar) {
    var shown = '';
    ['random'].concat(RTS.data.civOrder).forEach(function (key) {
      var label = el('label', 'civ-' + key), input = el('input');
      input.type = 'radio';
      input.name = 'civ';
      input.value = key;
      input.addEventListener('change', function () { app.chosenCiv = key; });
      label.appendChild(input);
      label.appendChild(emblem(key));
      label.appendChild(el('b'));
      label.appendChild(el('ul'));
      box.appendChild(label);
    });

    function relabel() {
      box.querySelectorAll('input').forEach(function (input) {
        var key = input.value, card = input.parentNode, list = card.querySelector('ul');
        card.querySelector('b').textContent = t('civ.' + key);
        list.textContent = '';
        summary(key).forEach(function (line, i) {
          list.appendChild(el('li', lineClass(key, i, line), line));
        });
      });
      shown = '';
    }

    return {
      relabel: relabel,
      show: function (visible) {
        box.hidden = !visible;
        if (visible) box.querySelector('input[value="' + app.chosenCiv + '"]').checked = true;
      },
      // 開局前文明還可能改選，不顯示
      update: function () {
        var players = app.world.players;
        var mine = players[app.human].civ, theirs = players[1 - app.human].civ;
        var ready = !!(app.world.tick && mine && theirs);
        var sig = ready ? mine + '|' + theirs + '|' + RTS.i18n.current() : 'none';
        if (sig === shown) return;
        shown = sig;
        badge.hidden = !ready;
        bar.className = ready ? 'civ-' + mine : '';
        if (!ready) bar.removeAttribute('class');
        if (!ready) return;
        badge.className = 'civ-' + mine;
        badge.textContent = '';
        badge.appendChild(emblem(mine));
        badge.appendChild(el('span', '', t('civ.badge', { mine: t('civ.' + mine), foe: t('civ.' + theirs) })));
        badge.title = [mine, theirs].map(function (key) {
          return t('civ.' + key) + t('civ.colon') + summary(key).join(t('list.separator'));
        }).join('\n');
      }
    };
  }

  RTS.civPicker = { create: create };
})();
