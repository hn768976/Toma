import * as THREE from "three";

/**
 * Screen-space ribbons for thin field lines. Width is given in pixels of the
 * 4K master and converted to device pixels, so 720p previews and 4K renders
 * look the same. Edges are analytically anti-aliased (pixel coverage), which
 * keeps hair-thin lines from crawling when the camera moves.
 */
export interface RibbonLine {
  /** xyz triples */
  p: ArrayLike<number>;
  /** per-point rgb (linear) or one rgb for the whole line */
  color: ArrayLike<number>;
  /** optional per-point alpha multiplier */
  alpha?: ArrayLike<number>;
  /** per-line constant passed to the shader (pulse offset, etc.) */
  param?: number;
}

export const buildRibbonGeometry = (lines: RibbonLine[]) => {
  let nv = 0, ni = 0;
  for (const l of lines) {
    const n = l.p.length / 3;
    if (n < 2) continue;
    nv += n * 2;
    ni += (n - 1) * 6;
  }
  const pos = new Float32Array(nv * 3), prv = new Float32Array(nv * 3), nxt = new Float32Array(nv * 3);
  const side = new Float32Array(nv), arc = new Float32Array(nv), col = new Float32Array(nv * 3);
  const alp = new Float32Array(nv), prm = new Float32Array(nv), len = new Float32Array(nv);
  const idx = new Uint32Array(ni);
  let v = 0, k = 0;
  for (const l of lines) {
    const p = l.p;
    const n = p.length / 3;
    if (n < 2) continue;
    const cum = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      const dx = p[i * 3] - p[i * 3 - 3], dy = p[i * 3 + 1] - p[i * 3 - 2], dz = p[i * 3 + 2] - p[i * 3 - 1];
      cum[i] = cum[i - 1] + Math.hypot(dx, dy, dz);
    }
    const total = cum[n - 1] || 1;
    const perPoint = l.color.length === n * 3;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      for (let s = 0; s < 2; s++) {
        const o = v + s;
        for (let c = 0; c < 3; c++) {
          pos[o * 3 + c] = p[i * 3 + c];
          prv[o * 3 + c] = p[a * 3 + c];
          nxt[o * 3 + c] = p[b * 3 + c];
          col[o * 3 + c] = perPoint ? l.color[i * 3 + c] : l.color[c];
        }
        side[o] = s === 0 ? -1 : 1;
        arc[o] = cum[i] / total;
        len[o] = cum[i];
        alp[o] = l.alpha ? l.alpha[i] : 1;
        prm[o] = l.param ?? 0;
      }
      if (i < n - 1) {
        idx[k++] = v; idx[k++] = v + 1; idx[k++] = v + 2;
        idx[k++] = v + 2; idx[k++] = v + 1; idx[k++] = v + 3;
      }
      v += 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("prevP", new THREE.BufferAttribute(prv, 3));
  g.setAttribute("nextP", new THREE.BufferAttribute(nxt, 3));
  g.setAttribute("side", new THREE.BufferAttribute(side, 1));
  g.setAttribute("arc", new THREE.BufferAttribute(arc, 1));
  g.setAttribute("arcLen", new THREE.BufferAttribute(len, 1));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("alpha", new THREE.BufferAttribute(alp, 1));
  g.setAttribute("param", new THREE.BufferAttribute(prm, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
};

const VERT = /* glsl */ `
in vec3 prevP;
in vec3 nextP;
in float side;
in float arc;
in float arcLen;
in vec3 color;
in float alpha;
in float param;
uniform vec2 res;
uniform float halfExtent; // device px from centre to ribbon edge
out float vOff;
out float vArc;
out float vLen;
out vec3 vColor;
out float vAlpha;
out float vParam;
out float vDepth;
vec2 toScreen(vec4 c) { return c.xy / c.w * res * 0.5; }
void main() {
  mat4 m = projectionMatrix * modelViewMatrix;
  vec4 c = m * vec4(position, 1.0);
  vec2 sc = toScreen(c), sp = toScreen(m * vec4(prevP, 1.0)), sn = toScreen(m * vec4(nextP, 1.0));
  vec2 d1 = sc - sp, d2 = sn - sc;
  d1 = length(d1) > 1e-6 ? normalize(d1) : vec2(0.0);
  d2 = length(d2) > 1e-6 ? normalize(d2) : vec2(0.0);
  vec2 dir = d1 + d2;
  dir = length(dir) > 1e-6 ? normalize(dir) : (length(d1) > 0.0 ? d1 : vec2(1.0, 0.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  // mild miter, clamped so tight bends don't spike
  float miter = 1.0 / max(0.5, abs(dot(nrm, length(d1) > 0.0 ? vec2(-d1.y, d1.x) : nrm)));
  c.xy += nrm * side * halfExtent * min(miter, 2.0) / (res * 0.5) * c.w;
  gl_Position = c;
  vOff = side * halfExtent;
  vArc = arc;
  vLen = arcLen;
  vColor = color;
  vAlpha = alpha;
  vParam = param;
  vDepth = -(modelViewMatrix * vec4(position, 1.0)).z;
}`;

const FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in float vOff;
in float vArc;
in float vLen;
in vec3 vColor;
in float vAlpha;
in float vParam;
in float vDepth;
uniform vec3 depthFade;  // near, far, factor at far (factor 1 = off)
uniform vec4 depthTint;  // rgb, amount: far parts shift toward this tint
uniform float widthPx;   // device px
uniform float mode;      // 0 solid (coverage AA), 1 gaussian glow
uniform float opacity;
uniform float intensity;
uniform float time;      // loop phase 0..1
uniform vec4 pulse;      // amount, pulses per line, trips per loop, length (fraction)
uniform float pulseByLen; // >0: pulse spacing in world units instead of per line
uniform vec3 hotColor;
void main() {
  float d = abs(vOff);
  float a;
  if (mode < 0.5) {
    float hw = max(widthPx * 0.5, 0.5);
    a = clamp(hw + 0.5 - d, 0.0, 1.0) * min(widthPx, 1.0);
  } else {
    float sg = widthPx * 0.4;
    a = exp(-0.5 * d * d / (sg * sg));
  }
  float b = 1.0;
  if (pulse.x > 0.0) {
    float x = pulseByLen > 0.0 ? vLen / pulseByLen : vArc * pulse.y;
    x = fract(x - time * pulse.z + vParam);
    float bump = exp(-0.5 * pow((x - 0.5) / pulse.w, 2.0));
    b += pulse.x * bump;
  }
  vec3 col = mix(vColor, hotColor, clamp((b - 1.0) * 0.35, 0.0, 0.6)) * b * intensity;
  float dt = smoothstep(depthFade.x, depthFade.y, vDepth);
  float df = mix(1.0, depthFade.z, dt);
  col = mix(col, depthTint.rgb * dot(col, vec3(0.33)), depthTint.a * dt);
  fragColor = vec4(col * df, a * vAlpha * opacity);
}`;

export interface RibbonMatOptions {
  width4k: number;
  pxScale: number;
  res: THREE.Vector2;
  mode?: "solid" | "glow";
  additive?: boolean;
  opacity?: number;
  intensity?: number;
  depthTest?: boolean;
  pulse?: [number, number, number, number];
  pulseByLen?: number;
  hotColor?: THREE.Color;
  /** dim with view depth: [near, far, factor at far] */
  depthFade?: [number, number, number];
  depthTint?: [number, number, number, number];
}

export const ribbonMaterial = (o: RibbonMatOptions) => {
  const w = o.width4k * o.pxScale;
  const glow = o.mode === "glow";
  const half = glow ? w * 1.25 + 1 : Math.max(w * 0.5, 0.5) + 1;
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      res: { value: o.res },
      halfExtent: { value: half },
      widthPx: { value: w },
      mode: { value: glow ? 1 : 0 },
      opacity: { value: o.opacity ?? 1 },
      intensity: { value: o.intensity ?? 1 },
      time: { value: 0 },
      pulse: { value: new THREE.Vector4(...(o.pulse ?? [0, 1, 1, 0.05])) },
      pulseByLen: { value: o.pulseByLen ?? 0 },
      hotColor: { value: o.hotColor ?? new THREE.Color(1, 1, 1) },
      depthFade: { value: new THREE.Vector3(...(o.depthFade ?? [0, 1, 1])) },
      depthTint: { value: new THREE.Vector4(...(o.depthTint ?? [1, 1, 1, 0])) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
};
