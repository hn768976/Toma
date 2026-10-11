import * as THREE from "three";
import { clamp, easeOutBack, TAU } from "../lib/ease";
import { Look } from "../lib/LookCanvas";
import { Pipeline } from "../lib/post";
import { mulberry32 } from "../lib/random";

export type FlowPalette = {
  bgLow: string;
  bgHigh: string;
  shape: string;
  shapeSide: string;
  line: string;
  shadow: number; // shadow opacity (0 = none)
  glow: number; // emissive share (cyan-on-navy glow)
  bloom: boolean;
  vignette: number;
  vignetteColor: string;
};

export const BLUE_WHITE: FlowPalette = {
  bgLow: "#F6F8FA",
  bgHigh: "#F6F8FA",
  shape: "#1A8AE8",
  shapeSide: "#0F62B0",
  line: "#1A1A1A",
  shadow: 0.7,
  glow: 1.0,
  bloom: false,
  vignette: 0.06,
  vignetteColor: "#C9D0D8",
};

export const CYAN_NAVY: FlowPalette = {
  bgLow: "#081428",
  bgHigh: "#0C1C38",
  shape: "#3AD8F0",
  shapeSide: "#1A7A98",
  line: "#9AC8F0",
  shadow: 0.55,
  glow: 0.75,
  bloom: true,
  vignette: 0.35,
  vignetteColor: "#030810",
};

export const DURATION = 450;
type Kind = "rect" | "diamond" | "circle" | "triangle" | "para" | "arrow";
type Node = { x: number; y: number; w: number; h: number; kind: Kind; appear: number; trigger: number };
type Edge = { pts: THREE.Vector2[]; from: number; to: number; start: number; dur: number };

// ---- camera path along the strip (pure function of frame, tabulated at module level) ----
const ROW = 0.92;
const CAM_D = 10.2; // distance camera → target
const TILT = THREE.MathUtils.degToRad(21); // from the surface normal
const LEAD = 2.0; // nodes pop when they come this far ahead of the camera target
const CAM_Y: number[] = (() => {
  const v = (f: number) => {
    const ein = clamp(f / 30);
    const ramp = ein * ein * (3 - 2 * ein); // slight ease at the start
    const out = clamp((f - 390) / 60);
    const slow = 1 - 0.93 * (out * out * (3 - 2 * out)); // last 2 s → near-hold
    return 0.046 * (0.25 + 0.75 * ramp) * slow; // units per frame
  };
  const ys = [0];
  for (let f = 1; f <= DURATION; f++) ys.push(ys[f - 1] + v(f - 0.5));
  return ys;
})();
const camY = (f: number) => CAM_Y[Math.max(0, Math.min(DURATION, Math.floor(f)))];

// ---- seeded flowchart graph (module level) ----
const buildGraph = () => {
  const r = mulberry32(0x0f1c4a77);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const KINDS: Kind[] = ["rect", "diamond", "circle", "triangle", "para", "arrow"];
  const size = (k: Kind): [number, number] => {
    switch (k) {
      case "rect":
        return r() < 0.5 ? [0.7 + r() * 0.7, 0.45 + r() * 0.3] : [0.45 + r() * 0.25, 0.7 + r() * 0.5];
      case "diamond":
        return [0.55 + r() * 0.2, 0.55 + r() * 0.2];
      case "circle": {
        const d = 0.45 + r() * 0.25;
        return [d * (1 + r() * 0.3), d];
      }
      case "triangle":
        return [0.7 + r() * 0.3, 0.7 + r() * 0.2];
      case "para":
        return [0.8 + r() * 0.4, 0.38 + r() * 0.12];
      case "arrow":
        return [0.42 + r() * 0.1, 0.6 + r() * 0.15];
    }
  };
  const pick = (): Kind => {
    const u = r();
    return u < 0.38 ? "rect" : u < 0.58 ? "diamond" : u < 0.72 ? "circle" : u < 0.82 ? "arrow" : u < 0.91 ? "para" : "triangle";
  };
  const add = (x: number, y: number, kind: Kind, wh?: [number, number]) => {
    const [w, h] = wh ?? size(kind);
    nodes.push({ x, y, w: w * 0.68, h: h * 0.68, kind, appear: 0, trigger: 0 });
    return nodes.length - 1;
  };
  const link = (a: number, b: number, style: "straight" | "bus" | "diag") => {
    const A = nodes[a];
    const B = nodes[b];
    let pts: THREE.Vector2[];
    if (style === "straight" || Math.abs(A.x - B.x) < 1e-3) pts = [new THREE.Vector2(A.x, A.y), new THREE.Vector2(B.x, B.y)];
    else if (style === "diag") pts = [new THREE.Vector2(A.x, A.y), new THREE.Vector2(B.x, B.y)];
    else {
      const ym = (A.y + B.y) / 2;
      pts = [new THREE.Vector2(A.x, A.y), new THREE.Vector2(A.x, ym), new THREE.Vector2(B.x, ym), new THREE.Vector2(B.x, B.y)];
    }
    edges.push({ pts, from: a, to: b, start: 0, dur: 0 });
  };
  const LANES: Record<number, number[]> = { 2: [-1.0, 1.0], 3: [-1.3, 0, 1.3], 4: [-2.0, -0.68, 0.68, 2.0] };

  let y = -3.5;
  let spine = add(0, y, "rect", [1.6, 0.6]);
  y += ROW;
  const outer: Record<string, number | null> = { L: null, R: null };
  const END = camY(DURATION) + 4;
  let sections = 0;
  while (y < END) {
    const split = sections % 2 === 1 || r() < 0.25;
    sections++;
    if (!split) {
      const n = add(0, y, sections === 1 ? "circle" : pick());
      link(spine, n, "straight");
      spine = n;
      y += ROW;
      continue;
    }
    const k = 2 + Math.floor(r() * 3);
    const xs = LANES[k];
    const depth = 2 + Math.floor(r() * 2);
    let prev: number[] = [];
    for (let row = 0; row < depth; row++) {
      // symmetric pair types, centre lane on the spine
      const kinds: Kind[] = [];
      for (let i = 0; i < Math.ceil(k / 2); i++) kinds.push(pick());
      const maxW = ((xs[1] - xs[0]) * 0.78);
      const sizes = kinds.map((kk) => {
        const [w, h] = size(kk);
        return [Math.min(w, maxW), h] as [number, number];
      });
      const cur: number[] = [];
      xs.forEach((x, i) => {
        const j = Math.min(i, k - 1 - i);
        cur.push(add(x, y, kinds[j], sizes[j]));
      });
      if (row === 0) cur.forEach((c) => link(spine, c, "bus"));
      else cur.forEach((c, i) => link(prev[i], c, r() < 0.15 ? "diag" : "straight"));
      prev = cur;
      // outer columns run beside the lanes, with diagonal runs as in the reference
      for (const side of ["L", "R"] as const) {
        if (r() < 0.55) {
          const sx = (side === "L" ? -1 : 1) * (3.05 + r() * 0.4);
          const kk: Kind = r() < 0.6 ? "rect" : KINDS[Math.floor(r() * KINDS.length)];
          const [w0, h0] = size(kk);
          const n = add(sx, y + (r() - 0.5) * 0.4, kk, [Math.min(w0, 0.75), h0]);
          const o = outer[side];
          if (o !== null && nodes[n].y - nodes[o].y < ROW * 4) link(o, n, "diag");
          else link(cur[side === "L" ? 0 : cur.length - 1], n, "bus");
          outer[side] = n;
        }
      }
      y += ROW;
    }
    const join = add(0, y, pick());
    prev.forEach((p) => link(p, join, "bus"));
    spine = join;
    y += ROW;
  }

  // pop-in triggers from the camera path; initially visible nodes cascade in over ~1 s
  // The pop-in wavefront runs LEAD ahead of the camera; when the camera eases into its final
  // near-hold it keeps going a little so the held view is a fully built section.
  const y0 = camY(0);
  const wave = (f: number) =>
    f < 390 ? camY(f) + LEAD : Math.min(camY(390) + LEAD + (f - 390) * 0.06, camY(DURATION) + 2.9);
  for (const n of nodes) {
    let f = 0;
    while (f < DURATION && wave(f) < n.y) f++;
    n.trigger = f === 0 ? 3 + Math.max(0, (n.y - (y0 - 3)) * 3.2) : f;
  }
  // parents first (nodes are created in y order): connector draws after parent appears, child after connector
  const incoming: Edge[][] = nodes.map(() => []);
  edges.forEach((e) => incoming[e.to].push(e));
  nodes.forEach((n, i) => {
    let ready = n.trigger;
    for (const e of incoming[i]) {
      const len = e.pts.reduce((s, p, k) => (k ? s + p.distanceTo(e.pts[k - 1]) : 0), 0);
      e.dur = Math.round(6 + Math.min(4, len * 1.6));
      e.start = Math.max(nodes[e.from].appear + 3, n.trigger - e.dur);
      ready = Math.max(ready, e.start + e.dur - 1);
    }
    n.appear = i === 0 ? 2 : ready;
  });
  return { nodes, edges };
};
const GRAPH = buildGraph();

// ---- geometry ----
const shapeOf = (n: Node) => {
  const s = new THREE.Shape();
  const { w, h } = n;
  switch (n.kind) {
    case "rect":
      s.moveTo(-w / 2, -h / 2).lineTo(w / 2, -h / 2).lineTo(w / 2, h / 2).lineTo(-w / 2, h / 2).lineTo(-w / 2, -h / 2);
      break;
    case "diamond":
      s.moveTo(0, -h / 2).lineTo(w / 2, 0).lineTo(0, h / 2).lineTo(-w / 2, 0).lineTo(0, -h / 2);
      break;
    case "circle":
      s.absellipse(0, 0, w / 2, h / 2, 0, TAU, false, 0);
      break;
    case "triangle": // pointing back toward the spine's origin (downward), as in the reference
      s.moveTo(-w / 2, h / 2).lineTo(w / 2, h / 2).lineTo(0, -h / 2).lineTo(-w / 2, h / 2);
      break;
    case "para": {
      const k = w * 0.2;
      s.moveTo(-w / 2, -h / 2).lineTo(w / 2 - k, -h / 2).lineTo(w / 2, h / 2).lineTo(-w / 2 + k, h / 2).lineTo(-w / 2, -h / 2);
      break;
    }
    case "arrow": // pentagon arrow (house) pointing forward
      s.moveTo(-w / 2, -h / 2).lineTo(w / 2, -h / 2).lineTo(w / 2, h * 0.15).lineTo(0, h / 2).lineTo(-w / 2, h * 0.15).lineTo(-w / 2, -h / 2);
      break;
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 40,
  });
  return g;
};

const LINE_VERT = /* glsl */ `
attribute vec3 aLine; // x: along, y: total, z: across (-1..1)
attribute vec2 aTime; // start, dur
varying vec3 vLine; varying vec2 vTime;
void main() { vLine = aLine; vTime = aTime; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const LINE_FRAG = /* glsl */ `
uniform float frame; uniform vec3 color; uniform float halfW; uniform float pad;
varying vec3 vLine; varying vec2 vTime;
void main() {
  float prog = clamp((frame - vTime.x) / vTime.y, 0.0, 1.0);
  float head = prog * vLine.y;
  if (prog <= 0.0) discard;
  float alongA = smoothstep(head + 0.004, head - 0.004, vLine.x);
  float d = abs(vLine.z) * pad;         // world distance from centre line
  float aa = fwidth(d) * 0.9 + 1e-6;
  float cov = clamp((halfW - d) / aa + 0.5, 0.0, 1.0);
  cov = mix(cov, clamp(halfW / aa, 0.0, 1.0) * exp(-d * d / (aa * aa)), step(halfW, aa)); // sub-pixel → energy-preserving
  float a = cov * alongA;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(color, a);
}
`;

const SHADOW_VERT = /* glsl */ `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SHADOW_FRAG = /* glsl */ `
uniform vec2 size; uniform float kind; uniform float opacity; uniform float blur; uniform float scale;
varying vec2 vP;
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  vec2 p = vP / max(scale, 1e-3);
  float d;
  if (kind < 0.5) d = sdBox(p, size * 0.5);
  else if (kind < 1.5) { vec2 q = abs(p) / (size * 0.5); d = (q.x + q.y - 1.0) * min(size.x, size.y) * 0.35; }
  else if (kind < 2.5) d = length(p / (size * 0.5)) * min(size.x, size.y) * 0.5 - min(size.x, size.y) * 0.5;
  else d = sdBox(p, size * vec2(0.42, 0.45));
  float a = (1.0 - smoothstep(-blur, blur, d)) * opacity;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`;

const BG_FRAG = /* glsl */ `
uniform vec3 cLow; uniform vec3 cHigh; varying vec2 vUv;
void main() { gl_FragColor = vec4(mix(cLow, cHigh, smoothstep(0.0, 1.0, vUv.y)), 1.0); }
`;

export const createFlowchart = (pal: FlowPalette) => (): Look => {
  const pipe = new Pipeline(4);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 16 / 9, 0.5, 60);
  const { nodes, edges } = GRAPH;

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: BG_FRAG,
      depthWrite: false,
      uniforms: { cLow: { value: new THREE.Color(pal.bgLow) }, cHigh: { value: new THREE.Color(pal.bgHigh) } },
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // connectors: one mesh, draw-on in the shader
  const LINE_HALF = 0.0085;
  const PAD = 0.03;
  {
    const pos: number[] = [];
    const line: number[] = [];
    const time: number[] = [];
    const idx: number[] = [];
    let base = 0;
    for (const e of edges) {
      const cum = [0];
      for (let k = 1; k < e.pts.length; k++) cum.push(cum[k - 1] + e.pts[k].distanceTo(e.pts[k - 1]));
      const total = cum[cum.length - 1];
      for (let k = 0; k < e.pts.length - 1; k++) {
        const a = e.pts[k];
        const b = e.pts[k + 1];
        const t = new THREE.Vector2().subVectors(b, a).normalize();
        const n = new THREE.Vector2(-t.y, t.x);
        // extend each segment by the pad so elbows join cleanly
        const a2 = a.clone().addScaledVector(t, -LINE_HALF);
        const b2 = b.clone().addScaledVector(t, LINE_HALF);
        const ends: [THREE.Vector2, number][] = [
          [a2, cum[k] - LINE_HALF],
          [b2, cum[k + 1] + LINE_HALF],
        ];
        for (const [p, al] of ends)
          for (const side of [-1, 1]) {
            pos.push(p.x + n.x * PAD * side, p.y + n.y * PAD * side, 0.004);
            line.push(Math.max(0, al), total, side);
            time.push(e.start, e.dur);
          }
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        base += 4;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aLine", new THREE.Float32BufferAttribute(line, 3));
    g.setAttribute("aTime", new THREE.Float32BufferAttribute(time, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        vertexShader: LINE_VERT,
        fragmentShader: LINE_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          frame: { value: 0 },
          color: { value: new THREE.Color(pal.line) },
          halfW: { value: LINE_HALF },
          pad: { value: PAD },
        },
      }),
    );
    m.frustumCulled = false;
    m.renderOrder = 1;
    scene.add(m);
  }
  const lineMat = (scene.children[scene.children.length - 1] as THREE.Mesh).material as THREE.ShaderMaterial;

  // shapes + shadows
  const shapeColor = new THREE.Color(pal.shape);
  const items = nodes.map((n) => {
    // flat, unlit face in the exact shape colour (as in the reference); only the thin sides are shaded
    const mat = new THREE.MeshBasicMaterial({ color: shapeColor.clone(), transparent: true });
    const side = new THREE.MeshStandardMaterial({
      color: new THREE.Color(pal.shapeSide).multiplyScalar(0.6),
      emissive: new THREE.Color(pal.shapeSide).multiplyScalar(pal.glow * 0.8),
      roughness: 0.6,
      transparent: true,
    });
    const mesh = new THREE.Mesh(shapeOf(n), [mat, side]);
    mesh.position.set(n.x, n.y, 0.05);
    mesh.renderOrder = 3;
    const kindIdx = n.kind === "rect" || n.kind === "para" ? 0 : n.kind === "diamond" ? 1 : n.kind === "circle" ? 2 : 3;
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(n.w + 0.5, n.h + 0.5),
      new THREE.ShaderMaterial({
        vertexShader: SHADOW_VERT,
        fragmentShader: SHADOW_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          size: { value: new THREE.Vector2(n.w, n.h) },
          kind: { value: kindIdx },
          opacity: { value: pal.shadow },
          blur: { value: 0.012 },
          scale: { value: 1 },
        },
      }),
    );
    sh.position.set(n.x + 0.028, n.y - 0.034, 0.002);
    sh.renderOrder = 2;
    scene.add(sh, mesh);
    return { n, mesh, mat, side, sh };
  });

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-2, 3, 6);
  scene.add(key);
  const clear = new THREE.Color(pal.bgLow);

  return {
    render(gl, frame) {
      const f = ((frame % DURATION) + DURATION) % DURATION;
      const cy = camY(f);
      const sway = THREE.MathUtils.degToRad(1.6) * Math.sin((TAU * f) / DURATION);
      const target = new THREE.Vector3(0, cy, 0);
      camera.position.set(
        Math.sin(sway) * CAM_D * Math.sin(TILT),
        cy - Math.cos(sway) * CAM_D * Math.sin(TILT),
        CAM_D * Math.cos(TILT),
      );
      camera.up.set(0, 0, 1);
      camera.lookAt(target);
      camera.updateMatrixWorld();

      for (const it of items) {
        const t = (f - it.n.appear) / 8;
        const vis = t > 0;
        it.mesh.visible = vis;
        it.sh.visible = vis;
        if (!vis) continue;
        const s = Math.max(0.001, easeOutBack(t, 2.2));
        const a = clamp(t * 1.6);
        it.mesh.scale.set(s, s, 1);
        it.mat.opacity = a;
        it.side.opacity = a;
        it.mat.transparent = a < 1;
        it.side.transparent = a < 1;
        it.mat.depthWrite = a >= 1;
        const su = (it.sh.material as THREE.ShaderMaterial).uniforms;
        su.opacity.value = pal.shadow * a;
        su.scale.value = s;
      }
      lineMat.uniforms.frame.value = f;

      pipe.begin(gl, clear);
      camera.aspect = pipe.w / pipe.h;
      camera.updateProjectionMatrix();
      gl.render(scene, camera);
      pipe.finish(gl, {
        camera,
        bloom: pal.bloom ? { strength: 0.55, threshold: 0.45, knee: 0.3, levels: 6, falloff: 0.6 } : undefined,
        final: {
          frame: f,
          period: DURATION,
          grain: 0.015,
          vignette: pal.vignette,
          vignetteColor: new THREE.Color(pal.vignetteColor),
        },
      });
    },
    dispose() {
      pipe.dispose();
    },
  };
};
