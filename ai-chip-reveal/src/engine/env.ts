import * as THREE from "three";

export interface EnvPanel {
  /** centre of the light panel (it always faces the origin) */
  pos: [number, number, number];
  size: [number, number];
  color: number | string;
  intensity: number;
}

/**
 * Builds a small studio out of coloured soft-box panels and bakes it into a
 * PMREM environment map. Reflections on metal then show soft, tinted light
 * shapes instead of a uniform grey. Fully procedural: nothing is loaded.
 */
export interface EnvLobe {
  /** direction the soft light comes from */
  dir: [number, number, number];
  color: number | string;
  intensity: number;
  /** higher = narrower */
  power: number;
}

export const makeStudioEnv = (
  gl: THREE.WebGLRenderer,
  panels: readonly EnvPanel[],
  ambient: number | string = 0x050505,
  lobes: readonly EnvLobe[] = [],
) => {
  const env = new THREE.Scene();
  // room walls: dark, with broad soft lobes of light (a gradient, so that
  // chrome shows a bright side and a dark side instead of flat grey)
  const sphere = new THREE.SphereGeometry(60, 48, 24);
  const pos = sphere.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(ambient);
  const dir = new THREE.Vector3();
  const lobeData = lobes.map((l) => ({
    d: new THREE.Vector3(...l.dir).normalize(),
    c: new THREE.Color(l.color).multiplyScalar(l.intensity),
    p: l.power,
  }));
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    let r = base.r;
    let g = base.g;
    let b = base.b;
    for (const l of lobeData) {
      const w = Math.pow(Math.max(0, dir.dot(l.d) * 0.5 + 0.5), l.p);
      r += l.c.r * w;
      g += l.c.g * w;
      b += l.c.b * w;
    }
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  sphere.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const room = new THREE.Mesh(
    sphere,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }),
  );
  env.add(room);
  for (const p of panels) {
    const col = new THREE.Color(p.color).multiplyScalar(p.intensity);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(p.size[0], p.size[1]),
      new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }),
    );
    m.position.set(...p.pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(env, 0.03);
  pmrem.dispose();
  env.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  });
  return rt.texture;
};
