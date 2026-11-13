/**
 * Macro clock, rendered analytically in a single WebGL2 fragment shader.
 *
 * Every element lives on its own plane (dial, hands, bezel) or cylinder
 * (case wall). A ray is cast per pixel, intersected with each layer and the
 * layers are composited back to front. Shallow depth of field is done
 * analytically: each layer knows its distance from the focal plane, turns
 * that into a circle-of-confusion and widens the edge of its signed-distance
 * shapes by exactly that amount. One sample per pixel, no noise, 4K friendly.
 */
export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;      // seconds
uniform float uSeed;      // per-frame grain seed
uniform vec3 uCam, uCamR, uCamU, uCamF;
uniform float uTanHalf;   // tan(fovY / 2)
uniform float uFocus;     // focal distance along the camera axis
uniform float uBlur;      // circle of confusion scale, in frame heights

// palette
uniform vec3 uBgA, uBgB;          // backdrop centre / edge
uniform vec3 uDialA, uDialB;      // dial lit / shaded
uniform vec3 uRing;               // chapter ring
uniform vec3 uInk;                // ticks + hour dots
uniform vec3 uMetalHi, uMetalMid, uMetalLo; // bezel, hands, hub
uniform vec3 uWall;               // inner bezel wall
uniform vec3 uShadow;             // multiplied under hands
uniform float uShadowAmt;
uniform float uSheen;             // specular glint strength on metal

const float PI = 3.14159265359;
const float R_OUT = 1.17;   // outer bezel radius (dial opening = 1.0)
const float H_BEZEL = 0.08; // bezel height above the dial
const float H_CASE = -0.75; // case back

// integer (PCG-style) hash: pattern-free grain at any resolution
float hash(vec2 p) {
  uvec2 q = uvec2(p);
  uint h = q.x * 1664525u + q.y * 1013904223u + uint(uSeed) * 2654435761u;
  h ^= h >> 16; h *= 2246822519u; h ^= h >> 13; h *= 3266489917u; h ^= h >> 16;
  return float(h) / 4294967295.0;
}

// soft edge: s = signed distance (negative inside), w = blur radius
float edge(float s, float w) { return 1.0 - smoothstep(-w, w, s); }

// exact box-blur coverage of a slab of half-width h, d = distance from its centre line
float slab(float d, float h, float w) {
  return clamp((min(d + h, w) - max(d - h, -w)) / (2.0 * w), 0.0, 1.0);
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

struct Hit { vec2 p; float depth; float w; };

vec3 gDir;

// intersect the view ray with the plane z = h
Hit plane(float h) {
  Hit hit;
  hit.depth = (h - uCam.z) / gDir.z;
  hit.p = uCam.xy + gDir.xy * hit.depth;
  // blur radius in object units = CoC in pixels * size of a pixel on the plane
  float cocPx = uBlur * uRes.y * abs(hit.depth - uFocus) / hit.depth;
  float footprint = 0.5 * (length(dFdx(hit.p)) + length(dFdy(hit.p)));
  hit.w = max(cocPx, 0.75) * footprint;
  return hit;
}

// tapered hand pointing along +x after rotation. returns coverage, across = -1..1
float hand(vec2 p, float ang, float len, float tail, float w0, float w1, float blur, out float across) {
  vec2 q = rot(ang) * p;
  float t = clamp(q.x / len, 0.0, 1.0);
  float hw = mix(w0, w1, t);
  if (q.x < 0.0 && tail > 0.1) hw = w0 * 1.6;   // counterweight
  across = clamp(q.y / max(hw, 1e-4), -1.0, 1.0);
  return slab(abs(q.y), hw, blur) * edge(max(-tail - q.x, q.x - len), blur);
}

vec3 metal(float across, float along) {
  // polished baton: bright upper facet, darker lower facet
  vec3 c = mix(uMetalHi, uMetalMid, smoothstep(-0.9, 0.2, across));
  c = mix(c, uMetalLo, smoothstep(0.25, 1.0, across) * 0.85);
  return c * (0.94 + 0.06 * along);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float aspect = uRes.x / uRes.y;
  vec2 s = vec2(frag.x / uRes.y, 1.0 - frag.y / uRes.y);
  vec2 ndc = vec2(s.x - 0.5 * aspect, 0.5 - s.y) * 2.0 * uTanHalf;
  gDir = uCamF + uCamR * ndc.x + uCamU * ndc.y;   // un-normalised: ray param == depth

  // hand angles (dial space, counter-clockwise from +x). The second hand
  // sweeps continuously at real-time speed: 6 degrees per second.
  float aSec = radians(231.0 - 6.0 * uTime);
  float aMin = radians(175.0 - 0.1 * uTime);
  float aHour = radians(156.0 - 0.1 / 12.0 * uTime);
  // direction the shadows fall in (towards the bottom of the frame)
  vec2 shDir = -normalize(uCamU.xy) * 0.55 + normalize(uCamR.xy) * 0.2;

  // ---------------- backdrop ----------------
  vec2 c0 = (s - vec2(0.5 * aspect, 0.5));
  float vg = dot(c0, c0);
  vec3 col = mix(uBgA, uBgB, smoothstep(0.0, 1.1, vg + 0.25 * (s.y - 0.4) - 0.12 * (s.x - 0.3)));

  // ---------------- case wall (cylinder) ----------------
  {
    vec2 o = uCam.xy; vec2 d = gDir.xy;
    float dd = dot(d, d);
    float tc = -dot(o, d) / dd;                       // closest approach
    float dmin = abs(o.x * d.y - o.y * d.x) / sqrt(dd);
    float disc = R_OUT * R_OUT - dmin * dmin;
    float th = disc > 0.0 ? tc - sqrt(disc / dd) : tc;
    float z = uCam.z + gDir.z * th;
    vec2 hp = o + d * th;
    float cocPx = uBlur * uRes.y * abs(th - uFocus) / th;
    float px = th * 2.0 * uTanHalf / uRes.y;
    float w = max(cocPx, 0.75) * px;
    float a = edge(dmin - R_OUT, w) * edge(z - H_BEZEL, w) * edge(H_CASE - z, w * 2.0);
    vec2 n = normalize(hp);
    float lit = 0.5 + 0.5 * dot(n, normalize(vec2(-0.75, 0.65)));
    float h01 = clamp((z - H_CASE) / (H_BEZEL - H_CASE), 0.0, 1.0);
    vec3 wc = mix(uMetalLo, uMetalMid, smoothstep(0.0, 0.8, lit));
    wc = mix(wc, uMetalHi, smoothstep(0.55, 1.0, lit) * 0.8);
    // soft horizontal banding of a brushed, slightly barrelled case
    wc *= 0.82 + 0.18 * smoothstep(0.0, 0.5, h01) - 0.1 * smoothstep(0.86, 1.0, h01);
    wc = mix(wc, uMetalHi, 0.5 * exp(-pow((h01 - 0.62) * 5.0, 2.0)));
    col = mix(col, wc, a);
  }

  Hit top = plane(H_BEZEL);
  float rTop = length(top.p);

  // ---------------- dial ----------------
  {
    Hit h = plane(0.0);
    vec2 p = h.p;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float w = h.w;

    // matte face with a soft light gradient
    float g = clamp(0.5 + 0.42 * dot(p, normalize(vec2(-0.2, 1.0))) + 0.12 * p.x, 0.0, 1.0);
    vec3 dc = mix(uDialB, uDialA, smoothstep(0.0, 1.0, g));

    // chapter ring
    float ringM = edge(0.845 - r, w) ;
    vec3 rc = uRing * (0.93 + 0.14 * g);
    dc = mix(dc, rc, ringM);
    // fine groove between face and ring
    dc *= 1.0 - 0.18 * slab(abs(r - 0.845), 0.004, w);

    // minute ticks
    float ai = ang / (2.0 * PI) * 60.0;
    float k = floor(ai + 0.5);
    float da = abs(ai - k) * (2.0 * PI / 60.0) * r;
    float major = step(abs(mod(k + 0.5, 5.0) - 0.5), 0.1);
    float hw = mix(0.0045, 0.0075, major);
    float hl = mix(0.02, 0.032, major);
    float tick = slab(da, hw, w) * slab(abs(r - 0.925), hl, w);
    dc = mix(dc, uInk, tick * 0.9);

    // hour dots on the face
    float ah = floor(ang / (PI / 6.0) + 0.5) * (PI / 6.0) - radians(1.0);
    vec2 dc0 = 0.752 * vec2(cos(ah), sin(ah));
    float dr = 0.017;
    float dotA = (1.0 - smoothstep(max(dr - w, 0.0), dr + w, length(p - dc0)))
               * min(1.0, (dr * dr) / (w * w) * 1.6);
    dc = mix(dc, uInk, dotA * 0.85);

    // contact shadows of hands and hub
    float sh = 0.0; float ac;
    float sw = w + 0.012;
    sh = max(sh, hand(p - shDir * 0.045, aHour, 0.55, 0.03, 0.026, 0.011, sw, ac));
    sh = max(sh, hand(p - shDir * 0.065, aMin, 0.80, 0.03, 0.02, 0.008, sw + 0.004, ac));
    sh = max(sh, 0.6 * hand(p - shDir * 0.085, aSec, 0.86, 0.24, 0.0105, 0.0075, sw + 0.008, ac));
    sh = max(sh, edge(length(p - shDir * 0.06) - 0.062, sw + 0.01));
    dc = mix(dc, dc * uShadow, sh * uShadowAmt);

    // ambient occlusion under the bezel, then the inner wall itself
    dc *= 1.0 - 0.22 * smoothstep(0.93, 1.0, r);
    float wallM = edge(1.0 - r, w);
    vec3 wallC = mix(uWall, uWall * 1.9, smoothstep(1.0, 1.12, r));
    dc = mix(dc, wallC, wallM);

    float a = edge(rTop - 1.09, top.w);
    col = mix(col, dc, a);
  }

  // ---------------- bezel (top face) ----------------
  {
    float w = top.w;
    float a = edge(1.0 - rTop, w) * edge(rTop - R_OUT, w);
    float t = clamp((rTop - 1.0) / (R_OUT - 1.0), 0.0, 1.0);
    vec2 n = top.p / max(rTop, 1e-3);
    float env = 0.5 + 0.5 * dot(n, normalize(vec2(-0.6, 0.8)));
    // domed cross-section: bright crown, cooler shoulders
    float crown = 1.0 - pow(abs(t - 0.45) * 2.0, 2.0);
    vec3 bc = mix(uMetalMid, uMetalHi, clamp(crown * (0.75 + 0.5 * env), 0.0, 1.0));
    bc = mix(bc, uMetalLo, smoothstep(0.8, 1.0, t) * 0.55 * (1.0 - env * 0.6));
    bc = mix(bc, uMetalLo, (1.0 - smoothstep(0.0, 0.1, t)) * 0.5);
    bc += uSheen * vec3(1.0) * pow(env, 6.0) * crown * 0.35;
    col = mix(col, bc, a);
  }

  // ---------------- hands ----------------
  {
    float ac; float a;
    Hit h = plane(0.022);
    a = hand(h.p, aHour, 0.55, 0.03, 0.026, 0.011, h.w, ac);
    col = mix(col, metal(ac, 0.5), a);

    h = plane(0.036);
    a = hand(h.p, aMin, 0.80, 0.03, 0.02, 0.008, h.w, ac);
    col = mix(col, metal(ac, 0.8), a);

    // hub: stacked discs read as a turned metal boss
    h = plane(0.03);
    col = mix(col, uMetalLo * 0.75, edge(length(h.p) - 0.06, h.w));
    h = plane(0.052);
    col = mix(col, uMetalLo, edge(length(h.p) - 0.058, h.w));

    h = plane(0.058);
    a = hand(h.p, aSec, 0.86, 0.24, 0.0105, 0.0075, h.w, ac);
    col = mix(col, metal(ac * 0.6, 1.0), a);

    h = plane(0.075);
    float hr = length(h.p);
    vec3 cap = mix(uMetalMid, uMetalHi, smoothstep(0.06, 0.0, length(h.p - vec2(-0.012, 0.018))));
    cap += uSheen * 0.25 * smoothstep(0.03, 0.0, length(h.p - vec2(-0.016, 0.022)));
    col = mix(col, cap, edge(hr - 0.052, h.w));
    h = plane(0.085);
    col = mix(col, uMetalHi * 1.02, edge(length(h.p) - 0.02, h.w));
  }

  // ---------------- lens: vignette + fine grain ----------------
  col *= 1.0 - 0.16 * smoothstep(0.25, 1.05, vg);
  float grain = hash(frag) + hash(frag + vec2(4096.0, 2304.0)) - 1.0;
  col += grain * 0.012;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
