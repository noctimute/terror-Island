// Easter egg「台中都有槍」: small pistols lie on the roads around the map. Clicking one collects it,
// pops a toast, and shows a little collection menu with how many are left. Progress is kept per viewer;
// the guns still to find are scattered to new random spots on every visit.
import { S, hexVertex } from "./world.js?v=1";

const KEY = "taichung-guns-v1";

export function createGuns(THREE, { scene, centers, CSS2DObject, rng, count = 12, outside = 4, groundAt, blocked = centers, hud, onCollect, onReset }) {
  // candidate spots: midpoints of the road edges between hex corners
  const seen = new Set(),
    spots = [];
  for (const c of centers) {
    for (let i = 0; i < 6; i++) {
      const a = hexVertex(i, S),
        b = hexVertex((i + 1) % 6, S);
      const x = c.x + (a.x + b.x) / 2,
        z = c.z + (a.z + b.z) / 2;
      const k = `${Math.round(x * 10)}|${Math.round(z * 10)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      spots.push({ x, z });
    }
  }
  // random spots for n guns: most on the roads, a few in the open ground around the city
  function placeSpots(n) {
    const road = [...spots];
    for (let i = road.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [road[i], road[j]] = [road[j], road[i]];
    }
    const nOut = Math.round((n * outside) / count);
    const picks = road.slice(0, n - nOut).map((p) => ({ ...p, y: 0.02 }));
    for (let tries = 0; picks.length < n && tries < 400; tries++) {
      const c = centers[Math.floor(rng() * centers.length)];
      const a = rng() * Math.PI * 2,
        r = S * (1.3 + rng() * 1.2);
      const x = c.x + Math.cos(a) * r,
        z = c.z + Math.sin(a) * r;
      if (blocked.some((o) => Math.hypot(x - o.x, z - o.z) < S * 1.15)) continue;
      if (picks.some((o) => Math.hypot(x - o.x, z - o.z) < S)) continue;
      const y = groundAt ? groundAt(x, z) : 0;
      if (y < -0.12 || y > 0.9) continue;
      picks.push({ x, z, y: y + 0.02 });
    }
    return picks;
  }

  let found = new Set();
  try {
    found = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {}
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...found]));
    } catch {}
  };

  // like a police seizure table: mostly black pistols, a few two-tone or silver ones, a revolver and a rifle
  const black = new THREE.MeshStandardMaterial({ color: 0x1c1d22, roughness: 0.45, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c2e35, roughness: 0.7, metalness: 0.2 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xb9bcc4, roughness: 0.25, metalness: 0.85 });
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r, l, n = 8) => new THREE.CylinderGeometry(r, r, l, n).rotateZ(Math.PI / 2);
  const guardGeo = new THREE.TorusGeometry(0.04, 0.01, 4, 10, Math.PI);
  // each part: [geometry, material, x, y, z, rotation z]
  const pistol = (slideMat, frame = black, long = 1) => [
    [box(0.34 * long, 0.075, 0.08), slideMat, 0.02 * long, 0.11, 0],
    [box(0.28 * long, 0.04, 0.07), frame, 0.0, 0.065, 0],
    [box(0.085, 0.17, 0.07), frame, -0.1, 0.0, 0, -0.28],
    [guardGeo, frame, -0.01, 0.05, 0, Math.PI],
  ];
  const VARIANTS = [
    pistol(black), // Glock-style, all black
    [...pistol(black), [box(0.06, 0.17, 0.05), black, 0.24, -0.02, 0, 0.1]], // with a spare magazine
    pistol(silver), // silver slide on a black frame
    pistol(black, dark, 0.8), // compact
    [...pistol(black, black, 1.15), [cyl(0.03, 0.14), black, 0.27, 0.11, 0]], // long slide with a compensator
    [...pistol(black), [box(0.09, 0.05, 0.06), dark, 0.08, 0.04, 0]], // with an under-rail light
    [
      // revolver
      [cyl(0.022, 0.22), black, 0.12, 0.12, 0],
      [cyl(0.05, 0.08, 10), dark, -0.02, 0.1, 0],
      [box(0.08, 0.16, 0.06), dark, -0.11, 0.0, 0, -0.35],
      [guardGeo, black, -0.02, 0.05, 0, Math.PI],
    ],
    [
      // AR-style rifle, laid on the diagonal so it fits the pickup ring
      [box(0.42, 0.07, 0.06), black, 0, 0.12, 0],
      [cyl(0.018, 0.26), black, 0.33, 0.12, 0],
      [box(0.2, 0.06, 0.055), dark, -0.3, 0.1, 0, -0.1],
      [box(0.05, 0.16, 0.05), black, 0.06, 0.02, 0, 0.15],
      [box(0.05, 0.12, 0.05), dark, -0.1, 0.03, 0, -0.3],
      [cyl(0.03, 0.16), black, 0.02, 0.2, 0],
    ],
  ];
  // slot g0..g11 → model: black pistols dominate
  const PICK = [0, 1, 2, 0, 3, 4, 0, 5, 6, 1, 7, 3];
  const hitGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const hitMat = new THREE.MeshBasicMaterial();
  const ringGeo = new THREE.RingGeometry(0.14, 0.2, 24);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
  const pillarGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.8, 16, 1, true);
  const pillarMat = new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });

  const guns = [];
  // drop a gun into every slot that has not been collected yet, each at a fresh random spot
  function spawn() {
    const slots = Array.from({ length: count }, (_, i) => `g${i}`).filter((id) => !found.has(id));
    const picks = placeSpots(slots.length);
    slots.forEach((id, i) => {
      const p = picks[i];
      if (!p) return;
      // GTA-style pickup: the gun floats upright, spinning and bobbing over a glowing ring and a faint light pillar
      const g = new THREE.Group();
      const spin = new THREE.Group();
      g.add(spin);
      const variant = VARIANTS[PICK[Number(id.slice(1)) % PICK.length]];
      for (const [geo, mat, x, y, z, rz = 0] of variant) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.rotation.z = rz;
        spin.add(mesh);
      }
      const ring = new THREE.Mesh(ringGeo, glowMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      g.add(ring);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.y = 0.35;
      g.add(pillar);
      g.position.set(p.x, p.y, p.z);
      g.scale.setScalar(1.7);
      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.y = 0.2;
      hit.visible = false;
      g.add(hit);
      scene.add(g);
      spin.userData.ph = rng() * Math.PI * 2;
      spin.rotation.y = spin.userData.ph;
      guns.push({ id, g, hit, spin, ring });
    });
  }
  spawn();

  const toasts = [];
  function toast(at, text) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<span class="gun-toast">${text}</span>`;
    const o = new CSS2DObject(wrap);
    o.position.copy(at).add(new THREE.Vector3(0, 0.8, 0));
    scene.add(o);
    toasts.push({ o, span: wrap.firstChild, age: 0 });
  }

  function renderHud() {
    if (!hud) return;
    hud.hidden = found.size === 0;
    const left = count - found.size;
    hud.querySelector("[data-gun-count]").textContent = `${found.size} / ${count}`;
    hud.querySelector("[data-gun-left]").textContent = left ? `還有 ${left} 把散落在台中各地` : "恭喜全部收集完成！你成為一位合格台中人";
    hud.querySelector("[data-gun-bar]").style.width = `${(found.size / count) * 100}%`;
    hud.classList.toggle("done", !left);
  }
  hud?.querySelector("[data-gun-reset]")?.addEventListener("click", () => {
    // start over without reloading the page: clear the map and scatter all 12 again
    for (const gun of guns) scene.remove(gun.g);
    guns.length = 0;
    found.clear();
    save();
    onReset?.();
    spawn();
    renderHud();
  });
  renderHud();

  // the gun under a ray, if any; collecting removes it from the map
  function tryCollect(ray) {
    const hitObj = ray.intersectObjects(
      guns.map((g) => g.hit),
      false,
    )[0];
    if (!hitObj) return false;
    const i = guns.findIndex((g) => g.hit === hitObj.object);
    const gun = guns[i];
    guns.splice(i, 1);
    scene.remove(gun.g);
    found.add(gun.id);
    save();
    const left = count - found.size;
    onCollect?.(left);
    toast(gun.g.position, left ? `恭喜你撿到一把槍！還剩 ${left} 把` : "恭喜全部收集完成！你成為一位合格台中人");
    renderHud();
    return true;
  }
  const isGun = (ray) => ray.intersectObjects(guns.map((g) => g.hit), false).length > 0;

  function update(dt, t = 0) {
    for (const gun of guns) {
      gun.spin.rotation.y = gun.spin.userData.ph + t * 1.6;
      gun.spin.position.y = 0.22 + Math.sin(t * 2.4 + gun.spin.userData.ph) * 0.05;
      const k = 1 + Math.sin(t * 3 + gun.spin.userData.ph) * 0.12;
      gun.ring.scale.set(k, k, 1);
    }
    for (let i = toasts.length - 1; i >= 0; i--) {
      const q = toasts[i];
      q.age += Math.max(dt, 1 / 60);
      const k = q.age / 1.8;
      q.span.style.transform = `translateY(${-k * 40}px) scale(${k < 0.12 ? 0.7 + (k / 0.12) * 0.3 : 1})`;
      q.span.style.opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      if (k >= 1) {
        scene.remove(q.o);
        q.o.element.remove();
        toasts.splice(i, 1);
      }
    }
  }
  return { tryCollect, isGun, update, positions: () => guns.map((g) => g.g.position) };
}
