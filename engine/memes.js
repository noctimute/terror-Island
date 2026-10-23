// Small meme easter eggs suggested by readers, scattered on the roads around the islands:
// a ghost bus that never arrives (and its bus stop), a jammed Route 74 viaduct, a running pack of rats,
// and a traffic-enforcement camera beside wobbly lane markings. Clicking one pops a line via `say`.
import { S, hexVertex } from "./world.js?v=1";

export function createMemes(THREE, { scene, centers, bounds, say, CSS2DObject, groundAt = () => 0, rng = Math.random, sfx = {} }) {
  const hits = []; // [mesh, handler]
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
  const glow = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const box = (g, w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const hitBox = (g, w, h, d, x, y, z, fn) => {
    const mesh = box(g, w, h, d, new THREE.MeshBasicMaterial(), x, y, z);
    mesh.visible = false;
    hits.push([mesh, fn]);
    return mesh;
  };

  // ---- road graph: the hex corners around every island, linked along the hex edges ----
  const key = (x, z) => `${Math.round(x * 100)}|${Math.round(z * 100)}`;
  const nodes = new Map();
  const node = (x, z) => {
    const k = key(x, z);
    if (!nodes.has(k)) nodes.set(k, { x, z, next: new Set() });
    return nodes.get(k);
  };
  for (const c of centers) {
    const ring = [0, 1, 2, 3, 4, 5].map((i) => {
      const v = hexVertex(i, S);
      return node(c.x + v.x, c.z + v.z);
    });
    ring.forEach((n, i) => {
      const m = ring[(i + 1) % 6];
      n.next.add(m);
      m.next.add(n);
    });
  }
  const all = [...nodes.values()];
  const anyNode = () => all[Math.floor(rng() * all.length)];
  const step = (from, prev) => {
    const opts = [...from.next].filter((n) => n !== prev);
    return opts[Math.floor(rng() * opts.length)] || prev;
  };
  // the front (south) edge of the city faces the default camera, so the props go there
  const front = [...all].sort((a, b) => b.z - a.z);

  // ---- 1. ghost bus ----
  const bus = new THREE.Group();
  const ghostMat = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0x6fa8d8, emissiveIntensity: 0.6, transparent: true, opacity: 0.5, depthWrite: false });
  const winMat = new THREE.MeshBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false });
  box(bus, 1.0, 0.36, 0.36, ghostMat, 0, 0.24, 0);
  box(bus, 0.86, 0.1, 0.37, winMat, 0, 0.32, 0);
  box(bus, 0.02, 0.18, 0.3, winMat, 0.5, 0.28, 0);
  const sign = box(bus, 0.3, 0.07, 0.01, glow(0xff9a3a), 0.35, 0.39, 0.19);
  sign.material.transparent = true;
  for (const x of [-0.32, 0.32]) for (const z of [-0.18, 0.18]) box(bus, 0.14, 0.14, 0.04, ghostMat, x, 0.07, z);
  bus.scale.setScalar(0.9);
  scene.add(bus);
  const busState = { from: front[0], to: [...front[0].next][0], prev: null, k: 0, fade: 1, gone: 0 };
  hitBox(bus, 1.2, 0.6, 0.5, 0, 0.25, 0, (h) => {
    if (busState.gone > 0) return;
    busState.gone = 4.5;
    say(bus.position.clone().add(V(0, 0.9, 0)), "這班車預計 5 分鐘後到站");
    sfx.bus?.();
  });

  // its bus stop on the front road
  const stopNode = front[3] || front[0];
  const stop = new THREE.Group();
  stop.position.set(stopNode.x + 0.25, 0, stopNode.z + 0.25);
  box(stop, 0.04, 0.9, 0.04, mat(0x9aa0a8, { metalness: 0.4 }), 0, 0.45, 0);
  box(stop, 0.32, 0.22, 0.03, mat(0x2c6db5), 0, 0.82, 0);
  box(stop, 0.24, 0.07, 0.035, glow(0xff5a3a), 0, 0.66, 0);
  scene.add(stop);
  hitBox(stop, 0.5, 1.0, 0.4, 0, 0.5, 0, () => {
    say(stop.position.clone().add(V(0, 1.2, 0)), "下一班：∞ 分鐘");
    sfx.stop?.();
  });

  // ---- 2. Route 74, jammed: an elevated road along the south edge with cars barely moving ----
  const hwy = new THREE.Group();
  const hz = bounds.max.z + S * 1.7,
    x0 = bounds.min.x - 3,
    x1 = bounds.max.x + 3,
    L = x1 - x0,
    H = 0.95;
  box(hwy, L, 0.1, 0.8, mat(0x5a5a62), (x0 + x1) / 2, H, hz);
  box(hwy, L, 0.12, 0.04, mat(0x8a8a90), (x0 + x1) / 2, H + 0.1, hz + 0.4);
  box(hwy, L, 0.12, 0.04, mat(0x8a8a90), (x0 + x1) / 2, H + 0.1, hz - 0.4);
  for (let x = x0 + 0.6; x < x1; x += 1.8) box(hwy, 0.14, H, 0.14, mat(0x6e6e74), x, H / 2, hz);
  for (let x = x0 + 0.3; x < x1; x += 0.5) box(hwy, 0.2, 0.005, 0.03, glow(0xe8e2c8), x, H + 0.055, hz);
  // a green 74 gantry sign
  const gx = (x0 + x1) / 2 - 2;
  for (const dz of [-0.45, 0.45]) box(hwy, 0.04, 0.6, 0.04, mat(0x9aa0a8), gx, H + 0.35, hz + dz);
  box(hwy, 0.04, 0.04, 0.94, mat(0x9aa0a8), gx, H + 0.65, hz);
  box(hwy, 0.03, 0.26, 0.5, mat(0x1f7a3f), gx + 0.02, H + 0.52, hz);
  const tag = document.createElement("div");
  tag.innerHTML = `<span class="hwy-tag">74</span>`;
  const tagObj = new CSS2DObject(tag);
  tagObj.position.set(gx, H + 0.95, hz);
  hwy.add(tagObj);
  scene.add(hwy);
  const cars = [];
  const carCols = [0xc8102e, 0xf4f1ea, 0x2c6db5, 0x2b2b2b, 0xd9a520, 0x7f8c8d];
  for (const lane of [-0.2, 0.2])
    for (let i = 0; i * 0.42 < L; i++) {
      const c = new THREE.Group();
      box(c, 0.32, 0.1, 0.18, mat(carCols[Math.floor(rng() * carCols.length)]), 0, 0.07, 0);
      box(c, 0.16, 0.08, 0.16, mat(0x2a2c38), -0.02, 0.15, 0);
      box(c, 0.02, 0.04, 0.05, glow(0xff2a2a), lane > 0 ? 0.16 : -0.16, 0.08, 0.06);
      box(c, 0.02, 0.04, 0.05, glow(0xff2a2a), lane > 0 ? 0.16 : -0.16, 0.08, -0.06);
      c.position.set(0, H + 0.05, hz + lane);
      hwy.add(c);
      cars.push({ c, base: i * 0.42 + rng() * 0.08, dir: lane > 0 ? -1 : 1 });
    }
  let crawl = 0;
  const ETA = ["明年", "下個月", "退休前", "下輩子", "等捷運藍線通車"];
  hitBox(hwy, L, 0.5, 1.0, (x0 + x1) / 2, H + 0.2, hz, (h) => {
    say(h.point.clone().add(V(0, 0.8, 0)), `距離目的地 3 公里<br>預計抵達：${ETA[Math.floor(rng() * ETA.length)]}`);
    sfx.jam?.();
  });

  // ---- 3. the rat army: a pack that dashes along the roads every so often ----
  const ratMat = mat(0x6b6560),
    tailMat = mat(0xc9a3a0);
  const rats = new THREE.Group();
  const ratList = [];
  for (let i = 0; i < 9; i++) {
    const r = new THREE.Group();
    box(r, 0.16, 0.07, 0.08, ratMat, 0, 0.04, 0);
    box(r, 0.06, 0.05, 0.06, ratMat, 0.1, 0.05, 0);
    box(r, 0.14, 0.012, 0.012, tailMat, -0.14, 0.03, 0);
    rats.add(r);
    ratList.push({ r, off: V((rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.3), ph: rng() * 6, v: null });
  }
  rats.visible = false;
  scene.add(rats);
  const ratState = { wait: 6, path: null, k: 0, scatter: 0 };
  hitBox(rats, 1.6, 0.6, 1.6, 0, 0.2, 0, () => {
    if (!rats.visible || ratState.scatter > 0) return;
    ratState.scatter = 1.6;
    for (const x of ratList) x.v = V((rng() - 0.5) * 3, 0, (rng() - 0.5) * 3);
    say(rats.position.clone().add(V(0, 0.8, 0)), "老鼠大軍 +1");
    sfx.rats?.();
  });

  // ---- 4. traffic-enforcement camera beside wobbly lane markings ----
  // a junction in the middle of the city, where it isn't hidden behind the 74 viaduct
  const mid = V((bounds.min.x + bounds.max.x) / 2, 0, bounds.max.z - S * 0.9);
  const camNode = [...all].sort((a, b) => Math.hypot(a.x - mid.x, a.z - mid.z) - Math.hypot(b.x - mid.x, b.z - mid.z))[0];
  const camNext = [...camNode.next].sort((a, b) => b.z - a.z)[0];
  const cam = new THREE.Group();
  cam.position.set(camNode.x - 0.3, 0, camNode.z + 0.3);
  box(cam, 0.06, 1.3, 0.06, mat(0xc9c3b4), 0, 0.65, 0);
  box(cam, 0.4, 0.04, 0.04, mat(0xc9c3b4), 0.18, 1.28, 0);
  box(cam, 0.16, 0.12, 0.2, mat(0xeeeeee), 0.34, 1.2, 0);
  box(cam, 0.06, 0.06, 0.02, mat(0x1d1d24), 0.34, 1.2, 0.11);
  const camLed = box(cam, 0.05, 0.05, 0.05, glow(0xff2a2a), 0.25, 1.2, 0.08);
  scene.add(cam);
  // a lane line that wanders all over the road between two corners
  const wob = new THREE.Group();
  const lineMat = glow(0xe8e2c8);
  for (let i = 0; i <= 18; i++) {
    const u = i / 18;
    const x = camNode.x + (camNext.x - camNode.x) * u,
      z = camNode.z + (camNext.z - camNode.z) * u;
    const dx = camNext.x - camNode.x,
      dz = camNext.z - camNode.z,
      len = Math.hypot(dx, dz) || 1;
    const off = Math.sin(u * Math.PI * 4) * 0.22;
    const seg = box(wob, 0.12, 0.004, 0.03, lineMat, x + (-dz / len) * off, 0.012, z + (dx / len) * off);
    seg.rotation.y = -Math.atan2(dz, dx) + Math.cos(u * Math.PI * 4) * 0.9;
  }
  scene.add(wob);
  hitBox(cam, 0.6, 1.5, 0.5, 0.15, 0.75, 0, () => {
    document.body.classList.remove("flash");
    void document.body.offsetWidth;
    document.body.classList.add("flash");
    say(cam.position.clone().add(V(0.3, 1.7, 0)), `<b>罰單</b>　違規事實：未依標線行駛<br><small>（標線本身也沒依標線）</small>`);
    sfx.shutter?.();
  });

  // ---- 5. the Blue Line's tunnel boring machine: parked in a fenced pit, rusting, cutter head not turning ----
  const tbm = new THREE.Group();
  const tx = bounds.max.x + S * 1.2,
    tz = bounds.max.z - S * 0.2;
  tbm.position.set(tx, groundAt(tx, tz), tz);
  tbm.rotation.y = -0.5;
  // the pit, its fence and a faded sign
  box(tbm, 2.4, 0.04, 1.4, mat(0x4a3f36), 0, 0.01, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    box(tbm, 0.04, 0.3, 0.04, mat(0xd9a520), Math.cos(a) * 1.35, 0.15, Math.sin(a) * 0.85);
  }
  const rust = mat(0x8a5a3a, { roughness: 0.95 }),
    blue = mat(0x2c6db5, { roughness: 0.6 });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.7, 18).rotateZ(Math.PI / 2), blue);
  shell.position.set(0, 0.42, 0);
  tbm.add(shell);
  for (const x of [-0.5, 0, 0.5]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.08, 18).rotateZ(Math.PI / 2), rust);
    band.position.set(x, 0.42, 0);
    tbm.add(band);
  }
  // cutter head: a disc with spokes and teeth
  const head = new THREE.Group();
  head.position.set(0.88, 0.42, 0);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.08, 18).rotateZ(Math.PI / 2), rust);
  head.add(disc);
  for (let i = 0; i < 6; i++) {
    const sp = box(head, 0.03, 0.86, 0.06, mat(0x5a4a40), 0.05, 0, 0);
    sp.rotation.x = (i / 6) * Math.PI;
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    box(head, 0.06, 0.05, 0.05, mat(0x9aa0a8, { metalness: 0.5 }), 0.06, Math.cos(a) * 0.36, Math.sin(a) * 0.36);
  }
  tbm.add(head);
  // cobwebs and weeds say how long it has been waiting
  for (let i = 0; i < 6; i++) box(tbm, 0.03, 0.12 + rng() * 0.12, 0.03, mat(0x4e6b3a), -0.9 + rng() * 1.8, 0.08, 0.5 + rng() * 0.15);
  box(tbm, 0.5, 0.26, 0.02, mat(0x9a9488), -0.5, 0.95, 0.2);
  const tbmTag = document.createElement("div");
  tbmTag.innerHTML = `<span class="hwy-tag tbm-tag">捷運藍線</span>`;
  const tbmObj = new CSS2DObject(tbmTag);
  tbmObj.position.set(0, 1.25, 0);
  tbm.add(tbmObj);
  scene.add(tbm);
  let spin = 0;
  hitBox(tbm, 2.2, 1.1, 1.2, 0.1, 0.45, 0, () => {
    spin = 2.2; // the head lurches a quarter turn, coughs, and stops again
    say(tbm.position.clone().add(V(0, 1.6, 0)), `中捷藍線<br>8 年沒動工 1 公分<br>預算再增 1300 億`);
    sfx.tbm?.();
  });

  // ---- shared click and update ----
  // the hit boxes themselves are invisible, so skip only those whose prop is hidden (the bus while gone, rats off-screen)
  const shown = (o) => {
    for (let p = o.parent; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  function hitTest(ray) {
    const h = ray.intersectObjects(
      hits.map((x) => x[0]).filter(shown),
      false,
    )[0];
    return h ? [h, hits.find((x) => x[0] === h.object)[1]] : null;
  }
  function tryClick(ray) {
    const r = hitTest(ray);
    if (!r) return false;
    r[1](r[0]);
    return true;
  }

  function update(t, dt) {
    const d = Math.min(dt, 0.05);
    // ghost bus drives the road ring, vanishes when clicked, and turns up somewhere else
    const b = busState;
    if (b.gone > 0) {
      b.gone -= Math.max(d, 1 / 60);
      b.fade = Math.max(0, b.fade - d * 2.5);
      if (b.gone <= 0) {
        b.from = anyNode();
        b.to = step(b.from, null);
        b.k = 0;
      }
    } else b.fade = Math.min(1, b.fade + d * 1.2);
    const len = Math.hypot(b.to.x - b.from.x, b.to.z - b.from.z) || 1;
    if (b.gone <= 0) b.k += (d * 0.9) / len;
    if (b.k >= 1) {
      const n = step(b.to, b.from);
      b.prev = b.from;
      b.from = b.to;
      b.to = n;
      b.k = 0;
    }
    bus.position.set(b.from.x + (b.to.x - b.from.x) * b.k, 0.02 + Math.sin(t * 2) * 0.03, b.from.z + (b.to.z - b.from.z) * b.k);
    bus.rotation.y = -Math.atan2(b.to.z - b.from.z, b.to.x - b.from.x);
    const flick = 0.75 + Math.sin(t * 13) * 0.15 + (Math.sin(t * 3.1) > 0.95 ? -0.5 : 0);
    ghostMat.opacity = 0.5 * b.fade * flick;
    winMat.opacity = 0.8 * b.fade * flick;
    sign.material.opacity = b.fade;
    bus.visible = b.fade > 0.02;

    // 74: stop, creep a few centimetres, stop again
    crawl += d * 0.08 * Math.pow(Math.max(0, Math.sin(t * 0.6)), 6);
    for (const c of cars) {
      const u = (((c.base + crawl * c.dir) % L) + L) % L;
      c.c.position.x = x0 + u;
      c.c.rotation.y = c.dir > 0 ? 0 : Math.PI;
    }

    // rats: wait, then dash along four road edges; scatter when clicked
    const rs = ratState;
    if (!rats.visible) {
      rs.wait -= d;
      if (rs.wait <= 0) {
        const a = anyNode();
        rs.path = [a];
        for (let i = 0; i < 4; i++) rs.path.push(step(rs.path[i], rs.path[i - 1]));
        rs.k = 0;
        rats.position.set(a.x, 0.01, a.z);
        rats.updateMatrixWorld(true);
        rats.visible = true;
        for (const x of ratList) {
          x.v = null;
          x.r.position.copy(x.off);
          x.r.visible = true;
        }
      }
    } else if (rs.scatter > 0) {
      rs.scatter -= Math.max(d, 1 / 60);
      for (const x of ratList) {
        x.r.position.addScaledVector(x.v, d);
        x.r.rotation.y = -Math.atan2(x.v.z, x.v.x);
      }
      if (rs.scatter <= 0) {
        rats.visible = false;
        rs.wait = 10 + rng() * 10;
      }
    } else {
      rs.k += d * 0.9;
      const seg = Math.floor(rs.k),
        f = rs.k - seg;
      if (seg >= rs.path.length - 1) {
        rats.visible = false;
        rs.wait = 8 + rng() * 10;
      } else {
        const a = rs.path[seg],
          c = rs.path[seg + 1];
        rats.position.set(a.x + (c.x - a.x) * f, 0.01, a.z + (c.z - a.z) * f);
        const ang = -Math.atan2(c.z - a.z, c.x - a.x);
        for (const x of ratList) {
          x.r.position.set(x.off.x, Math.abs(Math.sin(t * 22 + x.ph)) * 0.03, x.off.z);
          x.r.rotation.y = ang;
        }
      }
    }

    camLed.visible = Math.sin(t * 5) > 0;

    if (spin > 0) {
      spin = Math.max(0, spin - Math.max(d, 1 / 60));
      head.rotation.x += d * 3 * Math.min(1, spin) * (spin > 1.6 ? 1 : 0.4);
      tbm.position.y = groundAt(tx, tz) + (spin > 0.6 ? Math.sin(t * 60) * 0.008 : 0);
    }
  }

  return { tryClick, isHit: (ray) => !!hitTest(ray), update };
}
