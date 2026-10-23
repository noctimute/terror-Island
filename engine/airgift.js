// 谷關空氣: the empty souvenir bottles from the 2018 inauguration, drawn in 3D for Lumama's gift card.
// A small renderer of its own runs only while the card is open.
export function mountAirGift(THREE, el) {
  const w = el.clientWidth || 360,
    h = el.clientHeight || Math.round(w * 0.65);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  camera.position.set(0, 1.3, 6.3);
  camera.lookAt(0, 1.15, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa4b0, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe6ff, 1.2);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

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

  const glass = new THREE.MeshPhysicalMaterial({ color: 0xf2fbff, roughness: 0.04, metalness: 0, transmission: 0.92, thickness: 0.15, ior: 1.45, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const print = new THREE.MeshBasicMaterial({ map: label, transparent: true, depthWrite: false });
  const cap = new THREE.MeshStandardMaterial({ color: 0xe4e7ea, metalness: 0.35, roughness: 0.32 }); // brushed aluminium; no env map, so keep the metalness low or it reads black
  const group = new THREE.Group();
  const bottles = [];
  [-1.05, 0, 1.05].forEach((x, i) => {
    const b = new THREE.Group();
    b.position.set(x, 0, i === 1 ? 0.25 : 0);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 2.1, 40, 1, true), glass);
    tube.position.y = 1.05;
    const base = new THREE.Mesh(new THREE.CircleGeometry(0.36, 40).rotateX(-Math.PI / 2), glass);
    base.position.y = 0.01;
    // the label wraps the front half of the tube, just outside the glass
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.362, 0.362, 0.72, 40, 1, true, -Math.PI / 2, Math.PI), print);
    wrap.position.y = 1.32;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.3, 40), cap);
    lid.position.y = 2.22;
    for (let k = 0; k < 6; k++) {
      const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.386, 0.008, 6, 40).rotateX(Math.PI / 2), cap);
      ridge.position.y = 2.1 + k * 0.045;
      b.add(ridge);
    }
    b.add(tube, base, wrap, lid);
    b.rotation.y = (i - 1) * -0.25;
    group.add(b);
    bottles.push(b);
  });
  // a soft shadow on the shelf
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 }));
  shadow.scale.set(1, 0.35, 1);
  shadow.position.y = 0.002;
  group.add(shadow);
  scene.add(group);

  let raf = 0,
    t0 = performance.now();
  const tick = (now) => {
    const t = (now - t0) / 1000;
    group.rotation.y = Math.sin(t * 0.5) * 0.35;
    bottles.forEach((b, i) => (b.position.y = Math.sin(t * 1.6 + i) * 0.03));
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose?.();
    });
    label.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
