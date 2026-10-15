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
  vec2 dir = normalize(vec2(0.89, -0.45));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 s = vec2(dot(q, dir), dot(q, nrm));

  // base lattice (cells longer along the strands); drifts one tile per loop
  vec2 c = s * vec2(3.0, 5.0) + vec2(TILE * ph, 0.0) + vec2(1.7, 9.3);

  // slow closed wobble of the warp so the tissue "breathes" without boiling
  vec2 wob = 0.06 * vec2(cos(TAU * ph), sin(TAU * ph));
  vec2 w = vec2(fbmP(c * 1.0 + vec2(0.0, 3.1) + wob, PER, 4), fbmP(c * 1.0 + vec2(5.2, 1.3) - wob, PER, 4)) - 0.5;
  vec2 cw = c + w * vec2(0.9, 0.7);

  // cells and their glowing walls: a crisp hot plateau plus a soft glow
  vec3 v = voronoiP(cw, PER, 3.0);
  float edge = v.y - v.x;
  float wv = fbmP(cw * 2.0 + 1.3, PER * 2.0, 3);
  float wallW = 0.025 + 0.20 * smoothstep(0.35, 0.8, wv);
  float wallCore = smoothstep(wallW, wallW * 0.55, edge);
  float wallGlow = exp(-edge / (wallW * 0.8 + 0.09));
  float interior = smoothstep(0.0, 0.5, edge);
  float cellTone = 0.30 + 0.70 * v.z;

  // fine granular texture inside cells and in the crust
  float grit = fbmP(cw * 6.0 + 2.0, PER * 6.0, 5);
  float crust = smoothstep(0.42, 0.7, fbmP(cw * 10.0 + 5.0, PER * 10.0, 4));
  // small round vesicles near the walls of some cells
  vec3 vs = voronoiP(cw * vec2(5.0, 5.0) + 7.0, PER * 5.0, 11.0);
  float ring = smoothstep(0.07, 0.0, abs(vs.x - 0.22)) * step(0.8, vs.z) * smoothstep(0.5, 0.15, edge);

  // wavy fibrous strands (ridged noise stretched along the strand axis, strongly warped)
  vec2 sc = c * vec2(1.0, 3.0) + w * vec2(1.5, 3.5);
  float strands = ridged(sc, vec2(TILE, 183.0), 4);
  strands = pow(strands, 3.0);

  // larger lumps
  float lumps = fbmP(cw + 4.0, PER, 2);

  // hot core envelope (screen space, slightly tilted ellipse), pulsing
  float pulse = 0.5 - 0.5 * cos(TAU * 2.0 * ph);       // two pulses per loop
  vec2 e = p - vec2(0.02, 0.03);
  e = vec2(dot(e, dir), dot(e, nrm));
  vec2 er = vec2(0.52, 0.25) * (0.85 + 0.25 * pulse);
  float edgeN = fbmP((p + 3.0) * 3.0 + vec2(cos(TAU * ph), sin(TAU * ph)) * 0.25, vec2(64.0), 4) - 0.5;
  float core = exp(-pow(length(e / er) + edgeN * 0.5, 2.0) * 1.2);
  vec2 eb = p * vec2(0.6, 0.98);
  float body = smoothstep(0.56, 0.30, length(eb) + edgeN * 0.25); // the whole glowing body

  float gain = 0.80 + 0.30 * pulse;
  float heat = 0.0;
  heat += body * (0.07 + 0.16 * grit + 0.14 * crust) * (0.6 + 0.4 * lumps);         // dim crusty tissue
  heat += body * strands * (0.30 - 0.15 * core);                                    // fibres
  heat += body * interior * cellTone * (0.30 + 0.70 * grit) * (0.12 + 0.95 * core);                         // cell bodies
  float wallHeat = mix(0.25, 1.0, core) * (0.6 + 0.4 * lumps);
  heat += body * (wallCore * 1.9 * core + wallCore * 0.55 + wallGlow * 0.7) * wallHeat; // glowing walls
  heat += core * ring * 0.9;                                                         // vesicles
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
    exposure: 1.0,
    bloom: 0.8,
    vignette: 1.0,
    vignetteShape: [0.42, 0.98],
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
