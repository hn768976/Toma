import * as THREE from "three";

/**
 * Procedural environment maps: a dark sphere with soft emissive strips,
 * prefiltered once with PMREM. Deterministic (no randomness involved).
 */
export type Strip = {
  /** Direction the strip's centre faces from the origin. */
  dir: [number, number, number];
  /** Rotation of the strip around its direction (radians). */
  roll: number;
  length: number;
  width: number;
  color: string;
  intensity: number;
};

export const makeStripEnv = (
  gl: THREE.WebGLRenderer,
  strips: Strip[],
  base: { top: string; bottom: string; intensity: number },
  blur = 0.03,
) => {
  const envScene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(50, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(base.top).multiplyScalar(base.intensity) },
        bottom: { value: new THREE.Color(base.bottom).multiplyScalar(base.intensity) },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vDir; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.6, 0.8, vDir.y)), 1.0); }`,
    }),
  );
  envScene.add(sky);
  for (const s of strips) {
    const geo = new THREE.PlaneGeometry(s.length, s.width);
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(s.color).multiplyScalar(s.intensity),
        side: THREE.DoubleSide,
      }),
    );
    const d = new THREE.Vector3(...s.dir).normalize();
    m.position.copy(d.clone().multiplyScalar(30));
    m.lookAt(0, 0, 0);
    m.rotateZ(s.roll);
    envScene.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(envScene, blur, 0.1, 100);
  pmrem.dispose();
  return rt.texture;
};
