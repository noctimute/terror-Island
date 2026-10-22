// Hex plateaus laid out in a rough outline of Taichung City, sitting on land (no basin lake).
// Pointy-top hexes: a vertex points toward ±z (north is -z, west is -x).
// Cells use odd-row offset coordinates [col, row]; odd rows are shifted half a cell east.

export const R = 2.0; // hex circumradius of each plateau
export const S = 2.2; // layout circumradius: the gap between plateaus becomes the road network
export const TOP = 0.32; // plateau height above the road
export const SQ3 = Math.sqrt(3);

export function cellPosition([col, row]) {
  return { x: SQ3 * S * (col + 0.5 * (row & 1)), z: 1.5 * S * row };
}

// Pointy-top hex vertex i (0 = north tip), clockwise seen from above.
export function hexVertex(i, radius = R) {
  const a = (Math.PI / 3) * i;
  return { x: radius * Math.sin(a), z: -radius * Math.cos(a) };
}

export function insideHex(px, pz, radius = R) {
  const x = Math.abs(px),
    z = Math.abs(pz);
  return x <= (SQ3 / 2) * radius && z <= radius - x / SQ3;
}

// Centre every cell around the origin so the camera, terrain and lighting can stay symmetric.
// `wilds` are decorative forest plateaus (deep Heping mountains) that only complete the city outline.
export function layoutZones(zones, wilds = []) {
  const raw = [...zones, ...wilds].map((z) => cellPosition(z.cell));
  const minX = Math.min(...raw.map((p) => p.x)),
    maxX = Math.max(...raw.map((p) => p.x)),
    minZ = Math.min(...raw.map((p) => p.z)),
    maxZ = Math.max(...raw.map((p) => p.z));
  const cx = (minX + maxX) / 2,
    cz = (minZ + maxZ) / 2;
  const centers = new Map();
  zones.forEach((z, i) => centers.set(z.id, { x: raw[i].x - cx, z: raw[i].z - cz }));
  const wildCenters = wilds.map((w, i) => ({ ...w, x: raw[zones.length + i].x - cx, z: raw[zones.length + i].z - cz }));
  return {
    centers,
    wildCenters,
    bounds: { minX: minX - cx - R, maxX: maxX - cx + R, minZ: minZ - cz - R, maxZ: maxZ - cz + R },
  };
}

export function createHeightAt(centers) {
  const list = [...centers.values()];
  return (x, z) => {
    for (const c of list) if (insideHex(x - c.x, z - c.z, R - 0.02)) return TOP;
    return 0;
  };
}

export function zoneAt(centers, x, z) {
  for (const [id, c] of centers) if (insideHex(x - c.x, z - c.z, R)) return id;
  return null;
}

export const WILD_TOP = TOP * 2.4;

export function buildCity(THREE, zones, centers, wildCenters = []) {
  const group = new THREE.Group();
  group.name = "city";
  const plateaus = new Map(),
    picks = [],
    outlines = new Map(),
    glows = new Map();

  // Road network: one dark hex per cell at layout size, so the gaps between plateaus read as streets.
  const roadGeo = new THREE.CylinderGeometry(S * 1.02, S * 1.06, 0.06, 6);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3536, roughness: 0.95 });
  const cells = [...zones.map((z) => centers.get(z.id)), ...wildCenters];
  const roads = new THREE.InstancedMesh(roadGeo, roadMat, cells.length);
  roads.receiveShadow = true;
  const m = new THREE.Matrix4();
  cells.forEach((c, i) => roads.setMatrixAt(i, m.makeTranslation(c.x, 0.0, c.z)));
  group.add(roads);

  // Lane markings: short pale dashes along every shared edge between neighbouring plateaus.
  const dashGeo = new THREE.BoxGeometry(0.05, 0.012, 0.32);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xbfb6a0, roughness: 1 });
  const dashes = [];
  const lampSpots = new Map();
  for (const c of cells) {
    for (let i = 0; i < 6; i++) {
      const a = hexVertex(i, S),
        b = hexVertex((i + 1) % 6, S);
      const ax = c.x + a.x,
        az = c.z + a.z,
        bx = c.x + b.x,
        bz = c.z + b.z;
      // lamps sit on layout vertices (street corners); dedupe shared corners
      const key = `${Math.round(ax * 10)},${Math.round(az * 10)}`;
      if (!lampSpots.has(key)) lampSpots.set(key, { x: ax, z: az });
      const dx = bx - ax,
        dz = bz - az;
      const ang = Math.atan2(dx, dz);
      for (let t = 0.2; t < 0.85; t += 0.3) dashes.push({ x: ax + dx * t, z: az + dz * t, ang });
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const o = new THREE.Object3D();
  dashes.forEach((d, i) => {
    o.position.set(d.x, 0.035, d.z);
    o.rotation.set(0, d.ang, 0);
    o.updateMatrix();
    dashMesh.setMatrixAt(i, o.matrix);
  });
  group.add(dashMesh);

  // Plateaus: a slightly flared hex prism per zone, side = earth, top = zone ground colour.
  const plateauGeo = new THREE.CylinderGeometry(R, R + 0.07, TOP, 6, 1);
  const lipGeo = new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.05, 6, 1, true);
  const pickGeo = new THREE.CylinderGeometry(R, R, 2.6, 6);
  const outlinePts = [];
  for (let i = 0; i <= 6; i++) {
    const v = hexVertex(i % 6, R + 0.06);
    outlinePts.push(new THREE.Vector3(v.x, 0, v.z));
  }
  const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePts);
  const glowGeo = new THREE.RingGeometry(R + 0.12, R + 0.42, 6, 1);
  glowGeo.rotateX(-Math.PI / 2);
  glowGeo.rotateY(Math.PI / 2); // ring vertex from +x to -z, matching the pointy-top plateaus

  for (const z of zones) {
    const c = centers.get(z.id);
    const top = new THREE.MeshStandardMaterial({ color: new THREE.Color(z.ground), roughness: 0.92 });
    const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(z.side), roughness: 1 });
    const mesh = new THREE.Mesh(plateauGeo, [side, top, side]);
    mesh.position.set(c.x, TOP / 2, c.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.zone = z.id;
    group.add(mesh);
    const lip = new THREE.Mesh(lipGeo, side);
    lip.position.set(c.x, TOP - 0.02, c.z);
    group.add(lip);
    plateaus.set(z.id, { mesh, top, side, base: { top: top.color.clone(), side: side.color.clone() } });

    const pick = new THREE.Mesh(pickGeo, new THREE.MeshBasicMaterial());
    pick.visible = false;
    pick.position.set(c.x, 1.3, c.z);
    pick.userData.zone = z.id;
    picks.push(pick);
    group.add(pick);

    const line = new THREE.Line(outlineGeo, new THREE.LineBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0, depthTest: false }));
    line.position.set(c.x, TOP + 0.03, c.z);
    line.renderOrder = 5;
    group.add(line);
    outlines.set(z.id, line);

    // ring that glows on the road around a zone when the night cycle "wakes" it
    const glow = new THREE.Mesh(
      glowGeo,
      new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    glow.position.set(c.x, 0.05, c.z);
    glow.renderOrder = 2;
    group.add(glow);
    glows.set(z.id, glow);
  }

  // Wild plateaus: taller, forested, not interactive.
  const wildGeo = new THREE.CylinderGeometry(R, R + 0.12, WILD_TOP, 6, 1);
  const wildTop = new THREE.MeshStandardMaterial({ color: 0x33412e, roughness: 1 });
  const wildSide = new THREE.MeshStandardMaterial({ color: 0x4a4639, roughness: 1 });
  const wilds = new THREE.InstancedMesh(wildGeo, [wildSide, wildTop, wildSide], Math.max(1, wildCenters.length));
  wilds.count = wildCenters.length;
  wildCenters.forEach((c, i) => wilds.setMatrixAt(i, m.makeTranslation(c.x, WILD_TOP / 2, c.z)));
  wilds.castShadow = wilds.receiveShadow = true;
  group.add(wilds);

  // Street lamps on the corners of the road network.
  const lamps = [...lampSpots.values()];
  const postGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.7, 6);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2627, roughness: 0.6, metalness: 0.4 });
  const bulbGeo = new THREE.SphereGeometry(0.075, 10, 8);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false });
  const posts = new THREE.InstancedMesh(postGeo, postMat, lamps.length);
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lamps.length);
  posts.castShadow = true;
  lamps.forEach((p, i) => {
    posts.setMatrixAt(i, m.makeTranslation(p.x, 0.35, p.z));
    bulbs.setMatrixAt(i, m.makeTranslation(p.x, 0.72, p.z));
  });
  group.add(posts, bulbs);

  return { group, plateaus, picks, outlines, glows, lamps: { posts, bulbs, mat: bulbMat, spots: lamps } };
}
