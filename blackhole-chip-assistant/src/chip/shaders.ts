import { LOOP_FRAMES } from "../common/constants";
import { NOISE_GLSL } from "../common/glsl";
import { ATLAS_H, ATLAS_W, CELL, CHIP, COLS_X, COLS_Z, ROWS_Y, SIDE_ROW0 } from "./layout";

const F = `${LOOP_FRAMES}.0`;

/** schedule envelope: event starting at s lasting d frames, evaluated at f (wraps on the loop) */
const ENV_GLSL = /* glsl */ `
float eventEnv(float f, float s, float d) {
  if (s < 0.0) return 0.0;
  float l = mod(f - s + ${F}, ${F});
  if (l >= d) return 0.0;
  float x = l / d;
  return sin(3.14159265 * x);
}
`;

/* ── Chip shell: grid of cells on top and side faces + edge glow ─────────── */
export const shellVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vWorldN;
varying vec3 vView;
void main() {
  vObj = position;
  vN = normal;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldN = normalize(mat3(modelMatrix) * normal);
  vView = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
#ifdef MIRROR
  // Reflection in the board: keep the mirrored image's screen position but
  // give it the depth of the board point it is seen through, so the chip
  // (which is in front of the board) correctly hides it.
  float t = cameraPosition.y / max(cameraPosition.y - wp.y, 1e-4);
  vec3 onBoard = cameraPosition + t * (wp.xyz - cameraPosition);
  onBoard.y = 0.0;
  vec4 cb = projectionMatrix * viewMatrix * vec4(onBoard, 1.0);
  gl_Position.z = (cb.z / cb.w - 0.0005) * gl_Position.w;
#endif
}
`;

export const shellFragment = /* glsl */ `
${NOISE_GLSL}
${ENV_GLSL}
uniform sampler2D uCells;
uniform float uFrame;
uniform float uGain;
uniform float uMirror;
uniform vec3 cDim;
uniform vec3 cLine;
uniform vec3 cLit;
uniform vec3 cEdge;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vWorldN;
varying vec3 vView;

const vec3 HALF = vec3(${(CHIP.w / 2).toFixed(4)}, ${(CHIP.h).toFixed(4)}, ${(CHIP.d / 2).toFixed(4)});

// AA box: 1 inside [lo,hi]^2, 0 outside
// fw must come from the continuous cell coordinate, not from fract() (which
// jumps at every cell edge and would inflate the filter width there)
vec2 gFw;
float boxAA(vec2 p, vec2 lo, vec2 hi) {
  vec2 fw = gFw;
  vec2 w = fw * 0.75;
  vec2 a = smoothstep(lo - w, lo + w, p) * (1.0 - smoothstep(hi - w, hi + w, p));
  // sub-pixel cells: fade to the box's average coverage
  vec2 avg = hi - lo;
  a = mix(a, avg, smoothstep(0.15, 0.5, fw));
  return a.x * a.y;
}

void main() {
  vec3 an = abs(vN);
  vec2 g;        // position on the face in cell units
  float row0;    // atlas row offset
  float cols;
  if (an.y > an.x && an.y > an.z) {
    if (vN.y < 0.0) discard;
    g = vec2(vObj.x + HALF.x, vObj.z + HALF.z) / ${CELL.toFixed(4)};
    row0 = 0.0; cols = ${COLS_X}.0;
  } else if (an.z > an.x) {
    g = vec2(vObj.x + HALF.x, vObj.y) / ${CELL.toFixed(4)};
    row0 = ${SIDE_ROW0}.0 + (vN.z > 0.0 ? 0.0 : ${ROWS_Y}.0); cols = ${COLS_X}.0;
  } else {
    g = vec2(vObj.z + HALF.z, vObj.y) / ${CELL.toFixed(4)};
    row0 = ${SIDE_ROW0}.0 + (vN.x > 0.0 ? 2.0 : 3.0) * ${ROWS_Y}.0; cols = ${COLS_Z}.0;
  }
  vec2 ci = clamp(floor(g), vec2(0.0), vec2(cols - 1.0, (row0 == 0.0 ? ${COLS_Z}.0 : ${ROWS_Y}.0) - 1.0));
  vec2 c = fract(g);
  gFw = fwidth(g);
  vec4 cell = texture2D(uCells, (vec2(ci.x, ci.y + row0) + 0.5) / vec2(${ATLAS_W}.0, ${ATLAS_H}.0));

  float f = mod(uFrame, ${F});
  float tw = max(eventEnv(f, cell.g, cell.a), eventEnv(f, cell.b, cell.a * 0.7));
  float permanent = step(0.92, cell.r);

  // cell body with a frame line and a small inner pad
  vec3 hh = hash33u(uvec3(uvec2(ci) + 7u, uint(row0) + 3u));
  float body = boxAA(c, vec2(0.1), vec2(0.9));
  float inner = boxAA(c, vec2(0.17), vec2(0.83));
  float frameLine = body - inner;
  float pad = boxAA(c, vec2(0.28 + 0.2 * hh.x, 0.3), vec2(0.72, 0.52 + 0.2 * hh.y));
  float bar = boxAA(c, vec2(0.25, 0.62), vec2(0.25 + 0.45 * hh.z, 0.7));

  vec3 col = cDim * inner * cell.r * 0.6
           + cLine * frameLine * 0.55
           + cLine * (pad * 0.55 + bar * 0.4) * cell.r;
  float lit = max(tw, permanent * 0.8);
  col += cLit * lit * (inner * 0.75 + pad * 0.5);

  // glow at the rims where the view grazes the surface
  vec3 V = normalize(vView);
  float fres = pow(1.0 - abs(dot(normalize(vWorldN), V)), 5.0);
  col += cEdge * fres * (an.y > 0.98 ? 0.0 : 0.7);

  // near the bottom of the sides, fade (sits in the board's glow)
  if (an.y < 0.5) col *= mix(0.55, 1.0, smoothstep(0.0, 0.25, vObj.y));

  gl_FragColor = vec4(col * uGain, 1.0);
}
`;

/* ── Inner glass layer: a fainter, coarser grid slightly inside the block ── */
export const innerFragment = /* glsl */ `
uniform vec3 cGrid;
uniform vec3 cBase;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vWorldN;
varying vec3 vView;
float lineAA(float v, float w) {
  float d = abs(fract(v) - 0.5);
  float fw = fwidth(v);
  float l = 1.0 - smoothstep(0.5 - w - fw, 0.5 - w + fw, d);
  // when lines get thinner than a pixel, fade to their average coverage
  return mix(l, 2.0 * w, smoothstep(0.12, 0.45, fw));
}
void main() {
  vec3 an = abs(vN);
  vec2 g = an.y > 0.5 ? vObj.xz : (an.z > an.x ? vObj.xy : vObj.zy);
  g /= ${(CELL * 2.5).toFixed(4)};
  float grid = max(lineAA(g.x, 0.06), lineAA(g.y, 0.06));
  float fine = max(lineAA(g.x * 4.0, 0.04), lineAA(g.y * 4.0, 0.04));
  // seen through the glass more at a straight-on angle than a grazing one
  float facing = abs(dot(normalize(vWorldN), normalize(vView)));
  vec3 col = cBase + cGrid * (grid * 0.22 + fine * 0.04) * smoothstep(0.1, 0.6, facing);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ── Traces, filaments: ribbons with pulses or flicker schedules ─────────── */
export const ribbonVertex = /* glsl */ `
attribute float aDist;
attribute float aTotal;
attribute float aSide;
attribute float aSeed;
attribute vec4 aPulse;
varying float vDist;
flat varying float vTotal;
varying float vSide;
flat varying float vSeed;
flat varying vec4 vPulse;
uniform float uMirror;
void main() {
  vDist = aDist; vTotal = aTotal; vSide = aSide; vSeed = aSeed; vPulse = aPulse;
  vec3 p = position;
  p.y *= uMirror;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const traceFragment = /* glsl */ `
uniform float uPhase;
uniform float uGain;
uniform vec3 cTrace;
uniform vec3 cPulse;
varying float vDist;
flat varying float vTotal;
varying float vSide;
flat varying float vSeed;
flat varying vec4 vPulse;
float pulseAt(float k, float off) {
  if (k < 0.5) return 0.0;
  const float PL = 0.22;
  // position runs from -PL to total+PL, k whole trips per loop
  float pos = fract(fract(k * uPhase) + off) * (vTotal + 4.0 * PL) - 2.0 * PL;
  float d = (vDist - pos) / PL;
  // bright head, short tail behind it
  return d > 0.0 ? exp(-d * d * 6.0) : exp(-d * d * 0.6);
}
void main() {
  float prof = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  float p = pulseAt(vPulse.x, vPulse.y) + pulseAt(vPulse.z, vPulse.w);
  vec3 col = cTrace * (0.35 + 0.15 * vSeed) + cPulse * p;
  gl_FragColor = vec4(col * prof * uGain, 1.0);
}
`;

export const filamentFragment = /* glsl */ `
${ENV_GLSL}
uniform float uFrame;
uniform float uGain;
uniform vec3 cSpark;
varying float vDist;
flat varying float vTotal;
varying float vSide;
flat varying float vSeed;
flat varying vec4 vPulse; // here: start1, dur1, start2, dur2
${NOISE_GLSL}
void main() {
  float f = mod(uFrame, ${F});
  float on = max(eventEnv(f, vPulse.x, vPulse.y), eventEnv(f, vPulse.z, vPulse.w));
  if (on <= 0.0) discard;
  // per-frame flicker from a hash of (filament, frame % 600)
  float fl = hash33u(uvec3(uint(vSeed * 100000.0), uint(f), 5u)).x;
  float prof = 1.0 - smoothstep(0.3, 1.0, abs(vSide));
  float taper = smoothstep(0.0, 0.08, vDist) * smoothstep(vTotal, vTotal - 0.12, vDist);
  gl_FragColor = vec4(cSpark * on * (0.5 + 0.8 * fl) * prof * taper * uGain, 1.0);
}
`;

/* ── Sparks ─────────────────────────────────────────────────────────────── */
export const sparkVertex = /* glsl */ `
attribute vec4 aSched;
uniform float uFrame;
uniform float uPx;
varying float vOn;
${ENV_GLSL}
void main() {
  float f = mod(uFrame, ${F});
  vOn = max(eventEnv(f, aSched.x, aSched.y), eventEnv(f, aSched.z, aSched.y * 0.6)) * aSched.w;
  gl_PointSize = vOn > 0.0 ? 3.2 * uPx : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const sparkFragment = /* glsl */ `
uniform vec3 cSpark;
varying float vOn;
void main() {
  if (vOn <= 0.0) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float a = exp(-dot(p, p) * 4.0);
  gl_FragColor = vec4(cSpark * vOn * a, 1.0);
}
`;

/* ── Board: dark, slightly glossy, catches the chip's glow ──────────────── */
export const boardVertex = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const boardFragment = /* glsl */ `
${NOISE_GLSL}
uniform vec3 cBoard;
uniform vec3 cGlow;
uniform vec3 cGrid;
varying vec3 vW;
const vec2 HALF = vec2(${(CHIP.w / 2).toFixed(4)}, ${(CHIP.d / 2).toFixed(4)});
void main() {
  vec2 p = vW.xz;
  vec2 q = abs(p) - HALF;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);  // distance to chip footprint
  float glow = exp(-max(d, 0.0) * 2.2) * 0.22 + exp(-max(d, 0.0) * 0.45) * 0.035;
  // fine pcb texture
  // cheap static speckle (hash per 1/40-unit cell) instead of noise
  float n = hash33u(uvec3(uvec2(ivec2(floor(p * 40.0)) + 100000), 9u)).x;
  vec2 gg = abs(fract(p / 0.3) - 0.5);
  float grid = 1.0 - smoothstep(0.46, 0.5, max(gg.x, gg.y));
  vec3 col = cBoard * (0.8 + 0.4 * n) + cGlow * glow + cGrid * grid * 0.012 * (0.3 + glow);
  gl_FragColor = vec4(col, 1.0);
}
`;
