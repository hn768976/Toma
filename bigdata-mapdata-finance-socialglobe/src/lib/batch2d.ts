import * as THREE from "three";
import { glyphAtlas, iconAtlas, IconName } from "./canvas";

// Instanced 2D vector widgets drawn on a panel plane, in panel pixels (y down),
// matching the panel's Canvas 2D texture. Everything that MOVES on a panel
// (rolling digits, growing bars, sweeping donuts, blinking dots) goes through
// here: per-frame JS fills the instance buffers from pure functions of the
// frame, the GPU rasterises with analytic box-filter coverage so thin lines
// and small digits stay stable at steep angles.

const lin = new Map<string, [number, number, number]>();
export const linearRGB = (c: string | THREE.Color): [number, number, number] => {
  if (typeof c !== "string") return [c.r, c.g, c.b];
  let v = lin.get(c);
  if (!v) {
    const col = new THREE.Color(c); // sRGB hex -> linear working space
    v = [col.r, col.g, col.b];
    lin.set(c, v);
  }
  return v;
};

export type DrawOpt = {
  add?: boolean; // additive (doesn't occlude)
  i?: number; // intensity multiplier (HDR, for bloom)
  rot?: number;
};

const K_RECT = 0;
const K_GLYPH = 1;
const K_DOT = 2;
const K_ARC = 3;
const K_ICON = 4;

export const FOG_GLSL_VERT = /* glsl */ `
  uniform vec3 uFog; // near, far, max
  varying float vFog;
  void computeFog(vec4 mv){ vFog = uFog.z * smoothstep(uFog.x, uFog.y, -mv.z); }
`;

const vert = /* glsl */ `
  in vec4 iA; in vec4 iB; in vec4 iC; in vec4 iD;
  uniform vec4 uPanel; // W, H, units per px, z
  uniform float uPad;
  out vec2 vLocal; flat out vec4 vA; flat out vec4 vB; flat out vec4 vC; flat out vec4 vD;
  ${FOG_GLSL_VERT}
  void main(){
    float kind = iD.x;
    vec2 hh = iA.zw;
    if (kind == 2.0) hh = vec2(iA.z * (1.0 + iB.x));
    if (kind == 3.0) hh = vec2(iA.z);
    vec2 ext = hh + ((kind == 1.0 || kind == 4.0) ? 0.0 : uPad);
    vec2 lp = position.xy * 2.0 * ext;
    vLocal = lp;
    float c = cos(iD.z), s = sin(iD.z);
    vec2 p = iA.xy + vec2(c * lp.x - s * lp.y, s * lp.x + c * lp.y);
    vec3 obj = vec3((p.x - uPanel.x * 0.5) * uPanel.z, (uPanel.y * 0.5 - p.y) * uPanel.z, uPanel.w);
    vec4 mv = modelViewMatrix * vec4(obj, 1.0);
    computeFog(mv);
    vA = iA; vB = iB; vC = iC; vD = iD;
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  precision highp float;\n  layout(location = 0) out highp vec4 fragOut;
  in vec2 vLocal; flat in vec4 vA; flat in vec4 vB; flat in vec4 vC; flat in vec4 vD; in float vFog;
  uniform sampler2D uGlyphs; uniform vec2 uGlyphGrid;
  uniform sampler2D uIcons; uniform vec2 uIconGrid;
  uniform float uOpacity;
  // Box-filter coverage of [-h, h] by a pixel footprint of width fw centred at x.
  float cov1(float x, float h, float fw){
    fw = max(fw, 1e-5);
    return clamp((min(x + 0.5 * fw, h) - max(x - 0.5 * fw, -h)) / fw, 0.0, 1.0);
  }
  // uvDx/uvDy: derivatives of the cell uv, computed in uniform control flow.
  vec4 atlas(sampler2D t, vec2 grid, float idx, vec2 uv, vec2 uvDx, vec2 uvDy){
    float col = mod(idx, grid.x);
    float row = floor(idx / grid.x);
    vec2 a = vec2((col + uv.x) / grid.x, 1.0 - (row + uv.y) / grid.y);
    vec2 sc = vec2(1.0 / grid.x, -1.0 / grid.y);
    vec2 dx = uvDx * sc, dy = uvDy * sc;
    // Clamp the footprint so far-away cells never sample neighbouring cells,
    // but keep anisotropy (textureGrad).
    vec2 tsz = vec2(textureSize(t, 0));
    float m = max(length(dx * tsz), length(dy * tsz));
    float lim = 10.0;
    if (m > lim) { dx *= lim / m; dy *= lim / m; }
    return textureGrad(t, a, dx, dy);
  }
  void main(){
    float kind = vD.x;
    float cov = 0.0;
    // All derivatives up front: inside divergent branches they are undefined.
    vec2 lDx = dFdx(vLocal), lDy = dFdy(vLocal);
    vec2 fwL = abs(lDx) + abs(lDy);
    float dist = length(vLocal);
    float fwD = max(fwidth(dist), 1e-5);
    if (kind == 0.0) {
      vec2 fw = fwL;
      vec2 h = vA.zw;
      cov = cov1(vLocal.x, h.x, fw.x) * cov1(vLocal.y, h.y, fw.y);
      if (vB.y > 0.0) {
        vec2 hi = max(h - vB.y, vec2(0.0));
        cov -= cov1(vLocal.x, hi.x, fw.x) * cov1(vLocal.y, hi.y, fw.y);
      }
    } else if (kind == 1.0 || kind == 4.0) {
      vec2 inv = 1.0 / (2.0 * vA.zw);
      vec2 uv = vLocal * inv + 0.5;
      vec4 t = kind == 1.0 ? atlas(uGlyphs, uGlyphGrid, vB.x, uv, lDx * inv, lDy * inv) : atlas(uIcons, uIconGrid, vB.x, uv, lDx * inv, lDy * inv);
      cov = t.a;
    } else if (kind == 2.0) {
      float d = dist;
      float fw = fwD;
      float r = vA.z;
      float re = max(r, 0.5 * fw);
      cov = clamp((re - d) / fw + 0.5, 0.0, 1.0) * (r * r) / (re * re);
      if (vB.x > 0.0) {
        float g = d / (r * (1.0 + vB.x));
        cov += vB.y * exp(-g * g * 6.0);
      }
    } else if (kind == 3.0) {
      float d = dist;
      float fw = fwD;
      float r1 = vA.z, r0 = vB.x;
      float mid = 0.5 * (r0 + r1), hw = 0.5 * (r1 - r0);
      cov = cov1(d - mid, hw, fw);
      float sweep = vB.z;
      if (sweep < 6.2831) {
        float a = atan(vLocal.x, -vLocal.y);
        float t = mod(a - vB.y, 6.28318530718);
        bool inside = t < sweep;
        float de = inside ? min(t, sweep - t) : -min(t - sweep, 6.28318530718 - t);
        cov *= clamp(de * d / fw + 0.5, 0.0, 1.0);
      }
    }
    cov *= uOpacity * (1.0 - vFog);
    float a = vC.a * cov;
    fragOut = vec4(vC.rgb * a, a * (1.0 - vD.y));
  }
`;

export const premultBlend = (m: THREE.Material) => {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendEquationAlpha = THREE.AddEquation;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  m.transparent = true;
  return m;
};

export class Batch2D {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private geo: THREE.InstancedBufferGeometry;
  private A: Float32Array;
  private B: Float32Array;
  private C: Float32Array;
  private D: Float32Array;
  private attrs: THREE.InstancedBufferAttribute[];
  private n = 0;
  readonly cap: number;
  private advance: number;
  private glyphIndex: (ch: string) => number;
  private iconIndex: (n: IconName) => number;

  constructor(opts: {
    capacity: number;
    width: number; // panel px
    height: number;
    unitsPerPx: number;
    z?: number;
    padPx?: number;
    fog?: [number, number, number];
    /** Widgets sit on their own panel; depth testing only causes z-fighting. */
    depthTest?: boolean;
  }) {
    this.cap = opts.capacity;
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute("position", base.getAttribute("position"));
    this.A = new Float32Array(this.cap * 4);
    this.B = new Float32Array(this.cap * 4);
    this.C = new Float32Array(this.cap * 4);
    this.D = new Float32Array(this.cap * 4);
    this.attrs = [this.A, this.B, this.C, this.D].map((arr, i) => {
      const at = new THREE.InstancedBufferAttribute(arr, 4);
      at.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(["iA", "iB", "iC", "iD"][i], at);
      return at;
    });
    this.geo.instanceCount = 0;
    const ga = glyphAtlas();
    const ia = iconAtlas();
    this.advance = ga.advance;
    this.glyphIndex = ga.index;
    this.iconIndex = ia.index;
    this.material = premultBlend(
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: vert,
        fragmentShader: frag,
        // panel y-down -> object y-up flips the winding
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: opts.depthTest ?? false,
        uniforms: {
          uPanel: {
            value: new THREE.Vector4(opts.width, opts.height, opts.unitsPerPx, opts.z ?? 0),
          },
          uPad: { value: opts.padPx ?? 3 },
          uGlyphs: { value: ga.texture },
          uGlyphGrid: { value: new THREE.Vector2(ga.cols, ga.rows) },
          uIcons: { value: ia.texture },
          uIconGrid: { value: new THREE.Vector2(ia.cols, ia.rows) },
          uOpacity: { value: 1 },
          uFog: { value: new THREE.Vector3(...(opts.fog ?? [1e6, 1e6 + 1, 0])) },
        },
      }),
    ) as THREE.ShaderMaterial;
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
  }

  set opacity(v: number) {
    this.material.uniforms.uOpacity.value = v;
  }

  begin() {
    this.n = 0;
  }

  private push(
    a: [number, number, number, number],
    b: [number, number, number, number],
    color: string | THREE.Color,
    alpha: number,
    kind: number,
    o?: DrawOpt,
  ) {
    if (this.n >= this.cap || alpha <= 0.002) return;
    const k = this.n * 4;
    const [r, g, bb] = linearRGB(color);
    const it = o?.i ?? 1;
    this.A.set(a, k);
    this.B.set(b, k);
    this.C[k] = r * it;
    this.C[k + 1] = g * it;
    this.C[k + 2] = bb * it;
    this.C[k + 3] = Math.min(1, alpha);
    this.D[k] = kind;
    this.D[k + 1] = o?.add ? 1 : 0;
    this.D[k + 2] = o?.rot ?? 0;
    this.D[k + 3] = 0;
    this.n++;
  }

  /** Filled rect, x/y top-left (panel px). border > 0 draws an outline. */
  rect(x: number, y: number, w: number, h: number, color: string, alpha = 1, o?: DrawOpt & { border?: number }) {
    this.push([x + w / 2, y + h / 2, w / 2, h / 2], [0, o?.border ?? 0, 0, 0], color, alpha, K_RECT, o);
  }

  line(x0: number, y0: number, x1: number, y1: number, width: number, color: string, alpha = 1, o?: DrawOpt) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    this.push(
      [(x0 + x1) / 2, (y0 + y1) / 2, len / 2 + width / 2, width / 2],
      [0, 0, 0, 0],
      color,
      alpha,
      K_RECT,
      { ...o, rot: Math.atan2(dy, dx) },
    );
  }

  /** Polyline as segments. */
  poly(pts: number[], width: number, color: string, alpha = 1, o?: DrawOpt) {
    for (let i = 0; i + 3 < pts.length; i += 2) {
      this.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], width, color, alpha, o);
    }
  }

  dot(x: number, y: number, r: number, color: string, alpha = 1, o?: DrawOpt & { glow?: number; glowAmt?: number }) {
    this.push([x, y, r, r], [o?.glow ?? 0, o?.glowAmt ?? 0.35, 0, 0], color, alpha, K_DOT, o);
  }

  /** Ring sector. Angles in radians, clockwise from 12 o'clock. */
  arc(cx: number, cy: number, r0: number, r1: number, start: number, sweep: number, color: string, alpha = 1, o?: DrawOpt) {
    if (sweep <= 0) return;
    this.push([cx, cy, r1, r1], [r0, start, Math.min(sweep, 7), 0], color, alpha, K_ARC, o);
  }

  /** Monospace text. size = font size in panel px. y = text vertical centre. */
  text(
    str: string,
    x: number,
    y: number,
    size: number,
    color: string,
    alpha = 1,
    o?: DrawOpt & { align?: "left" | "center" | "right"; spacing?: number },
  ) {
    const adv = this.advance * size * (o?.spacing ?? 1);
    const total = adv * str.length;
    let sx = x;
    if (o?.align === "center") sx = x - total / 2;
    else if (o?.align === "right") sx = x - total;
    const half = (size * (128 / 96)) / 2;
    let i = 0;
    for (const ch of str) {
      if (ch !== " ") {
        this.push([sx + adv * (i + 0.5), y, half, half], [this.glyphIndex(ch), 0, 0, 0], color, alpha, K_GLYPH, o);
      }
      i++;
    }
    return total;
  }

  textWidth(str: string, size: number, spacing = 1) {
    return this.advance * size * spacing * str.length;
  }

  icon(name: IconName, x: number, y: number, size: number, color: string, alpha = 1, o?: DrawOpt) {
    this.push([x, y, size / 2, size / 2], [this.iconIndex(name), 0, 0, 0], color, alpha, K_ICON, o);
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
// Textured plane (Canvas 2D content) with premultiplied output, HDR tint, fog
// and an optional UV scroll (for wrapped/tiled layers).

export const texPlaneMaterial = (
  map: THREE.Texture,
  opts: {
    tint?: [number, number, number];
    opacity?: number;
    add?: boolean;
    fog?: [number, number, number];
    fogColor?: string;
    repeat?: [number, number];
  } = {},
) => {
  const fc = linearRGB(opts.fogColor ?? "#000000");
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthWrite: !opts.add,
    depthTest: true,
    uniforms: {
      map: { value: map },
      uTint: { value: new THREE.Vector3(...(opts.tint ?? [1, 1, 1])) },
      uOpacity: { value: opts.opacity ?? 1 },
      uAdd: { value: opts.add ? 1 : 0 },
      uUV: { value: new THREE.Vector4(0, 0, ...(opts.repeat ?? [1, 1])) },
      uFog: { value: new THREE.Vector3(...(opts.fog ?? [1e6, 1e6 + 1, 0])) },
      uFogColor: { value: new THREE.Vector3(...fc) },
    },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      uniform vec4 uUV;
      ${FOG_GLSL_VERT}
      void main(){
        vUv = uv * uUV.zw + uUV.xy;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        computeFog(mv);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;\n  layout(location = 0) out highp vec4 fragOut;
      in vec2 vUv; in float vFog;
      uniform sampler2D map; uniform vec3 uTint; uniform float uOpacity; uniform float uAdd;
      uniform vec3 uFogColor;
      void main(){
        vec4 t = texture(map, vUv);
        vec3 c = t.rgb * uTint;
        float a = t.a * uOpacity;
        if (uAdd > 0.5) {
          fragOut = vec4(c * a * (1.0 - vFog), 0.0);
        } else {
          c = mix(c, uFogColor, vFog);
          fragOut = vec4(c * a, a);
        }
      }
    `,
  });
  return premultBlend(m) as THREE.ShaderMaterial;
};
