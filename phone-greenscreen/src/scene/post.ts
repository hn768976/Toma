import * as THREE from "three";
import { BackgroundSpec } from "../data";

/**
 * Final full-screen pass.
 *
 *  - tScene: the phone (+ floor shadow) rendered on transparent black, linear HDR,
 *    premultiplied alpha.
 *  - tMask:  coverage of the chroma-green parts (screens).
 *
 * The phone is tone-mapped (Khronos PBR Neutral), encoded to sRGB and composited
 * over a procedural background. Vignette, dither and grain are then applied to
 * everything EXCEPT the green: the green (screen mask, and the whole background
 * on the green-screen versions) is mixed in last, so it stays exactly #00FF00.
 */

const vertexShader = /* glsl */ `
precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
precision highp int;

in vec2 vUv;
layout(location = 0) out vec4 outColor;

uniform sampler2D tScene;
uniform sampler2D tMask;
uniform vec2 uRes;
uniform int uFrame;        // already wrapped to the loop length
uniform int uBgType;       // 0 green, 1 diagonal 3-stop, 2 studio cyclorama, 3 flat
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec2 uGlowPos;     // uv of the soft floor glow
uniform float uGlow;       // its strength
uniform float uDeepen;     // diagonal: deepen the first colour in the bottom-left corner
uniform float uStreak;     // diagonal: soft light streak from the upper left
uniform float uHorizon;    // studio: uv.y of the wall / floor blend
uniform float uVignette;
uniform float uGrain;      // amplitude (0.01 = 1%)
uniform float uExposure;

const vec3 GREEN = vec3(0.0, 1.0, 0.0);

// --- hashing: a fixed function of pixel position and frame (never Math.random) ---
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash3(vec2 p, int f) {
  uvec3 h = pcg3d(uvec3(uvec2(p), uint(f)));
  return vec3(h) * (1.0 / 4294967295.0);
}

vec3 neutralTonemap(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 background(vec2 uv) {
  float aspect = uRes.x / uRes.y;
  if (uBgType == 1) {
    // soft diagonal: top-left -> bottom-right, with gently curved bands
    // corner-to-corner diagonal: 0 at top-left, 1 at bottom-right
    float t = 0.5 * (uv.x + (1.0 - uv.y));
    t += 0.04 * sin(uv.y * 3.1 + 0.4) * sin(uv.x * 2.3);
    t = clamp(t, 0.0, 1.0);
    // first colour holds over the top-left half; the last only reaches into its corner
    vec3 c = t < 0.55
      ? mix(uC0, uC1, smoothstep(0.05, 0.55, t))
      : mix(uC1, uC2, smoothstep(0.62, 1.0, t));
    // the first colour deepens into the bottom-left corner (darkest area of the frame)
    float bl = smoothstep(0.95, 0.0, length(uv * vec2(0.9, 1.2)));
    c = mix(c, uC0 * vec3(0.71, 0.76, 0.87), uDeepen * bl);
    // a soft diagonal light streak from the upper left towards the centre
    float d = abs((uv.y - 1.05) + 0.85 * uv.x) / 1.31;
    c = mix(c, vec3(1.0), uStreak * exp(-d * d * 60.0) * smoothstep(0.75, 0.15, uv.x));
    vec2 g = (uv - uGlowPos) * vec2(aspect * 0.55, 1.6);
    c = mix(c, vec3(1.0), uGlow * exp(-dot(g, g) * 4.0));
    return c;
  }
  if (uBgType == 2) {
    // seamless cyclorama: wall darkens towards the top and the sides,
    // a soft horizon falloff into a brighter floor.
    float x = (uv.x - 0.5) * aspect;
    // darker towards the top, the sides, and (asymmetric key) the right wall
    float wallShade = 0.06 * smoothstep(uHorizon, 1.05, uv.y) + 0.035 * x * x * step(0.0, x)
                    + 0.012 * x * x
                    + 0.11 * smoothstep(0.35, 1.0, uv.x) * smoothstep(uHorizon - 0.05, 0.9, uv.y);
    vec3 wall = uC0 * (1.0 - wallShade * vec3(1.0, 1.0, 0.8)); // shade takes a faint lavender cast
    // soft vertical light falling onto the wall behind the subject
    wall += 0.025 * exp(-x * x * 2.2) * smoothstep(1.0, uHorizon, uv.y);
    float floorT = clamp((uHorizon - uv.y) / uHorizon, 0.0, 1.0);
    vec3 floorC = uC0 * (0.955 - 0.03 * x * x) * vec3(1.0, 1.0, 1.008) + 0.012 * floorT;
    float k = smoothstep(uHorizon - 0.07, uHorizon + 0.09, uv.y);
    vec3 c = mix(floorC, wall, k);
    // the cove: a faint shading band where the floor bends up into the wall
    c *= 1.0 - 0.035 * exp(-pow((uv.y - uHorizon) / 0.035, 2.0));
    return c;
  }
  if (uBgType == 3) {
    return uC0;
  }
  return GREEN;
}

void main() {
  vec2 uv = vUv;
  vec4 s = texture(tScene, uv);
  float a = clamp(s.a, 0.0, 1.0);
  vec3 lin = a > 1e-5 ? s.rgb / a : vec3(0.0);
  vec3 phone = toSRGB(neutralTonemap(lin * uExposure));
  float m = clamp(texture(tMask, uv).r, 0.0, 1.0);

  vec3 base;
  float greenW;
  if (uBgType == 0) {
    base = phone;
    greenW = clamp(m + (1.0 - a), 0.0, 1.0);
  } else {
    base = phone * a + background(uv) * (1.0 - a);
    greenW = m;
    vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    base *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(q));
  }

  vec3 h = hash3(gl_FragCoord.xy, uFrame);
  float dither = (h.x + h.y - 1.0) / 255.0;          // triangular, +/-1 LSB
  float grain = (h.z - 0.5) * 2.0 * uGrain;            // +/- uGrain
  base = clamp(base + dither + grain, 0.0, 1.0);

  outColor = vec4(mix(base, GREEN, greenW), 1.0);
}
`;

export type PostPass = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  material: THREE.RawShaderMaterial;
};

/** "#RRGGBB" -> display-space (sRGB) 0..1 vector; backgrounds are built in display space. */
const srgbVec = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

export const BG_TYPE = { green: 0, diagonal: 1, studio: 2, flat: 3 } as const;

export const buildPostPass = (bg: BackgroundSpec): PostPass => {
  const c = bg.colors ?? ["#000000"];
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tScene: { value: null },
      tMask: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uFrame: { value: 0 },
      uBgType: { value: BG_TYPE[bg.type] },
      uC0: { value: srgbVec(c[0]) },
      uC1: { value: srgbVec(c[1] ?? c[0]) },
      uC2: { value: srgbVec(c[2] ?? c[1] ?? c[0]) },
      uGlowPos: { value: new THREE.Vector2(...(bg.glowPos ?? [0.5, 0.2])) },
      uGlow: { value: bg.glow ?? 0 },
      uDeepen: { value: bg.deepen ?? 0 },
      uStreak: { value: bg.streak ?? 0 },
      uHorizon: { value: bg.horizon ?? 0.25 },
      uVignette: { value: bg.vignette ?? 0 },
      uGrain: { value: 0.01 },
      uExposure: { value: 1.0 },
    },
  });
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material };
};
