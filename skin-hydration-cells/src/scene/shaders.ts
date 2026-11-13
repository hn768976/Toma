/**
 * GLSL for the hydration scene. Colours are authored in display (sRGB-ish)
 * space and decoded to linear at the end of each fragment shader, the post
 * chain encodes back to sRGB.
 */

const TO_LIN = /* glsl */ `
vec3 toLin(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
`;

// ---------------------------------------------------------------- background
export const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}`;

export const BG_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uAspect;
uniform vec2 uCenter;
uniform float uWarm;
uniform float uTime;
${TO_LIN}
void main() {
  vec2 p = vUv - uCenter;
  p.x *= uAspect;
  // slightly elongated along the diagonal of the layers
  float cs = 0.8660254, sn = -0.5;
  vec2 r = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
  float d = length(r * vec2(0.82, 1.12));
  vec3 core = vec3(0.945, 0.992, 1.0);
  vec3 mid = vec3(0.71, 0.85, 0.935);
  vec3 outer = vec3(0.545, 0.55, 0.68);
  vec3 col = mix(core, mid, smoothstep(0.12, 0.52, d));
  col = mix(col, outer, smoothstep(0.4, 1.05, d));
  // warm peach light leak, top-left, towards the end
  vec2 w = vUv - vec2(0.0, 1.0);
  w.x *= uAspect;
  col = mix(col, vec3(1.0, 0.86, 0.76), uWarm * 0.75 * smoothstep(0.55, 0.0, length(w)));
  gl_FragColor = vec4(toLin(col), 1.0);
}`;

// ---------------------------------------------------------------------- cells
export const CELL_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute vec4 aRnd;
attribute float aLayer;
uniform vec3 uImpact;
uniform vec3 uShape;
uniform vec3 uTone;
uniform float uFrame;
varying vec3 vN;
varying vec3 vW;
varying float vShape;
varying float vTone;
varying float vRnd;
varying float vSide;
void main() {
  float d = length(aOffset.xz - uImpact.xz) + (aRnd.x - 0.5) * 2.6;
  float waveS = aLayer < 0.5 ? uShape.x : (aLayer < 1.5 ? uShape.y : uShape.z);
  float waveT = aLayer < 0.5 ? uTone.x : (aLayer < 1.5 ? uTone.y : uTone.z);
  float shape = smoothstep(0.0, 1.0, (waveS - d) / 4.5);
  float tone = smoothstep(0.0, 1.0, (waveT - d) / 9.0);
  tone = max(tone, shape);
  // little elastic overshoot while a cell inflates
  float pop = 1.0 + 0.13 * sin(shape * 3.14159);
  float breathe = 1.0 + 0.015 * sin(uFrame * 0.09 + aRnd.y * 6.283) * shape;

  vec3 dryS = vec3(0.50, 0.20, 0.46) * (0.96 + 0.08 * aRnd.z);
  vec3 wetS = vec3(0.575 + 0.02 * aRnd.w);
  vec3 s = mix(dryS, wetS * pop * breathe, shape);

  // dry cells are pill shaped: flatten the poles of the sphere a little
  vec3 p = position;
  float pill = (1.0 - shape) * 0.45;
  p.y = sign(p.y) * mix(abs(p.y), pow(abs(p.y), 0.55), pill);
  vec3 n = normal / s;
  p *= s;

  // scale-like tilt for dry cells; the top layer leans the other way
  float side = aLayer < 0.5 ? -1.0 : 1.0;
  float tilt = side * (aLayer < 0.5 ? 0.12 : 0.24 + 0.12 * (aRnd.y - 0.5)) * (1.0 - shape);
  float c = cos(tilt), sn = sin(tilt);
  p.yz = vec2(c * p.y - sn * p.z, sn * p.y + c * p.z);
  n.yz = vec2(c * n.y - sn * n.z, sn * n.y + c * n.z);

  vec3 jitter = vec3((aRnd.z - 0.5) * 0.08, (aRnd.w - 0.5) * 0.05 * (1.0 - shape), (aRnd.x - 0.5) * 0.08);
  vec3 world = aOffset + jitter + p;
  // hydrated cells are plump: lift them so the layer keeps a flat inner face
  world.y += -side * 0.0 * shape;

  vN = normalize(n);
  vW = world;
  vShape = shape;
  vTone = tone;
  vRnd = aRnd.y;
  vSide = side;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

export const CELL_FRAG = /* glsl */ `
uniform vec3 uLightDir;
uniform vec3 uFog;
varying vec3 vN;
varying vec3 vW;
varying float vShape;
varying float vTone;
varying float vRnd;
varying float vSide;
${TO_LIN}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.0) { N = -N; }
  vec3 L = normalize(uLightDir);
  float f = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - f, 3.0);
  float nl = dot(N, L);
  float hl = nl * 0.5 + 0.5;
  vec3 Hh = normalize(L + V);
  float spec = pow(max(dot(N, Hh), 0.0), 48.0);
  float sheen = pow(f, 2.5);

  // --- dry: peach skin cell with a glossy amber underside ---
  vec3 peach = vec3(0.97, 0.74, 0.63);
  vec3 shade = vec3(0.58, 0.37, 0.32);
  vec3 dry = mix(shade, peach, smoothstep(0.1, 0.95, hl));
  float under = pow(clamp(-nl * 0.9 + 0.1, 0.0, 1.0), 1.4) * (0.35 + 0.65 * (1.0 - f));
  dry = mix(dry, vec3(0.88, 0.56, 0.22), under * (1.0 - f * 0.6) * 0.8);
  dry += vec3(1.0, 0.82, 0.45) * pow(clamp(-nl, 0.0, 1.0), 6.0) * (1.0 - f) * 0.5;
  float spec2 = pow(max(dot(N, normalize(normalize(vec3(-0.25, 0.75, 0.6)) + V)), 0.0), 26.0);
  dry += vec3(1.0, 0.95, 0.92) * (sheen * 0.16 + spec * 0.55 + spec2 * 0.5);

  // --- pearl: the cell loses its dry colour before it swells ---
  vec3 pearl = mix(vec3(0.60, 0.56, 0.63), vec3(0.945, 0.925, 0.90), smoothstep(0.05, 0.9, hl));
  pearl = mix(pearl, vec3(0.84, 0.58, 0.28), under * 0.8);
  pearl = mix(pearl, vec3(0.72, 0.93, 0.96), 0.22 * sheen);
  pearl += vec3(1.0) * (spec * 0.4 + sheen * 0.08 + spec2 * 0.25);

  // --- hydrated: luminous aqua pearl ---
  vec3 rim = mix(vec3(0.90, 0.875, 0.905), vec3(0.955, 0.94, 0.95), hl);
  vec3 aqua = vec3(0.50, 0.885, 0.93);
  vec3 wet = mix(rim, aqua, pow(f, 1.7) * 0.9);
  wet = mix(wet, vec3(0.86, 0.995, 1.0), pow(f, 6.0) * 0.6);
  wet = mix(wet, vec3(0.80, 0.84, 0.90), (1.0 - hl) * 0.25 * (1.0 - f));
  wet += vec3(0.07, 0.02, 0.05) * fres;            // faint rosy edge
  wet += vec3(1.0) * spec * 0.25;

  vec3 col = mix(dry, pearl, vTone);
  col = mix(col, wet, smoothstep(0.15, 0.95, vShape));
  col *= 0.97 + 0.06 * vRnd;

  // aerial haze: distant cells dissolve into the bright background
  float dist = length(cameraPosition - vW);
  float fog = smoothstep(16.0, 50.0, dist);
  col = mix(col, uFog, fog * 0.42);
  gl_FragColor = vec4(toLin(col), 1.0);
}`;

// ------------------------------------------------------------------- membrane
export const MEMBRANE_VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const MEMBRANE_FRAG = /* glsl */ `
uniform vec3 uImpact;
uniform float uFade;
uniform float uPulse;
uniform float uRipple;
varying vec3 vW;
varying vec3 vN;
${TO_LIN}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec3 V = normalize(cameraPosition - vW);
  vec3 N = normalize(vN);
  float top = step(0.5, N.y);
  float bottom = step(0.5, -N.y);
  float edge = 1.0 - top - bottom;
  float f = abs(dot(N, V));
  // long soft streaks running along the layer edge
  float streak = noise(vec2(vW.x * 0.18, vW.z * 2.2)) * 0.6 + noise(vec2(vW.x * 0.5, vW.z * 6.0)) * 0.4;
  vec3 col = mix(vec3(0.99, 0.84, 0.70), vec3(1.0, 0.915, 0.83), streak);
  col = mix(col, vec3(1.0, 0.95, 0.9), pow(1.0 - f, 2.0) * 0.6);
  // tan rim line on the cut edge
  col = mix(col, vec3(0.86, 0.60, 0.40), edge);
  // underside: fine woven grid
  vec2 g = abs(fract(vW.xz * 4.0) - 0.5);
  float grid = smoothstep(0.34, 0.5, max(g.x, g.y));
  vec3 under = mix(vec3(0.97, 0.80, 0.72), vec3(0.80, 0.56, 0.47), grid * 0.6);
  col = mix(col, under, bottom);
  // wet impact zone: white-aqua glow and an expanding ripple
  float d = length(vW.xz - uImpact.xz);
  float wetK = uPulse * smoothstep(5.5, 0.0, d);
  float ring = smoothstep(0.5, 0.0, abs(d - uRipple * 9.0)) * (1.0 - uRipple) * step(0.001, uRipple);
  col = mix(col, vec3(0.90, 0.985, 1.0), clamp(wetK * 0.95 + ring * 0.35, 0.0, 1.0) * (1.0 - bottom * 0.4));
  // hydration: dissolves into pale aqua and disappears
  col = mix(col, vec3(0.93, 0.93, 0.93), uFade * 0.5);
  float a = mix(0.9, 0.97, edge);
  a *= mix(1.0, 0.82, bottom);
  // dissolve from the impact point outwards
  float dissolve = smoothstep(0.0, 1.0, uFade * 1.25 - d * 0.006);
  a *= 1.0 - dissolve;
  // far end of the sheet melts into the backdrop
  float dist = length(cameraPosition - vW);
  
  if (a < 0.004) discard;
  gl_FragColor = vec4(toLin(col), a);
}`;

// ----------------------------------------------------------------------- drop
export const DROP_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
varying vec3 vLocal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vLocal = position;
  vN = normalize(mat3(transpose(inverse(modelMatrix))) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const DROP_FRAG = /* glsl */ `
uniform float uAlpha;
uniform vec3 uLightDir;
varying vec3 vN;
varying vec3 vW;
varying vec3 vLocal;
${TO_LIN}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float f = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - f, 2.2);
  vec3 L = normalize(uLightDir);
  vec3 Hh = normalize(L + V);
  float spec = pow(max(dot(N, Hh), 0.0), 90.0);
  // refraction look: light gathers on the side opposite to the key light
  float caustic = pow(clamp(-dot(N, L) * 0.5 + 0.55, 0.0, 1.0), 2.0);
  vec3 deep = vec3(0.22, 0.62, 0.86);
  vec3 light = vec3(0.56, 0.86, 0.96);
  vec3 col = mix(deep, light, clamp(f * 0.75 + caustic * 0.45, 0.0, 1.0));
  // darker band just inside the silhouette, bright thin rim outside
  col = mix(col, vec3(0.22, 0.60, 0.84), smoothstep(0.45, 0.85, fres) * 0.55);
  col = mix(col, vec3(0.93, 0.99, 1.0), smoothstep(0.86, 1.0, fres) * 0.8);
  // window-like soft highlight on the upper-left flank
  float hi = smoothstep(0.80, 0.97, dot(N, normalize(vec3(-0.55, 0.45, 0.7) + V * 0.4)));
  col = mix(col, vec3(1.0), hi * 0.55 + spec * 0.9);
  float a = mix(0.80, 0.97, fres) * uAlpha;
  gl_FragColor = vec4(toLin(col), a);
}`;

// -------------------------------------------------------------------- bubbles
export const BUBBLE_VERT = /* glsl */ `
attribute float aAlpha;
varying vec3 vN;
varying vec3 vW;
varying float vAlpha;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(instanceMatrix) * normal);
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const BUBBLE_FRAG = /* glsl */ `
uniform vec3 uLightDir;
varying vec3 vN;
varying vec3 vW;
varying float vAlpha;
${TO_LIN}
void main() {
  if (vAlpha < 0.01) discard;
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float f = clamp(dot(N, V), 0.0, 1.0);
  float fres = 1.0 - f;
  vec3 L = normalize(uLightDir);
  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 70.0);
  float spec2 = pow(max(dot(N, normalize(-L * vec3(1.0, 1.0, -1.0) + V)), 0.0), 30.0);
  // thin-walled bubble: clear centre, saturated aqua wall, dark outline
  float wall = smoothstep(0.30, 0.82, fres);
  float outline = smoothstep(0.80, 0.97, fres);
  vec3 col = mix(vec3(0.62, 0.92, 0.99), vec3(0.20, 0.70, 0.88), wall);
  col = mix(col, vec3(0.13, 0.48, 0.68), outline * 0.85);
  col = mix(col, vec3(1.0), clamp(spec + spec2 * 0.55, 0.0, 1.0));
  float a = mix(0.42, 0.97, wall);
  a = max(a, clamp(spec + spec2 * 0.5, 0.0, 1.0));
  gl_FragColor = vec4(toLin(col), a * vAlpha);
}`;

// ----------------------------------------------------------------------- glow
export const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const GLOW_FRAG = /* glsl */ `
uniform float uIntensity;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float g = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
  g += pow(clamp(1.0 - d * 2.6, 0.0, 1.0), 2.0) * 0.8;
  gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
}`;
