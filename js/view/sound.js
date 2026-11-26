// 音效播放：用 WebAudio 即時合成，不需要音檔。開關狀態記在瀏覽器。
(function () {
  'use strict';
  var RTS = globalThis.RTS || (globalThis.RTS = {});

  var STORAGE_KEY = 'lords-at-war.sound';
  var VOLUME = 0.35;

  // 每種聲音由幾段組成：noise 為濾波雜訊（敲擊感），其他為振盪器波形。
  // freq 起始頻率、to 結束頻率、at 延遲秒數、time 長度、gain 音量；gap 為同一種聲音的最短間隔（秒）
  var SOUNDS = {
    chop:   { gap: 0.22, parts: [{ wave: 'noise', freq: 700, time: 0.09, gain: 0.9 }, { wave: 'sine', freq: 180, to: 90, time: 0.09, gain: 0.5 }] },
    mine:   { gap: 0.22, parts: [{ wave: 'triangle', freq: 1500, to: 1300, time: 0.12, gain: 0.35 }, { wave: 'noise', freq: 2600, time: 0.04, gain: 0.5 }] },
    forage: { gap: 0.28, parts: [{ wave: 'noise', freq: 1800, time: 0.12, gain: 0.35 }] },
    hammer: { gap: 0.2, parts: [{ wave: 'square', freq: 320, to: 200, time: 0.06, gain: 0.25 }, { wave: 'noise', freq: 1200, time: 0.05, gain: 0.5 }] },
    melee:  { gap: 0.12, parts: [{ wave: 'noise', freq: 3200, time: 0.08, gain: 0.6 }, { wave: 'triangle', freq: 900, to: 500, time: 0.1, gain: 0.3 }] },
    arrow:  { gap: 0.12, parts: [{ wave: 'noise', freq: 4200, to: 1500, time: 0.14, gain: 0.35 }] },
    fall:   { gap: 0.25, parts: [{ wave: 'sawtooth', freq: 220, to: 60, time: 0.28, gain: 0.35 }] },
    alert:  { gap: 1, parts: [{ wave: 'square', freq: 660, time: 0.16, gain: 0.35 }, { wave: 'square', freq: 880, at: 0.19, time: 0.16, gain: 0.35 }, { wave: 'square', freq: 660, at: 0.38, time: 0.22, gain: 0.35 }] }
  };

  // env.storage：回傳 localStorage 的函式；env.AudioContext：瀏覽器的建構子（沒有就靜音）
  function create(env) {
    var on = true, audio = null, noise = null, last = {};
    var events = RTS.soundEvents.create();
    try { on = env.storage().getItem(STORAGE_KEY) !== 'off'; } catch (e) { on = true; }

    // 瀏覽器要等使用者操作過才能出聲，由第一次點擊或按鍵呼叫
    function unlock() {
      if (!on || !env.AudioContext) return;
      if (!audio) {
        audio = new env.AudioContext();
        noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.5), audio.sampleRate);
        var samples = noise.getChannelData(0);
        for (var i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      if (audio.state === 'suspended') audio.resume();
    }

    function ramp(param, from, to, start, end) {
      param.setValueAtTime(from, start);
      if (to && to !== from) param.exponentialRampToValueAtTime(to, end);
    }

    function voice(part) {
      var start = audio.currentTime + (part.at || 0), end = start + part.time;
      var gain = audio.createGain();
      ramp(gain.gain, part.gain * VOLUME, 0.001, start, end);
      gain.connect(audio.destination);
      var source;
      if (part.wave === 'noise') {
        source = audio.createBufferSource();
        source.buffer = noise;
        var filter = audio.createBiquadFilter();
        filter.type = 'bandpass';
        ramp(filter.frequency, part.freq, part.to, start, end);
        source.connect(filter);
        filter.connect(gain);
      } else {
        source = audio.createOscillator();
        source.type = part.wave;
        ramp(source.frequency, part.freq, part.to, start, end);
        source.connect(gain);
      }
      source.start(start);
      source.stop(end);
    }

    function play(name) {
      var sound = SOUNDS[name];
      if (!on || !audio || audio.state !== 'running' || !sound) return false;
      if (last[name] !== undefined && audio.currentTime - last[name] < sound.gap) return false;
      last[name] = audio.currentTime;
      sound.parts.forEach(voice);
      return true;
    }

    function toggle() {
      on = !on;
      try { env.storage().setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch (e) { /* 僅本次有效 */ }
      unlock();
      return on;
    }

    return {
      enabled: function () { return on; },
      toggle: toggle, unlock: unlock, play: play,
      frame: function (app) { events.collect(app).forEach(play); }
    };
  }

  RTS.sound = { create: create, SOUNDS: SOUNDS, STORAGE_KEY: STORAGE_KEY };
})();
