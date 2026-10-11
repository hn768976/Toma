import {
  Color,
  CustomBlending,
  Group,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  TorusGeometry,
  type Object3D,
} from "three";
import { easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp, ramp } from "../../lib/anim";
import { mulberry32 } from "../../lib/random";
import { PAL, fillMaterial, makeLabel, rectMesh } from "../kit";
import type { StoryBuilder } from "../pipeline";

/** 1B — AIDA Funnel (450 frames). */

const ROWS = [5, 9, 11, 13, 11, 9, 7, 5]; // 70 figures in a diamond
const ROW_COLORS = [PAL.violet, PAL.blue, PAL.cyan, PAL.white, PAL.cyan, PAL.blue, "#8A5AFF", PAL.violet];
const rng = mulberry32(518508598);
const PEOPLE = ROWS.flatMap((n, r) =>
  Array.from({ length: n }, (_, k) => ({
    r,
    k,
    n,
    jitter: rng(),
    tx: (rng() - 0.5) * 2.4,
    ty: (rng() - 0.5) * 0.5,
  })),
);

const FUNNEL_X = -1.35;
// 9 rings: [radius, height] in funnel space; sections 3 / 2 / 2 / 2
const RINGS: [number, number][] = [
  [1.48, 2.2], [1.41, 1.98], [1.34, 1.76],
  [1.18, 1.2], [1.1, 0.98],
  [0.93, 0.42], [0.86, 0.2],
  [0.64, -0.5], [0.63, -0.72],
];
const RING_COLORS = ["#B050F0", "#AA58F0", "#A060F2", "#8A80F4", "#7C92F6", "#6AC0F6", "#70CCF8", "#E4E0FF", "#ECE8FF"];
const SECTIONS = [
  { word: "Awareness", rings: [0, 1, 2], color: PAL.violet },
  { word: "Interest", rings: [3, 4], color: "#4A72F0" },
  { word: "Decision", rings: [5, 6], color: "#2AB0F0" },
  { word: "Action", rings: [7, 8], color: "#DCE4FF" },
];
const RING_START = (i: number) => 150 + i * 18;
const RING_DUR = 16;

const order = <T extends Object3D>(o: T, r: number): T => {
  o.renderOrder = r;
  return o;
};

const RING_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const RING_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uDraw; uniform float uGain; uniform float uOpacity;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  // draw-on: symmetric sweep from the front centre around both sides
  float a = abs(fract(vUv.x + 0.25) - 0.5) * 2.0;     // 0 at front, 1 at back
  float m = uDraw >= 1.0 ? 1.0 : 1.0 - smoothstep(uDraw - 0.01, uDraw, a);
  float rim = pow(1.0 - abs(dot(vN, vV)), 0.6);
  float core = 0.75 + 0.5 * (1.0 - rim);
  float al = m * uOpacity;
  gl_FragColor = vec4(uColor * core * uGain * al, al);
}`;

export const aidaFunnel: StoryBuilder = ({ anisotropy }) => {
  const root = new Group();

  // ---------------- people diamond ---------------------------------------
  const person = (() => {
    const head = new Shape();
    head.absarc(0, 0.115, 0.046, 0, Math.PI * 2, false);
    const body = new Shape();
    const w = 0.056, top = 0.058, hip = -0.035, foot = -0.14, gap = 0.008, rr = 0.026;
    body.moveTo(-w + rr, top);
    body.lineTo(w - rr, top);
    body.quadraticCurveTo(w, top, w, top - rr);
    body.lineTo(w, hip);
    body.lineTo(w * 0.78, hip);
    body.lineTo(w * 0.78, foot);
    body.lineTo(gap, foot);
    body.lineTo(gap, hip + 0.01);
    body.lineTo(-gap, hip + 0.01);
    body.lineTo(-gap, foot);
    body.lineTo(-w * 0.78, foot);
    body.lineTo(-w * 0.78, hip);
    body.lineTo(-w, hip);
    body.lineTo(-w, top - rr);
    body.quadraticCurveTo(-w, top, -w + rr, top);
    return new ShapeGeometry([head, body], 24);
  })();
  const people = new Group();
  people.position.set(-0.75, 0.55, 0.1);
  root.add(people);
  const figures = PEOPLE.map((p) => {
    const mat = fillMaterial(ROW_COLORS[p.r], 1);
    mat.uniforms.uGain.value = 1.05;
    const m = order(new Mesh(person, mat), 5);
    const home = [(p.k - (p.n - 1) / 2) * 0.235, (3.5 - p.r) * 0.33] as const;
    m.position.set(home[0], home[1], 0);
    people.add(m);
    return { m, p, home };
  });

  // ---------------- funnel of 3D rings -------------------------------------
  const funnel = new Group();
  funnel.position.set(FUNNEL_X, -0.85, -0.2);
  funnel.rotation.x = 0.48; // view from slightly above
  root.add(funnel);
  const rings = RINGS.map(([r, y], i) => {
    const mat = new ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      uniforms: {
        uColor: { value: new Color(RING_COLORS[i]) },
        uDraw: { value: 0 },
        uGain: { value: 1.2 },
        uOpacity: { value: 1 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
    });
    const m = new Mesh(new TorusGeometry(r, 0.013, 10, 320), mat);
    m.rotation.x = Math.PI / 2;
    m.position.y = y;
    funnel.add(order(m, 8));
    return m;
  });

  // ---------------- gradient label bars -----------------------------------
  const bars = SECTIONS.map((s, i) => {
    const ys = s.rings.map((k) => RINGS[k][1]);
    const yMid = (Math.max(...ys) + Math.min(...ys)) / 2;
    const yLayer = yMid * Math.cos(0.48) - 0.85;
    const g = new Group();
    g.position.set(0, yLayer, -0.35);
    const bar = rectMesh(6.0, 0.6, s.color, 0.72);
    bar.geometry.translate(3.0, 0, 0);
    bar.position.x = FUNNEL_X;
    // geometry spans local x [0, 6]: soft start at the funnel edge, fade out to the right
    const rEdge = RINGS[s.rings[0]][0];
    bar.material.uniforms.uFadeIn.value = [rEdge * 0.75, rEdge * 0.95];
    bar.material.uniforms.uFade.value = [rEdge * 2.2, 6.0, 0.0];
    const lbl = makeLabel(s.word, { em: 0.5, align: "left", anisotropy, glow: 0.1, weight: 300 });
    lbl.mesh.position.set(0.55, 0.0, 0.3);
    g.add(order(bar, 2), order(lbl.mesh, 10));
    root.add(g);
    const done = RING_START(s.rings[s.rings.length - 1]) + RING_DUR - 6;
    return { g, bar, lbl, done };
  });

  const update = (f: number) => {
    // people pop row by row (top to bottom), then stream into the funnel top
    for (const { m, p, home } of figures) {
      const t0 = 6 + p.r * 13 + Math.abs(p.k - (p.n - 1) / 2) * 1.2;
      const popT = ramp(f, t0, t0 + 11);
      let s = popT <= 0 ? 0 : easeOutBack(popT);
      const st = ramp(f, 118 + (7 - p.r) * 1.5 + p.jitter * 8, 146 + (7 - p.r) * 1.5 + p.jitter * 8);
      const e = easeInCubic(st);
      const tx = FUNNEL_X - people.position.x + p.tx;
      const ty = 2.2 * Math.cos(0.48) - 0.85 - people.position.y + 0.1 + p.ty;
      m.position.set(lerp(home[0], tx, e), lerp(home[1], ty, e), 0);
      s *= lerp(1, 0.3, easeOutCubic(st));
      m.scale.setScalar(Math.max(s, 1e-4));
      m.material.uniforms.uOpacity.value = Math.min(1, popT * 3) * (1 - ramp(st, 0.45, 1));
    }

    // rings draw top to bottom; in the hold they pulse in sequence
    rings.forEach((m, i) => {
      const t = easeInOutCubic(ramp(f, RING_START(i), RING_START(i) + RING_DUR));
      m.material.uniforms.uDraw.value = t;
      m.material.uniforms.uOpacity.value = ramp(f, RING_START(i), RING_START(i) + 2);
      let pulse = 0;
      if (f >= 330) {
        const ph = ((f - 330) / 40 - i / 10) % 1;
        const php = ph < 0 ? ph + 1 : ph;
        pulse = Math.exp(-Math.pow((php - 0.2) / 0.09, 2)) * ramp(f, 330, 345);
      }
      m.material.uniforms.uGain.value = 1.2 + 0.8 * pulse;
    });

    // bars slide in once each section completes
    for (const b of bars) {
      const t = easeOutCubic(ramp(f, b.done, b.done + 18));
      b.g.position.x = lerp(-1.2, 0, t);
      b.bar.material.uniforms.uOpacity.value = 0.72 * t;
      b.lbl.setOpacity(ramp(f, b.done + 4, b.done + 18));
      b.lbl.mesh.position.x = lerp(0.2, 0.55, t);
    }
  };

  return { group: root, update };
};
