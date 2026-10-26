// Chibi walkers that carry items along the curse links, plus decorative ghosts and crows.
// Flow walkers take their role from flows[].walker and their badge from flows[].carry.
// Ambient ghosts and crows belong to no flow and open no card.
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { TOP } from "./world.js?v=1";

export function flowCurve(THREE, a, b, index) {
  const mx = (a.x + b.x) / 2,
    mz = (a.z + b.z) / 2;
  const dx = b.x - a.x,
    dz = b.z - a.z,
    len = Math.hypot(dx, dz) || 1;
  const bend = (index % 2 ? 1 : -1) * (0.9 + (index % 3) * 0.35);
  const ctrl = new THREE.Vector3(mx - (dz / len) * bend, 0, mz + (dx / len) * bend);
  return new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, 0, a.z), ctrl, new THREE.Vector3(b.x, 0, b.z));
}

export function createPeople(THREE, { scene, flows, centers, heightAt, roles, rng, CSS2DObject, iconFor, carryLabel, onArrive }) {
  const group = new THREE.Group();
  group.name = "people";
  scene.add(group);
  const bodyGeo = new RoundedBoxGeometry(0.2, 0.22, 0.14, 2, 0.05);
  const headGeo = new THREE.SphereGeometry(0.1, 12, 10);
  const legGeo = new THREE.BoxGeometry(0.05, 0.12, 0.05).translate(0, -0.06, 0);
  const hatGeo = new THREE.CylinderGeometry(0.075, 0.105, 0.07, 10);
  const eyeGeo = new THREE.SphereGeometry(0.014, 6, 4);
  const skin = new THREE.MeshStandardMaterial({ color: 0xe6ddd0, roughness: 0.7 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x120c0c });
  const roleMats = new Map();
  const matFor = (hex) => {
    if (!roleMats.has(hex)) roleMats.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.75 }));
    return roleMats.get(hex);
  };

  const lightGeo = new THREE.SphereGeometry(0.07, 10, 8);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd88f, toneMapped: false });
  function makeFigure(role) {
    // 事件關聯 use small travelling lights instead of chibi walkers
    if (role === "light") {
      const g = new THREE.Group();
      const m = new THREE.Mesh(lightGeo, lightMat);
      m.position.y = 0.35;
      g.add(m);
      g.userData.light = true;
      return g;
    }
    const r = roles[role] || { color: "#777", hat: "#333" };
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, matFor(r.color));
    body.position.y = 0.23;
    const head = new THREE.Mesh(headGeo, skin);
    head.position.y = 0.43;
    const hat = new THREE.Mesh(hatGeo, matFor(r.hat));
    hat.position.y = 0.51;
    const legs = [-0.05, 0.05].map((x) => {
      const l = new THREE.Mesh(legGeo, matFor(r.hat));
      l.position.set(x, 0.13, 0);
      return l;
    });
    const eyes = [-0.035, 0.035].map((x) => {
      const e = new THREE.Mesh(eyeGeo, dark);
      e.position.set(x, 0.44, 0.092);
      return e;
    });
    for (const m of [body, head, hat, ...legs]) m.castShadow = true;
    g.add(body, head, hat, ...legs, ...eyes);
    g.userData.legs = legs;
    return g;
  }

  const walkers = [];
  flows.forEach((f, idx) => {
    const a = centers.get(f.from),
      b = centers.get(f.to);
    const curve = flowCurve(THREE, a, b, idx);
    const length = curve.getLength();
    for (let k = 0; k < 2; k++) {
      const fig = makeFigure(f.walker);
      fig.scale.setScalar(1.05);
      group.add(fig);
      if (!f.carry) {
        walkers.push({ flow: f, curve, length, fig, badge: null, s: k ? 1.15 : 0.1 + rng() * 0.2, y: 0, speed: 0.38 + rng() * 0.12 });
        continue;
      }
      const el = document.createElement("div");
      el.className = "badge";
      el.innerHTML = iconFor(f.carry);
      el.title = carryLabel(f.carry);
      const badge = new CSS2DObject(el);
      badge.position.set(0, 0.85, 0);
      fig.add(badge);
      walkers.push({ flow: f, curve, length, fig, badge, el, s: k ? 1.15 : 0.1 + rng() * 0.2, y: 0, speed: 0.38 + rng() * 0.12 });
    }
  });

  // ---- ambient ghosts ----
  const prof = [
    [0.0, 0.5], [0.1, 0.49], [0.17, 0.44], [0.21, 0.34], [0.22, 0.18], [0.24, 0.04], [0.29, -0.06], [0.27, -0.08],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const ghostGeo = new THREE.LatheGeometry(prof, 18);
  const ghosts = [];
  const zoneList = [...centers.values()];
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xf1f3f8, emissive: 0xbfd0ff, emissiveIntensity: 0.4, transparent: true, opacity: 0, roughness: 0.4, depthWrite: false });
    const g = new THREE.Group();
    const body = new THREE.Mesh(ghostGeo, mat);
    g.add(body);
    for (const x of [-0.06, 0.06]) {
      const e = new THREE.Mesh(eyeGeo, dark);
      e.scale.setScalar(1.6);
      e.position.set(x, 0.33, 0.2);
      g.add(e);
    }
    const home = zoneList[Math.floor(rng() * zoneList.length)];
    g.userData = { home, r: 0.5 + rng() * 1.1, sp: (0.15 + rng() * 0.25) * (rng() < 0.5 ? -1 : 1), ph: rng() * 6.3, mat, eyes: g.children.slice(1) };
    g.scale.setScalar(0.75 + rng() * 0.35);
    group.add(g);
    ghosts.push(g);
  }

  // ---- crows circling over the plateaus ----
  const crowMat = new THREE.MeshStandardMaterial({ color: 0x141214, roughness: 0.9 });
  const crowBody = new THREE.BoxGeometry(0.06, 0.05, 0.16);
  const wingGeo = new THREE.BoxGeometry(0.18, 0.01, 0.08).translate(0.09, 0, 0);
  const crows = [];
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    c.add(new THREE.Mesh(crowBody, crowMat));
    const wl = new THREE.Mesh(wingGeo, crowMat),
      wr = new THREE.Mesh(wingGeo, crowMat);
    wr.rotation.y = Math.PI;
    c.add(wl, wr);
    const home = zoneList[Math.floor(rng() * zoneList.length)];
    c.userData = { home, r: 1.2 + rng() * 2, h: 2.6 + rng() * 1.6, sp: 0.4 + rng() * 0.3, ph: rng() * 6.3, wl, wr };
    group.add(c);
    crows.push(c);
  }

  // ---- pumpkin-headed wanderers with baseball bats ----
  const pumpGeo = new THREE.SphereGeometry(0.13, 14, 10).scale(1, 0.82, 1);
  const pumpMat = new THREE.MeshStandardMaterial({ color: 0xe8741c, roughness: 0.6 });
  const stemGeo = new THREE.CylinderGeometry(0.014, 0.02, 0.06, 6);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d5a1e, roughness: 0.8 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffc23a, toneMapped: false });
  const triGeo = new THREE.ConeGeometry(0.028, 0.035, 3).rotateX(Math.PI / 2);
  const mouthGeo = new THREE.BoxGeometry(0.1, 0.022, 0.01);
  // aluminium bat: brushed silver barrel, black grip tape, knob at the handle end
  const batGeo = new THREE.CylinderGeometry(0.022, 0.011, 0.28, 12).translate(0, 0.22, 0);
  const gripGeo = new THREE.CylinderGeometry(0.0125, 0.0125, 0.09, 8).translate(0, 0.045, 0);
  const knobGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.012, 10);
  const batMat = new THREE.MeshStandardMaterial({ color: 0xd4d8de, metalness: 0.85, roughness: 0.28, emissive: 0x2a2d33 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const armGeo = new THREE.BoxGeometry(0.045, 0.13, 0.045).translate(0, -0.06, 0);
  const cloakMats = [0x2b2233, 0x3a2a1c, 0x1f2a2a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  const pumpkins = [];
  const nearest = (from) => zoneList.filter((z) => z !== from).sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
  const pick = (home) => {
    const a = rng() * 6.3,
      r = 0.3 + rng() * 1.2;
    return new THREE.Vector3(home.x + Math.cos(a) * r, 0, home.z + Math.sin(a) * r);
  };
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const cloak = cloakMats[i % cloakMats.length];
    const body = new THREE.Mesh(bodyGeo, cloak);
    body.position.y = 0.23;
    const head = new THREE.Group();
    head.position.y = 0.47;
    const pump = new THREE.Mesh(pumpGeo, pumpMat);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.12;
    head.add(pump, stem);
    for (const x of [-0.045, 0.045]) {
      const e = new THREE.Mesh(triGeo, glowMat);
      e.position.set(x, 0.025, 0.118);
      head.add(e);
    }
    const mouth = new THREE.Mesh(mouthGeo, glowMat);
    mouth.position.set(0, -0.04, 0.118);
    head.add(mouth);
    const legs = [-0.05, 0.05].map((x) => {
      const l = new THREE.Mesh(legGeo, cloak);
      l.position.set(x, 0.13, 0);
      return l;
    });
    const arm = new THREE.Group();
    arm.position.set(0.13, 0.32, 0);
    arm.add(new THREE.Mesh(armGeo, cloak));
    const bat = new THREE.Mesh(batGeo, batMat);
    bat.position.y = -0.11;
    bat.rotation.x = -0.5;
    bat.add(new THREE.Mesh(gripGeo, gripMat), new THREE.Mesh(knobGeo, gripMat));
    arm.add(bat);
    for (const m of [body, pump, ...legs, bat]) m.castShadow = true;
    g.add(body, head, ...legs, arm);
    const home = zoneList[Math.floor(rng() * zoneList.length)];
    const pos = pick(home);
    g.position.copy(pos);
    g.scale.setScalar(2.4); // about 1.45 tall, still a head shorter than Lumama (about 2.25)
    g.userData = { home, to: pick(home), legs, arm, head, wait: rng() * 2, hops: 0, sp: 0.3 + rng() * 0.15, ph: rng() * 6.3, y: heightAt(pos.x, pos.z) };
    group.add(g);
    pumpkins.push(g);
  }

  let filter = null,
    badgesOn = true;
  const p = new THREE.Vector3(),
    q = new THREE.Vector3();

  function update(t, dt, env, frozen) {
    for (const w of walkers) {
      const visible = !filter || filter.has(w.flow.id);
      w.fig.visible = visible;
      if (!frozen) {
        const before = w.s;
        w.s = (w.s + (dt * w.speed) / w.length) % 2;
        if (before < 1 && w.s >= 1) onArrive?.(w.flow, "to");
        else if (w.s < before) onArrive?.(w.flow, "from");
      }
      const going = w.s < 1;
      // ease the turnaround so walkers pause briefly inside each plateau
      const raw = going ? w.s : 2 - w.s;
      const u = Math.min(1, Math.max(0, (raw - 0.04) / 0.92));
      w.curve.getPoint(u, p);
      w.curve.getPoint(Math.min(1, Math.max(0, u + (going ? 0.01 : -0.01))), q);
      const ground = heightAt(p.x, p.z);
      w.y += (ground - w.y) * Math.min(1, dt * 12 || 1);
      w.fig.position.set(p.x, w.y, p.z);
      if (u > 0 && u < 1) w.fig.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
      const moving = !frozen && u > 0 && u < 1;
      if (w.fig.userData.light) {
        w.fig.children[0].position.y = 0.35 + Math.sin(t * 3 + w.length) * 0.05;
        continue;
      }
      const sw = moving ? Math.sin(t * 11 + w.length) * 0.6 : 0;
      w.fig.userData.legs[0].rotation.x = sw;
      w.fig.userData.legs[1].rotation.x = -sw;
      w.fig.children[0].position.y = 0.23 + (moving ? Math.abs(Math.sin(t * 11 + w.length)) * 0.02 : 0);
      const showBadge = badgesOn && visible && going;
      w.badge.visible = showBadge; // CSS2DRenderer only checks the label's own flag, not its parent's
    }
    const n = env.night;
    for (const g of ghosts) {
      const u = g.userData;
      const a = t * u.sp + u.ph; // t stops advancing while paused, so ghosts hold their place
      g.position.set(u.home.x + Math.cos(a) * u.r, TOP + 0.35 + Math.sin(t * 1.3 + u.ph) * 0.12, u.home.z + Math.sin(a) * u.r);
      g.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(u.sp), Math.cos(a) * Math.sign(u.sp));
      const op = Math.max(0, n - 0.15) * 0.85;
      u.mat.opacity = op;
      g.visible = op > 0.04;
    }
    for (const g of pumpkins) {
      const u = g.userData;
      let moving = false;
      if (dt > 0) {
        if (u.wait > 0) u.wait -= dt;
        else {
          const dx = u.to.x - g.position.x,
            dz = u.to.z - g.position.z,
            d = Math.hypot(dx, dz);
          if (d < 0.05) {
            // linger, then wander on; every few stops cross over to a neighbouring plateau
            u.wait = 0.8 + rng() * 2.5;
            if (++u.hops > 3 && rng() < 0.5) {
              const near = nearest(u.home);
              u.home = near[Math.floor(rng() * Math.min(3, near.length))];
              u.hops = 0;
            }
            u.to = pick(u.home);
          } else {
            const step = Math.min(d, dt * u.sp);
            g.position.x += (dx / d) * step;
            g.position.z += (dz / d) * step;
            const want = Math.atan2(dx, dz);
            let turn = want - g.rotation.y;
            turn = Math.atan2(Math.sin(turn), Math.cos(turn));
            g.rotation.y += turn * Math.min(1, dt * 6);
            moving = true;
          }
        }
      }
      const ground = heightAt(g.position.x, g.position.z);
      u.y += (ground - u.y) * Math.min(1, dt * 10 || 1);
      g.position.y = u.y;
      const sw = moving ? Math.sin(t * 10 + u.ph) * 0.6 : 0;
      u.legs[0].rotation.x = sw;
      u.legs[1].rotation.x = -sw;
      // the bat swings with the stride, and gets a lazy practice swing while standing
      u.arm.rotation.x = moving ? -sw * 0.5 : -0.4 + Math.max(0, Math.sin(t * 2.4 + u.ph)) ** 6 * -1.6;
      u.head.rotation.z = Math.sin(t * 2 + u.ph) * 0.12;
      g.children[0].position.y = 0.23 + (moving ? Math.abs(Math.sin(t * 10 + u.ph)) * 0.02 : 0);
    }
    for (const c of crows) {
      const u = c.userData;
      const a = t * u.sp + u.ph;
      c.position.set(u.home.x + Math.cos(a) * u.r, u.h + Math.sin(a * 2) * 0.2, u.home.z + Math.sin(a) * u.r);
      c.rotation.y = -a;
      const flap = Math.sin(t * 9 + u.ph) * 0.6;
      u.wl.rotation.z = flap;
      u.wr.rotation.z = -flap;
    }
  }

  return {
    group,
    walkers,
    update,
    setFilter(set) {
      filter = set;
    },
    setBadges(on) {
      badgesOn = on;
    },
  };
}
