import * as THREE from "three";

// Round dots / soft glow sprites as instanced camera-facing quads.
// Size is either in 720p pixels (screen) or in world units (perspective-scaled).

const VERT = /* glsl */ `
attribute vec3 aPos;
attribute float aSize;
attribute vec4 aCol;
uniform vec2 uRes;
uniform float uPx;
uniform float uWorld;
uniform float uProjY;
uniform float uFogNear;
uniform float uFogFar;
varying vec2 vUv;
varying vec4 vCol;
varying float vRadPx;
void main() {
  vec4 c = projectionMatrix * modelViewMatrix * vec4(aPos, 1.0);
  if (aSize <= 0.0 || aCol.a <= 0.0 || c.w <= 1e-3) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // Diameter in device pixels.
  float dpx = uWorld > 0.5 ? aSize * uProjY * 0.5 * uRes.y / c.w : aSize * uPx;
  float shown = max(dpx, 1.0);
  float quad = shown + 2.0;
  vec2 off = position.xy * quad * 0.5;
  gl_Position = c + vec4(off / (0.5 * uRes) * c.w, 0.0, 0.0);
  vUv = position.xy * quad * 0.5;
  vRadPx = shown * 0.5;
  // Sub-pixel dots fade instead of shrinking below a pixel.
  vCol = vec4(aCol.rgb, aCol.a * min(1.0, dpx) * (1.0 - smoothstep(uFogNear, uFogFar, c.w)));
}`;

const FRAG_HARD = /* glsl */ `
uniform float uOpacity;
varying vec2 vUv;
varying vec4 vCol;
varying float vRadPx;
void main() {
  float a = clamp(vRadPx + 0.5 - length(vUv), 0.0, 1.0) * vCol.a * uOpacity;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vCol.rgb, a);
}`;

const FRAG_SOFT = /* glsl */ `
uniform float uOpacity;
varying vec2 vUv;
varying vec4 vCol;
varying float vRadPx;
void main() {
  float r = length(vUv) / max(vRadPx, 1e-3);
  float a = exp(-r * r * 4.0) * step(r, 1.0) * vCol.a * uOpacity;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vCol.rgb, a);
}`;

export type DotsOptions = {
  world?: boolean;
  soft?: boolean;
  additive?: boolean;
  depthTest?: boolean;
  depthWrite?: boolean;
  fog?: { near: number; far: number };
};

export class Dots {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly pos: Float32Array;
  readonly size: Float32Array;
  readonly col: Float32Array;
  private geo: THREE.InstancedBufferGeometry;
  private attrs: THREE.InstancedBufferAttribute[];

  constructor(
    readonly count: number,
    res: { width: number; height: number; px: number },
    camera: THREE.PerspectiveCamera | null,
    opts: DotsOptions = {},
  ) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.col = new Float32Array(count * 4);
    const mk = (arr: Float32Array, n: number) => {
      const at = new THREE.InstancedBufferAttribute(arr, n);
      at.setUsage(THREE.DynamicDrawUsage);
      return at;
    };
    this.attrs = [mk(this.pos, 3), mk(this.size, 1), mk(this.col, 4)];
    geo.setAttribute("aPos", this.attrs[0]);
    geo.setAttribute("aSize", this.attrs[1]);
    geo.setAttribute("aCol", this.attrs[2]);
    geo.instanceCount = count;
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: opts.soft ? FRAG_SOFT : FRAG_HARD,
      uniforms: {
        uRes: { value: new THREE.Vector2(res.width, res.height) },
        uPx: { value: res.px },
        uWorld: { value: opts.world ? 1 : 0 },
        uProjY: { value: camera ? camera.projectionMatrix.elements[5] : 1 },
        uOpacity: { value: 1 },
        uFogNear: { value: opts.fog?.near ?? 1e8 },
        uFogFar: { value: opts.fog?.far ?? 2e8 },
      },
      transparent: true,
      depthWrite: opts.depthWrite ?? false,
      depthTest: opts.depthTest ?? true,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.camera = camera;
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  private camera: THREE.PerspectiveCamera | null;

  set(i: number, x: number, y: number, z: number, size: number, r: number, g: number, b: number, a: number) {
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.size[i] = size;
    this.col[i * 4] = r;
    this.col[i * 4 + 1] = g;
    this.col[i * 4 + 2] = b;
    this.col[i * 4 + 3] = a;
  }

  hide(i: number) {
    this.size[i] = 0;
  }

  setDrawCount(n: number) {
    this.geo.instanceCount = Math.max(0, Math.min(this.count, n));
  }

  commit() {
    if (this.camera) this.material.uniforms.uProjY.value = this.camera.projectionMatrix.elements[5];
    for (const at of this.attrs) at.needsUpdate = true;
  }
}
