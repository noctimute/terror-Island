// Lumama: one big chibi with a pale glowing face and a wide laugh who wanders the road network between the islands.
// The roads are the edges of the layout hexes (radius S) around every cell, so she never walks through a model.
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { S, hexVertex } from "./world.js?v=1";

export function createLumama(THREE, { scene, centers, CSS2DObject, rng }) {
  // ---- road graph from hex corners ----
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

  // ---- figure ----
  const g = new THREE.Group();
  g.name = "lumama";
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
  const shirt = mat(0xf4f1ea);
  const face = new THREE.MeshStandardMaterial({ color: 0xeef6c4, emissive: 0xc4ec7a, emissiveIntensity: 0.85, roughness: 0.5 });
  const hair = mat(0x6a4232);
  const shade = new THREE.MeshBasicMaterial({ color: 0x5a6a3a });
  const ink = new THREE.MeshBasicMaterial({ color: 0x1a0f0c });
  const mouthIn = new THREE.MeshBasicMaterial({ color: 0x3a0f10 });
  const pants = mat(0x2c2a30);
  const palm = new THREE.MeshStandardMaterial({ color: 0xe6efb8, emissive: 0x7aa040, emissiveIntensity: 0.4, roughness: 0.6 });
  const add = (geo, m, x, y, z, s = [1, 1, 1], r = [0, 0, 0], parent = g) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(...s);
    mesh.rotation.set(...r);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const sph = new THREE.SphereGeometry(0.5, 20, 14);
  add(new RoundedBoxGeometry(0.42, 0.42, 0.3, 3, 0.1), shirt, 0, 0.45, 0);
  const legs = [-0.09, 0.09].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.26, 0);
    g.add(pivot);
    add(new THREE.BoxGeometry(0.1, 0.24, 0.1).translate(0, -0.12, 0), pants, 0, 0, 0, [1, 1, 1], [0, 0, 0], pivot);
    return pivot;
  });
  const arms = [-0.25, 0.25].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.6, 0);
    g.add(pivot);
    add(new THREE.BoxGeometry(0.09, 0.28, 0.09).translate(0, -0.14, 0), shirt, 0, 0, 0, [1, 1, 1], [0, 0, x > 0 ? -0.15 : 0.15], pivot);
    // open palm at the end of the arm, slapping the drum head
    add(sph, palm, x > 0 ? -0.04 : 0.04, -0.3, 0.01, [0.1, 0.05, 0.12], [0, 0, 0], pivot);
    return pivot;
  });
  const head = new THREE.Group();
  head.position.y = 0.92;
  g.add(head);
  add(sph, face, 0, -0.01, 0, [0.48, 0.55, 0.44], [0, 0, 0], head);
  // short brown bob: full on top, side-swept fringe falling to her right, tucked behind the ears, short at the nape
  add(sph, hair, 0, 0.1, -0.05, [0.56, 0.4, 0.54], [0, 0, 0], head);
  add(sph, hair, -0.06, 0.18, 0.1, [0.42, 0.14, 0.3], [0.5, 0, 0.32], head);
  add(sph, hair, 0.08, 0.13, 0.17, [0.3, 0.09, 0.12], [0.35, 0, -0.42], head);
  for (const x of [-0.235, 0.235]) add(sph, hair, x, 0.02, -0.03, [0.1, 0.32, 0.3], [0, 0, x > 0 ? 0.12 : -0.12], head);
  add(sph, hair, 0, -0.05, -0.15, [0.44, 0.28, 0.2], [0, 0, 0], head);
  // shadowed brows and narrow laughing eyes squeezed into dark slits
  const arc = new THREE.TorusGeometry(0.042, 0.012, 4, 10, Math.PI);
  for (const x of [-0.095, 0.095]) {
    add(arc, ink, x, 0.03, 0.214, [1, 0.7, 1], [0, 0, 0], head);
  }
  // nose with dark nostrils
  // an oversized bulbous nose with big dark nostrils and a shadow under it
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xcfe08e, emissive: 0x6e9a34, emissiveIntensity: 0.55, roughness: 0.6 });
  add(sph, noseMat, 0, -0.03, 0.245, [0.15, 0.13, 0.13], [0, 0, 0], head);
  add(sph, noseMat, 0, 0.03, 0.235, [0.06, 0.1, 0.06], [0, 0, 0], head);
  for (const x of [-0.035, 0.035]) add(sph, ink, x, -0.075, 0.272, [0.05, 0.028, 0.03], [0, 0, x > 0 ? -0.3 : 0.3], head);
  add(sph, shade, 0, -0.095, 0.23, [0.16, 0.03, 0.04], [0, 0, 0], head);
  // wide-open laugh: dark mouth, upper teeth, a lower lip
  add(sph, mouthIn, 0, -0.165, 0.19, [0.17, 0.12, 0.08], [0, 0, 0], head);
  add(new THREE.BoxGeometry(0.1, 0.03, 0.01), mat(0xffffff, { emissive: 0x777777 }), 0, -0.12, 0.236, [1, 1, 1], [0, 0, 0], head);
  add(sph, shade, 0, -0.215, 0.2, [0.1, 0.02, 0.03], [0, 0, 0], head);
  // shirt collar
  for (const x of [-0.06, 0.06]) add(new THREE.BoxGeometry(0.12, 0.05, 0.02), shirt, x, 0.64, 0.155, [1, 1, 1], [0, 0, x > 0 ? -0.5 : 0.5]);
  // a little drum hung in front of her, played with both hands
  const drum = new THREE.Group();
  drum.position.set(0, 0.36, 0.27);
  g.add(drum);
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.13, 18), mat(0xc8102e), 0, 0, 0, [1, 1, 1], [0, 0, 0], drum);
  add(new THREE.CylinderGeometry(0.152, 0.152, 0.012, 18), mat(0xf4f1ea), 0, 0.068, 0, [1, 1, 1], [0, 0, 0], drum);
  add(new THREE.CylinderGeometry(0.155, 0.155, 0.02, 18), mat(0xd9a520), 0, -0.06, 0, [1, 1, 1], [0, 0, 0], drum);
  // a faint halo of light around the face
  const glow = new THREE.PointLight(0xb8ff7a, 1.4, 2.4, 2);
  glow.position.set(0, 1.25, 0.9);
  g.add(glow);
  g.scale.setScalar(1.8);

  const el = document.createElement("div");
  el.className = "lumama-tag";
  el.textContent = "Lumama";
  const tag = new CSS2DObject(el);
  tag.position.set(0, 1.42, 0);
  g.add(tag);
  scene.add(g);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    celebrate();
  });

  // invisible hit box for clicks, and a gold-coin burst with a floating "民調第一名 +1"
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.6), new THREE.MeshBasicMaterial());
  hit.position.y = 0.7;
  hit.visible = false;
  g.add(hit);
  const coinGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.025, 16);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffc93a, toneMapped: false });
  const coins = [];
  const pops = [];
  function celebrate(onClick) {
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(coinGeo, coinMat);
      c.position.set(g.position.x, 1.9 * g.scale.y, g.position.z);
      const a = rng() * Math.PI * 2,
        sp = 0.8 + rng() * 1.2;
      c.userData = { vx: Math.cos(a) * sp, vy: 2.8 + rng() * 1.8, vz: Math.sin(a) * sp, life: 1.6, spin: 6 + rng() * 8 };
      scene.add(c);
      coins.push(c);
    }
    // CSS2DRenderer owns the wrapper's transform, so the float-up runs on an inner span, driven from update()
    const t = document.createElement("div");
    t.innerHTML = '<span class="lumama-pop">民調第一名 +1</span>';
    const pop = new CSS2DObject(t);
    pop.position.set(0, 1.85, 0);
    g.add(pop);
    pops.push({ obj: pop, span: t.firstChild, age: 0 });
    onClick?.();
  }

  // ---- wandering ----
  const list = [...nodes.values()];
  let from = list[Math.floor(rng() * list.length)];
  let prev = null;
  let to = [...from.next][0];
  let k = 0;
  const SPEED = 0.55;
  function pick() {
    const opts = [...to.next].filter((n) => n !== from);
    const nxt = opts[Math.floor(rng() * opts.length)] || from;
    prev = from;
    from = to;
    to = nxt;
    k = 0;
  }
  function update(t, dt) {
    for (let i = pops.length - 1; i >= 0; i--) {
      const q = pops[i];
      q.age += Math.max(dt, 1 / 60);
      const k = q.age / 1.6;
      const sc = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : 1.15 - Math.min(1, (k - 0.15) / 0.2) * 0.15;
      q.span.style.transform = `translateY(${-k * 46}px) scale(${sc})`;
      q.span.style.opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      if (k >= 1) {
        g.remove(q.obj);
        q.obj.element.remove();
        pops.splice(i, 1);
      }
    }
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i],
        u = c.userData;
      u.vy -= 9 * dt;
      c.position.x += u.vx * dt;
      c.position.y = Math.max(0.03, c.position.y + u.vy * dt);
      c.position.z += u.vz * dt;
      c.rotation.x += u.spin * dt;
      u.life -= dt;
      if (u.life <= 0) {
        scene.remove(c);
        coins.splice(i, 1);
      }
    }
    const len = Math.hypot(to.x - from.x, to.z - from.z) || 1;
    k += (dt * SPEED) / len;
    if (k >= 1) pick();
    const x = from.x + (to.x - from.x) * k,
      z = from.z + (to.z - from.z) * k;
    g.position.set(x, Math.abs(Math.sin(t * 7)) * 0.04, z);
    const want = Math.atan2(to.x - from.x, to.z - from.z);
    let d = want - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 6);
    const sw = Math.sin(t * 7) * 0.5;
    legs[0].rotation.x = sw;
    legs[1].rotation.x = -sw;
    // left and right hands take turns beating the drum
    const beat = t * 8;
    arms[0].rotation.set(-0.8 - Math.max(0, Math.sin(beat)) * 0.5, 0, 0.4);
    arms[1].rotation.set(-0.8 - Math.max(0, -Math.sin(beat)) * 0.5, 0, -0.4);
    drum.position.y = 0.36 + Math.abs(Math.sin(beat)) * 0.01;
    head.rotation.z = Math.sin(t * 3.5) * 0.08;
    glow.intensity = 0.9 + Math.sin(t * 2) * 0.3;
  }
  return { group: g, hit, update, celebrate };
}
