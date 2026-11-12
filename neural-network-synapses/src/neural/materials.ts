import * as THREE from "three";
import { Palette } from "./palettes";

const COMMON = /* glsl */ `
uniform vec3 uBody;
uniform vec3 uRim;
uniform vec3 uSpec;
uniform vec3 uFog;
uniform float uFogDensity;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
                 mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
                 mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// Procedural studio environment: a soft top light, two strip lights and a
// little streaky break-up. Returns reflected light intensity.
float studio(vec3 R) {
  float e = smoothstep(0.15, 1.0, R.y) * 0.5;
  e += pow(max(dot(R, normalize(vec3(0.55, 0.62, 0.56))), 0.0), 22.0) * 2.4;
  e += pow(max(dot(R, normalize(vec3(-0.7, 0.25, 0.66))), 0.0), 70.0) * 3.2;
  e += pow(max(dot(R, normalize(vec3(0.1, -0.8, -0.58))), 0.0), 30.0) * 0.9;
  float streak = sin(R.x * 9.0 + R.z * 6.0) * sin(R.y * 7.0 - R.z * 4.0);
  e += smoothstep(0.55, 1.0, streak) * 0.35;
  return e;
}
vec3 applyFog(vec3 c, float dist) {
  float f = exp(-dist * uFogDensity);
  return mix(uFog, c, f);
}`;

const VERT = /* glsl */ `
in float aRadius;
uniform float uMinWidth; // minimum on-screen radius, world units per unit distance
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out float vFade;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vFade = 1.0;
#ifdef THIN_GUARD
  // Hair-thin dendrites are widened to a constant sub-pixel-safe width and
  // dimmed instead, which removes crawling/dashed aliasing in the distance.
  float minR = length(cameraPosition - w.xyz) * uMinWidth;
  if (aRadius < minR) {
    w.xyz += n * (minR - aRadius);
    vFade = clamp(aRadius / minR, 0.0, 1.0);
  }
#endif
  vWorld = w.xyz;
  vLocal = position;
  vNormal = n;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** Glassy dendrite: dark translucent core, bright fresnel rim, hard speculars. */
const TUBE_FRAG = /* glsl */ `
precision highp float;
${COMMON}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in float vFade;
out vec4 outColor;
void main() {
  vec3 N = normalize(vNormal);
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float ndv = abs(dot(N, V));
  float fres = pow(1.0 - ndv, 2.6);
  vec3 R = reflect(-V, N);
  float env = studio(R);
  float wrap = 0.5 + 0.5 * dot(N, normalize(vec3(0.3, 0.8, 0.45)));
  // Glass on black: a dark, clear core, a thin bright silhouette line, a faint
  // inner caustic band and hard, wet highlights.
  // Wet, milky glass: a translucent grey body, a bright silhouette line and
  // strong blotchy highlights that run along the membrane.
  vec3 c = uBody * (0.7 + 0.9 * wrap) * (0.7 + 0.6 * vnoise(vWorld * 1.7));
  c += uRim * pow(1.0 - ndv, 3.6) * 1.25;
  c += uRim * pow(1.0 - ndv, 1.5) * 0.22;
  float band = (ndv - 0.45) / 0.12;
  c += uRim * exp(-band * band) * 0.16;
  float blotch = vnoise(vWorld * 2.2) * 0.6 + vnoise(vWorld * 6.0) * 0.4;
  float wet = smoothstep(0.38, 0.66, blotch);
  mat3 camRot = mat3(inverse(viewMatrix));
  vec3 L1 = normalize(camRot * vec3(-0.5, 0.62, 0.6));
  vec3 L2 = normalize(camRot * vec3(0.66, -0.2, 0.72));
  float g1 = pow(max(dot(N, L1), 0.0), 14.0);
  float g2 = pow(max(dot(N, L2), 0.0), 60.0);
  c += uSpec * env * (0.08 + 0.92 * fres) * (0.4 + 1.4 * wet);
  c += uSpec * (g1 * 2.6 + g2 * 2.6) * (0.25 + 2.2 * wet);
  c = mix(uBody * 1.2 + uRim * 0.16, c, vFade) * mix(0.45, 1.0, vFade);
  outColor = vec4(applyFog(c, dist), 1.0);
}`;

/** Cell body: thin glass membrane, mostly transparent in the middle. */
const SOMA_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform float uFlash;
uniform vec3 uSignal;
uniform float uBack;
uniform float uInner;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in float vFade;
out vec4 outColor;

void main() {
  vec3 N = normalize(vNormal);
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  if (uBack > 0.5) N = -N;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.4);
  vec3 R = reflect(-V, N);
  float env = studio(R);
  float cloud = vnoise(vLocal * 3.2) * 0.6 + vnoise(vLocal * 7.5) * 0.4;
  vec3 c;
  float a;
  if (uInner > 0.5) {
    // Nucleus: a faint cloudy sphere seen through the membrane.
    c = uRim * (0.04 + 0.35 * fres) + uBody * cloud * 1.2;
    a = 0.06 + 0.4 * fres;
  } else if (uBack > 0.5) {
    // Far wall of the membrane, seen through the cell.
    c = uRim * (0.1 + fres * 0.55) + uSpec * env * 0.22 + uBody * cloud * 0.5;
    a = 0.3 + 0.45 * fres;
  } else {
    c = uBody * (0.3 + 0.8 * cloud) + uRim * (fres * 1.2 + pow(1.0 - ndv, 6.0) * 0.8) + uSpec * env * (0.35 + 0.65 * fres) * 1.3;
    a = clamp(0.2 + 0.85 * fres + env * 0.35 + cloud * 0.08, 0.0, 1.0);
  }
  // Firing: the membrane lights up in the impulse colour.
  float spots = smoothstep(0.5, 0.85, vnoise(vLocal * 4.4 + 3.7));
  c += uSignal * uFlash * (0.12 + 2.2 * fres + 1.3 * spots * (0.3 + fres));
  a = clamp(a + uFlash * (0.1 + spots * 0.3), 0.0, 1.0);
  outColor = vec4(applyFog(c, dist), a);
}`;

function paletteUniforms(p: Palette) {
  return {
    uBody: { value: new THREE.Vector3(...p.body) },
    uRim: { value: new THREE.Vector3(...p.rim) },
    uSpec: { value: new THREE.Vector3(...p.spec) },
    uFog: { value: new THREE.Vector3(...p.fog) },
    uFogDensity: { value: 0.03 },
    uMinWidth: { value: 0.0009 },
  };
}

export function makeTubeMaterial(p: Palette) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: TUBE_FRAG,
    uniforms: paletteUniforms(p),
    defines: { THIN_GUARD: 1 },
  });
}

export type SomaLayer = "back" | "inner" | "front";

export function makeSomaMaterial(p: Palette, layer: SomaLayer) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: SOMA_FRAG,
    uniforms: {
      ...paletteUniforms(p),
      uFlash: { value: 0 },
      uSignal: { value: new THREE.Vector3(...p.signal) },
      uBack: { value: layer === "back" ? 1 : 0 },
      uInner: { value: layer === "inner" ? 1 : 0 },
    },
    transparent: true,
    depthWrite: layer === "front",
    side: layer === "back" ? THREE.BackSide : THREE.FrontSide,
  });
}

/**
 * Impulse sprites, drawn after depth of field as instanced quads. Each sprite
 * computes its own circle of confusion, so out-of-focus impulses turn into
 * large soft bokeh discs exactly like the reference. Occlusion is resolved
 * against the scene depth buffer with a soft multi-tap test (no popping).
 */
const SIGNAL_VERT = /* glsl */ `
precision highp float;
in vec3 iPos;
in vec2 iData; // x = intensity, y = world radius
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
uniform float uProj;   // projection scale: ndc-y per (world unit / distance)
uniform float uAspect;
uniform float uFogDensity;
out vec2 vQ;
out float vInt;
out float vSoft;

float sceneDist(vec2 uv) {
  float d = texture(tDepth, uv).x;
  return (uNear * uFar) / (uFar - d * (uFar - uNear));
}
void main() {
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  float dist = max(-mv.z, 0.001);
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  // Radii as a fraction of frame height.
  float core = iData.y * uProj / dist * 0.5;
  float coc = min(uAperture * abs(1.0 / uFocus - 1.0 / dist), uMaxCoc);
  coc *= dist > uFocus ? 0.45 : 0.5;
  float rad = core + coc;
  // Energy spreads over the bokeh disc (softened so discs stay readable).
  float spread = pow(core * core / (rad * rad), 0.62);
  // Soft occlusion against the opaque scene.
  vec2 uv = ndc * 0.5 + 0.5;
  vec2 o = vec2(rad / uAspect, rad) * 0.7;
  float vis = 0.0;
  float bias = 0.12 + dist * 0.004;
  vis += step(dist - bias, sceneDist(uv));
  vis += step(dist - bias, sceneDist(uv + vec2(o.x, 0.0)));
  vis += step(dist - bias, sceneDist(uv - vec2(o.x, 0.0)));
  vis += step(dist - bias, sceneDist(uv + vec2(0.0, o.y)));
  vis += step(dist - bias, sceneDist(uv - vec2(0.0, o.y)));
  vis *= 0.2;
  float fog = exp(-dist * uFogDensity * 0.8);
  vInt = iData.x * spread * (0.12 + 0.88 * vis) * fog;
  vSoft = clamp(coc / max(core, 1e-5), 0.0, 8.0);
  // Quad covers the disc plus its glow halo.
  float ext = rad * 3.2;
  vQ = position.xy * 3.2;
  vec2 p = ndc + position.xy * vec2(ext / uAspect, ext) * 2.0;
  bool visible = clip.w > 0.0 && iData.x > 0.002 && mv.z < -uNear;
  gl_Position = visible ? vec4(p, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const SIGNAL_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uSignal;
uniform vec3 uSignalCore;
in vec2 vQ;
in float vInt;
in float vSoft;
out vec4 outColor;
void main() {
  float q = length(vQ);
  // In focus: hot core with a gaussian falloff. Defocused: flat-ish disc.
  float edge = mix(0.8, 0.55, clamp(vSoft * 0.25, 0.0, 1.0));
  float disc = smoothstep(1.0, 1.0 - edge, q);
  float hot = exp(-q * q * 3.5) * (1.0 - clamp(vSoft * 0.3, 0.0, 0.85));
  float halo = exp(-q * q * 0.75) * 0.3;
  vec3 c = uSignal * (disc * 3.0 + halo) + uSignalCore * hot * 1.6;
  outColor = vec4(c * vInt, 1.0);
}`;

export function makeSignalMaterial(p: Palette, depth: THREE.DepthTexture) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: SIGNAL_VERT,
    fragmentShader: SIGNAL_FRAG,
    uniforms: {
      tDepth: { value: depth },
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uFocus: { value: 10 },
      uAperture: { value: 0 },
      uMaxCoc: { value: 0.03 },
      uProj: { value: 1 },
      uAspect: { value: 16 / 9 },
      uFogDensity: { value: 0.03 },
      uSignal: { value: new THREE.Vector3(...p.signal) },
      uSignalCore: { value: new THREE.Vector3(...p.signalCore) },
    },
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
}
