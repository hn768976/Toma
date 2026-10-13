import * as THREE from "three";
import { defaultPost } from "../engine/post";
import { FULLSCREEN_VERT, fullscreenMesh, lin } from "../engine/fullscreen";
import { LookFactory } from "../engine/Stage";
import { TAU, phaseOf } from "../engine/rng";

// Look 4 — a full-screen liquid-chrome relief. No geometry, no camera move:
// pass 1 evaluates a loopable domain-warped height field at render resolution,
// pass 2 shades it (normals, holographic environment, thin film, specular).

export type HoloParams = {
  /** Five environment bands, dark → bright. */
  bands: [string, string, string, string, string];
  /** Colour of flat, untilted areas. */
  base: string;
};

// Simplex 4D noise — Stefan Gustavson / Ashima Arts (MIT).
const SNOISE4 = /* glsl */ `
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
float permute(float x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec4 grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p, s;
  p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www;
  return p;
}
#define F4 0.309016994374947451
float snoise(vec4 v) {
  const vec4 C = vec4(0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);
  vec4 i = floor(v + dot(v, vec4(F4)));
  vec4 x0 = v - i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step(x0.yzw, x0.xxx);
  vec3 isYZ = step(x0.zww, x0.yyz);
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp(i0, 0.0, 1.0);
  vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
  vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;
  i = mod289(i);
  float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute(permute(permute(permute(
      i.w + vec4(i1.w, i2.w, i3.w, 1.0)) + i.z + vec4(i1.z, i2.z, i3.z, 1.0))
      + i.y + vec4(i1.y, i2.y, i3.y, 1.0)) + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
  vec4 ip = vec4(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);
  vec4 p0 = grad4(j0, ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4, p4));
  vec3 m0 = max(0.6 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3, x3), dot(x4, x4)), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * (dot(m0 * m0, vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2)))
               + dot(m1 * m1, vec2(dot(p3, x3), dot(p4, x4))));
}`;

const HEIGHT_FRAG = /* glsl */ `
precision highp float;
${SNOISE4}
uniform vec2 uRes;
uniform vec2 uCircle;   // (cos θ, sin θ), θ = 2π·frame/600
uniform float uScale;
uniform float uStripes;
uniform float uWarp;
uniform float uWarpFreq;
// radius of the time circle in noise space: sets how fast the relief morphs
uniform float uTR;
uniform float uDrift;
uniform float uGRef;
uniform float uEven;
varying vec2 vUv;

// time enters only as a point on a circle in two extra dimensions → exact loop
float fbm(vec2 p, float r, float seed, int oct) {
  float a = 0.5, s = 0.0;
  vec2 t = uCircle * r;
  mat2 R = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    if (i >= oct) break;
    s += a * snoise(vec4(p, t + seed));
    p = R * p * 2.03 + 11.7;
    t = R * t * 1.7;
    a *= 0.5;
  }
  return s;
}

float field(vec2 p) {
  // two levels of strong domain warping (fBm, time on a circle): the warp
  // stretches the noise into long marbled filaments
  vec2 w0 = p * uWarpFreq;
  vec2 q = vec2(fbm(w0, uTR, 0.0, 2), fbm(w0 + vec2(5.2, 1.3), uTR, 3.1, 2));
  vec2 r = vec2(fbm(w0 + uWarp * q + vec2(1.7, 9.2), uTR * 1.15, 7.3, 2), fbm(w0 + uWarp * q + vec2(8.3, 2.8), uTR * 1.15, 1.9, 2));
  return fbm(w0 + uWarp * r, uTR, 4.4, 2);
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * uScale;
  // slow circular drift of the whole pattern
  p += uCircle * uDrift;
  float n = field(p);
  // gradient of the field over a wide stencil (smooth), used to even out the
  // ridge spacing: where the field is flat the stripes tighten, where it is
  // steep they relax, so ridges keep a fairly uniform width with few plateaus
  const float E = 0.03;
  vec2 gr = vec2(field(p + vec2(E, 0.0)) - field(p - vec2(E, 0.0)), field(p + vec2(0.0, E)) - field(p - vec2(0.0, E))) / (2.0 * E);
  float gm = length(gr);
  n *= pow(uGRef / max(gm, 0.55 * uGRef), uEven);
  // ridged contour transform: rounded crests, narrow smoothed valleys
  float s = sin(3.14159265 * n * uStripes);
  const float e = 0.12;
  float ridge = (sqrt(s * s + e * e) - e) / (sqrt(1.0 + e * e) - e);
  float h = pow(ridge, 0.6);
  // local slope of the field (≈1 on ridges, →0 on flat seams), from screen derivatives
  float slope = length(vec2(dFdx(n), dFdy(n))) * uRes.y / uScale;
  gl_FragColor = vec4(h, n, slope, 1.0);
}`;

const SHADE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tHeight;
uniform vec2 uRes;
uniform vec3 uBands[5];
uniform vec3 uBase;
uniform float uSlope;
uniform float uFlat;
uniform float uFlatK;
varying vec2 vUv;

vec3 bandColor(float x) {
  // blend through the five environment bands, dark (0) → bright (1)
  // weighted toward the deep end so the base hue dominates, accents stay accents
  x = pow(clamp(x, 0.0, 1.0), 1.8) * 4.0;
  float i = min(floor(x), 3.0);
  float f = smoothstep(0.0, 1.0, x - i);
  vec3 c = mix(uBands[int(i)], uBands[int(i) + 1], f);
  return c * (1.0 + 0.8 * (1.0 - smoothstep(0.0, 1.2, x)));
}

void main() {
  vec2 px = 1.0 / uRes;
  float h = texture2D(tHeight, vUv).r;
  float hl = texture2D(tHeight, vUv - vec2(px.x, 0.0)).r;
  float hr = texture2D(tHeight, vUv + vec2(px.x, 0.0)).r;
  float hd = texture2D(tHeight, vUv - vec2(0.0, px.y)).r;
  float hu = texture2D(tHeight, vUv + vec2(0.0, px.y)).r;
  // gradient per unit of frame height → resolution independent
  vec2 g = vec2(hr - hl, hu - hd) * 0.5 * uRes.y;
  vec3 N = normalize(vec3(-g * uSlope, 1.0));
  // slight perspective: the view ray tilts across the frame, so crests vary too
  vec3 V = normalize(vec3((vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 0.6, 1.0));
  vec3 R = reflect(-V, N);
  float tilt = length(N.xy); // monotonic in surface slope
  // slope is quad-coarse (screen derivatives); smooth it over a small cross
  float sl = 0.0;
  for (int i = -2; i <= 2; i++) {
    sl += texture2D(tHeight, vUv + vec2(float(i) * 2.0 * px.x, 0.0)).b;
    sl += texture2D(tHeight, vUv + vec2(0.0, float(i) * 2.0 * px.y)).b;
  }
  // ridge density (ridges per frame height); plateaus where the field barely changes
  float flat_ = (1.0 - smoothstep(1.5, 5.0, sl / 10.0 * uFlatK)) * uFlat;
  // holographic environment: bands by reflection direction, brighter with tilt
  // continuous in R (no atan seam)
  // crests (untilted) reflect the bright bands, flanks the cooler ones
  // holographic environment: horizontal bands picked by the reflection direction
  vec3 env = bandColor(0.3 + 0.85 * R.y + 0.3 * R.x);
  // chrome: part of the reflection is neutral silver
  env = mix(env, vec3(dot(env, vec3(0.3, 0.5, 0.2))) * 1.05, 0.12);
  vec3 col = mix(env, uBase, smoothstep(0.8, 1.0, tilt) * 0.5);
  // broad flat seams read as deep base colour, not crest highlights
  col = mix(col, uBase * 0.55, flat_ * 0.85);
  // thin-film iridescence by view angle
  float cosT = N.z;
  vec3 film = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + (1.0 - cosT) * 2.2 + 0.1));
  col = mix(col, col * (0.55 + 0.9 * film), 0.25);
  // fresnel-ish brightening at grazing slopes
  col *= 0.55 + 0.7 * pow(1.0 - cosT, 1.5);
  // strong specular from a soft key, plus a broad sheen
  vec3 L = normalize(vec3(-0.45, 0.55, 1.0));
  float sp = pow(max(dot(R, L), 0.0), 36.0);
  float sh = pow(max(dot(R, L), 0.0), 8.0);
  col += (vec3(1.0) * sp * 1.3 + uBands[4] * sh * 0.1) * (1.0 - flat_ * 0.8);
  // crest highlight: thin bright line along the top of every ridge
  col += uBands[4] * smoothstep(0.86, 1.0, h) * 0.15 * (1.0 - flat_);
  // deep valleys: fake AO from the height
  float ao = mix(0.05, 1.0, smoothstep(0.0, 0.65, h));
  col *= ao;
  gl_FragColor = vec4(col, 1.0);
}`;

export const createHoloLiquid: LookFactory<HoloParams> = (params) => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const heightRT = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    generateMipmaps: false,
  });

  const heightMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: HEIGHT_FRAG,
    uniforms: {
      uRes: { value: new THREE.Vector2(1, 1) },
      uCircle: { value: new THREE.Vector2(1, 0) },
      uScale: { value: 0.55 },
      uStripes: { value: 9.0 },
      uWarp: { value: 2.4 },
      uWarpFreq: { value: 0.35 },
      uTR: { value: 0.006 },
      uDrift: { value: 0.006 },
      uGRef: { value: 1.2 },
      uEven: { value: 0.8 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const heightScene = new THREE.Scene();
  heightScene.add(fullscreenMesh(heightMat));

  const shadeMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: SHADE_FRAG,
    uniforms: {
      tHeight: { value: heightRT.texture },
      uRes: { value: new THREE.Vector2(1, 1) },
      uBands: { value: params.bands.map(lin) },
      uBase: { value: lin(params.base) },
      uSlope: { value: 0.02 },
      uFlat: { value: 0.0 },
      uFlatK: { value: 9.0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  scene.add(fullscreenMesh(shadeMat));

  return {
    scene,
    camera,
    update: (frame, w, h) => {
      const th = TAU * phaseOf(frame);
      heightMat.uniforms.uCircle.value.set(Math.cos(th), Math.sin(th));
      heightMat.uniforms.uRes.value.set(w, h);
      shadeMat.uniforms.uRes.value.set(w, h);
      if (heightRT.width !== w || heightRT.height !== h) heightRT.setSize(w, h);
    },
    prerender: (gl) => {
      gl.setRenderTarget(heightRT);
      gl.render(heightScene, camera);
      gl.setRenderTarget(null);
    },
    post: () => ({
      ...defaultPost(),
      bloom: 0.5,
      bloomThreshold: 0.75,
      bloomRadius: 0.75,
      vignette: 0.4,
      exposure: 0.86,
      saturation: 1.15,
    }),
    dispose: () => {
      heightRT.dispose();
      heightMat.dispose();
      shadeMat.dispose();
    },
  };
};
