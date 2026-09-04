// GLSL for the paper-relief surface.
//
// The height field is analytic, so both the vertex displacement and the
// shading normal come from the same closed-form expression and its exact
// gradient — no displacement texture, no derived normals, nothing to
// stair-step. The fragment shader re-evaluates the field at each pixel, which
// makes the shading independent of how finely the plane happens to be
// subdivided.

import { SHADOW_STEPS } from "./constants";

const COMMON = /* glsl */ `
#define TAU 6.283185307179586

uniform vec2 uCenter;
uniform float uAmplitude;
uniform float uCoreRadius;
uniform float uFrequency;
uniform float uTighten;
uniform float uTightenFalloff;
uniform float uSpiral;
uniform float uRotation;
uniform float uPulseAmount;
uniform float uPulseLag;
uniform float uPulsePhase;

// Accumulated ridge phase at radius r. The log term is the integral of the
// decaying "tighten" frequency, so spacing narrows toward the centre.
float ridgePhase(float r) {
  return TAU * (r * uFrequency
    + uTighten * uTightenFalloff * log(1.0 + r / uTightenFalloff));
}

float ridgePhaseD(float r) {
  return TAU * (uFrequency + uTighten / (1.0 + r / uTightenFalloff));
}

// Radius-dependent amplitude: the core taper times the breathing pulse.
float ridgeAmplitude(float r) {
  float t = clamp(r / uCoreRadius, 0.0, 1.0);
  float taper = t * t * (3.0 - 2.0 * t);
  float breath = 1.0 + uPulseAmount * sin(uPulsePhase - r * uPulseLag);
  return uAmplitude * taper * breath;
}

float ridgeAmplitudeD(float r) {
  float t = clamp(r / uCoreRadius, 0.0, 1.0);
  float taper = t * t * (3.0 - 2.0 * t);
  float taperD = r < uCoreRadius ? (6.0 * t - 6.0 * t * t) / uCoreRadius : 0.0;
  float breath = 1.0 + uPulseAmount * sin(uPulsePhase - r * uPulseLag);
  float breathD = -uPulseAmount * uPulseLag * cos(uPulsePhase - r * uPulseLag);
  return uAmplitude * (taperD * breath + taper * breathD);
}

// Height only — used by the shadow march, where the gradient is not needed.
float rippleHeight(vec2 p) {
  vec2 d = p - uCenter;
  float r = max(length(d), 1e-4);
  float theta = atan(d.y, d.x);
  float u = ridgePhase(r) - uSpiral * theta - uRotation;
  return ridgeAmplitude(r) * sin(u);
}

// Height, exact surface gradient, and the raw ridge sine (reused as a
// crest/valley mask for occlusion and sheen).
void rippleSurface(vec2 p, out float h, out vec2 grad, out float ridge) {
  vec2 d = p - uCenter;
  float r = max(length(d), 1e-4);
  float theta = atan(d.y, d.x);

  float u = ridgePhase(r) - uSpiral * theta - uRotation;
  float su = sin(u);
  float cu = cos(u);

  float a = ridgeAmplitude(r);
  float ad = ridgeAmplitudeD(r);

  h = a * su;
  ridge = su;

  float dhdr = ad * su + a * cu * ridgePhaseD(r);
  // d/dtheta of (-uSpiral * theta) inside the sine.
  float dhdtheta = -a * cu * uSpiral;

  float invR = 1.0 / r;
  float invR2 = invR * invR;
  grad = vec2(
    dhdr * d.x * invR - dhdtheta * d.y * invR2,
    dhdr * d.y * invR + dhdtheta * d.x * invR2
  );
}
`;

export const vertexShader = /* glsl */ `
${COMMON}

varying vec2 vPlane;
varying vec3 vWorld;
varying vec4 vClip;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPlane = world.xy;
  world.z += rippleHeight(world.xy);
  vWorld = world.xyz;
  vClip = projectionMatrix * viewMatrix * world;
  gl_Position = vClip;
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

${COMMON}

uniform vec3 uKeyDir;
uniform vec3 uFillDir;
uniform vec3 uKeyColor;
uniform vec3 uFillColor;
uniform vec3 uAmbientColor;
uniform float uKeyIntensity;
uniform float uFillIntensity;
uniform float uAmbientIntensity;

uniform vec3 uAlbedo;
uniform float uWrap;
uniform vec3 uSubsurfaceColor;
uniform float uSubsurfaceIntensity;

uniform vec3 uSheenColor;
uniform float uSheenIntensity;
uniform float uSheenPower;

uniform float uOcclusion;
uniform float uShadowSoftness;
uniform float uShadowStart;
uniform float uShadowStep;

uniform float uExposure;
uniform float uVignette;
uniform float uGrain;
uniform float uGrainSeed;
uniform float uAspect;
uniform float uFibreScale;
uniform float uFibreAmount;

varying vec2 vPlane;
varying vec3 vWorld;
varying vec4 vClip;

// Soft self-shadowing: march the light ray across the height field and keep
// the tightest clearance. Dividing the clearance by the distance travelled
// widens the penumbra with distance, which is what makes a grazing ridge
// shadow soften as it runs away from its ridge.
float softShadow(vec2 p, float h0, vec3 L) {
  float shade = 1.0;
  float t = uShadowStart;
  for (int i = 0; i < ${SHADOW_STEPS}; i++) {
    float clearance = (h0 + L.z * t) - rippleHeight(p + L.xy * t);
    shade = min(shade, clamp(clearance / (uShadowSoftness * t), 0.0, 1.0));
    t += uShadowStep;
  }
  return shade;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Smooth value noise — the paper fibre. Kept far below the ridge scale so it
// only ever shows as tooth in the material, never as a pattern.
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

vec3 linearToSRGB(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, vec3(1e-5)), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
  float h;
  vec2 grad;
  float ridge;
  rippleSurface(vPlane, h, grad, ridge);

  vec3 N = normalize(vec3(-grad, 1.0));

  // Paper fibre: a touch of high-frequency normal tooth.
  vec2 fp = vPlane * uFibreScale;
  vec2 fibre = vec2(valueNoise(fp), valueNoise(fp.yx + 37.19)) - 0.5;
  N = normalize(N + vec3(fibre * uFibreAmount, 0.0));

  vec3 V = normalize(cameraPosition - vWorld);

  float ndl = dot(N, uKeyDir);
  // Wrapped diffuse: light bleeds a little past the terminator, the way it
  // does in a translucent fibrous material.
  float wrapped = clamp((ndl + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  float direct = max(ndl, 0.0);

  float shadow = softShadow(vPlane, h, uKeyDir);

  // Crevice occlusion, straight off the ridge sine: valleys sit a little
  // deeper in shade than crests, independent of light direction.
  float occlusion = mix(uOcclusion, 1.0, smoothstep(-1.0, 0.55, ridge));

  // Hemispheric fill from the opposite side, so shadows stay grey, not black.
  float fill = clamp(dot(N, uFillDir) * 0.5 + 0.5, 0.0, 1.0);

  vec3 light = uAmbientColor * uAmbientIntensity * occlusion;
  light += uFillColor * uFillIntensity * fill * occlusion;
  light += uKeyColor * uKeyIntensity * wrapped * shadow;
  // The wrapped-only portion carries the subsurface warmth.
  light += uSubsurfaceColor * uSubsurfaceIntensity * max(wrapped - direct, 0.0);

  vec3 color = uAlbedo * light;

  // Sheen, masked to the ridge crests only.
  vec3 H = normalize(uKeyDir + V);
  float sheen = pow(max(dot(N, H), 0.0), uSheenPower);
  color += uSheenColor * uSheenIntensity * sheen
    * smoothstep(0.3, 0.9, ridge) * shadow;

  // Soft shoulder instead of a hard clip: near-white areas keep their
  // gradient rather than flattening into a posterised block.
  color = vec3(1.0) - exp(-color * uExposure);

  vec2 uv = (vClip.xy / vClip.w) * 0.5 + 0.5;
  float vig = length((uv - 0.5) * vec2(uAspect, 1.0));
  color *= 1.0 - uVignette * smoothstep(0.28, 1.02, vig);

  color = linearToSRGB(color);

  // Dither. A huge, smooth, near-white gradient is the worst case for 8-bit
  // output and for H.264 after it; a couple of percent of grain breaks the
  // steps up before the encoder ever sees them.
  color += (hash12(gl_FragCoord.xy + uGrainSeed) - 0.5) * uGrain;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
