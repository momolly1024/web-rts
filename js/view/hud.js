// DOM 介面：資源列、選取面板、生產佇列、提示訊息與覆蓋視窗。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  function $(id) { return document.getElementById(id); }

  // 只在內容改變時寫入 DOM
  function text(el, value) {
    if (el.textContent !== value) el.textContent = value;
  }

  function el(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function t(key, params) {
    return RTS.i18n.t(key, params);
  }

  // 靜態文字：依 data-i18n 填入，切換語言時重跑一次
  function applyStatic() {
    document.documentElement.lang = RTS.i18n.current() === 'en' ? 'en' : 'zh-Hant-TW';
    document.title = t('app.title');
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      text(node, t(node.dataset.i18n));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (node) {
      node.title = t(node.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (node) {
      node.setAttribute('aria-label', t(node.dataset.i18nAria));
    });
  }

  function create(app) {
    var actionsBox = $('actions'), queueBox = $('queue');
    var actionSig = null, queueSig = null, current = [], toastTimer = 0, overlayKind = null;
    var toastMessage = null, claimed = null;

    // code 是模擬層回傳的錯誤代碼
    function notify(code) {
      if (code) say('error.' + code);
    }

    function say(key, params) {
      toastMessage = { key: key, params: params };
      $('toast').classList.toggle('info', key.indexOf('error.') !== 0);
      text($('toast'), t(key, params));
      $('toast').classList.add('show');
      toastTimer = 3.5;
    }

    // 新認領到牲畜時提示一次
    function watchClaims() {
      var now = RTS.world.list(app.world, function (e) {
        return e.kind === 'animal' && e.owner === app.human;
      }).map(function (e) { return e.id; });
      // 正在顯示錯誤訊息時不插播，免得玩家看不到指令為何失敗
      var busy = toastTimer > 0 && toastMessage && toastMessage.key.indexOf('error.') === 0;
      if (!busy && claimed && now.some(function (id) { return claimed.indexOf(id) < 0; })) say('hint.sheepClaimed');
      claimed = now;
    }

    function updateTop() {
      var world = app.world, res = world.players[app.human].res;
      RTS.data.resources.forEach(function (r) { text($('res-' + r), String(res[r])); });
      var pop = RTS.world.population(world, app.human);
      text($('res-pop'), pop.used + (pop.queued ? '+' + pop.queued : '') + ' / ' + pop.cap);
      var full = pop.used + pop.queued >= pop.cap;
      $('res-pop').classList.toggle('warn', full);
      $('res-pop').title = full ? t(pop.cap >= RTS.data.POP_MAX ? 'error.popMax' : 'error.popCap') : '';
      var s = Math.floor(world.time);
      text($('clock'), Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));
      text($('btn-pause'), t(app.paused ? 'hud.resume' : 'hud.pause'));
      text($('difficulty-name'), t('difficulty.' + app.ai.difficulty));
    }

    function updateIdle() {
      var n = RTS.groups.idleVillagers(app.world, app.human).length;
      text($('idle-count'), String(n));
      $('btn-idle').disabled = n === 0;
    }

    function updateActions() {
      current = RTS.actions.list(app);
      var sig = app.selection.join(',') + '|' + current.map(function (a) { return a.id; }).join(',');
      if (sig !== actionSig) {
        actionSig = sig;
        actionsBox.textContent = '';
        current.forEach(function (a) {
          var button = el('button', 'action');
          button.type = 'button';
          button.dataset.id = a.id;
          button.appendChild(el('kbd', '', a.hotkey));
          button.appendChild(el('span', 'label'));
          button.appendChild(el('span', 'cost'));
          actionsBox.appendChild(button);
        });
      }
      current.forEach(function (a, i) {
        var button = actionsBox.children[i];
        text(button.children[1], a.label);
        text(button.children[2], a.cost);
        button.disabled = !a.enabled;
        button.title = a.reason ? t('error.' + a.reason) : '';
        button.classList.toggle('active', !!a.active);
      });
    }

    function updateQueue() {
      var sel = RTS.actions.selected(app);
      var b = sel.length === 1 && sel[0].kind === 'building' && sel[0].owner === app.human ? sel[0] : null;
      var queue = b ? b.queue : [];
      var sig = (b ? b.id : '') + '|' + queue.map(function (q) { return q.type || q.research + q.level; }).join(',');
      if (sig !== queueSig) {
        queueSig = sig;
        queueBox.textContent = '';
        queue.forEach(function (q, i) {
          var item = el('button', 'queued');
          item.type = 'button';
          item.dataset.index = i;
          item.appendChild(el('span'));
          item.appendChild(el('i'));
          queueBox.appendChild(item);
        });
      }
      queue.forEach(function (q, i) {
        var item = queueBox.children[i];
        item.title = t('queue.cancelTitle');
        text(item.firstChild, RTS.actions.queueName(q));
        queueBox.children[i].lastChild.style.width = Math.floor(q.progress * 100) + '%';
      });
      var stalled = queue.length && queue[0].progress >= 1;
      text($('queue-note'), stalled ? t('queue.stalled') : queue.length ? t('queue.active') : '');
    }

    function updateInfo() {
      var info = RTS.actions.describe(app);
      text($('sel-title'), info.title);
      text($('sel-rally'), RTS.actions.rallyNote(app));
      var body = $('sel-body');
      var joined = info.lines.join('\n');
      if (body.textContent !== joined) body.textContent = joined;
    }

    function updateHint() {
      var hint = app.placement ? t('hint.placement')
        : app.mode === 'attackMove' ? t('hint.attackMove') : '';
      text($('hint'), hint);
    }

    // 說明文字直接由資料表產生，調參數後不必另外改介面
    function difficultySummary(key) {
      var cfg = RTS.ai.config(key);
      return t('difficulty.summary', {
        minutes: cfg.graceTime / 60, first: cfg.attackSize, max: cfg.armyMax
      });
    }

    function buildDifficultyPicker() {
      RTS.data.difficultyOrder.forEach(function (key) {
        var label = el('label'), input = el('input');
        input.type = 'radio';
        input.name = 'difficulty';
        input.value = key;
        input.addEventListener('change', function () { app.chosenDifficulty = key; });
        label.appendChild(input);
        label.appendChild(el('b'));
        label.appendChild(el('span'));
        $('difficulty-picker').appendChild(label);
      });
    }
    buildDifficultyPicker();

    function labelDifficulties() {
      $('difficulty-picker').querySelectorAll('input').forEach(function (input) {
        text(input.parentNode.children[1], t('difficulty.' + input.value));
        text(input.parentNode.children[2], difficultySummary(input.value));
      });
    }

    // 切換語言後重寫所有不是每幀更新的文字
    function relocalize() {
      applyStatic();
      labelDifficulties();
      if (toastMessage) text($('toast'), t(toastMessage.key, toastMessage.params));
      if (overlayKind) showOverlay(overlayKind);
    }

    // kind: 'help' | 'pause' | 'restart' | 'result'（勝負與成就）| 'over'（再玩一局）| null
    function showOverlay(kind) {
      overlayKind = kind;
      $('overlay').hidden = !kind;
      if (!kind) {
        if (document.activeElement) document.activeElement.blur();
        return;
      }
      $('help-text').hidden = kind !== 'help';
      // 只有「開局前」與「要開新局」時能選難度
      var picking = kind === 'restart' || kind === 'over' || (kind === 'help' && app.world.tick === 0);
      $('difficulty-picker').hidden = !picking;
      if (picking) {
        $('difficulty-picker').querySelector('input[value="' + app.chosenDifficulty + '"]').checked = true;
      }
      var start = app.world.tick === 0;
      var title = start ? 'app.title' : 'overlay.help', note = '';
      var primary = start ? 'button.start' : 'button.back';
      if (kind === 'pause') {
        title = 'overlay.pause';
        primary = 'button.resume';
      } else if (kind === 'restart') {
        title = 'overlay.restart';
        note = 'overlay.restartNote';
        primary = 'button.newGame';
      } else if (kind === 'result' || kind === 'over') {
        var won = app.world.winner === app.human;
        title = won ? 'overlay.victory' : 'overlay.defeat';
        note = won ? 'overlay.victoryNote' : 'overlay.defeatNote';
        primary = kind === 'result' ? 'button.ok' : 'button.playAgain';
      }
      text($('overlay-title'), t(title));
      text($('overlay-note'), note ? t(note) : '');
      text($('overlay-primary'), t(primary));
      $('overlay-restart').hidden = kind === 'over' || kind === 'result' || kind === 'restart' || app.world.tick === 0;
      $('overlay-cancel').hidden = kind !== 'restart';
      showAchievements(kind === 'result');
    }

    // 遊戲結束時列出成就
    function showAchievements(show) {
      $('achievements').hidden = !show;
      var list = $('achievement-list');
      while (list.firstChild) list.removeChild(list.firstChild);
      if (!show) return;
      RTS.achievements.summary(app.world, app.human).forEach(function (a) {
        var li = document.createElement('li');
        li.textContent = t('achievement.' + a.id, { count: a.count, percent: a.percent });
        list.appendChild(li);
      });
    }

    // 事件只綁一次，按鈕重建也不受影響
    actionsBox.addEventListener('click', function (ev) {
      var button = ev.target.closest('button');
      if (!button) return;
      var action = current.filter(function (a) { return a.id === button.dataset.id; })[0];
      if (action && action.enabled) action.run();
      button.blur();
    });
    queueBox.addEventListener('click', function (ev) {
      var button = ev.target.closest('button');
      if (!button) return;
      RTS.actions.issue(app, { type: 'cancelTrain', buildingId: app.selection[0], index: +button.dataset.index });
    });

    relocalize();

    return {
      relocalize: relocalize,
      notify: notify,
      say: say,
      showOverlay: showOverlay,
      overlay: function () { return overlayKind; },
      reset: function () {
        actionSig = null;
        queueSig = null;
        toastTimer = 0;
        toastMessage = null;
        claimed = null;
        $('toast').classList.remove('show');
      },
      update: function (dt) {
        watchClaims();
        updateTop();
        updateIdle();
        updateInfo();
        updateActions();
        updateQueue();
        updateHint();
        if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').classList.remove('show');
      }
    };
  }

  RTS.hud = { create: create };
})();
