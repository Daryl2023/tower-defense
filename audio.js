"use strict";

// ============================================================
// 音效系统（R12）：Web Audio 程序化合成音效 + BGM。零依赖。
// 详见 docs/audio-system.md。挂载到 window.Sfx 供 game.js 调用。
// 不可命名为 window.Audio（与浏览器内置构造器冲突）。
// ============================================================

const Sfx = (function () {
  let ctx = null;
  let master = null, sfxGain = null, musicGain = null;
  let muted = false;
  let started = false;        // AudioContext 是否已创建
  const lastPlay = {};        // 各音效名上次播放时间（节流）
  let activeVoices = 0;       // 全局活跃 voice 计数（复音上限）
  const MAX_VOICES = 14;

  const AUDIO_KEY = "sgtd_audio";

  // ---- 可替换资源钩子（仿 sprites）：url 非空则播放采样，否则程序化 ----
  const SFX_ASSETS = {};       // 例: { fire_archer: { url: "assets/sfx/arrow.wav", _buf: null } }

  // ---- 静音偏好持久化（与游戏存档解耦）----
  function loadPref() {
    try { const s = JSON.parse(localStorage.getItem(AUDIO_KEY)); if (s && typeof s.muted === "boolean") muted = s.muted; }
    catch (e) { /* 忽略 */ }
  }
  function savePref() {
    try { localStorage.setItem(AUDIO_KEY, JSON.stringify({ muted })); } catch (e) { /* 忽略 */ }
  }

  function init() {
    if (started) { if (ctx && ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 1.0; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);
    started = true;
    if (ctx.state === "suspended") ctx.resume();
  }

  function now() { return ctx ? ctx.currentTime : 0; }
  function canPlay(name, minGap) {
    if (!started || muted || !ctx) return false;
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    if (minGap && lastPlay[name] != null && t - lastPlay[name] < minGap) return false;
    if (activeVoices >= MAX_VOICES) return false;
    lastPlay[name] = t;
    return true;
  }

  // ---- 合成基元 ----
  function env(gainNode, t, peak, attack, dur, decayTo) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
    g.exponentialRampToValueAtTime(Math.max(0.0001, decayTo != null ? decayTo : 0.0001), t + dur);
  }
  function voice(node, t, dur) {
    activeVoices++;
    node.start(t);
    node.stop(t + dur + 0.02);
    node.onended = () => { activeVoices = Math.max(0, activeVoices - 1); };
  }
  // 单音（可滑音）
  function tone(t, freq, dur, opts = {}) {
    const o = ctx.createOscillator();
    o.type = opts.type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t + dur);
    const g = ctx.createGain();
    env(g, t, opts.gain != null ? opts.gain : 0.3, opts.attack || 0.005, dur, opts.decayTo);
    o.connect(g); g.connect(opts.dest || sfxGain);
    voice(o, t, dur);
    return o;
  }
  // 噪声（带滤波）
  let _noiseBuf = null;
  function noiseBuffer() {
    if (_noiseBuf) return _noiseBuf;
    const len = Math.floor((ctx.sampleRate || 44100) * 0.5);
    _noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate || 44100);
    const d = _noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return _noiseBuf;
  }
  function noise(t, dur, opts = {}) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = opts.filter || "bandpass";
    f.frequency.setValueAtTime(opts.freq || 1200, t);
    if (opts.slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, opts.slideTo), t + dur);
    f.Q.value = opts.q || 1;
    const g = ctx.createGain();
    env(g, t, opts.gain != null ? opts.gain : 0.25, opts.attack || 0.002, dur, opts.decayTo);
    s.connect(f); f.connect(g); g.connect(opts.dest || sfxGain);
    voice(s, t, dur);
  }
  function arp(t, freqs, step, opts = {}) {
    freqs.forEach((fr, i) => tone(t + i * step, fr, opts.dur || step * 1.6, {
      type: opts.type || "triangle", gain: opts.gain != null ? opts.gain : 0.22, attack: 0.005,
    }));
  }

  // ---- 音效定义（name → 合成函数）----
  const GAP = {
    ui: 0.04, recruit: 0.12, place: 0.08, upgrade: 0.08,
    fire_archer: 0.07, fire_spear: 0.07, fire_strategist: 0.08,
    kill: 0.05, crit: 0.06, execute: 0.06, castle_hit: 0.06,
  };
  const SOUNDS = {
    ui(t)            { tone(t, 660, 0.05, { type: "square", gain: 0.12 }); },
    recruit(t)       { arp(t, [392, 523, 659, 784], 0.06, { gain: 0.18 }); },
    place(t)         { tone(t, 180, 0.12, { type: "triangle", gain: 0.25, slideTo: 120 }); noise(t, 0.08, { freq: 600, gain: 0.1 }); },
    upgrade(t)       { tone(t, 523, 0.1, { type: "triangle", gain: 0.22 }); tone(t + 0.07, 784, 0.14, { type: "triangle", gain: 0.22 }); },
    fire_archer(t)   { noise(t, 0.09, { filter: "highpass", freq: 1800, gain: 0.12, slideTo: 3000 }); tone(t, 900, 0.05, { type: "sine", gain: 0.06 }); },
    fire_spear(t)    { tone(t, 320, 0.07, { type: "square", gain: 0.14, slideTo: 160 }); noise(t, 0.05, { freq: 2400, gain: 0.08 }); },
    fire_strategist(t){ tone(t, 520, 0.16, { type: "sawtooth", gain: 0.13, slideTo: 130 }); },
    kill(t)          { tone(t, 240, 0.12, { type: "triangle", gain: 0.18, slideTo: 90 }); noise(t, 0.1, { freq: 800, gain: 0.12, slideTo: 300 }); },
    crit(t)          { tone(t, 1040, 0.09, { type: "sine", gain: 0.2 }); tone(t + 0.04, 1560, 0.1, { type: "sine", gain: 0.16 }); },
    execute(t)       { noise(t, 0.12, { filter: "highpass", freq: 2600, gain: 0.2, slideTo: 400 }); tone(t, 200, 0.14, { type: "sawtooth", gain: 0.16, slideTo: 70 }); },
    skill_fire(t)    { tone(t, 110, 0.5, { type: "sawtooth", gain: 0.3, slideTo: 50 }); noise(t, 0.5, { filter: "lowpass", freq: 1600, gain: 0.28, slideTo: 300 }); noise(t + 0.05, 0.4, { freq: 2200, gain: 0.12 }); },
    skill_fort(t)    { noise(t, 0.6, { filter: "bandpass", freq: 400, gain: 0.18, slideTo: 1800, q: 0.7 }); tone(t, 300, 0.6, { type: "sine", gain: 0.1, slideTo: 600 }); },
    castle_hit(t)    { tone(t, 90, 0.3, { type: "square", gain: 0.3, slideTo: 60 }); tone(t, 96, 0.3, { type: "sawtooth", gain: 0.12, slideTo: 64 }); noise(t, 0.2, { filter: "lowpass", freq: 400, gain: 0.2 }); },
    wave_start(t)    { tone(t, 147, 0.4, { type: "sawtooth", gain: 0.22 }); tone(t + 0.18, 196, 0.5, { type: "sawtooth", gain: 0.22 }); noise(t, 0.3, { filter: "lowpass", freq: 220, gain: 0.18 }); },
    win(t)           { arp(t, [523, 659, 784, 1047, 1319], 0.11, { gain: 0.24, dur: 0.4 }); },
    lose(t)          { tone(t, 330, 0.3, { type: "triangle", gain: 0.22, slideTo: 247 }); tone(t + 0.25, 247, 0.4, { type: "triangle", gain: 0.22, slideTo: 165 }); },
  };

  function play(name, opts) {
    const minGap = GAP[name] || 0;
    if (!canPlay(name, minGap)) return;
    // 可替换采样优先（若已加载 buffer）
    const a = SFX_ASSETS[name];
    if (a && a._buf) { playBuffer(a._buf); return; }
    const fn = SOUNDS[name];
    if (fn) { try { fn(now() + 0.001); } catch (e) { /* 合成异常不应影响游戏 */ } }
  }
  function playBuffer(buf) {
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.8;
    s.connect(g); g.connect(sfxGain);
    voice(s, now(), buf.duration);
  }

  // ---- BGM：五声音阶（宫调 C D E G A）程序化循环 + lookahead 调度 ----
  const SCALE = [261.63, 293.66, 329.63, 392.00, 440.00]; // C D E G A
  const BASS = [130.81, 130.81, 196.00, 174.61];          // C C G F 走向
  let musicOn = false, schedTimer = null, nextNoteTime = 0, step16 = 0;
  const BPM = 76, SPB = 60 / BPM, STEP = SPB / 2; // 八分音符

  function scheduleNote(t) {
    // 每拍贝斯
    if (step16 % 4 === 0) {
      const b = BASS[(step16 / 4) % BASS.length];
      tone(t, b, SPB * 1.4, { type: "triangle", gain: 0.16, dest: musicGain });
    }
    // 稀疏主旋（伪随机但可循环：用步进索引选音）
    if (step16 % 2 === 0) {
      const oct = step16 % 16 < 8 ? 1 : 2;   // 后半小节升八度，制造起伏
      tone(t, SCALE[(step16 * 3 + 2) % SCALE.length] * oct, STEP * 1.2,
        { type: "sine", gain: 0.09, dest: musicGain });
    }
    // 衬底（每两小节一个长音）
    if (step16 % 16 === 0) {
      tone(t, SCALE[0] / 2, SPB * 4, { type: "sine", gain: 0.06, dest: musicGain });
    }
    step16 = (step16 + 1) % 64;
  }
  function scheduler() {
    if (!ctx) return;
    while (nextNoteTime < ctx.currentTime + 0.1) {
      scheduleNote(nextNoteTime);
      nextNoteTime += STEP;
    }
  }
  function startMusic() {
    if (!started || musicOn || !ctx) return;
    musicOn = true; step16 = 0; nextNoteTime = ctx.currentTime + 0.05;
    if (musicGain) musicGain.gain.setTargetAtTime(0.35, ctx.currentTime, 0.3);
    schedTimer = setInterval(scheduler, 25);
  }
  function stopMusic() {
    musicOn = false;
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  }
  function duckMusic(on) {
    if (musicGain && ctx) musicGain.gain.setTargetAtTime(on ? 0.12 : 0.35, ctx.currentTime, 0.2);
  }

  // ---- 静音开关 ----
  function setMuted(m) {
    muted = m; savePref();
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
  }
  function toggle() { setMuted(!muted); return muted; }
  function isMuted() { return muted; }

  loadPref();

  return {
    init, play, startMusic, stopMusic, duckMusic, setMuted, toggle, isMuted,
    SFX_ASSETS,
    get _state() { return ctx ? ctx.state : "none"; },
    get _started() { return started; },
    get _voices() { return activeVoices; },
    get _musicOn() { return musicOn; },
  };
})();

window.Sfx = Sfx;
