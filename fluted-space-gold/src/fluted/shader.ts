import { HASH_GLSL, SIMPLEX_GLSL } from "../shared/glsl";

/**
 * Fluted (reeded) glass over a drifting multicolour gradient.
 * Loop: blob paths use integer harmonics of the loop phase and the warp noise is
 * sampled on a circle in time (4D simplex), so frame 600 == frame 0.
 */
export const FLUTED_FRAG = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uLoopFrame;     // frame % 600
uniform vec3 uCols[7];
uniform float uWeights[7];  // per-colour presence (dominance) in the gradient
uniform float uRibs;          // rib count across the width
uniform float uLens;          // half-width of the region each rib refracts, in rib widths
uniform float uGrain;         // grain amplitude (0.02 = 2%)
uniform float uHighlight;     // rib edge highlight strength
uniform float uShadow;        // rib edge dark line strength

${HASH_GLSL}
${SIMPLEX_GLSL}

const float TAU = 6.283185307179586;

// Blob layout: base centre (x in 0..aspect, y in 0..1), drift amplitude, radius.
vec3 blobPath(int i, float ph, float aspect) {
  float fi = float(i);
  vec2 base = vec2(fract(0.17 + fi * 0.381966) * aspect, fract(0.31 + fi * 0.618034));
  // integer harmonics of the loop → perfect loop
  float k1 = 1.0 + mod(fi, 2.0);
  float k2 = 1.0 + mod(fi + 1.0, 3.0);
  vec2 amp = vec2(0.26 * aspect, 0.34);
  vec2 c = base + amp * vec2(sin(ph * k1 + fi * 1.7), cos(ph * k2 + fi * 2.3));
  return vec3(c, 0.0);
}

vec3 gradientAt(vec2 p, float ph, float aspect) {
  vec2 cs = vec2(cos(ph), sin(ph)) * 0.55;
  vec2 w = vec2(
    snoise4(vec4(p * 1.1, cs)),
    snoise4(vec4(p * 1.1 + vec2(17.3, -4.1), cs + vec2(3.1, 7.7)))
  );
  p += w * 0.30;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 11; i++) {
    vec2 c = blobPath(i, ph, aspect).xy;
    vec2 d = p - c;
    float r2 = dot(d, d);
    // Shepard-style weight: soft, painterly blends with no hard Voronoi edges
    // blobs 7..10 repeat colours 0, 1, 4, 0 (the dominant hues)
    int ci = i < 7 ? i : (i == 9 ? 4 : (i == 8 ? 1 : 0));
    float wt = uWeights[ci] / pow(r2 + 0.03, 1.55);
    acc += uCols[ci] * wt;
    wsum += wt;
  }
  return acc / wsum;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / uRes;
  float aspect = uRes.x / uRes.y;
  float ph = TAU * uLoopFrame / 600.0;

  // ---- fluted glass ----
  float s = uv.x * uRibs;
  float id = floor(s);
  float f = fract(s);
  float u = f * 2.0 - 1.0;                       // -1..1 across the rib
  // cylinder-lens profile: shift grows faster toward the rib edges (magnifies
  // the centre, compresses the edges) and flips the image like a convex lens
  float bend = u * (0.75 + 0.25 * u * u) + 0.08 * sin(u * 3.14159);
  // each rib also looks at a slightly different place (colour scatters rib to rib)
  float jit = (hash1(uint(id) + 911u) - 0.5) * 3.0;
  float sx = (id + 0.5 + jit - bend * uLens) / uRibs;
  // ribs refract slightly differently from each other (tiny per-rib tilt)
  float tilt = (hash1(uint(id) + 77u) - 0.5) * 0.015;
  vec2 sp = vec2(sx * aspect, uv.y + tilt * u);
  vec3 col = gradientAt(sp, ph, aspect);

  // rounded glass rib: soft sheen on one side, deeper colour on the other,
  // low contrast and soft edges (no engraved lines)
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 deep = clamp(mix(vec3(lum), col, 1.3), 0.0, 1.0) * 0.84;
  float sheen = 0.5 + 0.5 * cos(3.14159 * smoothstep(0.05, 0.95, f));
  col = mix(deep, mix(col, vec3(1.0, 0.97, 0.95), 0.35), sheen * uHighlight);
  // soft seam: a gentle darkening over the last ~12% of the rib, blurred over 2 px
  float px = fwidth(s);
  float sh = smoothstep(0.82 - px, 1.0 + px, f);
  col *= 1.0 - sh * uShadow;

  // ---- grain (pixel + loop frame) ----
  col += (pixelNoise(fc, uLoopFrame, 17u) - 0.5) * 2.0 * uGrain;

  col = clamp(col, 0.0, 1.0);
  col = dither255(col, fc, uLoopFrame);
  gl_FragColor = vec4(col, 1.0);
}
`;
