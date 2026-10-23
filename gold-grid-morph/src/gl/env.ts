import * as THREE from "three";

// Procedural HDR studio environment, generated as an equirectangular float
// texture and pre-filtered with PMREM. Deterministic and asset-free.
export type SoftLight = {
  dir: [number, number, number]; // direction the light sits in
  size: number; // angular radius (radians)
  color: [number, number, number]; // linear HDR colour
  softness?: number;
};

export type EnvSpec = {
  top: [number, number, number];
  horizon: [number, number, number];
  bottom: [number, number, number];
  lights: SoftLight[];
};

export const makeEnvironment = (
  renderer: THREE.WebGLRenderer,
  spec: EnvSpec,
  w = 512,
  h = 256,
): THREE.Texture => {
  const data = new Float32Array(w * h * 4);
  const dirs = spec.lights.map((l) =>
    new THREE.Vector3(...l.dir).normalize(),
  );
  const v = new THREE.Vector3();
  // Rows/columns follow three.js' equirect lookup exactly (flipY = false):
  // u = atan(z, x) / 2pi + 0.5, v = asin(y) / pi + 0.5
  for (let y = 0; y < h; y++) {
    const lat = ((y + 0.5) / h - 0.5) * Math.PI;
    for (let x = 0; x < w; x++) {
      const phi = ((x + 0.5) / w - 0.5) * Math.PI * 2;
      v.set(Math.cos(lat) * Math.cos(phi), Math.sin(lat), Math.cos(lat) * Math.sin(phi));
      const up = v.y;
      let r: number, g: number, b: number;
      if (up >= 0) {
        const t = Math.pow(up, 0.6);
        r = spec.horizon[0] + (spec.top[0] - spec.horizon[0]) * t;
        g = spec.horizon[1] + (spec.top[1] - spec.horizon[1]) * t;
        b = spec.horizon[2] + (spec.top[2] - spec.horizon[2]) * t;
      } else {
        const t = Math.pow(-up, 0.5);
        r = spec.horizon[0] + (spec.bottom[0] - spec.horizon[0]) * t;
        g = spec.horizon[1] + (spec.bottom[1] - spec.horizon[1]) * t;
        b = spec.horizon[2] + (spec.bottom[2] - spec.horizon[2]) * t;
      }
      spec.lights.forEach((l, i) => {
        const ang = Math.acos(Math.min(1, Math.max(-1, v.dot(dirs[i]))));
        const soft = l.softness ?? 0.35;
        const k =
          1 -
          THREE.MathUtils.smoothstep(ang, l.size * (1 - soft), l.size * (1 + soft));
        r += l.color[0] * k;
        g += l.color[1] * k;
        b += l.color[2] * k;
      });
      const o = (y * w + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose();
  pmrem.dispose();
  return rt.texture;
};
