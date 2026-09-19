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
uniform float uCols;      // base mosaic column count
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
 * The "data field": a grid of cells that switch on and off. Cells are grouped
 * into horizontal runs of 1-4 so the field reads as blocks of data rather than
 * as uniform static, and each column scrolls at its own rate, which is what
 * produces the vertical streaking in the reference.
 */
float dataField(vec2 uv, float t) {
  float cols = uCols / uPixel;
  float rows = (cols / uAspect) * 1.25; // slightly wider than tall; runs make the dashes

  vec2 cellId = floor(vec2(uv.x * cols, uv.y * rows));

  // Merge neighbouring cells horizontally into runs.
  float runSeed = hash12(vec2(floor(cellId.x * 0.25), cellId.y));
  float runWidth = 1.0 + floor(runSeed * 3.99);
  float runId = floor(cellId.x / runWidth);

  // Per-column vertical scroll, quantised to whole cells so it steps rather
  // than slides — sliding would look like video, stepping looks like data.
  float columnSeed = hash11(cellId.x * 0.137);
  float speed = 0.35 + columnSeed * 2.4;
  float scroll = floor(t * speed * 6.0);

  vec2 id = vec2(runId, cellId.y + scroll);

  // Some columns are dense with data, most are nearly empty.
  float density = 0.09 + 0.42 * pow(hash11(cellId.x * 0.311 + 7.0), 1.6);
  float on = step(1.0 - density, hash12(id * 1.7 + 3.1));

  float level = on * (0.20 + 0.80 * pow(hash12(id + vec2(19.0, 7.0)), 2.0));

  // A few cells per frame blow out to near-white.
  level += step(0.988, hash12(id + vec2(71.0, 13.0))) * 0.55;

  return level;
}

/** Maps a field level to the red ramp: near-black -> blood red -> hot pink-white. */
vec3 fieldColor(float level) {
  vec3 dark = vec3(0.024, 0.000, 0.004);
  vec3 mid  = vec3(0.560, 0.016, 0.060);
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

  // --- Mosaic, sampled three times for chromatic aberration.
  float split = uSplit;
  float r = dataField(cam + vec2(split, 0.0), uTime);
  float g = dataField(cam, uTime);
  float b = dataField(cam - vec2(split, 0.0), uTime);

  vec3 col = vec3(fieldColor(r).r, fieldColor(g).g, fieldColor(b).b);
  // Keep the red channel dominant — splitting the ramp per channel above
  // would otherwise wash the field toward grey.
  col = max(col, fieldColor(g) * 0.92);

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
  col *= 1.0 - 0.20 * smoothstep(0.70, 1.0, uv.y);

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
  col += vec3(0.022, 0.0, 0.004);

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
