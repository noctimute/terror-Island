// Symbolic horror miniatures, one per zone. They are illustrations of fictional legends,
// not depictions of real buildings or locations.
//
// Instanced part kit: every static part is collected by geometry kind and drawn as one InstancedMesh,
// so the whole island costs a few dozen draw calls. Moving parts go into small per-zone groups instead.
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { TOP, WILD_TOP } from "./world.js?v=1";

const C = {
  wood: 0x6b4a32, dwood: 0x3e2a1f, stone: 0x8a8580, dstone: 0x55504c, plaster: 0xcfc6b4, cream: 0xe2d6bd,
  red: 0x8e1c16, brick: 0x8f3b2c, tile: 0x5e2620, roof: 0x3b3436, white: 0xe8e4da, bone: 0xd8d0bf,
  metal: 0x6d7378, glass: 0x4d5f6a, straw: 0xc9a95a, leaf: 0x3f5532, dleaf: 0x2c3d2a, black: 0x161214,
  yellow: 0xd9b13a, water: 0x24434c, rope: 0x7a6248,
  warm: 0xffc46b, sick: 0x8dff9a, blood: 0xff2f24, pale: 0xcfe6ff, lamp: 0xffd88f,
};

export function createKit(THREE) {
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    rbox: new RoundedBoxGeometry(1, 1, 1, 2, 0.12),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
    cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
    cone: new THREE.ConeGeometry(0.5, 1, 12),
    pyr: new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4).scale(Math.SQRT2, 1, Math.SQRT2),
    sphere: new THREE.SphereGeometry(0.5, 14, 10),
    ico: new THREE.IcosahedronGeometry(0.5, 0),
    dome: new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    torus: new THREE.TorusGeometry(0.5, 0.06, 6, 28),
    gable: (() => {
      // triangular prism, base 1 wide on y=0, ridge at y=1, length 1 along z
      const s = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
      return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
    })(),
  };
  for (const g of Object.values(G)) g.computeBoundingSphere();

  const buckets = new Map();
  const roots = new Map();
  const dynMats = new Map();
  const dynGlow = [];
  const anims = [];
  const tmp = new THREE.Object3D();
  const stdMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.02 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  let built = [];

  const localMatrix = (x, y, z, sx, sy, sz, o) => {
    tmp.position.set(x, y, z);
    tmp.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    tmp.scale.set(sx, sy, sz);
    tmp.updateMatrix();
    return tmp.matrix.clone();
  };

  function material(zone, color, glow, own) {
    const key = `${color}|${glow ? 1 : 0}`;
    if (!dynMats.has(zone)) dynMats.set(zone, new Map());
    const cache = dynMats.get(zone);
    if (!own && cache.has(key)) return cache.get(key);
    const mat = glow
      ? new THREE.MeshBasicMaterial({ color, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
    mat.userData = { base: new THREE.Color(color), glow, dim: 0, flick: 1 };
    if (glow) dynGlow.push(mat);
    cache.set(own ? key + Math.random() : key, mat);
    return mat;
  }

  function helper(zone, base, dynGroup) {
    const put = (kind) => (x, y, z, sx, sy, sz, color, o = {}) => {
      const m = new THREE.Matrix4().multiplyMatrices(base, localMatrix(x, y, z, sx, sy, sz, o));
      if (dynGroup) {
        const mesh = new THREE.Mesh(G[kind], material(zone, color, o.glow, o.own));
        mesh.applyMatrix4(m);
        mesh.castShadow = !o.glow && o.shadow !== false;
        mesh.receiveShadow = !o.glow;
        dynGroup.add(mesh);
        return mesh;
      }
      const root = roots.get(zone);
      const world = new THREE.Matrix4().multiplyMatrices(root.matrix, m);
      const key = `${kind}|${o.glow ? 1 : 0}`;
      if (!buckets.has(key)) buckets.set(key, { kind, glow: !!o.glow, items: [] });
      buckets.get(key).items.push({ m: world, color: new THREE.Color(color), zone });
      return null;
    };
    const h = { zone };
    for (const k of Object.keys(G)) h[k] = put(k);
    h.sub = (x, y, z, ry = 0) => helper(zone, base.clone().multiply(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z)), dynGroup);
    h.dyn = (x, y, z, ry = 0) => {
      const g = new THREE.Group();
      g.applyMatrix4(base.clone().multiply(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z)));
      (dynGroup || roots.get(zone)).add(g);
      const d = helper(zone, new THREE.Matrix4(), g);
      d.node = g;
      return d;
    };
    h.anim = (fn) => anims.push({ zone, fn });
    return h;
  }

  return {
    C,
    zone(id, x, z, ry = 0) {
      const root = new THREE.Group();
      root.position.set(x, TOP, z);
      root.rotation.y = ry;
      root.updateMatrix();
      roots.set(id, root);
      return helper(id, new THREE.Matrix4(), null);
    },
    build(scene) {
      for (const root of roots.values()) scene.add(root);
      for (const b of buckets.values()) {
        const im = new THREE.InstancedMesh(G[b.kind], b.glow ? glowMat : stdMat, b.items.length);
        b.items.forEach((it, i) => {
          im.setMatrixAt(i, it.m);
          im.setColorAt(i, it.color);
        });
        im.castShadow = !b.glow;
        im.receiveShadow = !b.glow;
        im.userData = { items: b.items, glow: b.glow };
        im.computeBoundingSphere();
        scene.add(im);
        built.push(im);
      }
    },
    // Fade every zone not in `active` (null = everything active).
    setActive(active) {
      const fade = new THREE.Color(0x4a4548),
        c = new THREE.Color();
      for (const im of built) {
        im.userData.items.forEach((it, i) => {
          const off = active && !active.has(it.zone);
          c.copy(it.color);
          if (off) im.userData.glow ? c.multiplyScalar(0.12) : c.lerp(fade, 0.72);
          im.setColorAt(i, c);
        });
        im.instanceColor.needsUpdate = true;
      }
      for (const [zone, cache] of dynMats) for (const mat of cache.values()) mat.userData.dim = active && !active.has(zone) ? 1 : 0;
      for (const [zone, cache] of dynMats)
        for (const mat of cache.values()) if (!mat.userData.glow) mat.color.copy(mat.userData.base).lerp(fade, mat.userData.dim * 0.72);
    },
    update(t, dt, env) {
      const level = 0.28 + env.night * 1.5;
      glowMat.color.setScalar(level);
      for (const mat of dynGlow) {
        const u = mat.userData;
        mat.color.copy(u.base).multiplyScalar(level * u.flick * (u.dim ? 0.12 : 1));
      }
      for (const a of anims) a.fn(t, dt, env);
    },
    roots,
  };
}

// ---------- shared little builders ----------
// surface height of 火燒山島's hill (three stacked half-ellipsoids centred at -0.1, -0.15)
function hill_y(x, z) {
  const layer = (cx, cz, y0, rx, ry, rz) => {
    const u = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2;
    return u < 1 ? y0 + ry * Math.sqrt(1 - u) : 0;
  };
  return Math.max(layer(-0.1, -0.15, 0, 1.15, 1.0, 0.95), layer(0.05, -0.2, 0.75, 0.75, 0.65, 0.625), layer(0.15, -0.25, 1.4, 0.4, 0.4, 0.35)) - 0.03;
}
function house(p, x, z, w, d, h, wall, roof, ry = 0, lit = C.warm) {
  const s = p.sub(x, 0, z, ry);
  s.box(0, h / 2, 0, w, h, d, wall);
  s.pyr(0, h + 0.17, 0, w * 1.12, 0.34, d * 1.12, roof);
  s.box(-w * 0.22, h * 0.55, d / 2 + 0.005, 0.12, 0.14, 0.02, lit, { glow: true });
  s.box(w * 0.22, h * 0.55, d / 2 + 0.005, 0.12, 0.14, 0.02, lit, { glow: true });
  s.box(0, 0.13, d / 2 + 0.005, 0.12, 0.26, 0.02, C.dwood);
}
function deadTree(p, x, z, s = 1, ry = 0) {
  const t = p.sub(x, 0, z, ry);
  t.cyl(0, 0.35 * s, 0, 0.07 * s, 0.7 * s, 0.07 * s, C.dwood);
  t.cyl(0.1 * s, 0.6 * s, 0, 0.035 * s, 0.35 * s, 0.035 * s, C.dwood, { rz: -0.8 });
  t.cyl(-0.08 * s, 0.68 * s, 0, 0.03 * s, 0.3 * s, 0.03 * s, C.dwood, { rz: 0.9 });
}
function pine(p, x, z, s = 1) {
  p.cyl(x, 0.12 * s, z, 0.08 * s, 0.24 * s, 0.08 * s, C.dwood);
  p.cone(x, 0.55 * s, z, 0.5 * s, 0.75 * s, 0.5 * s, C.dleaf);
}
function bush(p, x, z, s = 1, col = C.leaf) {
  p.ico(x, 0.14 * s, z, 0.34 * s, 0.28 * s, 0.34 * s, col);
}
function lantern(p, x, y, z, col = C.blood, s = 1, o = {}) {
  p.cyl(x, y + 0.11 * s, z, 0.01, 0.08 * s, 0.01, C.black);
  return p.sphere(x, y, z, 0.13 * s, 0.16 * s, 0.13 * s, col, { glow: true, ...o });
}
function figure(p, x, z, body, head = 0xe6ddcf, s = 1, ry = 0) {
  const f = p.sub(x, 0, z, ry);
  f.cone(0, 0.17 * s, 0, 0.2 * s, 0.34 * s, 0.2 * s, body);
  f.sphere(0, 0.4 * s, 0, 0.15 * s, 0.15 * s, 0.15 * s, head);
}

// chibi figure with ✕✕ eyes; built facing +z inside a dyn group so it can be animated or laid flat
function qdead(d, s = 1) {
  d.rbox(0, 0.16 * s, 0, 0.2 * s, 0.24 * s, 0.14 * s, 0x5b6b8a);
  d.sphere(0, 0.4 * s, 0, 0.26 * s, 0.25 * s, 0.24 * s, 0xf0dcc8);
  d.box(0, 0.5 * s, -0.02 * s, 0.27 * s, 0.08 * s, 0.22 * s, 0x2b2222); // hair
  for (const ex of [-0.055, 0.055])
    for (const rz of [0.785, -0.785]) d.box(ex * s, 0.41 * s, 0.12 * s, 0.07 * s, 0.014 * s, 0.01 * s, C.black, { rz });
  d.box(0, 0.33 * s, 0.12 * s, 0.05 * s, 0.01 * s, 0.01 * s, C.black); // flat mouth
  d.cyl(-0.13 * s, 0.17 * s, 0, 0.04 * s, 0.16 * s, 0.04 * s, 0xf0dcc8, { rz: 0.5 });
  d.cyl(0.13 * s, 0.17 * s, 0, 0.04 * s, 0.16 * s, 0.04 * s, 0xf0dcc8, { rz: -0.5 });
}

// faceless black figure (white eyes with pin pupils, white grin); built facing +z in a dyn group.
// Returns its two arm pivots so a model can swing them.
function shadowman(d, s = 1) {
  const ink = 0x15141a;
  d.rbox(0, 0.24 * s, 0, 0.26 * s, 0.42 * s, 0.18 * s, ink);
  // tall bald head tapering to a pointed chin, with small ears
  d.sphere(0, 0.64 * s, 0, 0.28 * s, 0.36 * s, 0.28 * s, ink);
  d.cone(0, 0.47 * s, 0.01 * s, 0.2 * s, 0.16 * s, 0.2 * s, ink, { rx: Math.PI });
  for (const ex of [-1, 1]) d.sphere(ex * 0.145 * s, 0.64 * s, -0.01 * s, 0.05 * s, 0.1 * s, 0.05 * s, ink);
  // slanted, half-lidded white eyes with tiny pupils glancing sideways
  for (const ex of [-1, 1]) {
    const x = ex * 0.065 * s,
      y = 0.665 * s,
      rz = ex * 0.38;
    d.sphere(x, y, 0.126 * s, 0.1 * s, 0.05 * s, 0.03 * s, C.white, { glow: true, rz });
    d.sphere(x - ex * 0.006 * s, y + 0.024 * s, 0.13 * s, 0.112 * s, 0.05 * s, 0.032 * s, ink, { rz }); // heavy lid
    d.sphere(x + 0.012 * s, y - 0.004 * s, 0.142 * s, 0.014 * s, 0.014 * s, 0.006 * s, C.black);
  }
  // wide, crooked grin: a white crescent cut by a lopsided black upper lip
  d.sphere(0.01 * s, 0.54 * s, 0.116 * s, 0.19 * s, 0.075 * s, 0.03 * s, C.white, { glow: true, rz: -0.08 });
  d.sphere(0.0, 0.568 * s, 0.122 * s, 0.205 * s, 0.06 * s, 0.032 * s, ink, { rz: -0.12 }); // upper lip carves a smile
  d.box(0.01 * s, 0.53 * s, 0.132 * s, 0.11 * s, 0.005 * s, 0.004 * s, 0x3a3a40, { rz: -0.06 }); // teeth line
  const arms = [-0.16, 0.16].map((ax) => {
    const a = d.dyn(ax * s, 0.4 * s, 0);
    a.cyl(0, -0.13 * s, 0, 0.05 * s, 0.26 * s, 0.05 * s, ink);
    return a.node;
  });
  d.cyl(-0.07 * s, 0.02 * s, 0, 0.06 * s, 0.06 * s, 0.06 * s, ink);
  d.cyl(0.07 * s, 0.02 * s, 0, 0.06 * s, 0.06 * s, 0.06 * s, ink);
  return arms;
}

// ---------- the 16 legends ----------
// 國安島 motif: a gold hammer-and-sickle impression laid flat on the x/y plane of g, facing +z
function emblem(g, x, y, z, s, col = 0xffd23f) {
  for (let i = 0; i < 9; i++) {
    const a = -0.9 + (i / 8) * 3.6;
    g.box(x + Math.cos(a) * 0.3 * s, y + Math.sin(a) * 0.3 * s, z, 0.14 * s, 0.07 * s * (1 - i / 14), 0.01, col, { rz: a + Math.PI / 2 });
  }
  g.box(x - 0.3 * s, y - 0.33 * s, z, 0.07 * s, 0.2 * s, 0.01, col, { rz: 0.7 });
  g.box(x + 0.02 * s, y - 0.02 * s, z + 0.002, 0.06 * s, 0.68 * s, 0.01, col, { rz: 0.785 });
  g.box(x - 0.2 * s, y + 0.2 * s, z + 0.002, 0.3 * s, 0.1 * s, 0.01, col, { rz: -0.785 });
}

export const MODELS = {
  // islands still being written: one shared fenced site with a crane
  construction(p) {
    p.cyl(0, 0.01, 0, 2.7, 0.02, 2.5, 0x8a7a62);
    // hoarding around the plot, striped panels
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      p.box(Math.cos(a) * 1.45, 0.2, Math.sin(a) * 1.35, 0.62, 0.4, 0.04, i % 2 ? C.white : 0xe07a1f, { ry: -a + Math.PI / 2 });
    }
    // tower crane
    const cr = p.sub(0.55, 0, -0.45);
    cr.box(0, 1.3, 0, 0.16, 2.6, 0.16, C.yellow);
    for (let i = 0; i < 6; i++) cr.box(0, 0.2 + i * 0.42, 0.085, 0.16, 0.025, 0.01, 0x8a6a1e, { rz: 0.7 });
    cr.box(0, 2.62, 0, 0.26, 0.2, 0.26, C.yellow);
    cr.box(-0.55, 2.78, 0, 1.6, 0.08, 0.1, C.yellow);
    cr.box(0.38, 2.7, 0, 0.26, 0.2, 0.2, 0x5a5a5a);
    cr.cyl(-1.1, 2.4, 0, 0.012, 0.7, 0.012, C.black);
    cr.box(-1.1, 2.03, 0, 0.12, 0.05, 0.12, C.dstone);
    // half-built frame
    const fr = p.sub(-0.45, 0, -0.35);
    for (const [x, z] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]]) fr.box(x, 0.55, z, 0.06, 1.1, 0.06, C.stone);
    fr.box(0, 0.55, 0, 0.82, 0.05, 0.72, C.stone);
    fr.box(0, 1.1, 0, 0.82, 0.05, 0.72, C.stone);
    // sand pile, cones and a striped barrier
    p.cone(0.25, 0.15, 0.65, 0.6, 0.3, 0.5, 0xc9b07a);
    for (const [x, z] of [[-0.9, 0.75], [-0.6, 0.95], [0.9, 0.55]]) p.cone(x, 0.11, z, 0.13, 0.22, 0.13, 0xf06a1e);
    const bar = p.sub(-0.75, 0, 0.45, 0.3);
    bar.box(-0.25, 0.12, 0, 0.04, 0.24, 0.04, C.white);
    bar.box(0.25, 0.12, 0, 0.04, 0.24, 0.04, C.white);
    for (let i = 0; i < 4; i++) bar.box(-0.19 + i * 0.125, 0.22, 0, 0.12, 0.07, 0.02, i % 2 ? C.white : C.red);
    // blinking warning lamp on top of a cone
    const lamp = lantern(p.dyn(0.9, 0.27, 0.55), 0, 0, 0, 0xffa21a, 0.4, { own: true });
    p.anim((t) => (lamp.material.userData.flick = Math.sin(t * 5) > 0 ? 1 : 0.15));
  },

  // 01 大甲・大安：稻草人之田
  scarecrow(p, rng) {
    for (let i = -4; i <= 4; i++) {
      const x = i * 0.36;
      const len = 2 * (1.72 - Math.abs(x) * 0.58) - 0.35;
      p.box(x, 0.05, 0, 0.24, 0.1, len, i % 2 ? 0xa48b45 : 0xb9a050);
      p.box(x + 0.18, 0.012, 0, 0.1, 0.02, len - 0.1, C.water);
    }
    const coats = [0x5a4a3a, 0x6b5a48, 0x4a4e44, 0x6e4a3e, 0x55524a, 0x5e4a52, 0x4e4a3a];
    const spots = [[-1.0, -0.6], [-0.3, -1.1], [0.45, -0.75], [-0.75, 0.35], [0.0, 0.05], [0.8, 0.25], [-0.2, 0.95]];
    const scare = (h, x, z, coat, ry) => {
      h.cyl(x, 0.45, z, 0.05, 0.9, 0.05, C.dwood);
      h.box(x, 0.7, z, 0.66, 0.05, 0.05, C.dwood, { ry });
      h.box(x, 0.6, z, 0.3, 0.34, 0.16, coat, { ry });
      h.sphere(x, 0.95, z, 0.22, 0.22, 0.22, C.straw);
      h.cone(x, 1.11, z, 0.36, 0.16, 0.36, 0x8a6a2e);
    };
    spots.forEach(([x, z], i) => scare(p, x, z, coats[i], rng() - 0.5));
    // the eighth, in last year's yellow raincoat, keeps turning toward you
    const e = p.dyn(0.55, 0, 1.0);
    scare(e, 0, 0, C.yellow, 0);
    e.sphere(-0.05, 0.97, 0.1, 0.035, 0.035, 0.035, C.blood, { glow: true });
    e.sphere(0.05, 0.97, 0.1, 0.035, 0.035, 0.035, C.blood, { glow: true });
    p.anim((t) => (e.node.rotation.y = Math.sin(t * 0.35) * 0.6));
    house(p, 1.05, -0.95, 0.5, 0.45, 0.38, C.cream, C.roof, -0.3);
  },

  // 02 后里・外埔：垃圾山太空包（市政議題：垃圾去化）
  garbage(p, rng) {
    p.box(0, 0.01, 0.2, 2.9, 0.02, 2.2, 0x9a9384);
    // white wrapped bales stacked into a terraced wall that "breathes" at night
    const rows = [
      { n: 9, z: -0.95, y: 0 },
      { n: 8, z: -1.05, y: 0.3 },
      { n: 7, z: -1.15, y: 0.6 },
      { n: 5, z: -1.2, y: 0.9 },
      { n: 7, z: -0.55, y: 0 },
      { n: 6, z: -0.62, y: 0.3 },
    ];
    const breathing = [];
    rows.forEach((r, ri) => {
      for (let i = 0; i < r.n; i++) {
        const x = (i - (r.n - 1) / 2) * 0.31 + (ri % 2) * 0.05;
        if (Math.abs(x) > 1.55 - Math.abs(r.z) * 0.3) continue;
        const b = p.dyn(x, r.y + 0.15, r.z);
        b.cyl(0, 0, 0, 0.3, 0.3, 0.3, rng() < 0.08 ? 0xd8d6cc : 0xf1f0ea, { rx: Math.PI / 2, ry: (rng() - 0.5) * 0.3 });
        breathing.push({ n: b.node, ph: rng() * 6.3 });
      }
    });
    // one bale glows from inside
    const odd = p.dyn(0.62, 0.15, -0.2);
    odd.cyl(0, 0, 0, 0.3, 0.3, 0.3, 0xe8ffe0, { rx: Math.PI / 2, glow: true, own: true });
    breathing.push({ n: odd.node, ph: 1 });
    p.anim((t, dt, env) =>
      breathing.forEach((b) => {
        const k = 1 + Math.sin(t * 1.1 + b.ph * 0.15) * 0.05 * env.night;
        b.n.scale.set(k, k, 1);
      }),
    );
    // black ooze seeping toward the field
    for (let i = 0; i < 5; i++) p.cyl(-0.9 + i * 0.35, 0.025, -0.15 + (i % 2) * 0.15, 0.32, 0.01, 0.2, 0x1c1a16);
    p.box(-0.2, 0.025, 0.25, 0.12, 0.01, 0.6, 0x1c1a16, { ry: 0.3 });
    // excavator stacking bales with nobody in the cab
    const ex = p.sub(-0.55, 0, 0.75, 0.5);
    ex.box(0, 0.07, 0, 0.42, 0.14, 0.5, 0x2a2826);
    ex.box(0, 0.24, -0.04, 0.4, 0.2, 0.44, C.yellow);
    ex.box(0.1, 0.43, 0.05, 0.16, 0.2, 0.18, C.yellow);
    ex.box(0.1, 0.43, 0.141, 0.13, 0.13, 0.01, C.glass);
    const arm = ex.dyn(-0.06, 0.3, 0.2);
    arm.box(0, 0.22, 0.18, 0.07, 0.07, 0.55, C.yellow, { rx: -0.75 });
    const fore = arm.dyn(0, 0.42, 0.38);
    fore.box(0, -0.12, 0.12, 0.06, 0.06, 0.38, C.yellow, { rx: 0.9 });
    fore.box(0, -0.29, 0.25, 0.14, 0.1, 0.1, C.metal);
    p.anim((t, dt, env) => {
      arm.node.rotation.x = Math.sin(t * 0.6) * 0.18 * (0.3 + env.night);
      fore.node.rotation.x = Math.sin(t * 0.6 + 1) * 0.25 * (0.3 + env.night);
    });
    // second, teal excavator at the far side
    const ex2 = p.sub(1.0, 0, 0.35, -0.6);
    ex2.box(0, 0.07, 0, 0.36, 0.14, 0.44, 0x2a2826);
    ex2.box(0, 0.22, 0, 0.34, 0.18, 0.38, 0x2f8a86);
    ex2.box(0, 0.32, 0.25, 0.06, 0.06, 0.5, 0x2f8a86, { rx: -0.5 });
    p.box(1.1, 0.12, 1.0, 0.03, 0.24, 0.03, C.metal);
    p.box(1.1, 0.28, 1.0, 0.3, 0.12, 0.02, 0xe6c23a);
    deadTree(p, -1.2, 0.55, 1.0);
  },

  // 03 豐原・神岡：不打烊的餅舖
  bakery(p) {
    const walls = [0xcbbfa8, 0xd9cdb2, 0xbfae95];
    for (let i = -1; i <= 1; i++) {
      const x = i * 0.92,
        h = 0.95 + (i === 0 ? 0.2 : 0.05 * i);
      const s = p.sub(x, 0, -0.45);
      s.box(0, h / 2, 0, 0.86, h, 0.85, walls[i + 1]);
      s.box(0, h + 0.04, 0.02, 0.9, 0.08, 0.9, 0x8a7d6a);
      s.box(0, 0.42, 0.5, 0.86, 0.06, 0.2, 0x8a7d6a);
      s.box(-0.38, 0.2, 0.58, 0.06, 0.4, 0.06, walls[i + 1]);
      s.box(0.38, 0.2, 0.58, 0.06, 0.4, 0.06, walls[i + 1]);
      s.box(0, 0.68, 0.43, 0.5, 0.18, 0.02, C.warm, { glow: true });
      s.box(0, 0.19, 0.43, 0.6, 0.36, 0.02, i === 0 ? C.warm : 0x2a2422, { glow: i === 0 });
    }
    // the shop sign never switches off
    p.box(0.3, 0.95, 0.03, 0.12, 0.42, 0.04, C.blood, { glow: true });
    p.box(0, 0.47, 0.18, 0.86, 0.04, 0.2, C.red, { rx: 0.25 });
    p.dome(0.95, 0, -1.15, 0.6, 0.55, 0.6, C.brick);
    p.cyl(1.1, 0.55, -1.25, 0.12, 0.7, 0.12, C.brick);
    for (let i = 0; i < 4; i++) p.box(-0.6 + i * 0.12, 0.05 + (i % 2) * 0.1, 0.65, 0.1, 0.08, 0.1, C.red);
    lantern(p, -0.9, 0.55, 0.2, C.blood, 0.8);
    lantern(p, 0.9, 0.55, 0.2, C.blood, 0.8);
    house(p, -1.0, 0.95, 0.45, 0.4, 0.35, C.plaster, C.roof, 0.2);
    deadTree(p, 0.95, 0.9, 1.1);
  },

  // 04 東勢・石岡：舊山線九號隧道
  tunnel(p, rng) {
    p.dome(0.1, 0, -0.75, 3.0, 1.5, 1.9, 0x4b5a3a);
    for (let i = 0; i < 7; i++) pine(p, -0.9 + i * 0.3, -1.2 + (i % 2) * 0.25, 0.8 + rng() * 0.3);
    p.box(0, 0.48, 0.12, 1.05, 0.96, 0.3, C.dstone);
    p.box(0, 0.35, 0.16, 0.6, 0.66, 0.31, C.black);
    p.cyl(0, 0.68, 0.16, 0.6, 0.31, 0.6, C.black, { rx: Math.PI / 2 });
    p.box(0, 0.88, 0.28, 0.3, 0.1, 0.02, C.bone);
    for (const x of [-0.17, 0.17]) p.box(x, 0.03, 0.95, 0.03, 0.04, 1.6, C.metal);
    for (let i = 0; i < 8; i++) p.box(0, 0.015, 0.25 + i * 0.2, 0.5, 0.03, 0.07, C.dwood);
    // the dead signal that sometimes turns green
    p.cyl(0.62, 0.45, 0.8, 0.05, 0.9, 0.05, C.black);
    p.box(0.62, 0.9, 0.8, 0.14, 0.3, 0.1, C.black);
    const sig = p.dyn(0.62, 0.9, 0.86);
    const g = sig.sphere(0, 0.06, 0, 0.07, 0.07, 0.03, C.sick, { glow: true, own: true });
    const r = sig.sphere(0, -0.06, 0, 0.07, 0.07, 0.03, C.blood, { glow: true, own: true });
    p.anim((t) => {
      const green = Math.sin(t * 0.7) > 0.6;
      g.material.userData.flick = green ? 1 : 0.08;
      r.material.userData.flick = green ? 0.08 : 0.9 + Math.sin(t * 6) * 0.1;
    });
    // raincoat figure by the portal
    const rc = p.dyn(-0.62, 0, 0.6);
    rc.cone(0, 0.2, 0, 0.24, 0.42, 0.24, C.yellow);
    rc.sphere(0, 0.44, 0, 0.17, 0.17, 0.17, C.yellow);
    rc.sphere(0, 0.43, 0.06, 0.1, 0.1, 0.06, C.black);
    p.anim((t, dt, env) => (rc.node.visible = env.night > 0.4));
    bush(p, 1.1, 0.9);
    bush(p, -1.15, 0.95, 1.2);
  },

  // 05 和平・梨山：霧中梨園
  orchard(p, rng) {
    const trees = [[-1.0, -0.8], [-0.2, -1.2], [0.6, -0.9], [-1.15, 0.2], [1.05, 0.0], [-0.6, 1.0], [0.35, 1.05]];
    for (const [x, z] of trees) {
      p.cyl(x, 0.22, z, 0.08, 0.44, 0.08, C.dwood);
      p.ico(x, 0.55, z, 0.7, 0.32, 0.7, 0x45603a, { ry: rng() * 3 });
      for (let k = 0; k < 4; k++) {
        const a = k * 1.6 + rng();
        p.box(x + Math.cos(a) * 0.25, 0.36, z + Math.sin(a) * 0.25, 0.07, 0.09, 0.07, C.white);
      }
    }
    // the pear that grew too big
    p.sphere(0.05, 0.3, 0.05, 0.62, 0.58, 0.6, 0xc9c66a);
    p.sphere(0.05, 0.66, 0.05, 0.4, 0.38, 0.4, 0xc9c66a);
    p.cyl(0.05, 0.9, 0.05, 0.04, 0.16, 0.04, C.dwood, { rz: 0.2 });
    p.box(-0.03, 0.34, 0.33, 0.09, 0.05, 0.02, 0x6e6a2e);
    p.box(0.14, 0.34, 0.33, 0.09, 0.05, 0.02, 0x6e6a2e);
    p.box(0.05, 0.22, 0.34, 0.14, 0.04, 0.02, 0x6e6a2e);
    // ladder that grows one more rung into the fog
    const lad = p.sub(0.75, 0, 0.55, -0.5);
    lad.box(-0.12, 0.8, 0, 0.04, 1.65, 0.04, C.wood, { rx: -0.25 });
    lad.box(0.12, 0.8, 0, 0.04, 1.65, 0.04, C.wood, { rx: -0.25 });
    for (let i = 0; i < 7; i++) lad.box(0, 0.12 + i * 0.22, -0.03 - i * 0.055, 0.24, 0.03, 0.03, C.wood);
    house(p, -0.3, -0.25, 0.42, 0.36, 0.3, 0x8a8070, C.roof, 0.4, C.sick);
    return { mist: 9 };
  },

  // 06 清水・梧棲：霧港幽靈船
  ghostship(p) {
    p.box(0.25, 0.012, 0.45, 2.1, 0.03, 1.3, C.water);
    p.box(-0.65, 0.05, 0.45, 0.32, 0.06, 1.25, C.wood);
    for (let i = 0; i < 4; i++) p.cyl(-0.78, 0.05, 0.0 + i * 0.32, 0.06, 0.14, 0.06, C.dwood);
    const ship = p.dyn(0.4, 0.02, 0.45, 0.1);
    ship.box(0, 0.1, 0, 0.42, 0.2, 0.85, 0x2f3d3a);
    ship.pyr(0, 0.1, 0.52, 0.3, 0.2, 0.3, 0x2f3d3a, { rx: Math.PI / 2 });
    ship.box(0, 0.28, -0.15, 0.3, 0.2, 0.3, 0x5b6a60);
    ship.box(0, 0.3, 0.005, 0.22, 0.06, 0.02, C.sick, { glow: true });
    ship.cyl(0, 0.6, 0.15, 0.03, 0.75, 0.03, C.dwood);
    ship.box(0, 0.75, 0.15, 0.4, 0.02, 0.02, C.dwood);
    lantern(ship, 0, 0.98, 0.15, C.sick, 0.6);
    lantern(ship, 0.16, 0.24, 0.35, C.sick, 0.45);
    p.anim((t) => {
      ship.node.position.y = 0.02 + Math.sin(t * 1.3) * 0.015;
      ship.node.rotation.z = Math.sin(t * 0.9) * 0.05;
    });
    // lighthouse that blinks backwards
    const lh = p.sub(-1.0, 0, -0.85);
    for (let i = 0; i < 4; i++) lh.cyl(0, 0.17 + i * 0.3, 0, 0.36 - i * 0.04, 0.3, 0.36 - i * 0.04, i % 2 ? C.red : C.white);
    lh.cyl(0, 1.32, 0, 0.28, 0.06, 0.28, C.black);
    lh.cone(0, 1.55, 0, 0.3, 0.2, 0.3, C.red);
    const beam = p.dyn(-1.0, 1.42, -0.85);
    const lamp = beam.sphere(0, 0, 0, 0.18, 0.18, 0.18, C.pale, { glow: true, own: true });
    p.anim((t) => (lamp.material.userData.flick = Math.max(0.05, Math.sin(-t * 2.2)) ** 3));
    p.box(0.9, 0.22, -1.0, 0.7, 0.44, 0.45, 0x6b6e6a);
    p.gable(0.9, 0.44, -1.0, 0.5, 0.22, 0.75, 0x47504c, { ry: Math.PI / 2 });
    p.box(0.9, 0.18, -0.77, 0.25, 0.3, 0.02, C.sick, { glow: true });
    for (let i = 0; i < 3; i++) p.box(-0.2 + i * 0.16, 0.06, -0.6, 0.13, 0.12, 0.13, C.wood);
    figure(p, -0.62, -0.25, 0x2a3036, 0xb8c4c0, 0.8);
    return { mist: 10 };
  },

  // 07 大雅・潭子：紡車自轉的工廠
  factory(p) {
    p.box(0, 0.3, -0.45, 1.9, 0.6, 1.0, 0x7d736a);
    for (let i = 0; i < 4; i++) p.gable(-0.71 + i * 0.475, 0.6, -0.45, 0.47, 0.25, 1.0, 0x4d4a48, { rz: 0 });
    for (let i = 0; i < 6; i++) p.box(-0.8 + i * 0.32, 0.36, 0.055, 0.2, 0.16, 0.02, i % 3 === 1 ? C.warm : 0x2a2826, { glow: i % 3 === 1 });
    p.box(0, 0.18, 0.06, 0.34, 0.36, 0.02, C.black);
    p.cyl(-1.0, 0.95, -1.05, 0.26, 1.9, 0.26, C.brick);
    for (let i = 0; i < 3; i++) p.cyl(-1.0, 0.5 + i * 0.6, -1.05, 0.28, 0.05, 0.28, 0x5a2a20);
    // red cloth crawling out of the door
    for (let i = 0; i < 9; i++) p.box(0.04 * Math.sin(i), 0.015, 0.22 + i * 0.15, 0.24, 0.02, 0.16, C.red, { ry: Math.sin(i * 0.7) * 0.25 });
    const looms = [];
    for (const [x, z] of [[0.75, 0.45], [-0.7, 0.55]]) {
      const l = p.dyn(x, 0.32, z);
      l.torus(0, 0, 0, 0.55, 0.55, 1.4, C.wood);
      for (let k = 0; k < 4; k++) l.box(0, 0, 0, 0.03, 0.5, 0.03, C.wood, { rz: (k * Math.PI) / 4 });
      p.box(x, 0.12, z, 0.1, 0.24, 0.1, C.dwood);
      looms.push(l.node);
    }
    p.anim((t, dt, env) => looms.forEach((n, i) => (n.rotation.z -= dt * (0.4 + env.night * 2.2) * (i ? -1 : 1))));
    for (let i = 0; i < 3; i++) p.cyl(1.05 + (i % 2) * 0.18, 0.11, -1.05 + i * 0.17, 0.15, 0.22, 0.15, C.rust);
  },

  // 08 新社：吃人的花海迷宮
  maze(p, rng) {
    const walls = [
      [-1.2, -0.9, 2.4, 0], [-1.2, 0.9, 1.0, 0], [0.2, 0.9, 1.0, 0], [-1.2, -0.9, 1.8, 1], [1.2, -0.9, 1.8, 1],
      [-0.8, -0.5, 1.2, 0], [0.8, -0.5, 1.0, 1], [-0.8, -0.5, 1.0, 1], [-0.4, 0.1, 1.2, 0], [0.0, 0.1, 0.8, 1],
      [-0.4, 0.5, 0.4, 0], [0.4, -0.1, 0.6, 1],
    ];
    const blooms = [0xc58db0, 0xa66b96, 0xe6c3d6, 0xd9a24a];
    for (const [x, z, len, vert] of walls) {
      const n = Math.round(len / 0.2);
      for (let i = 0; i < n; i++) {
        const px = vert ? x : x + 0.1 + i * 0.2,
          pz = vert ? z + 0.1 + i * 0.2 : z;
        p.box(px, 0.15, pz, 0.21, 0.3, 0.21, 0x3e5a36);
        p.ico(px, 0.32, pz, 0.2, 0.12, 0.2, blooms[Math.floor(rng() * blooms.length)]);
      }
    }
    // entrance arch
    p.box(-0.08, 0.3, 0.9, 0.05, 0.6, 0.05, C.white);
    p.box(0.28, 0.3, 0.9, 0.05, 0.6, 0.05, C.white);
    p.box(0.1, 0.62, 0.9, 0.46, 0.08, 0.06, C.red);
    // sunflowers that turn to face you
    const flowers = [];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7;
      const x = Math.cos(a) * 1.45,
        z = Math.sin(a) * 1.25 + 0.15;
      p.cyl(x, 0.3, z, 0.03, 0.6, 0.03, 0x4a6a32);
      const f = p.dyn(x, 0.62, z);
      f.cyl(0, 0, 0, 0.3, 0.04, 0.3, C.yellow, { rx: Math.PI / 2 });
      f.cyl(0, 0, 0.02, 0.15, 0.03, 0.15, 0x3a2414, { rx: Math.PI / 2 });
      flowers.push(f.node);
    }
    p.anim((t, dt, env) => {
      for (const f of flowers) {
        const want = env.camAngle(f) * env.night + Math.sin(t * 0.3) * 0.2 * (1 - env.night);
        f.rotation.y += (want - f.rotation.y) * Math.min(1, dt * 1.5);
      }
    });
  },

  // 09 和平・谷關：第十三號湯屋
  onsen(p, rng) {
    const inn = p.sub(0, 0, -0.75);
    inn.box(0, 0.25, 0, 1.6, 0.5, 0.75, 0x5a4232);
    inn.pyr(0, 0.62, 0, 1.85, 0.26, 0.95, C.roof);
    inn.box(0.1, 0.92, 0, 1.0, 0.42, 0.55, 0x5a4232);
    inn.pyr(0, 1.27, 0, 1.25, 0.3, 0.75, C.roof);
    for (let i = 0; i < 5; i++) inn.box(-0.6 + i * 0.3, 0.3, 0.38, 0.18, 0.16, 0.02, C.warm, { glow: true });
    for (let i = 0; i < 3; i++) inn.box(-0.2 + i * 0.3, 0.95, 0.28, 0.16, 0.14, 0.02, C.warm, { glow: true });
    // the 13th door, off the end of the corridor
    p.box(1.05, 0.2, -0.45, 0.3, 0.4, 0.3, C.wood);
    p.box(1.05, 0.2, -0.29, 0.16, 0.3, 0.02, C.blood, { glow: true });
    const pool = p.dyn(-0.1, 0, 0.45);
    const water = pool.cyl(0, 0.03, 0, 1.25, 0.04, 0.95, 0x3d7d84, { own: true });
    p.anim((t, dt, env) => {
      water.material.color.setHex(0x3d7d84).lerp(water.material.userData.red || (water.material.userData.red = water.material.color.clone().setHex(0x8a2a24)), env.night * 0.75);
    });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      p.ico(-0.1 + Math.cos(a) * 0.7, 0.06, 0.45 + Math.sin(a) * 0.55, 0.22, 0.16, 0.2, C.dstone, { ry: rng() * 3 });
    }
    for (const x of [-1.15, 0.95]) {
      p.box(x, 0.12, 0.6, 0.08, 0.24, 0.08, C.stone);
      p.box(x, 0.3, 0.6, 0.18, 0.12, 0.18, C.warm, { glow: true });
      p.pyr(x, 0.42, 0.6, 0.24, 0.1, 0.24, C.stone);
    }
    for (let i = 0; i < 2; i++) p.box(1.0 + i * 0.07, 0.01, -0.12, 0.05, 0.02, 0.1, 0xb07a5a);
    pine(p, -1.25, -1.15, 1);
    pine(p, 1.2, -1.2, 0.9);
    return { mist: 6, mistY: 0.3 };
  },

  // 10 沙鹿・龍井：末班海線列車
  station(p) {
    p.box(0, 0.09, -0.15, 2.8, 0.18, 0.5, 0x8e8778);
    for (const x of [-1.0, 0, 1.0]) p.cyl(x, 0.4, -0.3, 0.05, 0.5, 0.05, C.metal);
    p.box(0, 0.67, -0.2, 2.4, 0.05, 0.55, 0x4e5450);
    p.box(-0.9, 0.3, -0.85, 0.75, 0.6, 0.5, C.cream);
    p.pyr(-0.9, 0.72, -0.85, 0.9, 0.24, 0.62, 0x556066);
    p.box(-0.9, 0.42, -0.59, 0.32, 0.12, 0.02, C.blood, { glow: true });
    for (const z of [0.42, 0.68]) p.box(0, 0.03, z, 3.1, 0.04, 0.03, C.metal);
    for (let i = 0; i < 14; i++) p.box(-1.5 + i * 0.23, 0.012, 0.55, 0.07, 0.025, 0.4, C.dwood);
    const chim = p.sub(1.05, 0, -1.0);
    for (let i = 0; i < 6; i++) chim.cyl(0, 0.15 + i * 0.3, 0, 0.24 - i * 0.015, 0.3, 0.24 - i * 0.015, i % 2 ? C.red : C.white);
    lantern(chim, 0, 1.85, 0, C.blood, 0.4);
    // the 23:59 train with no number
    const train = p.dyn(0, 0, 0.55);
    for (const x of [-0.55, 0.55]) {
      train.box(x, 0.24, 0, 1.0, 0.34, 0.32, 0x8ea094);
      train.box(x, 0.29, 0.165, 0.84, 0.1, 0.01, C.pale, { glow: true });
      train.box(x, 0.29, -0.165, 0.84, 0.1, 0.01, C.pale, { glow: true });
      train.box(x, 0.43, 0, 1.0, 0.04, 0.3, 0x58645e);
    }
    p.anim((t) => {
      const cycle = (t % 24) / 24;
      let x;
      if (cycle < 0.25) x = -3.2 + (cycle / 0.25) * 3.2;
      else if (cycle < 0.6) x = 0;
      else if (cycle < 0.85) x = ((cycle - 0.6) / 0.25) * 3.2;
      else x = 9;
      train.node.position.x = x;
      train.node.visible = Math.abs(x) < 1.35;
    });
  },

  // 11 墜落島（取材自真實新聞；人物為通用 Q 版示意，不對應任何特定死者）
  deathisle(p, rng) {
    // glass tower at the back, its upper floors scorched
    const tw = p.sub(-0.35, 0, -0.75);
    tw.box(0, 1.6, 0, 0.95, 3.2, 0.95, 0x6f7a86);
    tw.box(0, 3.24, 0, 1.02, 0.08, 1.02, 0x4a525c);
    for (let f = 0; f < 10; f++)
      for (let c = 0; c < 3; c++) {
        const y = 0.35 + f * 0.29,
          lit = rng() < 0.22,
          burnt = f === 7 && c > 0;
        tw.box(-0.28 + c * 0.28, y, 0.478, 0.18, 0.16, 0.02, burnt ? C.black : lit ? C.warm : C.glass, { glow: lit && !burnt });
      }
    tw.box(0.16, 2.4, 0.49, 0.5, 0.1, 0.02, 0x2a2224); // soot band
    // rooftop ledge where the little figure stands
    tw.box(0, 3.3, 0.42, 0.95, 0.06, 0.12, 0x8c939b);
    // two black figures stand back on the roof and only watch (the news says foul play was ruled out)
    const watchers = [-0.72, 0.02].map((x) => {
      const w = p.dyn(x, 3.33, -0.62);
      shadowman(w, 0.85);
      w.node.rotation.x = 0.2;
      return w.node;
    });
    p.anim((t) => watchers.forEach((n, i) => (n.rotation.z = Math.sin(t * 0.8 + i * 2) * 0.04)));
    // a fallen-then-reset Q figure: stands at the edge, drops, lies on the plaza, repeats
    const faller = p.dyn(-0.35, 3.33, -0.25);
    qdead(faller);
    const TOP_Y = 3.33;
    p.anim((t) => {
      const u = (t % 7) / 7;
      const n = faller.node;
      if (u < 0.35) {
        n.position.y = TOP_Y;
        n.position.z = -0.25;
        n.rotation.set(Math.sin(t * 3) * 0.08, 0, 0);
      } else if (u < 0.55) {
        const k = (u - 0.35) / 0.2;
        n.position.y = TOP_Y - (TOP_Y - 0.05) * k * k;
        n.position.z = -0.25 + k * 0.35;
        n.rotation.set(k * Math.PI * 1.5, 0, k * 0.6);
      } else {
        n.position.y = 0.05;
        n.position.z = 0.1;
        n.rotation.set(-Math.PI / 2, 0, 0.6);
      }
    });
    // police tape around the landing spot
    for (const x of [-0.85, 0.15]) p.cyl(x, 0.12, 0.15, 0.03, 0.24, 0.03, C.yellow);
    p.box(-0.35, 0.2, 0.15, 1.0, 0.03, 0.01, C.yellow);
    // memorial candles
    for (let i = 0; i < 5; i++) p.cyl(-0.75 + i * 0.1, 0.04, 0.32, 0.04, 0.08, 0.04, C.lamp, { glow: true });
    // second, lower block beside the tower
    const b2 = p.sub(0.85, 0, -0.85);
    b2.box(0, 0.8, 0, 0.6, 1.6, 0.6, 0x7d7470);
    for (let f = 0; f < 5; f++) b2.box(0, 0.3 + f * 0.28, 0.305, 0.4, 0.12, 0.02, f === 2 ? C.blood : C.glass, { glow: f === 2 });
    // city road in front of the tower: asphalt, lane dashes, a zebra crossing and a passing car
    p.box(0, 0.015, 0.95, 3.0, 0.03, 0.75, 0x2b2a2e);
    p.box(0, 0.04, 0.56, 3.0, 0.05, 0.06, 0x9a958c);
    p.box(0, 0.04, 1.34, 2.6, 0.05, 0.06, 0x9a958c);
    for (let i = 0; i < 6; i++) p.box(-1.25 + i * 0.5, 0.034, 0.95, 0.24, 0.01, 0.035, C.white);
    for (let i = 0; i < 5; i++) p.box(0.75, 0.034, 0.69 + i * 0.13, 0.42, 0.01, 0.07, C.white);
    const car = p.dyn(0, 0, 1.12);
    car.rbox(0, 0.1, 0, 0.42, 0.13, 0.2, 0x8e1c16);
    car.rbox(-0.02, 0.2, 0, 0.24, 0.1, 0.18, 0x4d5f6a);
    car.box(0.215, 0.1, 0.06, 0.01, 0.04, 0.04, C.lamp, { glow: true });
    car.box(0.215, 0.1, -0.06, 0.01, 0.04, 0.04, C.lamp, { glow: true });
    p.anim((t) => {
      const x = ((t * 0.35) % 1) * 3.6 - 1.8;
      car.node.position.x = x;
      car.node.visible = Math.abs(x) < 1.4;
    });
    lantern(p, 1.25, 0.6, 0.5, C.lamp, 0.5);
    p.cyl(1.25, 0.25, 0.5, 0.03, 0.5, 0.03, C.black);
    return { mist: 3, mistY: 0.2 };
  },

  // 15 中區・南屯：漂浮島（虛構傳說）——黑水湖中央的小島會飄，四周浮著 ✕✕ 小人
  floatisle(p, rng) {
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      p.ico(Math.cos(a) * 1.55, 0.05, Math.sin(a) * 1.4, 0.3, 0.14, 0.24, i % 2 ? C.dstone : C.stone, { ry: a });
    }
    p.cyl(0, 0.03, 0, 3.1, 0.04, 2.8, 0x16262d);
    // the islet bobs and drifts in a slow circle
    const isl = p.dyn(0, 0.05, -0.15);
    isl.cone(0, -0.08, 0, 0.9, 0.3, 0.8, 0x5a4a3a, { rx: Math.PI });
    isl.cyl(0, 0.03, 0, 0.92, 0.06, 0.82, 0x4f6a3e);
    deadTree(isl, -0.12, 0.05, 0.9);
    for (let i = 0; i < 3; i++) isl.cyl(0.18 + i * 0.07, 0.08, 0.15, 0.03, 0.06, 0.03, C.lamp, { glow: true });
    p.anim((t) => {
      isl.node.position.y = 0.05 + Math.sin(t * 0.9) * 0.03;
      isl.node.position.x = Math.sin(t * 0.15) * 0.12;
      isl.node.rotation.y = t * 0.05;
    });
    const floaters = [];
    for (const [x, z, r] of [[-0.95, 0.55, 0.4], [-0.2, 0.95, -0.8], [0.7, 0.7, 2.1], [0.95, -0.55, 1.2], [-0.85, -0.6, -2.3]]) {
      const f = p.dyn(x, 0.07, z);
      qdead(f, 0.8);
      f.node.rotation.set(-Math.PI / 2, 0, r);
      floaters.push({ n: f.node, x, z, r, ph: rng() * 6 });
    }
    p.anim((t) => {
      for (const f of floaters) {
        f.n.position.y = 0.07 + Math.sin(t * 1.1 + f.ph) * 0.015;
        f.n.rotation.z = f.r + Math.sin(t * 0.3 + f.ph) * 0.25;
        f.n.position.x = f.x + Math.sin(t * 0.2 + f.ph) * 0.06;
      }
    });
    for (let i = 0; i < 7; i++) p.cone(1.3 + (i % 2) * 0.1, 0.14, -0.3 + i * 0.12, 0.05, 0.28, 0.05, 0x55704a, { rz: (rng() - 0.5) * 0.5 });
    return { mist: 5, mistY: 0.2 };
  },

  // 12 氣爆火災島（取材自真實新聞；建築與火焰為示意，不對應真實場址樣貌）
  disaster(p, rng) {
    // left: department store, its top floor blown out, flashes and debris looping
    const st = p.sub(-0.75, 0, -0.35);
    st.box(0, 1.05, 0, 0.95, 2.1, 0.85, 0x9b9488);
    for (let f = 0; f < 6; f++)
      for (let c = 0; c < 3; c++) st.box(-0.28 + c * 0.28, 0.3 + f * 0.27, 0.43, 0.2, 0.14, 0.02, f > 4 ? C.black : rng() < 0.3 ? C.warm : C.glass, { glow: f <= 4 && rng() < 0.3 });
    st.box(0, 2.0, 0.44, 0.95, 0.22, 0.04, 0x2a2224);
    const flash = p.dyn(-0.75, 1.95, 0.15);
    const fl = flash.sphere(0, 0, 0, 0.5, 0.35, 0.3, 0xffb347, { glow: true, own: true });
    const debris = [];
    for (let i = 0; i < 9; i++) {
      const d = p.dyn(-0.75, 1.95, 0.1);
      d.box(0, 0, 0, 0.06, 0.04, 0.05, i % 3 ? C.dstone : C.glass);
      debris.push({ n: d.node, vx: (rng() - 0.5) * 1.6, vy: 0.6 + rng() * 0.8, vz: 0.3 + rng() * 0.9 });
    }
    // right: long warehouse with flames on the roof and black smoke
    const wh = p.sub(0.7, 0, -0.2);
    wh.box(0, 0.42, 0, 1.0, 0.84, 1.3, 0x8a8f94);
    for (let i = 0; i < 7; i++) wh.box(0.505, 0.42, -0.55 + i * 0.18, 0.01, 0.8, 0.02, 0x6f747a);
    wh.box(0.505, 0.25, 0.3, 0.02, 0.5, 0.4, 0x3a3a3e);
    const flames = [];
    for (let i = 0; i < 6; i++) {
      const f = p.dyn(0.45 + (i % 3) * 0.25, 0.86, -0.6 + Math.floor(i / 3) * 0.55 + rng() * 0.2);
      const m = f.cone(0, 0.14, 0, 0.2, 0.32, 0.2, i % 2 ? 0xff6a1a : 0xffc23a, { glow: true, own: true });
      flames.push({ n: f.node, m, ph: rng() * 6 });
    }
    const smoke = [];
    for (let i = 0; i < 8; i++) {
      const sm = p.dyn(0.7, 1.1, -0.3);
      sm.sphere(0, 0, 0, 0.34, 0.3, 0.34, 0x262428);
      smoke.push({ n: sm.node, ph: i / 8, dx: (rng() - 0.5) * 0.5 });
    }
    // fire engine and a hose line
    const tr = p.sub(0.55, 0, 0.95);
    tr.rbox(0, 0.13, 0, 0.62, 0.2, 0.24, 0xc21f1f);
    tr.box(0.2, 0.26, 0, 0.18, 0.08, 0.2, 0xc21f1f);
    tr.box(-0.08, 0.27, 0, 0.42, 0.03, 0.06, C.metal, { rz: 0.35 });
    const beacon = lantern(p.dyn(0.75, 0.33, 0.95), 0, 0, 0, 0x3a7bff, 0.3, { own: true });
    p.cyl(0.25, 0.02, 0.62, 0.03, 0.02, 0.6, 0xe0d8c0, { rz: Math.PI / 2, ry: 0.6 });
    for (const x of [-1.05, -0.35]) p.box(x, 0.12, 0.6, 0.04, 0.24, 0.04, C.yellow);
    p.box(-0.7, 0.2, 0.6, 0.75, 0.03, 0.01, C.yellow);
    p.anim((t) => {
      // explosion loop every 4 s: a fireball swells for about a second, then smoulders
      const u = (t % 4) / 4;
      const burst = u < 0.3 ? u / 0.3 : 0;
      flash.node.scale.setScalar(burst ? 0.6 + Math.sqrt(burst) * 1.6 : 0.45 + Math.sin(t * 7) * 0.05);
      fl.material.userData.flick = burst ? 1.6 - burst : 0.45;
      debris.forEach((d) => {
        const k = Math.min(u, 0.6) * 1.6;
        d.n.position.set(-0.75 + d.vx * k, 1.95 + d.vy * k - 2.2 * k * k, 0.1 + d.vz * k);
        d.n.visible = u < 0.6;
        d.n.rotation.set(k * 6, k * 4, 0);
      });
      flames.forEach((f) => {
        f.n.scale.set(1, 0.75 + Math.sin(t * 9 + f.ph) * 0.25 + Math.sin(t * 23 + f.ph) * 0.1, 1);
        f.m.material.userData.flick = 0.8 + Math.sin(t * 13 + f.ph) * 0.2;
      });
      smoke.forEach((sm) => {
        const k = (t * 0.18 + sm.ph) % 1;
        sm.n.position.set(0.7 + sm.dx * k - k * 0.3, 1.0 + k * 2.2, -0.3);
        sm.n.scale.setScalar(0.4 + k * 1.3);
      });
      beacon.material.userData.flick = Math.sin(t * 8) > 0 ? 1 : 0.1;
    });
    return { mist: 3, mistY: 0.25 };
  },

  // ---------- real-news islands added from the research repo (scenes are generic illustrations) ----------
  // 公安災害島：row houses on fire, fireworks over a plaza, a flooded car park ramp
  safetyisle(p, rng) {
    const flames = [];
    for (let i = 0; i < 3; i++) {
      house(p, -1.0 + i * 0.5, -0.75, 0.42, 0.5, 0.55, i % 2 ? 0x8a6e5a : 0x9a8070, C.roof, 0, C.warm);
      for (let k = 0; k < 2; k++) {
        const f = p.dyn(-1.08 + i * 0.5 + k * 0.16, 0.78, -0.75);
        flames.push({ n: f.node, m: f.cone(0, 0.1, 0, 0.16, 0.26, 0.16, k ? 0xffc23a : 0xff6a1a, { glow: true, own: true }), ph: rng() * 6 });
      }
    }
    // fireworks: a few sparks burst and fall on a loop
    const sparks = [];
    for (let i = 0; i < 10; i++) {
      const sp = p.dyn(0.75, 2.2, -0.4);
      sparks.push({ n: sp.node, m: sp.sphere(0, 0, 0, 0.07, 0.07, 0.07, [0xff4d6d, 0xffd166, 0x5ec8ff][i % 3], { glow: true, own: true }), a: (i / 10) * Math.PI * 2 });
    }
    p.cyl(0.75, 0.15, -0.4, 0.12, 0.3, 0.12, C.dstone);
    // flooded underground car park: ramp, water and a half-sunk car roof
    p.box(0.55, 0.02, 0.75, 1.1, 0.04, 0.7, 0x3a3a40);
    p.box(0.55, 0.05, 0.75, 1.0, 0.03, 0.6, 0x3f6f8f, { glow: false });
    p.rbox(0.45, 0.08, 0.72, 0.36, 0.08, 0.2, 0xc9c2b6);
    p.box(1.05, 0.35, 0.45, 0.04, 0.7, 0.04, C.metal);
    p.box(1.05, 0.66, 0.45, 0.26, 0.16, 0.02, 0x2c6db5);
    // fallen rebar cage at a construction edge
    for (let i = 0; i < 6; i++) p.cyl(-0.7 + i * 0.06, 0.05, 0.75, 0.02, 0.9, 0.02, 0x8a4a2a, { rz: Math.PI / 2 - 0.25, ry: 0.4 });
    for (const x of [-1.1, -0.3]) p.cone(x, 0.11, 1.0, 0.13, 0.22, 0.13, 0xf06a1e);
    p.anim((t) => {
      for (const f of flames) {
        f.n.scale.set(1, 0.7 + Math.sin(t * 9 + f.ph) * 0.3, 1);
        f.m.material.userData.flick = 0.8 + Math.sin(t * 13 + f.ph) * 0.2;
      }
      const u = (t % 3.2) / 3.2;
      for (const s of sparks) {
        const r = u * 0.9;
        s.n.position.set(0.75 + Math.cos(s.a) * r, 2.2 + Math.sin(s.a) * r * 0.8 - u * u * 0.8, -0.4);
        s.m.material.userData.flick = u < 0.85 ? 1 - u : 0;
      }
    });
    return { mist: 3, mistY: 0.3 };
  },

  // 食安島：night-market stalls, a tainted-oil factory, a quarantined pig pen
  foodisle(p, rng) {
    for (let i = 0; i < 3; i++) {
      const st = p.sub(-0.9 + i * 0.6, 0, -0.75);
      st.box(0, 0.18, 0, 0.5, 0.36, 0.34, 0x8a6a4a);
      st.gable(0, 0.45, 0, 0.6, 0.2, 0.44, [C.red, C.yellow, 0x2e9e5b][i]);
      for (let k = 0; k < 3; k++) st.cyl(-0.15 + k * 0.15, 0.39, 0.06, 0.1, 0.05, 0.1, C.white);
      lantern(st, 0, 0.42, 0.22, C.warm, 0.4);
    }
    // tainted-oil factory: grimy hall with a sawtooth roof, two oil tanks, pipes, a chimney of dark smoke, leaking drums
    const fac = p.sub(0.85, 0, -0.15);
    fac.box(0, 0.3, 0, 0.8, 0.6, 0.6, 0x7d7466);
    for (let i = 0; i < 3; i++) fac.gable(-0.27 + i * 0.27, 0.6, 0, 0.27, 0.16, 0.62, 0x4a4540, { rz: 0 });
    fac.box(0, 0.22, 0.305, 0.3, 0.36, 0.02, 0x3a332c);
    for (const x of [-0.28, 0.28]) fac.box(x, 0.42, 0.305, 0.14, 0.1, 0.02, C.sick, { glow: true });
    fac.box(0, 0.5, 0.31, 0.36, 0.08, 0.01, 0xc9a227);
    fac.cyl(0.28, 0.9, -0.18, 0.12, 0.7, 0.12, 0x5a524a);
    fac.cyl(0.28, 1.25, -0.18, 0.14, 0.04, 0.14, C.blood);
    for (const [x, z] of [[-0.62, -0.1], [-0.62, 0.25]]) {
      fac.cyl(x, 0.35, z, 0.3, 0.7, 0.3, 0xb7b0a0);
      fac.cone(x, 0.75, z, 0.3, 0.1, 0.3, 0x8a8478);
      fac.box(x, 0.35, z + 0.152, 0.12, 0.1, 0.01, C.black);
    }
    fac.cyl(-0.45, 0.55, 0.075, 0.035, 0.035, 0.38, C.metal, { rx: Math.PI / 2 });
    fac.box(-0.5, 0.55, -0.1, 0.18, 0.035, 0.035, C.metal);
    // drums oozing a dark green sludge
    for (const [x, z, rz] of [[0.15, 0.55, 0], [0.38, 0.6, 0], [0.3, 0.82, Math.PI / 2]]) fac.cyl(x, rz ? 0.08 : 0.13, z, 0.16, 0.26, 0.16, 0xc9a227, { rz });
    fac.cyl(0.08, 0.012, 0.85, 0.5, 0.01, 0.34, 0x3a4a1c);
    fac.box(-0.25, 0.012, 0.6, 0.18, 0.01, 0.4, 0x3a4a1c);
    const smoke = [];
    for (let i = 0; i < 4; i++) {
      const d = p.dyn(1.13, 1.3, -0.33);
      d.sphere(0, 0, 0, 0.2, 0.18, 0.2, 0x2f2b28);
      smoke.push(d.node);
    }
    // pig pen with red quarantine tape
    const pen = p.sub(-0.35, 0, 0.6);
    for (const [x, z, ry] of [[-0.55, 0, Math.PI / 2], [0.55, 0, Math.PI / 2], [0, -0.38, 0], [0, 0.38, 0]]) pen.box(x, 0.12, z, ry ? 0.76 : 1.1, 0.06, 0.03, C.wood, { ry });
    for (const x of [-0.55, 0.55]) for (const z of [-0.38, 0.38]) pen.cyl(x, 0.14, z, 0.04, 0.28, 0.04, C.dwood);
    pen.box(0, 0.26, 0.4, 1.15, 0.03, 0.01, C.blood);
    // dead pigs and chickens lying on their sides, legs up, ✕✕ eyes
    const xx = (g, x, y, z, w) => {
      for (const dz of [-w, w]) for (const ry of [0.785, -0.785]) g.box(x, y, z + dz, w * 1.4, 0.008, w * 0.35, C.black, { ry });
    };
    for (const [x, z, ry] of [[-0.25, -0.1, 0.3], [0.15, 0.15, 2.6], [0.3, -0.15, -0.9]]) {
      const g = p.sub(-0.35 + x, 0, 0.6 + z, ry);
      g.sphere(0, 0.1, 0, 0.28, 0.17, 0.2, 0xf2b8c0);
      g.sphere(0.15, 0.09, 0, 0.13, 0.13, 0.13, 0xf2b8c0);
      g.cyl(0.22, 0.08, 0, 0.05, 0.03, 0.05, 0xe09aa6, { rz: Math.PI / 2 });
      for (const lx of [-0.08, 0.07]) for (const lz of [0.03, 0.08]) g.cyl(lx, 0.2, lz, 0.035, 0.13, 0.035, 0xe8a8b2, { rx: -0.5 });
      xx(g, 0.17, 0.158, 0, 0.022);
    }
    for (const [x, z, ry] of [[-1.1, -0.2, 0.4], [-0.55, -0.3, 2.1], [0.05, -0.28, -1.2], [-1.05, 0.25, 1.4]]) {
      const c = p.sub(x, 0, z, ry);
      c.sphere(0, 0.05, 0, 0.13, 0.09, 0.1, C.white);
      c.sphere(0.08, 0.06, 0, 0.06, 0.06, 0.06, C.white);
      c.box(0.09, 0.095, 0, 0.04, 0.025, 0.012, C.blood);
      c.cone(0.12, 0.06, 0, 0.02, 0.03, 0.02, C.yellow, { rz: -Math.PI / 2 });
      for (const lz of [-0.02, 0.02]) c.cyl(-0.01, 0.13, lz, 0.01, 0.09, 0.01, C.yellow, { rx: lz * 8 });
      xx(c, 0.085, 0.092, 0, 0.012);
    }
    p.anim((t) => {
      smoke.forEach((n, i) => {
        const k = (t * 0.25 + i / 4) % 1;
        n.position.set(1.13 + k * 0.35, 1.3 + k * 0.9, -0.33 - k * 0.1);
        n.scale.setScalar(0.6 + k * 1.2);
      });
    });
    return { mist: 2, mistY: 0.25 };
  },

  // 貪瀆島：police station, sacks of cash and gold bars, a phone-scam server room
  graftisle(p, rng) {
    const ps = p.sub(-0.55, 0, -0.65);
    ps.box(0, 0.45, 0, 1.0, 0.9, 0.7, 0xdfe3e8);
    ps.box(0, 0.93, 0, 1.06, 0.08, 0.76, 0x2c4f8a);
    ps.box(0, 0.7, 0.36, 0.7, 0.12, 0.02, 0x2c4f8a);
    for (let i = 0; i < 4; i++) ps.box(-0.33 + i * 0.22, 0.4, 0.355, 0.14, 0.16, 0.02, C.glass);
    const siren = lantern(p.dyn(-0.55, 1.05, -0.65), 0, 0, 0, 0xff2f24, 0.45, { own: true });
    // cash sacks and gold bars
    for (let i = 0; i < 4; i++) {
      const b = p.sub(0.55 + (i % 2) * 0.32, 0, -0.55 + Math.floor(i / 2) * 0.34);
      b.sphere(0, 0.16, 0, 0.3, 0.32, 0.3, 0xd8c08a);
      b.cyl(0, 0.33, 0, 0.08, 0.06, 0.08, 0x9a8050);
      b.box(0, 0.17, 0.15, 0.12, 0.08, 0.01, 0x2e7d32);
    }
    for (let i = 0; i < 6; i++) p.box(0.2 + (i % 3) * 0.16, 0.04 + Math.floor(i / 3) * 0.07, 0.2, 0.14, 0.06, 0.08, C.yellow, { glow: i === 5 });
    // server racks with blinking lights
    const lights = [];
    for (let i = 0; i < 3; i++) {
      const r = p.sub(-0.8 + i * 0.3, 0, 0.6);
      r.box(0, 0.35, 0, 0.24, 0.7, 0.3, 0x2a2c33);
      for (let k = 0; k < 4; k++) {
        const l = p.dyn(-0.8 + i * 0.3 - 0.06, 0.15 + k * 0.15, 0.755);
        lights.push({ m: l.box(0, 0, 0, 0.04, 0.03, 0.01, k % 2 ? 0x5eff8a : 0xffc23a, { glow: true, own: true }), ph: rng() * 6 });
      }
    }
    p.anim((t) => {
      siren.material.userData.flick = Math.sin(t * 6) > 0 ? 1 : 0.1;
      for (const l of lights) l.m.material.userData.flick = Math.sin(t * 7 + l.ph * 3) > 0.2 ? 1 : 0.15;
    });
    return { mist: 2, mistY: 0.3 };
  },

  // 國安島：harbour quay with a cargo ship and containers, a hovering drone, CCTV poles, a beached rubber boat
  natisle(p, rng) {
    p.box(0, 0.02, 0.6, 3.0, 0.04, 1.1, 0xb8b2a6);
    p.box(0, 0.06, -0.05, 3.0, 0.12, 0.25, 0x8a8580);
    // gate-tower hall in a Chinese palace style: red wall with arches, red columns, double golden hip roof
    const RED = 0xa8201a,
      GOLD = 0xd9a520;
    const gt = p.sub(0.15, 0.04, 0.6);
    gt.box(0, 0.22, 0, 2.0, 0.44, 0.62, RED);
    for (const x of [-0.55, 0, 0.55]) {
      gt.box(x, 0.13, 0.31, x ? 0.18 : 0.24, 0.26, 0.02, 0x2a1a14);
      gt.cyl(x, 0.26, 0.31, x ? 0.18 : 0.24, 0.02, 0.02, 0x2a1a14, { rx: Math.PI / 2 });
    }
    gt.box(0, 0.47, 0, 2.06, 0.06, 0.68, 0xe8e2d4);
    gt.box(0, 0.68, -0.02, 1.5, 0.36, 0.44, 0xb8322a);
    for (let k = 0; k < 7; k++) gt.cyl(-0.66 + k * 0.22, 0.68, 0.23, 0.04, 0.36, 0.04, 0xc8102e);
    gt.pyr(0, 0.95, -0.02, 1.95, 0.24, 0.8, GOLD);
    gt.box(0, 1.1, -0.02, 1.05, 0.14, 0.34, 0xb8322a);
    gt.pyr(0, 1.27, -0.02, 1.4, 0.24, 0.55, GOLD);
    gt.box(0, 1.39, -0.02, 0.7, 0.03, 0.05, GOLD);
    // upturned eave tips
    for (const [x, z, y] of [[-0.97, 0.38, 0.86], [0.97, 0.38, 0.86], [-0.97, -0.42, 0.86], [0.97, -0.42, 0.86], [-0.7, 0.25, 1.18], [0.7, 0.25, 1.18], [-0.7, -0.29, 1.18], [0.7, -0.29, 1.18]])
      gt.cone(x, y, z, 0.07, 0.12, 0.07, GOLD);
    // golden plaque under the upper eave
    gt.box(0, 1.1, 0.16, 0.22, 0.1, 0.01, GOLD);
    emblem(gt, 0, 1.1, 0.172, 0.12, 0xc8102e);
    for (let i = 0; i < 6; i++) p.box(-1.0 + (i % 3) * 0.32, 0.12 + Math.floor(i / 3) * 0.2, -0.55, 0.28, 0.18, 0.4, [0x2c6db5, 0xc9a227, 0x8e1c16][i % 3]);
    // crane
    p.box(0.95, 0.7, -0.6, 0.08, 1.4, 0.08, C.yellow);
    p.box(0.75, 1.38, -0.4, 0.6, 0.06, 0.06, C.yellow, { ry: 0.8 });
    // CCTV poles with a red blinking eye
    const eyes = [];
    for (const x of [-1.25, 0.4]) {
      p.cyl(x, 0.4, -0.2, 0.03, 0.8, 0.03, C.metal);
      p.box(x, 0.8, -0.14, 0.08, 0.06, 0.14, 0xdfe3e8);
      const e = p.dyn(x, 0.8, -0.06);
      eyes.push(e.sphere(0, 0, 0, 0.03, 0.03, 0.03, C.blood, { glow: true, own: true }));
    }
    // drone circling above
    const dr = p.dyn(0, 1.5, 0);
    dr.box(0, 0, 0, 0.2, 0.05, 0.2, C.black);
    for (const [x, z] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) dr.cyl(x, 0.03, z, 0.12, 0.01, 0.12, 0x5a5a5a);
    // rubber boat on the beach corner
    p.sphere(-1.15, 0.06, 0.25, 0.4, 0.1, 0.22, 0xf06a1e);
    // red flag with a gold hammer-and-sickle impression, a red container with a star, red lanterns on the crane
    p.cyl(-0.85, 0.75, -0.2, 0.03, 1.5, 0.03, C.metal);
    p.sphere(-0.85, 1.52, -0.2, 0.06, 0.06, 0.06, 0xffd23f);
    const flag = p.dyn(-0.85, 1.25, -0.2);
    flag.box(0.36, 0, 0, 0.72, 0.48, 0.015, 0xc8102e);
    emblem(flag, 0.3, 0.02, 0.012, 0.42);
    emblem(flag, 0.3, 0.02, -0.012, 0.42);
    p.box(-0.04, 0.12, -0.55, 0.28, 0.18, 0.4, 0xc8102e);
    p.cone(-0.04, 0.12, -0.34, 0.1, 0.02, 0.1, 0xffd23f, { rx: Math.PI / 2 });
    const lanterns = [];
    for (const [x, z] of [[0.6, -0.25], [0.78, -0.43]]) {
      p.box(x, 1.26, z, 0.01, 0.2, 0.01, C.black);
      const l = p.dyn(x, 1.1, z);
      lanterns.push(l.sphere(0, 0, 0, 0.14, 0.12, 0.14, 0xd81e1e, { glow: true, own: true }));
      l.box(0, -0.08, 0, 0.05, 0.05, 0.05, 0xffd23f);
    }
    p.anim((t) => {
      dr.node.position.set(Math.cos(t * 0.5) * 0.9, 1.5 + Math.sin(t * 2) * 0.05, Math.sin(t * 0.5) * 0.5);
      eyes.forEach((e, i) => (e.material.userData.flick = Math.sin(t * 3 + i) > 0 ? 1 : 0.2));
      flag.node.rotation.y = Math.sin(t * 1.6) * 0.18;
      lanterns.forEach((l, i) => (l.material.userData.flick = 0.8 + Math.sin(t * 2 + i) * 0.2));
    });
    return { mist: 4, mistY: 0.2 };
  },

  // 無聲島：a hushed corner of the city — park benches under a banyan, a hotel with one dark window, a parked car, candles
  quietisle(p, rng) {
    const ht = p.sub(-0.6, 0, -0.7);
    ht.box(0, 0.8, 0, 0.8, 1.6, 0.6, 0x7d7a86);
    for (let f = 0; f < 5; f++) for (let c = 0; c < 3; c++) ht.box(-0.24 + c * 0.24, 0.3 + f * 0.28, 0.305, 0.14, 0.12, 0.02, f === 3 && c === 1 ? C.black : rng() < 0.5 ? C.warm : C.glass, { glow: !(f === 3 && c === 1) && rng() < 0.5 });
    // banyan tree
    const tr = p.sub(0.6, 0, -0.35);
    tr.cyl(0, 0.4, 0, 0.18, 0.8, 0.18, C.dwood);
    for (let i = 0; i < 5; i++) tr.ico(Math.cos(i * 1.3) * 0.3, 0.95 + (i % 2) * 0.12, Math.sin(i * 1.3) * 0.25, 0.6, 0.4, 0.55, i % 2 ? C.dleaf : C.leaf);
    // benches
    for (const [x, z, ry] of [[0.2, 0.5, 0], [0.95, 0.45, -0.6]]) {
      const b = p.sub(x, 0, z, ry);
      b.box(0, 0.14, 0, 0.5, 0.04, 0.16, C.wood);
      b.box(0, 0.24, -0.07, 0.5, 0.14, 0.03, C.wood);
      for (const bx of [-0.2, 0.2]) b.box(bx, 0.07, 0, 0.03, 0.14, 0.14, C.metal);
    }
    // parked car
    const car = p.sub(-0.7, 0, 0.55, 0.2);
    car.rbox(0, 0.12, 0, 0.6, 0.16, 0.3, 0x4a5a6a);
    car.rbox(-0.03, 0.26, 0, 0.34, 0.12, 0.27, 0x2a3440);
    // street lamps and a few candles
    for (const x of [-0.15, 1.2]) {
      p.cyl(x, 0.45, -0.05, 0.03, 0.9, 0.03, C.black);
      p.sphere(x, 0.92, -0.05, 0.1, 0.1, 0.1, C.lamp, { glow: true });
    }
    const candles = [];
    for (let i = 0; i < 5; i++) {
      p.cyl(0.05 + i * 0.09, 0.04, 0.85, 0.04, 0.08, 0.04, C.white);
      const c = p.dyn(0.05 + i * 0.09, 0.11, 0.85);
      candles.push({ m: c.sphere(0, 0, 0, 0.03, 0.05, 0.03, C.lamp, { glow: true, own: true }), ph: rng() * 6 });
    }
    p.anim((t) => candles.forEach((c) => (c.m.material.userData.flick = 0.75 + Math.sin(t * 9 + c.ph) * 0.25)));
    return { mist: 6, mistY: 0.2 };
  },

  // 兒少島：a bright little amusement park — carousel, tiny ferris wheel, slide, balloons and bunting
  kidsisle(p, rng) {
    const PAL = [0xff6b8b, 0xffd166, 0x5ec8ff, 0x7bd389, 0xb48cff, 0xff9f5a];
    p.cyl(0, 0.01, 0.1, 2.9, 0.02, 2.6, 0x8fd48f);
    // carousel
    const car = p.dyn(-0.55, 0, 0.35);
    car.cyl(0, 0.05, 0, 1.0, 0.1, 1.0, 0xfff1c9);
    car.cyl(0, 0.4, 0, 0.08, 0.7, 0.08, 0xffd166);
    car.cone(0, 0.88, 0, 1.1, 0.35, 1.1, 0xff6b8b);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      car.cyl(Math.cos(a) * 0.38, 0.45, Math.sin(a) * 0.38, 0.02, 0.8, 0.02, C.white);
      car.rbox(Math.cos(a) * 0.38, 0.3, Math.sin(a) * 0.38, 0.12, 0.1, 0.2, PAL[i], { ry: -a });
    }
    // small ferris wheel
    p.box(0.75, 0.55, -0.75, 0.05, 1.1, 0.05, C.white, { rz: 0.2 });
    p.box(1.05, 0.55, -0.75, 0.05, 1.1, 0.05, C.white, { rz: -0.2 });
    const wheel = p.dyn(0.9, 1.05, -0.72);
    wheel.torus(0, 0, 0, 1.0, 1.0, 1.4, 0xffd166);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      wheel.box(Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0, 0.5, 0.02, 0.02, C.white, { rz: a });
      wheel.rbox(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.04, 0.13, 0.12, 0.12, PAL[i]);
    }
    // slide
    p.box(0.85, 0.3, 0.55, 0.05, 0.6, 0.05, PAL[2]);
    p.box(0.85, 0.62, 0.55, 0.3, 0.04, 0.3, PAL[3]);
    p.box(1.12, 0.33, 0.55, 0.62, 0.03, 0.22, PAL[0], { rz: -0.75 });
    // bunting between two poles
    for (const x of [-1.2, 0.2]) p.cyl(x, 0.6, -0.85, 0.03, 1.2, 0.03, C.white);
    for (let i = 0; i < 9; i++) p.cone(-1.13 + i * 0.16, 1.08 - Math.sin((i / 8) * Math.PI) * 0.12, -0.85, 0.08, 0.12, 0.02, PAL[i % 6], { rx: Math.PI });
    // balloons drifting
    const balloons = [];
    for (let i = 0; i < 6; i++) {
      const b = p.dyn(-0.2 + (rng() - 0.5) * 1.6, 1.4, (rng() - 0.5) * 1.2);
      b.sphere(0, 0, 0, 0.14, 0.17, 0.14, PAL[i], { glow: true });
      b.cyl(0, -0.25, 0, 0.005, 0.35, 0.005, C.white);
      balloons.push({ n: b.node, y: 1.3 + rng() * 0.5, ph: rng() * 6 });
    }
    p.anim((t) => {
      car.node.rotation.y = t * 0.5;
      wheel.node.rotation.z = t * 0.3;
      for (const b of balloons) b.n.position.y = b.y + Math.sin(t * 1.2 + b.ph) * 0.08;
    });
  },

  // 賣地島：fenced empty plots with red "for sale" boards, an auction desk with a gavel and cash, luxury towers going up, a swallow circling
  landisle(p, rng) {
    for (const [x, z] of [[-0.95, 0.45], [-0.25, 0.75], [0.5, 0.55]]) {
      const lot = p.sub(x, 0, z);
      lot.box(0, 0.02, 0, 0.6, 0.04, 0.5, 0x8a6a48);
      for (const [fx, fz, w, ry] of [[0, -0.25, 0.6, 0], [0, 0.25, 0.6, 0], [-0.3, 0, 0.5, Math.PI / 2], [0.3, 0, 0.5, Math.PI / 2]]) lot.box(fx, 0.08, fz, w, 0.03, 0.02, C.white, { ry });
      lot.cyl(0.18, 0.25, -0.1, 0.03, 0.5, 0.03, C.metal);
      lot.box(0.18, 0.45, -0.1, 0.3, 0.2, 0.02, 0xc8102e);
      lot.box(0.18, 0.45, -0.088, 0.12, 0.12, 0.01, C.white);
    }
    // luxury towers, one still under construction with a crane
    const tw = p.sub(-0.5, 0, -0.55);
    tw.box(0, 0.9, 0, 0.5, 1.8, 0.5, 0x3d4a5a);
    for (let f = 0; f < 8; f++) tw.box(0, 0.2 + f * 0.21, 0.255, 0.42, 0.1, 0.01, rng() < 0.6 ? C.warm : C.glass, { glow: rng() < 0.6 });
    tw.box(0, 1.85, 0, 0.56, 0.1, 0.56, 0xd9a520);
    const t2 = p.sub(0.35, 0, -0.6);
    t2.box(0, 0.5, 0, 0.5, 1.0, 0.5, 0x9a958c);
    for (let f = 0; f < 4; f++) t2.box(0, 1.05 + f * 0.2, 0, 0.5, 0.02, 0.5, C.metal);
    for (const [x, z] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) t2.box(x, 1.4, z, 0.03, 0.8, 0.03, C.metal);
    p.box(0.95, 1.0, -0.75, 0.07, 2.0, 0.07, C.yellow);
    p.box(0.65, 1.95, -0.72, 0.9, 0.06, 0.06, C.yellow);
    // auction desk: gavel, stacks of cash, a briefcase
    const desk = p.sub(1.0, 0, 0.15, -0.5);
    desk.box(0, 0.18, 0, 0.6, 0.36, 0.32, C.dwood);
    desk.box(0, 0.37, 0, 0.66, 0.03, 0.38, C.wood);
    for (let i = 0; i < 3; i++) desk.box(-0.18 + i * 0.07, 0.42 + i * 0.02, 0.05, 0.12, 0.06 + i * 0.04, 0.08, 0x3f8f4a);
    desk.box(0.15, 0.44, -0.05, 0.2, 0.1, 0.06, C.black);
    const gavel = p.dyn(1.0, 0.45, 0.15);
    gavel.box(0, 0.08, 0, 0.14, 0.06, 0.06, C.dwood);
    gavel.box(0.1, 0.06, 0, 0.18, 0.02, 0.02, C.wood);
    // a swallow circling overhead
    const bird = p.dyn(0, 1.4, 0);
    bird.sphere(0, 0, 0, 0.16, 0.08, 0.08, 0x1f2a44);
    bird.sphere(0.02, -0.02, 0, 0.12, 0.05, 0.06, C.white);
    bird.box(-0.12, 0.01, 0.03, 0.12, 0.01, 0.02, 0x1f2a44, { ry: 0.3 });
    bird.box(-0.12, 0.01, -0.03, 0.12, 0.01, 0.02, 0x1f2a44, { ry: -0.3 });
    const wings = [bird.box(0, 0.02, 0.12, 0.08, 0.01, 0.2, 0x1f2a44), bird.box(0, 0.02, -0.12, 0.08, 0.01, 0.2, 0x1f2a44)];
    p.anim((t) => {
      gavel.node.rotation.z = Math.max(0, Math.sin(t * 3)) * 0.6;
      const a = t * 0.6;
      bird.node.position.set(Math.cos(a) * 1.0, 1.4 + Math.sin(t * 2) * 0.08, Math.sin(a) * 0.8);
      bird.node.rotation.y = -a - Math.PI / 2;
      wings.forEach((w, i) => (w.rotation.x = Math.sin(t * 12) * 0.5 * (i ? -1 : 1)));
    });
    return { mist: 2, mistY: 0.25 };
  },

  // 標案島：city hall on one side, a TV station on the other, a conveyor of gold coins running between them, cash bags piling up at the studio
  bidisle(p, rng) {
    // city hall: white block, columns, flag
    const ch = p.sub(-0.95, 0, -0.35);
    ch.box(0, 0.4, 0, 0.8, 0.8, 0.6, 0xe8e4da);
    ch.box(0, 0.84, 0, 0.88, 0.08, 0.68, 0xc9c3b4);
    for (let i = 0; i < 4; i++) ch.cyl(-0.27 + i * 0.18, 0.32, 0.32, 0.06, 0.64, 0.06, C.white);
    ch.gable(0, 0.88, 0.1, 0.9, 0.22, 0.5, 0xc9c3b4);
    ch.cyl(0.3, 1.15, -0.1, 0.02, 0.6, 0.02, C.metal);
    ch.box(0.4, 1.35, -0.1, 0.2, 0.13, 0.01, 0x2c6db5);
    // TV station: dark block, glowing screen, satellite dish, red-lit mast
    const tv = p.sub(0.9, 0, -0.35);
    tv.box(0, 0.45, 0, 0.75, 0.9, 0.65, 0x2a2c38);
    tv.box(0, 0.55, 0.33, 0.5, 0.32, 0.02, 0x7fd3ff, { glow: true });
    tv.box(0, 0.15, 0.33, 0.2, 0.3, 0.02, C.black);
    tv.sphere(-0.2, 1.02, 0, 0.36, 0.14, 0.36, 0xdfe3e8, { rx: 0.6 });
    tv.cyl(-0.2, 0.95, 0, 0.03, 0.12, 0.03, C.metal);
    tv.cyl(0.22, 1.25, -0.15, 0.03, 0.7, 0.03, C.metal);
    const beacon = p.dyn(1.12, 1.62, -0.5);
    const bm = beacon.sphere(0, 0, 0, 0.06, 0.06, 0.06, C.blood, { glow: true, own: true });
    // conveyor belt with coins sliding from the hall to the station
    p.box(0, 0.2, 0.15, 1.3, 0.05, 0.22, 0x3a3a40);
    for (const x of [-0.6, -0.2, 0.2, 0.6]) p.box(x, 0.1, 0.15, 0.05, 0.2, 0.18, C.metal);
    const coins = [];
    for (let i = 0; i < 8; i++) {
      const c = p.dyn(0, 0.26, 0.15);
      c.cyl(0, 0, 0, 0.12, 0.03, 0.12, 0xffc93a, { glow: true });
      coins.push({ n: c.node, k: i / 8 });
    }
    // cash bags and stacked bills at the station door, a big red envelope
    for (let i = 0; i < 5; i++) {
      const b = p.sub(0.7 + (i % 3) * 0.22, 0, 0.35 + Math.floor(i / 3) * 0.25);
      b.sphere(0, 0.13, 0, 0.24, 0.26, 0.24, 0xd8c08a);
      b.cone(0, 0.3, 0, 0.1, 0.08, 0.1, 0xd8c08a);
      b.box(0, 0.14, 0.12, 0.08, 0.08, 0.01, 0x3f8f4a);
    }
    for (let i = 0; i < 4; i++) p.box(0.3 + i * 0.03, 0.03 + i * 0.05, 0.75, 0.24, 0.05, 0.12, 0x3f8f4a, { ry: i * 0.2 });
    const env = p.sub(-0.75, 0, 0.6, 0.3);
    env.box(0, 0.22, 0, 0.5, 0.36, 0.04, 0xc8102e);
    env.box(0, 0.32, 0.021, 0.14, 0.14, 0.01, 0xffd23f);
    // a TV camera on a tripod pointing at the hall
    const cam = p.sub(-0.15, 0, 0.75, -0.6);
    for (const r of [0, 2.1, 4.2]) cam.cyl(Math.cos(r) * 0.08, 0.18, Math.sin(r) * 0.08, 0.02, 0.38, 0.02, C.black, { rz: Math.cos(r) * 0.3, rx: Math.sin(r) * 0.3 });
    cam.box(0, 0.42, 0, 0.12, 0.12, 0.26, 0x2a2c38);
    cam.cyl(0, 0.42, 0.16, 0.06, 0.08, 0.06, C.black, { rx: Math.PI / 2 });
    p.anim((t) => {
      coins.forEach((c) => {
        const k = (t * 0.18 + c.k) % 1;
        c.n.position.set(-0.6 + k * 1.2, 0.26, 0.15);
        c.n.rotation.y = t * 3;
      });
      bm.material.userData.flick = Math.sin(t * 4) > 0 ? 1 : 0.15;
    });
    return { mist: 2, mistY: 0.25 };
  },

  // 購物島 (DLC)：a stage with a giant screen, a lottery drum spinning prize balls, a NT$10-million prize house with a gold bow,
  // giant red envelopes, shopping bags, a steaming hot pot (鍋烤節) and fireworks; a tarp with a padlock hides it all until unlocked
  // 空城島：a smoking power plant, a dried-up reservoir, a row of stumps, an empty transit hall and an idle crane
  emptyisle(p, rng) {
    // the coal plant: two red-and-white stacks over a boiler hall, grey smog drifting off
    const pl = p.sub(-0.75, 0, -0.55);
    pl.box(0, 0.25, 0.1, 0.8, 0.5, 0.5, 0x7d7f84);
    pl.box(0, 0.52, 0.1, 0.84, 0.04, 0.54, 0x5f6166);
    for (const x of [-0.22, 0.22]) for (let k = 0; k < 6; k++) pl.cyl(x, 0.55 + k * 0.22, -0.2, 0.16 - k * 0.008, 0.22, 0.16 - k * 0.008, k % 2 ? 0xe8e4da : 0xb3261e);
    const smog = [];
    for (let i = 0; i < 12; i++) {
      const sm = p.dyn(-0.75, 1.9, -0.75);
      sm.sphere(0, 0, 0, 0.4, 0.3, 0.4, i % 2 ? 0x8a8780 : 0x6f6c66);
      smog.push({ n: sm.node, ph: i / 12, x0: i % 2 ? -0.22 : 0.22 });
    }
    // the reservoir run dry: cracked mud and one last puddle, a depth gauge left standing
    const rs = p.sub(0.7, 0, -0.5);
    rs.cyl(0, 0.02, 0, 1.0, 0.04, 0.8, 0x9b7b55);
    for (let i = 0; i < 9; i++) rs.box(-0.35 + rng() * 0.7, 0.045, -0.3 + rng() * 0.6, 0.18 + rng() * 0.15, 0.01, 0.012, 0x5e4630, { ry: rng() * 3 });
    rs.cyl(0.12, 0.042, 0.1, 0.18, 0.01, 0.12, C.water);
    rs.box(-0.35, 0.3, -0.25, 0.04, 0.6, 0.04, C.white);
    for (let k = 0; k < 5; k++) rs.box(-0.32, 0.12 + k * 0.1, -0.25, 0.04, 0.01, 0.045, C.red);
    // a row of fresh stumps where street trees stood, sawdust and one cut trunk on the ground
    for (let i = 0; i < 5; i++) {
      const st = p.sub(-1.05 + i * 0.26, 0, 0.55);
      st.cyl(0, 0.05, 0, 0.11, 0.1, 0.11, C.wood);
      st.cyl(0, 0.102, 0, 0.09, 0.005, 0.09, 0xd9b77a);
    }
    p.cyl(-0.4, 0.06, 0.82, 0.09, 0.85, 0.09, C.wood, { rz: Math.PI / 2, ry: 0.15 });
    p.ico(-0.2, 0.05, 0.86, 0.25, 0.08, 0.2, C.dleaf);
    // the empty transit hall: big glass box, lights on, nobody inside, a mosquito cloud at the door
    const hl = p.sub(0.65, 0, 0.55);
    hl.box(0, 0.32, 0, 0.9, 0.64, 0.55, 0xb9c4c8);
    for (let f = 0; f < 3; f++) hl.box(0, 0.12 + f * 0.2, 0.28, 0.84, 0.12, 0.01, C.glass);
    for (let f = 0; f < 3; f++) hl.box(-0.3 + f * 0.3, 0.12 + 0.2, 0.285, 0.08, 0.06, 0.005, C.lamp, { glow: true });
    hl.box(0, 0.68, 0, 0.95, 0.06, 0.6, 0x8d979b);
    hl.box(0, 0.76, 0.28, 0.5, 0.1, 0.02, 0x2c6db5);
    const bugs = [];
    for (let i = 0; i < 14; i++) {
      const b = p.dyn(0.65, 0.4, 0.95);
      b.box(0, 0, 0, 0.03, 0.02, 0.03, C.black);
      bugs.push({ n: b.node, ph: rng() * 6, r: 0.1 + rng() * 0.18, sp: 2 + rng() * 3 });
    }
    // an idle tower crane over a fenced, empty pit
    const cr = p.sub(0.05, 0, 0.1);
    cr.box(0, 0.01, 0, 0.5, 0.02, 0.4, 0x4a3f33);
    for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) cr.box(x, 0.08, z, 0.02, 0.16, 0.02, C.yellow);
    cr.box(0, 0.75, 0, 0.06, 1.5, 0.06, C.yellow);
    const jib = p.dyn(0.05, 1.5, 0.1);
    jib.box(0.25, 0, 0, 0.9, 0.05, 0.05, C.yellow);
    jib.box(-0.25, 0, 0, 0.12, 0.1, 0.1, C.dstone);
    jib.cyl(0.6, -0.35, 0, 0.005, 0.7, 0.005, C.black);
    p.anim((t) => {
      smog.forEach((sm) => {
        const k = (t * 0.12 + sm.ph) % 1;
        sm.n.position.set(-0.75 + sm.x0 + k * 1.6, 1.85 + k * 0.6, -0.75 + Math.sin(k * 5 + sm.ph) * 0.15);
        sm.n.scale.setScalar(0.5 + k * 1.6);
      });
      bugs.forEach((b) => b.n.position.set(0.65 + Math.cos(t * b.sp + b.ph) * b.r, 0.35 + Math.sin(t * b.sp * 1.3 + b.ph) * 0.08, 0.95 + Math.sin(t * b.sp + b.ph) * b.r * 0.6));
      jib.node.rotation.y = Math.sin(t * 0.08) * 0.4; // barely moving
    });
    return { mist: 2, mistY: 0.25 };
  },

  // 噤聲島：a police box with a flashing light bar, a giant water meter (查水表) with a spinning needle, a phone whose
  // speech bubble keeps getting crossed out, three people with taped mouths and a pile of legal letters
  silenceisle(p, rng) {
    // the police box: white walls, blue band, lit windows, a red-and-blue light bar on the roof
    const ps = p.sub(-0.7, 0, -0.55);
    ps.box(0, 0.35, 0, 0.8, 0.7, 0.55, C.white);
    ps.box(0, 0.6, 0.28, 0.8, 0.1, 0.01, 0x2c6db5);
    ps.box(0, 0.22, 0.28, 0.2, 0.42, 0.01, C.glass);
    for (const x of [-0.26, 0.26]) ps.box(x, 0.34, 0.28, 0.16, 0.14, 0.01, C.warm, { glow: true });
    ps.box(0, 0.72, 0, 0.86, 0.04, 0.6, 0x9aa3a8);
    ps.box(0, 0.77, 0, 0.36, 0.05, 0.1, C.black);
    const red = lantern(p.dyn(-0.8, 0.84, -0.55), 0, 0, 0, C.blood, 0.45, { own: true });
    const blue = lantern(p.dyn(-0.6, 0.84, -0.55), 0, 0, 0, 0x3a7bff, 0.45, { own: true });
    // the water meter: a blue housing on a pipe, a big white dial with a needle that never stops turning
    const wm = p.sub(0.55, 0, -0.5);
    wm.cyl(0, 0.1, 0, 0.09, 1.2, 0.09, C.metal, { rz: Math.PI / 2 });
    wm.box(0, 0.4, 0, 0.56, 0.7, 0.3, 0x3d6b8a);
    wm.cyl(0, 0.45, 0.15, 0.46, 0.02, 0.46, C.metal, { rx: Math.PI / 2 });
    wm.cyl(0, 0.45, 0.165, 0.4, 0.02, 0.4, C.white, { rx: Math.PI / 2 });
    for (let k = 0; k < 4; k++) wm.box(-0.09 + k * 0.06, 0.34, 0.18, 0.045, 0.06, 0.005, C.black);
    for (let k = 0; k < 8; k++) wm.box(Math.cos(k * 0.785) * 0.16, 0.45 + Math.sin(k * 0.785) * 0.16, 0.18, 0.02, 0.02, 0.005, C.black);
    const needle = p.dyn(0.55, 0.45, -0.31);
    needle.box(0, 0.07, 0, 0.02, 0.14, 0.01, C.red);
    needle.sphere(0, 0, 0, 0.04, 0.04, 0.02, C.black);
    // the phone: a lit screen, a speech bubble that grows and then gets a red cross over it
    const ph = p.sub(0.75, 0, 0.4, -0.3);
    ph.rbox(0, 0.45, 0, 0.4, 0.8, 0.06, C.black);
    ph.box(0, 0.46, 0.035, 0.34, 0.66, 0.01, 0x6fb3ff, { glow: true });
    const bub = p.dyn(0.68, 1.15, 0.45);
    bub.sphere(0, 0, 0, 0.46, 0.32, 0.12, C.white);
    bub.cone(-0.12, -0.18, 0, 0.08, 0.14, 0.06, C.white, { rx: Math.PI });
    for (const x of [-0.1, 0, 0.1]) bub.sphere(x, 0, 0.06, 0.05, 0.05, 0.02, C.black);
    const cross = p.dyn(0.68, 1.15, 0.53);
    for (const rz of [0.7, -0.7]) cross.box(0, 0, 0, 0.56, 0.06, 0.03, C.blood, { rz, glow: true });
    // three people facing the street, mouths taped shut with a grey cross
    [0x5b6b8a, 0x8a5b5b, 0x5b8a6b].forEach((body, i) => {
      const f = p.sub(-0.6 + i * 0.32, 0, 0.55);
      f.rbox(0, 0.16, 0, 0.2, 0.26, 0.14, body);
      f.sphere(0, 0.42, 0, 0.24, 0.24, 0.22, 0xf0dcc8);
      f.box(0, 0.51, -0.02, 0.25, 0.08, 0.2, 0x2b2222);
      for (const ex of [-0.05, 0.05]) f.box(ex, 0.45, 0.11, 0.03, 0.03, 0.01, C.black);
      for (const rz of [0.45, -0.45]) f.box(0, 0.36, 0.115, 0.15, 0.035, 0.01, 0xd9d2c3, { rz });
    });
    // a pile of letters from the lawyers, a red seal on top
    const lt = p.sub(0.05, 0, -0.05);
    for (let k = 0; k < 6; k++) lt.box((rng() - 0.5) * 0.05, 0.015 + k * 0.025, (rng() - 0.5) * 0.05, 0.34, 0.02, 0.24, k % 2 ? C.white : C.cream, { ry: (rng() - 0.5) * 0.4 });
    lt.cyl(0.08, 0.17, 0.04, 0.07, 0.01, 0.07, C.red);
    p.anim((t) => {
      const on = Math.sin(t * 7) > 0;
      red.material.userData.flick = on ? 1 : 0.1;
      blue.material.userData.flick = on ? 0.1 : 1;
      needle.node.rotation.z = -t * 2.2;
      const k = (t / 3.2) % 1;
      bub.node.scale.setScalar(Math.max(0.001, Math.min(1, k / 0.3)) * (k < 0.92 ? 1 : 0.001));
      cross.node.scale.setScalar(k > 0.5 && k < 0.92 ? 1 : 0.001);
    });
    return { mist: 3, mistY: 0.2 };
  },

  // 火燒山島：a hill burning up from the cemetery at its foot, half charred and half still green, a water-bucket helicopter circling
  wildfireisle(p, rng) {
    // the hill: stacked flattened domes, scorched on the west face
    const hill = p.sub(-0.1, 0, -0.15);
    hill.dome(0, 0, 0, 2.3, 2.0, 1.9, 0x4a3f33);
    hill.dome(0.15, 0.75, -0.05, 1.5, 1.3, 1.25, 0x3d352c);
    hill.dome(0.25, 1.4, -0.1, 0.8, 0.8, 0.7, 0x2f2924);
    // the green side that has not burned yet (east), the scorched side with dead trunks (west)
    for (const [x, z, sc] of [[0.85, -0.55, 0.8], [0.95, 0.05, 0.7], [0.7, 0.45, 0.65], [0.55, -0.95, 0.7], [1.1, -0.3, 0.6]]) pine(p.sub(x, hill_y(x, z), z), 0, 0, sc);
    for (const [x, z, sc] of [[-0.75, -0.4, 0.9], [-0.5, 0.25, 0.8], [-0.95, 0.15, 0.7], [-0.3, -0.75, 0.75], [-0.15, 0.55, 0.7], [-0.6, -0.95, 0.6]]) {
      const t = p.sub(x, hill_y(x, z), z, rng() * 6);
      t.cyl(0, 0.25 * sc, 0, 0.06 * sc, 0.5 * sc, 0.06 * sc, C.black);
      t.cyl(0.08 * sc, 0.42 * sc, 0, 0.03 * sc, 0.26 * sc, 0.03 * sc, C.black, { rz: -0.8 });
    }
    // glowing embers on the burned slope
    const embers = [];
    for (let i = 0; i < 9; i++) {
      const x = -1.0 + rng() * 0.9, z = -0.9 + rng() * 1.5;
      const e = p.dyn(x, hill_y(x, z) + 0.01, z);
      embers.push({ m: e.ico(0, 0, 0, 0.12, 0.04, 0.1, 0xff4a12, { glow: true, own: true }), ph: rng() * 6 });
    }
    // the fire line, creeping up between the burned and the green halves
    const flames = [];
    for (let i = 0; i < 11; i++) {
      const z = -1.0 + i * 0.2, x = 0.15 + Math.sin(i * 1.7) * 0.2;
      const f = p.dyn(x, hill_y(x, z), z);
      const m = f.cone(0, 0.26, 0, 0.3, 0.55, 0.3, i % 2 ? 0xff6a1a : 0xffc23a, { glow: true, own: true });
      flames.push({ n: f.node, m, ph: rng() * 6 });
    }
    const smoke = [];
    for (let i = 0; i < 10; i++) {
      const sm = p.dyn(0.2, 1.5, -0.2);
      sm.sphere(0, 0, 0, 0.36, 0.3, 0.36, i % 3 ? 0x3a3532 : 0x5a524c);
      smoke.push({ n: sm.node, ph: i / 10, dx: (rng() - 0.5) * 0.6, dz: (rng() - 0.5) * 0.9 });
    }
    // the cemetery at the foot of the hill, where tomb-sweeping fires so often start
    const cm = p.sub(-0.45, 0, 1.05);
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 5; c++) {
        cm.box(-0.5 + c * 0.25, 0.05, r * 0.24, 0.18, 0.1, 0.14, C.dstone);
        cm.box(-0.5 + c * 0.25, 0.16, r * 0.24 - 0.05, 0.14, 0.18, 0.03, c % 2 ? C.stone : C.bone);
      }
    const joss = cm.dyn(0.55, 0.06, 0.12);
    joss.cyl(0, 0, 0, 0.16, 0.12, 0.16, 0x5a4a3a);
    const jflame = joss.cone(0, 0.12, 0, 0.12, 0.18, 0.12, 0xffa23a, { glow: true, own: true });
    // a bare firebreak strip
    p.box(0.55, 0.012, 0.75, 1.0, 0.02, 0.16, 0xa88a5a, { ry: -0.5 });
    // water-bucket helicopter circling the fire
    const heli = p.dyn(0, 2.6, 0);
    heli.rbox(0, 0, 0, 0.5, 0.2, 0.2, 0xc8c2b4);
    heli.box(0.32, 0.02, 0, 0.36, 0.06, 0.06, 0xc8c2b4);
    heli.box(0.5, 0.1, 0, 0.04, 0.16, 0.03, 0xc21f1f);
    heli.box(-0.12, 0.03, 0.105, 0.16, 0.08, 0.01, C.glass);
    const rotor = heli.dyn(0, 0.14, 0);
    rotor.box(0, 0, 0, 0.9, 0.01, 0.05, C.black);
    rotor.box(0, 0, 0, 0.05, 0.01, 0.9, C.black);
    heli.cyl(0, -0.3, 0, 0.005, 0.4, 0.005, C.black);
    heli.cyl(0, -0.55, 0, 0.12, 0.14, 0.12, 0xd96a1a);
    const drop = heli.dyn(0, -0.65, 0);
    const water = drop.cyl(0, -0.5, 0, 0.06, 1.0, 0.06, 0x8fc6ff, { glow: true, own: true });
    p.anim((t) => {
      flames.forEach((f) => {
        f.n.scale.set(1, 0.7 + Math.sin(t * 9 + f.ph) * 0.25 + Math.sin(t * 21 + f.ph) * 0.1, 1);
        f.m.material.userData.flick = 0.8 + Math.sin(t * 13 + f.ph) * 0.2;
      });
      embers.forEach((e) => (e.m.material.userData.flick = 0.55 + Math.sin(t * 3 + e.ph) * 0.35));
      jflame.material.userData.flick = 0.8 + Math.sin(t * 17) * 0.2;
      smoke.forEach((sm) => {
        const k = (t * 0.16 + sm.ph) % 1;
        sm.n.position.set(0.2 + sm.dx * k - k * 0.5, 1.3 + k * 2.0, -0.2 + sm.dz * k);
        sm.n.scale.setScalar(0.4 + k * 1.4);
      });
      // a slow loop over the hill; it drops water while passing over the fire line
      const a = t * 0.35;
      heli.node.position.set(Math.cos(a) * 0.9 + 0.1, 2.6 + Math.sin(t * 1.3) * 0.05, Math.sin(a) * 0.8 - 0.15);
      heli.node.rotation.y = -a - Math.PI / 2;
      rotor.node.rotation.y = t * 30;
      drop.node.visible = Math.cos(a) > 0.2 && Math.cos(a) < 0.95;
      water.material.userData.flick = 0.6 + Math.sin(t * 25) * 0.2;
    });
    return { mist: 3, mistY: 0.3 };
  },

  shopisle(p, rng) {
    // stage with a big glowing screen and spotlights
    const st = p.sub(-0.75, 0, -0.55);
    st.box(0, 0.12, 0, 1.1, 0.24, 0.6, 0x7a1f2b);
    st.box(0, 0.75, -0.25, 1.0, 0.9, 0.06, 0x1d1d24);
    st.box(0, 0.78, -0.21, 0.88, 0.66, 0.02, 0xffd36a, { glow: true });
    st.box(0, 0.78, -0.2, 0.42, 0.42, 0.01, 0xc8102e, { glow: true });
    for (const x of [-0.5, 0.5]) st.cyl(x, 0.75, -0.25, 0.04, 1.3, 0.04, C.metal);
    st.box(0, 1.38, -0.25, 1.1, 0.06, 0.06, C.metal);
    // the NT$10-million prize house, tied with a gold bow
    const hs = p.sub(0.85, 0, -0.45);
    hs.box(0, 0.35, 0, 0.6, 0.7, 0.5, 0xf2ece0);
    hs.gable(0, 0.7, 0, 0.7, 0.3, 0.6, 0x3b3436);
    for (const x of [-0.15, 0.15]) hs.box(x, 0.45, 0.26, 0.12, 0.14, 0.01, 0xffd38a, { glow: true });
    hs.box(0, 0.4, 0.255, 0.62, 0.06, 0.01, 0xd9a520);
    hs.box(0, 0.4, 0, 0.06, 0.72, 0.52, 0xd9a520);
    hs.torus(-0.08, 1.05, 0.0, 0.16, 0.16, 0.16, 0xd9a520, { ry: Math.PI / 2 });
    hs.torus(0.08, 1.05, 0.0, 0.16, 0.16, 0.16, 0xd9a520, { ry: Math.PI / 2 });
    // lottery drum spinning on a stand, prize balls inside
    p.box(0, 0.2, 0.25, 0.08, 0.4, 0.5, C.metal);
    const drum = p.dyn(0, 0.5, 0.25);
    drum.cyl6(0, 0, 0, 0.5, 0.5, 0.5, 0xd9a520, { rz: Math.PI / 2 });
    const balls = [];
    for (let i = 0; i < 6; i++) balls.push(drum.sphere(Math.cos(i) * 0.1, Math.sin(i * 2) * 0.12, Math.sin(i) * 0.12, 0.09, 0.09, 0.09, [0xc8102e, 0xffd23f, 0x2c6db5, 0xffffff][i % 4], { glow: true }));
    // giant red envelopes and shopping bags
    for (const [x, z, ry] of [[-1.15, 0.35, 0.4], [-0.85, 0.75, -0.3]]) {
      const e = p.sub(x, 0, z, ry);
      e.box(0, 0.28, 0, 0.36, 0.52, 0.05, 0xc8102e);
      e.box(0, 0.36, 0.03, 0.14, 0.14, 0.01, 0xffd23f);
    }
    for (let i = 0; i < 4; i++) {
      const b = p.sub(0.55 + (i % 2) * 0.28, 0, 0.45 + Math.floor(i / 2) * 0.3, rng() * 1.5);
      b.box(0, 0.16, 0, 0.2, 0.3, 0.1, [0xe84393, 0x2e9e5b, 0xffd23f, 0x2c6db5][i]);
      b.torus(0, 0.33, 0, 0.12, 0.12, 0.12, C.black);
    }
    // the hot pot (鍋烤節): a big pot with rising steam
    const pot = p.sub(-0.2, 0, 0.85);
    pot.cyl(0, 0.08, 0, 0.42, 0.16, 0.42, C.metal);
    pot.cyl(0, 0.17, 0, 0.36, 0.02, 0.36, 0xb5502c);
    const steam = [];
    for (let i = 0; i < 3; i++) {
      const s = p.dyn(-0.2 + (i - 1) * 0.1, 0.3, 0.85);
      s.sphere(0, 0, 0, 0.14, 0.14, 0.14, 0xeeeeee, { own: true });
      steam.push({ n: s.node, k: i / 3 });
    }
    // fireworks bursting overhead
    const fw = [];
    for (let i = 0; i < 3; i++) {
      const f = p.dyn((i - 1) * 0.8, 2.2 + i * 0.2, -0.6);
      for (let k = 0; k < 8; k++) f.sphere(Math.cos((k / 8) * Math.PI * 2) * 0.3, Math.sin((k / 8) * Math.PI * 2) * 0.3, 0, 0.06, 0.06, 0.06, [0xffd23f, 0xff5a7a, 0x7fd3ff][i], { glow: true });
      fw.push({ n: f.node, k: i / 3 });
    }
    // DLC cover: a tarp over the whole plateau with caution stripes and a glowing padlock
    const cover = p.dyn(0, 0, 0);
    cover.rbox(0, 0.85, 0, 3.0, 1.7, 2.6, 0x2b2e38);
    cover.box(0, 0.25, 1.31, 3.0, 0.14, 0.02, 0xffd23f);
    cover.box(0, 0.25, -1.31, 3.0, 0.14, 0.02, 0xffd23f);
    cover.box(0, 1.72, 0, 0.6, 0.04, 0.6, 0x1d1d24);
    cover.torus(0, 2.12, 0, 0.36, 0.42, 0.36, 0xffd23f, { glow: true });
    cover.box(0, 1.92, 0, 0.5, 0.36, 0.16, 0xffd23f, { glow: true });
    cover.box(0, 1.92, 0.09, 0.08, 0.14, 0.01, C.black);
    p.anim((t) => {
      drum.node.rotation.x = t * 2.5;
      steam.forEach((s) => {
        const k = (t * 0.35 + s.k) % 1;
        s.n.position.y = 0.3 + k * 0.7;
        s.n.scale.setScalar(0.6 + k * 1.2);
      });
      fw.forEach((f) => {
        const k = (t * 0.4 + f.k) % 1;
        f.n.scale.setScalar(k < 0.7 ? 0.2 + k * 1.6 : 0.01);
        f.n.visible = !cover.node.visible; // the fireworks would poke out above the tarp
      });
      if (cover.node.userData.lift != null) {
        const k = Math.min(1, cover.node.userData.lift);
        cover.node.position.y = k * k * 4;
        cover.node.scale.setScalar(1 - k * 0.6);
        cover.node.visible = k < 1;
      }
    });
    return { mist: 1, mistY: 0.2, cover: cover.node };
  },

  // 詐騙島：a glass office tower full of glowing call-centre screens, a "水房" washing machine spinning banknotes, a police van with flashing lights
  scamisle(p, rng) {
    const tw = p.sub(-0.55, 0, -0.45);
    tw.box(0, 0.95, 0, 0.9, 1.9, 0.7, 0x3d4658);
    for (let f = 0; f < 6; f++) for (let c = 0; c < 4; c++) tw.box(-0.33 + c * 0.22, 0.25 + f * 0.28, 0.355, 0.16, 0.14, 0.01, rng() < 0.7 ? 0x7fd3ff : 0x2a3440, { glow: true });
    tw.box(0, 1.93, 0, 0.94, 0.06, 0.74, 0xd9a520);
    // desks with phones and monitors out front
    for (let i = 0; i < 3; i++) {
      const d = p.sub(-0.95 + i * 0.4, 0, 0.25);
      d.box(0, 0.14, 0, 0.3, 0.04, 0.2, C.wood);
      d.box(0, 0.07, 0, 0.26, 0.14, 0.02, C.dwood);
      d.box(0, 0.24, -0.05, 0.16, 0.12, 0.02, 0x7fd3ff, { glow: true });
      d.box(0.09, 0.18, 0.04, 0.07, 0.03, 0.04, C.black);
    }
    // washing machine laundering cash
    const wm = p.sub(0.75, 0, -0.35);
    wm.box(0, 0.3, 0, 0.55, 0.6, 0.5, C.white);
    wm.box(0, 0.56, 0.1, 0.5, 0.06, 0.3, 0xdfe3e8);
    wm.cyl(0, 0.28, 0.255, 0.36, 0.02, 0.36, 0x2a3440, { rx: Math.PI / 2 });
    wm.box(0.18, 0.55, 0.255, 0.08, 0.04, 0.01, 0x5eff8a, { glow: true });
    const drum = p.dyn(0.75, 0.28, -0.08);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      drum.box(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0, 0.1, 0.05, 0.01, 0x3f8f4a, { rz: a });
    }
    for (let i = 0; i < 6; i++) p.box(0.5 + rng() * 0.6, 0.02, 0.05 + rng() * 0.3, 0.12, 0.02, 0.06, 0x3f8f4a, { ry: rng() * 3 });
    // police van with a light bar
    const van = p.sub(0.6, 0, 0.75, 0.2);
    van.rbox(0, 0.2, 0, 0.75, 0.3, 0.36, C.white);
    van.box(0, 0.2, 0.182, 0.74, 0.07, 0.01, 0x1f4f9a);
    van.box(0.2, 0.28, 0.182, 0.25, 0.1, 0.01, C.glass);
    for (const x of [-0.22, 0.22]) van.cyl(x, 0.05, 0.19, 0.12, 0.05, 0.12, C.black, { rx: Math.PI / 2 });
    const red = p.dyn(0.52, 0.39, 0.73).box(0, 0, 0, 0.1, 0.05, 0.1, 0xff2f24, { glow: true, own: true });
    const blue = p.dyn(0.7, 0.39, 0.77).box(0, 0, 0, 0.1, 0.05, 0.1, 0x3a7bff, { glow: true, own: true });
    // flash-bang burst at the tower door
    const flash = p.dyn(-0.55, 0.2, 0.0).sphere(0, 0, 0, 0.25, 0.25, 0.25, 0xfff6c8, { glow: true, own: true });
    p.anim((t) => {
      drum.node.rotation.z = t * 6;
      const on = Math.sin(t * 8) > 0;
      red.material.userData.flick = on ? 1 : 0.1;
      blue.material.userData.flick = on ? 0.1 : 1;
      const k = (t * 0.5) % 1;
      flash.material.userData.flick = k < 0.08 ? 1 : 0;
      flash.scale.setScalar(k < 0.08 ? 1 + k * 8 : 0.01);
    });
    return { mist: 2, mistY: 0.25 };
  },

  // 毒駕島：a car crashed into a bent lamp post on a strip of road, a police checkpoint with cones, a little drug lab bubbling green, vape pods everywhere
  drugisle(p, rng) {
    p.box(0, 0.02, 0.55, 3.0, 0.03, 0.6, 0x3a3a40);
    for (let i = 0; i < 6; i++) p.box(-1.25 + i * 0.5, 0.04, 0.55, 0.25, 0.01, 0.04, C.white);
    // crashed car and bent lamp post
    const car = p.sub(-0.6, 0, 0.55, 0.5);
    car.rbox(0, 0.13, 0, 0.62, 0.18, 0.32, 0x8e1c16, { rz: 0.08 });
    car.rbox(-0.05, 0.27, 0, 0.32, 0.12, 0.28, 0x5a1a14, { rz: 0.08 });
    for (const [x, z] of [[-0.2, 0.17], [0.2, 0.17], [-0.2, -0.17], [0.2, -0.17]]) car.cyl(x, 0.06, z, 0.12, 0.05, 0.12, C.black, { rx: Math.PI / 2 });
    p.cyl(-0.25, 0.35, 0.78, 0.03, 0.7, 0.03, C.black, { rz: -0.5 });
    p.sphere(0.0, 0.62, 0.78, 0.09, 0.09, 0.09, C.lamp, { glow: true });
    const smoke = [];
    for (let i = 0; i < 3; i++) {
      const d = p.dyn(-0.4, 0.35, 0.55);
      d.sphere(0, 0, 0, 0.16, 0.14, 0.16, 0x6a6a70);
      smoke.push(d.node);
    }
    // checkpoint: cones and a sign
    for (let i = 0; i < 4; i++) p.cone(0.35 + i * 0.22, 0.1, 0.35, 0.1, 0.2, 0.1, 0xff7a1a);
    p.cyl(1.15, 0.3, 0.3, 0.03, 0.6, 0.03, C.metal);
    p.box(1.15, 0.6, 0.31, 0.3, 0.2, 0.02, 0x1f4f9a);
    const siren = p.dyn(1.15, 0.75, 0.3).sphere(0, 0, 0, 0.06, 0.06, 0.06, 0xff2f24, { glow: true, own: true });
    // drug lab table with bubbling flasks, scattered vape pods and pill bottles
    const lab = p.sub(-0.4, 0, -0.55);
    lab.box(0, 0.2, 0, 0.9, 0.04, 0.4, 0xdfe3e8);
    for (const x of [-0.4, 0.4]) for (const z of [-0.17, 0.17]) lab.box(x, 0.1, z, 0.03, 0.2, 0.03, C.metal);
    const fl = [];
    for (let i = 0; i < 4; i++) {
      lab.cone(-0.3 + i * 0.2, 0.3, 0, 0.12, 0.16, 0.12, 0x9fe8c0, { glow: true });
      lab.cyl(-0.3 + i * 0.2, 0.42, 0, 0.04, 0.08, 0.04, 0xdfe3e8);
      const b = p.dyn(-0.7 + i * 0.2, 0.45, -0.55);
      fl.push({ n: b.node, m: b.sphere(0, 0, 0, 0.04, 0.04, 0.04, 0x5eff8a, { glow: true, own: true }), ph: rng() * 6 });
    }
    for (let i = 0; i < 10; i++) p.cyl(0.2 + rng() * 1.0, 0.03, -0.75 + rng() * 0.7, 0.04, 0.12, 0.04, [0x7a4fd0, 0x2c2c33, 0xff6bb5][i % 3], { rz: Math.PI / 2, ry: rng() * 3 });
    for (let i = 0; i < 4; i++) p.cyl(0.5 + i * 0.15, 0.06, -0.15, 0.06, 0.12, 0.06, 0xff9f2a);
    p.anim((t) => {
      smoke.forEach((n, i) => {
        const k = (t * 0.3 + i / 3) % 1;
        n.position.set(-0.4 + k * 0.2, 0.35 + k * 0.8, 0.55);
        n.scale.setScalar(0.5 + k);
      });
      siren.material.userData.flick = Math.sin(t * 6) > 0 ? 1 : 0.15;
      fl.forEach((f) => {
        const k = (t * 0.8 + f.ph) % 1;
        f.n.position.y = 0.45 + k * 0.3;
        f.m.material.userData.flick = 1 - k;
      });
    });
    return { mist: 4, mistY: 0.25 };
  },

  // 髒川島：a stone-banked canal of murky water with floating trash bags, bottles and belly-up fish, a little arched bridge, an overflowing bin
  riverisle(p, rng) {
    p.box(0, 0.03, 0.15, 3.0, 0.04, 0.9, 0x4f4a26);
    for (const z of [-0.32, 0.62]) p.box(0, 0.09, z, 3.0, 0.16, 0.08, C.stone);
    // arched footbridge
    const br = p.sub(0.2, 0, 0.15);
    br.box(0, 0.24, 0, 0.36, 0.05, 1.05, C.stone);
    for (const z of [-0.5, 0.5]) br.box(0, 0.12, z, 0.36, 0.24, 0.06, C.dstone);
    for (const x of [-0.17, 0.17]) br.box(x, 0.33, 0, 0.03, 0.14, 1.05, C.white);
    // floating junk and dead fish, bobbing
    const bob = [];
    for (let i = 0; i < 15; i++) {
      const x = -1.3 + rng() * 2.6;
      if (Math.abs(x - 0.2) < 0.25) continue;
      const f = p.dyn(x, 0.07, -0.15 + rng() * 0.6, rng() * 6);
      if (i % 3 === 0) {
        f.sphere(0, 0, 0, 0.16, 0.06, 0.07, 0xdfe3d0);
        f.cone(-0.1, 0, 0, 0.06, 0.06, 0.02, 0xdfe3d0, { rz: Math.PI / 2 });
        for (const dz of [0.03, -0.03]) for (const ry of [0.785, -0.785]) f.box(0.05, 0.03, dz, 0.025, 0.005, 0.006, C.black, { ry });
      } else if (i % 3 === 1) f.sphere(0, 0, 0, 0.14, 0.1, 0.12, [C.black, 0x3a5a8a, C.white][i % 3]);
      else f.cyl(0, 0, 0, 0.04, 0.12, 0.04, 0x8fd0c0, { rz: Math.PI / 2 });
      bob.push({ n: f.node, ph: rng() * 6 });
    }
    // banks: overflowing bin, litter, a lamp, a sad sign
    const bin = p.sub(-0.9, 0, -0.65);
    bin.cyl(0, 0.16, 0, 0.22, 0.32, 0.22, 0x2e7d4f);
    for (let i = 0; i < 4; i++) bin.sphere((rng() - 0.5) * 0.2, 0.34 + rng() * 0.06, (rng() - 0.5) * 0.2, 0.12, 0.1, 0.12, [C.black, C.white, 0x3a5a8a][i % 3]);
    for (let i = 0; i < 6; i++) p.sphere(-1.2 + rng() * 2.4, 0.04, -0.6 - rng() * 0.3, 0.1, 0.06, 0.1, [C.black, C.white, 0x3a5a8a, 0xc9a227][i % 4]);
    for (let i = 0; i < 5; i++) p.cyl(-1.1 + rng() * 2.2, 0.03, 0.8 + rng() * 0.15, 0.03, 0.1, 0.03, 0x8fd0c0, { rz: Math.PI / 2, ry: rng() * 3 });
    for (const x of [-0.4, 0.9]) {
      p.cyl(x, 0.45, -0.45, 0.03, 0.9, 0.03, C.black);
      p.sphere(x, 0.92, -0.45, 0.09, 0.09, 0.09, C.lamp, { glow: true });
    }
    // a bench with a sleeping bag under the bridge end
    p.box(0.9, 0.06, 0.85, 0.5, 0.08, 0.18, 0x5a6b3a);
    // green-brown stink haze
    const haze = [];
    for (let i = 0; i < 4; i++) {
      const h = p.dyn(-1 + i * 0.65, 0.3, 0.15);
      haze.push({ m: h.sphere(0, 0, 0, 0.35, 0.12, 0.3, 0x9db04a, { glow: true, own: true }), n: h.node, ph: rng() * 6 });
    }
    p.anim((t) => {
      bob.forEach((b) => {
        b.n.position.y = 0.07 + Math.sin(t * 1.4 + b.ph) * 0.015;
        b.n.rotation.y += 0.002;
      });
      haze.forEach((h) => {
        h.n.position.y = 0.3 + Math.sin(t * 0.7 + h.ph) * 0.06;
        h.m.material.userData.flick = 0.25 + Math.sin(t + h.ph) * 0.1;
      });
    });
    return { mist: 6, mistY: 0.2 };
  },

  // 12 北屯：第七病棟
  hospital(p, rng) {
    p.box(0, 0.6, -0.5, 1.9, 1.2, 0.7, 0x9aa49c);
    p.box(-0.9, 0.42, 0.3, 0.55, 0.84, 0.7, 0x8e978f);
    p.box(0, 1.22, -0.5, 1.95, 0.05, 0.75, 0x6a726c);
    const wins = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 6; c++) {
        const lit = rng() < 0.4;
        const w = p.dyn(-0.75 + c * 0.3, 0.3 + r * 0.33, -0.145);
        const m = w.box(0, 0, 0, 0.16, 0.18, 0.02, lit ? C.sick : 0x2b302d, { glow: lit, own: lit });
        if (lit) wins.push({ m, ph: rng() * 10 });
      }
    p.anim((t) => {
      for (const w of wins) w.m.material.userData.flick = Math.sin(t * 13 + w.ph) > 0.93 ? 0.1 : Math.sin(t * 0.4 + w.ph) > -0.6 ? 1 : 0.15;
    });
    p.box(0.6, 1.45, -0.5, 0.36, 0.1, 0.06, C.blood, { glow: true });
    p.box(0.6, 1.45, -0.5, 0.1, 0.36, 0.06, C.blood, { glow: true });
    p.box(0.2, 0.32, 0.0, 0.6, 0.04, 0.32, 0x6a726c);
    p.box(0.2, 0.15, -0.13, 0.3, 0.3, 0.02, C.black);
    // the wheelchair that turns toward the corridor
    const wc = p.dyn(0.75, 0, 0.7);
    wc.box(0, 0.16, 0, 0.18, 0.04, 0.18, C.metal);
    wc.box(0, 0.26, -0.09, 0.18, 0.2, 0.03, C.metal);
    wc.box(0, 0.2, 0, 0.16, 0.06, 0.14, 0x6a7a8a);
    for (const x of [-0.1, 0.1]) wc.torus(x, 0.12, 0, 0.24, 0.24, 0.6, C.black, { ry: Math.PI / 2 });
    p.anim((t) => (wc.node.rotation.y = Math.sin(t * 0.2) * 1.2));
    p.box(-0.3, 0.14, 0.95, 0.62, 0.28, 0.3, C.white);
    p.box(-0.3, 0.14, 1.1, 0.62, 0.06, 0.005, C.red);
    deadTree(p, 1.15, 0.1, 1.2);
    deadTree(p, 1.0, -1.05, 1.0, 1);
    for (let i = 0; i < 10; i++) p.box(-1.3 + i * 0.28, 0.1, 1.35 - Math.abs(i - 4.5) * 0.05, 0.03, 0.2, 0.03, C.black);
  },

  // 13 太平：無人吊橋
  bridge(p, rng) {
    p.box(0, 0.006, 0, 0.7, 0.012, 3.4, C.water);
    for (let i = 0; i < 9; i++) p.ico((rng() - 0.5) * 0.4, 0.04, -1.2 + i * 0.3, 0.14, 0.08, 0.12, 0x8a8478, { ry: rng() * 3 });
    for (const s of [-1, 1]) {
      p.box(s * 0.95, 0.3, 0, 1.15, 0.6, 2.6, 0x55663e);
      p.box(s * 0.95, 0.6, 0, 1.0, 0.02, 2.4, 0x4f5f39);
      for (let i = 0; i < 4; i++) pine(p.sub(s * (0.75 + (i % 2) * 0.35), 0.6, -0.9 + i * 0.55), 0, 0, 0.75);
      p.box(s * 0.42, 0.85, -0.18, 0.05, 0.5, 0.05, C.dwood);
      p.box(s * 0.42, 0.85, 0.18, 0.05, 0.5, 0.05, C.dwood);
    }
    const br = p.dyn(0, 0, 0);
    const sag = (u) => 0.6 - 0.14 * (1 - (2 * u - 1) ** 2);
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      br.box(-0.4 + u * 0.8, sag(u), 0, 0.075, 0.025, 0.32, C.wood);
    }
    for (const z of [-0.18, 0.18])
      for (let i = 0; i < 8; i++) {
        const u0 = i / 8,
          u1 = (i + 1) / 8;
        const x0 = -0.4 + u0 * 0.8,
          x1 = -0.4 + u1 * 0.8,
          y0 = sag(u0) + 0.24,
          y1 = sag(u1) + 0.24;
        br.box((x0 + x1) / 2, (y0 + y1) / 2, z, 0.105, 0.012, 0.012, C.rope, { rz: Math.atan2(y1 - y0, x1 - x0) });
        if (i % 2 === 0) lantern(br, x0 + 0.05, y0 - 0.05, z, C.blood, 0.35);
      }
    p.anim((t) => (br.node.rotation.x = Math.sin(t * 1.1) * 0.03));
  },

  // 14 大肚・烏日：廚餘湖（市政議題：廚餘處理）
  foodlake(p, rng) {
    // dug pit: raised dirt rim around a sunken sludge lake
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      p.ico(Math.cos(a) * 1.05, 0.12, 0.15 + Math.sin(a) * 0.82, 0.55, 0.32 + rng() * 0.14, 0.42, i % 3 ? 0x7a6346 : 0x6a553c, { ry: a });
    }
    const lake = p.dyn(0, 0, 0.15);
    lake.cyl(0, 0.04, 0, 1.75, 0.04, 1.3, 0xb8894a);
    for (let i = 0; i < 14; i++) lake.sphere((rng() - 0.5) * 1.3, 0.06, (rng() - 0.5) * 0.9, 0.08, 0.03, 0.08, i % 2 ? 0xd2a35c : 0x9c6d36);
    // green tarps sliding down the slope from the tipping chute
    for (let i = 0; i < 4; i++) p.box(-0.55 + i * 0.22, 0.17, -0.48, 0.24, 0.02, 0.5, i % 2 ? 0x2f4a3a : 0x3c5a48, { rx: -0.55, rz: (i - 1.5) * 0.08 });
    for (let i = 0; i < 3; i++) p.box(-0.42 + i * 0.25, 0.14, -0.38, 0.06, 0.01, 0.4, 0xcf8f3e, { rx: -0.55 });
    // wooden tipping table with blue barrels
    const t = p.sub(-0.3, 0, -1.1);
    for (const [x, z] of [[-0.3, -0.15], [0.3, -0.15], [-0.3, 0.15], [0.3, 0.15]]) t.box(x, 0.18, z, 0.04, 0.36, 0.04, C.wood);
    t.box(0, 0.37, 0.05, 0.75, 0.04, 0.4, C.wood, { rx: 0.25 });
    t.cyl(0.05, 0.47, 0.05, 0.18, 0.28, 0.18, 0x2c6db5, { rz: 1.2 });
    for (let i = 0; i < 4; i++) p.cyl(-1.1 + (i % 2) * 0.22, 0.14, -0.95 + Math.floor(i / 2) * 0.22, 0.18, 0.28, 0.18, 0x2c6db5);
    p.box(0.2, 0.3, -1.25, 0.24, 0.3, 0.02, C.white);
    // traffic cones that move on their own
    const cones = [];
    for (const [x, z] of [[-1.25, -0.35], [0.95, -0.75], [1.3, 0.55]]) {
      const c = p.dyn(x, 0, z);
      c.cone(0, 0.13, 0, 0.16, 0.26, 0.16, 0xf06a1e);
      c.cyl(0, 0.13, 0, 0.1, 0.05, 0.1, C.white);
      c.box(0, 0.01, 0, 0.2, 0.02, 0.2, 0xf06a1e);
      cones.push({ n: c.node, x, z });
    }
    // bubbles rising and popping
    const bubbles = [];
    for (let i = 0; i < 7; i++) {
      const b = p.dyn((rng() - 0.5) * 1.2, 0.08, 0.15 + (rng() - 0.5) * 0.8);
      b.sphere(0, 0, 0, 0.1, 0.1, 0.1, 0xd9ad66);
      bubbles.push({ n: b.node, ph: rng() });
    }
    p.anim((tt, dt, env) => {
      bubbles.forEach((b) => {
        const u = (tt * (0.25 + env.night * 0.35) + b.ph) % 1;
        b.n.scale.setScalar(0.2 + u * 1.2);
        b.n.visible = u < 0.92;
      });
      cones.forEach((c, i) => (c.n.position.x = c.x + Math.sin(tt * 0.3 + i * 2) * 0.12 * env.night));
    });
    // tall grass by the rim
    for (let i = 0; i < 6; i++) p.cone(0.9 + (i % 3) * 0.12, 0.2, 0.95 - Math.floor(i / 3) * 0.15, 0.06, 0.4, 0.06, 0x6f8a46, { rz: (rng() - 0.5) * 0.5 });
    return { mist: 4, mistY: 0.15 };
  },

  // 15 中區・南屯：最後一場電影
  cinema(p) {
    p.box(0, 0.6, -0.6, 1.6, 1.2, 0.85, 0xc9b896);
    p.box(0, 1.32, -0.2, 1.0, 0.24, 0.06, 0xc9b896);
    p.box(0, 1.32, -0.165, 0.86, 0.12, 0.02, C.red);
    p.box(0, 0.88, -0.1, 1.3, 0.2, 0.14, 0x2a2224);
    p.box(0, 0.88, -0.025, 1.18, 0.12, 0.01, C.warm, { glow: true });
    const bulbs = [];
    for (let i = 0; i < 12; i++) {
      const b = p.dyn(-0.6 + i * 0.109, 1.0, -0.03);
      bulbs.push(b.sphere(0, 0, 0, 0.035, 0.035, 0.035, C.lamp, { glow: true, own: true }));
    }
    p.anim((t) => bulbs.forEach((b, i) => (b.material.userData.flick = (Math.floor(t * 6) + i) % 4 === 0 ? 0.15 : 1)));
    for (const x of [-0.55, 0.55]) {
      p.box(x, 0.42, -0.16, 0.34, 0.5, 0.02, x < 0 ? 0x5a2a3a : 0x2a3a5a);
      p.box(x, 0.42, -0.15, 0.26, 0.4, 0.01, 0xd8c8a0);
    }
    p.box(0, 0.22, 0.12, 0.34, 0.44, 0.26, 0x5a3a2a);
    p.box(0, 0.26, 0.255, 0.22, 0.14, 0.01, C.warm, { glow: true });
    for (let i = 0; i < 6; i++) p.box(0, 0.01, 0.45 + i * 0.2, 0.5, 0.02, 0.18, i % 2 ? 0x77706a : 0x6a645e);
    house(p, -1.0, 0.75, 0.48, 0.42, 0.42, 0x8a6a4e, C.tile, 0.25);
    house(p, 1.0, 0.75, 0.48, 0.42, 0.38, 0x7a5e44, C.tile, -0.25);
  },

  // 16 大里・霧峰：紅燈籠古厝
  mansion(p) {
    p.box(0, 0.01, 0.05, 1.05, 0.02, 1.1, 0xa89a88);
    const hall = p.sub(0, 0, -0.75);
    hall.box(0, 0.25, 0, 1.45, 0.5, 0.48, C.brick);
    hall.gable(0, 0.5, 0, 0.65, 0.32, 1.6, C.tile, { ry: Math.PI / 2 });
    hall.box(0, 0.83, 0, 1.65, 0.04, 0.05, C.tile);
    hall.box(0, 0.2, 0.245, 0.3, 0.38, 0.02, 0x2a1a14);
    hall.box(0, 0.2, 0.25, 0.22, 0.3, 0.01, C.blood, { glow: true });
    for (const s of [-1, 1]) {
      const w = p.sub(s * 0.78, 0, 0.05);
      w.box(0, 0.21, 0, 0.45, 0.42, 1.0, C.brick);
      w.gable(0, 0.42, 0, 0.6, 0.26, 1.05, C.tile);
      for (let i = 0; i < 2; i++) w.box(-s * 0.23, 0.24, -0.25 + i * 0.5, 0.02, 0.14, 0.14, C.warm, { glow: true });
    }
    p.box(-0.55, 0.15, 1.0, 0.5, 0.3, 0.1, C.brick);
    p.box(0.55, 0.15, 1.0, 0.5, 0.3, 0.1, C.brick);
    // red lanterns under the eaves, swaying
    const lamps = [];
    for (let i = 0; i < 5; i++) {
      const l = p.dyn(-0.6 + i * 0.3, 0.5, -0.45);
      lantern(l, 0, -0.08, 0, C.blood, 0.75);
      lamps.push(l.node);
    }
    p.anim((t) => lamps.forEach((n, i) => (n.rotation.z = Math.sin(t * 1.6 + i) * 0.12)));
    // the bridal sedan at the gate
    const sd = p.sub(0, 0, 0.65);
    sd.box(0, 0.25, 0, 0.3, 0.36, 0.32, C.red);
    sd.pyr(0, 0.5, 0, 0.36, 0.14, 0.38, C.tile);
    sd.box(0, 0.2, 0.165, 0.18, 0.24, 0.01, C.yellow);
    for (const x of [-0.12, 0.12]) sd.box(x, 0.22, 0, 0.03, 0.03, 0.85, C.dwood);
    deadTree(p, 1.2, -0.9, 1.1);
    deadTree(p, -1.2, -0.95, 1.0, 2);
  },
};

// Deep-mountain filler plateaus: dense pines and rocks, no legend attached.
export function wildForest(p, rng) {
  const f = p.sub(0, WILD_TOP - TOP, 0);
  for (let i = 0; i < 22; i++) {
    const a = rng() * Math.PI * 2,
      r = Math.sqrt(rng()) * 1.5;
    pine(f, Math.cos(a) * r, Math.sin(a) * r * 0.95, 0.8 + rng() * 0.6);
  }
  for (let i = 0; i < 4; i++) f.ico((rng() - 0.5) * 2.4, 0.08, (rng() - 0.5) * 2.4, 0.3, 0.2, 0.26, C.dstone, { ry: rng() * 3 });
}
