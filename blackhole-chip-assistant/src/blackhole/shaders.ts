import { NOISE_GLSL } from "../common/glsl";

/* ── Disc ────────────────────────────────────────────────────────────────
 * A flat plane. The spiral is noise laid out along logarithmic spiral curves:
 * phi = theta - TIGHT * log(r) is constant along an arm, so noise sampled in
 * (cos phi, sin phi) space gets sheared into streaks that follow the arms.
 *
 * Motion: the whole pattern turns rigidly by uRot (a whole number of turns
 * per loop), and the turbulence evolves by walking the noise around a time
 * circle (uLoop). No radius-dependent spin, so the loop closes exactly.
 */
export const discVertex = /* glsl */ `
varying vec2 vP;
void main() {
  vP = (uv - 0.5) * 2.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const discFragment = /* glsl */ `
${NOISE_GLSL}
#define ARMS 2.0
#define TIGHT 3.4
uniform float uRot;
uniform vec2 uLoop;
uniform float uPhase;
uniform float uSeed;
uniform float uGain;
uniform float uCoreGain;
uniform vec3 cCore;
uniform vec3 cInner;
uniform vec3 cMid;
uniform vec3 cOuter;
varying vec2 vP;

vec3 ramp(float r) {
  vec3 c = mix(cCore, cInner, smoothstep(0.02, 0.16, r));
  c = mix(c, cMid, smoothstep(0.14, 0.45, r));
  c = mix(c, cOuter, smoothstep(0.42, 0.9, r));
  return c;
}

void main() {
  float r = length(vP);
  if (r > 1.0) discard;
  float cr = cos(uRot), sr = sin(uRot);
  vec2 q = mat2(cr, sr, -sr, cr) * vP;            // rigidly rotating frame
  float th = atan(q.y, q.x);
  float lr = log(max(r, 0.002));
  float phi = th - TIGHT * lr;                      // constant along an arm

  // unwound-spiral space: across-arm = around, along-arm = (slow) outward
  vec2 s = vec2(cos(phi), sin(phi)) * (0.45 + 0.55 * r);

#ifdef LITE
  // secondary (thickness) layers: fewer octaves, same structure
  float warp = fbmLoop(q * 1.8 + uSeed, uLoop * 0.55, 1);
  float arm = 0.5 + 0.5 * cos(ARMS * phi + warp * 3.2);
  arm = pow(smoothstep(0.05, 0.95, arm), 1.4);
  float gas = fbmLoop(q * 3.4 + s * 1.2 + vec2(uSeed * 1.7, -uSeed), uLoop, 3);
  float gas01 = clamp(0.5 + 0.8 * gas, 0.0, 1.0);
  float lanes = 1.0;
#else
  float warp = fbmLoop(q * 1.8 + uSeed, uLoop * 0.55, 2);
  float arm = 0.5 + 0.5 * cos(ARMS * phi + warp * 3.2);
  arm = pow(smoothstep(0.05, 0.95, arm), 1.4);
  float gas = fbmLoop(q * 3.4 + s * 1.2 + vec2(uSeed * 1.7, -uSeed), uLoop, 4);
  float gas01 = clamp(0.5 + 0.8 * gas, 0.0, 1.0);
  float fine = fbmLoop(s * 4.5 + q * 3.0 - uSeed, uLoop * 1.3, 3);
  float lanes = smoothstep(-0.25, 0.3, fine);       // dark dust lanes
#endif

  float density = mix(0.04, 1.0, arm) * mix(0.15, 1.0, gas01) * mix(0.25, 1.0, lanes);

  float falloff = 1.1 * exp(-r * 4.6) + 0.22 * exp(-r * 1.6);
  falloff *= smoothstep(1.0, 0.45, r);
  // inner disc: bright, nearly uniform; the arms take over further out
  float innerMix = smoothstep(0.05, 0.24, r);
  float body = mix(1.0, density * 1.25, innerMix);
  vec3 col = ramp(r) * body * falloff;

  // blown-out core
  float core = exp(-pow(r / 0.055, 1.6)) * 9.0 + exp(-pow(r / 0.12, 1.4)) * 1.4;
  col += cCore * core * uCoreGain;

  // sparkling specks along the arms, in the rotating frame
  const float CELL = 0.011;
  vec2 g = q / CELL;
  vec2 gi = floor(g);
  vec3 h = hash33u(uvec3(uvec2(ivec2(gi) + 4096), uint(uSeed * 100.0) + 11u));
  if (h.x < 0.085) {
    vec2 off = vec2(0.2) + 0.6 * vec2(h.y, h.z);
    float d = length(g - gi - off) * CELL;
    float k = floor(h.y * 4.0) + 1.0;                // whole twinkle cycles per loop
    float tw = 0.35 + 0.65 * (0.5 + 0.5 * sin(6.2831853 * fract(fract(k * uPhase) + h.z)));
    float speck = exp(-pow(d / 0.0018, 2.0)) * tw;
    float where = arm * gas01 * smoothstep(0.08, 0.3, r) * smoothstep(1.0, 0.55, r);
    col += mix(cInner, vec3(1.0), 0.5) * speck * where * where * 1.6;
  }

  gl_FragColor = vec4(col * uGain, 1.0);
}
`;

/* ── Jet ─────────────────────────────────────────────────────────────────
 * A soft beam on a trapezoid that always turns to face the camera (around
 * the vertical axis). Streaks are noise that is periodic in height (sampled
 * around a circle as a function of y) and scrolled up by a whole number of
 * repeats per loop.
 */
export const jetVertex = /* glsl */ `
uniform float uHeight;
uniform float uDir;
uniform float uW0;
uniform float uSpread;
varying vec2 vL;
void main() {
  vec3 toCam = cameraPosition;
  toCam.y = 0.0;
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  float y = uv.y * uHeight;
  float halfW = (uW0 + y * uSpread) * 2.6;
  float x = (uv.x - 0.5) * 2.0 * halfW;
  vL = vec2(x, y);
  vec3 wp = right * x + vec3(0.0, uDir * y, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

export const jetFragment = /* glsl */ `
${NOISE_GLSL}
uniform float uPhase;
uniform float uHeight;
uniform float uW0;
uniform float uSpread;
uniform float uGain;
uniform float uFlare;
uniform float uScroll;
uniform float uRep;
uniform float uSeed;
uniform vec3 uColor;
varying vec2 vL;

void main() {
  float w = uW0 + vL.y * uSpread;
  float xn = vL.x / w;
  float prof = exp(-xn * xn * 2.0);
  float a1 = 6.2831853 * (vL.y / uRep - fract(uScroll * uPhase));
  float a2 = 6.2831853 * (vL.y / (uRep * 0.5) - fract(2.0 * uScroll * uPhase));
  float n1 = snoise(vec4(xn * 1.6 + uSeed, uSeed * 0.37, cos(a1) * 0.42, sin(a1) * 0.42));
  float n2 = snoise(vec4(xn * 3.4 - uSeed, 3.1 + uSeed, cos(a2) * 0.32, sin(a2) * 0.32));
  float streak = clamp(0.62 + 0.42 * n1 + 0.22 * n2, 0.0, 1.6);
  float along = exp(-vL.y * 0.028) * smoothstep(uHeight, uHeight * 0.55, vL.y);
  float base = smoothstep(0.0, 0.35, vL.y);
  float flare = uFlare * exp(-vL.y / 1.1) * exp(-xn * xn * 5.0) * base;
  vec3 col = uColor * (prof * streak * along * uGain * mix(0.6, 1.0, base) + flare);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ── Glow sprite (core + wide halo) ────────────────────────────────────── */
export const spriteVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = (uv - 0.5) * 2.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const spriteFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHaloColor;
uniform float uCore;
uniform float uHalo;
varying vec2 vUv;
void main() {
  float d = length(vUv);
  float c = uCore * (exp(-pow(d / 0.02, 2.0)) * 5.0 + exp(-pow(d / 0.06, 1.6)) * 1.2);
  float h = uHalo * (exp(-pow(d / 0.25, 1.4)) * 0.6 + exp(-d * d / 0.18) * 0.15) * smoothstep(1.0, 0.6, d);
  gl_FragColor = vec4(uColor * c + uHaloColor * h, 1.0);
}
`;

/* ── Stars ─────────────────────────────────────────────────────────────── */
export const starVertex = /* glsl */ `
attribute float aSize;
attribute float aBright;
uniform float uPx;
varying float vBright;
void main() {
  vBright = aBright;
  gl_PointSize = aSize * uPx;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const starFragment = /* glsl */ `
uniform vec3 uColor;
varying float vBright;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  float a = exp(-d * 5.0) * smoothstep(1.0, 0.7, d);
  gl_FragColor = vec4(uColor * vBright * a, 1.0);
}
`;
