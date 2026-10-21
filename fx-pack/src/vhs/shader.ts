/**
 * Blank-tape playback noise. Everything temporal depends on uFrame % 600, so
 * the clean version loops in 20s. Distances are in 4K pixels.
 */
export const VHS_FRAG = /* glsl */ `
uniform vec2 uTrack;     // tracking line: y (0..1, -1 = none), strength
uniform float uFlicker;  // brightness multiplier for this frame pair

// Sparse soft tape speckles, smeared horizontally like dropouts.
vec3 speckles(vec2 p, int f) {
  vec2 cell = vec2(12.0, 9.0);                 // speckle cell (4K px)
  ivec2 c = ivec2(floor(p / cell));
  vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++)
  for (int i = -2; i <= 1; i++) {
    ivec2 cc = c + ivec2(i, j);
    float h = hash3i(ivec3(cc, f));
    if (h < 0.991) continue;                    // ~0.9% of cells hold a speckle
    vec2 o = vec2(hash3i(ivec3(cc, f + 31)), hash3i(ivec3(cc, f + 57)));
    vec2 d = p - (vec2(cc) + o) * cell;
    float len = 8.0 + 14.0 * hash3i(ivec3(cc, f + 91));   // dropouts: short horizontal streaks
    float v = exp(-(d.x * d.x) / (len * len) - (d.y * d.y) / 9.0);
    float hue = hash3i(ivec3(cc, f + 7919));
    vec3 col = hue < 0.42 ? vec3(0.40, 0.45, 1.0)     // blue
             : hue < 0.66 ? vec3(0.70, 0.55, 1.0)     // violet
             : hue < 0.86 ? vec3(0.85, 0.88, 0.95)    // white
             : vec3(0.45, 0.95, 0.55);                // green
    acc += col * v * (0.3 + 0.7 * (h - 0.991) / 0.009);
  }
  return acc;
}

void main() {
  vec2 p = px4k();
  vec2 uv = p / vec2(3840.0, 2160.0);
  int f = uFrame % 600;
  float phase = float(f) / 600.0;
  int line = int(floor(p.y / 4.0));            // scanline pairs at 4K

  // --- horizontal jitter per line (tape wobble) and tracking tear ---------
  float jitter = (hash3i(ivec3(line, f, 31)) - 0.5) * 3.0;
  float trackY = uTrack.x * 2160.0;
  float dTrack = abs(p.y - trackY);
  float tear = uTrack.x < 0.0 ? 0.0 : uTrack.y * exp(-dTrack / 26.0);
  jitter += tear * (40.0 + 60.0 * hash3i(ivec3(line, f, 77)));
  vec2 q = vec2(p.x - jitter, p.y);

  // --- base: blue-black with soft vertical banding -------------------------
  float band = loopNoise3(vec2(q.x / 420.0, 3.0), phase, 1.5);
  float blot = 0.6 * vnoise(vec2(q.x / 150.0, q.y / 30.0), f * 3 + 1) + 0.4 * vnoise(vec2(q.x / 60.0, q.y / 12.0), f * 3 + 4); // chroma noise, smeared along the lines
  float blot2 = vnoise(vec2(q.x / 60.0, q.y / 14.0), f * 3 + 2);
  vec2 cdist = (uv - vec2(0.66, 0.82)) * vec2(1.0, 1.1);
  float centre = exp(-dot(cdist, cdist) / 0.16);
  vec3 col = vec3(0.036, 0.036, 0.054);
  col *= 0.85 + 0.3 * band;
  col += vec3(0.018, 0.022, 0.13) * smoothstep(0.38, 0.85, blot) * (0.1 + 1.4 * centre);
  col += vec3(0.010, 0.020, 0.012) * smoothstep(0.7, 1.0, blot2) * centre;
  // fine chroma grain
  float g = hash3i(ivec3(ivec2(floor(q / vec2(4.0, 3.0))), f + 101));
  col += vec3(0.012, 0.010, 0.030) * (g - 0.5) * (0.6 + centre);
  col += speckles(q, f) * (0.10 + 0.45 * centre);

  // --- darker top and edges, like a capture card's overscan -----------------
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.45, uv.y));                  // top third darker
  col *= smoothstep(0.0, 0.006, uv.y) * 0.5 + 0.5;
  col *= 1.0 - 0.35 * smoothstep(0.75, 1.0, abs(uv.x - 0.5) * 2.0);

  // --- bright jagged left edge line ------------------------------------------
  float edgeX = 44.0 + (hash3i(ivec3(int(p.y / 6.0), f, 5)) - 0.5) * 5.0
              ;
  float edge = exp(-pow((p.x - edgeX) / 10.0, 2.0));
  float edgeGap = 0.75 + 0.25 * step(0.1, hash3i(ivec3(int(p.y / 18.0), f, 9)));
  float edgeLen = mix(0.35, 1.0, smoothstep(0.04, 0.3, uv.y)) * (0.75 + 0.25 * vnoise(vec2(p.y / 160.0, 0.5), f + 61));
  col += vec3(0.72, 0.73, 0.78) * edge * edgeGap * edgeLen;
  col += vec3(0.03, 0.03, 0.04) * exp(-max(p.x - edgeX, 0.0) / 60.0);  // glow off the edge
  col *= mix(0.03, 1.0, smoothstep(edgeX - 14.0, edgeX + 2.0, p.x));    // black left of it

  // --- tracking tear: thin bright line + noisy band ---------------------------
  if (uTrack.x >= 0.0) {
    // ragged band: thickness and position wander along x, white flecks around it
    float wob = (vnoise(vec2(p.x / 140.0, float(f)), 43) - 0.5) * 16.0;
    float thick = 2.0 + 7.0 * vnoise(vec2(p.x / 70.0, float(f)), 47);
    float coreLine = exp(-pow((p.y - trackY - wob) / thick, 2.0));
    float broken = smoothstep(0.2, 0.55, vnoise(vec2(p.x / 90.0, float(f)), 41));
    float fleck = step(0.93, hash3i(ivec3(int(p.x / 14.0), int(p.y / 3.0), f + 13)));
    col += vec3(0.78, 0.78, 0.82) * coreLine * broken * uTrack.y;
    col += vec3(0.6, 0.6, 0.66) * fleck * tear * 1.2;
  }

  // --- head-switching strip at the bottom (~2% of height) ---------------------
  float hs = smoothstep(2160.0 - 46.0, 2160.0 - 40.0, p.y);
  if (hs > 0.0) {
    int hl = int(floor(p.y / 5.0));
    float shift = 120.0 + 260.0 * hash3i(ivec3(hl, f, 3));
    float x = p.x + shift;
    float seg = vnoise(vec2(x / 260.0, float(hl / 3)), f * 7 + 5);
    float dash = smoothstep(0.52, 0.58, seg) * step(0.2, hash3i(ivec3(hl, f, 19)));
    float grain = hash3i(ivec3(int(x / 3.0), hl, f));
    float frag = 0.6 * smoothstep(0.55, 0.7, vnoise(vec2(x / 40.0, float(hl)), f * 7 + 9));   // sparse grey/blue fragments
    vec3 strip = vec3(0.02, 0.02, 0.05) + vec3(0.92, 0.93, 0.98) * dash * (0.75 + 0.25 * grain);
    strip += mix(vec3(0.30, 0.31, 0.36), vec3(0.16, 0.2, 0.55), step(0.5, hash3i(ivec3(hl, f, 23)))) * frag * (1.0 - dash) * (0.5 + 0.5 * grain);
    col = mix(col, strip, hs);
  }

  col *= uFlicker;
  outColor = vec4(max(col, 0.0), 1.0);
}
`;
