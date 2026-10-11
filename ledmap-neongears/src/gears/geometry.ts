import * as THREE from "three";
import { mulberry32 } from "../lib/rng";
import type { Gear } from "./layout";

// ---------------------------------------------------------------------------------------
// Gear outline ribbons, built in code from the tooth count and module.
// Each polyline becomes a ribbon whose real width is applied in the vertex shader (so it
// can be widened to a minimum pixel footprint with its energy conserved: no shimmer).
// ---------------------------------------------------------------------------------------

type Pt = [number, number];
type Poly = { pts: Pt[]; closed: boolean };

const circle = (r: number, cx = 0, cy = 0, segs?: number): Poly => {
  const n = segs ?? Math.max(40, Math.min(220, Math.ceil(r * 260)));
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return { pts, closed: true };
};

// Tooth profile: tooth centred at u = 0, gap at u = 0.5 (symmetric: meshing phase relies on it).
const toothProfile = (u: number) => {
  const w = Math.abs(u - Math.round(u));
  const s = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // wide smooth flanks: rounded, almost sinusoidal teeth (as in the references)
  return 1 - s(0.06, 0.44, w);
};

const toothOutline = (N: number, m: number): Poly => {
  const rp = (m * N) / 2;
  const rTip = rp + m;
  const rRoot = rp - 1.25 * m;
  const per = 24;
  const pts: Pt[] = [];
  for (let i = 0; i < N * per; i++) {
    const u = i / per;
    const a = (u / N) * Math.PI * 2;
    const r = rRoot + (rTip - rRoot) * toothProfile(u);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return { pts, closed: true };
};

const line = (a: Pt, b: Pt, n = 12): Poly => {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return { pts, closed: false };
};

export type GearShape = { polys: Poly[]; fillR: number; rimR: number };

export const gearShape = (g: Gear): GearShape => {
  const { N, m } = g;
  const rng = mulberry32(g.seed);
  const rp = (m * N) / 2;
  const rRoot = rp - 1.25 * m;
  const polys: Poly[] = [toothOutline(N, m)];
  const rim = rRoot - Math.max(1.6 * m, 0.09 * rp);
  const hub1 = Math.max(0.09 * rp, 1.0 * m);
  const hub2 = Math.max(0.17 * rp, 1.8 * m);
  if (g.style === "pinion") {
    polys.push(circle(Math.max(hub1, 0.24 * rp)));
    if (rng() < 0.6) polys.push(circle(Math.max(hub1 * 0.6, 0.12 * rp)));
  } else if (g.style === "ring") {
    polys.push(circle(rim));
    polys.push(circle(Math.max(hub2, 0.3 * rp)));
  } else if (g.style === "spoked") {
    polys.push(circle(rim));
    polys.push(circle(hub2));
    polys.push(circle(hub1));
    const k = g.spokes;
    const halfW = Math.max(0.065 * rp, 0.9 * m);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const nx = -s, ny = c;
      for (const side of [-1, 1]) {
        const o = side * halfW;
        const r0 = Math.sqrt(Math.max(hub2 * hub2 - o * o, 0));
        const r1 = Math.sqrt(Math.max(rim * rim - o * o, 0));
        polys.push(
          line(
            [c * r0 + nx * o, s * r0 + ny * o],
            [c * r1 + nx * o, s * r1 + ny * o],
            Math.ceil((r1 - r0) / (0.02 + m * 0.3)),
          ),
        );
      }
    }
  } else {
    // Solid web with round cut-outs.
    polys.push(circle(rim));
    polys.push(circle(hub2));
    polys.push(circle(hub1));
    const k = g.cutouts;
    const rc = (hub2 + rim) / 2;
    const cr = Math.min((rim - hub2) * 0.36, Math.sin(Math.PI / k) * rc * 0.72);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + Math.PI / k;
      polys.push(circle(cr, Math.cos(a) * rc, Math.sin(a) * rc));
    }
  }
  return { polys, fillR: rRoot, rimR: rim };
};

// Ribbon buffers: per vertex the centre-line position, the in-plane offset direction
// (miter-scaled) and the side (-1/+1).
export const ribbonGeometry = (polys: Poly[]): THREE.BufferGeometry => {
  const pos: number[] = [];
  const nrm: number[] = [];
  const side: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const p of polys) {
    const n = p.pts.length;
    const count = p.closed ? n + 1 : n;
    for (let j = 0; j < count; j++) {
      const i = j % n;
      const prev = p.closed ? p.pts[(i - 1 + n) % n] : p.pts[Math.max(i - 1, 0)];
      const next = p.closed ? p.pts[(i + 1) % n] : p.pts[Math.min(i + 1, n - 1)];
      let tx = next[0] - prev[0];
      let ty = next[1] - prev[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      // No miter scaling: on tight tooth tips a miter spikes outward. The ribbon simply
      // follows the local normal; folds on the inside are harmless with MAX blending.
      const cur = p.pts[i];
      const miter = 1;
      for (const sd of [-1, 1]) {
        pos.push(cur[0], cur[1], 0);
        nrm.push(-ty * miter, tx * miter);
        side.push(sd);
      }
      if (j < count - 1) {
        const a = base + j * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    base += count * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aNrm", new THREE.Float32BufferAttribute(nrm, 2));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
};

export const RIBBON_VERT = /* glsl */ `
in vec3 position;
in vec2 aNrm;
in float aSide;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uSigma;      // line half-profile sigma, world units
uniform float uViewH;      // render-target height in pixels
uniform float uTanHalf;    // tan(fov/2)
uniform float uMinPx;      // minimum sigma in pixels (anti-aliasing)
out float vX;
out float vGain;
void main() {
  vec4 mvc = modelViewMatrix * vec4(position, 1.0);
  float d = max(-mvc.z, 1e-3);
  float px = 2.0 * d * uTanHalf / uViewH;
  float sEff = sqrt(uSigma * uSigma + (uMinPx * px) * (uMinPx * px));
  vGain = uSigma / sEff;     // widened lines get dimmer: same integrated energy
  float H = 3.0 * sEff;
  vec4 mv = modelViewMatrix * vec4(position + vec3(aNrm * H, 0.0) * aSide, 1.0);
  vX = aSide * 3.0;
  gl_Position = projectionMatrix * mv;
}`;

export const RIBBON_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uGain;
uniform float uCoreGain;
uniform float uFocusCore;
in float vX;
in float vGain;
out vec4 outColor;
void main() {
  float x = vX;
  float glow = exp(-0.5 * x * x);
  float core = exp(-0.5 * (x * x) / 0.0625);  // core = a quarter of the line width
  vec3 c = (uColor * glow * uGain + uCore * core * uCoreGain * uFocusCore) * vGain;
  outColor = vec4(c, 1.0);
}`;

export const FILL_VERT = /* glsl */ `
in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uR;
out vec2 vP;
void main() {
  vP = position.xy / uR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const FILL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAmt;
in vec2 vP;
out vec4 outColor;
void main() {
  float r = length(vP);
  float fw = max(fwidth(r), 1e-4);
  float edge = 1.0 - smoothstep(1.0 - 1.5 * fw, 1.0, r);
  float a = uAmt * (0.45 + 0.55 * smoothstep(0.2, 1.0, r)) * edge;
  outColor = vec4(uColor * a, 1.0);
}`;
