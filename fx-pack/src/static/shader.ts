/**
 * TV static with datamosh bursts. Distances in 4K pixels; macroblocks are
 * 48x48 at 4K (16x16 at 720p). Each burst is analytic in the frame number:
 * a block switches on when the burst front reaches it, then shows the hidden
 * image frozen at that moment, sliding along a broken motion vector and
 * smearing, until it drops back to static.
 */
export const MAX_BURSTS = 3;

export const STATIC_FRAG = /* glsl */ `
uniform vec4 uBurstA[${MAX_BURSTS}];  // cx, cy (0..1), radius (0..1 of width), start frame
uniform vec4 uBurstB[${MAX_BURSTS}];  // grow frames, hold frames, motion angle, vertical squash of the region
uniform float uBurstCount;
uniform float uBars;      // rolling-bar strength (transition snap-in)
uniform float uSquash;    // 1 = full frame, -> 0 collapses to a horizontal line
uniform float uBlack;     // 1 = output black

const float BLOCK = 48.0;

float staticAt(vec2 p, int f) {
  int row = int(floor(p.y / 3.0));   // one analogue line = 3 px at 4K
  float jitter = floor((hash3i(ivec3(row, f, 11)) - 0.5) * 3.0) * 3.0;  // per-line horizontal jitter
  ivec2 c = ivec2(floor(vec2(p.x + jitter, p.y) / vec2(5.0, 3.0)));   // limited bandwidth: wider than tall
  float h = hash3i(ivec3(c, f));
  float hx = hash3i(ivec3(c + ivec2(1, 0), f));
  float hy = hash3i(ivec3(c + ivec2(0, 1), f));
  float v = 0.62 * h + 0.24 * hx + 0.14 * hy;      // slightly clumped grain
  return clamp(0.478 + (v - 0.5) * 0.6, 0.06, 1.0);
}

// The hidden "image": overexposed smoke / white surface.
float hiddenImage(vec2 p, float t) {
  vec2 q = p / 900.0;
  float n = fbm(q + vec2(t * 0.004, -t * 0.002), 300);
  float m = fbm(q * 2.2 + vec2(-t * 0.003, t * 0.005) + n, 320);
  float v = 0.55 + 0.75 * (0.6 * n + 0.4 * m - 0.45);   // mottled, with darker patches
  v += 0.22 * smoothstep(0.35, 1.0, p.y / 2160.0);                 // overexposed towards the bottom
  return clamp(v - 0.02, 0.4, 0.78);
}

void main() {
  vec2 p = px4k();
  int f = uFrame;
  if (uBlack > 0.5) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  // collapse to a horizontal line (CRT power-off)
  float cy = 1080.0;
  float halfH = max(uSquash * 1080.0, 3.0);
  if (abs(p.y - cy) > halfH) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 sp = vec2(p.x, cy + (p.y - cy) / max(uSquash, 0.0028));

  float s = staticAt(sp, f);
  float v = s;

  ivec2 blk = ivec2(floor(sp / BLOCK));
  vec2 blkOrigin = vec2(blk) * BLOCK;
  for (int i = 0; i < ${MAX_BURSTS}; i++) {
    if (float(i) >= uBurstCount) break;
    vec4 A = uBurstA[i];
    vec4 B = uBurstB[i];
    vec2 c = vec2(A.x * 3840.0, A.y * 2160.0);
    float radius = A.z * 3840.0;
    vec2 bc = blkOrigin + BLOCK * 0.5;
    // ragged region: distance warped by block-scale and region-scale noise
    float d = length((bc - c) * vec2(1.0, B.w)) / radius;
    d += 0.38 * (fbm(bc / 520.0, 400 + i) - 0.5) + 0.3 * (fbm(bc / 160.0, 450 + i) - 0.5)   // ragged tongues
       + 0.04 * (hash3i(ivec3(blk, 500 + i)) - 0.5);
    if (d > 1.0) continue;
    float tOn = A.w + d * B.x;                                    // front grows outward
    float decay = 0.75 * fbm(bc / 260.0, 600 + i) + 0.25 * hash3i(ivec3(blk, 600 + i));  // patchy, not checkerboard
    float tOff = A.w + B.x + B.y * (0.35 + 0.65 * clamp((decay - 0.2) / 0.6, 0.0, 1.0))
               + (1.0 - d) * 8.0;                                 // decays block by block, edges first
    float ff = float(f);
    if (ff < tOn || ff >= tOff) continue;
    float age = ff - tOn;
    // broken motion vector: shared direction, per-block speed
    float ang = B.z + (hash3i(ivec3(blk, 700 + i)) - 0.5) * 0.7;
    vec2 mv = vec2(cos(ang), sin(ang)) * (4.0 + 10.0 * hash3i(ivec3(blk, 800 + i)));
    vec2 local = sp - blkOrigin;
    vec2 src = sp - mv * age;
    // smear: some blocks repeat their leading row/column along the motion
    float sm = hash3i(ivec3(blk, 900 + i));
    if (sm > 0.55) {
      if (abs(mv.x) > abs(mv.y)) src.x = blkOrigin.x + (mv.x > 0.0 ? 2.0 : BLOCK - 2.0) - mv.x * age * 0.4;
      else src.y = blkOrigin.y + (mv.y > 0.0 ? 2.0 : BLOCK - 2.0) - mv.y * age * 0.4;
      src += local * 0.15;
    }
    // stale: content frozen at the block's switch-on frame
    float img = hiddenImage(src, tOn);
    // static stays on top at reduced strength
    // the codec freezes the grain it had at switch-on and drags it along with the block
    float stale = staticAt(src, int(tOn));
    float m = img + (stale - 0.478) * 0.5 + (s - 0.478) * 0.45;
    // fresh blocks pop a little brighter, then settle
    m += 0.05 * exp(-age / 3.0);
    float edgeMix = smoothstep(1.0, 0.72, d);                      // soft, smoky region edge
    v = clamp(mix(v, m, edgeMix), 0.06, 1.0);
  }

  // rolling bars while the signal locks in
  if (uBars > 0.0) {
    float bar = 0.5 + 0.5 * sin((sp.y / 2160.0 + float(f) * 0.37) * 6.2832 * 2.0);
    v *= mix(1.0, 0.25 + 0.75 * bar, uBars);
    v = max(v, 0.03);
  }
  outColor = vec4(vec3(v), 1.0);
}
`;
