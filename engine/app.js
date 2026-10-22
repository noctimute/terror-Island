import { TOP, WILD_TOP, layoutZones, buildCity, createHeightAt } from "./world.js?v=1";
import { createEnvironment, mulberry } from "./environment.js?v=2";
import { createKit, MODELS, wildForest } from "./models.js?v=19";
import { createPeople, flowCurve } from "./people.js?v=2";
import { createLumama } from "./lumama.js?v=8";
import { createGuns } from "./guns.js?v=8";
import { createMusic } from "./music.js?v=1";
import { icon, skulls } from "./icons.js?v=1";

const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const mobileMQ = matchMedia("(max-width: 800px)");
// portrait phone overview: lower angle, turned a little so the city's diagonal fills the narrow screen
const PHONE_POLAR = 1.0,
  PHONE_FIT = 1.0,
  PHONE_DZ = -3,
  PHONE_AZIM = -0.35;
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
const fmt = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.floor(m % 60))}`;
const toMin = (s) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

// 事件關聯: islands are linked only for a stated reason — events in the same district (computed),
// or a news report that covers both sides (data.json "links", with the report as its source)
const DISTRICTS = ["中區", "東區", "南區", "西區", "北區", "西屯", "南屯", "北屯", "豐原", "東勢", "大甲", "清水", "沙鹿", "梧棲", "后里", "神岡", "潭子", "大雅", "新社", "石岡", "外埔", "大安", "烏日", "大肚", "龍井", "霧峰", "太平", "大里", "和平"];
function buildLinks(D) {
  const open = D.zones.filter((z) => !z.wip).sort((a, b) => a.number - b.number);
  const byDistrict = (z) => {
    const m = new Map();
    for (const sp of z.spots) for (const d of DISTRICTS) if (String(sp.place || "").includes(d)) m.set(d, [...(m.get(d) || []), sp.id]);
    return m;
  };
  const dist = new Map(open.map((z) => [z.id, byDistrict(z)]));
  const links = [];
  open.forEach((a, i) =>
    open.slice(i + 1).forEach((b) => {
      const shared = [...dist.get(a.id).keys()].filter((d) => dist.get(b.id).has(d)).map((d) => ({ d, a: dist.get(a.id).get(d), b: dist.get(b.id).get(d) }));
      if (shared.length) links.push({ id: `P${links.length + 1}`, from: a.id, to: b.id, evidence: "place", walker: "light", carry: null, text: `同在${shared.map((x) => x.d).join("、")}`, shared });
    }),
  );
  for (const l of D.links || []) links.push({ walker: "light", carry: null, evidence: "report", ...l });
  return links;
}

try {
  const [THREE, { OrbitControls }, { CSS2DRenderer, CSS2DObject }, D] = await Promise.all([
    import("three"),
    import("three/addons/controls/OrbitControls.js"),
    import("three/addons/renderers/CSS2DRenderer.js"),
    // each city page points the shared engine at its own content: <main id="app" data-src="../lumama/data.json">
    fetch(`${$("#app").dataset.src || "./data.json"}?v=28`)
      .then((r) => {
        if (!r.ok) throw Error(`data.json: ${r.status}`);
        return r.json();
      })
      .then(async (D) => {
        // a zone can keep a long list of news records in its own file (zones[].recordsSrc), so it can be updated alone
        const base = new URL($("#app").dataset.src || "./data.json", document.baseURI);
        for (const z of D.zones)
          if (z.recordsSrc) {
            const R = await fetch(`${new URL(z.recordsSrc, base)}?v=${Math.floor(Date.now() / 36e5)}`).then((r) => (r.ok ? r.json() : null));
            if (!R) continue;
            z.spotsNote = R.note;
            // each record becomes one more 事件, titled after its first real headline; no 3D pin for these
            for (const r of R.records)
              z.spots.push({
                id: r.id,
                name: r.title || r.sources.find((x) => !x.title.endsWith("報導"))?.title || `${r.date} ${r.place}`,
                era: "now",
                fear: r.fear ?? R.fear ?? ["D"],
                danger: r.danger ?? R.danger ?? 5,
                date: r.date,
                sort: r.sort, // month used to place a range/year-only date on the timeline
                place: r.place,
                plain: r.summary,
                facts: [],
                helpline: r.helpline ?? !!R.helpline,
                sources: r.sources,
                pin: false,
              });
          }
        D.flows = buildLinks(D);
        return D;
      }),
  ]);

  // ---------- data ----------
  const zones = D.zones,
    zoneById = new Map(zones.map((z) => [z.id, z])),
    spotById = new Map(zones.flatMap((z) => z.spots.map((s) => [s.id, { ...s, zone: z.id }]))),
    flowById = new Map(D.flows.map((f) => [f.id, f])),
    fearById = new Map(D.fear.map((f) => [f.id, f])),
    eraById = new Map(D.eras.map((e) => [e.id, e]));
  const flowsOf = (zid) => D.flows.filter((f) => f.from === zid || f.to === zid);
  const zoneLabel = (z) => `${pad(z.number)} ${z.name}`;
  const districtSuffix = (z, sep) => (z.district ? `${sep}${esc(z.district)}` : "");
  const roleLabel = (r) => D.roles[r]?.label || r;
  const carryLabel = (c) => D.carry[c] || c;
  const spotCount = zones.reduce((n, z) => n + z.spots.length, 0);
  const openCount = zones.filter((z) => !z.wip).length;
  const ONBOARD_KEY = `ti-onboarded-${D.meta.slug || "city"}`;
  $(".brand h1").textContent = D.meta.title;
  $(".hero-note .number").textContent = zones.length;

  const debug = params.has("debug");
  const quality = params.get("quality") || (mobileMQ.matches || /Mobi|Android/i.test(navigator.userAgent) ? "medium" : "high");

  // ---------- renderer / scene ----------
  const stage = $("#stage");
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: debug });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === "high" ? 1.75 : 1.35));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "labels";
  stage.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 900);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 70;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = 1.22;
  controls.zoomSpeed = 0.9;

  const wildsData = D.wilds || [];
  const { centers, wildCenters, bounds } = layoutZones(zones, wildsData);
  const heightAt = createHeightAt(centers);
  // middle of the 16 legend plateaus (the forest cells to the east would pull the phone framing off-centre)
  const zoneBox = new THREE.Box3();
  for (const z of zones) zoneBox.expandByPoint(new THREE.Vector3(centers.get(z.id).x, 0, centers.get(z.id).z));
  const zoneMid = zoneBox.getCenter(new THREE.Vector3());
  const city = buildCity(THREE, zones, centers, wildCenters);
  scene.add(city.group);
  const allCenters = new Map([...centers, ...wildCenters.map((w, i) => [`wild-${i}`, w])]);
  const env = createEnvironment(THREE, { scene, renderer, centers: allCenters, bounds, quality, reduced: reduced.matches, terrain: D.meta.terrain });

  const kit = createKit(THREE);
  for (const z of zones) {
    const c = centers.get(z.id);
    const p = kit.zone(z.id, c.x, c.z);
    const res = MODELS[z.model]?.(p, mulberry(hash(z.id))) || {};
    if (res.mist) env.addMist(c.x, c.z, res.mist, 1.3, TOP + (res.mistY ?? 0.45), 2.4, 1.35);
  }
  wildCenters.forEach((w, i) => {
    wildForest(kit.zone(`wild-${i}`, w.x, w.z), mulberry(500 + i));
    env.addMist(w.x, w.z, 2, 1.2, WILD_TOP + 0.5, 3, 1.2);
  });
  kit.build(scene);

  // ---------- curse links (arcs) ----------
  const STYLE = { solid: 0, dash: 1, dot: 2 };
  const arcs = new Map();
  D.flows.forEach((f, i) => {
    const base = flowCurve(THREE, centers.get(f.from), centers.get(f.to), i);
    const pts = [];
    for (let k = 0; k <= 48; k++) {
      const u = k / 48,
        p = base.getPoint(u);
      p.y = TOP + 0.5 + Math.sin(Math.PI * u) * 1.5;
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        color: { value: new THREE.Color(0xff3b2f) },
        opacity: { value: 0 },
        time: { value: 0 },
        style: { value: STYLE[D.evidence[f.evidence]?.style] ?? 0 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; uniform float time; uniform int style; varying vec2 vUv;
        void main(){
          float d = fract(vUv.x * 26.0 - time * 0.9);
          if (style == 1 && d > 0.55) discard;
          if (style == 2 && d > 0.22) discard;
          float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
          gl_FragColor = vec4(color * (1.0 + 0.6 * step(0.9, fract(vUv.x * 4.0 - time * 0.35))), opacity * edge);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.03, 6, false), mat);
    mesh.visible = false;
    mesh.renderOrder = 4;
    scene.add(mesh);
    arcs.set(f.id, { mesh, mat, mid: curve.getPoint(0.5) });
  });

  // ---------- labels ----------
  const chips = new Map(),
    pins = new Map();
  for (const z of zones) {
    const c = centers.get(z.id);
    const el = document.createElement("button");
    el.className = "chip";
    el.type = "button";
    el.innerHTML = `<b>${pad(z.number)}</b><span class="nm">${esc(z.name)}</span>${z.civic ? `<span class="civ" title="市政議題">${icon("civic")}</span>` : ""}`;
    el.setAttribute("aria-label", zoneLabel(z));
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      selectZone(z.id);
    });
    const obj = new CSS2DObject(el);
    obj.position.set(c.x, TOP - 0.1, c.z + 1.8); // hangs on the plateau's front edge
    scene.add(obj);
    chips.set(z.id, { obj, el });
    z.spots.forEach((s, i) => {
      if (s.pin === false) return;
      const a = Math.PI * 1.15 + (i / Math.max(1, z.spots.length - 1)) * Math.PI * 0.7;
      const pe = document.createElement("button");
      pe.className = "pin";
      pe.type = "button";
      pe.innerHTML = `<i></i><span>${esc(s.name)}</span>`;
      pe.addEventListener("click", (e) => {
        e.stopPropagation();
        selectSpot(s.id);
      });
      const po = new CSS2DObject(pe);
      po.position.set(c.x + Math.cos(a) * 1.15, TOP + 1.05 + (i % 2) * 0.25, c.z + Math.sin(a) * 1.0);
      po.visible = false;
      scene.add(po);
      pins.set(s.id, { obj: po, el: pe, zone: z.id, id: s.id });
    });
  }

  // ---------- state ----------
  const state = {
    minute: toMin(params.get("time") || "21:00") % 1440,
    playing: false,
    sel: null,
    hover: null,
    fear: new Set(),
    civic: false,
    era: null,
    isle: null,
    tl: null, // month index on the event timeline, or null for "all"
    tlCum: false,
    names: false,
    badges: true,
    flows: false,
    frozen: reduced.matches,
    bird: false,
    log: false,
    tab: "zones",
    search: "",
    tour: null,
  };

  const log = [];
  const people = createPeople(THREE, {
    scene,
    flows: D.flows,
    centers,
    heightAt,
    roles: D.roles,
    rng: mulberry(99),
    CSS2DObject,
    iconFor: (c) => icon(c),
    carryLabel,
    onArrive(f, end) {
      const z = zoneById.get(end === "to" ? f.to : f.from);
      const text = end === "to" ? `${roleLabel(f.walker)}把「${carryLabel(f.carry)}」帶到了${z.name}` : `${roleLabel(f.walker)}回到了${z.name}，又出發了`;
      pushLog({ text, flow: f.id, zone: z.id });
    },
  });

  createMusic($("#music-toggle"));
  const lumama = createLumama(THREE, { scene, centers: [...centers.values()], CSS2DObject, rng: mulberry(7) });
  const guns = createGuns(THREE, { scene, centers: [...centers.values()], CSS2DObject, rng: Math.random, groundAt: (x, z) => env.heightAtTerrain(x, z) - 0.03, blocked: [...allCenters.values()], hud: $("#gun-hud") });

  // ---------- camera ----------
  let fly = null;
  const v3 = new THREE.Vector3();
  function viewPos(target, dist, polar, azim = 0) {
    return new THREE.Vector3(
      target.x + Math.sin(polar) * Math.sin(azim) * dist,
      target.y + Math.cos(polar) * dist,
      target.z + Math.sin(polar) * Math.cos(azim) * dist,
    );
  }
  function flyTo(target, pos, dur = 1.15) {
    if (reduced.matches) dur = 0.01;
    fly = { t: 0, dur, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: target, toP: pos };
  }
  function homeView(instant = false) {
    const w = bounds.maxX - bounds.minX + 3,
      d = bounds.maxZ - bounds.minZ + 3;
    const vfov = (camera.fov * Math.PI) / 180,
      hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    // phones (portrait): a lower, slightly turned view like a diorama, sized to the screen width
    const phone = mobileMQ.matches && camera.aspect < 0.85;
    const polar = state.bird ? 0.1 : phone ? PHONE_POLAR : 0.88;
    const fit = Math.max(w / 2 / Math.tan(hfov / 2), (d / 2 / Math.tan(vfov / 2)) * (state.bird ? 1.0 : 1.05));
    const dist = Math.min(68, Math.max(12, fit * (phone ? PHONE_FIT : mobileMQ.matches ? 1.3 : 0.82)));
    const t = phone ? zoneMid.clone().setZ(zoneMid.z + (state.bird ? 0 : PHONE_DZ)) : new THREE.Vector3(0, 0, state.bird ? 0 : 0.6);
    const p = viewPos(t, dist, polar, phone && !state.bird ? PHONE_AZIM : 0);
    if (instant) {
      controls.target.copy(t);
      camera.position.copy(p);
      fly = null;
    } else flyTo(t, p);
  }
  function zoneView(id) {
    const c = centers.get(id);
    const t = new THREE.Vector3(c.x, TOP + 0.35, c.z + 0.15);
    const dist = mobileMQ.matches ? 12 : 9.5;
    flyTo(t, viewPos(t, dist, state.bird ? 0.12 : 0.92, mobileMQ.matches ? 0 : 0.18));
  }
  controls.addEventListener("start", () => (fly = null));
  controls.addEventListener("change", () => {
    const t = controls.target;
    t.x = Math.min(bounds.maxX + 6, Math.max(bounds.minX - 6, t.x));
    t.z = Math.min(bounds.maxZ + 6, Math.max(bounds.minZ - 6, t.z));
    t.y = Math.min(3, Math.max(0, t.y));
  });

  // ---------- filters & visual state ----------
  function zoneMatches(z) {
    if (state.fear.size && !(z.fear.some((f) => state.fear.has(f)) || z.spots.some((s) => s.fear.some((f) => state.fear.has(f))))) return false;
    if (state.era && !z.spots.some((s) => s.era === state.era)) return false;
    if (state.isle && z.id !== state.isle) return false;
    if (state.tl !== null && !tlZones().has(z.id)) return false;
    if (state.civic && !z.civic) return false;
    return true;
  }
  function activeSet() {
    if (!state.fear.size && !state.era && !state.civic && !state.isle && state.tl === null) return null;
    return new Set(zones.filter(zoneMatches).map((z) => z.id));
  }
  function applyFilters() {
    const act = activeSet();
    kit.setActive(act);
    const fade = new THREE.Color(0x5a5558);
    for (const z of zones) {
      const pl = city.plateaus.get(z.id);
      const off = act && !act.has(z.id);
      pl.top.color.copy(pl.base.top);
      pl.side.color.copy(pl.base.side);
      if (off) {
        pl.top.color.lerp(fade, 0.7);
        pl.side.color.lerp(fade, 0.6);
      } else if (state.civic && z.civic) {
        pl.top.color.lerp(new THREE.Color(0x2c6db5), 0.35);
      } else if (state.fear.size) {
        const hit = z.fear.find((f) => state.fear.has(f)) || z.spots.flatMap((s) => s.fear).find((f) => state.fear.has(f));
        if (hit) pl.top.color.lerp(new THREE.Color(fearById.get(hit).color), 0.55);
      }
      chips.get(z.id).el.classList.toggle("off", !!off);
      $(`#dock [data-zone="${z.id}"]`)?.classList.toggle("off", !!off);
    }
    const n = act ? act.size : zones.length;
    $("#status").textContent = `顯示 ${n} / ${zones.length} 處地點`;
    $$("#fear-buttons [data-fear]").forEach((b) => b.setAttribute("aria-pressed", state.fear.has(b.dataset.fear)));
    $("#fear-buttons [data-civic]")?.setAttribute("aria-pressed", state.civic);
    $$("#isle-buttons button").forEach((b) => b.setAttribute("aria-pressed", (b.dataset.isle || null) === state.isle));
    const isle = state.isle && zoneById.get(state.isle);
    $("#isle-note").textContent = isle ? `只顯示 ${zoneLabel(isle)}，共 ${isle.spots.length} 則。` : "選一座島，只顯示那座島。";
    renderTimeline();
  }

  function flowView() {
    const all = new Set(D.flows.map((f) => f.id));
    if (state.tour?.flows) return { show: state.tour.flows, emph: state.tour.flows, walk: state.tour.flows.size ? state.tour.flows : null };
    if (state.sel?.type === "flow") {
      const s = new Set([state.sel.id]);
      return { show: state.flows ? all : s, emph: s, walk: s };
    }
    if (state.sel) {
      const s = new Set(flowsOf(state.sel.zone).map((f) => f.id));
      return { show: state.flows ? all : s, emph: s, walk: null };
    }
    return { show: state.flows ? all : new Set(), emph: all, walk: null };
  }
  function applyFlows() {
    const v = flowView();
    for (const [id, a] of arcs) {
      a.mesh.visible = v.show.has(id);
      a.mat.uniforms.opacity.value = v.emph.has(id) ? 0.95 : 0.18;
    }
    // travelling lights only run along links that are on screen
    people.setFilter(v.walk || v.show);
    $("#legend").hidden = !v.show.size;
  }

  function applyLabels() {
    for (const [, p] of pins) {
      const on = state.names || state.sel?.zone === p.zone;
      p.obj.visible = on && !state.tour;
      p.el.classList.toggle("active", state.sel?.type === "spot" && state.sel.id === p.id);
    }
    for (const [id, c] of chips) c.el.classList.toggle("active", state.sel?.zone === id || state.tour?.target === id);
    for (const [id, line] of city.outlines) {
      const sel = state.sel?.zone === id || state.tour?.target === id;
      line.material.opacity = sel ? 1 : state.hover === id ? 0.55 : 0;
      line.material.color.setHex(sel ? 0xff3b2f : 0xffe2c4);
    }
    $$("#dock button").forEach((b) => b.classList.toggle("active", b.dataset.zone === state.sel?.zone));
  }

  // ---------- night cycle ----------
  function currentCycle(m = state.minute) {
    return D.dayCycle.find((c) => m >= toMin(c.from) && m < toMin(c.to)) || D.dayCycle[0];
  }
  let lastCycle = null;
  function setTime(m) {
    state.minute = ((m % 1440) + 1440) % 1440;
    env.setTime(state.minute);
    const cy = currentCycle();
    if (cy !== lastCycle) {
      lastCycle = cy;
      for (const [id] of chips) chips.get(id).el.classList.toggle("awake", cy.zones.includes(id));
      if (state.log) renderOverview();
    }
    $$(".seg [data-time]").forEach((b) => b.classList.toggle("on", Math.abs(+b.dataset.time - state.minute) < 45));
  }
  let timeTween = null;
  function tweenTime(to) {
    if (reduced.matches) return setTime(to);
    timeTween = { from: state.minute, to, t: 0 };
  }

  // ---------- selection & card ----------
  const card = $("#card"),
    cardContent = $("#card-content");
  function fearChips(ids) {
    return ids.map((id) => `<span class="fchip" style="--c:${fearById.get(id).color}"><b>${id}</b>${esc(fearById.get(id).name)}</span>`).join("");
  }
  function civicBox(z) {
    if (!z.civic) return "";
    return `<aside class="civic">${icon("civic")}<div><b>現實中的市政議題：${esc(z.civic.title)}</b><p>${esc(z.civic.body)}</p></div></aside>`;
  }
  // real-news islands: a notice on the zone, and each event's own sources
  function newsBox(z) {
    if (!z.news) return "";
    return `<aside class="news">${icon("skull")}<div><b>${esc(z.news.title)}</b><p>${esc(z.news.body)}</p></div></aside>`;
  }
  function sourceList(sp) {
    if (!sp.sources?.length) return "";
    return `<h3>新聞來源 <small>${sp.sources.length}</small></h3>
        <ul class="sources">${sp.sources
          .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><small>${esc(s.outlet)}</small></li>`)
          .join("")}</ul>`;
  }
  function helpBox(sp) {
    if (!sp.helpline) return "";
    const line = sp.fear.includes("Y") ? D.helplineKids : D.helpline; // child victims get the 113 protection line
    return line ? `<aside class="help">${esc(line)}</aside>` : "";
  }
  function renderCard() {
    const s = state.sel;
    if (!s) {
      card.hidden = true;
      document.body.classList.remove("has-card");
      return;
    }
    let html = "";
    if (s.type === "zone" && zoneById.get(s.id).wip) {
      const z = zoneById.get(s.id);
      html = `<div class="eyebrow">${pad(z.number)}${districtSuffix(z, " · ")}</div>
        <h2>🚧 ${esc(z.name)}</h2><p class="lead">${esc(z.summary)}</p>
        <div class="card-actions"><button data-act="prev">← 上一處</button><button data-act="next">下一處 →</button></div>`;
    } else if (s.type === "zone") {
      const z = zoneById.get(s.id);
      const fl = flowsOf(z.id);
      html = `<div class="eyebrow">LEGEND ${pad(z.number)}${districtSuffix(z, " · ")}</div>
        <h2>${esc(z.name)}</h2><p class="lead">${esc(z.summary)}</p>
        <div class="meta-row">${fearChips(z.fear)}${skulls(z.danger)}</div>
        ${civicBox(z)}${newsBox(z)}
        <h3>${z.news ? "事件" : "傳說"} <small>${z.spots.length}</small></h3>
        <ol class="spot-list">${z.spots
          .map(
            (sp) => `<li><button data-spot="${sp.id}"><span class="sp-name">${esc(sp.name)}</span><span class="sp-meta">${esc(sp.date || eraById.get(sp.era).label)} ${skulls(sp.danger)}</span><span class="sp-plain">${esc(sp.plain)}</span></button></li>`,
          )
          .join("")}</ol>
        ${
          fl.length
            ? `<h3>事件關聯 <small>${fl.length}</small></h3>
        <ul class="flow-list">${fl.map((f) => `<li><button data-flow="${f.id}"><em>${f.id}</em><span>${esc(f.text)}・${esc(zoneLabel(zoneById.get(f.from === z.id ? f.to : f.from)))}</span></button></li>`).join("")}</ul>`
            : ""
        }
        <div class="card-actions"><button data-act="prev">← 上一處</button>${fl.length ? `<button data-act="flows" class="primary">看它連到哪</button>` : ""}<button data-act="next">下一處 →</button></div>
        ${z.spotsNote ? `<p class="rec-note">${esc(z.spotsNote)}</p>` : ""}`;
    } else if (s.type === "spot") {
      const sp = spotById.get(s.id),
        z = zoneById.get(sp.zone);
      html = `<button class="back" data-zone="${z.id}">← ${esc(zoneLabel(z))}</button>
        <div class="eyebrow">${esc(sp.date || eraById.get(sp.era).label)}${sp.fear.length ? ` · ${sp.fear.map((f) => esc(fearById.get(f).name)).join(" / ")}` : ""}</div>
        <h2>${esc(sp.name)}</h2><p class="lead">${esc(sp.plain)}</p>
        ${sp.facts.length ? `<ul class="facts">${sp.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
        ${helpBox(sp)}${sourceList(sp)}
        <dl class="kv">${sp.date ? `<dt>日期</dt><dd>${esc(sp.date)}</dd>` : ""}${sp.place ? `<dt>地點</dt><dd>${esc(sp.place)}</dd>` : ""}<dt>危險度</dt><dd>${skulls(sp.danger)}</dd>${sp.date ? "" : `<dt>流傳年代</dt><dd>${esc(eraById.get(sp.era).label)}</dd>`}
        <dt>所在地</dt><dd>${z.district ? `${esc(z.district)}・` : ""}${esc(z.name)}</dd>${sp.fear.length ? `<dt>事件類型</dt><dd>${fearChips(sp.fear)}</dd>` : ""}</dl>
        ${civicBox(z)}${newsBox(z)}
        <div class="card-actions"><button data-act="prev-spot">← 上一則</button><button data-act="next-spot">下一則 →</button></div>`;
    } else if (s.type === "flow") {
      const f = flowById.get(s.id),
        a = zoneById.get(f.from),
        b = zoneById.get(f.to);
      const evBtn = (id) => {
        const sp = spotById.get(id);
        return sp ? `<li><button data-spot="${sp.id}"><span class="sp-name">${esc(sp.name)}</span><span class="sp-meta">${esc(sp.date || "")}　${esc(zoneLabel(zoneById.get(sp.zone)))}</span></button></li>` : "";
      };
      html = `<div class="eyebrow">事件關聯 ${f.id} · ${esc(D.evidence[f.evidence].label)}</div>
        <h2>${esc(f.text)}</h2>
        <div class="route"><button data-zone="${a.id}">${esc(zoneLabel(a))}</button><span aria-hidden="true">↔</span><button data-zone="${b.id}">${esc(zoneLabel(b))}</button></div>
        ${
          f.evidence === "place"
            ? f.shared.map((x) => `<h3>${esc(x.d)} <small>${x.a.length + x.b.length}</small></h3><ol class="spot-list">${[...x.a, ...x.b].map(evBtn).join("")}</ol>`).join("")
            : `<h3>相關事件 <small>${f.events.length}</small></h3><ol class="spot-list">${f.events.map(evBtn).join("")}</ol>${sourceList(f)}`
        }
        <p class="rec-note">${f.evidence === "place" ? "兩座島上都有發生在這些地區的事件；只表示地點相同，不代表事件之間有因果關係。" : "這些事件出現在同一篇（或同一波）新聞報導裡，連結即為該報導。"}</p>
        <div class="card-actions"><button data-act="prev-flow">← 上一條</button><button data-act="next-flow">下一條 →</button></div>`;
    }
    cardContent.innerHTML = html;
    card.hidden = false;
    card.scrollTop = 0;
    document.body.classList.add("has-card");
  }
  function setSel(sel, { fly: doFly = true } = {}) {
    state.sel = sel;
    document.body.classList.toggle("has-sel", !!sel);
    renderCard();
    applyFlows();
    applyLabels();
    renderTree();
    const u = new URL(location.href);
    u.searchParams.delete("zone");
    u.searchParams.delete("spot");
    u.searchParams.delete("flow");
    if (sel) u.searchParams.set(sel.type, sel.id);
    history.replaceState(null, "", u);
    if (doFly && sel) {
      if (sel.type === "flow") {
        const f = flowById.get(sel.id),
          a = arcs.get(sel.id).mid,
          ca = centers.get(f.from),
          cb = centers.get(f.to);
        const t = new THREE.Vector3(a.x, TOP, a.z);
        const sep = Math.hypot(ca.x - cb.x, ca.z - cb.z);
        flyTo(t, viewPos(t, Math.min(40, 10 + sep * 1.25), state.bird ? 0.12 : 0.9, 0.1));
      } else zoneView(sel.zone);
    }
    if (mobileMQ.matches && sel) closeSidebarMobile();
  }
  const selectZone = (id, o) => setSel({ type: "zone", id, zone: id }, o);
  const selectSpot = (id, o) => setSel({ type: "spot", id, zone: spotById.get(id).zone }, o);
  const selectFlow = (id, o) => setSel({ type: "flow", id, zone: null }, o);
  function step(list, cur, d) {
    const i = list.indexOf(cur);
    return list[(i + d + list.length) % list.length];
  }
  function onNavClick(e) {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.zone) return selectZone(b.dataset.zone);
    if (b.dataset.spot) return selectSpot(b.dataset.spot);
    if (b.dataset.flow) return selectFlow(b.dataset.flow);
    const s = state.sel;
    const ids = zones.map((z) => z.id),
      spots = [...spotById.keys()],
      fls = D.flows.map((f) => f.id);
    switch (b.dataset.act) {
      case "prev":
        return selectZone(step(ids, s.id, -1));
      case "next":
        return selectZone(step(ids, s.id, 1));
      case "prev-spot":
        return selectSpot(step(spots, s.id, -1));
      case "next-spot":
        return selectSpot(step(spots, s.id, 1));
      case "prev-flow":
        return selectFlow(step(fls, s.id, -1));
      case "next-flow":
        return selectFlow(step(fls, s.id, 1));
      case "flows": {
        const t = new THREE.Vector3(0, 0, 0.6);
        if (!state.flows) toggle("flows", true);
        return flyTo(t, viewPos(t, 30, 0.75, 0.1));
      }
    }
  }
  cardContent.addEventListener("click", onNavClick);
  $("#card-close").addEventListener("click", () => setSel(null));
  // phone sheet: drag the handle up to full screen, down to half height or off to close; a tap toggles
  {
    const h = $("#card-handle");
    let drag = null;
    h.addEventListener("pointerdown", (e) => {
      drag = { y: e.clientY, h0: card.offsetHeight, moved: false };
      h.setPointerCapture(e.pointerId);
      card.classList.add("dragging");
    });
    h.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (Math.abs(dy) > 6) drag.moved = true;
      if (drag.moved) card.style.height = `${Math.min(innerHeight, Math.max(60, drag.h0 - dy))}px`;
    });
    const end = () => {
      if (!drag) return;
      const moved = drag.moved,
        ht = card.offsetHeight;
      drag = null;
      card.classList.remove("dragging");
      card.style.height = "";
      if (!moved) return card.classList.toggle("full");
      if (ht < innerHeight * 0.25) {
        card.classList.remove("full");
        return setSel(null);
      }
      card.classList.toggle("full", ht > innerHeight * 0.6);
    };
    h.addEventListener("pointerup", end);
    h.addEventListener("pointercancel", end);
  }
  $("#tl-list").addEventListener("click", onNavClick);

  // ---------- sidebar ----------
  $("#disclaimer").textContent = D.meta.disclaimer;
  $("#side-count").innerHTML = `${openCount} 處開放地點 ／ ${spotCount} 則內容${zones.length > openCount ? `（其餘 ${zones.length - openCount} 處施工中）` : ""}<br>點開一座島，看看這座城發生過什麼。`;
  $("#tab-flows").textContent = `事件關聯 ${D.flows.length}`;
  $("#tab-flows").hidden = !D.flows.length; // no curse links once every open island is real news
  $$("[data-needs-flows]").forEach((b) => (b.hidden = !D.flows.length));
  const norm = (s) => String(s || "").toLowerCase();
  function renderTree() {
    const q = norm(state.search.trim());
    const tree = $("#tree");
    if (state.tab === "zones") {
      const rows = zones
        .map((z) => {
          const zHit = !q || [z.name, z.tag, z.district, z.summary].some((t) => norm(t).includes(q));
          const spots = z.spots.filter((s) => !q || zHit || [s.name, s.plain, ...s.facts].some((t) => norm(t).includes(q)));
          if (!zHit && !spots.length) return "";
          // events are listed only for search hits; clicking a row just opens the island card
          const open = q && spots.length;
          const off = activeSet() && !zoneMatches(z);
          return `<div class="row${open ? " open" : ""}${off ? " off" : ""}${state.sel?.zone === z.id ? " sel" : ""}">
            <button class="zrow" data-zone="${z.id}" aria-expanded="${!!open}"><em>${pad(z.number)}</em><span><b>${esc(z.name)}${z.tag ? `<mark class="tag isle-tag">${esc(z.tag)}</mark>` : ""}${z.wip ? `<mark class="tag wip-tag">施工中</mark>` : ""}</b>${z.district ? `<small>${esc(z.district)}</small>` : ""}</span><i>${z.spots.length} ↗</i></button>
            ${open ? `<ul class="spots">${spots.map((s) => `<li><button data-spot="${s.id}" class="${state.sel?.id === s.id ? "sel" : ""}">${esc(s.name)}<small>${esc(s.date || eraById.get(s.era).label)}</small></button></li>`).join("")}</ul>` : ""}
          </div>`;
        })
        .join("");
      tree.innerHTML = rows || `<p class="empty">找不到「${esc(state.search)}」相關的事件。</p>`;
    } else {
      const rows = D.flows
        .filter((f) => !q || [f.text, zoneById.get(f.from).name, zoneById.get(f.to).name, carryLabel(f.carry), roleLabel(f.walker)].some((t) => norm(t).includes(q)))
        .map(
          (f) => `<button class="frow${state.sel?.id === f.id ? " sel" : ""}" data-flow="${f.id}"><em>${f.id}</em><span><b>${esc(f.text)}</b><small>${esc(zoneById.get(f.from).name)} ↔ ${esc(zoneById.get(f.to).name)}・<span class="ev ev-${f.evidence}"></span>${esc(D.evidence[f.evidence].label)}</small></span>${f.carry ? icon(f.carry) : ""}</button>`,
        )
        .join("");
      tree.innerHTML = rows || `<p class="empty">找不到「${esc(state.search)}」相關的連線。</p>`;
    }
  }
  $("#tree").addEventListener("click", onNavClick);
  $("#search").addEventListener("input", (e) => {
    state.search = e.target.value;
    renderTree();
  });
  for (const t of ["zones", "flows"])
    $(`#tab-${t}`).addEventListener("click", () => {
      state.tab = t;
      $$(".side-tabs button").forEach((b) => b.classList.toggle("active", b.id === `tab-${t}`));
      renderTree();
    });
  function setSidebar(open) {
    document.body.classList.toggle("side-closed", !open);
    document.body.classList.toggle("side-open", open);
    $("#sidebar-toggle").setAttribute("aria-expanded", open);
  }
  function closeSidebarMobile() {
    if (mobileMQ.matches) setSidebar(false);
  }
  setSidebar(!mobileMQ.matches);
  $("#sidebar-toggle").addEventListener("click", () => setSidebar(document.body.classList.contains("side-closed")));
  $("#mobile-close").addEventListener("click", () => setSidebar(false));
  $("#sheet-handle").addEventListener("click", () => setSidebar(false));
  mobileMQ.addEventListener("change", (e) => setSidebar(!e.matches));

  // ---------- dock ----------
  $("#dock").innerHTML = zones.map((z) => `<button data-zone="${z.id}" title="${z.district ? `${esc(z.district)}・` : ""}${esc(z.name)}">${pad(z.number)}</button>`).join("");
  $("#dock").addEventListener("click", onNavClick);

  // ---------- controls: day / era / fear ----------
  $$(".control-tabs [data-panel]").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".control-tabs [data-panel]").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-selected", x === b);
      });
      $$(".controls .panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${b.dataset.panel}`));
    }),
  );
  // ---------- event timeline: every dated 事件 placed on a month axis ----------
  // each open island keeps its own colour on the timeline (zones[].tlColor), with a fallback palette
  const ISLE_COLORS = ["#7a5fb0", "#2c6db5", "#b5852c", "#a23a6e"];
  const isleColor = new Map(zones.filter((z) => !z.wip).map((z, i) => [z.id, z.tlColor || ISLE_COLORS[i % ISLE_COLORS.length]]));
  const monthOf = (d) => {
    const m = String(d || "").match(/(\d{4})(?:-(\d{1,2}))?/);
    return m ? +m[1] * 12 + (m[2] ? +m[2] - 1 : 0) : null;
  };
  const tlEvents = zones
    .flatMap((z) => z.spots.map((sp) => ({ sp, z, m: monthOf(sp.sort || sp.date) })))
    .filter((e) => e.m !== null)
    .sort((a, b) => a.m - b.m);
  const tlStart = tlEvents.length ? tlEvents[0].m : 0,
    tlEnd = tlEvents.length ? tlEvents.at(-1).m : 0,
    tlSpan = Math.max(1, tlEnd - tlStart);
  const ym = (m) => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;
  const tlVisible = (e) => !state.isle || e.z.id === state.isle;
  const tlIn = (e) => (state.tl === null ? true : state.tlCum ? e.m <= tlStart + state.tl : e.m === tlStart + state.tl);
  function tlZones() {
    return new Set(tlEvents.filter((e) => tlIn(e) && tlVisible(e)).map((e) => e.z.id));
  }
  {
    const stack = new Map();
    $("#tl-dots").innerHTML = tlEvents
      .map((e) => {
        const n = stack.get(e.m) || 0;
        stack.set(e.m, n + 1);
        return `<i data-m="${e.m}" data-z="${e.z.id}" style="left:${((e.m - tlStart) / tlSpan) * 100}%;bottom:${n * 5}px;--c:${isleColor.get(e.z.id) || "#888"}"></i>`;
      })
      .join("");
    const years = [];
    for (let y = Math.floor(tlStart / 12); y <= Math.floor(tlEnd / 12); y++) years.push(y);
    $("#tl-ticks").innerHTML = years.map((y) => `<span style="left:${(Math.max(0, y * 12 - tlStart) / tlSpan) * 100}%">${y}</span>`).join("");
    $("#tl").max = tlSpan;
    $("#tl").value = tlSpan;
  }
  function renderTimeline() {
    const shown = tlEvents.filter((e) => tlIn(e) && tlVisible(e));
    $("#tl-month").textContent = state.tl === null ? "全部" : ym(tlStart + state.tl);
    $("#tl-all").setAttribute("aria-pressed", state.tl === null);
    $("#tl-cum").setAttribute("aria-pressed", state.tlCum);
    $$("#tl-dots i").forEach((d) => {
      const e = { m: +d.dataset.m, z: { id: d.dataset.z } };
      d.classList.toggle("on", tlIn(e) && tlVisible(e));
    });
    const list = state.tl === null || state.tlCum ? shown.slice(-6).reverse() : shown;
    const head = state.tl === null ? `全部 ${shown.length} 件` : state.tlCum ? `到 ${ym(tlStart + state.tl)} 累計 ${shown.length} 件` : `${ym(tlStart + state.tl)} 共 ${shown.length} 件`;
    $("#tl-list").innerHTML =
      `<p class="tl-head">${head}${(state.tl === null || state.tlCum) && shown.length > 6 ? "（列出最近 6 件）" : ""}</p>` +
      (list.length
        ? `<ul>${list.map((e) => `<li><button data-spot="${e.sp.id}"><b style="--c:${isleColor.get(e.z.id) || "#888"}">${esc(e.sp.date)}</b><span>${esc(e.sp.name)}</span></button></li>`).join("")}</ul>`
        : `<p class="tl-empty">這個月沒有收錄的事件。</p>`);
  }
  const setTl = (v) => {
    state.tl = v;
    applyFilters();
  };
  $("#tl").addEventListener("input", (e) => setTl(+e.target.value));
  $("#tl-all").addEventListener("click", () => {
    stopTl();
    $("#tl").value = tlSpan;
    setTl(null);
  });
  $("#tl-cum").addEventListener("click", () => {
    state.tlCum = !state.tlCum;
    applyFilters();
  });
  let tlTimer = null;
  function stopTl() {
    clearInterval(tlTimer);
    tlTimer = null;
    $("#tl-play").textContent = "▶";
    $("#tl-play").setAttribute("aria-label", "播放時間軸");
  }
  $("#tl-play").addEventListener("click", () => {
    if (tlTimer) return stopTl();
    if (state.tl === null || state.tl >= tlSpan) setTl(0);
    $("#tl").value = state.tl;
    $("#tl-play").textContent = "❚❚";
    $("#tl-play").setAttribute("aria-label", "暫停");
    tlTimer = setInterval(() => {
      if (state.tl >= tlSpan) return stopTl();
      setTl(state.tl + 1);
      $("#tl").value = state.tl;
    }, reduced.matches ? 1200 : 450);
  });
  $$(".seg [data-time]").forEach((b) => b.addEventListener("click", () => tweenTime(+b.dataset.time)));
  $("#isle-buttons").innerHTML =
    `<button data-isle="" aria-pressed="true">全部</button>` +
    zones
      .filter((z) => !z.wip)
      .map((z) => `<button data-isle="${z.id}" aria-pressed="false" style="--c:${isleColor.get(z.id)}">${pad(z.number)} ${esc(z.name)}</button>`)
      .join("");
  $("#isle-buttons").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.isle = b.dataset.isle || null;
    applyFilters();
    renderTree();
  });
  $("#fear-buttons").innerHTML = D.fear
    .map((f) => `<button data-fear="${f.id}" aria-pressed="false" style="--c:${f.color}"><b>${f.id}</b><span>${esc(f.name)}</span><small>${esc(f.en)}</small></button>`)
    .join("") + (zones.some((z) => z.civic) ? `<button data-civic aria-pressed="false" style="--c:#2c6db5" class="civic-btn"><b>${icon("civic")}</b><span>只看市政議題</span><small>Civic issues</small></button>` : "");
  $("#fear-buttons").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-civic")) state.civic = !state.civic;
    else {
      const id = b.dataset.fear;
      state.fear.has(id) ? state.fear.delete(id) : state.fear.add(id);
    }
    applyFilters();
    renderTree();
  });

  // ---------- HUD toggles ----------
  function toggle(name, force) {
    const on = force ?? !state[name];
    state[name] = on;
    $(`.tg[data-toggle="${name}"]`)?.setAttribute("aria-pressed", on);
    if (name === "flows") applyFlows();
    if (name === "names") applyLabels();
    if (name === "badges") people.setBadges(on);
    if (name === "bird") state.sel?.zone ? zoneView(state.sel.zone) : homeView();
    if (name === "log") {
      document.body.classList.toggle("log-open", on);
      if (on) {
        renderLog();
        renderOverview();
      }
    }
  }
  $$(".tg").forEach((b) => b.addEventListener("click", () => toggle(b.dataset.toggle)));
  $$(".tg").forEach((b) => b.setAttribute("aria-pressed", !!state[b.dataset.toggle]));
  $("#mob-time").addEventListener("click", () => {
    const on = !document.body.classList.contains("time-open");
    document.body.classList.toggle("time-open", on);
    $("#mob-time").setAttribute("aria-pressed", on);
  });
  $("#home").addEventListener("click", () => {
    setSel(null, { fly: false });
    homeView();
  });
  $(".logo").addEventListener("click", (e) => {
    e.preventDefault();
    setSel(null, { fly: false });
    homeView();
  });

  // ---------- night log ----------
  const verbs = ["傳出了聲響", "有人目擊", "燈又亮了", "溫度驟降", "傳出哭聲", "監視器拍到人影", "收音機自己開了"];
  const logRng = mulberry(7);
  function pushLog(e) {
    log.unshift({ ...e, at: fmt(state.minute) });
    if (log.length > 80) log.pop();
    if (state.log) renderLog();
  }
  $("#log-flow").innerHTML = `<option value="">全部事件</option>` + D.flows.map((f) => `<option value="${f.id}">${f.id}・${esc(zoneById.get(f.from).name)} ↔ ${esc(zoneById.get(f.to).name)}</option>`).join("");
  $("#log-flow").addEventListener("change", renderLog);
  function renderLog() {
    const f = $("#log-flow").value;
    const rows = log.filter((e) => !f || e.flow === f);
    $("#log-list").innerHTML =
      rows
        .map(
          (e) => `<li><button ${e.flow ? `data-flow="${e.flow}"` : `data-zone="${e.zone}"`}><time>${e.at}</time><span>${esc(e.text)}</span>${e.flow ? `<em>${e.flow}</em>` : ""}</button></li>`,
        )
        .join("") || `<li class="empty">還沒有動靜……再等一下。</li>`;
  }
  $("#log-list").addEventListener("click", onNavClick);
  function renderOverview() {
    const open = zones.filter((z) => !z.wip);
    // count events (not islands) per event type
    const counts = D.fear.map((f) => ({ f, n: zones.reduce((n, z) => n + z.spots.filter((s) => s.fear.includes(f.id)).length, 0) }));
    const max = Math.max(1, ...counts.map((c) => c.n));
    const deaths = zones.reduce((n, z) => n + z.spots.filter((s) => s.fear.includes("D")).length, 0);
    const links = new Set(zones.flatMap((z) => z.spots.flatMap((s) => (s.sources || []).map((x) => x.url)))).size;
    $("#overview-panel").innerHTML = `<div class="stats">
      <div><b>${openCount}</b><span>開放島嶼</span></div><div><b>${spotCount}</b><span>則事件</span></div>
      <div><b>${deaths}</b><span>有人死亡</span></div><div><b>${links.toLocaleString()}</b><span>篇新聞連結</span></div></div>
      <h4>各島事件數</h4>${open.map((z) => `<div class="bar"><span>${pad(z.number)} ${esc(z.name)}</span><i style="--w:${(z.spots.length / Math.max(...open.map((o) => o.spots.length))) * 100}%;--c:${z.tlColor || "#888"}"></i><b>${z.spots.length}</b></div>`).join("")}
      <h4>事件類型</h4>${counts.map((c) => `<div class="bar"><span>${esc(c.f.name)}</span><i style="--w:${(c.n / max) * 100}%;--c:${c.f.color}"></i><b>${c.n}</b></div>`).join("")}`;
  }
  $$(".log-tabs [data-logtab]").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".log-tabs [data-logtab]").forEach((x) => x.setAttribute("aria-selected", x === b));
      $("#overview-panel").hidden = b.dataset.logtab !== "overview";
      $("#log-body").hidden = b.dataset.logtab !== "log";
      if (b.dataset.logtab === "overview") renderOverview();
    }),
  );
  $("#log-close").addEventListener("click", () => toggle("log", false));
  let ambientIn = 3;
  function ambientLog(dt) {
    ambientIn -= dt;
    if (ambientIn > 0) return;
    ambientIn = 4 + logRng() * 5;
    const cy = currentCycle();
    const z = zoneById.get(cy.zones[Math.floor(logRng() * cy.zones.length)]);
    if (!z?.spots.length) return;
    const s = z.spots[Math.floor(logRng() * z.spots.length)];
    pushLog({ text: `${z.name}・${s.name}：${verbs[Math.floor(logRng() * verbs.length)]}`, zone: z.id });
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(),
    ndc = new THREE.Vector2();
  let down = null,
    pointer = null;
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(city.picks, false)[0]?.object.userData.zone || null;
  }
  renderer.domElement.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener("pointermove", (e) => (pointer = e));
  renderer.domElement.addEventListener("pointerleave", () => {
    pointer = null;
    setHover(null);
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    down = null;
    const id = pick(e);
    // the easter eggs sit on top of the islands, so they win over the island under them
    if (guns.tryCollect(ray)) return;
    if (ray.intersectObject(lumama.hit, false).length) return lumama.celebrate();
    if (state.tour) return;
    if (id) selectZone(id);
    else if (state.sel) setSel(null, { fly: false });
  });
  function setHover(id) {
    if (id === state.hover) return;
    state.hover = id;
    renderer.domElement.style.cursor = id ? "pointer" : "";
    const z = id && zoneById.get(id);
    $("#mascot-text").textContent = z ? `${zoneLabel(z)}${z.district ? ` · ${z.district}` : ""}` : D.ui.mascot;
    applyLabels();
  }

  // ---------- intro ----------
  let introStep = 0;
  function showIntro(i = 0) {
    introStep = i;
    const s = D.ui.intro[i],
      last = i === D.ui.intro.length - 1;
    $("#intro-count").textContent = `${D.meta.welcome || "WELCOME"} / ${pad(i + 1)}`;
    $("#intro-title").textContent = s.title;
    $("#intro-body").textContent = s.body;
    $("#intro-note").textContent = i === 0 ? D.meta.disclaimer : "";
    $("#intro-next").textContent = last ? "開始探險" : "下一步 →";
    $("#intro-skip").textContent = last ? "▶ 看導覽" : "略過";
    $("#intro").hidden = false;
    $("#intro-next").focus();
  }
  function closeIntro() {
    $("#intro").hidden = true;
    store.set(ONBOARD_KEY, "1");
  }
  $("#intro-next").addEventListener("click", () => (introStep < D.ui.intro.length - 1 ? showIntro(introStep + 1) : closeIntro()));
  $("#intro-skip").addEventListener("click", () => {
    const last = introStep === D.ui.intro.length - 1;
    closeIntro();
    if (last) startTour();
  });
  $("#help").addEventListener("click", () => showIntro(0));

  // ---------- tour ----------
  const cues = D.tour.cues,
    tourLen = cues[cues.length - 1].to;
  function startTour() {
    closeIntro();
    setSel(null, { fly: false });
    state.tour = { t: 0, playing: true, cue: -1, flows: new Set(), target: null };
    document.body.classList.add("touring");
    $("#tour-pause").textContent = "暫停";
  }
  function exitTour() {
    if (!state.tour) return;
    state.tour = null;
    document.body.classList.remove("touring");
    $("#tour-caption").textContent = "";
    applyFlows();
    applyLabels();
    homeView();
  }
  function tourTick(dt) {
    const tr = state.tour;
    if (tr.playing) tr.t = Math.min(tourLen, tr.t + dt);
    const i = cues.findIndex((c) => tr.t >= c.from && tr.t < c.to);
    const idx = i < 0 ? cues.length - 1 : i;
    if (idx !== tr.cue) {
      tr.cue = idx;
      const c = cues[idx];
      tr.target = c.target === "all" ? null : c.target;
      tr.flows = new Set(c.flows.includes("*") ? D.flows.map((f) => f.id) : c.flows);
      $("#tour-caption").textContent = c.caption;
      if (c.time != null) tweenTime(c.time);
      if (tr.target) zoneView(tr.target);
      else {
        const t = new THREE.Vector3(0, 0, 0.6);
        flyTo(t, viewPos(t, c.flows.length ? 30 : 34, state.bird ? 0.1 : 0.85, 0), 1.6);
      }
      applyFlows();
      applyLabels();
    }
    $("#tour-time").textContent = `${pad(Math.floor(tr.t))} / ${tourLen}`;
    if (tr.t >= tourLen && tr.playing) {
      tr.playing = false;
      $("#tour-pause").textContent = "繼續";
    }
  }
  $("#tour-start").addEventListener("click", startTour);
  $("#tour-exit").addEventListener("click", exitTour);
  $("#tour-replay").addEventListener("click", startTour);
  $("#tour-pause").addEventListener("click", () => {
    const tr = state.tour;
    if (!tr) return;
    if (tr.t >= tourLen) return startTour();
    tr.playing = !tr.playing;
    $("#tour-pause").textContent = tr.playing ? "暫停" : "繼續";
  });

  // ---------- keyboard ----------
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("#intro").hidden) return closeIntro();
      if (state.tour) return exitTour();
      if (state.sel) return setSel(null, { fly: false });
      if (state.log) return toggle("log", false);
    }
    if (e.target.matches("input, select, textarea")) return;
    if (e.key === "/") {
      e.preventDefault();
      setSidebar(true);
      $("#search").focus();
    }
    if (state.sel && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      const d = e.key === "ArrowRight" ? 1 : -1;
      const s = state.sel;
      if (s.type === "zone") selectZone(step(zones.map((z) => z.id), s.id, d));
      else if (s.type === "spot") selectSpot(step([...spotById.keys()], s.id, d));
      else selectFlow(step(D.flows.map((f) => f.id), s.id, d));
    }
  });

  // ---------- resize ----------
  // When the detail card covers part of the stage, shift the projection centre into the free area
  // (left of the card on desktop, above the bottom sheet on mobile) instead of moving the camera.
  const shift = { x: 0, y: 0, key: "" };
  function applyViewShift(dt) {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    const open = !card.hidden && !state.tour;
    const want = mobileMQ.matches ? { x: 0, y: open ? card.offsetHeight / 2 : 0 } : { x: open ? (card.offsetWidth + 18) / 2 : 0, y: 0 };
    const k = reduced.matches ? 1 : 1 - Math.exp(-dt * 6);
    shift.x += (want.x - shift.x) * k;
    shift.y += (want.y - shift.y) * k;
    if (Math.abs(want.x - shift.x) < 0.5) shift.x = want.x;
    if (Math.abs(want.y - shift.y) < 0.5) shift.y = want.y;
    const key = `${w}x${h}:${shift.x.toFixed(1)},${shift.y.toFixed(1)}`;
    if (key === shift.key) return;
    shift.key = key;
    const fw = w + 2 * shift.x,
      fh = h + 2 * shift.y;
    camera.aspect = fw / fh;
    if (shift.x || shift.y) camera.setViewOffset(fw, fh, 2 * shift.x, 2 * shift.y, w, h);
    else camera.clearViewOffset();
  }
  function resize() {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    shift.key = "";
    applyViewShift(1);
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---------- initial state ----------
  $("#mascot-text").textContent = D.ui.mascot;
  $$(".tg").forEach((b) => b.setAttribute("aria-pressed", !!state[b.dataset.toggle]));
  setTime(state.minute);
  applyFilters();
  applyFlows();
  applyLabels();
  renderTree();
  homeView(true);
  const deep = params.get("spot") ? ["spot", params.get("spot")] : params.get("zone") ? ["zone", params.get("zone")] : params.get("flow") ? ["flow", params.get("flow")] : null;
  if (deep && (deep[0] === "spot" ? spotById : deep[0] === "zone" ? zoneById : flowById).has(deep[1])) {
    ({ spot: selectSpot, zone: selectZone, flow: selectFlow })[deep[0]](deep[1]);
  } else if (params.has("tour")) startTour();
  else if (!store.get(ONBOARD_KEY)) showIntro(0);
  for (let i = 0; i < 4; i++) ambientLog(99);

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let at = 0,
    fpsN = 0,
    fpsT = 0;
  const camPos = new THREE.Vector3();
  const envCtx = {
    night: 1,
    camAngle(node) {
      node.getWorldPosition(v3);
      return Math.atan2(camPos.x - v3.x, camPos.z - v3.z);
    },
  };
  $("#loading").classList.add("done");
  setTimeout(() => $("#loading").remove(), 900);

  function frame() {
    requestAnimationFrame(frame);
    const raw = clock.getDelta(),
      dt = Math.min(0.05, raw);
    const frozen = state.frozen;
    if (!frozen) at += dt;
    // the tour follows wall-clock time so slow devices still finish it in ~64 s
    if (state.tour) tourTick(Math.min(0.5, raw));
    applyViewShift(dt);
    // camera flights and time tweens also use wall-clock time (capped) so slow GPUs don't drag them out
    const wall = Math.min(0.25, raw);
    if (timeTween) {
      timeTween.t = Math.min(1, timeTween.t + wall / 1.4);
      setTime(timeTween.from + (timeTween.to - timeTween.from) * ease(timeTween.t));
      if (timeTween.t >= 1) timeTween = null;
    }
    if (fly) {
      fly.t = Math.min(1, fly.t + wall / fly.dur);
      const k = ease(fly.t);
      controls.target.lerpVectors(fly.fromT, fly.toT, k);
      camera.position.lerpVectors(fly.fromP, fly.toP, k);
      if (fly.t >= 1) fly = null;
    }
    controls.update();
    camera.getWorldPosition(camPos);
    envCtx.night = env.state.night;
    env.update(at);
    kit.update(at, frozen ? 0 : dt, envCtx);
    people.update(at, frozen ? 0 : dt, envCtx, frozen);
    lumama.update(at, frozen ? 0 : dt);
    guns.update(dt, at);
    city.lamps.mat.color.setHex(0xffd38a).multiplyScalar(0.25 + envCtx.night * 1.6);
    const cy = currentCycle();
    for (const [id, g] of city.glows) g.material.opacity = cy.zones.includes(id) ? (0.32 + Math.sin(at * 2.4) * 0.14) * (0.5 + envCtx.night * 0.5) : 0;
    for (const a of arcs.values()) a.mat.uniforms.time.value = at;
    if (!state.tour && !frozen) ambientLog(dt);
    if (pointer && !fly) {
      setHover(pick(pointer));
      if (guns.isGun(ray) || ray.intersectObject(lumama.hit, false).length) renderer.domElement.style.cursor = "pointer";
      pointer = null;
    }
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    if (debug) {
      fpsN++;
      fpsT += dt;
      if (fpsT > 1) {
        $("#status").textContent = `${Math.round(fpsN / fpsT)} fps · ${renderer.info.render.calls} calls`;
        fpsN = fpsT = 0;
      }
    }
  }
  frame();
} catch (err) {
  console.error(err);
  const l = $("#loading");
  if (l) l.innerHTML = `<h2>TERROR</h2><p>無法載入地圖：${esc(err.message)}<br>請確認瀏覽器支援 WebGL，並透過 http 伺服器開啟。</p>`;
}
