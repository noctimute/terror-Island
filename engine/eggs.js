// Easter-egg tracker: stays out of sight until the first egg is found, then shows a
// quest-log pill under the brand with how many are still hidden. Progress is kept per
// browser so it survives a reload.

export const EGGS = [
  ["gun", "台中撿到槍", "路上掉的東西，全部撿回來"],
  ["lumama", "Lumama", "那個一直在城裡晃的人"],
  ["shore", "海景第一排", "海邊的消波塊"],
  ["tree", "太高的樹", "長得特別高的樹"],
  ["ship", "香港船", "港口裡的船"],
  ["bus", "幽靈公車", "若隱若現的公車"],
  ["stop", "等不到的站牌", "路邊的站牌"],
  ["jam", "永遠的 74", "高架上的車陣"],
  ["rats", "老鼠大軍", "垃圾和廚餘附近的生物"],
  ["camera", "科技執法", "路口的鏡頭"],
  ["tbm", "潛盾機", "城外的工地"],
  ["air", "谷關空氣", "送給市民的第一份禮物"],
  ["dlc", "購物島 DLC", "上了鎖的島"],
];

const KEY = "terror-island-eggs";

export function createEggs({ root, onFound, onGift }) {
  let got = new Set();
  try {
    got = new Set(JSON.parse(localStorage.getItem(KEY) || "[]").filter((k) => EGGS.some((e) => e[0] === k)));
  } catch {}

  root.innerHTML = `<button class="egg-pill" aria-expanded="false"><span class="egg-ico">🥚</span><span class="egg-count"></span></button>
<div class="egg-panel" hidden><div class="egg-head"><b>彩蛋任務</b><span class="egg-left"></span></div><div class="egg-bar"><i></i></div><ul></ul><div class="egg-foot"><button class="egg-reset">歸零重找</button><span class="egg-ask" hidden>紀錄全部歸零？<button class="egg-yes">歸零</button><button class="egg-no">取消</button></span></div></div>
<div class="egg-toast" aria-live="polite"></div>
<div class="egg-done egg-gift" hidden role="dialog" aria-modal="true" aria-label="谷關空氣"><div class="egg-done-card"><img src="../lumama/air-gift.jpg" alt="四支印著「谷關空氣 Air of Guguan 市長 盧秀燕 臺中市第三屆市長就職典禮紀念」的空玻璃瓶" width="696" height="454"><div class="egg-done-text"><small>A GIFT FROM LUMAMA</small><b>谷關空氣</b><p>臺中市第三屆市長就職典禮紀念品，送給市民的第一份禮物。<br>內容物：空氣。</p><button>收下</button></div></div></div>
<div class="egg-done" hidden role="dialog" aria-modal="true" aria-label="彩蛋全破"><div class="egg-done-card"><img src="../lumama/eggs-done.jpg" alt="漫畫：「……我最討厭像你這樣直覺敏銳的小鬼」" width="800" height="800"><div class="egg-done-text"><small>ALL EASTER EGGS FOUND</small><b>彩蛋全破 ${EGGS.length} / ${EGGS.length}</b><button>關閉</button></div></div></div>`;
  const pill = root.querySelector(".egg-pill"),
    panel = root.querySelector(".egg-panel"),
    toast = root.querySelector(".egg-toast"),
    done = root.querySelector(".egg-done:not(.egg-gift)");
  // the reward card covers the whole page, so it lives on <body>, outside the pill's stacking layer
  document.body.appendChild(done);
  // Lumama's welcome gift: shown once, and the egg counts when the reader takes it
  const giftCard = root.querySelector(".egg-gift");
  document.body.appendChild(giftCard);
  const takeGift = () => {
    if (giftCard.hidden) return;
    giftCard.hidden = true;
    found("air");
  };
  giftCard.addEventListener("click", (e) => (e.target === giftCard || e.target.tagName === "BUTTON") && takeGift());
  document.addEventListener("keydown", (e) => e.key === "Escape" && takeGift());
  function gift() {
    if (got.has("air") || !done.hidden) return;
    panel.hidden = true;
    giftCard.hidden = false;
    onGift?.();
  }
  const showDone = () => {
    panel.hidden = true;
    done.hidden = false;
  };
  done.addEventListener("click", (e) => (e.target === done || e.target.tagName === "BUTTON") && (done.hidden = true));
  document.addEventListener("keydown", (e) => e.key === "Escape" && (done.hidden = true));
  let toastTimer;

  function render() {
    root.hidden = got.size === 0;
    const n = got.size,
      all = EGGS.length;
    root.querySelector(".egg-count").textContent = `彩蛋 ${n} / ${all}`;
    root.querySelector(".egg-left").innerHTML = n === all ? "全部找到了！<button class=\"egg-again\">再看一次</button>" : `還有 ${all - n} 個沒找到`;
    root.querySelector(".egg-bar i").style.width = `${(n / all) * 100}%`;
    root.querySelector("ul").innerHTML = EGGS.map(([k, name, hint]) =>
      got.has(k) ? `<li class="done"><span>✔</span><b>${name}</b></li>` : `<li><span>？</span><b>？？？</b><small>${hint}</small></li>`
    ).join("");
  }

  panel.addEventListener("click", (e) => {
    if (e.target.closest(".egg-again")) showDone();
    // the reset asks inside the panel, in the panel's own style, instead of a browser dialog
    const ask = panel.querySelector(".egg-ask"),
      reset = panel.querySelector(".egg-reset");
    if (e.target.closest(".egg-reset") || e.target.closest(".egg-no")) {
      const asking = !!e.target.closest(".egg-reset");
      ask.hidden = !asking;
      reset.hidden = asking;
    }
    if (e.target.closest(".egg-yes")) {
      ask.hidden = true;
      reset.hidden = false;
      got.clear();
      try {
        localStorage.removeItem(KEY);
      } catch {}
      panel.hidden = true;
      render(); // with nothing found the tracker hides itself again until the next egg
    }
  });
  pill.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    panel.querySelector(".egg-ask").hidden = true;
    panel.querySelector(".egg-reset").hidden = false;
    pill.setAttribute("aria-expanded", !panel.hidden);
  });
  document.addEventListener("pointerdown", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !pill.contains(e.target)) {
      panel.hidden = true;
      pill.setAttribute("aria-expanded", "false");
    }
  });

  function found(k) {
    if (got.has(k)) return;
    got.add(k);
    try {
      localStorage.setItem(KEY, JSON.stringify([...got]));
    } catch {}
    render();
    const name = EGGS.find((e) => e[0] === k)?.[1] || k;
    toast.innerHTML = `<small>發現彩蛋</small><b>${name}</b><small>${got.size} / ${EGGS.length}</small>`;
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    pill.classList.remove("pop");
    void pill.offsetWidth;
    pill.classList.add("pop");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
    // the last one opens the reward card once its toast has had a moment
    if (got.size === EGGS.length) setTimeout(showDone, 1400);
    onFound?.(k);
  }

  render();
  return { found, gift };
}
