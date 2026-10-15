import { Container } from "pixi.js";
import React, { useMemo } from "react";
import { fullscreenMesh, GLSL_HEADER, ShaderMesh } from "../../lib/pixi/helpers";
import { makeInstanced } from "../../lib/pixi/instanced";
import { PixiCanvas, PixiLook } from "../../lib/pixi/PixiCanvas";
import { noiseTexture } from "../../lib/noisetex";
import { LOOP, loopPhase, mulberry32, pick, range, TAU } from "../../lib/rand";
import { cumulative, samplePoly, V2 } from "../../lib/spline";
import { K } from "./anatomy";
import { anatomy, bakeBrain } from "./bake";

export type BrainParams = {
  signal: string; // spark / activity colour
  core: string; // spark head colour
  burst: string; // glow burst colour
};

const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const PUSH_CENTER: V2 = [450 * K, 260 * K]; // design units

const COMPOSITE = /* glsl */ `${GLSL_HEADER}
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uMask;
uniform sampler2D uNoise;
uniform float uTheta;
uniform float uScale;
uniform vec2 uCenter;
uniform vec2 uTexScale;
uniform vec3 uSig;
uniform vec3 uBurst;
uniform vec4 uBursts[7];
vec4 LN(vec2 p, float r) {
  vec2 o = vec2(cos(uTheta), sin(uTheta)) * r;
  return 0.5 * (texture(uNoise, p + o) + texture(uNoise, p.yx * vec2(1.0, -1.0) + vec2(0.37, 0.11) - o.yx));
}
void main() {
  vec2 uv = (vUV - uCenter) / uScale + uCenter;
  vec4 m = texture(uMask, uv * uTexScale);
  vec2 s = uv * vec2(1.7778, 1.0);
  // Deep navy with a faint glow behind the head.
  vec3 col = vec3(0.004, 0.009, 0.042);
  col += vec3(0.012, 0.045, 0.11) * exp(-pow(length((s - vec2(0.95, 0.45)) * vec2(0.8, 1.0)) / 0.55, 2.0));
  // X-ray tissue: fill density, soft glow around edges, crisp pale-cyan lines.
  col += m.g * vec3(0.09, 0.27, 0.55);
  col += m.b * vec3(0.08, 0.3, 0.68) * 0.95;
  col += m.r * vec3(0.5, 0.78, 0.94) * 0.9;
  // Activity: folds light up in drifting patches.
  vec4 n = LN(s * 0.55, 0.08);
  float a = smoothstep(0.3, 0.62, n.x * 0.65 + n.z * 0.35);
  // activity concentrates around the deep centre (callosum, thalamus, cingulate)
  vec2 cc = vec2(450.0, 232.0) * vec2(${(K / 2160).toFixed(6)});
  float centre = exp(-pow(length((s - cc) * vec2(0.8, 1.3)) / 0.3, 2.0));
  a = max(a, centre * 0.85) * (0.3 + 1.1 * centre);
  float act = min(m.a * a * 3.0, 1.6);
  float halo = m.b * a * smoothstep(0.05, 0.4, m.a + m.b * 0.5);
  // active folds replace the cyan with the signal colour (keeps the hue)
  col *= 1.0 - 0.85 * min(act + halo * 0.6, 1.0);
  // saturated amber core, deeper orange bloom around it
  col += uSig * act + uBurst * halo * 1.3;
  // Glow bursts.
  for (int i = 0; i < 7; i++) {
    vec4 b = uBursts[i];
    float d = length((s - b.xy) / b.z);
    col += uBurst * b.w * (exp(-d * d) * 0.8 + exp(-d * 2.5) * 0.6) * (0.5 + m.b + m.a * 1.5);
  }
  // pooled warm glow at the centre, breathing slowly
  float pool = exp(-pow(length((s - cc) * vec2(0.75, 1.4)) / 0.2, 2.0));
  col += uBurst * pool * (0.16 + 0.06 * sin(uTheta * 2.0)) * (0.3 + m.b + m.g);
  // Gentle shoulder so bright overlaps roll off instead of clipping hard.
  col = col / (1.0 + max(col - 0.85, 0.0) * 0.8);
  finalColor = vec4(col, 1.0);
}`;

const SPARK_VERT = /* glsl */ `${GLSL_HEADER}
in vec2 aPosition;
in vec4 aI0; // x, y (design units), radius, intensity
in vec4 aI1; // head (0..1), 0, 0, 0
out vec2 vC;
out float vI;
out float vH;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uScale;
uniform vec2 uCenterD;
void main() {
  vec2 c = (aI0.xy - uCenterD) * uScale + uCenterD;
  vec2 p = c + aPosition * aI0.z * uScale;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
  vC = aPosition; vI = aI0.w; vH = aI1.x;
}`;
const SPARK_FRAG = /* glsl */ `${GLSL_HEADER}
in vec2 vC;
in float vI;
in float vH;
out vec4 finalColor;
uniform vec3 uSig;
uniform vec3 uCore;
void main() {
  float r2 = dot(vC, vC);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 5.0);
  float core = exp(-r2 * 26.0) * vH;
  vec3 c = uSig * g * vI + uCore * core * vI * 1.6;
  // premultiplied "over": the spark partly covers the cyan underneath
  finalColor = vec4(c, clamp(g * vI * 0.6, 0.0, 1.0));
}`;

// ---------------------------------------------------------------- schedules
const N_SPARKS = 80;
const N_TWINKLE = 150;
const TRAIL = 14;
const PERIODS = [60, 75, 100, 120, 150, 200] as const; // all divide 600
type Spark = { path: number; period: number; offset: number; speed: number; size: number; bright: number };
type Burst = { p: V2; period: number; offset: number; radius: number; bright: number };

const buildSchedules = () => {
  const g = anatomy();
  const r = mulberry32(6060);
  const paths = g.sparkPaths.map((p) => ({ p, cum: cumulative(p) }));
  const sparks: Spark[] = [];
  for (let i = 0; i < N_SPARKS; i++) {
    sparks.push({
      path: i < paths.length ? i : Math.floor(r() * paths.length),
      period: pick(r, PERIODS),
      offset: Math.floor(r() * 600),
      speed: range(r, 0.7, 1.0),
      size: range(r, 0.8, 1.25),
      bright: range(r, 0.6, 1.0),
    });
  }
  const BP = [150, 200, 300, 120, 600, 100, 150];
  const bursts: Burst[] = g.burstPoints.map((p, i) => ({
    p,
    period: BP[i],
    offset: Math.floor(r() * 600),
    radius: range(r, 0.06, 0.1),
    bright: range(r, 0.45, 0.7),
  }));
  const twinkles = Array.from({ length: N_TWINKLE }, () => {
    const pth = paths[Math.floor(r() * paths.length)];
    const q = samplePoly(pth.p, pth.cum, r()).p;
    return { x: q[0] * K, y: q[1] * K, period: pick(r, PERIODS), off: Math.floor(r() * 600), size: range(r, 7, 14), bright: range(r, 0.5, 1) };
  });
  return { paths, sparks, bursts, twinkles };
};
let SCHED: ReturnType<typeof buildSchedules> | null = null;
const schedules = () => (SCHED ??= buildSchedules());

type Scene = {
  root: Container;
  comp: ShaderMesh;
  sparks: ReturnType<typeof makeInstanced>;
  bursts: Float32Array;
};

const pushScale = (frame: number) => 1.03 - 0.03 * Math.cos(loopPhase(frame) * TAU);

const makeLook = (params: BrainParams): PixiLook<Scene> => ({
  post: { grain: 0.015, darkFade: true, blueNoise: 0.6 },
  build: ({ W, H, res }) => {
    const mask = bakeBrain(W, H, res);
    const noise = noiseTexture(256, [[4, 4], [4, 4], [8, 3], [16, 3]], 4321);
    const bursts = new Float32Array(7 * 4);
    const comp = fullscreenMesh(
      W,
      H,
      COMPOSITE,
      {
        uTheta: { value: 0, type: "f32" },
        uScale: { value: 1, type: "f32" },
        uCenter: { value: [PUSH_CENTER[0] / W, PUSH_CENTER[1] / H], type: "vec2<f32>" },
        uTexScale: { value: [1, 1], type: "vec2<f32>" },
        uSig: { value: hex(params.signal), type: "vec3<f32>" },
        uBurst: { value: hex(params.burst), type: "vec3<f32>" },
        uBursts: { value: bursts, type: "vec4<f32>", size: 7 },
      },
      { uMask: mask.source, uNoise: noise.source },
      "brain-composite",
    );
    const sparks = makeInstanced({
      count: N_SPARKS * TRAIL + N_TWINKLE,
      floatsPerInstance: 8,
      vertex: SPARK_VERT,
      fragment: SPARK_FRAG,
      uniforms: {
        uScale: { value: 1, type: "f32" },
        uCenterD: { value: PUSH_CENTER, type: "vec2<f32>" },
        uSig: { value: hex(params.signal), type: "vec3<f32>" },
        uCore: { value: hex(params.core), type: "vec3<f32>" },
      },
      name: "brain-sparks",
    });
    sparks.mesh.blendMode = "normal";
    const root = new Container();
    root.addChild(comp.mesh, sparks.mesh);
    return { root, comp, sparks, bursts };
  },
  update: (s, frame) => {
    const { paths, sparks, bursts } = schedules();
    const th = loopPhase(frame) * TAU;
    const sc = pushScale(frame);
    s.comp.u.uTheta = th;
    s.comp.u.uScale = sc;
    s.sparks.u.uScale = sc;
    const f = ((frame % LOOP) + LOOP) % LOOP;
    // Sparks: head + fading trail along the track, closed form in frame.
    const d = s.sparks.data;
    let k = 0;
    for (const sp of sparks) {
      const { p, cum } = paths[sp.path];

      const u = ((f + sp.offset) % sp.period) / sp.period; // 0..1 per cycle
      const travel = u * sp.speed; // part of the cycle the spark is moving
      const env = travel <= 1 ? Math.pow(Math.sin(Math.PI * Math.min(1, travel)), 0.6) : 0;
      for (let t = 0; t < TRAIL; t++) {
        const back = (t / TRAIL) * 0.28; // trail covers 28% of the track
        const pos = travel - back;
        const o = k * 8;
        if (env <= 0 || pos < 0 || pos > 1) {
          d[o + 3] = 0;
          d[o + 2] = 0;
        } else {
          const q = samplePoly(p, cum, pos).p;
          const fall = Math.pow(1 - t / TRAIL, 1.6);
          d[o] = q[0] * K;
          d[o + 1] = q[1] * K;
          d[o + 2] = (t === 0 ? 24 : 15 * (1 - (t / TRAIL) * 0.5)) * sp.size;
          d[o + 3] = env * fall * sp.bright * (t === 0 ? 1.2 : 0.75);
          d[o + 4] = t === 0 ? 1 : 0;
        }
        k++;
      }

    }
    for (const tw of schedules().twinkles) {
      const o = k * 8;
      const u = ((f + tw.off) % tw.period) / tw.period;
      d[o] = tw.x;
      d[o + 1] = tw.y;
      d[o + 2] = tw.size;
      d[o + 3] = tw.bright * Math.pow(Math.max(0, Math.sin(Math.PI * u)), 2);
      d[o + 4] = 0.6;
      k++;
    }
    s.sparks.upload();
    bursts.forEach((b, i) => {
      const u = ((f + b.offset) % b.period) / b.period;
      const env = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(Math.PI * u)), 2);
      s.bursts[i * 4] = (b.p[0] * K) / 2160;
      s.bursts[i * 4 + 1] = (b.p[1] * K) / 2160;
      s.bursts[i * 4 + 2] = b.radius;
      s.bursts[i * 4 + 3] = env * b.bright;
    });
  },
  root: (s) => s.root,
});

export const Brain: React.FC<{ params: BrainParams }> = ({ params }) => {
  const look = useMemo(() => makeLook(params), [params]);
  return <PixiCanvas look={look} />;
};
