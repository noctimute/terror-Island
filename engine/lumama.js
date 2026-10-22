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
  const face = new THREE.MeshStandardMaterial({ color: 0xfff6d6, emissive: 0xfff1b8, emissiveIntensity: 0.9, roughness: 0.5 });
  const hair = mat(0x5a3b2a);
  const ink = new THREE.MeshBasicMaterial({ color: 0x1a0f0c });
  const mouthIn = new THREE.MeshBasicMaterial({ color: 0x3a0f10 });
  const pants = mat(0x2c2a30);
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
    return pivot;
  });
  const head = new THREE.Group();
  head.position.y = 0.92;
  g.add(head);
  add(sph, face, 0, 0, 0, [0.5, 0.52, 0.46], [0, 0, 0], head);
  // brown bob: cap over the top and back, bangs across the forehead, flaps over the ears
  add(sph, hair, 0, 0.08, -0.04, [0.55, 0.44, 0.52], [0, 0, 0], head);
  add(new THREE.BoxGeometry(0.46, 0.1, 0.08), hair, 0, 0.17, 0.17, [1, 1, 1], [0.35, 0, 0], head);
  for (const x of [-0.25, 0.25]) add(new THREE.BoxGeometry(0.08, 0.3, 0.32), hair, x, -0.02, -0.01, [1, 1, 1], [0, 0, x > 0 ? 0.1 : -0.1], head);
  // squeezed-shut laughing eyes (^ ^) and a big open laugh
  for (const x of [-0.09, 0.09]) for (const r of [0.5, -0.5]) add(new THREE.BoxGeometry(0.06, 0.014, 0.01), ink, x + (r > 0 ? -0.02 : 0.02), 0.05, 0.225, [1, 1, 1], [0, 0, r], head);
  add(sph, mouthIn, 0, -0.09, 0.2, [0.17, 0.13, 0.06], [0, 0, 0], head);
  add(new THREE.BoxGeometry(0.12, 0.02, 0.01), mat(0xf4f1ea), 0, -0.04, 0.228, [1, 1, 1], [0, 0, 0], head);
  // a faint halo of light around the face
  const glow = new THREE.PointLight(0xfff1b8, 1.2, 2.2, 2);
  glow.position.set(0, 0.95, 0.4);
  g.add(glow);
  g.scale.setScalar(1.8);

  const el = document.createElement("div");
  el.className = "lumama-tag";
  el.textContent = "Lumama";
  const tag = new CSS2DObject(el);
  tag.position.set(0, 1.42, 0);
  g.add(tag);
  scene.add(g);

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
    arms[0].rotation.x = -sw * 0.8;
    arms[1].rotation.x = sw * 0.8;
    head.rotation.z = Math.sin(t * 3.5) * 0.08;
    glow.intensity = 0.9 + Math.sin(t * 2) * 0.3;
  }
  return { group: g, update };
}
