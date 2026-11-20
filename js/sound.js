// Nature sounds and little tap sounds, all made with the Web Audio API (no sound files).
// Ambient: running water near creeks/fountains, birds by day, crickets at night — only in the appreciate view.
// Effects: chime, bell, whoosh, splash, whistle, chirp. Browsers allow sound only after a tap, so
// start() is called from the [감상] button.
(function (root) {
  let ctx = null, master = null, enabled = true, running = false;
  let waterGain = null, noiseSrc = null, timers = [], info = () => ({ water: 0, night: 0 });

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const ok = () => enabled && ensure();

  function tone(freq, dur, { type = 'sine', vol = 0.12, when = 0, slide = null, attack = 0.01 } = {}) {
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); let b = 0;
      for (let i = 0; i < d.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; } // soft brown noise
    }
    return noiseBuf;
  }
  function burst(dur, { freq = 1200, q = 0.8, vol = 0.25, type = 'bandpass', sweep = null } = {}) {
    const t0 = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.05);
  }

  const PENTA = [523, 587, 659, 784, 880, 1047];
  const fx = {
    chime() { if (!ok()) return; const a = PENTA[Math.floor(Math.random() * 4)]; tone(a, 1.2, { type: 'triangle', vol: 0.09 }); tone(a * 1.5, 1.4, { type: 'sine', vol: 0.06, when: 0.12 }); },
    bell() { if (!ok()) return; [[1, 0.14], [2.0, 0.06], [2.76, 0.05], [5.4, 0.025]].forEach(([k, v]) => tone(392 * k, 3.2, { vol: v, attack: 0.005 })); },
    whoosh() { if (!ok()) return; burst(1.0, { freq: 300, sweep: 1800, vol: 0.2, q: 0.6 }); },
    splash() { if (!ok()) return; burst(0.6, { freq: 1500, sweep: 500, vol: 0.25, q: 0.5 }); for (let i = 0; i < 4; i++) tone(900 + Math.random() * 900, 0.12, { vol: 0.05, when: 0.1 + i * 0.07, slide: 1600 }); },
    whistle() { if (!ok()) return; tone(880, 0.35, { vol: 0.08 }); tone(1108, 0.5, { vol: 0.07, when: 0.25 }); },
    chirp() { if (!ok()) return; const base = 2400 + Math.random() * 1200; for (let i = 0; i < 3; i++) tone(base, 0.09, { vol: 0.05, when: i * 0.12, slide: base * 1.4 }); },
  };

  function schedule(fn, min, max) {
    const id = setTimeout(() => { if (!running) return; fn(); schedule(fn, min, max); }, min + Math.random() * (max - min));
    timers.push(id);
  }
  function start(getInfo) {
    if (getInfo) info = getInfo;
    if (!ok() || running) return;
    running = true;
    // water: looping soft noise, louder with more water in the village
    noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = noise(); noiseSrc.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    waterGain = ctx.createGain(); waterGain.gain.value = 0.0001;
    noiseSrc.connect(lp); lp.connect(waterGain); waterGain.connect(master); noiseSrc.start();
    const level = () => { if (!running) return; const i = info(); waterGain.gain.setTargetAtTime(Math.min(0.22, i.water * 0.025), ctx.currentTime, 1.2); };
    level(); timers.push(setInterval(level, 1500));
    // birds by day, crickets at night
    schedule(() => { if (info().night < 0.5) { const base = 2000 + Math.random() * 2000, n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) tone(base * (1 + (i % 2) * 0.12), 0.08 + Math.random() * 0.06, { vol: 0.035, when: i * 0.13, slide: base * 1.3 }); } }, 1800, 5200);
    schedule(() => { if (info().night >= 0.5) for (let i = 0; i < 6; i++) tone(4400, 0.035, { vol: 0.018, when: i * 0.06 }); }, 700, 1800);
  }
  function stop() {
    running = false;
    timers.forEach(id => { clearTimeout(id); clearInterval(id); }); timers = [];
    if (waterGain && ctx) { waterGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); const s = noiseSrc; setTimeout(() => { try { s.stop(); } catch (e) { /* already stopped */ } }, 1200); }
    noiseSrc = null; waterGain = null;
  }
  function setEnabled(b) { enabled = b; if (!b) stop(); }

  root.BV = root.BV || {};
  root.BV.Sound = { ...fx, start, stop, setEnabled, get enabled() { return enabled; } };
})(this);
