// Easter egg「台中都有槍」: small pistols lie on the roads around the map. Clicking one collects it,
// pops a toast, and shows a little collection menu with how many are left. Progress is kept per viewer.
import { S, hexVertex } from "./world.js?v=1";

const KEY = "taichung-guns-v1";

export function createGuns(THREE, { scene, centers, CSS2DObject, rng, count = 12, outside = 4, groundAt, blocked = centers, hud }) {
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
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }

  // a few lie in the open ground around the city instead of on a road
  const picks = spots.slice(0, count - outside).map((p) => ({ ...p, y: 0.02 }));
  for (let tries = 0; picks.length < count && tries < 400; tries++) {
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

  let found = new Set();
  try {
    found = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {}
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...found]));
    } catch {}
  };

  const metal = new THREE.MeshStandardMaterial({ color: 0x55596a, roughness: 0.35, metalness: 0.5 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.7 });
  const slide = new THREE.BoxGeometry(0.34, 0.07, 0.08);
  const barrel = new THREE.CylinderGeometry(0.022, 0.022, 0.1, 8).rotateZ(Math.PI / 2);
  const handle = new THREE.BoxGeometry(0.08, 0.16, 0.07);
  const guard = new THREE.TorusGeometry(0.04, 0.01, 4, 10, Math.PI);
  const hitGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const hitMat = new THREE.MeshBasicMaterial();
  const ringGeo = new THREE.RingGeometry(0.14, 0.2, 24);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
  const pillarGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.8, 16, 1, true);
  const pillarMat = new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });

  const guns = [];
  picks.forEach((p, i) => {
    const id = `g${i}`;
    if (found.has(id)) return;
    // GTA-style pickup: the gun floats upright, spinning and bobbing over a glowing ring and a faint light pillar
    const g = new THREE.Group();
    const spin = new THREE.Group();
    g.add(spin);
    const m = (geo, mat, x, y, z, rz = 0) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.z = rz;
      spin.add(mesh);
    };
    m(slide, metal, 0, 0.1, 0);
    m(barrel, metal, 0.2, 0.11, 0);
    m(handle, grip, -0.11, 0.01, 0, -0.25);
    m(guard, metal, -0.02, 0.05, 0, Math.PI);
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
    hit.userData.gun = id;
    g.add(hit);
    scene.add(g);
    spin.userData.ph = rng() * Math.PI * 2;
    spin.rotation.y = spin.userData.ph;
    guns.push({ id, g, hit, spin, ring });
  });

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
    hud.querySelector("[data-gun-left]").textContent = left ? `還有 ${left} 把散落在台中各地` : "全部收集完成！台中真的都有槍";
    hud.querySelector("[data-gun-bar]").style.width = `${(found.size / count) * 100}%`;
    hud.classList.toggle("done", !left);
  }
  hud?.querySelector("[data-gun-reset]")?.addEventListener("click", () => {
    found.clear();
    save();
    location.reload();
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
    toast(gun.g.position, left ? `成功收集！還剩 ${left} 把` : "全部收集完成！");
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
