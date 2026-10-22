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
  d.sphere(0, 0.6 * s, 0, 0.3 * s, 0.32 * s, 0.28 * s, ink);
  for (const ex of [-0.065, 0.065]) {
    d.box(ex * s, 0.64 * s, 0.13 * s, 0.09 * s, 0.04 * s, 0.01 * s, C.white, { glow: true, rz: ex < 0 ? -0.25 : 0.25 });
    d.box(ex * s, 0.64 * s, 0.137 * s, 0.012 * s, 0.012 * s, 0.01 * s, C.black);
  }
  d.box(0, 0.52 * s, 0.128 * s, 0.13 * s, 0.03 * s, 0.01 * s, C.white, { glow: true }); // grin
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

  // 11 飛翔島（取材自真實新聞；人物為通用 Q 版示意，不對應任何特定死者）
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
      shadowman(w, 0.7);
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
