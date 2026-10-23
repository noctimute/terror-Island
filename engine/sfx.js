// Short sound effects made with Web Audio: picking up a gun, clicking Lumama, and one
// little sound per island. They only ever play from a click, which browsers allow.

let ctx = null,
  out = null,
  noiseBuf = null;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain();
    out.gain.value = 0.6;
    out.connect(ctx.destination);
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx.currentTime + 0.01;
}

// an oscillator sliding from f0 to f1, with a fast attack and an exponential fade
function tone({ type = "sine", f0, f1 = f0, at = 0, dur = 0.3, vol = 0.2, glide = dur }) {
  const t = ctx.currentTime + 0.01 + at,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

// a burst of filtered noise
function noise({ at = 0, dur = 0.2, vol = 0.2, type = "bandpass", freq = 1000, f1 = freq, q = 1 }) {
  const t = ctx.currentTime + 0.01 + at,
    s = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain();
  s.buffer = noiseBuf;
  s.loop = true;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (f1 !== freq) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

const thud = (at = 0, vol = 0.5) => tone({ f0: 140, f1: 40, at, dur: 0.35, vol, glide: 0.25 });

const ISLAND = {
  // 墜落島: a falling whistle, then the ground
  xitun() {
    tone({ f0: 1400, f1: 220, dur: 0.6, vol: 0.12 });
    thud(0.6);
    noise({ at: 0.6, dur: 0.15, vol: 0.2, type: "lowpass", freq: 600 });
  },
  // 漂浮島: bubbles rising through water
  oldtown() {
    [0, 0.12, 0.2, 0.34].forEach((at, i) => tone({ f0: 300 + i * 90, f1: 900 + i * 150, at, dur: 0.12, vol: 0.13 }));
  },
  // 氣爆火災島: a gas explosion
  beitun() {
    noise({ dur: 0.9, vol: 0.5, type: "lowpass", freq: 3000, f1: 120 });
    tone({ f0: 90, f1: 30, dur: 0.8, vol: 0.5 });
  },
  // 垃圾山太空包: rustling bulk bags
  houli() {
    for (let i = 0; i < 6; i++) noise({ at: i * 0.05 + Math.random() * 0.03, dur: 0.06, vol: 0.18, freq: 2500 + Math.random() * 2500, q: 2 });
  },
  // 廚餘湖: a heavy gloop
  dadu() {
    tone({ f0: 420, f1: 80, dur: 0.25, vol: 0.25 });
    tone({ f0: 300, f1: 70, at: 0.18, dur: 0.3, vol: 0.2 });
  },
  // 公安災害島: an alarm
  dali() {
    [0, 0.16, 0.32].forEach((at, i) => tone({ type: "square", f0: i % 2 ? 660 : 880, at, dur: 0.14, vol: 0.06 }));
  },
  // 食安島: oil sizzling in a pan
  fengyuan() {
    noise({ dur: 0.7, vol: 0.16, type: "highpass", freq: 4000 });
    for (let i = 0; i < 5; i++) noise({ at: Math.random() * 0.5, dur: 0.03, vol: 0.2, freq: 6000, q: 4 });
  },
  // 貪瀆島: a cash register
  daya() {
    noise({ dur: 0.05, vol: 0.3, freq: 2000, q: 3 });
    tone({ type: "triangle", f0: 2637, at: 0.08, dur: 0.6, vol: 0.12 });
    tone({ type: "triangle", f0: 3520, at: 0.08, dur: 0.5, vol: 0.06 });
  },
  // 國安島: a low, cold gong
  port() {
    [98, 147.5, 233, 311].forEach((f, i) => tone({ f0: f, dur: 1.4, vol: 0.18 / (i + 1) }));
  },
  // 無聲島: a quiet heartbeat
  shalu() {
    tone({ f0: 70, f1: 45, dur: 0.18, vol: 0.4 });
    tone({ f0: 65, f1: 42, at: 0.22, dur: 0.22, vol: 0.3 });
  },
  // 兒少島: three out-of-tune music-box notes
  xinshe() {
    [1046, 988, 784].forEach((f, i) => tone({ type: "triangle", f0: f * (1 + (Math.random() - 0.5) * 0.02), at: i * 0.22, dur: 0.7, vol: 0.1 }));
  },
  // 賣地島: the auction gavel
  dajia() {
    [0, 0.18].forEach((at) => {
      noise({ at, dur: 0.06, vol: 0.35, freq: 900, q: 6 });
      tone({ type: "triangle", f0: 720, f1: 500, at, dur: 0.08, vol: 0.15 });
    });
  },
  // 髒川島: a drip into dirty water
  dongshi() {
    tone({ f0: 500, f1: 1500, dur: 0.1, vol: 0.2, glide: 0.06 });
    tone({ f0: 500, f1: 1500, at: 0.3, dur: 0.1, vol: 0.06, glide: 0.06 });
  },
  // 標案島: coins sliding into a slot
  lishan() {
    [0, 0.07, 0.14].forEach((at, i) => tone({ f0: 2400 + i * 300, at, dur: 0.18, vol: 0.08 }));
    noise({ at: 0.22, dur: 0.12, vol: 0.12, freq: 3000, q: 2 });
  },
  // 詐騙島: a phone ringing
  guguan() {
    for (let k = 0; k < 2; k++)
      for (let i = 0; i < 8; i++) {
        tone({ f0: 440, at: k * 0.4 + i * 0.035, dur: 0.03, vol: 0.06 });
        tone({ f0: 480, at: k * 0.4 + i * 0.035, dur: 0.03, vol: 0.06 });
      }
  },
  // 毒駕島: tyres skidding into a crash
  taiping() {
    tone({ type: "sawtooth", f0: 900, f1: 600, dur: 0.45, vol: 0.05 });
    noise({ dur: 0.45, vol: 0.12, freq: 1800, q: 3 });
    noise({ at: 0.45, dur: 0.4, vol: 0.4, type: "lowpass", freq: 2500, f1: 200 });
    thud(0.45, 0.4);
  },
};

export const sfx = {
  island(id) {
    ac();
    (ISLAND[id] || ISLAND.shalu)();
  },
  // GTA-style pickup: a slide racking, then a bright rising chime; a short fanfare for the last one
  gun(done) {
    ac();
    noise({ dur: 0.04, vol: 0.35, freq: 3000, q: 2 });
    noise({ at: 0.08, dur: 0.05, vol: 0.3, freq: 1800, q: 2 });
    const notes = done ? [523, 659, 784, 1046, 1318] : [784, 1175];
    notes.forEach((f, i) => tone({ type: "square", f0: f, at: 0.14 + i * 0.08, dur: done ? 0.5 : 0.25, vol: 0.05 }));
  },
  // 重來: the magazine drops out, a new one clicks in, and the guns scatter again with a falling sweep
  reset() {
    ac();
    noise({ dur: 0.08, vol: 0.3, freq: 1200, q: 3 });
    tone({ type: "triangle", f0: 400, f1: 250, at: 0.02, dur: 0.12, vol: 0.12 });
    noise({ at: 0.22, dur: 0.05, vol: 0.35, freq: 2600, q: 3 });
    [1175, 988, 784, 659].forEach((f, i) => tone({ type: "square", f0: f, at: 0.32 + i * 0.06, dur: 0.18, vol: 0.04 }));
  },
  // 海邊的肉粽: waves sucking back, a low dissonant swell, a breath of whisper-noise and two slow heartbeats
  shore() {
    ac();
    noise({ dur: 1.6, vol: 0.18, type: "lowpass", freq: 900, f1: 200 });
    tone({ f0: 55, f1: 49, dur: 3.2, vol: 0.28, glide: 3 });
    tone({ type: "sawtooth", f0: 58.3, f1: 52, dur: 3.2, vol: 0.05, glide: 3 });
    tone({ type: "triangle", f0: 466, f1: 440, at: 0.5, dur: 2.4, vol: 0.04, glide: 2 });
    noise({ at: 0.9, dur: 1.4, vol: 0.06, freq: 2600, f1: 1400, q: 6 });
    thud(1.6, 0.35);
    thud(1.95, 0.25);
  },
  // pine tree: branches rustling, then a chainsaw revving up in the distance
  tree() {
    ac();
    for (let i = 0; i < 5; i++) noise({ at: i * 0.05, dur: 0.12, vol: 0.12, freq: 3500 + Math.random() * 2000, q: 1.5 });
    tone({ type: "sawtooth", f0: 70, f1: 140, at: 0.35, dur: 0.7, vol: 0.06, glide: 0.4 });
    tone({ type: "square", f0: 72, f1: 143, at: 0.35, dur: 0.7, vol: 0.03, glide: 0.4 });
    noise({ at: 0.35, dur: 0.7, vol: 0.05, freq: 900, q: 2 });
  },
  // Lumama: a slap on her drum and a shower of coins
  lumama() {
    ac();
    tone({ f0: 180, f1: 60, dur: 0.3, vol: 0.45, glide: 0.2 });
    noise({ dur: 0.05, vol: 0.2, freq: 1200 });
    for (let i = 0; i < 7; i++) {
      const at = 0.1 + i * 0.07 + Math.random() * 0.03;
      tone({ f0: 1976 + Math.random() * 400, at, dur: 0.22, vol: 0.07 });
      tone({ f0: 2637 + Math.random() * 400, at, dur: 0.15, vol: 0.04 });
    }
  },
};
