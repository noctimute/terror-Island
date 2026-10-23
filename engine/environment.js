// Non-legend scenery: sky, sun/moon, terrain (sea to the west, Central Range to the east), trees, mist.
// Everything here is decorative and makes no geographic claim beyond "coast west, mountains east".
import { SimplexNoise } from "three/addons/math/SimplexNoise.js";
import { S } from "./world.js?v=1";

export const WATER_Y = -0.28;

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Day keyframes (minutes): sky top, horizon, light colour, light intensity, hemi sky, hemi ground, hemi intensity,
// night factor, fog colour, fog near, fog far, water colour
const KEYS = [
  [0, 0x111428, 0x342c4e, 0xa3b2ff, 1.9, 0x8a96c8, 0x3a3040, 2.8, 1, 0x26223a, 30, 95, 0x1a2633],
  [300, 0x16172f, 0x3e3250, 0xa8b4ff, 1.85, 0x8f96c4, 0x3c3244, 2.7, 1, 0x2c2840, 28, 90, 0x1c2836],
  [360, 0x4a4c78, 0xd39684, 0xffa27a, 1.25, 0xd8b6ae, 0x4b3b3b, 1.05, 0.5, 0x8c7684, 24, 80, 0x4e5a68],
  [450, 0x8aa1b4, 0xd8cfbf, 0xffe0c0, 2.0, 0xdfe3e4, 0x6a5f50, 1.15, 0, 0xb5b0a4, 30, 100, 0x5f7a80],
  [720, 0x91a5b2, 0xdad6cb, 0xfff0dc, 2.5, 0xe8ebec, 0x7a6e5c, 1.25, 0, 0xc2c0b6, 34, 110, 0x6a8488],
  [960, 0x8e9caa, 0xd9ccb5, 0xffd9ac, 2.2, 0xe6dfd4, 0x75684f, 1.2, 0, 0xc0b6a4, 32, 105, 0x637a7f],
  [1065, 0x5b3a5d, 0xe0714b, 0xff6b3b, 1.75, 0xe2a08a, 0x5a3a38, 1.1, 0.3, 0x9c5b4b, 28, 95, 0x5a4a52],
  [1140, 0x2c2241, 0x8c3b3b, 0xff5c4a, 1.05, 0x9c7c9c, 0x3a2a2e, 1.25, 0.75, 0x4b2f39, 26, 88, 0x2b2a3a],
  [1260, 0x13152c, 0x372e4e, 0xa9b5ff, 1.9, 0x8a95c6, 0x3a3040, 2.8, 1, 0x29243e, 30, 95, 0x1a2634],
  [1440, 0x111428, 0x342c4e, 0xa3b2ff, 1.9, 0x8a96c8, 0x3a3040, 2.8, 1, 0x26223a, 30, 95, 0x1a2633],
];

// terrain: { sea: "west" | "none", mountains: "east" | "ring" } — set per city in data.json meta.terrain
export function createEnvironment(THREE, { scene, renderer, centers, bounds, quality, reduced, terrain: shape = {} }) {
  const hasSea = shape.sea !== "none",
    ring = shape.mountains === "ring";
  const rng = mulberry(20261031);
  const noise = new SimplexNoise({ random: rng });
  const high = quality === "high";
  const group = new THREE.Group();
  group.name = "environment";
  scene.add(group);

  // ---- sky dome ----
  const skyU = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyU,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vP;
        void main(){ float h = clamp(vP.y * 1.6 + 0.08, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0); }`,
    }),
  );
  sky.renderOrder = -10;
  group.add(sky);

  // ---- stars & moon ----
  const starPos = [];
  for (let i = 0; i < 900; i++) {
    const th = rng() * Math.PI * 2,
      ph = Math.acos(rng() * 0.9 + 0.1);
    starPos.push(Math.sin(ph) * Math.cos(th) * 360, Math.cos(ph) * 360, Math.sin(ph) * Math.sin(th) * 360);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  const glowTex = radialTexture(THREE, [
    [0, "rgba(255,255,255,1)"],
    [0.18, "rgba(255,250,235,0.95)"],
    [0.24, "rgba(255,240,220,0.35)"],
    [1, "rgba(255,240,220,0)"],
  ]);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1d6, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  moon.scale.setScalar(46);
  group.add(moon);

  // ---- lights ----
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = -22;
  sc.right = 22;
  sc.top = 16;
  sc.bottom = -16;
  sc.near = 1;
  sc.far = 90;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog(0x000000, 30, 100);

  // ---- terrain ----
  const centerList = [...centers.values()];
  const distCity = (x, z) => {
    let d = Infinity;
    for (const c of centerList) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - S * 1.05);
    return d;
  };
  const coastAt = hasSea ? (z) => bounds.minX - 2.6 + noise.noise(z * 0.08, 3.1) * 1.4 : () => -1e9;
  const SIZE = 170,
    SEG = high ? 200 : 130;
  const tGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  tGeo.rotateX(-Math.PI / 2);
  const pos = tGeo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const cSand = new THREE.Color(0xa99a74),
    cDry = new THREE.Color(0x6c6d45),
    cGrass = new THREE.Color(0x4f5a38),
    cForest = new THREE.Color(0x2f3a2a),
    cRock = new THREE.Color(0x5f5a52),
    cMud = new THREE.Color(0x4a443a),
    tmp = new THREE.Color();
  const heightAtTerrain = (x, z) => {
    const d = distCity(x, z);
    const coast = coastAt(z);
    let h = -0.04;
    h += noise.noise(x * 0.06, z * 0.06) * 0.35 * smooth(0.5, 6, d);
    const east = smooth(bounds.maxX - 2, bounds.maxX + 16, x) * smooth(0.6, 5, d);
    const north = smooth(bounds.minZ + 1, bounds.minZ - 14, z) * smooth(bounds.minX, bounds.maxX, x) * smooth(0.6, 5, d);
    const ridge = 1 - Math.abs(noise.noise(x * 0.045, z * 0.045));
    // "ring" wraps the city in hills on every side (a basin); "east" puts the range on the east only
    const mount = ring ? smooth(2.5, 14, d) : Math.max(east, north * 0.7);
    h += mount * (2.5 + ridge * ridge * 9 + noise.noise(x * 0.15, z * 0.15) * 0.8);
    // low tableland between the city and the sea
    if (hasSea) h += smooth(coast + 1, coast + 4, x) * smooth(bounds.minX + 4, bounds.minX + 1, x) * smooth(0.4, 3, d) * 0.9;
    if (x < coast) h = Math.min(h, WATER_Y - 0.15 - smooth(0, 6, coast - x) * 1.6);
    else h = Math.max(h, -0.05 + (x < coast + 1.2 ? -0.2 * (1 - (x - coast) / 1.2) : 0));
    return h;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    const h = heightAtTerrain(x, z);
    pos.setY(i, h);
    const coast = coastAt(z);
    if (x < coast + 1.4 && h < 0.25) tmp.copy(cSand);
    else if (h > 6) tmp.copy(cRock).lerp(cForest, smooth(9, 6, h) * 0.6);
    else if (h > 1.6) tmp.copy(cForest);
    else if (h > 0.6) tmp.copy(cGrass).lerp(cForest, smooth(0.6, 1.6, h));
    else tmp.copy(cDry).lerp(cGrass, smooth(-0.1, 0.6, h + noise.noise(x * 0.3, z * 0.3) * 0.25));
    if (distCity(x, z) < 0.9) tmp.lerp(cMud, 0.5);
    const v = 0.92 + noise.noise(x * 0.9, z * 0.9) * 0.08;
    col[i * 3] = tmp.r * v;
    col[i * 3 + 1] = tmp.g * v;
    col[i * 3 + 2] = tmp.b * v;
  }
  tGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  tGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  terrain.position.y = -0.03;
  terrain.receiveShadow = true;
  group.add(terrain);

  // ---- sea (west) ----
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2a3a48, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE, 1, 1).rotateX(-Math.PI / 2), waterMat);
  water.position.set(bounds.minX - 2.6 - SIZE / 2 + 6, WATER_Y, 0);
  water.receiveShadow = true;
  if (hasSea) group.add(water);

  // ---- shoreline: tetrapods (消波塊) along the coast, plus an optional moored ship at the harbour zone ----
  const bobbers = [];
  const shoreHits = [];
  let shipObj = null;
  if (hasSea) {
    const arm = (dir) => new THREE.CylinderGeometry(0.02, 0.07, 0.2, 5).translate(0, 0.1, 0).applyMatrix4(new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, new THREE.Vector3(0, 0, 1)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    const tetraGeo = mergeSimple(THREE, [arm(new THREE.Vector3(0, 1, 0)), ...[0, 1, 2].map((i) => arm(new THREE.Vector3(Math.cos((i * Math.PI * 2) / 3) * 0.943, -0.333, Math.sin((i * Math.PI * 2) / 3) * 0.943)))]);
    const harbour = shape.harbour && centers.get(shape.harbour);
    const tetras = [];
    for (let z = bounds.minZ - 6; z < bounds.maxZ + 6; z += 0.16) {
      // leave a gap in the wall where the ship's pier meets the shore
      if (harbour && Math.abs(z - harbour.z) < 0.5) continue;
      for (let row = 0; row < 2; row++) {
        if (rng() < 0.25) continue;
        tetras.push({ x: coastAt(z) - 0.15 - row * 0.2 + (rng() - 0.5) * 0.12, y: WATER_Y + 0.04 + row * -0.02 + rng() * 0.05, z: z + (rng() - 0.5) * 0.08, s: 0.8 + rng() * 0.4, r: rng() * 6, q: rng() * 6 });
      }
    }
    const tetraMat = new THREE.MeshStandardMaterial({ color: 0x9c9a92, roughness: 0.95, flatShading: true });
    const tim = new THREE.InstancedMesh(tetraGeo, tetraMat, tetras.length);
    const ob = new THREE.Object3D();
    tetras.forEach((t, i) => {
      ob.position.set(t.x, t.y, t.z);
      ob.rotation.set(t.q, t.r, t.q * 0.5);
      ob.scale.setScalar(t.s);
      ob.updateMatrix();
      tim.setMatrixAt(i, ob.matrix);
    });
    tim.castShadow = tim.receiveShadow = true;
    group.add(tim);
    // the tetrapods are tiny on screen, so clicks are caught by invisible blocks along the breakwater
    const hitGeo = new THREE.BoxGeometry(0.8, 0.5, 0.82);
    for (let z = bounds.minZ - 6; z < bounds.maxZ + 6; z += 0.8) {
      if (harbour && Math.abs(z - harbour.z) < 0.5) continue;
      const b = new THREE.Mesh(hitGeo);
      b.position.set(coastAt(z) - 0.25, WATER_Y + 0.15, z);
      b.visible = false;
      b.updateMatrixWorld();
      shoreHits.push(b);
    }

    if (harbour) {
      // a Hong Kong cargo ship that had joined PLA drills, moored at Taichung Port (see 國安島)
      const coast = coastAt(harbour.z);
      const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true, ...o });
      const add = (g, geo, mat, x, y, z) => {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = mesh.receiveShadow = true;
        g.add(mesh);
        return mesh;
      };
      const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
      // pier from the shore out to the ship
      add(group, B(1.6, 0.08, 0.36), m(0x8a8580), coast - 0.7, WATER_Y + 0.1, harbour.z);
      for (let i = 0; i < 4; i++) add(group, B(0.06, 0.4, 0.06), m(0x5a5650), coast - 0.1 - i * 0.45, WATER_Y - 0.05, harbour.z + 0.15);
      const ship = new THREE.Group();
      ship.position.set(coast - 1.85, WATER_Y, harbour.z + 0.05);
      ship.rotation.y = Math.PI / 2;
      const hull = m(0x8e2420),
        deck = m(0x3b3436),
        white = m(0xeeeae2);
      add(ship, B(3.2, 0.36, 0.7), hull, 0, 0.12, 0);
      add(ship, B(0.5, 0.3, 0.5), hull, 1.75, 0.16, 0).rotation.y = Math.PI / 4;
      add(ship, B(3.1, 0.05, 0.66), deck, 0, 0.32, 0);
      add(ship, B(0.5, 0.55, 0.6), white, -1.25, 0.6, 0);
      add(ship, B(0.56, 0.06, 0.66), white, -1.25, 0.9, 0);
      add(ship, B(0.12, 0.3, 0.12), m(0x2b2b2b), -1.35, 1.05, 0);
      const win = m(0x9fc6e8, { emissive: 0x6fa0d0, emissiveIntensity: 0.4 });
      for (const zz of [-0.15, 0, 0.15]) add(ship, B(0.02, 0.07, 0.1), win, -0.99, 0.78, zz);
      const box = [0x2c6db5, 0xc9a227, 0x2e9e5b, 0x7f8c8d, 0xb5502c];
      for (let i = 0; i < 6; i++) for (let k = 0; k < 2; k++) add(ship, B(0.36, 0.2, 0.28), m(box[(i + k * 2) % box.length]), -0.75 + i * 0.4, 0.45 + (i % 3 === 1 && k ? 0.2 : 0), k ? 0.15 : -0.15);
      // mast with a small red flag
      add(ship, new THREE.CylinderGeometry(0.015, 0.015, 0.6, 5), m(0xd0d0d0), 1.35, 0.6, 0);
      add(ship, B(0.18, 0.11, 0.01), m(0xc8102e), 1.45, 0.82, 0);
      group.add(ship);
      bobbers.push(ship);
      shipObj = ship;
      // a coast-guard patrol boat alongside
      const cg = new THREE.Group();
      cg.position.set(coast - 1.6, WATER_Y, harbour.z + 1.0);
      cg.rotation.y = Math.PI / 2 + 0.2;
      add(cg, B(0.8, 0.16, 0.28), white, 0, 0.06, 0);
      add(cg, B(0.3, 0.16, 0.22), white, -0.1, 0.22, 0);
      add(cg, B(0.81, 0.04, 0.29), m(0x1f4f9a), 0, 0.03, 0);
      group.add(cg);
      bobbers.push(cg);
    }
  }

  // ---- trees: pines on the mountains, round trees on the plain, dead trees near the city ----
  const trees = { pine: [], round: [], dead: [] };
  const want = high ? 1700 : 850;
  for (let tries = 0; tries < want * 6 && trees.pine.length + trees.round.length + trees.dead.length < want; tries++) {
    const x = (rng() - 0.5) * SIZE * 0.82,
      z = (rng() - 0.5) * SIZE * 0.82;
    const d = distCity(x, z);
    if (d < 0.7) continue;
    if (x < coastAt(z) + 1.2) continue;
    const h = heightAtTerrain(x, z) - 0.03;
    if (h > 9.5) continue;
    const s = 0.55 + rng() * 0.6;
    if (h > 1.2) trees.pine.push({ x, y: h, z, s: s * 1.15, r: rng() * 6 });
    else if (d < 4 && rng() < 0.55) trees.dead.push({ x, y: h, z, s, r: rng() * 6 });
    else if (rng() < 0.5) trees.round.push({ x, y: h, z, s, r: rng() * 6 });
    else trees.pine.push({ x, y: h, z, s, r: rng() * 6 });
  }
  const o = new THREE.Object3D();
  const instanced = (geo, mat, list, place) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((t, i) => {
      place(o, t);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
    return im;
  };
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2c24, roughness: 1 });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x2b3a2c, roughness: 1, flatShading: true });
  const roundMat = new THREE.MeshStandardMaterial({ color: 0x3f4c30, roughness: 1, flatShading: true });
  const deadMat = new THREE.MeshStandardMaterial({ color: 0x2e2622, roughness: 1 });
  const trunk = new THREE.CylinderGeometry(0.05, 0.07, 0.4, 5);
  instanced(trunk, trunkMat, [...trees.pine, ...trees.round], (o, t) => {
    o.position.set(t.x, t.y + 0.2 * t.s, t.z);
    o.scale.setScalar(t.s);
    o.rotation.set(0, t.r, 0);
  });
  const pines = instanced(new THREE.ConeGeometry(0.34, 1.1, 6), pineMat, trees.pine, (o, t) => {
    o.position.set(t.x, t.y + 0.85 * t.s, t.z);
    o.scale.set(t.s, t.s * (1 + (t.r % 1) * 0.4), t.s);
    o.rotation.set(0, t.r, 0);
  });
  instanced(new THREE.IcosahedronGeometry(0.36, 0), roundMat, trees.round, (o, t) => {
    o.position.set(t.x, t.y + 0.6 * t.s, t.z);
    o.scale.set(t.s, t.s * 0.9, t.s);
    o.rotation.set(t.r, t.r, 0);
  });
  // dead tree: crooked trunk plus two bare branches, merged into one geometry
  const deadGeo = mergeSimple(THREE, [
    new THREE.CylinderGeometry(0.03, 0.06, 0.9, 5).translate(0, 0.45, 0),
    new THREE.CylinderGeometry(0.015, 0.03, 0.45, 4).rotateZ(0.9).translate(0.16, 0.72, 0),
    new THREE.CylinderGeometry(0.015, 0.03, 0.38, 4).rotateZ(-0.8).rotateY(1.2).translate(-0.08, 0.6, 0.1),
    new THREE.CylinderGeometry(0.01, 0.02, 0.25, 4).rotateZ(0.4).translate(-0.04, 0.98, 0),
  ]);
  instanced(deadGeo, deadMat, trees.dead, (o, t) => {
    o.position.set(t.x, t.y, t.z);
    o.scale.setScalar(t.s);
    o.rotation.set(0, t.r, (t.r % 1) * 0.2 - 0.1);
  });

  // ---- drifting mist ----
  const mistTex = radialTexture(THREE, [
    [0, "rgba(255,255,255,0.55)"],
    [0.5, "rgba(255,255,255,0.18)"],
    [1, "rgba(255,255,255,0)"],
  ]);
  const mists = [];
  const addMist = (x, z, n = 6, spread = 2, y = 0.6, size = 3.2, strength = 1) => {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({ map: mistTex, color: 0xdfe0e8, transparent: true, opacity: 0, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      const s = size * (0.7 + rng() * 0.6);
      sp.scale.set(s * 1.6, s * 0.6, 1);
      sp.position.set(x + (rng() - 0.5) * spread * 2, y + rng() * 0.6, z + (rng() - 0.5) * spread * 2);
      sp.userData = { ox: sp.position.x, oz: sp.position.z, ph: rng() * 6.28, sp: 0.15 + rng() * 0.2, strength };
      sp.renderOrder = 3;
      group.add(sp);
      mists.push(sp);
    }
  };
  // general ground mist across the city and up the eastern valleys
  for (let i = 0; i < (high ? 26 : 14); i++) {
    const x = bounds.minX + rng() * (bounds.maxX - bounds.minX + 10),
      z = bounds.minZ + rng() * (bounds.maxZ - bounds.minZ);
    addMist(x, z, 1, 0, 0.5 + rng() * 0.8, 4.5, 0.55);
  }

  const lerpKey = (minute) => {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= minute) i++;
    const a = KEYS[i],
      b = KEYS[i + 1];
    const t = smooth(0, 1, (minute - a[0]) / (b[0] - a[0]));
    return { a, b, t };
  };
  const ca = new THREE.Color(),
    cb = new THREE.Color();
  const mixC = (k, idx, target) => target.copy(ca.setHex(k.a[idx])).lerp(cb.setHex(k.b[idx]), k.t);
  const mixN = (k, idx) => k.a[idx] + (k.b[idx] - k.a[idx]) * k.t;

  const state = { night: 1, minute: 0 };
  const sunDir = new THREE.Vector3(),
    moonDir = new THREE.Vector3(-0.45, 0.82, 0.35).normalize(),
    lightDir = new THREE.Vector3();

  function setTime(minute) {
    const k = lerpKey(minute);
    state.minute = minute;
    mixC(k, 1, skyU.top.value);
    mixC(k, 2, skyU.horizon.value);
    mixC(k, 3, sun.color);
    sun.intensity = mixN(k, 4);
    mixC(k, 5, hemi.color);
    mixC(k, 6, hemi.groundColor);
    hemi.intensity = mixN(k, 7);
    state.night = mixN(k, 8);
    mixC(k, 9, scene.fog.color);
    scene.fog.near = mixN(k, 10);
    scene.fog.far = mixN(k, 11);
    mixC(k, 12, waterMat.color);
    // sun travels east (+x) to west (-x); the moon hangs in the south-west at night
    const a = ((minute - 360) / 720) * Math.PI;
    sunDir.set(Math.cos(a) * 0.8, Math.max(0.25, Math.sin(a)), 0.45).normalize();
    lightDir.copy(sunDir).lerp(moonDir, state.night).normalize();
    sun.position.copy(lightDir).multiplyScalar(40);
    sun.target.position.set(0, 0, 0);
    moon.position.copy(moonDir).multiplyScalar(300);
    moon.material.opacity = state.night;
    starMat.opacity = Math.max(0, state.night - 0.2) * 0.9;
    renderer.toneMappingExposure = 1.0 + state.night * 0.15;
  }

  function update(t) {
    const n = state.night;
    if (!reduced) bobbers.forEach((b, i) => (b.position.y = WATER_Y + Math.sin(t * 0.8 + i * 1.7) * 0.02));
    for (const m of mists) {
      const u = m.userData;
      if (!reduced) {
        m.position.x = u.ox + Math.sin(t * u.sp + u.ph) * 0.8;
        m.position.z = u.oz + Math.cos(t * u.sp * 0.7 + u.ph) * 0.5;
      }
      m.material.opacity = (0.12 + n * 0.32) * u.strength;
      m.material.color.copy(scene.fog.color).lerp(ca.setHex(0xe8e4ee), 0.55);
    }
  }

  return { group, sun, hemi, state, setTime, update, addMist, heightAtTerrain, shoreHits, pines, ship: shipObj };
}

function radialTexture(THREE, stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Minimal non-indexed merge for a handful of small geometries that share attributes.
export function mergeSimple(THREE, geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3),
    nor = new Float32Array(total * 3);
  let off = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    off += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return out;
}
