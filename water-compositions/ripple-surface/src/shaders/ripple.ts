/**
 * Procedural rippling water surface (WebGL 2 / GLSL ES 3.00).
 *
 * Height field: several circular wave trains radiating from slowly drifting
 * point sources (most of them just outside the frame, so the viewer sees
 * the characteristic concentric arcs) + two long directional swells, all
 * lightly domain-warped so crossings produce the kinked / zig-zag lines of
 * real water.
 *
 * Shading: grey "overcast studio" look - a flat mid-grey base, broad soft
 * slope shading, and very sharp specular reflections of an area light that
 * become the thin bright crest lines + occasional sparkles.
 *
 * Camera (uCamMode):
 *   0 = orthographic, straight top-down (Version 1, matches reference)
 *   1 = low-angle perspective camera with a slow dolly + yaw (Version 2)
 */
export const rippleFrag = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uCamMode;
uniform float uGrain;

out vec4 outColor;

const float PI = 3.14159265;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float va = dot(hash22(i) * 2.0 - 1.0, f);
  float vb = dot(hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0));
  float vc = dot(hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0));
  float vd = dot(hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0, f - vec2(1.0, 1.0));
  return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y);
}

float fbm3(vec2 p) {
  float s = 0.5 * gnoise(p);
  s += 0.25 * gnoise(p * 2.07 + 13.1);
  s += 0.125 * gnoise(p * 4.13 + 27.7);
  return s;
}

float bandLimit(float k, float fp) {
  // Waves shorter than ~4-8 pixels fade out instead of aliasing.
  return 1.0 - smoothstep(0.12, 0.25, k * fp / (2.0 * PI));
}

vec2 warpField(vec2 p, float t) {
  return vec2(
    fbm3(p * 1.1 + vec2(0.0, 0.35 * t)),
    fbm3(p * 1.1 + vec2(4.7, 1.9) - 0.3 * t)
  );
}

struct Surface {
  float h;      // height (arbitrary units)
  vec2 grad;    // d(height)/d(world)
  float line;   // accumulated crest-line intensity
  float glow;   // accumulated broad crest sheen
  float trough; // accumulated trough darkening
};

// Adds one swell (long, straight wave) - provides soft shading and
// bends the ripple crests that cross it.
void addSwell(inout Surface s, vec2 q, vec2 dir, float k, float w, float ph,
              float amp, float t, float fp) {
  vec2 d = normalize(dir);
  float a = amp * bandLimit(k, fp);
  float phase = k * dot(q, d) - w * t + ph;
  s.h += a * sin(phase);
  s.grad += a * k * cos(phase) * d;
  // Broad soft bright bands on the swell crests.
  s.glow += 0.9 * a * pow(0.5 + 0.5 * sin(phase), 8.0);
}

// Adds one circular ripple train radiating from centre c.
//  k, chirp : wavenumber at the centre and its growth with distance, so the
//             crest spacing varies across the frame (as in the reference)
//  w        : angular speed -> crests travel outward at ~w/k units/s
//  boldness : 0..1 field that decides, per place, whether a crest is a
//             crisp bold caustic or a soft faint line
// The phase is displaced by the height accumulated so far, so where trains
// cross the crests kink / zig-zag instead of forming a woven grid.
void addRing(inout Surface s, vec2 q, vec2 c, float k, float chirp, float w,
             float ph, float amp, float lineGain, float boldness, float t,
             float fp) {
  vec2 dv = q - c;
  float r = length(dv);
  float kLocal = k + 2.0 * chirp * r;
  float bl = bandLimit(kLocal, fp);
  // Slow packet envelope: busy everywhere, but with varying strength.
  float env = 0.5 + 0.5 * sin(7.5 * r - 0.8 * t + ph);
  env = (0.30 + 0.70 * env * env) * amp * bl / sqrt(1.0 + 1.2 * r);
  // Zig-zag kinks along bold crests (arc-length modulated phase).
  float arc = r * atan(dv.y, dv.x);
  // Short-lived: gated by a fast-evolving noise so kinks appear, morph and
  // vanish within a fraction of a second, mostly on the boldest crests.
  float kinkGate = smoothstep(0.24, 0.42,
    gnoise(vec2(arc * 6.0, r * 4.0) + vec2(2.7 * t, -2.1 * t) + ph));
  float kink = boldness * boldness * 0.7 * kinkGate
             * sin(arc * (45.0 + 12.0 * sin(0.9 * t + ph)) + 6.0 * t + ph);
  // Irregular crest spacing and occasional S-bends.
  float jitter = 3.2 * fbm3(dv * 1.6 + vec2(0.08 * t, -0.06 * t) + ph * 3.1);
  float phase = k * r + chirp * r * r - w * t + 1.7 * ph + 2.0 * s.h + kink + jitter;
  float sn = sin(phase);
  float cs = cos(phase);
  s.h += env * sn;
  s.grad += env * kLocal * cs * dv / max(r, 1e-4);
  float crest = 0.5 + 0.5 * sn;
  float sharp = mix(5.0, 30.0, boldness);
  s.line += lineGain * env * mix(0.30, 1.45, boldness * boldness) * pow(crest, sharp);
  s.glow += env * pow(crest, 3.0);
  s.trough += env * pow(1.0 - crest, 5.0);
}

Surface surface(vec2 p, float t, float fp) {
  Surface s = Surface(0.0, vec2(0.0), 0.0, 0.0, 0.0);
  // Large-scale warp makes the arcs wobble and bend.
  vec2 q = p + 0.09 * warpField(p, t);
  // Fast, small-amplitude surface jitter (period ~0.1-0.3 s, a few pixels):
  // makes the crest shapes evolve every frame like real water, while the
  // slow drift above carries the large-scale motion.
  q += 0.011 * vec2(
    gnoise(p * 11.0 + vec2(7.0 * t, -5.5 * t)),
    gnoise(p * 11.0 + vec2(13.1, 4.2) + vec2(-6.2 * t, 6.8 * t))
  );
  q += 0.0055 * vec2(
    gnoise(p * 23.0 + vec2(-9.0 * t, 8.0 * t) + 31.0),
    gnoise(p * 23.0 + vec2(8.5 * t, 9.5 * t) + 57.0)
  );

  // Fast-changing field that decides which crests flare up bold & crisp.
  float boldness = smoothstep(-0.17, 0.34,
    fbm3(q * 3.6 + vec2(0.6 * t, -0.7 * t) + 9.0));

  addSwell(s, q, vec2(0.3, 1.0), 15.0, 2.0, 0.0, 0.40, t, fp);
  addSwell(s, q, vec2(-1.0, 0.45), 11.0, 1.6, 1.7, 0.32, t, fp);

  // Wandering ripple centres just below / beside the frame, so we see wide,
  // clearly curved arcs sweeping up across the picture (frame height = 1).
  vec2 c0 = vec2(-0.42, -1.18) + vec2(0.45 * sin(0.23 * t + 0.5), 0.25 * cos(0.19 * t));
  vec2 c1 = vec2(0.95, -0.95) + 0.22 * vec2(cos(0.17 * t + 1.0), sin(0.21 * t));
  vec2 c2 = vec2(1.30, 1.05) + 0.22 * vec2(sin(0.15 * t), cos(0.18 * t + 2.0));

  addRing(s, q, c0, 30.0, 7.0, 8.2, 0.0, 1.00, 1.00, boldness, t, fp);
  addRing(s, q, c1, 32.0, 6.0, 7.4, 1.3, 0.40, 0.10, boldness, t, fp);
  addRing(s, q, c2, 42.0, 9.0, 9.0, 2.1, 0.35, 0.16, boldness, t, fp);
  // Fine, busy, thin wiggly crests along the top edge of the frame.
  vec2 c3 = vec2(0.25, 1.55) + 0.20 * vec2(sin(0.2 * t + 1.0), cos(0.14 * t));
  float topMask = smoothstep(0.05, 0.42, p.y);
  addRing(s, q, c3, 78.0, 10.0, 12.0, 0.9, 0.30 * topMask, 0.45, 0.85, t, fp);
  return s;
}

// Occasional specular glints that flare for a fraction of a second.
float glints(vec2 p, float t, float fp) {
  vec2 cell = floor(p * 14.0);
  float g = 0.0;
  for (int j = 0; j <= 1; j++) {
    for (int i = 0; i <= 1; i++) {
      vec2 id = cell + vec2(float(i), float(j));
      vec2 h = hash22(id + 3.7);
      float isOn = step(0.94, hash12(id + 11.3));
      vec2 pos = (id + h) / 14.0;
      float life = fract(0.23 * t + h.x * 7.0 + h.y);
      float flare = exp(-pow((life - 0.5) * 14.0, 2.0));
      float rad = max(0.018, 1.5 * fp);
      float d = length(p - pos) / rad;
      g += isOn * flare * exp(-d * d);
    }
  }
  return g;
}

// Shading shared by both cameras. v = direction from surface to eye.
float shade(Surface s, vec3 v, float lineFade) {
  vec3 n = normalize(vec3(-s.grad * 0.006, 1.0));
  // Broad, soft slope shading from a key light at upper-left.
  float slope = dot(s.grad, normalize(vec2(-0.6, 0.8))) / 45.0;
  // Specular reflection of a large overcast light (dominant at grazing
  // angles, i.e. for the perspective camera).
  vec3 lDir = normalize(vec3(0.0, 1.0, 0.18));
  float spec = pow(max(dot(reflect(-v, n), lDir), 0.0), 400.0);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 5.0);

  float L = 0.64;
  L += 0.10 * slope;
  // Crest lines: a few bold crisp caustics among many soft faint ones.
  L += lineFade * 0.54 * (1.0 - exp(-1.9 * s.line));
  L += lineFade * 0.20 * (1.0 - exp(-1.3 * s.glow));
  // Slightly darker troughs between the bright lines.
  L -= lineFade * 0.08 * (1.0 - exp(-1.5 * s.trough));
  L += 0.45 * spec + 0.18 * fres;
  return L;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;
  float t = uTime;
  float pix = 1.0 / uResolution.y;

  vec2 p;
  vec3 v;
  float fp;
  float dist = 0.0;
  float haze = 0.0;

  if (uCamMode < 0.5) {
    // --- Version 1: orthographic top-down ---------------------------------
    p = uv;
    v = vec3(0.0, 0.0, 1.0);
    fp = pix;
  } else {
    // --- Version 2: low-angle perspective camera ---------------------------
    float camH = 0.36 + 0.02 * sin(0.4 * t);
    float pitch = radians(24.0 + 2.0 * sin(0.25 * t));   // down from horizon
    float yaw = radians(-14.0 + 1.8 * t);                // slow pan right
    vec3 ro = vec3(0.10 * t * sin(yaw) - 0.2, -1.15 + 0.07 * t, camH);
    vec3 fwd = vec3(sin(yaw) * cos(pitch), cos(yaw) * cos(pitch), -sin(pitch));
    vec3 right = normalize(cross(fwd, vec3(0.0, 0.0, 1.0)));
    vec3 up = cross(right, fwd);
    float focal = 1.0 / tan(radians(19.0)); // ~38 deg vertical FOV
    vec3 rd = normalize(fwd * focal + right * uv.x * 2.0 + up * uv.y * 2.0);
    float tHit = ro.z / max(-rd.z, 1e-4);
    vec3 hitP = ro + rd * tHit;
    p = hitP.xy;
    v = -rd;
    dist = tHit;
    // World-space size of one pixel at this distance (along the
    // foreshortened axis), used to band-limit the waves.
    fp = 2.0 * pix * tHit / (focal * max(-rd.z, 0.05));
    haze = smoothstep(0.6, 3.2, dist);
  }

  Surface s = surface(p, t, fp);
  float lineFade = 1.0 - 0.6 * haze;
  float L = shade(s, v, lineFade);
  // Mottled soft light/dark patches in the water.
  L += 0.055 * fbm3(p * 1.5 + vec2(0.12 * t, -0.09 * t) + 21.0);
  // Specular glints riding on the crests.
  L += 1.0 * lineFade * glints(p, t, fp) * smoothstep(0.05, 0.6, s.line);
  // Gentle vignette, darker toward the top-right corner as in the reference.
  L -= 0.06 * smoothstep(0.25, 0.95, dot(uv, normalize(vec2(1.0, 0.8))));
  L -= 0.04 * smoothstep(0.55, 1.05, length(uv * vec2(0.9, 1.3)));
  // Distant water fades to a bright, soft grey.
  L = mix(L, 0.80, 0.55 * haze);

  L += (hash12(frag + fract(t) * 57.3) - 0.5) * uGrain;
  outColor = vec4(vec3(clamp(L, 0.0, 1.0)), 1.0);
}
`;
