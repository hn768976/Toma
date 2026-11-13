export const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// A fluted (vertically ribbed) polished-metal sheet draped over a slowly
// travelling wave field. Every pixel is shaded by reflecting the view ray off
// the combined normal (rib profile + wave slope) into a soft studio environment.
export const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uPhase;      // 0..2PI over one loop
uniform vec3 uShadow;
uniform vec3 uMid;
uniform vec3 uLight;
uniform vec3 uSpec;
out vec4 outColor;

const float RIBS = 46.0;
const float ASPECT = 16.0 / 9.0;

// Height field: soft horizontal ridges whose vertical position follows a
// wave travelling to the right. All time terms use integer multiples of
// uPhase => the motion loops perfectly.
float ridge(float d, float amp) {
  float s = mix(0.30, 0.20, smoothstep(-0.14, 0.14, d));
  return amp * exp(-(d * d) / (s * s));
}

float H(vec2 p) {
  float x = p.x / ASPECT;
  // A soft mound anchored right of centre. It mostly "breathes" (rises and
  // sinks) with a slight sideways sway. Only sin/cos of uPhase are used, so
  // the motion loops perfectly.
  float breath = 0.5 + 0.5 * cos(uPhase);
  float x0 = 0.735 + 0.05 * sin(uPhase);
  float dx = (x - x0) / (x < x0 ? 0.22 : 0.13);   // steeper right flank
  float hump = exp(-dx * dx);
  float yc = 0.46 + 0.24 * hump * (0.08 + 0.92 * breath)
           + 0.03 * sin(6.28318 * x * 0.8 + uPhase + 0.6)
           - 0.26 * smoothstep(x0 + 0.06, 1.08, x);
  // the fold is shallow on the left and deepest under the mound
  float depth = 0.30 * (0.42 + 0.58 * smoothstep(0.10, 0.70, x));
  float h = ridge(p.y - yc, depth);
  // slow swell for large-scale variation
  h += 0.035 * sin(p.x * 2.4 + p.y * 2.0 + uPhase + 2.0);
  return h;
}

vec3 shade(vec2 frag) {
  vec2 uv = frag / uRes;
  vec2 p = vec2(uv.x * ASPECT, uv.y);

  float e = 0.004;
  float h = H(p);
  vec2 g = vec2(H(p + vec2(e, 0.0)) - h, H(p + vec2(0.0, e)) - h) / e;

  // rib coordinate; the wave slope drags the flutes sideways a little
  // flutes with alternating wide / narrow profiles
  float u0 = uv.x * RIBS;
  float u = u0 + 0.085 * sin(3.14159 * u0) + 0.03 * sin(u0 * 0.37 + 1.3)
          + g.x * 0.022 + h * 0.9;          // the fold shears the flutes sideways
  float f = fract(u) - 0.5;
  float odd = step(1.0, mod(u, 2.0));            // -0.5 .. 0.5 across one flute

  // convex flute profile + large scale wave slope
  vec3 n = normalize(vec3(f * (1.2 + 0.35 * odd) - g.x * 0.14, -g.y * 0.30, 1.0));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);

  // --- studio environment -------------------------------------------------
  // big overhead soft box: surfaces tilted upwards are bright
  float sky = smoothstep(-0.70, 0.20, r.y);
  // horizontal falloff: flute flanks pick up the darker sides of the room
  float side = smoothstep(1.05, 0.12, abs(r.x + 0.22));
  float lum = sky * (0.60 + 0.40 * side) + 0.18 * side;

  // narrow strip light -> the thin white wisps that slide inside each flute
  float s1 = (r.x - 0.30 + r.y * 0.9) * 6.0;
  float strip = exp(-s1 * s1);
  float s2 = (r.x + 0.60 - r.y * 0.6) * 8.0;
  float strip2 = exp(-s2 * s2) * 0.6;

  vec3 col = mix(uShadow, uMid, smoothstep(0.0, 0.55, lum));
  col = mix(col, uLight, smoothstep(0.45, 1.0, lum));
  col = mix(col, uSpec, clamp((strip + strip2) * (0.35 + 0.65 * sky), 0.0, 1.0) * 0.7);

  // crisp dark groove between two flutes
  float groove = smoothstep(0.5, 0.455, abs(f));
  col *= mix(0.62, 1.0, groove);
  // soft contact shadow on the right flank of each flute
  col *= 1.0 - 0.16 * smoothstep(0.15, 0.5, f);

  // static studio falloff: brightest upper-left, gradually darker to the right
  col *= 1.0 - 0.36 * smoothstep(0.45, 1.0, uv.x) * smoothstep(0.45, 1.0, uv.x)
             - 0.12 * smoothstep(0.35, 0.0, uv.x);
  col *= 1.0 + 0.16 * smoothstep(0.35, 1.0, uv.y) * smoothstep(0.75, 0.1, uv.x);
  return col;
}

void main() {
  // 4 rotated-grid samples for clean edges on the thin grooves
  vec3 c = vec3(0.0);
  c += shade(gl_FragCoord.xy + vec2(-0.375, -0.125));
  c += shade(gl_FragCoord.xy + vec2( 0.125, -0.375));
  c += shade(gl_FragCoord.xy + vec2( 0.375,  0.125));
  c += shade(gl_FragCoord.xy + vec2(-0.125,  0.375));
  c *= 0.25;
  // subtle vignette
  vec2 q = gl_FragCoord.xy / uRes - 0.5;
  c *= 1.0 - 0.10 * dot(q, q) * 2.0;
  outColor = vec4(c, 1.0);
}
`;
