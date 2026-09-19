import { GLSL_LIB } from "./lib";

/**
 * Plate 01 - FALLING DUST / FINE PARTICULATE.
 *
 * Three depth layers of fine airborne particulate falling through frame. Far
 * layers are many, tiny and near-sharp; nearer layers are fewer, slightly
 * larger and faster (parallax). Deliberately no heavily-defocused foreground
 * bokeh - the plate is all fine specks.
 *
 * Looping: the whole field SCROLLS rather than oscillating, so the motion is
 * genuinely continuous. It still closes exactly because the cell hash is
 * wrapped modulo `travel` on the fall axis: after `travel` whole cells the
 * field maps onto itself. `travel` is chosen well above the cells visible in
 * frame (2.5x - 4.2x), so the vertical repeat never appears on screen.
 *
 * (An earlier revision oscillated each mote inside its own 3x3 neighbourhood,
 * which caps total travel below one cell - under 3% of frame height across the
 * entire loop. That is why it read as static.)
 */
export const DUST_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 finalColor;

uniform float uT;
uniform vec2  uRes;
uniform float uSeed;
uniform float uDensity;
uniform float uBright;
uniform float uSpeed;

${GLSL_LIB}

// cells  - motes per screen height
// travel - WHOLE cells fallen per loop; also the hash wrap period on the fall
//          axis, which is what keeps the scroll exactly loopable
// radius - mote radius in cell units
// sway   - lateral drift amplitude, periodic over the loop
float dustLayer(
  vec2 uv, float li, float cells, float travel,
  float radius, float sway, float keep
) {
  vec2 p = vec2(uv.x * cells, uv.y * cells + uT * travel * uSpeed);
  vec2 ip = floor(p);
  vec2 fp = p - ip;

  float acc = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 cell = ip + o;
      // Wrap the fall axis: cell N and cell N+travel are the same mote.
      vec2 id = vec2(cell.x, mod(cell.y, travel));
      vec4 h = hash24(id + vec2(li * 37.31, uSeed * 13.77));
      if (h.w > keep * uDensity) {
        continue;
      }

      // Lateral flutter only - the fall itself comes from the scrolling field.
      float ph = h.z * TAU;
      float sx = (sin(TAU * uT + ph) + 0.45 * sin(2.0 * TAU * uT + ph * 2.3)) * sway;

      vec2 d = fp - (o + vec2(clamp(h.x, 0.08, 0.92) + sx, h.y));
      float r = radius * (0.50 + 1.00 * h.z);
      acc += exp(-dot(d, d) / (r * r)) * (0.25 + 0.75 * hash11(h.x + h.y + li));
    }
  }
  return acc;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vec2(vUV.x * aspect, vUV.y);

  // travel/cells = screen heights fallen per loop: 2.5, 3.2 and 4.2. Nearer
  // layers fall faster, which reads as parallax depth.
  //                     li  cells travel radius  sway  keep
  float d  = 1.00 * dustLayer(uv, 0.0, 42.0, 105.0, 0.055, 0.10, 0.62);
  d += 0.85 * dustLayer(uv, 1.0, 30.0,  96.0, 0.075, 0.14, 0.56);
  d += 0.62 * dustLayer(uv, 2.0, 20.0,  84.0, 0.090, 0.18, 0.44);

  // Faint volumetric haze so the field is not perfectly flat black.
  float breathe = 0.85 + 0.15 * sin(TAU * uT);
  float haze = fbm3(vec3(uv * 1.35, uSeed * 3.1), 3) * breathe;
  haze = smoothstep(0.35, 0.95, haze);

  // Light falls off toward the lower right, gently: the particulate is present
  // across the whole frame, it is only *lit* unevenly.
  float fall = 0.52 + 0.48 * smoothstep(2.35, 0.00, uv.x * 0.62 + uv.y * 0.85);

  vec3 tint = vec3(1.00, 0.935, 0.880);          // warm motes
  vec3 hazeCol = vec3(0.40, 0.26, 0.29);         // faint magenta in the air

  vec3 col = tint * d * fall * uBright;
  col += hazeCol * haze * 0.034 * fall;

  // Sub-LSB dither + a whisper of grain: kills banding in the near-black range.
  col += grain(gl_FragCoord.xy, uT) * 0.0065;

  finalColor = vec4(max(col, 0.0), 1.0);
}
`;
