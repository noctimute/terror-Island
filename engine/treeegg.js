// Easter egg on the pines: click one and it shivers while a line pops up over it.

const TEXT = "喔！似乎長的有點高<br>可以請蔣寶來砍樹了";

export function createTreeEgg(THREE, { scene, CSS2DObject, pines, onClick }) {
  const pops = [];
  let shake = null;
  const m = new THREE.Matrix4(),
    base = new THREE.Matrix4(),
    tilt = new THREE.Matrix4(),
    p = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    sc = new THREE.Vector3();
  const hit = (ray) => (pines ? ray.intersectObject(pines, false)[0] : null);

  function tryClick(ray) {
    const h = hit(ray);
    if (!h || h.instanceId == null) return false;
    const id = h.instanceId;
    pines.getMatrixAt(id, m);
    m.decompose(p, q, sc);
    // one bubble per tree at a time
    if (!pops.some((x) => x.id === id)) {
      const wrap = document.createElement("div");
      wrap.innerHTML = `<span class="tree-pop">${TEXT}</span>`;
      const o = new CSS2DObject(wrap);
      o.position.set(p.x, p.y + 0.9 * sc.y, p.z);
      scene.add(o);
      pops.push({ id, o, span: wrap.firstChild, age: 0 });
    }
    if (shake) pines.setMatrixAt(shake.id, shake.base);
    shake = { id, base: m.clone(), age: 0 };
    onClick?.();
    return true;
  }

  function update(dt) {
    const d = Math.max(dt, 1 / 60);
    if (shake) {
      shake.age += d;
      const k = shake.age / 0.7;
      if (k >= 1) {
        pines.setMatrixAt(shake.id, shake.base);
        shake = null;
      } else {
        base.copy(shake.base);
        tilt.makeRotationZ(Math.sin(shake.age * 40) * 0.12 * (1 - k));
        pines.setMatrixAt(shake.id, base.multiply(tilt));
      }
      pines.instanceMatrix.needsUpdate = true;
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      const x = pops[i];
      x.age += d;
      const k = x.age / 3;
      x.span.style.transform = `translateY(${-k * 24}px) scale(${k < 0.08 ? 0.6 + (k / 0.08) * 0.4 : 1})`;
      x.span.style.opacity = k < 0.8 ? 1 : Math.max(0, 1 - (k - 0.8) / 0.2);
      if (k >= 1) {
        scene.remove(x.o);
        x.o.element.remove();
        pops.splice(i, 1);
      }
    }
  }

  return { tryClick, isTree: (ray) => !!hit(ray), update };
}
