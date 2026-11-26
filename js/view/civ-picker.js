// 開局畫面的文明選擇，以及戰場左上角的雙方文明標示。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function t(key, params) {
    return RTS.i18n.t(key, params);
  }

  function el(tag, content) {
    var node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function text(node, value) {
    if (node.textContent !== value) node.textContent = value;
  }

  function summary(key) {
    return key === 'random' ? t('civ.randomSummary')
      : RTS.upgradeInfo.civLines(key).join(t('list.separator'));
  }

  // box：選擇用的 fieldset；badge：顯示雙方文明的元素
  function create(app, box, badge) {
    var note = box.querySelector('p');
    ['random'].concat(RTS.data.civOrder).forEach(function (key) {
      var label = el('label'), input = el('input');
      input.type = 'radio';
      input.name = 'civ';
      input.value = key;
      input.addEventListener('change', function () {
        app.chosenCiv = key;
        text(note, summary(key));
      });
      label.appendChild(input);
      label.appendChild(el('b'));
      box.insertBefore(label, note);
    });

    function relabel() {
      box.querySelectorAll('input').forEach(function (input) {
        text(input.parentNode.lastChild, t('civ.' + input.value));
      });
      text(note, summary(app.chosenCiv));
    }

    return {
      relabel: relabel,
      show: function (visible) {
        box.hidden = !visible;
        if (!visible) return;
        box.querySelector('input[value="' + app.chosenCiv + '"]').checked = true;
        text(note, summary(app.chosenCiv));
      },
      // 開局前文明還可能改選，不顯示
      update: function () {
        var players = app.world.players;
        var mine = players[app.human].civ, theirs = players[1 - app.human].civ;
        badge.hidden = !app.world.tick || !mine || !theirs;
        if (badge.hidden) return;
        text(badge, t('civ.badge', { mine: t('civ.' + mine), foe: t('civ.' + theirs) }));
        var title = [mine, theirs].map(function (key) {
          return t('civ.' + key) + t('civ.colon') + summary(key);
        }).join('\n');
        if (badge.title !== title) badge.title = title;
      }
    };
  }

  RTS.civPicker = { create: create };
})();
