import * as THREE from "three";

// Procedural PMREM "studio": a dark (or light) box with emissive soft-boxes.
export type Panel = {
  position: [number, number, number];
  size: [number, number];
  color: string;
  intensity: number;
};

const cache = new WeakMap<THREE.WebGLRenderer, Map<string, THREE.Texture>>();

export function studioEnv(
  gl: THREE.WebGLRenderer,
  key: string,
  ambient: string,
  ambientIntensity: number,
  panels: Panel[],
): THREE.Texture {
  let m = cache.get(gl);
  if (!m) {
    m = new Map();
    cache.set(gl, m);
  }
  const hit = m.get(key);
  if (hit) return hit;

  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(30, 30, 30),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(ambient).multiplyScalar(ambientIntensity),
      side: THREE.BackSide,
    }),
  );
  scene.add(room);
  // soft gradient floor/ceiling bands so reflections are never flat
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 14, 3, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(ambient).multiplyScalar(ambientIntensity * 2.2),
      side: THREE.BackSide,
    }),
  );
  band.position.y = 1.5;
  scene.add(band);
  for (const p of panels) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(p.size[0], p.size[1]),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(p.color).multiplyScalar(p.intensity),
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(...p.position);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }
  const pmrem = new THREE.PMREMGenerator(gl);
  const tex = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  m.set(key, tex);
  return tex;
}
