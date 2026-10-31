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
  float line;   // accumulated thin crest-line intensity
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
}

// Adds one circular ripple train made of expanding wave packets (groups of
// crests separated by calm water). Its phase is displaced by the height
// accumulated so far, so crossings kink the lines instead of producing a
// beaded interference grid.
void addRing(inout Surface s, vec2 q, vec2 c, float k, float w, float ke,
             float we, float ph, float amp, float t, float fp) {
  vec2 dv = q - c;
  float r = length(dv);
  float env = 0.5 + 0.5 * sin(ke * r - we * t + ph);
  env = env * env * env * amp * bandLimit(k, fp) / sqrt(1.0 + 1.5 * r);
  float phase = k * r - w * t + 1.7 * ph + 1.6 * s.h;
  float sn = sin(phase);
  float cs = cos(phase);
  s.h += env * sn;
  s.grad += env * k * cs * dv / max(r, 1e-4);
  float crest = 0.5 + 0.5 * sn;
  s.line += env * pow(crest, 34.0);
  s.glow += env * pow(crest, 5.0);
  s.trough += env * pow(1.0 - crest, 6.0);
}

Surface surface(vec2 p, float t, float fp) {
  Surface s = Surface(0.0, vec2(0.0), 0.0, 0.0, 0.0);
  // Gentle large-scale warp makes the arcs wobble and bend.
  vec2 q = p + 0.10 * warpField(p, t);

  addSwell(s, q, vec2(0.3, 1.0), 26.0, 2.2, 0.0, 0.35, t, fp);
  addSwell(s, q, vec2(-1.0, 0.5), 19.0, 1.7, 1.7, 0.30, t, fp);

  // Slowly wandering ripple centres, mostly outside the frame so we see
  // large concentric arcs (frame height = 1 unit).
  vec2 c0 = vec2(-0.10, -1.05) + vec2(0.30 * sin(0.21 * t + 0.5), 0.15 * cos(0.17 * t));
  vec2 c1 = vec2(1.35, -1.15) + 0.25 * vec2(cos(0.15 * t + 1.0), sin(0.19 * t));
  vec2 c2 = vec2(1.45, 1.35) + 0.25 * vec2(sin(0.13 * t), cos(0.16 * t + 2.0));
  vec2 c3 = vec2(-1.8, 0.85) + 0.20 * vec2(cos(0.12 * t + 3.0), sin(0.2 * t));

  addRing(s, q, c0, 100.0, 9.0, 5.5, 0.9, 0.0, 1.15, t, fp);
  addRing(s, q, c2, 112.0, 9.5, 6.0, 1.0, 2.1, 0.55, t, fp);
  addRing(s, q, c1, 88.0, 8.0, 5.0, 0.8, 1.3, 0.45, t, fp);
  addRing(s, q, c3, 76.0, 7.0, 4.5, 0.7, 0.7, 0.30, t, fp);
  return s;
}

// Shading shared by both cameras. v = direction from surface to eye.
float shade(Surface s, vec3 v, float lineFade) {
  vec3 n = normalize(vec3(-s.grad * 0.0035, 1.0));
  // Broad, soft slope shading from a key light at upper-left.
  float slope = dot(s.grad, normalize(vec2(-0.6, 0.8))) / 100.0;
  // Specular reflection of a large overcast light (dominant at grazing
  // angles, i.e. for the perspective camera).
  vec3 lDir = normalize(vec3(0.0, 1.0, 0.18));
  float spec = pow(max(dot(reflect(-v, n), lDir), 0.0), 400.0);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 5.0);

  float L = 0.68;
  L += 0.09 * slope;
  // Thin bright crest lines - the signature look of the reference.
  L += lineFade * 0.56 * (1.0 - exp(-1.8 * s.line));
  L += lineFade * 0.14 * (1.0 - exp(-1.5 * s.glow));
  // Slightly darker troughs between the bright lines.
  L -= lineFade * 0.17 * (1.0 - exp(-1.5 * s.trough));
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
  // Distant water fades to a bright, soft grey.
  L = mix(L, 0.80, 0.55 * haze);

  L += (hash12(frag + fract(t) * 57.3) - 0.5) * uGrain;
  outColor = vec4(vec3(clamp(L, 0.0, 1.0)), 1.0);
}
`;
