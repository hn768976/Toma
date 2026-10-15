import { GLSL_COMMON, Pass } from "../engine/gl";
import type { Grade } from "../engine/post";
import type { LookFactory } from "../engine/types";

// ---------------------------------------------------------------------------
// Look 3 — Glowing Tissue. One full-screen shader writes a scalar "heat" into
// the HDR target; the post chain blooms it and maps it through the colour
// ramp. All noise is periodic along the strand axis (period = one tile), and
// the field drifts exactly one tile per loop, so frame 600 == frame 0.
// ---------------------------------------------------------------------------

export type TissueParams = {
  ramp: [string, string, string, string, string];
};

const FRAG = /* glsl */ `
${GLSL_COMMON}
in vec2 vUV; out vec4 o;
uniform float uPhase;   // 0..1 over the loop
uniform float uAspect;

const float TILE = 5.0;          // along-strand period of the base lattice
const vec2 PER = vec2(TILE, 61.0);

// Periodic Voronoi: x = F1, y = F2, z = cell hash
vec3 voronoiP(vec2 x, vec2 per, float seed) {
  vec2 n = floor(x), f = fract(x);
  float F1 = 8.0, F2 = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec3 h = hash33u(vec3(mod(n + g, per), seed));
    vec2 r = g + 0.12 + 0.76 * h.xy - f;
    float d = length(r);
    if (d < F1) { F2 = F1; F1 = d; id = h.z; } else if (d < F2) { F2 = d; }
  }
  return vec3(F1, F2, id);
}

float ridged(vec2 p, vec2 per, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    float v = 1.0 - abs(2.0 * vnoiseP(p, per) - 1.0);
    s += a * v * v; n += a;
    p *= 2.0; per *= 2.0; a *= 0.5;
  }
  return s / n;
}

void main() {
  float ph = uPhase;
  // centred view coords in units of frame height; y down
  vec2 p = (vUV - 0.5) * vec2(uAspect, 1.0);
  float zoom = 1.0 + 0.09 * (0.5 - 0.5 * cos(TAU * ph));
  vec2 q = p / zoom;

  // strand frame: strands rise to the upper right at ~27 degrees
  vec2 dir = normalize(vec2(0.92, 0.38)); // pockets and strands slant upper-left -> lower-right
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 s = vec2(dot(q, dir), dot(q, nrm));

  // base lattice (cells slightly longer along the strands); drifts one tile per loop
  vec2 c = s * vec2(2.8, 5.4) + vec2(TILE * ph, 0.0) + vec2(1.7, 9.3);

  // slow closed wobble of the warp so the tissue "breathes" without boiling
  vec2 wob = 0.06 * vec2(cos(TAU * ph), sin(TAU * ph));
  vec2 w = vec2(fbmP(c + vec2(0.0, 3.1) + wob, PER, 4), fbmP(c + vec2(5.2, 1.3) - wob, PER, 4)) - 0.5;
  vec2 cw = c + w * vec2(0.8, 0.7);

  // oval cells: a rounded outline ring at a per-cell radius plus the shared wall
  vec3 v = voronoiP(cw, PER, 3.0);
  float edge = v.y - v.x;
  float wv = fbmP(cw * 2.0 + 1.3, PER * 2.0, 3);
  float R = 0.30 + 0.12 * fract(v.z * 7.13);
  float ringW = 0.025 + 0.06 * smoothstep(0.3, 0.85, wv);
  float ringD = abs(v.x - R);
  float ring = smoothstep(ringW, ringW * 0.4, ringD);              // crisp ribbon
  float wallW = 0.05 + 0.14 * smoothstep(0.35, 0.85, wv);
  float wall = smoothstep(wallW, wallW * 0.45, edge);              // shared wall between cells
  float walls = max(ring * (0.75 + 0.25 * v.z), wall);
  float glowNear = exp(-min(ringD, edge) / 0.07);                  // tight glow hugging the walls
  float inside = smoothstep(R, R - 0.05, v.x);                     // inside the oval
  float rimIn = exp(-max(R - v.x, 0.0) / 0.05) * inside;           // brighter rim just inside the wall

  // nested smaller cells inside some cells
  vec3 vn2 = voronoiP(cw * 3.0 + 5.0, PER * 3.0, 7.0);
  float inner = smoothstep(0.05, 0.015, abs(vn2.x - 0.3)) * step(0.45, vn2.z) * inside * step(0.85, fract(v.z * 3.7));

  // crisp grainy texture: speckle + dark pores
  float grit = fbmP(cw * 8.0 + 2.0, PER * 8.0, 4);
  float speck = vnoiseP(cw * 40.0, PER * 40.0);
  float pores = smoothstep(0.82, 0.92, vnoiseP(cw * 30.0 + 3.0, PER * 30.0));
  float crust = smoothstep(0.35, 0.75, grit) * (0.6 + 0.4 * speck);

  // branching ribbon tendrils (ridged, warped noise) in the hot core
  vec2 sc = c * vec2(1.0, 2.0) + w * vec2(2.5, 3.0);
  float tend = ridged(sc, vec2(TILE, 122.0), 4);
  float tendrils = smoothstep(0.62, 0.8, tend);
  float strands = pow(ridged(c * vec2(2.0, 5.0) + w * 2.0, vec2(TILE * 2.0, 305.0), 3), 3.0);

  // hot core + glowing body: a wide ellipse leaning up-left to down-right
  float pulse = 0.5 - 0.5 * cos(TAU * 2.0 * ph);       // two pulses per loop
  vec2 bd = normalize(vec2(0.976, 0.22));
  vec2 bn = vec2(-bd.y, bd.x);
  vec2 e = p - vec2(0.0, 0.02);
  e = vec2(dot(e, bd), dot(e, bn));
  float edgeN = fbmP((p + 3.0) * 3.0 + vec2(cos(TAU * ph), sin(TAU * ph)) * 0.25, vec2(64.0), 4) - 0.5;
  vec2 er = vec2(0.66, 0.16) * (0.85 + 0.25 * pulse);
  float core = exp(-pow(length(e / er) + edgeN * 0.5, 2.0) * 1.3);
  float body = smoothstep(1.0, 0.6, length(e / vec2(0.92, 0.56)) + edgeN * 0.35 + (crust - 0.5) * 0.12);

  float gain = 0.82 + 0.28 * pulse;
  // walls thicken and merge into wide molten channels towards the hot core
  float wallFat = smoothstep(wallW + 0.16 * core, 0.0, edge) ;
  float wallHeat = mix(0.4, 2.2, core) * (0.7 + 0.3 * wv);
  float soft = fbmP(cw * 3.0 + 2.0, PER * 3.0, 3);                         // soft cloudy shading
  float heat = 0.0;
  heat += body * (0.20 + 0.16 * crust) * (0.85 + 0.3 * speck);              // smouldering gritty crust
  heat += body * strands * (0.22 + 0.45 * core);                           // flame-like streaks
  heat += body * inside * (0.20 + 0.18 * grit) * (0.75 + 1.1 * core);       // red-orange pockets, gritty
  heat += body * rimIn * (0.10 + 0.35 * core);                             // inner rim highlight
  heat += body * max(walls, wallFat * core) * wallHeat;                    // thick molten channels
  heat += body * glowNear * 0.22 * (0.4 + core);                           // tight glow into the pockets
  heat += body * inner * (0.25 + 0.7 * core);                              // nested loops
  heat += body * tendrils * core * 1.5;                                    // white-hot branching ribbons
  heat += body * core * core * 0.3;                                        // the fused core band
  heat *= 1.0 - 0.6 * pores * (0.4 + 0.6 * core);                          // pores and bubbles
  heat *= 0.9 + 0.2 * speck;                                               // grain
  heat *= gain;
  o = vec4(heat, heat, heat, 1.0);
}`;

export const createTissue: LookFactory<TissueParams> = (ctx, params) => {
  const pass = new Pass("tissue", FRAG, {
    uPhase: { value: 0, type: "f32" },
    uAspect: { value: ctx.W / ctx.H, type: "f32" },
  });
  const grade: Grade = {
    mode: "ramp",
    ramp: params.ramp,
    stops: [0.22, 0.6, 1.05, 1.6],
    exposure: 0.8,
    bloom: 0.4,
    vignette: 0.5,
    vignetteShape: [0.65, 1.2],
    grain: 0.015,
  };
  ctx.post.setGrade(grade);
  return {
    render(f) {
      pass.uniforms.uPhase = f / 600;
      pass.run(ctx.renderer, ctx.post.hdr);
      ctx.post.present(f);
    },
  };
};
