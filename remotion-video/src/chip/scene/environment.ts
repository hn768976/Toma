import * as THREE from "three";

/**
 * Image-based lighting.
 *
 * Metals and glass are defined by what they reflect. With no environment,
 * three shades `metalness: 1` surfaces almost black — which is why a brushed
 * socket frame or a glass package looks like a dead silhouette until an
 * environment exists. Rather than ship an HDRI, we build a small studio box
 * out of emissive panels and prefilter it, so each variant gets reflections in
 * its own key colours and the whole thing stays procedural.
 */
export type EnvResult = {
  texture: THREE.Texture | null;
  dispose: () => void;
};

type Panel = {
  /** Position as a fraction of the box half-size, in world axes. */
  pos: [number, number, number];
  rot: [number, number, number];
  size: [number, number];
  color: number;
  intensity: number;
};

const studio = (opts: {
  ceiling: number;
  ceilingIntensity: number;
  key: number;
  keyIntensity: number;
  fill: number;
  fillIntensity: number;
  floor: number;
  floorIntensity: number;
}): { scene: THREE.Scene; dispose: () => void } => {
  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];

  const R = 10;
  scene.background = new THREE.Color(opts.floor).multiplyScalar(0.25);

  const panels: Panel[] = [
    // Broad soft ceiling — the main source of the top highlight.
    {
      pos: [0, R, 0],
      rot: [Math.PI / 2, 0, 0],
      size: [R * 2.4, R * 2.4],
      color: opts.ceiling,
      intensity: opts.ceilingIntensity,
    },
    // Key panel, matching the direction of the scene's key light.
    {
      pos: [R * 0.75, R * 0.5, R * 0.6],
      rot: [0, -Math.PI * 0.75, 0],
      size: [R * 1.4, R * 1.2],
      color: opts.key,
      intensity: opts.keyIntensity,
    },
    // Cooler fill opposite it, so edges pick up a second colour.
    {
      pos: [-R * 0.8, R * 0.35, -R * 0.5],
      rot: [0, Math.PI * 0.3, 0],
      size: [R * 1.3, R],
      color: opts.fill,
      intensity: opts.fillIntensity,
    },
    // Bounce off the board plane.
    {
      pos: [0, -R * 0.6, 0],
      rot: [-Math.PI / 2, 0, 0],
      size: [R * 2.4, R * 2.4],
      color: opts.floor,
      intensity: opts.floorIntensity,
    },
  ];

  for (const p of panels) {
    const geo = new THREE.PlaneGeometry(p.size[0], p.size[1]);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(p.color).multiplyScalar(p.intensity),
      side: THREE.DoubleSide,
    });
    disposables.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...p.pos);
    mesh.rotation.set(...p.rot);
    scene.add(mesh);
  }

  return {
    scene,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
};

export const buildEnvironment = (
  renderer: unknown,
  opts: Parameters<typeof studio>[0],
): EnvResult => {
  const box = studio(opts);
  try {
    // PMREMGenerator wants a WebGLRenderer; the WebGPU renderer exposes the
    // same surface it needs, so we attempt it either way and degrade quietly.
    const pmrem = new THREE.PMREMGenerator(
      renderer as THREE.WebGLRenderer,
    );
    pmrem.compileEquirectangularShader();
    const rt = pmrem.fromScene(box.scene, 0.02, 0.1, 80);
    pmrem.dispose();
    box.dispose();
    return {
      texture: rt.texture,
      dispose: () => rt.dispose(),
    };
  } catch (err) {
    console.warn("[chip] environment prefilter unavailable:", err);
    box.dispose();
    return { texture: null, dispose: () => {} };
  }
};
