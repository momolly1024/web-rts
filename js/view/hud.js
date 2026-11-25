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

  function create(app) {
    var actionsBox = $('actions'), queueBox = $('queue');
    var actionSig = null, queueSig = null, current = [], toastTimer = 0, overlayKind = null;

    function notify(message) {
      if (!message) return;
      text($('toast'), message);
      $('toast').classList.add('show');
      toastTimer = 2.2;
    }

    function updateTop() {
      var world = app.world, res = world.players[app.human].res;
      RTS.data.resources.forEach(function (r) { text($('res-' + r), String(res[r])); });
      var pop = RTS.world.population(world, app.human);
      text($('res-pop'), pop.used + (pop.queued ? '+' + pop.queued : '') + ' / ' + pop.cap);
      $('res-pop').classList.toggle('warn', pop.used + pop.queued >= pop.cap);
      var s = Math.floor(world.time);
      text($('clock'), Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));
      text($('btn-pause'), app.paused ? '繼續 (P)' : '暫停 (P)');
      text($('difficulty-name'), RTS.data.difficulties[app.ai.difficulty].name);
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
          button.appendChild(el('span', 'label', a.label));
          button.appendChild(el('span', 'cost', a.cost));
          actionsBox.appendChild(button);
        });
      }
      current.forEach(function (a, i) {
        var button = actionsBox.children[i];
        button.disabled = !a.enabled;
        button.title = a.reason || '';
        button.classList.toggle('active', !!a.active);
      });
    }

    function updateQueue() {
      var sel = RTS.actions.selected(app);
      var b = sel.length === 1 && sel[0].kind === 'building' && sel[0].owner === app.human ? sel[0] : null;
      var queue = b ? b.queue : [];
      var sig = (b ? b.id : '') + '|' + queue.map(function (q) { return q.type; }).join(',');
      if (sig !== queueSig) {
        queueSig = sig;
        queueBox.textContent = '';
        queue.forEach(function (q, i) {
          var item = el('button', 'queued');
          item.type = 'button';
          item.dataset.index = i;
          item.title = '點擊取消並退款';
          item.appendChild(el('span', '', RTS.data.units[q.type].name));
          item.appendChild(el('i'));
          queueBox.appendChild(item);
        });
      }
      queue.forEach(function (q, i) {
        queueBox.children[i].lastChild.style.width = Math.floor(q.progress * 100) + '%';
      });
      var stalled = queue.length && queue[0].progress >= 1;
      text($('queue-note'), stalled ? '等待人口空位或出兵空間' : queue.length ? '生產中，點項目可取消' : '');
    }

    function updateInfo() {
      var info = RTS.actions.describe(app);
      text($('sel-title'), info.title);
      var body = $('sel-body');
      var joined = info.lines.join('\n');
      if (body.textContent !== joined) body.textContent = joined;
    }

    function updateHint() {
      var hint = app.placement
        ? '選擇建地：左鍵放置（Shift 可連續放置），右鍵或 Esc 取消'
        : app.mode === 'attackMove' ? '攻擊移動：左鍵指定目的地，右鍵或 Esc 取消' : '';
      text($('hint'), hint);
    }

    // 說明文字直接由資料表產生，調參數後不必另外改介面
    function difficultySummary(key) {
      var cfg = RTS.ai.config(key);
      return '約 ' + cfg.graceTime / 60 + ' 分鐘後才進攻，第一波 ' + cfg.attackSize +
        ' 人，軍隊最多 ' + cfg.armyMax + ' 人';
    }

    function buildDifficultyPicker() {
      RTS.data.difficultyOrder.forEach(function (key) {
        var label = el('label'), input = el('input');
        input.type = 'radio';
        input.name = 'difficulty';
        input.value = key;
        input.addEventListener('change', function () { app.chosenDifficulty = key; });
        label.appendChild(input);
        label.appendChild(el('b', '', RTS.data.difficulties[key].name));
        label.appendChild(el('span', '', difficultySummary(key)));
        $('difficulty-picker').appendChild(label);
      });
    }
    buildDifficultyPicker();

    // kind: 'help' | 'pause' | 'restart' | 'over' | null
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
      var title = '玩法說明', primary = app.world.tick === 0 ? '開始遊戲' : '回到戰場', note = '';
      if (kind === 'pause') {
        title = '遊戲暫停';
        primary = '繼續遊戲';
      } else if (kind === 'restart') {
        title = '重新開始';
        note = '開新局會放棄目前戰局。';
        primary = '開始新局';
      } else if (kind === 'over') {
        var won = app.world.winner === app.human;
        title = won ? '勝利' : '戰敗';
        note = won ? '敵方主堡已被摧毀。' : '你的主堡已被摧毀。';
        primary = '再玩一局';
      }
      text($('overlay-title'), title);
      text($('overlay-note'), note);
      text($('overlay-primary'), primary);
      $('overlay-restart').hidden = kind === 'over' || kind === 'restart' || app.world.tick === 0;
      $('overlay-cancel').hidden = kind !== 'restart';
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

    return {
      notify: notify,
      showOverlay: showOverlay,
      overlay: function () { return overlayKind; },
      reset: function () { actionSig = null; queueSig = null; toastTimer = 0; $('toast').classList.remove('show'); },
      update: function (dt) {
        updateTop();
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
