import * as THREE from "three";
import { Look } from "../lib/LookCanvas";
import { Post } from "../lib/post";
import { buildRibbonGeometry, ribbonMaterial, RibbonLine } from "../lib/ribbon";
import { Dots } from "../lib/points";
import { chargeField, flat, PathSampler, resampleAdaptive, traceLine, V3 } from "../lib/fieldlines";
import { mulberry32 } from "../lib/rng";
import { loopPhase, TAU } from "../lib/loop";
import { glyphTexture } from "../lib/glyph";

export interface EFieldParams {
  /** charge signs, left then right */
  charges: [number, number];
}

const CHARGE_X = 0.55; // world units; frame is 2 units tall
const DISC_R = 0.05; // 2.5 % of frame height
const PALETTE = ["#9AE84A", "#3AD8F0", "#9A5AF0", "#FF7A6A"].map((c) => new THREE.Color(c));
// palette order by line index: green-led, like the reference's mood
const SEQ = [0, 1, 0, 2, 0, 1, 0, 1, 0, 3];
const N_SEEDS = 20;
// Lines are followed far beyond the frame, so a line that sweeps off-screen
// comes back in and ends on the negative charge, as the physics requires.
const BOUND = 40;
const inFrame = (p: V3) => Math.abs(p[0]) < 2.1 && Math.abs(p[1]) < 1.25;

interface TracedLine { pts: V3[]; color: THREE.Color; segs: PathSampler[] }

// Contiguous runs of the line inside the (slightly enlarged) frame: particles
// drift along these so none are wasted off-screen.
const visibleRuns = (pts: V3[]) => {
  const runs: V3[][] = [];
  let cur: V3[] = [];
  for (const q of pts) {
    // particles float in the central region between and around the charges
    if (Math.abs(q[0]) < 1.05 && Math.abs(q[1]) < 0.95) cur.push(q);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs.filter((r) => r.length > 4).map((r) => new PathSampler(r));
};

const traceLines = (p: EFieldParams): TracedLine[] => {
  const charges = [
    { p: [-CHARGE_X, 0, 0] as V3, q: p.charges[0] },
    { p: [CHARGE_X, 0, 0] as V3, q: p.charges[1] },
  ];
  const field = chargeField(charges);
  const sources = charges.filter((c) => c.q > 0);
  const like = sources.length === 2;
  const out: TracedLine[] = [];
  let idx = 0;
  for (const src of sources) {
    for (let i = 0; i < N_SEEDS; i++) {
      // Like charges: offset by half a step so no line runs straight into the
      // neutral point (where E = 0 and the line is undefined).
      const th = (TAU * (i + (like ? 0.5 : 0))) / N_SEEDS;
      const start: V3 = [src.p[0] + Math.cos(th) * DISC_R * 1.05, src.p[1] + Math.sin(th) * DISC_R * 1.05, 0];
      const pts = traceLine(field, start, {
        dir: 1,
        step: (x) => {
          const d = Math.min(...charges.map((c) => Math.hypot(x[0] - c.p[0], x[1] - c.p[1])));
          return Math.min(0.5, Math.max(0.002, d * 0.04));
        },
        stop: (x) =>
          Math.hypot(x[0], x[1]) > BOUND ||
          charges.some((c) => c.q < 0 && Math.hypot(x[0] - c.p[0], x[1] - c.p[1]) < DISC_R * 1.05),
        maxSteps: 60000,
      });
      const r = resampleAdaptive(pts, 0.006, 0.25, inFrame);
      out.push({ pts: r, color: PALETTE[SEQ[idx % SEQ.length]], segs: visibleRuns(r) });
      idx++;
    }
  }
  // Lines that arrive at a negative charge from infinity (e.g. the axis line
  // on the far side of the -): trace backward from it, keep only escapers.
  for (const snk of charges.filter((c) => c.q < 0)) {
    for (let i = 0; i < N_SEEDS; i++) {
      const th = (TAU * i) / N_SEEDS;
      const start: V3 = [snk.p[0] + Math.cos(th) * DISC_R * 1.05, snk.p[1] + Math.sin(th) * DISC_R * 1.05, 0];
      let hitPositive = false;
      const pts = traceLine(field, start, {
        dir: -1,
        step: (x) => {
          const d = Math.min(...charges.map((c) => Math.hypot(x[0] - c.p[0], x[1] - c.p[1])));
          return Math.min(0.5, Math.max(0.002, d * 0.04));
        },
        stop: (x) => {
          if (charges.some((c) => c.q > 0 && Math.hypot(x[0] - c.p[0], x[1] - c.p[1]) < DISC_R * 1.05)) { hitPositive = true; return true; }
          return Math.hypot(x[0], x[1]) > BOUND;
        },
        maxSteps: 60000,
      });
      if (hitPositive) continue;
      const r = resampleAdaptive(pts.reverse(), 0.006, 0.25, inFrame); // stored along E (toward the -)
      out.push({ pts: r, color: PALETTE[SEQ[idx % SEQ.length]], segs: visibleRuns(r) });
      idx++;
    }
  }
  return out;
};

const CHARGE_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in vec2 vUv;
uniform vec3 color;
uniform float pulse; // 0..1
uniform sampler2D glyph;
void main() {
  vec2 q = (vUv - 0.5) * 2.0; // -1..1 over the quad (quad = 4 disc radii)
  float r = length(q) * 4.0;   // in disc radii
  float aa = fwidth(r);
  float core = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
  float ring1R = 1.65 + 0.06 * pulse;
  float ring2R = 2.3 + 0.12 * pulse;
  float ring1 = 1.0 - smoothstep(0.0, 0.1 + aa, abs(r - ring1R));
  float ring2 = (1.0 - smoothstep(0.0, 0.04 + aa, abs(r - ring2R))) * (0.55 + 0.25 * pulse);
  // dashed outer ring like a HUD tick ring
  float ang = atan(q.y, q.x);
  float ticks = smoothstep(0.2, 0.5, abs(sin(ang * 18.0)));
  ring2 *= ticks;
  float glow = exp(-r * r / 2.4) * (0.55 + 0.25 * pulse) * (1.0 - 0.7 * smoothstep(1.05, 1.2, r) * (1.0 - smoothstep(1.3, 1.45, r)));
  vec3 c = color * (core * 0.65 + ring1 * 0.7 + ring2 * 0.55 + glow * 0.18);
  // glyph occupies the inner disc
  vec2 gu = (vUv - 0.5) * 4.0 * 0.5 / 0.62 + 0.5;
  float g = 0.0;
  if (gu.x > 0.0 && gu.x < 1.0 && gu.y > 0.0 && gu.y < 1.0) g = texture(glyph, gu).a;
  c = mix(c, vec3(1.0), g * core);
  float a = clamp(max(max(core, ring1), max(ring2, glow)), 0.0, 1.0);
  fragColor = vec4(c, a);
}`;

export const createEField = (p: EFieldParams) => (gl: THREE.WebGLRenderer, w: number, h: number): Look => {
  const res = new THREE.Vector2(w, h);
  const pxScale = h / 2160;
  const aspect = w / h;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#020309");
  const cam = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, -10, 10);
  cam.position.z = 5;

  // faint navy ghost rings behind the field (barely visible depth cue)
  const ghost = new THREE.Mesh(new THREE.PlaneGeometry(aspect * 2.2, 2.2), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `precision highp float;
layout(location = 0) out highp vec4 fragColor;
in vec2 vP;
uniform float cx;
void main() {
  float g = 0.0;
  for (int i = 0; i < 2; i++) {
    float r = length(vP - vec2(i == 0 ? -cx : cx, 0.0));
    g += smoothstep(0.35, 0.0, abs(fract(r * 3.2) - 0.5)) * exp(-r * 1.1);
  }
  fragColor = vec4(vec3(0.004, 0.006, 0.016) * g, 1.0);
}`,
    uniforms: { cx: { value: CHARGE_X } },
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  ghost.position.z = -1;
  ghost.renderOrder = -1;
  scene.add(ghost);

  const lines = traceLines(p);
  const rnd = mulberry32(5150);

  // faint background structure: wide dim glow copies
  // lines are dimmer far from the charges, leaving dark open areas
  const near = (q: V3) => Math.min(Math.hypot(q[0] + CHARGE_X, q[1]), Math.hypot(q[0] - CHARGE_X, q[1]));
  const lineAlpha = (l: TracedLine) => Float32Array.from(l.pts, (q, k) => Math.min(1, k / 6) * Math.max(0.1, Math.min(1, 1.25 - near(q) / 1.2)));
  const ribbonLines: RibbonLine[] = lines.map((l) => ({
    p: flat(l.pts),
    color: [l.color.r, l.color.g, l.color.b],
    param: rnd(),
    alpha: lineAlpha(l),
  }));
  const geo = buildRibbonGeometry(ribbonLines);
  // soft, defocused-looking wide copies on some of the lines
  const geoSoft = buildRibbonGeometry(lines.map((l) => {
    const k = rnd() < 0.45 ? 0.4 + rnd() * 0.6 : 0;
    return { p: flat(l.pts), color: [l.color.r, l.color.g, l.color.b], alpha: lineAlpha(l).map((a) => a * k) };
  }));
  // Pulses: spaced PULSE_GAP world units along each line, each moving
  // PULSE_TRIPS gaps per loop, so the pattern repeats exactly every 600 frames.
  const PULSE_GAP = 1.4, PULSE_TRIPS = 2;
  const wide = new THREE.Mesh(geoSoft, ribbonMaterial({ width4k: 70, pxScale, res, mode: "glow", additive: true, intensity: 0.11 }));
  const glow = new THREE.Mesh(geo, ribbonMaterial({ width4k: 18, pxScale, res, mode: "glow", additive: true, intensity: 0.12,
    pulse: [1.0, 1, PULSE_TRIPS, 0.05], pulseByLen: PULSE_GAP }));
  const core = new THREE.Mesh(geo, ribbonMaterial({ width4k: 3, pxScale, res, mode: "solid", additive: true, intensity: 0.36,
    pulse: [1.0, 1, PULSE_TRIPS, 0.04], pulseByLen: PULSE_GAP }));
  [wide, glow, core].forEach((m, i) => { m.frustumCulled = false; m.renderOrder = i; scene.add(m); });

  // particles drifting along the lines (whole trips per loop)
  const N_PART = 300;
  const dots = new Dots({ count: N_PART, pxScale, mode: 0, additive: true });
  const segs = lines.flatMap((l) => l.segs.map((sg) => ({ sg, color: l.color })));
  const totalLen = segs.reduce((a, b) => a + b.sg.length, 0);
  const part = Array.from({ length: N_PART }, () => {
    // pick a visible run with probability proportional to its length
    let x = rnd() * totalLen, k = 0;
    while (k < segs.length - 1 && x > segs[k].sg.length) { x -= segs[k].sg.length; k++; }
    return { seg: segs[k].sg, trips: 1 + Math.floor(rnd() * 2), phase: rnd(), ...(() => { const big = rnd() < 0.3; return { big, size: big ? 16 + rnd() * 10 : 5 + rnd() * 3 }; })(),
      color: segs[k].color.clone().lerp(new THREE.Color(1, 0.95, 0.5), rnd() < 0.3 ? 0.7 : 0.15) };
  });
  dots.points.renderOrder = 5;
  scene.add(dots.points);

  // charges
  const chargeMats: THREE.ShaderMaterial[] = [];
  const signs = p.charges;
  signs.forEach((q, i) => {
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: CHARGE_FRAG,
      uniforms: {
        color: { value: new THREE.Color(q > 0 ? "#FF5A3A" : "#3AC8FF") },
        pulse: { value: 0 },
        glyph: { value: glyphTexture(q > 0 ? "+" : "−") },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    chargeMats.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(DISC_R * 8, DISC_R * 8), mat);
    m.position.set(i === 0 ? -CHARGE_X : CHARGE_X, 0, 1);
    m.renderOrder = 10;
    scene.add(m);
  });

  const post = new Post(gl, w, h, {
    bloom: { strength: 0.9, threshold: 0.35, knee: 0.3, levels: 6, radius: 0.85 },
    grain: 0.015, grainGate: true, shoulder: 0.75,
    vignette: { amount: 0.35, start: 0.5, end: 1.3 },
  });

  const tmp: V3 = [0, 0, 0];
  return {
    render(frame) {
      const t = loopPhase(frame);
      for (const m of [glow, core]) (m.material as THREE.ShaderMaterial).uniforms.time.value = t;
      part.forEach((d, i) => {
        const u = (t * d.trips + d.phase) % 1;
        d.seg.at(u * d.seg.length, tmp);
        dots.pos.set(tmp, i * 3);
        const fade = Math.min(1, u / 0.04, (1 - u) / 0.04);
        dots.rgba.set([d.color.r * 1.1, d.color.g * 1.1, d.color.b * 1.1, fade * (d.big ? 0.85 : 0.18)], i * 4);
        dots.size[i] = d.size;
      });
      dots.update();
      chargeMats.forEach((m, i) => {
        m.uniforms.pulse.value = 0.5 + 0.5 * Math.sin(TAU * (t * 5 + i * 0.5));
      });
      cam.position.x = 0.012 * Math.sin(TAU * t);
      cam.position.y = 0.008 * Math.sin(TAU * t * 2 + 0.7);
      cam.updateMatrixWorld();
      post.render(scene, cam, frame);
    },
    dispose() {
      post.dispose();
      geo.dispose();
      dots.dispose();
    },
  };
};
