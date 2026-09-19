/**
 * Fullscreen fragment shader for the cyber-alert background.
 *
 * Everything is procedural and driven by uniforms, so the same shader
 * produces the same image at 1080p and at 4K — the only thing that changes
 * is how finely it is sampled. Nothing is keyed to pixel counts except the
 * dither, which deliberately is.
 */
export const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;      // seconds
uniform vec2  uRes;       // render target size in px
uniform float uAspect;    // width / height
uniform float uIntensity; // glitch envelope, 0..1
uniform float uSplit;     // chromatic aberration, fraction of width
uniform float uPixel;     // mosaic coarsening multiplier
uniform float uTear;      // slice displacement, fraction of width
uniform float uFlicker;   // brightness multiplier around 1
uniform float uCols;      // binary-digit columns across the frame
uniform float uScanlines; // scanline count across the frame

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/**
 * One binary digit, drawn in cell-local coordinates (f in 0..1 on both axes).
 *
 * Built from rectangles and an ellipse rather than sampled from a glyph
 * atlas, so the digits stay sharp at 4K instead of resolving into a blurry
 * upscale of a 1080p texture.
 */
float drawDigit(vec2 f, float which) {
  vec2 p = f - 0.5;
  if (which > 0.5) {
    // "1" — a vertical stem with the short angled flag at its top left.
    float stem = step(abs(p.x - 0.03), 0.060) * step(abs(p.y), 0.34);
    float flag = step(abs(p.x + 0.10), 0.070) * step(abs(p.y + 0.22), 0.070);
    return max(stem, flag);
  }
  // "0" — an elliptical ring.
  return step(abs(length(p / vec2(0.25, 0.36)) - 1.0), 0.30);
}

/**
 * The data field: a full wall of binary digits in regular rows.
 *
 * This is what the reference actually is. Viewed at the size the reference
 * clip ships at, adjacent digits blur into what looks like a mosaic of blocks
 * and dashes — and building it as that mosaic is wrong twice over: it misses
 * the digits that are plainly legible when you zoom into the source, and it
 * cannot produce them at 4K, where they resolve properly.
 *
 * Every cell carries a digit. The variation is in brightness, not in
 * occupancy: most digits sit near black, a few are bright, and the
 * regional/per-column terms group them into the passages of denser code that
 * give the field its structure.
 */
float dataField(vec2 uv, float t) {
  float cols = uCols / uPixel;
  float rows = (cols / uAspect) * 0.72; // digit cells are taller than wide

  vec2 grid = vec2(uv.x * cols, uv.y * rows);
  vec2 cellId = floor(grid);
  vec2 f = fract(grid);

  // Per-column vertical scroll, quantised to whole cells so it steps rather
  // than slides — sliding would look like video, stepping looks like data.
  float columnSeed = hash11(cellId.x * 0.137);
  float scroll = floor(t * (0.3 + columnSeed * 1.9) * 3.0);

  vec2 id = vec2(cellId.x, cellId.y + scroll);

  // Brightness of this digit. The steep power keeps most of the wall dark so
  // the bright digits read as highlights rather than as an even grey.
  float level = pow(hash12(id * 1.7 + 3.1), 1.8);

  // Some columns run hot and some regions are denser than others.
  level *= 0.45 + 0.70 * pow(hash11(cellId.x * 0.311 + 7.0), 1.3);
  level *= 0.55 + 0.60 * hash12(floor(id / vec2(7.0, 4.0)) + 11.0);

  // A few digits per frame blow out to near-white.
  level += step(0.9965, hash12(id + vec2(71.0, 13.0))) * 0.75;

  return drawDigit(f, hash12(id + vec2(5.0, 31.0))) * level;
}

/** Maps a field level to the red ramp: near-black -> blood red -> hot pink-white. */
vec3 fieldColor(float level) {
  vec3 dark = vec3(0.024, 0.000, 0.004);
  vec3 mid  = vec3(0.995, 0.028, 0.106);
  vec3 hot  = vec3(1.000, 0.380, 0.390);
  vec3 c = mix(dark, mid, clamp(level, 0.0, 1.0));
  return mix(c, hot, clamp(level - 1.0, 0.0, 1.0));
}

void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y; // draw with y pointing down, like the layout does

  // --- Camera: a very slow breathing zoom keeps the field from feeling static.
  float zoom = 1.0 - 0.04 + 0.04 * sin(uTime * 0.21);
  vec2 cam = (uv - 0.5) * zoom + 0.5;

  // --- Horizontal slice tearing during bursts.
  float sliceRow = floor(uv.y * 26.0);
  float sliceSeed = hash12(vec2(sliceRow, floor(uTime * 15.0)));
  float tear = step(0.80, sliceSeed) * (sliceSeed - 0.80) / 0.20;
  cam.x += (tear - 0.5) * uTear;

  // --- Digit wall, plus a displaced cool ghost for the RGB split.
  //
  // Classic three-sample aberration (R, G and B each from a different offset)
  // does not work on a picture this red. The green and blue channels of the
  // ramp are almost zero, so their samples are invisible and only the red one
  // shows — the image just shifts. Taking a max() across the samples to get
  // the red back is worse: red then comes from two offsets at once, so every
  // digit is drawn twice and the wall turns into garbled pseudo-glyphs that no
  // longer read as binary.
  //
  // Instead the red image is sampled once, and a *cool* ghost of the field is
  // added at the opposite offset. That is what an RGB split actually looks
  // like here: a cyan fringe trailing each glyph, with the glyph itself
  // undoubled. The split is also capped to a fraction of a cell, so the ghost
  // fringes a digit rather than landing on its neighbour.
  //
  // The banner runs its own, much larger split in the DOM, so the heavy
  // separation the reference shows on the alert plate is unaffected by this.
  float cellWidth = uPixel / uCols;
  float split = min(uSplit, cellWidth * 0.55);

  vec3 col = fieldColor(dataField(cam, uTime));

  float ghost = dataField(cam - vec2(split, 0.0), uTime);
  col.b += ghost * 0.30;
  col.g += ghost * 0.13;

  // --- Shaping of the field. Everything from here to the light source below
  // affects the FIELD only; the glow is added afterwards because it is a lamp
  // in front of the field, not a layer composited over the finished picture.

  // The field is dimmest along the very top edge — up there the picture is
  // almost entirely the light source — and fullest across the middle band.
  // Without this the top strip reads as twice as busy as the reference's.
  col *= mix(0.52, 1.0, smoothstep(0.0, 0.34, uv.y));

  // Vignette, deliberately mild. Decomposing the reference's column means into
  // field + light shows the field itself sits flat at ~28/255 right out to the
  // edges — the strongly "vignetted" read comes from the glow lifting the
  // centre, not from the corners being crushed. Over-vignetting here is what
  // made the first few passes look like a different piece.
  float vr = length((uv - vec2(0.5, 0.48)) * vec2(1.00, 0.55));
  col *= 0.62 + 0.38 * smoothstep(1.15, 0.30, vr);

  // The bottom of the frame does fall away (row means 42 at y=0.7 -> 26 at
  // y=0.9), but only below the banner.
  col *= 1.0 - 0.14 * smoothstep(0.72, 1.0, uv.y);

  // --- Light source: a hard red glow just above the top edge, centred at 49%.
  // Fitted to the reference's measured horizontal profile across the top 16%
  // of frame, after subtracting the flat field: +79/255 at centre falling to
  // +7 by x=0.10/0.90. That decays as a single clean exponential in
  // aspect-corrected distance, so one term is both sufficient and cheaper
  // than the two-term fit an eyeballed curve suggested.
  vec2 lightPos = vec2(0.49 * uAspect, -0.035);
  float d = distance(vec2(uv.x * uAspect, uv.y), lightPos);
  float glow = 0.82 * exp(-d * 4.0);
  glow *= 0.92 + 0.08 * sin(uTime * 2.7);

  // Bright light washes local detail out rather than stacking with it. Without
  // this the lit cells near the top spike to 232/255 where the reference tops
  // out at 165 — the giveaway of a glow composited over a field instead of
  // one that is actually lighting it.
  col *= 1.0 - 0.55 * clamp(glow, 0.0, 1.0);
  col += vec3(1.0, 0.050, 0.080) * glow;

  // --- Ambient red lift so the black is a deep red-black, not neutral black.
  col += vec3(0.037, 0.0, 0.007);

  // --- CRT scanlines. Fixed count, so they scale with the canvas.
  float scan = 0.84 + 0.16 * (0.5 + 0.5 * sin(uv.y * uScanlines * 6.2831853));
  col *= scan;

  // --- A slow bright roll bar drifting down the frame.
  float roll = fract(uv.y - uTime * 0.09);
  col *= 1.0 + 0.10 * smoothstep(0.03, 0.0, abs(roll - 0.5) - 0.02);

  col *= uFlicker;

  // --- Ordered dither, in device pixels, to stop the dark ramp from banding.
  float dither = (hash12(floor(gl_FragCoord.xy)) - 0.5) / 255.0;
  col += dither;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;
