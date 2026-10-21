import { Container, Mesh } from "pixi.js";
import colors from "../../../data/colors.json";
import counts from "../../../data/counts.json";
import { glslLinear } from "../../lib/color";
import { smoothstep } from "../../lib/math";
import { makeNoise3, curl2 } from "../../lib/noise";
import { PixiContext, PixiScene, PixiStage } from "../../lib/pixi/PixiStage";
import { RIBBON_FRAG_HEAD, RIBBON_VERT_HEAD, RibbonLine, buildRibbons } from "../../lib/pixi/ribbon";
import { glShader } from "../../lib/pixi/shader";
import { mulberry32, range } from "../../lib/random";

// Timeline (frames at 30 fps), matching the brief:
// 0-3 s a few faint threads drift in; 3-8 s more arrive and gather;
// 8-13 s big looping coils; 13-16 s loosen and fade; 16-17 s a few remain.
const T = { arriveEnd: 90, gather: 240, coilEnd: 390, fadeEnd: 480, end: 510 };
const DT = 2; // frames per path sample

type Thread = { pts: number[]; t0: number; life: number; tail: number; opacity: number; width: number; tEnd: number; seed: number };

const traceThreads = (W: number, H: number): Thread[] => {
  const rng = mulberry32(0x7a96_1ed5);
  const noise = makeNoise3(0x1234_abcd);
  const cx = W / 2;
  const cy = H / 2;
  const out: Thread[] = [];
  const n = counts.threads.threads;
  for (let i = 0; i < n; i++) {
    // Arrival: a few early, most in 3-8 s.
    const early = i < n * 0.06;
    const t0 = early ? range(rng, 0, 70) : range(rng, 70, 250);
    const survivor = i % 70 === 3; // ~10 strands stay to the end
    const tEnd = survivor ? T.end + 30 : range(rng, T.coilEnd + 10, T.fadeEnd);
    const speed = range(rng, 12, 20);
    // Spawn just outside an edge, heading roughly inwards.
    const ang = rng() * Math.PI * 2;
    const R = Math.hypot(W, H) * 0.5 * range(rng, 0.78, 1.0);
    let x = cx + Math.cos(ang) * R;
    let y = cy + Math.sin(ang) * R * 0.75;
    let heading = Math.atan2(cy - y, cx - x) + range(rng, -0.6, 0.6);
    const spin = (rng() < 0.5 ? -1 : 1) * range(rng, 0.7, 1.3);
    const radiusPref = range(rng, 0.05, 0.24) * H;
    const loopR = range(rng, 150, 420);
    const pts: number[] = [];
    for (let t = t0; t <= tEnd + 1e-6; t += DT) {
      pts.push(x, y);
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy) || 1;
      // Desired direction: towards a preferred orbit radius, plus flow.
      const gather = smoothstep(0, T.gather, t) * (1 - smoothstep(T.coilEnd - 20, T.coilEnd + 40, t));
      const out01 = smoothstep(T.coilEnd - 10, T.fadeEnd, t);
      const radial = (radiusPref - r) / H; // >0: push outwards
      let vx = (-dx / r) * (0.6 + 0.4 * gather) * Math.max(-1, Math.min(1, -radial * 6 + 0.6 - out01 * 1.8));
      let vy = (-dy / r) * (0.6 + 0.4 * gather) * Math.max(-1, Math.min(1, -radial * 6 + 0.6 - out01 * 1.8));
      // Swirl around the centre.
      vx += (-dy / r) * spin * 0.7 * gather;
      vy += (dx / r) * spin * 0.7 * gather;
      const [fx, fy] = curl2(noise, x / 900, y / 900, t * 0.004 + i * 0.0);
      vx += fx * 0.6 * (1 - 0.6 * gather);
      vy += fy * 0.6 * (1 - 0.6 * gather);
      const want = Math.atan2(vy, vx);
      let d = want - heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      // Coil phase: a strong turn rate winds the thread into big loops.
      const coil = smoothstep(T.gather - 30, T.gather + 30, t) * (1 - smoothstep(T.coilEnd - 30, T.coilEnd + 20, t));
      const omega = (speed / loopR) * spin * coil * (0.85 + 0.3 * noise(i * 0.37, t * 0.01, 3.1));
      heading += DT * (d * 0.06 * (1 - 0.8 * coil) + omega);
      x += Math.cos(heading) * speed * DT;
      y += Math.sin(heading) * speed * DT;
    }
    out.push({
      pts,
      t0,
      life: (pts.length / 2 - 1) * DT,
      tail: range(rng, 80, 140),
      opacity: survivor ? 0.65 : range(rng, 0.3, 0.9),
      width: range(rng, 1.4, 3.4),
      tEnd,
      seed: rng() * 100,
    });
  }
  return out;
};

const VERT = /* glsl */ `
${RIBBON_VERT_HEAD}
uniform float uFrame;
uniform float uPx;
uniform vec2 uCentre;
out float vTPass;
out float vAlpha;
out float vTail;
void main() {
  // aLineA: t0, life, tail, opacity. aLineB: width, tEnd, seed.
  float t = uFrame;
  vTPass = aLineA.x + aS.x * aLineA.y;
  vTail = aLineA.z;
  float fadeIn = smoothstep(aLineA.x, aLineA.x + 25.0, t);
  float fadeOut = 1.0 - smoothstep(aLineB.y - 45.0, aLineB.y, t);
  vAlpha = aLineA.w * fadeIn * fadeOut;
  // Loosen: the whole tangle opens out and drifts apart after 13 s.
  float e = smoothstep(${T.coilEnd.toFixed(1)}, ${T.fadeEnd.toFixed(1)} + 30.0, t);
  vec2 rel = aPosition - uCentre;
  vec2 drift = vec2(sin(aLineB.z * 1.7), cos(aLineB.z * 2.3));
  vec2 p = aPosition + rel * 0.35 * e + drift * 160.0 * e;
  // Slight width variation along each thread.
  float w = aLineB.x * (0.75 + 0.25 * sin(aS.x * aS.z * 0.004 + aLineB.z));
  gl_Position = extrude(p, w, uPx);
}
`;

const FRAG = /* glsl */ `
${RIBBON_FRAG_HEAD}
uniform float uFrame;
in float vTPass;
in float vAlpha;
in float vTail;
out vec4 finalColor;
void main() {
  float age = uFrame - vTPass;
  if (age < 0.0 || age > vTail) discard;
  float f = 1.0 - age / vTail;
  float a = vAlpha * f * sqrt(f) * ribbonCoverage();
  finalColor = vec4(a, a, a, a);
}
`;

const makeBuild = (variant: "white" | "ink") => (ctx: PixiContext): PixiScene => {
  const { width: W, height: H, px } = ctx;
  const threads = traceThreads(W, H);
  const lines: RibbonLine[] = threads.map((t) => ({
    pts: t.pts,
    a: [t.t0, t.life, t.tail, t.opacity],
    b: [t.width, t.tEnd, t.seed, 0],
  }));
  const shader = glShader("threads", VERT, FRAG, {
    u: {
      uFrame: { value: 0, type: "f32" },
      uPx: { value: px, type: "f32" },
      uCentre: { value: new Float32Array([W / 2, H / 2]), type: "vec2<f32>" },
    },
  });
  const mesh = new Mesh({ geometry: buildRibbons(lines), shader });
  mesh.blendMode = "normal"; // premultiplied "over": content.r = coverage
  const root = new Container();
  root.addChild(mesh);
  const C = colors.threads;
  const bg = variant === "white" ? C.black : C.paper;
  const fg = variant === "white" ? C.white : C.ink;
  return {
    root,
    update: (frame) => {
      shader.resources.u.uniforms.uFrame = frame;
    },
    composite: /* glsl */ `
vec3 composite(vec4 c, vec2 uv, out bool allow) {
  allow = true;
  return mix(${glslLinear(bg)}, ${glslLinear(fg)}, clamp(c.a, 0.0, 1.0));
}`,
  };
};

const buildWhite = makeBuild("white");
const buildInk = makeBuild("ink");

export const TangledThreads_White: React.FC = () => (
  <PixiStage build={buildWhite} background={colors.threads.black} />
);
export const TangledThreads_Ink: React.FC = () => <PixiStage build={buildInk} background={colors.threads.paper} />;
