// 谷關空氣: the empty souvenir bottle of "mountain air" handed out at the 2018 inauguration.
// Lumama drops one on the map; this builds it (about 2.4 units tall, base at y = 0).
export function makeAirBottle(THREE) {
  // the printed label, drawn once onto a transparent canvas
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#1f2f6e";
  g.textAlign = "center";
  g.font = "900 64px 'Noto Serif TC', serif";
  g.fillText("谷關空氣", 256, 150);
  g.font = "600 40px Arial, sans-serif";
  g.fillText("Air of Guguan", 256, 205);
  g.font = "500 24px 'Noto Sans TC', sans-serif";
  g.fillText("市長就職典禮紀念", 256, 262);
  g.fillText("臺中市第三屆", 256, 298);
  g.fillRect(150, 318, 212, 2);
  const label = new THREE.CanvasTexture(c);
  label.colorSpace = THREE.SRGBColorSpace;
  // plain see-through glass with a faint glow, so it can be spotted at night (no transmission pass on the big map)
  const glass = new THREE.MeshStandardMaterial({ color: 0xf2fbff, emissive: 0x9fd4ff, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const print = new THREE.MeshBasicMaterial({ map: label, transparent: true, depthWrite: false });
  const cap = new THREE.MeshStandardMaterial({ color: 0xe4e7ea, metalness: 0.35, roughness: 0.32 }); // brushed aluminium; no env map, so low metalness
  const b = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 2.1, 32, 1, true), glass);
  tube.position.y = 1.05;
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.36, 32).rotateX(-Math.PI / 2), glass);
  base.position.y = 0.01;
  // the label wraps the front half of the tube, just outside the glass
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.362, 0.362, 0.72, 32, 1, true, -Math.PI / 2, Math.PI), print);
  wrap.position.y = 1.32;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.3, 32), cap);
  lid.position.y = 2.22;
  b.add(tube, base, wrap, lid);
  for (let k = 0; k < 5; k++) {
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.386, 0.01, 6, 32).rotateX(Math.PI / 2), cap);
    ridge.position.y = 2.11 + k * 0.05;
    b.add(ridge);
  }
  b.userData.dispose = () => {
    b.traverse((o) => o.geometry?.dispose());
    [glass, print, cap, label].forEach((x) => x.dispose());
  };
  return b;
}
