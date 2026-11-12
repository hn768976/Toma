export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * Top-down ray-marcher for smooth-unioned (metaball) ball-and-stick molecules,
 * mirrored across the vertical centre line. Per pixel a bitmask of the
 * primitives whose 2D footprint is near the pixel is built first, so the
 * march only ever evaluates the 2–6 primitives that can matter.
 */
export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uRes;
uniform int uBallCount;
uniform int uBondCount;
uniform vec4 uBall[16];      // xyz, radius
uniform vec3 uBallCol[16];   // colour per ball (resolved on the CPU)
uniform vec4 uBond[16];      // a, b, radius
uniform vec3 uBondColA[16];  // bond colour at end a
uniform vec3 uBondColB[16];  // bond colour at end b
uniform float uBlend;

uniform vec3 uBg;
uniform vec3 uBgEdge;
uniform vec3 uDot;
uniform float uDotOpacity;
uniform vec3 uShadow;
uniform float uShadowStrength;
uniform vec3 uRed;
uniform vec3 uPale;
uniform vec3 uYellow;
uniform vec3 uGoo;
uniform vec3 uRim;
uniform float uSpec;

out vec4 outColor;

uint gMask;


// polynomial smooth-min that also blends colour
void sunion(inout float d, inout vec3 c, float d2, vec3 c2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d) / k, 0.0, 1.0);
  // colour bleeds across most of the fused neck, like the reference
  float hc = clamp(0.5 + 0.5 * (d2 - d) / (k * 0.8), 0.0, 1.0);
  d = mix(d2, d, h) - k * h * (1.0 - h);
  c = mix(c2, c, hc);
}

// smooth |x| so mirrored blobs fuse across the centre line without a crease
float sabs(float x) { return sqrt(x * x + 0.00025); }

float map(vec3 p, out vec3 col) {
  p.x = sabs(p.x);
  float d = 1e3;
  col = uGoo;
  for (int i = 0; i < 16; i++) {
    if (i >= uBallCount) break;
    if ((gMask & (1u << uint(i))) == 0u) continue;
    vec4 b = uBall[i];
    float di = length(p - b.xyz) - b.w;
    sunion(d, col, di, uBallCol[i], uBlend);
  }
  for (int i = 0; i < 16; i++) {
    if (i >= uBondCount) break;
    if ((gMask & (1u << uint(16 + i))) == 0u) continue;
    vec4 s = uBond[i];
    vec3 a = uBall[int(s.x)].xyz;
    vec3 bb = uBall[int(s.y)].xyz;
    vec3 pa = p - a, ba = bb - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float di = length(pa - ba * h) - s.z;
    sunion(d, col, di, mix(uBondColA[i], uBondColB[i], h), uBlend);
  }
  return d;
}

float mapD(vec3 p) { vec3 c; return map(p, c); }

float seg2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// footprint mask of primitives within 'margin' of this 2D point
uint buildMask(vec2 q, float margin) {
  uint m = 0u;
  for (int i = 0; i < 16; i++) {
    if (i >= uBallCount) break;
    vec4 b = uBall[i];
    if (length(q - b.xy) < b.w + margin) m |= (1u << uint(i));
  }
  for (int i = 0; i < 16; i++) {
    if (i >= uBondCount) break;
    vec4 s = uBond[i];
    if (seg2(q, uBall[int(s.x)].xy, uBall[int(s.y)].xy) < s.z + margin) m |= (1u << uint(16 + i));
  }
  return m;
}

// soft 2D footprint distance for the contact shadow
float footprint(vec2 q, uint m) {
  float d = 1e3;
  vec3 c;
  for (int i = 0; i < 16; i++) {
    if (i >= uBallCount) break;
    if ((m & (1u << uint(i))) == 0u) continue;
    vec4 b = uBall[i];
    float di = length(q - b.xy) - b.w * 0.97;
    sunion(d, c, di, c, 0.03);
  }
  for (int i = 0; i < 16; i++) {
    if (i >= uBondCount) break;
    if ((m & (1u << uint(16 + i))) == 0u) continue;
    vec4 s = uBond[i];
    float di = seg2(q, uBall[int(s.x)].xy, uBall[int(s.y)].xy) - s.z;
    sunion(d, c, di, c, 0.03);
  }
  return d;
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  float aspect = uRes.x / uRes.y;
  // y grows downwards, screen height = 1
  vec2 uv = vec2(gl_FragCoord.x / uRes.y - 0.5 * aspect, 0.5 - gl_FragCoord.y / uRes.y);
  float px = 1.0 / uRes.y;

  // ---- backdrop: tinted paper, vignette, printed dot grid ------------------
  float vig = smoothstep(0.35, 1.15, length(uv * vec2(0.85, 1.25)));
  vec3 bg = mix(uBg, uBgEdge, vig);
  float spacing = 0.0362;
  vec2 cell = (uv + vec2(0.0181, 0.0121)) / spacing;
  vec2 g = (fract(cell) - 0.5) * spacing;
  float dotMask = 1.0 - smoothstep(0.0020 - px, 0.0020 + px, length(g));
  bg = mix(bg, uDot, dotMask * uDotOpacity);

  // ---- kaleidoscope fold ----------------------------------------------------
  vec2 q = vec2(abs(uv.x), uv.y);

  // ---- contact shadow (light from upper-left => shadow drops down-right) ---
  vec2 qs = q - vec2(0.004 * sign(uv.x + 1e-6), 0.011);
  uint sm = buildMask(qs, 0.06);
  float sh = 0.0;
  if (sm != 0u) sh = 1.0 - smoothstep(-0.018, 0.03, footprint(qs, sm));
  bg = mix(bg, bg * uShadow / max(uBg, vec3(0.05)) , sh * uShadowStrength);
  bg = mix(bg, uShadow, sh * uShadowStrength * 0.25);

  vec3 colOut = bg;

  gMask = buildMask(vec2(sabs(uv.x), uv.y), uBlend + 0.014);
  if (gMask != 0u) {
    float zTop = 0.0;
    for (int i = 0; i < 16; i++) {
      if (i >= uBallCount) break;
      if ((gMask & (1u << uint(i))) != 0u) zTop = max(zTop, uBall[i].z + uBall[i].w);
    }
    vec3 ro = vec3(uv, zTop + uBlend + 0.02);
    float t = 0.0;
    float minD = 1e3;
    float tMin = 0.0;
    bool hit = false;
    for (int i = 0; i < 64; i++) {
      float d = mapD(ro - vec3(0, 0, t));
      if (d < minD) { minD = d; tMin = t; }
      if (d < 0.0002) { hit = true; break; }
      t += max(d * 0.9, 0.0004);
      if (t > 0.9) break;
    }
    float cover = hit ? 1.0 : 1.0 - smoothstep(0.0, 1.25 * px, minD);
    if (cover > 0.0) {
      vec3 p = ro - vec3(0, 0, hit ? t : tMin);
      vec3 base;
      mapD(p);
      map(p, base);
      const vec2 e = vec2(0.0007, -0.0007);
      vec3 n = normalize(e.xyy * mapD(p + e.xyy) + e.yyx * mapD(p + e.yyx) +
                         e.yxy * mapD(p + e.yxy) + e.xxx * mapD(p + e.xxx));
      vec3 L = normalize(vec3(-0.42, -0.62, 0.78));
      vec3 V = vec3(0.0, 0.0, 1.0);
      float ndl = dot(n, L);
      float wrap = clamp(0.5 + 0.5 * ndl, 0.0, 1.0);
      // cheap ambient occlusion from the distance field
      float ao = clamp(0.55 + 0.45 * (mapD(p + n * 0.02) / 0.02), 0.0, 1.0);
      vec3 c = base * (0.60 + 0.46 * wrap) * mix(0.84, 1.0, ao);
      // subsurface rim: a thin warm band hugging the silhouette
      float edge = 1.0 - clamp(n.z, 0.0, 1.0);
      c = mix(c, uRim * (0.85 + 0.25 * wrap), smoothstep(0.50, 0.86, edge) * 0.95);
      // soft broad highlight + tight glint
      vec3 H = normalize(L + V);
      float sp = pow(max(dot(n, H), 0.0), 22.0) * 0.40 + pow(max(dot(n, H), 0.0), 120.0) * 0.45;
      c += sp * uSpec;
      // bounce light from the paper at the lower edge
      c += uBg * 0.10 * clamp(-n.y, 0.0, 1.0) * edge;
      colOut = mix(bg, c, cover);
    }
  }

  // very light film grain so large flat areas never band
  colOut += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(colOut, 1.0);
}
`;
