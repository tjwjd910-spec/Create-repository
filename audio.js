/* =========================================================================
 *  던전 크루세이더 — audio.js
 *  Web Audio API 로 만드는 칩튠 BGM + 효과음 (외부 오디오 파일 없음)
 * ========================================================================= */
(function () {
  "use strict";
  const G = (window.G = window.G || {});

  const A = {
    ctx: null,
    master: null,
    bgmBus: null,
    sfxBus: null,
    enabled: true,
    unlocked: false,
    ready: false,
  };

  let noiseBuf = null;
  const state = {
    name: null,
    step: 0,
    nextTime: 0,
    timer: null,
    track: null,
  };

  /* ---------------------------------------------------------------- setup */
  function makeNoise(ctx) {
    const len = Math.floor(ctx.sampleRate * 1.0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function ensure() {
    if (A.ctx) return A.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = A.enabled ? 0.85 : 0;
      master.connect(ctx.destination);
      const bgm = ctx.createGain();
      bgm.gain.value = 0.0;
      bgm.connect(master);
      const sfx = ctx.createGain();
      sfx.gain.value = 0.9;
      sfx.connect(master);
      A.ctx = ctx;
      A.master = master;
      A.bgmBus = bgm;
      A.sfxBus = sfx;
      noiseBuf = makeNoise(ctx);
      A.ready = true;
      return ctx;
    } catch (e) {
      A.ready = false;
      return null;
    }
  }

  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  /* ------------------------------------------------------------- voicing */
  function tone(midi, start, dur, opt) {
    const ctx = A.ctx;
    if (!ctx) return;
    opt = opt || {};
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opt.wave || "square";
    osc.frequency.setValueAtTime(freq(midi), start);
    if (opt.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq(opt.slideTo)), start + dur);
    const peak = opt.gain == null ? 0.2 : opt.gain;
    const atk = opt.attack == null ? 0.008 : opt.attack;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let node = g;
    if (opt.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opt.filter;
      f.frequency.setValueAtTime(opt.cut || 1200, start);
      if (opt.cutTo) f.frequency.exponentialRampToValueAtTime(opt.cutTo, start + dur);
      f.Q.value = opt.q == null ? 1 : opt.q;
      g.connect(f);
      node = f;
    }
    osc.connect(g);
    node.connect(opt.bus || A.bgmBus || A.master);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  function noise(start, dur, opt) {
    const ctx = A.ctx;
    if (!ctx || !noiseBuf) return;
    opt = opt || {};
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = opt.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = opt.filter || "bandpass";
    f.frequency.setValueAtTime(opt.hz || 1800, start);
    if (opt.hzTo) f.frequency.exponentialRampToValueAtTime(opt.hzTo, start + dur);
    f.Q.value = opt.q == null ? 0.9 : opt.q;
    const g = ctx.createGain();
    const peak = opt.gain == null ? 0.18 : opt.gain;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f);
    f.connect(g);
    g.connect(opt.bus || A.sfxBus || A.master);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  function kick(start, gain) {
    tone(45, start, 0.16, { wave: "sine", gain: gain == null ? 0.32 : gain, slideTo: 30, bus: A.bgmBus });
    noise(start, 0.05, { filter: "lowpass", hz: 400, hzTo: 120, gain: 0.1, bus: A.bgmBus });
  }

  /* ---------------------------------------------------------------- tracks */
  // 스텝 = 16분음표. 32스텝 루프(2마디)
  const TRACKS = {
    field: {
      bpm: 142,
      leadWave: "square",
      leadGain: 0.1,
      bass: [
        48, 0, 48, 0, 48, 0, 55, 0, 45, 0, 45, 0, 45, 0, 52, 0,
        41, 0, 41, 0, 41, 0, 48, 0, 43, 0, 43, 0, 50, 0, 55, 0,
      ],
      lead: [
        72, 0, 76, 79, 0, 76, 72, 0, 69, 0, 72, 76, 0, 72, 69, 0,
        65, 0, 69, 72, 0, 72, 74, 0, 74, 0, 71, 67, 0, 62, 67, 0,
      ],
      // 0=없음, k=킥, h=하이햇, s=스네어
      drum: [
        "k", "h", "", "h", "k", "h", "", "s", "k", "h", "", "h", "k", "h", "", "s",
        "k", "h", "", "h", "k", "h", "", "s", "k", "h", "", "h", "k", "h", "s", "s",
      ],
      pad: { 0: [60, 64, 67], 16: [57, 60, 64] },
    },
    dungeon: {
      bpm: 104,
      leadWave: "sawtooth",
      leadGain: 0.085,
      bass: [
        38, 0, 38, 38, 0, 38, 39, 0, 34, 0, 34, 34, 0, 34, 33, 0,
        31, 0, 31, 31, 0, 31, 32, 0, 36, 0, 36, 39, 0, 32, 33, 0,
      ],
      lead: [
        62, 0, 0, 65, 0, 0, 68, 0, 65, 0, 0, 62, 0, 0, 61, 0,
        0, 0, 58, 0, 61, 0, 64, 0, 62, 0, 0, 0, 56, 0, 61, 0,
      ],
      drum: [
        "k", "", "", "h", "", "", "k", "", "k", "", "", "h", "", "s", "", "",
        "k", "", "", "h", "", "", "k", "", "k", "", "s", "", "k", "", "s", "",
      ],
      pad: { 0: [50, 53, 57], 16: [46, 50, 53] },
    },
  };

  function scheduleStep(tr, i, t) {
    const spb = 60 / tr.bpm / 4;
    const b = tr.bass[i];
    if (b) tone(b, t, spb * 1.35, { wave: "triangle", gain: 0.24, bus: A.bgmBus, filter: "lowpass", cut: 900 });
    const l = tr.lead[i];
    if (l) {
      tone(l, t, spb * 1.7, { wave: tr.leadWave, gain: tr.leadGain, bus: A.bgmBus, filter: "lowpass", cut: 3200 });
      tone(l + 12, t, spb * 0.9, { wave: "triangle", gain: tr.leadGain * 0.35, bus: A.bgmBus });
    }
    if (tr.pad && tr.pad[i]) {
      tr.pad[i].forEach((n, k) =>
        tone(n + 12, t, spb * 7, { wave: "triangle", gain: 0.045, attack: 0.08, bus: A.bgmBus })
      );
    }
    const d = tr.drum[i];
    if (d === "k") kick(t);
    else if (d === "h") noise(t, 0.035, { filter: "highpass", hz: 7000, gain: 0.05, bus: A.bgmBus });
    else if (d === "s") noise(t, 0.09, { filter: "bandpass", hz: 2200, q: 0.7, gain: 0.09, bus: A.bgmBus });
  }

  function tick() {
    const ctx = A.ctx;
    if (!ctx || !state.track || !A.enabled) return;
    const tr = state.track;
    const spb = 60 / tr.bpm / 4;
    while (state.nextTime < ctx.currentTime + 0.16) {
      scheduleStep(tr, state.step, Math.max(state.nextTime, ctx.currentTime + 0.02));
      state.step = (state.step + 1) % 32;
      state.nextTime += spb;
    }
  }

  function startLoop() {
    const ctx = A.ctx;
    if (!ctx || !state.track) return;
    if (state.timer) return;
    state.nextTime = ctx.currentTime + 0.06;
    state.timer = setInterval(tick, 40);
  }

  function stopLoop() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  /* ------------------------------------------------------------------ API */
  A.unlock = function () {
    const ctx = ensure();
    if (!ctx) return false;
    A.unlocked = true;
    if (ctx.state === "suspended") ctx.resume();
    if (A.enabled) {
      A.bgm(state.name || "field");
    }
    return true;
  };

  A.setEnabled = function (on, silent) {
    A.enabled = !!on;
    const ctx = A.ctx;
    if (ctx) {
      const t = ctx.currentTime;
      A.master.gain.cancelScheduledValues(t);
      A.master.gain.setValueAtTime(A.master.gain.value, t);
      A.master.gain.linearRampToValueAtTime(A.enabled ? 0.85 : 0, t + 0.15);
      if (!A.enabled) stopLoop();
      else if (state.track) startLoop();
    }
    if (!silent) A.sfx(A.enabled ? "on" : "off");
    return A.enabled;
  };

  A.toggle = function () {
    A.unlock();
    return A.setEnabled(!A.enabled);
  };

  A.bgm = function (name) {
    const ctx = ensure();
    if (!ctx) return;
    state.name = name;
    if (!A.enabled) return;
    const tr = TRACKS[name];
    if (!tr) {
      stopLoop();
      state.track = null;
      return;
    }
    if (state.track === tr && A.bgmBus.gain.value > 0.001) return;
    const t = ctx.currentTime;
    A.bgmBus.gain.cancelScheduledValues(t);
    A.bgmBus.gain.setValueAtTime(A.bgmBus.gain.value, t);
    A.bgmBus.gain.linearRampToValueAtTime(0.0, t + 0.12);
    state.track = tr;
    state.step = 0;
    stopLoop();
    setTimeout(() => {
      if (!A.ctx || !A.enabled || state.track !== tr) return;
      const t2 = A.ctx.currentTime;
      A.bgmBus.gain.cancelScheduledValues(t2);
      A.bgmBus.gain.setValueAtTime(0.0001, t2);
      A.bgmBus.gain.linearRampToValueAtTime(0.45, t2 + 0.35);
      startLoop();
    }, 140);
  };

  A.pauseBgm = function () {
    stopLoop();
    if (A.ctx && A.bgmBus) A.bgmBus.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.05);
  };

  A.resumeBgm = function () {
    if (!A.enabled || !A.ctx || !state.track) return;
    A.bgmBus.gain.setTargetAtTime(0.45, A.ctx.currentTime, 0.08);
    startLoop();
  };

  /* ------------------------------------------------------------------ SFX */
  /* --------------- 효과음용 헬퍼 : Hz 를 MIDI 로 변환해 tone() 에 전달 --------------- */
  const midiOf = (hz) => 69 + 12 * Math.log2(hz / 440);
  function toneHz(hz, start, dur, opt) {
    opt = opt || {};
    const o = Object.assign({}, opt);
    if (o.slideTo) o.slideTo = midiOf(o.slideTo);
    tone(midiOf(hz), start, dur, o);
  }

  const SFX = {
    click(start) {
      toneHz(1046, start, 0.05, { wave: "square", gain: 0.06, bus: A.sfxBus });
    },
    swing(start) {
      noise(start, 0.13, { filter: "highpass", hz: 2400, hzTo: 900, gain: 0.13 });
    },
    hit(start) {
      noise(start, 0.1, { filter: "lowpass", hz: 2600, hzTo: 400, gain: 0.16 });
      toneHz(150, start, 0.1, { wave: "sine", gain: 0.16, slideTo: 70, bus: A.sfxBus });
      // 묵직한 서브베이스 펀치
      toneHz(70, start, 0.16, { wave: "sine", gain: 0.26, slideTo: 38, bus: A.sfxBus });
      noise(start + 0.01, 0.06, { filter: "lowpass", hz: 320, gain: 0.12 });
    },
    crit(start) {
      noise(start, 0.16, { filter: "bandpass", hz: 3000, hzTo: 900, gain: 0.2, q: 0.6 });
      toneHz(1320, start, 0.12, { wave: "square", gain: 0.09, bus: A.sfxBus });
      toneHz(1760, start + 0.05, 0.14, { wave: "triangle", gain: 0.08, bus: A.sfxBus });
      toneHz(160, start, 0.12, { wave: "sine", gain: 0.16, slideTo: 60, bus: A.sfxBus });
      // 크래시 + 서브 펀치로 치명타를 더 묵직하게
      toneHz(62, start, 0.24, { wave: "sine", gain: 0.34, slideTo: 30, bus: A.sfxBus });
      noise(start, 0.3, { filter: "highpass", hz: 2600, hzTo: 7000, gain: 0.09 });
    },
    smash(start) {
      toneHz(110, start, 0.2, { wave: "sawtooth", gain: 0.18, slideTo: 45, bus: A.sfxBus, filter: "lowpass", cut: 900 });
      noise(start, 0.22, { filter: "lowpass", hz: 1800, hzTo: 200, gain: 0.2 });
      toneHz(55, start, 0.3, { wave: "sine", gain: 0.32, slideTo: 24, bus: A.sfxBus });
    },
    flame(start) {
      noise(start, 0.38, { filter: "bandpass", hz: 500, hzTo: 2200, q: 0.5, gain: 0.22 });
      toneHz(320, start, 0.3, { wave: "sawtooth", gain: 0.06, slideTo: 180, bus: A.sfxBus });
      toneHz(58, start, 0.26, { wave: "sine", gain: 0.22, slideTo: 32, bus: A.sfxBus });
    },
    ult(start) {
      // 상승 스윕 → 성광 코드 → 저음 폭발
      toneHz(392, start, 0.34, { wave: "sawtooth", gain: 0.1, slideTo: 1568, bus: A.sfxBus, filter: "lowpass", cut: 900, cutTo: 6000 });
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
        toneHz(f, start + 0.16 + i * 0.012, 0.72, { wave: "triangle", gain: 0.075, bus: A.sfxBus });
        toneHz(f * 2, start + 0.16 + i * 0.012, 0.5, { wave: "sine", gain: 0.04, bus: A.sfxBus });
      });
      noise(start + 0.14, 0.5, { filter: "highpass", hz: 1400, hzTo: 8000, gain: 0.14 });
      toneHz(46, start + 0.16, 0.72, { wave: "sine", gain: 0.42, slideTo: 22, bus: A.sfxBus });
      noise(start + 0.16, 0.55, { filter: "lowpass", hz: 900, hzTo: 120, gain: 0.22 });
    },
    combo(start) {
      toneHz(880, start, 0.06, { wave: "square", gain: 0.05, bus: A.sfxBus });
      toneHz(1320, start + 0.035, 0.07, { wave: "square", gain: 0.045, bus: A.sfxBus });
    },
    shield(start) {
      toneHz(440, start, 0.2, { wave: "triangle", gain: 0.1, slideTo: 880, bus: A.sfxBus });
      noise(start, 0.24, { filter: "bandpass", hz: 900, hzTo: 2600, gain: 0.09, q: 1.4 });
    },
    shieldBreak(start) {
      noise(start, 0.26, { filter: "highpass", hz: 2200, hzTo: 6000, gain: 0.2 });
      toneHz(1180, start, 0.18, { wave: "square", gain: 0.1, slideTo: 520, bus: A.sfxBus });
      toneHz(60, start, 0.24, { wave: "sine", gain: 0.3, slideTo: 26, bus: A.sfxBus });
    },
    elite(start) {
      toneHz(196, start, 0.28, { wave: "sawtooth", gain: 0.13, slideTo: 294, bus: A.sfxBus, filter: "lowpass", cut: 1200 });
      toneHz(392, start + 0.1, 0.22, { wave: "square", gain: 0.06, bus: A.sfxBus });
    },
    mimic(start) {
      toneHz(330, start, 0.12, { wave: "square", gain: 0.09, slideTo: 660, bus: A.sfxBus });
      noise(start + 0.1, 0.2, { filter: "bandpass", hz: 1800, hzTo: 600, gain: 0.14, q: 2 });
    },
    goldgoblin(start) {
      [784, 988, 1175, 1568].forEach((f, i) => toneHz(f, start + i * 0.06, 0.16, { wave: "triangle", gain: 0.08, bus: A.sfxBus }));
      noise(start, 0.18, { filter: "highpass", hz: 4000, gain: 0.07 });
    },
    quest(start) {
      [659, 880, 1175].forEach((f, i) => toneHz(f, start + i * 0.07, 0.16, { wave: "square", gain: 0.07, bus: A.sfxBus }));
      toneHz(1568, start + 0.22, 0.26, { wave: "triangle", gain: 0.07, bus: A.sfxBus });
    },
    guard(start) {
      toneHz(1568, start, 0.18, { wave: "triangle", gain: 0.11, bus: A.sfxBus });
      toneHz(2093, start + 0.02, 0.2, { wave: "sine", gain: 0.07, bus: A.sfxBus });
      noise(start, 0.12, { filter: "highpass", hz: 4000, gain: 0.07 });
    },
    counter(start) {
      noise(start, 0.14, { filter: "bandpass", hz: 2800, hzTo: 1200, gain: 0.15 });
      toneHz(880, start, 0.1, { wave: "square", gain: 0.08, bus: A.sfxBus });
    },
    hurt(start) {
      toneHz(300, start, 0.14, { wave: "square", gain: 0.1, slideTo: 120, bus: A.sfxBus });
      noise(start, 0.1, { filter: "lowpass", hz: 1200, gain: 0.1 });
    },
    potion(start) {
      [523, 659, 784, 1047].forEach((f, i) => {
        toneHz(f, start + i * 0.055, 0.16, { wave: "sine", gain: 0.1, bus: A.sfxBus });
      });
    },
    coin(start) {
      toneHz(988, start, 0.07, { wave: "square", gain: 0.06, bus: A.sfxBus });
      toneHz(1319, start + 0.06, 0.1, { wave: "square", gain: 0.05, bus: A.sfxBus });
    },
    drop(start) {
      [1047, 1319, 1568, 2093].forEach((f, i) => {
        toneHz(f, start + i * 0.05, 0.24, { wave: "triangle", gain: 0.075, bus: A.sfxBus });
      });
    },
    levelup(start) {
      const seq = [523, 659, 784, 1047, 1319];
      seq.forEach((f, i) => toneHz(f, start + i * 0.075, 0.3, { wave: "square", gain: 0.075, bus: A.sfxBus }));
      toneHz(1047, start + 0.4, 0.5, { wave: "triangle", gain: 0.08, bus: A.sfxBus });
    },
    clear(start) {
      const seq = [523, 659, 784, 1047, 784, 1047, 1319];
      seq.forEach((f, i) => {
        toneHz(f, start + i * 0.11, 0.34, { wave: "square", gain: 0.07, bus: A.sfxBus });
        toneHz(f / 2, start + i * 0.11, 0.3, { wave: "triangle", gain: 0.05, bus: A.sfxBus });
      });
      noise(start + 0.75, 0.5, { filter: "highpass", hz: 3000, gain: 0.06 });
    },
    boss(start) {
      toneHz(98, start, 0.5, { wave: "sawtooth", gain: 0.12, slideTo: 74, bus: A.sfxBus, filter: "lowpass", cut: 700 });
      toneHz(147, start + 0.1, 0.4, { wave: "square", gain: 0.05, bus: A.sfxBus });
    },
    on(start) {
      toneHz(660, start, 0.06, { wave: "square", gain: 0.06, bus: A.sfxBus });
      toneHz(990, start + 0.06, 0.08, { wave: "square", gain: 0.05, bus: A.sfxBus });
    },
    off(start) {
      toneHz(440, start, 0.07, { wave: "square", gain: 0.06, bus: A.sfxBus });
      toneHz(330, start + 0.06, 0.09, { wave: "square", gain: 0.05, bus: A.sfxBus });
    },
  };

  A.sfx = function (name) {
    if (!A.enabled) return;
    const ctx = ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const fn = SFX[name];
    if (!fn) return;
    try {
      fn(Math.max(ctx.currentTime, 0.001) + 0.005);
    } catch (e) {}
  };

  // 첫 터치/클릭에서 AudioContext 잠금 해제 (모바일 브라우저 정책)
  function unlockOnce() {
    A.unlock();
    if (A.unlocked) {
      document.removeEventListener("pointerdown", unlockOnce, true);
      document.removeEventListener("touchstart", unlockOnce, true);
      document.removeEventListener("keydown", unlockOnce, true);
      document.removeEventListener("click", unlockOnce, true);
    }
  }
  document.addEventListener("pointerdown", unlockOnce, true);
  document.addEventListener("touchstart", unlockOnce, true);
  document.addEventListener("keydown", unlockOnce, true);
  document.addEventListener("click", unlockOnce, true);

  document.addEventListener("visibilitychange", () => {
    if (!A.ctx) return;
    if (document.hidden) A.pauseBgm();
    else if (A.enabled) A.resumeBgm();
  });

  G.Audio = A;
  window.GameAudio = A;
})();
