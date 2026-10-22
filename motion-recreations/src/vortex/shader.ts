// WebGL 2 fragment shader for the rotating vortex field.
//
// Six optical vortices sit at fixed positions. Each contributes a Gaussian-
// weighted complex "conic" wave e^{i(-angle + alpha + k*r)}; their sum gives
// a phase field whose global phase advances 3 full turns over the 20 s clip,
// so every core appears to spin a bright crescent around a dark eye. Vortex
// parameters were fitted to the reference's dominant temporal harmonic.

export const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FIELD_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution; // composition size (4K)
uniform vec2 uFieldSize;  // size of the render target for this pass
uniform float uTime;      // seconds
uniform int uCamera;      // 0 = locked-off (reference), 1 = tilted flyover
uniform float uProgress;  // 0..1 over the composition

out vec4 outColor;

const float ASPECT = 1.7777778;
const float PI = 3.14159265;
const float PERIOD = 6.6733; // seconds per full phase turn (3 turns in 20.02 s)

// Contribution of one vortex at offset d from its core: broad and tight
// Gaussian-weighted conic waves sharing the phase -angle + alpha + k*r.
vec2 vortex(vec2 d, float alpha, float sigma, float r0, float amp, float k,
            float sigma2, float amp2, float r02, float maxSigma) {
  sigma = min(sigma, maxSigma);
  float r2 = dot(d, d);
  float reach = 2.6 * max(sigma, sigma2);
  if (r2 > reach * reach) {
    return vec2(0.0); // contribution < 0.12% of its peak
  }
  float broad = amp * exp(-r2 / (sigma * sigma)) * (1.0 - exp(-r2 / (r0 * r0)));
  float tight = amp2 * exp(-r2 / (sigma2 * sigma2)) * (1.0 - exp(-r2 / (r02 * r02)));
  float ph = -atan(d.y, d.x) + alpha + k * sqrt(r2);
  return (broad + tight) * vec2(cos(ph), sin(ph));
}

// Per vortex: x, y (y down, height-normalised), then alpha, broad sigma, broad
// core radius, broad amplitude, spiral k, tight sigma, tight amplitude, tight
// core radius. The broad term shapes the overall light/dark lobes; the tight
// term adds the crisp crescent that hugs each dark eye. Written out as direct
// calls (no array indexing), which is much faster in software GL.
vec2 vortexSum(vec2 p, vec2 tileOffset, float maxSigma) {
  vec2 acc = vec2(0.0);
  acc += vortex(p - vec2(0.3935, 0.0134) - tileOffset,
    -0.7141, 0.1956, 0.3000, 242.6730, 0.6273, 0.1027, 73.6054, 0.0577, maxSigma);
  acc += vortex(p - vec2(1.4569, 0.1567) - tileOffset,
    0.7778, 0.4891, 0.0899, 59.2813, -0.3473, 0.0891, 15.5537, 0.0293, maxSigma);
  acc += vortex(p - vec2(0.8604, 0.3566) - tileOffset,
    -0.2875, 0.2384, 0.0336, 53.6806, -0.2698, 0.0204, 12.0462, 0.0097, maxSigma);
  acc += vortex(p - vec2(0.2086, 0.7226) - tileOffset,
    -0.6901, 1.5000, 0.0155, 12.1976, 2.2791, 0.1945, 55.7784, 0.0650, maxSigma);
  acc += vortex(p - vec2(1.5324, 0.7697) - tileOffset,
    2.7431, 0.3617, 0.0970, 54.8754, -1.3261, 0.0517, 10.7175, 0.0277, maxSigma);
  acc += vortex(p - vec2(0.9103, 0.9007) - tileOffset,
    -2.1679, 0.2172, 0.0473, 60.0048, 1.3239, 0.0357, 8.3966, 0.0093, maxSigma);
  return acc;
}

vec2 field(vec2 p, bool tiled) {
  if (!tiled) {
    return vortexSum(p, vec2(0.0), 10.0);
  }
  // Periodic copy of the vortex cell so a moving camera never runs out of field.
  // Broad lobes are capped at sigma 0.35 (reach 0.91 < one cell) so the 3x3
  // neighbourhood below covers every copy that still contributes, leaving no
  // visible tile seams.
  vec2 cell = vec2(ASPECT, 1.0);
  vec2 base = floor(p / cell) * cell;
  vec2 acc = vec2(0.0);
  for (int ty = -1; ty <= 1; ty++) {
    for (int tx = -1; tx <= 1; tx++) {
      acc += vortexSum(p, base + vec2(float(tx), float(ty)) * cell, 0.35);
    }
  }
  return acc;
}

// Piecewise-linear tone curve matching the reference's luminance quantiles
// (raw field value -> 0..255), unrolled for speed.
float seg(float x, float x0, float x1, float y0, float y1) {
  return mix(y0, y1, (x - x0) / (x1 - x0));
}

float tone(float raw) {
  float x = clamp(raw, -118.8, 118.8);
  if (x <= -63.9) return seg(x, -118.8, -63.9, 10.0, 44.0);
  if (x <= -41.9) return seg(x, -63.9, -41.9, 44.0, 59.0);
  if (x <= -23.7) return seg(x, -41.9, -23.7, 59.0, 71.0);
  if (x <= -10.6) return seg(x, -23.7, -10.6, 71.0, 85.0);
  if (x <= 0.0) return seg(x, -10.6, 0.0, 85.0, 101.0);
  if (x <= 10.6) return seg(x, 0.0, 10.6, 101.0, 118.0);
  if (x <= 23.7) return seg(x, 10.6, 23.7, 118.0, 138.0);
  if (x <= 41.9) return seg(x, 23.7, 41.9, 138.0, 160.0);
  if (x <= 63.9) return seg(x, 41.9, 63.9, 160.0, 185.0);
  return seg(x, 63.9, 118.8, 185.0, 232.0);
}

void main() {
  vec2 fragPx = gl_FragCoord.xy * (uResolution / uFieldSize);
  vec2 px = vec2(fragPx.x, uResolution.y - fragPx.y);
  vec2 p = px / uResolution.y; // y down, height normalised (x in 0..ASPECT)
  float depthShade = 1.0;
  bool tiled = false;

  if (uCamera == 1) {
    // Tilted flyover: camera pitched 36 deg down toward a horizon just above
    // frame, gliding forward while slowly yawing across the field.
    tiled = true;
    vec2 ndc = (px - 0.5 * uResolution) / uResolution.y; // y down
    float pitch = radians(36.0);
    float yaw = radians(-12.0 + 24.0 * uProgress);
    float focal = 1.15;
    vec3 dir = normalize(vec3(ndc.x, -ndc.y, focal));
    // rotate by pitch (look down)
    float cp = cos(pitch), sp = sin(pitch);
    dir = vec3(dir.x, dir.y * cp - dir.z * sp, dir.y * sp + dir.z * cp);
    float height = 0.9;
    float t = height / max(-dir.y, 1e-3);
    vec2 ground = vec2(dir.x, dir.z) * t;
    float cy = cos(yaw), sy = sin(yaw);
    ground = vec2(ground.x * cy - ground.y * sy, ground.x * sy + ground.y * cy);
    vec2 travel = vec2(0.35, 0.0) + vec2(0.18, -1.0) * (uProgress * 2.2);
    p = vec2(ground.x, -ground.y) * 0.6 + travel + vec2(0.9, 0.5);
    // atmospheric falloff toward the far field
    depthShade = mix(1.0, 0.35, smoothstep(1.5, 9.0, t));
  }

  vec2 f = field(p, tiled);
  float w = 2.0 * PI * uTime / PERIOD;
  float raw = 2.0 * (f.x * cos(w) - f.y * sin(w));
  float lum = tone(raw) / 255.0;

  if (uCamera == 1) {
    lum *= depthShade;
  }

  outColor = vec4(vec3(clamp(lum, 0.0, 1.0)), 1.0);
}
`;

// Second pass at full 4K: upsample the smooth field (bilinear) and add the
// per-frame film grain at native resolution. The field has no detail finer
// than a few pixels, so evaluating it at quarter resolution is visually
// lossless (max 2/255 difference after grain) and ~16x cheaper in software GL.
export const COMPOSITE_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uResolution;
uniform float uFrame;     // frame index, seeds the film grain

out vec4 outColor;

float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

// Film grain: bilinear value noise on a ~6 px (4K) lattice, new every frame.
float grain(vec2 px, float frame) {
  vec2 q = px / 6.0;
  vec2 i = floor(q);
  vec2 f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(vec3(i, frame));
  float b = hash(vec3(i + vec2(1.0, 0.0), frame));
  float c = hash(vec3(i + vec2(0.0, 1.0), frame));
  float d = hash(vec3(i + vec2(1.0, 1.0), frame));
  // Squaring skews the grain toward bright specks, like the reference.
  float n = mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  return n * n - 0.27;
}

void main() {
  float lum = texture(uField, gl_FragCoord.xy / uResolution).r;
  // Grain is strongest in the shadows, as in the reference.
  lum += grain(gl_FragCoord.xy, uFrame) * 0.36 * pow(1.0 - lum, 1.3);
  outColor = vec4(vec3(clamp(lum, 0.0, 1.0)), 1.0);
}
`;
