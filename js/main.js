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
    keys: {}, paused: true
  };
  app.hud = RTS.hud.create(app);
  app.notify = app.hud.notify;

  function resize() {
    var ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (app.cam) RTS.camera.resize(app.cam, window.innerWidth, window.innerHeight);
  }

  function newGame(seed) {
    app.world = RTS.game.create(seed);
    app.ai = RTS.ai.create(1 - app.human);
    app.cam = RTS.camera.create(app.world.map.width, app.world.map.height);
    app.selection = [];
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

  function click(id, handler) {
    document.getElementById(id).addEventListener('click', function (ev) {
      ev.currentTarget.blur();
      handler();
    });
  }

  click('btn-pause', app.togglePause);
  click('btn-help', app.toggleHelp);
  click('btn-restart', function () {
    if (window.confirm('放棄目前戰局，重新開始？')) app.restart();
  });
  click('overlay-primary', function () {
    if (app.world.over) app.restart(); else app.closeOverlay();
  });
  click('overlay-restart', app.restart);

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
