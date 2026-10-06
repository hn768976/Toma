import * as THREE from "three";
import { iconAtlas, IconName } from "./canvas";
import { linearRGB, premultBlend } from "./batch2d";

// 3D primitives with resolution-independent sizing: sizes are given in world
// units (perspective) and clamped to >= ~1px with alpha compensation so
// sub-pixel points and lines fade instead of flickering.

const COMMON = /* glsl */ `
  uniform vec2 uRes;      // drawing buffer px
  uniform float uProj;    // px per world unit at distance 1 = uRes.y / (2 tan(fov/2))
`;

// ---------------------------------------------------------------------------
// Point cloud: round soft points, per-point colour/alpha/size, optional
// back-face dimming around a sphere centre (for globes).

export type PointsOpts = {
  count: number;
  sizeScale?: number;
  backAlpha?: number; // multiply for points on the far side of the sphere
  sphereCenter?: THREE.Vector3; // local space centre (default origin)
  softness?: number; // 0 = crisp disc, 1 = gaussian blob
  minPx?: number;
  lit?: number; // 0..1: fade points facing away from an upper-left light
};

export class PointCloud {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  readonly pos: Float32Array;
  readonly col: Float32Array; // rgb linear * intensity, a
  readonly size: Float32Array;
  private geo: THREE.BufferGeometry;

  constructor(o: PointsOpts) {
    this.pos = new Float32Array(o.count * 3);
    this.col = new Float32Array(o.count * 4);
    this.size = new Float32Array(o.count);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("aCol", new THREE.BufferAttribute(this.col, 4));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    this.material = premultBlend(
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        depthWrite: false,
        depthTest: true,
        uniforms: {
          uRes: { value: new THREE.Vector2(1280, 720) },
          uProj: { value: 1000 },
          uSizeScale: { value: o.sizeScale ?? 1 },
          uBack: { value: o.backAlpha ?? 1 },
          uCenter: { value: o.sphereCenter ?? new THREE.Vector3() },
          uSoft: { value: o.softness ?? 0.35 },
          uMinPx: { value: o.minPx ?? 1.4 },
          uLit: { value: o.lit ?? 0 },
          uOpacity: { value: 1 },
        },
        vertexShader: /* glsl */ `
          ${COMMON}
          in vec4 aCol; in float aSize;
          uniform float uSizeScale, uBack, uMinPx, uLit; uniform vec3 uCenter;
          flat out vec4 vCol; flat out float vPx;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float px = aSize * uSizeScale * uProj / max(-mv.z, 1e-3);
            float a = aCol.a;
            if (px < uMinPx) { a *= (px * px) / (uMinPx * uMinPx); px = uMinPx; }
            if (uBack < 1.0 || uLit > 0.0) {
              vec3 cv = (modelViewMatrix * vec4(uCenter, 1.0)).xyz;
              vec3 n = normalize(mv.xyz - cv);
              float facing = dot(n, normalize(-mv.xyz));
              a *= mix(uBack, 1.0, smoothstep(-0.05, 0.2, facing));
              a *= mix(1.0, smoothstep(-0.6, 0.5, dot(n, normalize(vec3(-0.7, 0.55, 0.45)))), uLit);
            }
            vCol = vec4(aCol.rgb, a);
            vPx = px;
            gl_PointSize = px + 2.0;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;\n  layout(location = 0) out highp vec4 fragOut;
          flat in vec4 vCol; flat in float vPx;
          uniform float uSoft, uOpacity;
          void main(){
            vec2 q = (gl_PointCoord * 2.0 - 1.0) * (vPx + 2.0) * 0.5; // px from centre
            float d = length(q);
            float r = vPx * 0.5;
            float core = clamp(r - d + 0.5, 0.0, 1.0);
            float blob = exp(-pow(d / max(r, 0.5), 2.0) * 2.5);
            float c = mix(core, blob, uSoft);
            float a = vCol.a * c * uOpacity;
            fragOut = vec4(vCol.rgb * a, 0.0); // additive light
          }
        `,
      }),
    ) as THREE.ShaderMaterial;
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
  }

  set(i: number, x: number, y: number, z: number, color: string | [number, number, number], alpha: number, size: number, intensity = 1) {
    const c = typeof color === "string" ? linearRGB(color) : color;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.col[i * 4] = c[0] * intensity;
    this.col[i * 4 + 1] = c[1] * intensity;
    this.col[i * 4 + 2] = c[2] * intensity;
    this.col[i * 4 + 3] = alpha;
    this.size[i] = size;
  }

  setAlpha(i: number, a: number) {
    this.col[i * 4 + 3] = a;
  }

  setPos(i: number, x: number, y: number, z: number) {
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
  }

  commit(which: { pos?: boolean; col?: boolean; size?: boolean } = { pos: true, col: true, size: true }) {
    if (which.pos) this.geo.getAttribute("position").needsUpdate = true;
    if (which.col) this.geo.getAttribute("aCol").needsUpdate = true;
    if (which.size) this.geo.getAttribute("aSize").needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Camera-facing billboards: icons from the icon atlas, or soft dots (bokeh).

export class Billboards {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private geo: THREE.InstancedBufferGeometry;
  private P: Float32Array; // xyz, size(world)
  private C: Float32Array; // rgb*i, a
  private K: Float32Array; // kind (0 icon, 1 soft dot, 2 ring dot), atlas index, facing flag, rot
  private attrs: THREE.InstancedBufferAttribute[];
  private n = 0;
  private iconIndex: (n: IconName) => number;

  constructor(cap: number, opts: { backAlpha?: number; center?: THREE.Vector3 } = {}) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute("position", base.getAttribute("position"));
    this.P = new Float32Array(cap * 4);
    this.C = new Float32Array(cap * 4);
    this.K = new Float32Array(cap * 4);
    this.attrs = [this.P, this.C, this.K].map((arr, i) => {
      const at = new THREE.InstancedBufferAttribute(arr, 4);
      at.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(["iP", "iC", "iK"][i], at);
      return at;
    });
    const ia = iconAtlas();
    this.iconIndex = ia.index;
    this.material = premultBlend(
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        depthWrite: false,
        depthTest: true,
        uniforms: {
          uRes: { value: new THREE.Vector2(1280, 720) },
          uProj: { value: 1000 },
          uIcons: { value: ia.texture },
          uGrid: { value: new THREE.Vector2(ia.cols, ia.rows) },
          uBack: { value: opts.backAlpha ?? 1 },
          uCenter: { value: opts.center ?? new THREE.Vector3() },
          uOpacity: { value: 1 },
        },
        vertexShader: /* glsl */ `
          ${COMMON}
          in vec4 iP; in vec4 iC; in vec4 iK;
          uniform float uBack; uniform vec3 uCenter;
          out vec2 vUv; flat out vec4 vC; flat out vec4 vK; flat out float vPx;
          void main(){
            vec4 mv = modelViewMatrix * vec4(iP.xyz, 1.0);
            float px = iP.w * uProj / max(-mv.z, 1e-3);
            float a = iC.a;
            float minPx = 1.5;
            float s = iP.w;
            if (px < minPx) { a *= (px * px) / (minPx * minPx); s *= minPx / px; px = minPx; }
            if (iK.z > 0.5 && uBack < 1.0) {
              vec3 cv = (modelViewMatrix * vec4(uCenter, 1.0)).xyz;
              vec3 n = normalize(mv.xyz - cv);
              float facing = dot(n, normalize(-mv.xyz));
              a *= mix(uBack, 1.0, smoothstep(-0.05, 0.25, facing));
            }
            float c = cos(iK.w), sn = sin(iK.w);
            vec2 p = position.xy;
            mv.xy += vec2(c * p.x - sn * p.y, sn * p.x + c * p.y) * s;
            vUv = position.xy + 0.5;
            vC = vec4(iC.rgb, a); vK = iK; vPx = px;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;\n  layout(location = 0) out highp vec4 fragOut;
          in vec2 vUv; flat in vec4 vC; flat in vec4 vK; flat in float vPx;
          uniform sampler2D uIcons; uniform vec2 uGrid; uniform float uOpacity;
          void main(){
            float cov;
            vec2 sc = vec2(1.0 / uGrid.x, 1.0 / uGrid.y);
            vec2 dx = dFdx(vUv) * sc, dy = dFdy(vUv) * sc; // uniform control flow
            if (vK.x < 0.5) {
              float col = mod(vK.y, uGrid.x), row = floor(vK.y / uGrid.x);
              vec2 a = vec2((col + vUv.x) / uGrid.x, 1.0 - (row + 1.0 - vUv.y) / uGrid.y);
              vec2 tsz = vec2(textureSize(uIcons, 0));
              float m = max(length(dx * tsz), length(dy * tsz));
              if (m > 12.0) { dx *= 12.0 / m; dy *= 12.0 / m; }
              cov = textureGrad(uIcons, a, dx, dy).a;
            } else {
              float d = length(vUv - 0.5) * 2.0;
              if (vK.x < 1.5) {
                cov = exp(-d * d * 4.0);
              } else {
                // bokeh disc with a slightly brighter rim
                float e = 1.5 / max(vPx, 1.0);
                cov = smoothstep(1.0, 1.0 - e * 2.0, d) * (0.65 + 0.35 * smoothstep(0.5, 0.95, d));
              }
            }
            float a = vC.a * cov * uOpacity;
            fragOut = vec4(vC.rgb * a, 0.0);
          }
        `,
      }),
    ) as THREE.ShaderMaterial;
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
  }

  begin() {
    this.n = 0;
  }

  private add(x: number, y: number, z: number, size: number, color: string, alpha: number, kind: number, idx: number, facing: boolean, intensity: number, rot: number) {
    if (alpha <= 0.002) return;
    const k = this.n * 4;
    if (k >= this.P.length) return;
    const c = linearRGB(color);
    this.P[k] = x;
    this.P[k + 1] = y;
    this.P[k + 2] = z;
    this.P[k + 3] = size;
    this.C[k] = c[0] * intensity;
    this.C[k + 1] = c[1] * intensity;
    this.C[k + 2] = c[2] * intensity;
    this.C[k + 3] = Math.min(1, alpha);
    this.K[k] = kind;
    this.K[k + 1] = idx;
    this.K[k + 2] = facing ? 1 : 0;
    this.K[k + 3] = rot;
    this.n++;
  }

  icon(name: IconName, x: number, y: number, z: number, size: number, color: string, alpha: number, o: { facing?: boolean; i?: number; rot?: number } = {}) {
    this.add(x, y, z, size, color, alpha, 0, this.iconIndex(name), !!o.facing, o.i ?? 1, o.rot ?? 0);
  }

  blob(x: number, y: number, z: number, size: number, color: string, alpha: number, o: { facing?: boolean; i?: number; disc?: boolean } = {}) {
    this.add(x, y, z, size, color, alpha, o.disc ? 2 : 1, 0, !!o.facing, o.i ?? 1, 0);
  }

  end() {
    this.geo.instanceCount = this.n;
    for (const at of this.attrs) {
      at.clearUpdateRanges();
      at.addUpdateRange(0, Math.max(4, this.n * 4));
      at.needsUpdate = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Screen-space-width 3D line segments with analytic coverage AA.

export class Lines3D {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private geo: THREE.InstancedBufferGeometry;
  private A: Float32Array; // p0 xyz, width px
  private B: Float32Array; // p1 xyz, unused
  private C: Float32Array; // rgba
  private attrs: THREE.InstancedBufferAttribute[];
  private n = 0;

  constructor(cap: number, opts: { widthPx?: number } = {}) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute("position", base.getAttribute("position"));
    this.A = new Float32Array(cap * 4);
    this.B = new Float32Array(cap * 4);
    this.C = new Float32Array(cap * 4);
    this.attrs = [this.A, this.B, this.C].map((arr, i) => {
      const at = new THREE.InstancedBufferAttribute(arr, 4);
      at.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(["iA", "iB", "iC"][i], at);
      return at;
    });
    this.material = premultBlend(
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        depthWrite: false,
        depthTest: true,
        uniforms: {
          uRes: { value: new THREE.Vector2(1280, 720) },
          uProj: { value: 1000 },
          uWidthScale: { value: opts.widthPx ?? 1 },
          uOpacity: { value: 1 },
        },
        vertexShader: /* glsl */ `
          ${COMMON}
          in vec4 iA; in vec4 iB; in vec4 iC;
          uniform float uWidthScale;
          out float vD; flat out float vW; flat out vec4 vC;
          void main(){
            vec4 c0 = projectionMatrix * modelViewMatrix * vec4(iA.xyz, 1.0);
            vec4 c1 = projectionMatrix * modelViewMatrix * vec4(iB.xyz, 1.0);
            vec2 s0 = c0.xy / c0.w * 0.5 * uRes;
            vec2 s1 = c1.xy / c1.w * 0.5 * uRes;
            vec2 dir = s1 - s0;
            float len = length(dir);
            dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
            vec2 nrm = vec2(-dir.y, dir.x);
            // width in px scales with the resolution (defined at 1080p)
            float w = iA.w * uWidthScale * uRes.y / 1080.0;
            float a = iC.a;
            if (w < 1.0) { a *= w; w = 1.0; }
            float t = position.x + 0.5;        // 0..1 along
            float side = position.y * 2.0;     // -1..1 across
            vec4 c = mix(c0, c1, t);
            vec2 off = nrm * side * (w * 0.5 + 1.0) + dir * (t * 2.0 - 1.0) * 1.0;
            c.xy += off / (0.5 * uRes) * c.w;
            vD = side * (w * 0.5 + 1.0);
            vW = w;
            vC = vec4(iC.rgb, a);
            gl_Position = c;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;\n  layout(location = 0) out highp vec4 fragOut;
          in float vD; flat in float vW; flat in vec4 vC;
          uniform float uOpacity;
          void main(){
            float h = vW * 0.5;
            float cov = clamp(min(vD + 0.5, h) - max(vD - 0.5, -h), 0.0, 1.0);
            float a = vC.a * cov * uOpacity;
            fragOut = vec4(vC.rgb * a, 0.0);
          }
        `,
      }),
    ) as THREE.ShaderMaterial;
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
  }

  begin() {
    this.n = 0;
  }

  seg(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, widthPx: number, color: string, alpha: number, intensity = 1) {
    if (alpha <= 0.002) return;
    const k = this.n * 4;
    if (k >= this.A.length) return;
    const c = linearRGB(color);
    this.A[k] = x0;
    this.A[k + 1] = y0;
    this.A[k + 2] = z0;
    this.A[k + 3] = widthPx;
    this.B[k] = x1;
    this.B[k + 1] = y1;
    this.B[k + 2] = z1;
    this.C[k] = c[0] * intensity;
    this.C[k + 1] = c[1] * intensity;
    this.C[k + 2] = c[2] * intensity;
    this.C[k + 3] = Math.min(1, alpha);
    this.n++;
  }

  end() {
    this.geo.instanceCount = this.n;
    for (const at of this.attrs) {
      at.clearUpdateRanges();
      at.addUpdateRange(0, Math.max(4, this.n * 4));
      at.needsUpdate = true;
    }
  }
}

/** Push resolution/projection uniforms into any material that has them. */
export const syncProjection = (root: THREE.Object3D, cam: THREE.PerspectiveCamera, w: number, h: number) => {
  const proj = h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    if (m && m.uniforms) {
      if (m.uniforms.uRes) m.uniforms.uRes.value.set(w, h);
      if (m.uniforms.uProj) m.uniforms.uProj.value = proj;
    }
  });
};
