// Background music made on the fly with Web Audio, so no audio file or licence is needed:
// a low detuned drone, a slow out-of-tune music box in a minor key, and gusts of wind.
// Browsers only allow sound after a user gesture, so it starts from the toolbar button.

const KEY = "terror-island-music";

export function createMusic(button) {
  let ctx = null,
    master = null,
    timer = null,
    on = false;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // a short feedback delay gives the music box an empty-hall echo
    const delay = ctx.createDelay(1.5),
      fb = ctx.createGain(),
      wet = ctx.createGain();
    delay.delayTime.value = 0.42;
    fb.gain.value = 0.42;
    wet.gain.value = 0.5;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(master);

    // drone: two slightly detuned saws through a slowly breathing low-pass
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    const dg = ctx.createGain();
    dg.gain.value = 0.11;
    lp.connect(dg).connect(master);
    for (const [f, d] of [
      [55, -7],
      [55, 6],
      [82.4, 3],
    ]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator(),
      lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();

    // wind: filtered noise whose level drifts
    const len = ctx.sampleRate * 3,
      buf = ctx.createBuffer(1, len, ctx.sampleRate),
      data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500;
    bp.Q.value = 0.7;
    const wg = ctx.createGain();
    wg.gain.value = 0.02;
    noise.connect(bp).connect(wg).connect(master);
    noise.start();
    const wl = ctx.createOscillator(),
      wlg = ctx.createGain();
    wl.frequency.value = 0.09;
    wlg.gain.value = 0.018;
    wl.connect(wlg).connect(wg.gain);
    wl.start();

    // music box: A minor with a flattened second for unease, a little out of tune
    const scale = [440, 466.2, 523.3, 587.3, 659.3, 698.5, 830.6, 880];
    let step = 0;
    const phrase = [0, 2, 4, 7, 6, 4, 2, 1, 0, 4, 2, 5, 4, 1, 0, -1];
    function note(freq, t) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      o.detune.value = (Math.random() - 0.5) * 18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 1.8);
      o.connect(g);
      g.connect(master);
      g.connect(delay);
      o.start(t);
      o.stop(t + 2);
    }
    timer = setInterval(() => {
      if (!on) return;
      const i = phrase[step % phrase.length];
      step++;
      if (i < 0 || Math.random() < 0.12) return; // rests, and the odd missing note
      note(scale[i] / 2, ctx.currentTime + 0.05);
    }, 720);
  }

  function set(v) {
    on = v;
    if (on && !ctx) build();
    if (ctx) {
      if (on) ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.6);
    }
    button?.setAttribute("aria-pressed", String(on));
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {}
  }

  button?.addEventListener("click", () => set(!on));
  // someone who turned music on last time gets it back on their first tap anywhere
  let wanted = false;
  try {
    wanted = localStorage.getItem(KEY) === "1";
  } catch {}
  if (wanted) {
    const resume = () => {
      window.removeEventListener("pointerdown", resume);
      if (!on) set(true);
    };
    window.addEventListener("pointerdown", resume);
  }
  return { set, get on() {
    return on;
  } };
}
