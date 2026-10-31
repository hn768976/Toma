import * as THREE from "three";

/**
 * GPU building blocks for the Ember Nova scene. Everything lives in a 2D
 * "screen space" where y runs 0 (top) -> 1 (bottom) and x runs
 * 0 -> aspect. Sizes are expressed as a fraction of the frame height so the
 * look is identical at 1080p and 4K.
 */

export const additive = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  depthTest: false,
  depthWrite: false,
  transparent: true,
  side: THREE.DoubleSide,
} as const;

export enum SpriteMode {
  Gauss = 0,
  Bokeh = 1,
  Smoke = 2,
  Core = 3,
}

const spriteVert = /* glsl */ `
  attribute vec2 iCenter;
  attribute vec2 iSize;
  attribute float iRot;
  attribute vec4 iColor;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vec2 c = position.xy;
    float s = sin(iRot);
    float co = cos(iRot);
    vec2 p = c * iSize;
    p = vec2(p.x * co - p.y * s, p.x * s + p.y * co);
    vUv = c;
    vColor = iColor;
    gl_Position = projectionMatrix * viewMatrix * vec4(iCenter + p, 0.0, 1.0);
  }
`;

const spriteFrag = /* glsl */ `
  uniform int uMode;
  uniform sampler2D uTex;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    float r2 = dot(vUv, vUv);
    if (r2 > 1.0) discard;
    float edge = 1.0 - smoothstep(0.7, 1.0, r2);
    float a;
    if (uMode == 0) {
      a = exp(-r2 * 5.0) * edge;
    } else if (uMode == 1) {
      float d = sqrt(r2);
      a = smoothstep(1.0, 0.82, d) * (0.55 + 0.45 * smoothstep(0.35, 0.95, d));
    } else if (uMode == 2) {
      float n = texture2D(uTex, vUv * 0.5 + 0.5).r;
      a = pow(n, 1.6) * exp(-r2 * 2.5) * edge;
    } else {
      a = (exp(-r2 * 26.0) + 0.35 * exp(-r2 * 6.0)) * edge;
    }
    gl_FragColor = vec4(vColor.rgb * a * vColor.a, 1.0);
  }
`;

export class SpriteLayer {
  readonly mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private center: THREE.InstancedBufferAttribute;
  private size: THREE.InstancedBufferAttribute;
  private rot: THREE.InstancedBufferAttribute;
  private color: THREE.InstancedBufferAttribute;
  private n = 0;

  constructor(
    readonly capacity: number,
    mode: SpriteMode,
    tex: THREE.Texture | null = null,
  ) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
        3,
      ),
    );
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const mk = (size: number) => {
      const a = new THREE.InstancedBufferAttribute(
        new Float32Array(capacity * size),
        size,
      );
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.center = mk(2);
    this.size = mk(2);
    this.rot = mk(1);
    this.color = mk(4);
    geo.setAttribute("iCenter", this.center);
    geo.setAttribute("iSize", this.size);
    geo.setAttribute("iRot", this.rot);
    geo.setAttribute("iColor", this.color);
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      vertexShader: spriteVert,
      fragmentShader: spriteFrag,
      uniforms: { uMode: { value: mode }, uTex: { value: tex } },
      ...additive,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }

  begin() {
    this.n = 0;
  }

  push(
    x: number,
    y: number,
    sx: number,
    sy: number,
    rot: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ) {
    if (this.n >= this.capacity || a <= 0.0005) return;
    const i = this.n++;
    this.center.setXY(i, x, y);
    this.size.setXY(i, sx, sy);
    this.rot.setX(i, rot);
    this.color.setXYZW(i, r, g, b, a);
  }

  end() {
    this.geo.instanceCount = this.n;
    this.center.needsUpdate = true;
    this.size.needsUpdate = true;
    this.rot.needsUpdate = true;
    this.color.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

const ribbonVert = /* glsl */ `
  attribute vec2 aUv;
  attribute float aAlpha;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vUv = aUv;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

const ribbonFrag = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uRim;
  uniform vec3 uGlow;
  uniform float uIntensity;
  uniform int uMode;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    float u = abs(vUv.x);
    vec3 col;
    if (uMode == 0) {
      // Wide soft glow around the trail.
      col = uGlow * exp(-u * u * 4.0) * (1.0 - smoothstep(0.85, 1.0, u));
    } else {
      // A translucent "tube": hot centre line plus bright rims.
      float core = exp(-u * u * 18.0);
      float body = exp(-u * u * 3.0) * (1.0 - smoothstep(0.85, 1.0, u));
      float rim = exp(-pow((u - 0.72) / 0.11, 2.0));
      col = uCore * core * 0.9 + uRim * (body * 0.55 + rim * 0.75);
    }
    gl_FragColor = vec4(col * vAlpha * uIntensity, 1.0);
  }
`;

export class Ribbon {
  readonly mesh: THREE.Mesh;
  private pos: THREE.BufferAttribute;
  private alpha: THREE.BufferAttribute;
  readonly uniforms: {
    uCore: { value: THREE.Color };
    uRim: { value: THREE.Color };
    uGlow: { value: THREE.Color };
    uIntensity: { value: number };
    uMode: { value: number };
  };

  constructor(
    readonly samples: number,
    mode: 0 | 1,
  ) {
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(samples * 2 * 3), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.alpha = new THREE.BufferAttribute(new Float32Array(samples * 2), 1);
    this.alpha.setUsage(THREE.DynamicDrawUsage);
    const uv = new Float32Array(samples * 2 * 2);
    const idx: number[] = [];
    for (let j = 0; j < samples; j++) {
      const s = j / (samples - 1);
      uv.set([-1, s, 1, s], j * 4);
      if (j < samples - 1) {
        const a = j * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo.setAttribute("position", this.pos);
    geo.setAttribute("aUv", new THREE.BufferAttribute(uv, 2));
    geo.setAttribute("aAlpha", this.alpha);
    geo.setIndex(idx);
    this.uniforms = {
      uCore: { value: new THREE.Color() },
      uRim: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uIntensity: { value: 1 },
      uMode: { value: mode },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: ribbonVert,
      fragmentShader: ribbonFrag,
      uniforms: this.uniforms,
      ...additive,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }

  /** pts: [x,y] per sample (head first), widths/alphas per sample. */
  update(
    pts: Float32Array,
    widths: Float32Array,
    alphas: Float32Array,
    widthScale: number,
  ) {
    const n = this.samples;
    let nx = 0;
    let ny = 1;
    for (let j = 0; j < n; j++) {
      // A wide tangent window keeps the ribbon from folding on tight loops.
      const a = Math.max(0, j - 3);
      const b = Math.min(n - 1, j + 3);
      const tx = pts[b * 2] - pts[a * 2];
      const ty = pts[b * 2 + 1] - pts[a * 2 + 1];
      const len = Math.hypot(tx, ty);
      if (len > 1e-6) {
        nx = -ty / len;
        ny = tx / len;
      }
      const w = widths[j] * widthScale;
      const x = pts[j * 2];
      const y = pts[j * 2 + 1];
      this.pos.setXYZ(j * 2, x - nx * w, y - ny * w, 0);
      this.pos.setXYZ(j * 2 + 1, x + nx * w, y + ny * w, 0);
      this.alpha.setX(j * 2, alphas[j]);
      this.alpha.setX(j * 2 + 1, alphas[j]);
    }
    this.pos.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** Seeded fBm value-noise texture used for smoke puffs. */
export const makeNoiseTexture = (size: number, seed: number) => {
  const rnd = (() => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const G = 64;
  const grid = new Float32Array(G * G).map(() => rnd());
  const val = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const at = (i: number, j: number) =>
      grid[(((j % G) + G) % G) * G + (((i % G) + G) % G)];
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let f = 0;
      let amp = 0.5;
      let freq = 4 / size;
      // Domain-warped fBm gives wispy, smoke-like filaments.
      const wx = val(x * 3 / size + 7.1, y * 3 / size) * 2.0;
      const wy = val(x * 3 / size, y * 3 / size + 3.3) * 2.0;
      for (let o = 0; o < 5; o++) {
        f += amp * val(x * freq + wx, y * freq + wy);
        freq *= 2;
        amp *= 0.5;
      }
      const v = Math.max(0, Math.min(255, Math.round(Math.pow(f, 1.8) * 300)));
      const k = (y * size + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = v;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};
