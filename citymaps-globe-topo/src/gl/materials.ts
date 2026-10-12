// Screen-space ribbons and points with built-in depth of field.
//
// Lines and dots are thin emissive shapes on dark backgrounds, so DoF is done
// per primitive: each vertex gets a circle of confusion from its view depth,
// the shape is widened by it and its intensity divided by the spread (energy
// is conserved). This is exact across a line, cheap, and deterministic.

import * as THREE from "three";

export interface RibbonLine {
  pts: ArrayLike<number>; // xyz triplets
  closed?: boolean;
  color: [number, number, number];
  alpha?: number;
  width?: number; // multiplier of the material's base width
  seed?: number; // free per-line value (e.g. pulse phase)
}

export const buildRibbonGeometry = (lines: RibbonLine[]) => {
  let nv = 0;
  let ni = 0;
  for (const l of lines) {
    const n = l.pts.length / 3;
    nv += n * 2 + (l.closed ? 2 : 0);
    ni += (n - 1 + (l.closed ? 1 : 0)) * 6;
  }
  const pos = new Float32Array(nv * 3);
  const prev = new Float32Array(nv * 3);
  const next = new Float32Array(nv * 3);
  const side = new Float32Array(nv);
  const color = new Float32Array(nv * 4);
  const width = new Float32Array(nv);
  const param = new Float32Array(nv * 2);
  const index = new Uint32Array(ni);
  let v = 0;
  let k = 0;
  for (const l of lines) {
    const P = l.pts;
    const n = P.length / 3;
    const count = l.closed ? n + 1 : n; // closed: repeat first point at end
    const get = (i: number, out: number[]) => {
      let j = i;
      if (l.closed) j = ((i % n) + n) % n;
      if (!l.closed && i < 0) {
        // mirror
        for (let c = 0; c < 3; c++) out[c] = 2 * P[c] - P[3 + c];
        return;
      }
      if (!l.closed && i >= n) {
        for (let c = 0; c < 3; c++) out[c] = 2 * P[(n - 1) * 3 + c] - P[(n - 2) * 3 + c];
        return;
      }
      out[0] = P[j * 3];
      out[1] = P[j * 3 + 1];
      out[2] = P[j * 3 + 2];
    };
    // cumulative length for the per-line parameter
    const cum = [0];
    const a: number[] = [0, 0, 0];
    const b: number[] = [0, 0, 0];
    for (let i = 1; i < count; i++) {
      get(i - 1, a);
      get(i, b);
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    const total = cum[count - 1] || 1;
    const base = v;
    const cur: number[] = [0, 0, 0];
    const pr: number[] = [0, 0, 0];
    const nx: number[] = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      get(i, cur);
      get(i - 1, pr);
      get(i + 1, nx);
      for (const s of [-1, 1]) {
        pos.set(cur, v * 3);
        prev.set(pr, v * 3);
        next.set(nx, v * 3);
        side[v] = s;
        color[v * 4] = l.color[0];
        color[v * 4 + 1] = l.color[1];
        color[v * 4 + 2] = l.color[2];
        color[v * 4 + 3] = l.alpha ?? 1;
        width[v] = l.width ?? 1;
        param[v * 2] = cum[i] / total;
        param[v * 2 + 1] = l.seed ?? 0;
        v++;
      }
    }
    for (let i = 0; i < count - 1; i++) {
      const i0 = base + i * 2;
      index.set([i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2], k);
      k += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("prev", new THREE.BufferAttribute(prev, 3));
  g.setAttribute("next", new THREE.BufferAttribute(next, 3));
  g.setAttribute("side", new THREE.BufferAttribute(side, 1));
  g.setAttribute("color", new THREE.BufferAttribute(color, 4));
  g.setAttribute("width", new THREE.BufferAttribute(width, 1));
  g.setAttribute("param", new THREE.BufferAttribute(param, 2));
  g.setIndex(new THREE.BufferAttribute(index.subarray(0, k), 1));
  return g;
};

// Shared DoF uniforms: coc_px = min(scale * |z - focus| / z, max)
export interface DofUniforms {
  uFocus: { value: number };
  uCocScale: { value: number };
  uCocMax: { value: number };
}

const DOF_GLSL = /* glsl */ `
uniform float uFocus;
uniform float uCocScale;
uniform float uCocMax;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFogMin;
float cocPx(float z) { return min(uCocScale * abs(z - uFocus) / max(z, 1e-4), uCocMax); }
float fogF(float z) { return mix(1.0, uFogMin, smoothstep(uFogNear, uFogFar, z)); }
`;

export const dofUniforms = (focus: number, cocScale: number, cocMax: number) => ({
  uFocus: { value: focus },
  uCocScale: { value: cocScale },
  uCocMax: { value: cocMax },
  uFogNear: { value: 1e9 },
  uFogFar: { value: 2e9 },
  uFogMin: { value: 1 },
});

// `extraVert`/`extraFrag` let a look modulate brightness (e.g. arc pulses).
export const ribbonMaterial = (opts: {
  basePx: number; // line width in px at the current buffer size
  resolution: [number, number];
  dof: ReturnType<typeof dofUniforms>;
  uniforms?: Record<string, THREE.IUniform>;
  fragMod?: string; // GLSL computing `float mod` from vParam, may use uniforms; sets `bmod`
  softness?: number;
}) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uRes: { value: new THREE.Vector2(...opts.resolution) },
      uPx: { value: opts.basePx },
      uSoft: { value: opts.softness ?? 0.6 },
      ...opts.dof,
      ...(opts.uniforms ?? {}),
    },
    vertexShader: /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uRes;
uniform float uPx;
uniform float uSoft;
${DOF_GLSL}
in vec3 position;
in vec3 prev;
in vec3 next;
in float side;
in vec4 color;
in float width;
in vec2 param;
out vec4 vColor;
out float vDist;
out float vHalf;
out float vSoftW;
out vec2 vParam;
vec2 scr(vec4 c) { return (c.xy / c.w) * 0.5 * uRes; }
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 c = projectionMatrix * mv;
  vec4 cp = projectionMatrix * (modelViewMatrix * vec4(prev, 1.0));
  vec4 cn = projectionMatrix * (modelViewMatrix * vec4(next, 1.0));
  vec2 s = scr(c);
  vec2 d1 = s - scr(cp);
  vec2 d2 = scr(cn) - s;
  if (dot(d1, d1) < 1e-8) d1 = d2;
  if (dot(d2, d2) < 1e-8) d2 = d1;
  d1 = normalize(d1);
  d2 = normalize(d2);
  vec2 t = d1 + d2;
  t = dot(t, t) < 1e-6 ? d1 : normalize(t);
  vec2 n = vec2(-t.y, t.x);
  float miter = 1.0 / max(dot(n, vec2(-d1.y, d1.x)), 0.4);
  float z = -mv.z;
  float coc = cocPx(z);
  float w0 = max(width * uPx, 0.0);
  float w = w0 + 2.0 * coc;
  float soft = uSoft + 0.85 * coc;
  float halfW = 0.5 * w + soft;
  c.xy += n * side * halfW * miter / (0.5 * uRes) * c.w;
  gl_Position = c;
  vColor = color;
  vColor.a *= fogF(z) * (w0 + 1.0) / (w + 1.0);
  vDist = side * halfW;
  vHalf = 0.5 * w;
  vSoftW = soft;
  vParam = param;
}`,
    fragmentShader: /* glsl */ `
precision highp float;
${Object.keys(opts.uniforms ?? {})
  .map((k) => {
    const v = opts.uniforms![k].value;
    const t = typeof v === "number" ? "float" : v instanceof THREE.Vector2 ? "vec2" : v instanceof THREE.Vector3 ? "vec3" : v instanceof THREE.Color ? "vec3" : "float";
    return `uniform ${t} ${k};`;
  })
  .join("\n")}
in vec4 vColor;
in float vDist;
in float vHalf;
in float vSoftW;
in vec2 vParam;
out vec4 fragColor;
void main() {
  float d = abs(vDist);
  float cov = 1.0 - smoothstep(vHalf - vSoftW, vHalf + vSoftW, d);
  float bmod = 1.0;
  vec3 rgb = vColor.rgb;
  ${opts.fragMod ?? ""}
  float a = vColor.a * cov * bmod;
  fragColor = vec4(rgb * a, 0.0);
}`,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendEquation: THREE.AddEquation,
    side: THREE.DoubleSide,
  });

// Points: per-point size, colour, alpha and a free param.
export const buildPointsGeometry = (
  positions: Float32Array,
  colors: Float32Array, // rgba per point
  sizes: Float32Array,
  params?: Float32Array, // vec2 per point
) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  g.setAttribute("param", new THREE.BufferAttribute(params ?? new Float32Array((positions.length / 3) * 2), 2));
  return g;
};

export const pointsMaterial = (opts: {
  basePx: number;
  dof: ReturnType<typeof dofUniforms>;
  uniforms?: Record<string, THREE.IUniform>;
  vertMod?: string; // GLSL: may modify `pos` (vec3) and `amod` (float) using `param`
  hard?: number; // 0 = soft gaussian dot, 1 = hard disc
}) => {
  const u = opts.uniforms ?? {};
  const decl = Object.keys(u)
    .map((k) => {
      const v = u[k].value;
      const t = typeof v === "number" ? "float" : v instanceof THREE.Vector2 ? "vec2" : v instanceof THREE.Vector3 ? "vec3" : v instanceof THREE.Matrix4 ? "mat4" : "float";
      return `uniform ${t} ${k};`;
    })
    .join("\n");
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uPx: { value: opts.basePx }, uHard: { value: opts.hard ?? 0.5 }, ...opts.dof, ...u },
    vertexShader: /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uPx;
${DOF_GLSL}
${decl}
in vec3 position;
in vec4 color;
in float size;
in vec2 param;
out vec4 vColor;
out float vCore;
void main() {
  vec3 pos = position;
  float amod = 1.0;
  ${opts.vertMod ?? ""}
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float z = -mv.z;
  float coc = cocPx(z);
  float s0 = max(size * uPx, 0.5);
  float s = s0 + 2.0 * coc;
  gl_PointSize = s + 2.0;
  vColor = color;
  vColor.a *= amod * fogF(z) * pow((s0 + 1.0) / (s + 1.0), 2.0);
  vCore = s / (s + 2.0);
}`,
    fragmentShader: /* glsl */ `
precision highp float;
uniform float uHard;
in vec4 vColor;
in float vCore;
out vec4 fragColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float hard = 1.0 - smoothstep(vCore - 0.25, vCore, r);
  float soft = exp(-4.0 * r * r / (vCore * vCore));
  float a = vColor.a * mix(soft, hard, uHard);
  fragColor = vec4(vColor.rgb * a, 0.0);
}`,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendEquation: THREE.AddEquation,
  });
};

export const hexRGB = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
