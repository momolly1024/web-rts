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
    chosenDifficulty: RTS.data.defaultDifficulty    // 下一局要用的難度
  };
  RTS.i18n.init({
    language: window.navigator.language,
    storage: function () { return window.localStorage; }
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

  function newGame(seed) {
    app.world = RTS.game.create(seed);
    app.ai = createOpponent();
    app.cam = RTS.camera.create(app.world.map.width, app.world.map.height);
    app.selection = [];
    app.groups = RTS.groups.create();
    app.lastIdle = 0;
    app.placement = app.mode = app.drag = null;
    app.hud.reset();
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
    if (app.world.tick === 0) app.ai = createOpponent();    // 開局前套用選好的難度
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

  // 選取下一位閒置村民並把鏡頭移過去
  app.selectIdle = function () {
    var u = RTS.groups.nextIdle(app.world, app.human, app.lastIdle);
    if (!u) return;
    app.lastIdle = u.id;
    app.selection = [u.id];
    app.placement = app.mode = null;
    RTS.camera.centerOn(app.cam, u.x, u.y);
  };

  function click(id, handler) {
    document.getElementById(id).addEventListener('click', function (ev) {
      ev.currentTarget.blur();
      handler();
    });
  }

  click('btn-pause', app.togglePause);
  click('btn-idle', app.selectIdle);
  click('btn-help', app.toggleHelp);
  click('btn-restart', app.askRestart);
  click('overlay-primary', function () {
    if (app.world.over || app.hud.overlay() === 'restart') app.restart();
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
      if (app.world.over) app.hud.showOverlay('over');
    }

    app.selection = app.selection.filter(function (id) { return app.world.entities.has(id); });
    if (!app.selection.length) app.placement = app.mode = null;
    RTS.input.scroll(app, dt);
    RTS.render.draw(ctx, app);
    app.hud.update(dt);
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);

  RTS.app = app;     // 方便在主控台除錯
})();
