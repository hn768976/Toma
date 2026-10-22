export const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Raymarched noise-displaced sphere shaded as a thin glass/soap shell:
// a bright Fresnel rim, a broad key highlight top-left, and faint light
// from the back surface seen through the front (the inner "folds").
// The noise domain travels around a circle and the blob turns exactly
// once per loop, so uPhase 0 and 2*PI give the identical image.
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uPhase;
uniform vec3 uBg;
uniform vec3 uRimBase;
uniform vec3 uRimShift;
uniform float uIridescence;
uniform vec3 uInterior;

out vec4 outColor;

// --- Ashima 3D simplex noise -------------------------------------------
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// --- Blob ---------------------------------------------------------------
const float RADIUS = 1.0;
const float BOUND = 1.42;

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

mat3 gSpin;
vec3 gFlowA;
vec3 gFlowB;
float gScale;

float sdBlob(vec3 p) {
  p /= gScale;
  vec3 q = gSpin * p;
  float d = 0.16 * snoise(q * 0.5 + gFlowA)
          + 0.008 * snoise(q * 1.45 + gFlowB);
  return (length(p) - RADIUS - d) * 0.8 * gScale;
}

vec3 calcNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float h = 0.0015;
  return normalize(k.xyy * sdBlob(p + k.xyy * h) +
                   k.yyx * sdBlob(p + k.yyx * h) +
                   k.yxy * sdBlob(p + k.yxy * h) +
                   k.xxx * sdBlob(p + k.xxx * h));
}

vec2 sphereHit(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

vec3 rimColor(float t) {
  vec3 film = 0.5 + 0.5 * cos(6.28318 * (vec3(t * 1.35) + uRimShift));
  return mix(uRimBase, uRimBase * 0.35 + film * 0.95, uIridescence);
}

vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);

  // Gentle tumble: one full spin about Y per loop plus slow wobbling tilt.
  gSpin = rotY(uPhase) * rotX(0.35 * sin(uPhase)) * rotZ(0.25 * cos(uPhase));
  gFlowA = vec3(cos(uPhase), sin(uPhase), 0.0) * 0.55;
  gFlowB = vec3(0.0, cos(uPhase), sin(uPhase)) * 0.8 + 7.3;
  // Slow "breathing", largest around mid-loop and smallest near its end.
  gScale = 0.86 * (1.0 - 0.07 * cos(uPhase) + 0.03 * sin(uPhase));

  // Gentle drift of the whole blob around the frame centre.
  vec3 ro = vec3(0.07 * sin(uPhase + 0.8), 0.04 * sin(2.0 * uPhase), 4.0);
  vec3 rd = normalize(vec3(uv, -2.95));

  vec3 col = uBg;
  vec2 bound = sphereHit(ro, rd, BOUND);
  if (bound.x < 0.0) { outColor = vec4(col, 1.0); return; }

  float t = bound.x;
  bool hit = false;
  float minD = 1e9;
  for (int i = 0; i < 96; i++) {
    float d = sdBlob(ro + rd * t);
    minD = min(minD, d);
    if (d < 0.0006) { hit = true; break; }
    t += d;
    if (t > bound.y) break;
  }

  if (!hit) {
    // Faint halo just outside the silhouette softens the edge.
    float halo = exp(-max(minD, 0.0) * 120.0) * 0.06;
    outColor = vec4(screen(col, rimColor(1.0) * halo), 1.0);
    return;
  }

  vec3 p = ro + rd * t;
  vec3 n = calcNormal(p);
  float ndv = clamp(dot(n, -rd), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 4.5);
  float edge = pow(1.0 - ndv, 8.0);
  // Second, fainter band parallel to the edge (fold of the shell).
  float inner = smoothstep(0.55, 0.68, 1.0 - ndv) * smoothstep(0.82, 0.72, 1.0 - ndv) * 0.12;

  vec3 key = normalize(vec3(-0.6, 0.65, 0.55));
  float keyLobe = pow(clamp(dot(reflect(rd, n), key), 0.0, 1.0), 6.0);
  float keyRim = fres * smoothstep(-0.2, 0.9, dot(n, key));
  float fill = fres * smoothstep(0.2, -0.9, dot(n, key)) * 0.35;

  // March the refracted ray to the back surface of the shell.
  vec3 rr = refract(rd, n, 1.0 / 1.08);
  float tb = 0.02;
  for (int i = 0; i < 48; i++) {
    float d = -sdBlob(p + rr * tb);
    if (d < 0.001) break;
    tb += max(d, 0.004);
  }
  vec3 pb = p + rr * tb;
  vec3 nb = -calcNormal(pb);
  float back = pow(1.0 - clamp(abs(dot(nb, rr)), 0.0, 1.0), 3.0);
  float swirl = 0.5 + 0.5 * snoise(gSpin * pb * vec3(1.5, 0.75, 1.5) + gFlowA * 2.0);
  float folds = back * (0.22 + 0.35 * swirl);

  vec3 rim = rimColor(ndv + 0.25 * swirl);
  vec3 light = rim * (fres * 0.6 + edge * 1.2 + inner + keyRim * 0.6 + fill)
             + uRimBase * keyLobe * 0.07
             + uInterior * (0.06 + folds * 0.24 + swirl * 0.01 * (1.0 - fres));

  col = screen(col, clamp(light, 0.0, 1.0));
  outColor = vec4(col, 1.0);
}
`;
