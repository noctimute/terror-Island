// Easter egg on the coast: click the tetrapods (肉粽) and a line surfaces out of the dark,
// flickers like a bad signal and sinks back, while the screen edges close in for a moment.

const LINES = [["海景第一排", "這裡面似乎埋了什麼..."]];

export function createShore({ hits, onWhisper }) {
  const live = [];
  let busy = 0;
  const hit = (ray) => (hits.length ? ray.intersectObjects(hits, false)[0] : null);

  function tryWhisper(ray) {
    const h = hit(ray);
    if (!h) return false;
    if (busy > 0) return true; // one whisper at a time; the click is still swallowed
    busy = 4.2;
    const [a, b] = LINES[Math.floor(Math.random() * LINES.length)];
    // the whisper surfaces in the middle of the screen, not at the click, so it is never cut off at the coast's edge
    const span = document.createElement("div");
    span.className = "shore-whisper";
    span.innerHTML = `<b>${a}</b><i>${b}</i>`;
    document.body.appendChild(span);
    live.push({ span, age: 0 });
    document.body.classList.add("dread");
    onWhisper?.();
    return true;
  }

  function update(dt) {
    busy = Math.max(0, busy - dt);
    for (let i = live.length - 1; i >= 0; i--) {
      const q = live[i];
      q.age += Math.max(dt, 1 / 60);
      const t = q.age;
      // fade up out of the dark, hold with an uneven flicker, then sink and blur away
      let op = t < 1.2 ? t / 1.2 : t < 3.2 ? 1 : Math.max(0, 1 - (t - 3.2) / 1);
      if (t > 0.6 && t < 3.2 && Math.random() < 0.08) op *= 0.25;
      const blur = t < 1.2 ? (1 - t / 1.2) * 6 : t > 3.2 ? (t - 3.2) * 6 : 0;
      q.span.style.opacity = op;
      q.span.style.filter = `blur(${blur.toFixed(1)}px)`;
      q.span.style.transform = `translate(-50%, -50%) translateY(${(t * 6).toFixed(1)}px) translateX(${(Math.sin(t * 23) * (t > 0.6 && t < 3.2 ? 0.8 : 0)).toFixed(1)}px)`;
      if (t >= 4.2) {
        q.span.remove();
        live.splice(i, 1);
        if (!live.length) document.body.classList.remove("dread");
      }
    }
  }

  return { tryWhisper, isShore: (ray) => !!hit(ray), update };
}
