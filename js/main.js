// 啟動與主迴圈：固定步長推進模擬，每個畫面更新繪圖與介面。
(function () {
  'use strict';
  var RTS = globalThis.RTS;

  var MAX_STEPS_PER_FRAME = 6;
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  var app = {
    human: 0, world: null, ai: null, cam: null,
    selection: [], placement: null, mode: null, drag: null,
    mouse: { x: 0, y: 0, inside: false, overCanvas: false },
    keys: {}, paused: true,
    chosenDifficulty: RTS.data.defaultDifficulty,   // 下一局要用的難度
    chosenCiv: 'random'                             // 下一局自己的文明；電腦一律隨機
  };
  RTS.i18n.init({
    language: window.navigator.language,
    storage: function () { return window.localStorage; }
  });
  app.sound = RTS.sound.create({
    storage: function () { return window.localStorage; },
    AudioContext: window.AudioContext || window.webkitAudioContext
  });
  app.hud = RTS.hud.create(app);
  app.notify = app.hud.notify;

  function resize() {
    var ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (app.cam) RTS.camera.resize(app.cam, window.innerWidth, window.innerHeight);
  }

  function createOpponent() {
    return RTS.ai.create(1 - app.human, app.chosenDifficulty);
  }

  function applyCivs() {
    RTS.civs.assign(app.world, app.human, app.chosenCiv, Math.random);
  }

  function newGame(seed) {
    app.world = RTS.game.create(seed);
    applyCivs();
    app.ai = createOpponent();
    app.cam = RTS.camera.create(app.world.map.width, app.world.map.height);
    app.selection = [];
    app.groups = RTS.groups.create();
    app.lastIdle = 0;
    app.placement = app.mode = app.drag = null;
    app.hud.reset();
    if (app.minimap) app.minimap.refresh();
    resize();
    var tc = RTS.world.buildingsOf(app.world, app.human, 'townCenter')[0];
    var c = RTS.world.center(tc);
    RTS.camera.centerOn(app.cam, c.x, c.y);
  }

  function randomSeed() {
    return Math.floor(Math.random() * 0x7fffffff);
  }

  app.restart = function () {
    newGame(randomSeed());
    app.paused = false;
    app.hud.showOverlay(null);
  };

  app.closeOverlay = function () {
    if (app.world.over) return;
    if (app.world.tick === 0) {     // 開局前套用選好的難度與文明
      app.ai = createOpponent();
      applyCivs();
    }
    app.paused = false;
    app.hud.showOverlay(null);
  };

  app.togglePause = function () {
    if (app.world.over) return;
    if (app.paused) app.closeOverlay();
    else { app.paused = true; app.hud.showOverlay('pause'); }
  };

  app.toggleHelp = function () {
    if (app.world.over) return;
    if (app.hud.overlay() === 'help') app.closeOverlay();
    else { app.paused = true; app.hud.showOverlay('help'); }
  };

  // 開啟「重新開始」視窗，預選本局難度
  app.askRestart = function () {
    if (app.world.over) return;
    app.chosenDifficulty = app.ai.difficulty;
    app.paused = true;
    app.hud.showOverlay('restart');
  };

  // mode 'next'：依序選下一位閒置村民；'all'：全選。鏡頭跟著移過去
  app.selectIdle = function (mode) {
    var ids, focus;
    if (mode === 'all') {
      var idle = RTS.groups.allIdle(app.world, app.human);
      if (!idle) return;
      ids = idle.ids;
      focus = idle.focus;
    } else {
      var u = RTS.groups.nextIdle(app.world, app.human, app.lastIdle);
      if (!u) return;
      app.lastIdle = u.id;
      ids = [u.id];
      focus = u;
    }
    app.selection = ids;
    app.placement = app.mode = null;
    RTS.camera.centerOn(app.cam, focus.x, focus.y);
  };

  function click(id, handler) {
    document.getElementById(id).addEventListener('click', function (ev) {
      ev.currentTarget.blur();
      handler();
    });
  }

  app.minimap = RTS.minimap.create(document.getElementById('minimap'), app);
  click('btn-pause', app.togglePause);
  // 按鈕：點一下全選，Shift + 點擊逐一選
  document.getElementById('btn-idle').addEventListener('click', function (ev) {
    ev.currentTarget.blur();
    app.selectIdle(ev.shiftKey ? 'next' : 'all');
  });
  app.gotoAlert = function () {
    var spot = app.alerts.active();
    if (spot) RTS.camera.centerOn(app.cam, spot.x, spot.y);
    return !!spot;
  };
  click('btn-alert', app.gotoAlert);
  click('btn-help', app.toggleHelp);
  click('btn-sound', app.sound.toggle);
  ['pointerdown', 'keydown'].forEach(function (type) {
    window.addEventListener(type, app.sound.unlock, true);
  });
  click('btn-restart', app.askRestart);
  click('overlay-primary', function () {
    if (app.hud.overlay() === 'result') app.hud.showOverlay('over');
    else if (app.world.over || app.hud.overlay() === 'restart') app.restart();
    else app.closeOverlay();
  });
  click('overlay-restart', app.askRestart);
  click('overlay-cancel', app.closeOverlay);

  function switchLanguage() {
    RTS.i18n.toggle();
    app.hud.relocalize();
  }
  click('btn-lang', switchLanguage);
  click('overlay-lang', switchLanguage);

  window.addEventListener('resize', resize);
  RTS.input.bind(app, canvas);
  newGame(randomSeed());
  app.hud.showOverlay('help');

  var last = null, pending = 0;
  function frame(now) {
    var dt = last === null ? 0 : Math.min(0.25, (now - last) / 1000);
    last = now;
    var tick = RTS.data.TICK;

    if (!app.paused && !app.world.over) {
      pending += dt;
      for (var n = 0; pending >= tick && n < MAX_STEPS_PER_FRAME; n++) {
        app.ai.update(app.world, tick);
        RTS.game.step(app.world);
        pending -= tick;
      }
      if (pending >= tick) pending = 0;     // 追不上時放慢遊戲，不累積欠帳
      if (app.world.over) app.hud.showOverlay('result');      // 先看勝負與成就，按確定後才問要不要再玩
    }

    // 目標消失或看不見了就取消選取
    app.selection = app.selection.filter(function (id) {
      var e = app.world.entities.get(id);
      return !!e && RTS.fog.targetable(app.world, app.human, e);
    });
    if (!app.selection.length) app.placement = app.mode = null;
    RTS.input.scroll(app, dt);
    RTS.render.draw(ctx, app);
    RTS.cursor.update(app, canvas);
    app.hud.update(dt);
    app.sound.frame(app);
    app.minimap.update(dt);
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);

  RTS.app = app;     // 方便在主控台除錯
})();
