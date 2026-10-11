import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { lin } from "../lib/color";
import { LookFactory } from "../lib/LookCanvas";
import { phase, TAU, wave } from "../lib/loop";
import { defaultPost } from "../lib/post";
import { mulberry32, Rng } from "../lib/random";

export interface AiChipParams {
  line: string;
  label: string;
  bgTop: string;
  bgBottom: string;
}

type Seg = [number, number, number, number, number, number];

/** Collects line segments (with a brightness per segment). */
class Lines {
  pos: number[] = [];
  col: number[] = [];
  seg(a: THREE.Vector3Like, b: THREE.Vector3Like, k = 1) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    this.col.push(k, k, k, k, k, k);
  }
  poly(pts: THREE.Vector3Like[], closed: boolean, k = 1) {
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) this.seg(pts[i], pts[(i + 1) % pts.length], k);
  }
  rectXZ(x: number, z: number, w: number, d: number, y: number, k = 1) {
    const v = (a: number, b: number) => ({ x: a, y, z: b });
    this.poly([v(x - w / 2, z - d / 2), v(x + w / 2, z - d / 2), v(x + w / 2, z + d / 2), v(x - w / 2, z + d / 2)], true, k);
  }
  box(x: number, z: number, w: number, d: number, h: number, k = 1) {
    this.rectXZ(x, z, w, d, 0, k * 0.6);
    this.rectXZ(x, z, w, d, h, k);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
      this.seg({ x: x + (sx * w) / 2, y: 0, z: z + (sz * d) / 2 }, { x: x + (sx * w) / 2, y: h, z: z + (sz * d) / 2 }, k * 0.8);
  }
  circle(x: number, z: number, r: number, y: number, k = 1, n = 20) {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: x + r * Math.cos((i / n) * TAU), y, z: z + r * Math.sin((i / n) * TAU) });
    this.poly(pts, true, k);
  }
  cylinder(x: number, z: number, r: number, h: number, k = 1) {
    for (let i = 0; i <= 3; i++) this.circle(x, z, r, (h * i) / 3, k * (i === 3 ? 1 : 0.55));
    for (const a of [0.25, 0.75, 0.0, 0.5]) {
      const cx = x + r * Math.cos(a * TAU);
      const cz = z + r * Math.sin(a * TAU);
      this.seg({ x: cx, y: 0, z: cz }, { x: cx, y: h, z: cz }, k * 0.5);
    }
  }
  build(color: THREE.Color, widthPx: number, opacity: number) {
    const g = new LineSegmentsGeometry();
    g.setPositions(this.pos);
    const c = this.col.map((k, i) => k * [color.r, color.g, color.b][i % 3]);
    g.setColors(c);
    const m = new LineMaterial({
      vertexColors: true,
      linewidth: widthPx,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new LineSegments2(g, m);
  }
}

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

// invented filler code — made-up identifiers, no real API
const TOKENS = {
  fn: ["lattice", "qmix", "tensor_fold", "synapse_step", "vec_braid", "kern_shift", "nodeweave", "pulse_gate", "grad_skein", "axon_pack", "flux_tile", "neuro_hash"],
  var: ["k7", "q3", "w_in", "acc", "zeta", "rho2", "h0", "lane", "tile_n", "sig", "mu", "delta4", "b9", "phi"],
  kw: ["let", "fn", "emit", "yield", "mut", "loop", "ret"],
};
const codeLine = (r: Rng) => {
  const p = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const hex = () => "0x" + Math.floor(r() * 0xffff).toString(16).padStart(4, "0");
  const forms = [
    () => `${p(TOKENS.kw)} ${p(TOKENS.var)} = ${p(TOKENS.fn)}(${p(TOKENS.var)}, ${hex()});`,
    () => `${p(TOKENS.fn)}[${Math.floor(r() * 64)}] <- ${p(TOKENS.var)} ^ ${p(TOKENS.var)} >> ${1 + Math.floor(r() * 7)};`,
    () => `fn ${p(TOKENS.fn)}(${p(TOKENS.var)}: u${p(["8", "16", "32"])}) -> ${p(TOKENS.var)} {`,
    () => `  ${p(TOKENS.var)}.${p(TOKENS.fn)}(${hex()}, ${(r() * 9).toFixed(3)});`,
    () => `}  // ${p(TOKENS.fn)} ${hex()}`,
    () => `${p(TOKENS.var)}[${Math.floor(r() * 16)}] = ${p(TOKENS.var)} * ${(r() * 2).toFixed(4)} + ${p(TOKENS.var)};`,
  ];
  return p(forms)();
};

/** A tiling code/binary texture (tiles vertically, so it scrolls in whole periods). */
const codeTexture = (seed: number, W: number, H: number, kind: "code" | "binary" | "mixed", fs: number) => {
  const r = mulberry32(seed);
  const c = canvas(W, H);
  const x = c.getContext("2d")!;
  x.clearRect(0, 0, W, H);
  x.font = `400 ${fs}px "JetBrains Mono"`;
  x.textBaseline = "top";
  const rows = Math.floor(H / (fs * 1.5));
  const lh = H / rows;
  if (kind !== "binary") {
    // blocks of code lines, left-aligned at a few columns
    let row = 0;
    while (row < rows) {
      const col = r() < 0.5 ? 0 : W * 0.68;
      const n = 2 + Math.floor(r() * 6);
      for (let i = 0; i < n && row < rows; i++, row++) {
        x.fillStyle = `rgba(255,255,255,${0.45 + r() * 0.55})`;
        x.fillText(codeLine(r), col + 8, row * lh);
      }
      row += 1 + Math.floor(r() * 4);
    }
  }
  if (kind !== "code") {
    const cols = kind === "binary" ? 46 : 0;
    for (let k = 0; k < cols; k++) {
      const cx = Math.floor(r() * (W - fs));
      x.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.5})`;
      for (let i = 0; i < rows; i++) if (r() < 0.85) x.fillText(r() < 0.5 ? "0" : "1", cx, i * lh);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.NoColorSpace;
  return t;
};

const labelTexture = (label: THREE.Color) => {
  const W = 1024;
  const H = 768;
  const c = canvas(W, H);
  const x = c.getContext("2d")!;
  x.clearRect(0, 0, W, H);
  const r = 120;
  const pad = 70;
  const rr = () => {
    x.beginPath();
    x.roundRect(pad, pad, W - 2 * pad, H - 2 * pad, r);
  };
  // soft halo
  x.shadowColor = "rgba(255,255,255,0.9)";
  x.shadowBlur = 50;
  x.strokeStyle = "rgba(255,255,255,0.85)";
  x.lineWidth = 12;
  rr();
  x.stroke();
  x.shadowBlur = 0;
  // faint fill
  x.fillStyle = "rgba(255,255,255,0.05)";
  rr();
  x.fill();
  x.font = `800 ${Math.round(H * 0.62)}px "Blinker"`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.shadowColor = "rgba(255,255,255,1)";
  x.shadowBlur = 18;
  x.fillStyle = "rgba(255,255,255,1)";
  x.fillText("AI", W / 2, H / 2 + H * 0.03);
  x.shadowBlur = 0;
  x.fillText("AI", W / 2, H / 2 + H * 0.03);
  void label;
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 16;
  t.colorSpace = THREE.NoColorSpace;
  return t;
};

const ADD_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

export const aiChip: LookFactory<AiChipParams> = (p, gl) => {
  const rng = mulberry32(0xa1c41b);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 60);
  const post = defaultPost();
  const line = lin(p.line);
  const label = lin(p.label);
  const size = gl.getDrawingBufferSize(new THREE.Vector2());
  const pxScale = size.y / 2160;
  // ~2 px at 4K; below 1 px we keep 1 px and dim instead, so brightness matches
  const lw = Math.max(1, 2.2 * pxScale);
  const lwDim = Math.min(1, (2.2 * pxScale) / lw);

  // ---- background: gradient + glow behind the chip, at the far plane ----
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: { uTop: { value: lin(p.bgTop) }, uBot: { value: lin(p.bgBottom) }, uGlow: { value: line.clone() } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uGlow; varying vec2 vUv;
        void main(){
          float t = clamp(vUv.y * 0.75 + (1.0 - vUv.x) * 0.45 - 0.1, 0.0, 1.0);
          vec3 c = mix(uBot, uTop, smoothstep(0.0, 1.0, t));
          vec2 q = (vUv - vec2(0.58, 0.55)) * vec2(1.78, 1.0);
          c += uGlow * 0.06 * exp(-dot(q, q) * 5.0);
          c += uTop * 0.9 * exp(-pow((vUv.x - 0.05) * 3.2, 2.0)) * (0.4 + 0.6 * vUv.y);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);
  // depth proxy for DoF: the board plane, depth only
  const proxy = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ colorWrite: false }));
  proxy.rotation.x = -Math.PI / 2;
  proxy.position.y = -0.03;
  proxy.renderOrder = -5;
  scene.add(proxy);

  // ---- wireframe board ----
  const board = new Lines(); // dim board lines
  const chip = new Lines(); // chip package (pulses)
  const pins = new Lines();
  const B = { w: 16, d: 11 };
  // the board sits right of the chip's left edge: the left of the frame stays open haze
  const BX0 = -4.2;
  board.rectXZ((BX0 + B.w / 2) / 2, 0, B.w / 2 - BX0, B.d, 0, 0.5);
  // package: bevelled square, 0.25 tall
  const P = 2.6;
  const bev = 0.18;
  const pkg = (y: number) => {
    const h = P / 2;
    return [
      { x: -h + bev, y, z: -h }, { x: h - bev, y, z: -h }, { x: h, y, z: -h + bev }, { x: h, y, z: h - bev },
      { x: h - bev, y, z: h }, { x: -h + bev, y, z: h }, { x: -h, y, z: h - bev }, { x: -h, y, z: -h + bev },
    ];
  };
  const PH = 0.22;
  chip.poly(pkg(0), true, 0.7);
  chip.poly(pkg(PH), true, 1.2);
  pkg(0).forEach((a, i) => chip.seg(a, pkg(PH)[i], 0.9));
  // inner die frame and a second outline
  chip.rectXZ(0, 0, 1.9, 1.9, PH + 0.001, 0.9);
  chip.rectXZ(0, 0, 2.3, 2.3, PH + 0.001, 0.45);
  // pins: ~40 per side, gull-wing
  const NPIN = 40;
  for (let s = 0; s < 4; s++) {
    const ang = (s * Math.PI) / 2;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const tr = (u: number, v: number, y: number) => ({ x: u * ca - v * sa, y, z: u * sa + v * ca });
    for (let i = 0; i < NPIN; i++) {
      const u = ((i + 0.5) / NPIN - 0.5) * (P - 2 * bev - 0.1);
      const v0 = P / 2;
      pins.poly([tr(u, v0, PH * 0.5), tr(u, v0 + 0.08, PH * 0.5), tr(u, v0 + 0.13, 0.0), tr(u, v0 + 0.24, 0.0)], false, 0.9);
    }
  }
  // die circuitry inside the package (fine grid of blocks)
  for (let i = 0; i < 26; i++) {
    const x = (rng() - 0.5) * 1.6;
    const z = (rng() - 0.5) * 1.6;
    if (Math.abs(x) < 0.6 && Math.abs(z) < 0.45) continue;
    chip.rectXZ(x, z, 0.08 + rng() * 0.25, 0.06 + rng() * 0.2, PH + 0.001, 0.35);
  }

  // die traces: from the label out to the package edge
  for (let i = 0; i < 36; i++) {
    const side = i % 4;
    const ang = (side * Math.PI) / 2;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const tr = (u: number, v: number) => ({ x: u * ca - v * sa, y: PH + 0.002, z: u * sa + v * ca });
    const u0 = (rng() - 0.5) * 0.9;
    const u1 = u0 * (1.6 + rng() * 0.6);
    const v0 = side % 2 ? 0.7 : 0.53;
    const vm = v0 + 0.1 + rng() * 0.15;
    chip.poly([tr(u0, v0), tr(u0, vm), tr(u1, vm + Math.abs(u1 - u0)), tr(u1, 0.94)], false, 0.75);
  }
  // components around the chip (~60), placed without overlap
  const placed: [number, number, number, number][] = [[0, 0, P + 0.9, P + 0.9]];
  const fits = (x: number, z: number, w: number, d: number) =>
    x - w / 2 > BX0 + 0.2 && x + w / 2 < B.w / 2 - 0.2 && Math.abs(z) + d / 2 < B.d / 2 - 0.2 &&
    placed.every(([px, pz, pw, pd]) => Math.abs(px - x) > (pw + w) / 2 + 0.12 || Math.abs(pz - z) > (pd + d) / 2 + 0.12);
  const comps: [number, number, number, number][] = [];
  // a connector strip with fins (right side) and heat-sink fins
  {
    const x = 4.6;
    const z = -0.3;
    const w = 0.7;
    const d = 4.2;
    board.box(x, z, w, d, 0.35, 0.85);
    for (let i = 0; i < 26; i++) {
      const zz = z - d / 2 + ((i + 0.5) / 26) * d;
      board.seg({ x: x - w / 2, y: 0.35, z: zz }, { x: x + w / 2, y: 0.35, z: zz }, 0.6);
      board.seg({ x: x + w / 2, y: 0.35, z: zz }, { x: x + w / 2, y: 0.0, z: zz }, 0.4);
    }
    placed.push([x, z, w, d]);
    const fx = 2.9;
    const fz = -2.8;
    for (let i = 0; i < 14; i++) {
      const xx = fx - 0.9 + i * 0.14;
      board.poly([{ x: xx, y: 0, z: fz - 0.6 }, { x: xx, y: 0.5, z: fz - 0.6 }, { x: xx, y: 0.5, z: fz + 0.6 }, { x: xx, y: 0, z: fz + 0.6 }], false, 0.7);
    }
    placed.push([fx, fz, 2.1, 1.3]);
  }
  // capacitor row (front-left)
  for (let i = 0; i < 7; i++) {
    const x = -1.6 + i * 0.62;
    const z = 3.9;
    board.cylinder(x, z, 0.22, 0.55, 0.8);
    placed.push([x, z, 0.5, 0.5]);
    comps.push([x, z, 0.5, 0.5]);
  }
  // memory-like chip rows (left)
  for (let i = 0; i < 4; i++) {
    const x = -2.4 + 0 * i;
    const z = -2.4 + i * 1.0;
    board.box(x, z, 1.3, 0.7, 0.12, 0.8);
    for (let k = 0; k < 10; k++) {
      const xx = x - 0.6 + (k + 0.5) * 0.12;
      board.seg({ x: xx, y: 0, z: z - 0.35 }, { x: xx, y: 0, z: z - 0.47 }, 0.6);
      board.seg({ x: xx, y: 0, z: z + 0.35 }, { x: xx, y: 0, z: z + 0.47 }, 0.6);
    }
    placed.push([x, z, 1.3, 0.95]);
    comps.push([x, z, 1.3, 0.95]);
  }
  let tries = 0;
  while (comps.length < 60 && tries++ < 4000) {
    const kind = rng();
    const x = (rng() - 0.5) * (B.w - 1);
    const z = (rng() - 0.5) * (B.d - 1);
    if (kind < 0.35) {
      const w = 0.25 + rng() * 0.9;
      const d = 0.2 + rng() * 0.7;
      if (!fits(x, z, w, d)) continue;
      board.box(x, z, w, d, 0.06 + rng() * 0.2, 0.65 + rng() * 0.3);
      placed.push([x, z, w, d]);
      comps.push([x, z, w, d]);
    } else if (kind < 0.55) {
      const r = 0.12 + rng() * 0.18;
      if (!fits(x, z, 2 * r, 2 * r)) continue;
      board.cylinder(x, z, r, 0.2 + rng() * 0.4, 0.7);
      placed.push([x, z, 2 * r, 2 * r]);
      comps.push([x, z, 2 * r, 2 * r]);
    } else {
      // row of SMD pads
      const n = 4 + Math.floor(rng() * 10);
      const horiz = rng() < 0.5;
      const w = horiz ? n * 0.13 : 0.12;
      const d = horiz ? 0.12 : n * 0.13;
      if (!fits(x, z, w, d)) continue;
      for (let k = 0; k < n; k++) {
        const o = (k + 0.5) * 0.13 - (n * 0.13) / 2;
        board.rectXZ(horiz ? x + o : x, horiz ? z : z + o, 0.07, 0.07, 0, 0.6);
      }
      placed.push([x, z, w, d]);
      comps.push([x, z, w, d]);
    }
  }
  // traces from the pins to components (Manhattan with a 45° bend)
  const traces: [THREE.Vector3[], number][] = [];
  for (let i = 0; i < 240; i++) {
    const side = Math.floor(rng() * 4);
    const u = ((Math.floor(rng() * NPIN) + 0.5) / NPIN - 0.5) * (P - 2 * bev - 0.1);
    const ang = (side * Math.PI) / 2;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const tr = (a: number, b: number) => new THREE.Vector3(a * ca - b * sa, 0.002, a * sa + b * ca);
    const v0 = P / 2 + 0.24;
    const run = 0.3 + rng() * 2.5;
    const bend = (rng() < 0.5 ? -1 : 1) * (0.2 + rng() * 1.2);
    const run2 = 0.2 + rng() * 2;
    const pts = [tr(u, v0), tr(u, v0 + run), tr(u + bend, v0 + run + Math.abs(bend)), tr(u + bend, v0 + run + Math.abs(bend) + run2)];
    if (pts.some((q) => q.x < BX0 + 0.3 || q.x > B.w / 2 - 0.3 || Math.abs(q.z) > B.d / 2 - 0.3)) continue;
    board.poly(pts, false, 0.55);
    traces.push([pts, 0]);
  }
  // long rails running off towards the far edge
  for (let i = 0; i < 6; i++) {
    const x = BX0 + 0.5 + rng() * (B.w / 2 - BX0 - 1);
    board.seg({ x, y: 0.001, z: -B.d / 2 }, { x, y: 0.001, z: -B.d / 2 + 1 + rng() * 3 }, 0.4);
  }
  for (let i = 0; i < 4; i++) {
    const z = -5 + rng() * 10;
    board.seg({ x: B.w / 2 - 2.5 - rng() * 2, y: 0.001, z }, { x: B.w / 2, y: 0.001, z }, 0.4);
  }

  // sparks running along the traces
  const NSP = 70;
  const sparkPos = new Float32Array(NSP * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: label.clone().multiplyScalar(5) }, uSize: { value: 14 * pxScale } },
    vertexShader: `uniform float uSize; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.0, uSize); }`,
    fragmentShader: `uniform vec3 uColor; void main(){ vec2 q = gl_PointCoord - 0.5; float d = dot(q,q); gl_FragColor = vec4(uColor * exp(-d * 40.0), 1.0); }`,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);
  const sparkData = Array.from({ length: NSP }, () => ({ t: Math.floor(rng() * traces.length), trips: 1 + Math.floor(rng() * 3), off: rng() }));
  const along = (pts: THREE.Vector3[], u: number, out: THREE.Vector3) => {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += pts[i].distanceTo(pts[i - 1]);
    let s = u * total;
    for (let i = 1; i < pts.length; i++) {
      const L = pts[i].distanceTo(pts[i - 1]);
      if (s <= L || i === pts.length - 1) return out.lerpVectors(pts[i - 1], pts[i], Math.min(1, s / L));
      s -= L;
    }
    return out;
  };

  const boardObj = board.build(line.clone().multiplyScalar(1.6), lw, lwDim);
  const chipObj = chip.build(line.clone().multiplyScalar(1.4), lw, lwDim);
  const pinObj = pins.build(line, lw, 0.9 * lwDim);
  scene.add(boardObj, chipObj, pinObj);
  const chipMat = chipObj.material as LineMaterial;
  for (const o of [boardObj, chipObj, pinObj]) (o.material as LineMaterial).resolution.set(size.x, size.y);

  // faint filled planes (additive, 5-10%)
  const fill = (w: number, d: number, y: number, a: number, color: THREE.Color) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(a), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    scene.add(m);
    return m;
  };
  fill(B.w / 2 - BX0, B.d, 0, 0.008, line).position.x = (BX0 + B.w / 2) / 2;
  const pkgFill = fill(P, P, PH, 0.05, line);
  // the die: a darker square
  const die = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.72, depthWrite: false }));
  die.rotation.x = -Math.PI / 2;
  die.position.y = PH + 0.0005;
  scene.add(die);
  for (const [x, z, w, d] of comps) fill(w, d, 0.002, 0.012, line).position.set(x, 0.002, z);

  // "AI" label
  const labelMat = new THREE.MeshBasicMaterial({
    map: labelTexture(label),
    color: label.clone().multiplyScalar(0.7),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.01), labelMat);
  labelMesh.rotation.x = -Math.PI / 2;
  labelMesh.position.y = PH + 0.003;
  scene.add(labelMesh);

  // ---- arrow markers along the far edge ----
  const arrows: LineSegments2[] = [];
  const arrowPhase: number[] = [];
  for (let i = 0; i < 20; i++) {
    const a = new Lines();
    const r = 0.07;
    a.circle(0, 0, r, 0.18, 1, 10);
    for (let k = 0; k < 4; k++) a.seg({ x: r * Math.cos((k / 4) * TAU), y: 0.18, z: r * Math.sin((k / 4) * TAU) }, { x: 0, y: 0, z: 0 }, 1);
    a.seg({ x: 0, y: 0.18, z: 0 }, { x: 0, y: 0.5, z: 0 }, 0.5);
    const o = a.build(line.clone().multiplyScalar(1.6), lw, lwDim);
    (o.material as LineMaterial).resolution.set(size.x, size.y);
    o.position.set(BX0 + 0.5 + (i / 19) * (B.w / 2 - BX0 - 1), 0.35, -B.d / 2 + 0.25);
    scene.add(o);
    arrows.push(o);
    arrowPhase.push(rng());
  }

  // ---- data streaks: thin vertical additive lines, rising ----
  const NS = 80;
  const streakGeo = new THREE.PlaneGeometry(1, 1);
  const sTint = new Float32Array(NS);
  const streakMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: line.clone().lerp(new THREE.Color(1, 1, 1), 0.3) } },
    vertexShader: `attribute float aK; varying vec2 vUv; varying float vK; varying float vY;
      void main(){ vUv = uv; vK = aK; vec4 w = modelMatrix * instanceMatrix * vec4(position,1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; varying vec2 vUv; varying float vK; varying float vY;
      void main(){
        float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float along = sin(3.14159 * vUv.y); along *= along;
        float win = 1.0;
        gl_FragColor = vec4(uColor * vK * across * across * along * win, 1.0);
      }`,
  });
  streakGeo.setAttribute("aK", new THREE.InstancedBufferAttribute(sTint, 1));
  const streaks = new THREE.InstancedMesh(streakGeo, streakMat, NS);
  streaks.frustumCulled = false;
  scene.add(streaks);
  const streakData: { x: number; z: number; len: number; trips: number; off: number; w: number }[] = [];
  for (let i = 0; i < NS; i++) {
    // cluster some around the chip's back-right corner, like the reference, rest spread
    const near = rng() < 0.3;
    const x = near ? 1.0 + rng() * 2.2 : (rng() - 0.45) * B.w * 1.4;
    const z = near ? -1.6 - rng() * 1.5 : -B.d / 2 + rng() * B.d * 1.1;
    sTint[i] = (near ? 4.5 : 2.6) * (0.4 + rng() * 0.9);
    streakData.push({ x, z, len: 4 + rng() * 7, trips: 1 + Math.floor(rng() * 2), off: rng(), w: 0.004 + rng() * 0.007 });
  }

  // ---- code layer: 2 planes of filler code and binary, scrolling up ----
  const codeMat = (seed: number, kind: "code" | "binary" | "mixed", alpha: number) => {
    const t = codeTexture(seed, 2048, 2048, kind, kind === "binary" ? 20 : 14);
    return {
      t,
      m: new THREE.MeshBasicMaterial({ map: t, color: line.clone().lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(alpha), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
    };
  };
  const codeA = codeMat(0x0c0de1, "code", 0.26);
  const codeB = codeMat(0x0c0de2, "binary", 0.24);
  const planeA = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 10.5), codeA.m);
  const planeB = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), codeB.m);
  scene.add(planeA, planeB);

  const target = new THREE.Vector3(-0.98, 0, -1.02);
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const update = (frame: number) => {
    // camera: closed drift, ±4° yaw and a slight push
    const yaw = THREE.MathUtils.degToRad(-32 + 4 * wave(frame, 1));
    const pitch = THREE.MathUtils.degToRad(47);
    const dist = 10.5 - 0.4 * wave(frame, 1, 0.25);
    camera.position.set(
      target.x + dist * Math.cos(pitch) * Math.sin(yaw),
      target.y + dist * Math.sin(pitch),
      target.z + dist * Math.cos(pitch) * Math.cos(yaw),
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    post.focusDist = camera.position.distanceTo(new THREE.Vector3(0, PH, 0));

    // pulse of chip edge and label (whole cycles)
    const pulse = 0.5 + 0.5 * wave(frame, 4);
    chipMat.opacity = lwDim * (0.85 + 0.35 * pulse);
    labelMat.color.copy(label).multiplyScalar(0.62 + 0.2 * pulse);
    (pkgFill.material as THREE.MeshBasicMaterial).color.copy(line).multiplyScalar(0.04 + 0.03 * pulse);

    arrows.forEach((a, i) => {
      a.position.y = 0.3 + 0.08 * wave(frame, 3, arrowPhase[i]);
    });

    // streaks stay vertical on screen: oriented and moving along the camera's up axis
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    for (let i = 0; i < NS; i++) {
      const s = streakData[i];
      const ph = (phase(frame, s.trips) + s.off) % 1;
      const y = -7 - s.len + ph * (17 + s.len);
      v.set(s.x, 0, s.z).addScaledVector(camUp, y + s.len / 2);
      sc.set(s.w, s.len, 1);
      mtx.compose(v, camera.quaternion, sc);
      streaks.setMatrixAt(i, mtx);
    }
    streaks.instanceMatrix.needsUpdate = true;

    // code planes face the camera and scroll up by whole texture periods
    // both planes hang between the camera and the chip, facing the camera, filling the frame
    for (const [pl, d] of [[planeA, 0.78], [planeB, 0.9]] as const) {
      pl.position.copy(camera.position).lerp(target, d);
      pl.quaternion.copy(camera.quaternion);
    }
    sparkData.forEach((sp, i) => {
      // travel during the first 40% of each trip, then rest (hidden in the chip)
      const ph = (phase(frame, sp.trips) + sp.off) % 1;
      const u = Math.min(1, ph / 0.4);
      along(traces[sp.t][0], u, v);
      const hide = ph > 0.4 ? -50 : 0;
      sparkPos.set([v.x, v.y + 0.01 + hide, v.z], i * 3);
    });
    sparkGeo.attributes.position.needsUpdate = true;
    codeA.t.offset.y = -phase(frame, 1);
    codeB.t.offset.y = -phase(frame, 2);
  };

  Object.assign(post, {
    aperture: 0.03,
    maxCoc: 0.012,
    bloomStrength: 0.95,
    bloomThreshold: 0.45,
    bloomKnee: 0.5,
    bloomSpread: 0.7,
    exposure: 1.1,
    vignette: 0.55,
    grain: 0.02,
    saturation: 1.0,
  });
  return { scene, camera, post, update };
};

export type { Seg };
