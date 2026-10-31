import * as THREE from "three";

/**
 * GPU instanced primitives with a shared, physically-inspired depth of field.
 *
 * Every primitive computes its circle of confusion in the vertex shader from
 * its view-space depth (coc ~ |1 - focus / depth|), grows its quad by that
 * amount and lowers its intensity so the total energy is roughly preserved.
 * Everything is blended additively (premultiplied ONE/ONE), which is order
 * independent, so no sorting is needed.
 *
 * All sizes in pixels are specified relative to a 1080-line frame and scaled
 * by uRes.y / 1080, so the same composition renders identically at 1080p
 * (--scale=0.5) and native 4K.
 */

export type SharedUniforms = {
  uTime: { value: number };
  uRes: { value: THREE.Vector2 };
  uFocus: { value: number };
  uAperture: { value: number };
  uFog: { value: number };
  uMaxCoc: { value: number };
};

export const createSharedUniforms = (): SharedUniforms => ({
  uTime: { value: 0 },
  uRes: { value: new THREE.Vector2(3840, 2160) },
  uFocus: { value: 20 },
  uAperture: { value: 10 },
  uFog: { value: 0.01 },
  uMaxCoc: { value: 220 },
});

const COMMON = /* glsl */ `
uniform float uTime;
uniform vec2 uRes;
uniform float uFocus;
uniform float uAperture;
uniform float uFog;
uniform float uMaxCoc;
float kScale() { return uRes.y / 1080.0; }
float cocPx(float depth) {
  return min(uAperture * kScale() * abs(1.0 - uFocus / max(depth, 0.001)), uMaxCoc * kScale());
}
float fogF(float depth) { return exp(-depth * uFog); }
`;

const VS_COMMON = /* glsl */ `
float pxPerUnit(float depth) { return projectionMatrix[1][1] * 0.5 * uRes.y / depth; }
`;

const additive = (
  vertexShader: string,
  fragmentShader: string,
  uniforms: SharedUniforms,
) =>
  new THREE.ShaderMaterial({
    vertexShader: COMMON + VS_COMMON + vertexShader,
    fragmentShader: COMMON + fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });

/* ------------------------------------------------------------------ */
/* Sprites: dots, glows and lens stars                                 */
/* ------------------------------------------------------------------ */

export const SPRITE_DOT = 0;
export const SPRITE_GLOW = 1;
export const SPRITE_STAR = 2;

export type Sprite = {
  pos: THREE.Vector3;
  color: [number, number, number];
  alpha: number;
  /** world-space diameter */
  size: number;
  /** minimum diameter in px (at 1080) */
  minPx: number;
  birth?: number;
  kind?: number;
  twinklePhase?: number;
  twinkleAmt?: number;
  driftAmp?: number;
  driftSpeed?: number;
};

const SPRITE_VS = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iColor;
attribute vec4 iA; // size, minPx, birth, kind
attribute vec4 iB; // twinkle phase, twinkle amount, drift amp, drift speed
varying vec2 vUv;
varying vec4 vCol;
varying float vBlur;
varying float vKind;
void main() {
  float k = kScale();
  float born = smoothstep(iA.z, iA.z + 0.7, uTime);
  vec3 p = iPos;
  float ds = iB.w * uTime + iB.x * 6.2831;
  p += iB.z * vec3(sin(ds), sin(ds * 1.31 + 1.7), cos(ds * 0.73 + 0.4));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  if (depth < 0.08 || born <= 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float sizePx = max(iA.x * pxPerUnit(depth) * born, iA.y * k);
  float kind = iA.w;
  float total;
  float gain;
  if (kind > 1.5) {
    total = min(sizePx, 1100.0 * k);
    gain = 1.0;
    vBlur = 0.0;
  } else {
    float coc = cocPx(depth);
    total = sqrt(sizePx * sizePx + coc * coc);
    gain = (sizePx * sizePx) / (total * total);
    gain = max(gain, 0.0);
    vBlur = coc / total;
  }
  float tw = 1.0 - iB.y * (0.5 + 0.5 * sin(uTime * (2.0 + iB.x * 3.0) + iB.x * 40.0));
  vCol = vec4(iColor.rgb, iColor.a * gain * tw * born * fogF(depth));
  vUv = position.xy;
  vKind = kind;
  vec4 clip = projectionMatrix * mv;
  clip.xy += position.xy * total / uRes * clip.w;
  gl_Position = clip;
}
`;

const SPRITE_FS = /* glsl */ `
varying vec2 vUv;
varying vec4 vCol;
varying float vBlur;
varying float vKind;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float a;
  if (vKind < 0.5) {
    float g = exp(-r * r * 7.0);
    float disk = smoothstep(0.80, 0.68, r) * (0.7 + 0.3 * smoothstep(0.35, 0.74, r));
    a = mix(g, disk * 0.32, smoothstep(0.35, 0.85, vBlur));
  } else if (vKind < 1.5) {
    float g = exp(-r * r * 70.0) + exp(-r * r * 12.0) * 0.30 + exp(-r * 3.5) * 0.10;
    float disk = smoothstep(0.80, 0.62, r) * 0.30;
    a = mix(g, disk, smoothstep(0.4, 0.9, vBlur));
  } else {
    vec2 q = vUv;
    float h = exp(-abs(q.y) * 110.0) * exp(-abs(q.x) * 2.4) * 0.85;
    float v = exp(-abs(q.x) * 160.0) * exp(-abs(q.y) * 6.0) * 0.30;
    float ang = atan(q.y, q.x);
    float rays = pow(abs(cos(ang * 4.0 + 0.5)), 80.0) * exp(-r * 6.5) * 0.55
               + pow(abs(cos(ang * 3.0 + 1.3)), 140.0) * exp(-r * 4.5) * 0.35;
    float core = exp(-r * r * 500.0) + exp(-r * r * 45.0) * 0.22;
    a = h + v + rays + core;
  }
  a *= vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, a);
}
`;

const quadGeometry = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
      3,
    ),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

export class SpriteBatch {
  readonly mesh: THREE.Mesh;
  private readonly pos: THREE.InstancedBufferAttribute;
  private readonly col: THREE.InstancedBufferAttribute;

  constructor(sprites: Sprite[], uniforms: SharedUniforms) {
    const n = Math.max(1, sprites.length);
    const g = quadGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 4);
    const a = new Float32Array(n * 4);
    const b = new Float32Array(n * 4);
    sprites.forEach((s, i) => {
      pos.set([s.pos.x, s.pos.y, s.pos.z], i * 3);
      col.set([...s.color, s.alpha], i * 4);
      a.set([s.size, s.minPx, s.birth ?? -10, s.kind ?? SPRITE_DOT], i * 4);
      b.set(
        [
          s.twinklePhase ?? 0,
          s.twinkleAmt ?? 0,
          s.driftAmp ?? 0,
          s.driftSpeed ?? 0,
        ],
        i * 4,
      );
    });
    this.pos = new THREE.InstancedBufferAttribute(pos, 3);
    this.col = new THREE.InstancedBufferAttribute(col, 4);
    g.setAttribute("iPos", this.pos);
    g.setAttribute("iColor", this.col);
    g.setAttribute("iA", new THREE.InstancedBufferAttribute(a, 4));
    g.setAttribute("iB", new THREE.InstancedBufferAttribute(b, 4));
    g.instanceCount = sprites.length;
    this.mesh = new THREE.Mesh(g, additive(SPRITE_VS, SPRITE_FS, uniforms));
    this.mesh.frustumCulled = false;
  }

  /** Update positions / alpha of dynamic sprites (e.g. data pulses). */
  setInstance(i: number, p: THREE.Vector3, alpha: number) {
    this.pos.setXYZ(i, p.x, p.y, p.z);
    this.col.setW(i, alpha);
  }

  commit() {
    this.pos.needsUpdate = true;
    this.col.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/* Lines: screen-space ribbons, near-plane clipped, defocused per end  */
/* ------------------------------------------------------------------ */

export type Line = {
  a: THREE.Vector3;
  b: THREE.Vector3;
  colorA: [number, number, number];
  colorB: [number, number, number];
  alphaA: number;
  alphaB: number;
  /** line width in px (at 1080) */
  width: number;
  birth?: number;
  grow?: number;
};

const LINE_VS = /* glsl */ `
attribute vec3 iStart;
attribute vec3 iEnd;
attribute vec4 iColA;
attribute vec4 iColB;
attribute vec4 iP; // width, birth, grow duration
varying vec4 vCol;
varying float vSide;
void main() {
  float k = kScale();
  float g = clamp((uTime - iP.y) / max(iP.z, 0.001), 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g);
  vec3 e = mix(iStart, iEnd, g);
  vec4 a = modelViewMatrix * vec4(iStart, 1.0);
  vec4 b = modelViewMatrix * vec4(e, 1.0);
  float zn = -0.12;
  if ((a.z > zn && b.z > zn) || g <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (a.z > zn) { a = mix(a, b, (zn - a.z) / (b.z - a.z)); }
  if (b.z > zn) { b = mix(b, a, (zn - b.z) / (a.z - b.z)); }
  vec4 ca = projectionMatrix * a;
  vec4 cb = projectionMatrix * b;
  vec2 sa = ca.xy / ca.w * 0.5 * uRes;
  vec2 sb = cb.xy / cb.w * 0.5 * uRes;
  vec2 dir = sb - sa;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  bool isB = position.x > 0.5;
  vec4 clip = isB ? cb : ca;
  float depth = isB ? -b.z : -a.z;
  float w = iP.x * k;
  float coc = cocPx(depth);
  float tw = sqrt(w * w + coc * coc);
  float gain = w / tw;
  vec2 spx = (isB ? sb : sa) + nrm * position.y * tw + dir * (isB ? 1.0 : -1.0) * tw * 0.5;
  vec4 col = isB ? iColB : iColA;
  vCol = vec4(col.rgb, col.a * gain * fogF(depth));
  vSide = position.y;
  gl_Position = vec4(spx / (0.5 * uRes) * clip.w, clip.z, clip.w);
}
`;

const LINE_FS = /* glsl */ `
varying vec4 vCol;
varying float vSide;
void main() {
  float a = exp(-vSide * vSide * 3.2) * vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, a);
}
`;

export class LineBatch {
  readonly mesh: THREE.Mesh;
  constructor(lines: Line[], uniforms: SharedUniforms) {
    const n = Math.max(1, lines.length);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0]),
        3,
      ),
    );
    g.setIndex([0, 2, 1, 2, 3, 1]);
    const s = new Float32Array(n * 3);
    const e = new Float32Array(n * 3);
    const ca = new Float32Array(n * 4);
    const cb = new Float32Array(n * 4);
    const p = new Float32Array(n * 4);
    lines.forEach((l, i) => {
      s.set([l.a.x, l.a.y, l.a.z], i * 3);
      e.set([l.b.x, l.b.y, l.b.z], i * 3);
      ca.set([...l.colorA, l.alphaA], i * 4);
      cb.set([...l.colorB, l.alphaB], i * 4);
      p.set([l.width, l.birth ?? -10, l.grow ?? 0.001, 0], i * 4);
    });
    g.setAttribute("iStart", new THREE.InstancedBufferAttribute(s, 3));
    g.setAttribute("iEnd", new THREE.InstancedBufferAttribute(e, 3));
    g.setAttribute("iColA", new THREE.InstancedBufferAttribute(ca, 4));
    g.setAttribute("iColB", new THREE.InstancedBufferAttribute(cb, 4));
    g.setAttribute("iP", new THREE.InstancedBufferAttribute(p, 4));
    g.instanceCount = lines.length;
    this.mesh = new THREE.Mesh(g, additive(LINE_VS, LINE_FS, uniforms));
    this.mesh.frustumCulled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Procedural SDF billboards: target rings, HUD panels, widgets        */
/* ------------------------------------------------------------------ */

export const BB_RING = 0;
export const BB_PANEL = 1;
export const BB_BARS = 2;
export const BB_TEXT = 3;

export type Billboard = {
  pos: THREE.Vector3;
  color: [number, number, number];
  alpha: number;
  /** world-space width / height */
  w: number;
  h: number;
  kind: number;
  seed: number;
  birth?: number;
  rot?: number;
  rotSpeed?: number;
  /** additional blur in px (at 1080), used for glow passes */
  extraBlur?: number;
};

const BB_VS = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iColor;
attribute vec2 iSize;
attribute vec4 iA; // kind, seed, birth, rotation
attribute vec4 iB; // rotation speed, extra blur (px at 1080)
varying vec2 vP;
varying vec4 vCol;
varying float vBlur;
varying float vPx;
varying float vAspect;
varying float vAng;
varying float vKind;
varying float vSeed;
varying float vBorn;
void main() {
  float k = kScale();
  float born = smoothstep(iA.z, iA.z + 0.9, uTime);
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float depth = -mv.z;
  if (depth < 0.15 || born <= 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float s = born * (1.0 + 0.18 * sin(born * 3.14159));
  vec2 sPx = max(iSize * pxPerUnit(depth) * s, vec2(1.0));
  float coc = cocPx(depth) + iB.y * k;
  vec2 halfPx = sPx * 0.5 + coc + 2.0 * k;
  vP = position.xy * halfPx / sPx;
  vAspect = iSize.x / iSize.y;
  vBlur = (coc + 1.2 * k) / sPx.y;
  vPx = 1.2 * k / sPx.y;
  vCol = vec4(iColor.rgb, iColor.a * fogF(depth));
  vAng = iA.w + iB.x * uTime + (1.0 - born) * 2.0;
  vKind = iA.x;
  vSeed = iA.y;
  vBorn = born;
  vec4 clip = projectionMatrix * mv;
  clip.xy += position.xy * halfPx * 2.0 / uRes * clip.w;
  gl_Position = clip;
}
`;

const BB_FS = /* glsl */ `
varying vec2 vP;
varying vec4 vCol;
varying float vBlur;
varying float vPx;
varying float vAspect;
varying float vAng;
varying float vKind;
varying float vSeed;
varying float vBorn;

float hash(float n) { return fract(sin(n) * 43758.5453123); }
float bl() { return max(vBlur, vPx); }
float cover(float d) { return clamp(0.5 - d / (2.0 * bl()), 0.0, 1.0); }
float stroke(float d, float hw) { return cover(abs(d) - hw) * min(1.0, (hw + vPx) / bl()); }
float boxSdf(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float fillBox(vec2 p, vec2 c, vec2 hb) {
  float d = boxSdf(p - c, hb);
  return cover(d) * min(1.0, (min(hb.x, hb.y) + vPx) / bl());
}
float arcSdf(vec2 p, float R, float hw, float mid, float halfSpan) {
  float c = cos(mid), s = sin(mid);
  p = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
  float a = abs(atan(p.y, p.x));
  if (a <= halfSpan) return abs(length(p) - R) - hw;
  vec2 e = R * vec2(cos(halfSpan), sin(halfSpan));
  p.y = abs(p.y);
  return length(p - e) - hw;
}

void main() {
  vec2 q = vP * vec2(vAspect, 1.0);
  float a = 0.0;
  if (vKind < 0.5) {
    // Target ring: thick broken arc + thin outer arcs + faint inner circle.
    float c = cos(vAng), s = sin(vAng);
    q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    a += cover(arcSdf(q, 0.30, 0.048, 0.0, 2.35)) * min(1.0, (0.048 + vPx) / bl());
    a += cover(arcSdf(q, 0.30, 0.048, 3.14159, 0.42)) * min(1.0, (0.048 + vPx) / bl());
    float o = vSeed * 6.0;
    a += 0.85 * cover(arcSdf(q, 0.42, 0.011, o + 0.6, 1.05)) * min(1.0, (0.011 + vPx) / bl());
    a += 0.85 * cover(arcSdf(q, 0.42, 0.011, o + 3.9, 0.55)) * min(1.0, (0.011 + vPx) / bl());
    a += 0.35 * stroke(length(q) - 0.19, 0.006);
  } else if (vKind < 1.5) {
    // HUD panel: faint fill, thin frame, rows of bright "text" bars.
    float W = vAspect * 0.5;
    a += cover(boxSdf(q, vec2(W - 0.03, 0.47))) * 0.07;
    a += stroke(boxSdf(q, vec2(W - 0.03, 0.47)), 0.008) * 0.45;
    a += fillBox(q, vec2(-W + 0.11, 0.30), vec2(0.05, 0.05)) * 1.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float len = (0.35 + 0.65 * hash(vSeed * 91.0 + fi * 7.3)) * (W * 2.0 - 0.36);
      float y = 0.30 - fi * 0.15;
      float x0 = (i == 0) ? -W + 0.22 : -W + 0.09;
      float ln = (i == 0) ? len * 0.8 : len;
      a += fillBox(q, vec2(x0 + ln * 0.5, y), vec2(ln * 0.5, 0.04)) * (i == 0 ? 1.0 : 0.85);
    }
  } else if (vKind < 2.5) {
    // Small bar chart widget.
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float h = 0.15 + 0.75 * hash(vSeed * 13.0 + fi * 3.1);
      h *= 0.75 + 0.25 * sin(uTime * 3.0 + fi + vSeed * 10.0);
      float x = -0.42 * vAspect + fi * (0.84 * vAspect / 6.0);
      a += fillBox(q, vec2(x, -0.4 + h * 0.4), vec2(0.035, h * 0.4));
    }
    a += fillBox(q, vec2(0.0, -0.44), vec2(vAspect * 0.47, 0.012)) * 0.7;
  } else {
    // Tiny text box: bracket frame + lines.
    float W = vAspect * 0.5;
    a += stroke(boxSdf(q, vec2(W - 0.04, 0.42)), 0.02) * 0.6;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float len = (0.4 + 0.6 * hash(vSeed * 37.0 + fi * 5.7)) * (W * 2.0 - 0.3);
      a += fillBox(q, vec2(-W + 0.15 + len * 0.5, 0.2 - fi * 0.2), vec2(len * 0.5, 0.05));
    }
  }
  a *= vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, a);
}
`;

export class BillboardBatch {
  readonly mesh: THREE.Mesh;
  constructor(items: Billboard[], uniforms: SharedUniforms) {
    const n = Math.max(1, items.length);
    const g = quadGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 4);
    const size = new Float32Array(n * 2);
    const a = new Float32Array(n * 4);
    const b = new Float32Array(n * 4);
    items.forEach((it, i) => {
      pos.set([it.pos.x, it.pos.y, it.pos.z], i * 3);
      col.set([...it.color, it.alpha], i * 4);
      size.set([it.w, it.h], i * 2);
      a.set([it.kind, it.seed, it.birth ?? -10, it.rot ?? 0], i * 4);
      b.set([it.rotSpeed ?? 0, it.extraBlur ?? 0, 0, 0], i * 4);
    });
    g.setAttribute("iPos", new THREE.InstancedBufferAttribute(pos, 3));
    g.setAttribute("iColor", new THREE.InstancedBufferAttribute(col, 4));
    g.setAttribute("iSize", new THREE.InstancedBufferAttribute(size, 2));
    g.setAttribute("iA", new THREE.InstancedBufferAttribute(a, 4));
    g.setAttribute("iB", new THREE.InstancedBufferAttribute(b, 4));
    g.instanceCount = items.length;
    this.mesh = new THREE.Mesh(g, additive(BB_VS, BB_FS, uniforms));
    this.mesh.frustumCulled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Full-screen background                                              */
/* ------------------------------------------------------------------ */

export const createBackground = (
  inner: [number, number, number],
  outer: [number, number, number],
  uniforms: SharedUniforms,
) => {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      uInner: { value: new THREE.Vector3(...inner) },
      uOuter: { value: new THREE.Vector3(...outer) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uInner;
      uniform vec3 uOuter;
      uniform vec2 uRes;
      uniform float uTime;
      varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        float d = length(p * vec2(0.85, 1.1));
        vec3 c = mix(uInner, uOuter, smoothstep(0.05, 0.95, d));
        float n = h(floor(gl_FragCoord.xy) + floor(uTime * 30.0) * 17.0) - 0.5;
        c += n * 0.012;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
};
