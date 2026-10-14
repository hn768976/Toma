// HUD panels: flat panels at several depths around the hand. Each panel is a
// canvas texture redrawn only when its tick index changes; the content of a
// tick is a pure function of (panel seed, tick), so frames can render in any
// order. Panels blur themselves in the shader (disc blur sized from their
// circle of confusion), because they are transparent and never reach the
// depth-based DoF.
import * as THREE from "three";
import { FONT_HUD } from "../lib/fonts";
import { mulberry32, pick, range } from "../lib/random";

export type PanelKind = "code" | "chart" | "grid" | "numbers" | "tree" | "bars";

export type PanelDef = {
  kind: PanelKind;
  label: string;
  pos: [number, number, number]; // relative to the cube centre (world units)
  size: [number, number];
  yaw: number; // radians
  opacity: number; // 0.3 .. 0.6
  period: number; // frames per tick (divides 600)
  phase: number; // tick phase offset in frames (0..period-1), so panels tick at different moments
  seed: number;
  frame: boolean;
};

const TICK_PERIODS = [4, 5, 6, 8, 10, 12, 15];
const LABELS = ["DATA", "MODEL", "SYNC", "NODE", "CORE", "TRAIN", "INPUT", "LAYER"];
const KINDS: PanelKind[] = ["code", "chart", "grid", "numbers", "tree", "bars"];

// Layout: 14 panels, hand-placed around the cube at several depths. Kinds and
// timing come from a seeded generator.
const LAYOUT: { pos: [number, number, number]; size: [number, number]; kind?: PanelKind; frame?: boolean }[] = [
  // wrapped closely round the cube (near focus, mostly sharp)
  { pos: [-0.66, 0.3, -0.4], size: [0.5, 0.6], kind: "tree" },
  { pos: [0.92, 0.12, -0.45], size: [0.95, 0.95], kind: "tree", frame: true },
  { pos: [-0.74, -0.12, -0.25], size: [0.38, 0.46], kind: "code" },
  { pos: [1.0, -0.46, -0.2], size: [0.62, 0.24], kind: "chart" },
  { pos: [-1.08, -0.62, -0.55], size: [0.6, 0.42], kind: "code" },
  { pos: [0.05, 0.62, -0.8], size: [0.8, 0.24], kind: "bars" },
  // far background: large, layered, blurred
  { pos: [-2.05, 0.55, -2.4], size: [1.2, 1.4], kind: "code" },
  { pos: [-1.45, -0.45, -3.0], size: [1.1, 1.2], kind: "code" },
  { pos: [2.15, 0.55, -2.6], size: [1.1, 1.1], kind: "numbers" },
  { pos: [2.35, -0.65, -2.2], size: [1.1, 0.9], kind: "code" },
  { pos: [-1.35, -1.05, -2.0], size: [1.2, 0.8], kind: "code" },
  // near the camera (strongly blurred foreground)
  { pos: [1.05, -0.62, 0.6], size: [0.6, 0.45], kind: "code" },
  { pos: [-1.45, 0.35, 1.1], size: [0.42, 0.58], kind: "code" },
  { pos: [1.05, 0.85, 0.7], size: [0.45, 0.28], kind: "grid" },
];

export const buildPanelDefs = (): PanelDef[] => {
  const rng = mulberry32(0x4d5);
  const phaseRng = mulberry32(0x7a11);
  return LAYOUT.map((l, i) => ({
    kind: l.kind ?? pick(rng, KINDS),
    label: pick(rng, LABELS),
    pos: l.pos,
    size: l.size,
    // close panels turn to face the cube (wrapping round it); far ones barely
    yaw:
      l.pos[2] > -1 && l.pos[2] < 0.3
        ? 0.65 * Math.atan2(-l.pos[0], 0.9) + range(rng, -0.04, 0.04)
        : -l.pos[0] * 0.08 + range(rng, -0.05, 0.05),
    opacity: range(rng, 0.3, 0.6) * (l.pos[2] > 0.5 ? 0.45 : 1),
    period: pick(rng, TICK_PERIODS),
    phase: 0, // filled below once the period is known
    seed: 1000 + i * 97,
    frame: l.frame ?? false,
  })).map((d) => ({ ...d, phase: Math.floor(phaseRng() * d.period) }));
};

const PX_PER_UNIT = 760; // canvas resolution per world unit
const PAD = 0.12; // transparent margin (fraction of each side) so blur can spread

// Generic made-up code fragments (no product names).
const CODE_WORDS = ["let", "fn", "map", "sync", "node", "out", "in", "vec", "loss", "grad", "step", "data", "layer", "emit", "load", "init", "seed", "norm"];

const codeLine = (rng: () => number) => {
  const n = 1 + Math.floor(rng() * 4);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(pick(rng, CODE_WORDS));
  const ops = [" = ", "(", ".", " -> ", " :: "];
  let s = parts.join(pick(rng, ops));
  if (rng() < 0.5) s += `(${(rng() * 99).toFixed(rng() < 0.5 ? 0 : 2)})`;
  if (rng() < 0.3) s = "  " + s;
  if (rng() < 0.15) s = "0x" + Math.floor(rng() * 0xffff).toString(16).toUpperCase().padStart(4, "0") + "  " + s;
  return s;
};

const drawPanel = (g: CanvasRenderingContext2D, W: number, H: number, def: PanelDef, tick: number, loopTicks: number) => {
  g.clearRect(0, 0, W, H);
  const px = W * PAD;
  const py = H * PAD;
  const w = W - 2 * px;
  const h = H - 2 * py;
  const u = Math.min(w, h);
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  // thin frame with heavier corner brackets
  if (def.frame) {
    g.globalAlpha = 0.45;
    g.lineWidth = Math.max(1.5, u * 0.006);
    g.strokeRect(px, py, w, h);
  }
  g.globalAlpha = def.frame ? 1 : 0;
  g.lineWidth = Math.max(2.5, u * 0.012);
  const cl = u * 0.08;
  [
    [px, py, 1, 1],
    [px + w, py, -1, 1],
    [px, py + h, 1, -1],
    [px + w, py + h, -1, -1],
  ].forEach(([x, y, sx, sy]) => {
    g.beginPath();
    g.moveTo(x + sx * cl, y);
    g.lineTo(x, y);
    g.lineTo(x, y + sy * cl);
    g.stroke();
  });
  // header label
  const fs = Math.max(9, Math.round(u * 0.055));
  g.font = `500 ${fs}px ${FONT_HUD}`;
  g.textBaseline = "top";
  g.globalAlpha = 0.95;
  g.fillText(def.label, px + u * 0.05, py + u * 0.04);
  g.globalAlpha = 0.6;
  const wrapped = ((tick % loopTicks) + loopTicks) % loopTicks;
  g.fillText(String(wrapped % 1000).padStart(3, "0"), px + w - u * 0.05 - fs * 2, py + u * 0.04);
  g.globalAlpha = 1;
  const top = py + u * 0.04 + fs * 1.5;
  const ch = py + h - top - u * 0.04;
  const cx0 = px + u * 0.05;
  const cw = w - u * 0.1;
  // content is a function of (seed, tick) only; ticks wrap on the loop length
  const lineSeed = (i: number) => mulberry32(def.seed * 7919 + ((((i % loopTicks) + loopTicks) % loopTicks) * 131));
  switch (def.kind) {
    case "code": {
      const lfs = Math.max(6, Math.round(u * 0.03));
      g.font = `500 ${lfs}px ${FONT_HUD}`;
      const lh = lfs * 1.45;
      const rows = Math.floor(ch / lh);
      const cols = cw > lfs * 40 ? 2 : 1;
      const colW = cw / cols;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const idx = wrapped + r + c * 37; // scrolls one line per tick
          const rng = lineSeed(idx);
          g.globalAlpha = 0.45 + rng() * 0.55;
          let txt = codeLine(rng);
          // the newest line types itself in
          if (r === rows - 1) txt = txt.slice(0, Math.max(1, Math.floor(txt.length * 0.6)));
          const x = cx0 + c * colW + (rng() < 0.3 ? lfs * 1.5 : 0);
          g.fillText(txt, x, top + r * lh, colW * 0.95);
          if (rng() < 0.06) {
            // small accent tag (green channel = accent colour)
            g.save();
            g.globalAlpha = 1;
            g.fillStyle = "#00ff00";
            g.fillRect(x - lfs * 0.9, top + r * lh + lfs * 0.2, lfs * 0.6, lfs * 0.6);
            g.restore();
          }
        }
      }
      break;
    }
    case "numbers": {
      const lfs = Math.max(7, Math.round(u * 0.045));
      g.font = `500 ${lfs}px ${FONT_HUD}`;
      const lh = lfs * 1.5;
      const rows = Math.floor(ch / lh);
      for (let r = 0; r < rows; r++) {
        const rng = lineSeed(wrapped * 3 + r);
        g.globalAlpha = 0.5 + rng() * 0.5;
        g.fillText((rng() * 10).toFixed(4), cx0, top + r * lh);
        g.fillText((rng() * 999).toFixed(1).padStart(6, " "), cx0 + cw * 0.45, top + r * lh);
        g.globalAlpha = 0.35;
        g.fillRect(cx0 + cw * 0.85, top + r * lh + lfs * 0.2, cw * 0.15 * rng(), lfs * 0.6);
      }
      break;
    }
    case "chart": {
      // line chart that shifts one step per tick (periodic over the loop)
      g.globalAlpha = 0.3;
      g.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = top + (ch * i) / 4;
        g.beginPath();
        g.moveTo(cx0, y);
        g.lineTo(cx0 + cw, y);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.lineWidth = Math.max(2, u * 0.01);
      g.beginPath();
      const N = 40;
      for (let i = 0; i <= N; i++) {
        const k = wrapped + i;
        const ph = (2 * Math.PI * k) / loopTicks;
        const v =
          0.5 +
          0.22 * Math.sin(ph * 3 + def.seed) +
          0.12 * Math.sin(ph * 7 + def.seed * 0.3) +
          0.08 * Math.sin(ph * 13);
        const x = cx0 + (cw * i) / N;
        const y = top + ch * (1 - v);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.globalAlpha = 0.18;
      g.lineTo(cx0 + cw, top + ch);
      g.lineTo(cx0, top + ch);
      g.fill();
      break;
    }
    case "bars": {
      const N = 18;
      for (let i = 0; i < N; i++) {
        const rng = lineSeed(wrapped + i * 17);
        const v = 0.15 + 0.85 * rng();
        g.globalAlpha = 0.4 + 0.5 * v;
        const bw = (cw / N) * 0.6;
        g.save();
        if (i % 5 === 2) {
          g.fillStyle = "#00ff00";
          g.globalAlpha = 1;
        }
        g.fillRect(cx0 + (cw * i) / N, top + ch * (1 - v), bw, ch * v);
        g.restore();
      }
      break;
    }
    case "grid": {
      const cols = 8;
      const rows = 4;
      const cwid = cw / cols;
      const chh = ch / rows;
      g.lineWidth = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const rng = lineSeed(wrapped * 5 + r * cols + c);
          const on = rng() < 0.35;
          g.globalAlpha = on ? 0.75 : 0.25;
          g.strokeRect(cx0 + c * cwid + 2, top + r * chh + 2, cwid - 4, chh - 4);
          if (on) {
            g.globalAlpha = 0.35;
            g.fillRect(cx0 + c * cwid + 4, top + r * chh + 4, cwid - 8, chh - 8);
          }
        }
      }
      break;
    }
    case "tree": {
      // node graph: a root fanning out to leaves; active edges change per tick
      const rng0 = mulberry32(def.seed);
      const leaves = def.size[1] > 0.6 ? 11 : 6;
      // perspective-style grid behind the graph
      g.globalAlpha = 0.22;
      g.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        const x = cx0 + (cw * i) / 8;
        g.beginPath();
        g.moveTo(x, top);
        g.lineTo(x, top + ch);
        g.stroke();
      }
      for (let i = 0; i <= 6; i++) {
        const y = top + (ch * i) / 6;
        g.beginPath();
        g.moveTo(cx0, y);
        g.lineTo(cx0 + cw, y);
        g.stroke();
      }
      const rx = cx0 + cw * 0.05;
      const ry = top + ch * 0.5;
      const mids: [number, number][] = [];
      for (let i = 0; i < 3; i++) mids.push([cx0 + cw * 0.42, top + ch * (0.2 + 0.3 * i)]);
      g.lineWidth = Math.max(1.5, u * 0.006);
      const node = (x: number, y: number, r: number) => {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      };
      mids.forEach(([mx, my]) => {
        g.globalAlpha = 0.6;
        g.beginPath();
        g.moveTo(rx, ry);
        g.bezierCurveTo((rx + mx) / 2, ry, (rx + mx) / 2, my, mx, my);
        g.stroke();
      });
      for (let i = 0; i < leaves; i++) {
        const [mx, my] = mids[Math.floor(rng0() * 3)];
        const lx = cx0 + cw * 0.9;
        const ly = top + ch * (0.07 + (0.86 * i) / (leaves - 1));
        const act = lineSeed(wrapped * 11 + i)() < 0.4;
        g.globalAlpha = act ? 1 : 0.4;
        g.beginPath();
        g.moveTo(mx, my);
        g.bezierCurveTo((mx + lx) / 2, my, (mx + lx) / 2, ly, lx, ly);
        g.stroke();
        // leaf boxes: some in the accent colour (drawn in the green channel)
        if (i % 3 === 1) {
          g.save();
          g.fillStyle = "#00ff00";
          g.globalAlpha = 1;
          g.fillRect(lx - u * 0.02, ly - u * 0.02, u * 0.06, u * 0.04);
          g.restore();
        } else g.fillRect(lx - u * 0.02, ly - u * 0.02, u * 0.06, u * 0.04);
      }
      g.globalAlpha = 1;
      node(rx, ry, u * 0.025);
      mids.forEach(([mx, my]) => node(mx, my, u * 0.018));
      break;
    }
  }
  g.globalAlpha = 1;
};

export type HudRig = {
  group: THREE.Group; // positioned at the cube centre by the caller
  update: (frame: number, loopLen: number, opacity: number, drift: number, cam: THREE.PerspectiveCamera, coc: (z: number) => number, heightPx: number) => void;
};

export const buildHud = (defs: PanelDef[], color: string, accent: string): HudRig => {
  const group = new THREE.Group();
  const col = new THREE.Color(color);
  const panels = defs.map((def) => {
    const W = Math.round(def.size[0] * (1 + 2 * PAD) * PX_PER_UNIT);
    const H = Math.round(def.size[1] * (1 + 2 * PAD) * PX_PER_UNIT);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        tMap: { value: tex },
        uColor: { value: col.clone() },
        uAccent: { value: new THREE.Color(accent) },
        uAmount: { value: 0 },
        uBlur: { value: new THREE.Vector2() }, // blur radius in uv units (x, y)
        uLod: { value: 0 },
      },
      vertexShader: /* glsl */ `
        out vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tMap;
        uniform vec3 uColor;
        uniform vec3 uAccent;
        uniform float uAmount;
        uniform vec2 uBlur;
        uniform float uLod;
        in vec2 vUv;
        out vec4 outColor;
        void main() {
          vec2 a = textureLod(tMap, vUv, uLod).rg;
          if (uBlur.x > 0.0) {
            // 24-tap golden-angle disc blur
            vec2 acc = a;
            for (int i = 0; i < 24; i++) {
              float fi = float(i) + 0.5;
              float r = sqrt(fi / 24.0);
              float ang = fi * 2.39996323;
              acc += textureLod(tMap, vUv + vec2(cos(ang), sin(ang)) * r * uBlur, uLod).rg;
            }
            a = acc / 25.0;
          }
          float accent = max(a.y - a.x, 0.0);
          outColor = vec4((uColor * a.x * 1.6 + uAccent * accent * 1.8) * uAmount, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(def.size[0] * (1 + 2 * PAD), def.size[1] * (1 + 2 * PAD)),
      mat,
    );
    mesh.position.set(...def.pos);
    mesh.rotation.y = def.yaw;
    group.add(mesh);
    return { def, ctx, tex, mat, mesh, W, H, lastTick: Number.NaN };
  });

  const wp = new THREE.Vector3();
  const update: HudRig["update"] = (frame, loopLen, opacity, drift, cam, coc, heightPx) => {
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360);
    panels.forEach((p, i) => {
      const loopTicks = Math.max(1, Math.round(loopLen / p.def.period));
      // phase offset keeps panels from ticking together; the frame is already
      // wrapped to the loop and the offset is constant, so loops stay seamless
      const tick = Math.floor((frame + p.def.phase) / p.def.period);
      if (tick !== p.lastTick) {
        drawPanel(p.ctx, p.W, p.H, p.def, tick, loopTicks);
        p.tex.needsUpdate = true;
        p.lastTick = tick;
      }
      // slow drift: whole cycles over the loop
      const ph = 2 * Math.PI * drift;
      p.mesh.position.set(
        p.def.pos[0] + 0.03 * Math.sin(ph + i),
        p.def.pos[1] + 0.04 * Math.sin(ph * 2 + i * 1.7),
        p.def.pos[2],
      );
      // blur from the panel's circle of confusion
      p.mesh.getWorldPosition(wp);
      const z = Math.max(0.2, -wp.applyMatrix4(cam.matrixWorldInverse).z);
      const cocPx = coc(z);
      const panelPxH = ((p.def.size[1] * (1 + 2 * PAD)) / (2 * z * tanHalf)) * heightPx;
      const blurUvY = cocPx / Math.max(1, panelPxH);
      const blurUvX = blurUvY * (p.H / p.W);
      p.mat.uniforms.uBlur.value.set(blurUvX, blurUvY);
      // sample a mip level that matches the tap spacing
      const texPerPx = p.H / Math.max(1, panelPxH);
      const tapSpacingTex = (blurUvY * p.H) / 3;
      p.mat.uniforms.uLod.value = Math.max(0, Math.log2(Math.max(1, Math.max(texPerPx, tapSpacingTex))));
      p.mat.uniforms.uAmount.value = p.def.opacity * opacity;
    });
  };

  return { group, update };
};
