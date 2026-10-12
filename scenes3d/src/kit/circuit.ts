import * as THREE from "three";
import { mulberry32 } from "./random";

// Abstract circuit layouts for the plates (Looks 4 and 5). A layout lives in
// plate-local units (x across, y along, centred on the plate) and holds the
// chip outlines, pads (bundle anchors) and right-angled traces. The same
// layout is drawn once into a Canvas 2D emissive texture and also turned
// into trace polylines that carry pulses in a shader.

export type Pad = { x: number; y: number; r: number };
export type Chip = { x: number; y: number; w: number; h: number };
export type Layout = {
  w: number;
  h: number;
  pads: Pad[];
  chips: Chip[];
  traces: [number, number][][];
};

export const PLATE_VARIANTS: [number, number][] = [
  [1.0, 1.0],
  [1.3, 1.0],
  [1.6, 1.0],
  [2.0, 1.0],
];

const makeLayout = (w: number, h: number, seed: number, padCount: number): Layout => {
  const rng = mulberry32(seed);
  const m = 0.07;
  const chips: Chip[] = [];
  const nChips = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < nChips * 6 && chips.length < nChips; i++) {
    const cw = 0.07 + rng() * 0.13;
    const ch = 0.06 + rng() * 0.11;
    const cx = (rng() - 0.5) * (w - cw - 2 * m);
    const cy = (rng() - 0.5) * (h - ch - 2 * m);
    if (chips.some((c) => Math.abs(c.x - cx) < (c.w + cw) / 2 + 0.06 && Math.abs(c.y - cy) < (c.h + ch) / 2 + 0.06)) continue;
    chips.push({ x: cx, y: cy, w: cw, h: ch });
  }
  const pads: Pad[] = [];
  for (let i = 0; i < 400 && pads.length < padCount; i++) {
    const px = (rng() - 0.5) * (w - 0.3);
    const py = (rng() - 0.5) * (h - 0.3);
    const r = 0.05;
    if (chips.some((c) => Math.abs(c.x - px) < c.w / 2 + 0.09 && Math.abs(c.y - py) < c.h / 2 + 0.09)) continue;
    if (pads.some((p) => Math.hypot(p.x - px, p.y - py) < 0.28)) continue;
    pads.push({ x: px, y: py, r });
  }
  const traces: [number, number][][] = [];
  const inside = (x: number, y: number) => Math.abs(x) < w / 2 - m && Math.abs(y) < h / 2 - m;
  const starts: [number, number][] = [];
  chips.forEach((c) => {
    const k = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < k; i++) {
      const side = Math.floor(rng() * 4);
      const t = rng() - 0.5;
      if (side === 0) starts.push([c.x + t * c.w, c.y + c.h / 2]);
      if (side === 1) starts.push([c.x + t * c.w, c.y - c.h / 2]);
      if (side === 2) starts.push([c.x + c.w / 2, c.y + t * c.h]);
      if (side === 3) starts.push([c.x - c.w / 2, c.y + t * c.h]);
    }
  });
  pads.forEach((p) => {
    const k = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < k; i++) {
      const a = Math.floor(rng() * 4) * (Math.PI / 2);
      starts.push([p.x + Math.cos(a) * p.r * 1.6, p.y + Math.sin(a) * p.r * 1.6]);
    }
  });
  for (let i = 0; i < Math.round(30 * w); i++) starts.push([(rng() - 0.5) * (w - 2 * m), (rng() - 0.5) * (h - 2 * m)]);
  starts.forEach(([sx, sy]) => {
    const pts: [number, number][] = [[sx, sy]];
    let x = sx;
    let y = sy;
    let horiz = rng() < 0.5;
    const segs = 2 + Math.floor(rng() * 4);
    for (let s = 0; s < segs; s++) {
      const len = (0.03 + rng() * 0.14) * (rng() < 0.5 ? -1 : 1);
      let nx = horiz ? x + len : x;
      let ny = horiz ? y : y + len;
      // Traces stop at chip outlines instead of running across them.
      const hitsChip = chips.some((c) =>
        [0.33, 0.66, 1].some((f) => {
          const qx = x + (nx - x) * f;
          const qy = y + (ny - y) * f;
          return Math.abs(qx - c.x) < c.w / 2 + 0.01 && Math.abs(qy - c.y) < c.h / 2 + 0.01;
        }),
      );
      if (hitsChip && s > 0) break;
      if (!inside(nx, ny)) {
        nx = horiz ? x - len : x;
        ny = horiz ? y : y - len;
        if (!inside(nx, ny)) break;
      }
      pts.push([nx, ny]);
      x = nx;
      y = ny;
      horiz = !horiz;
    }
    if (pts.length > 1) traces.push(pts);
  });
  return { w, h, pads, chips, traces };
};

export const LAYOUTS: Layout[] = PLATE_VARIANTS.map(([w, h], i) =>
  makeLayout(w, h, 9100 + i * 77, 3 + i),
);

/** Draw a layout into a white-on-black emissive canvas. Built once. */
export const drawCircuit = (L: Layout, pxPerUnit = 1024) => {
  const W = Math.round(L.w * pxPerUnit);
  const H = Math.round(L.h * pxPerUnit);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  const X = (x: number) => (x / L.w + 0.5) * W;
  const Y = (y: number) => (0.5 - y / L.h) * H;
  const s = pxPerUnit;
  g.lineCap = "square";
  g.lineJoin = "miter";
  // Fine border inset
  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.lineWidth = 0.004 * s;
  g.strokeRect(0.03 * s, 0.03 * s, W - 0.06 * s, H - 0.06 * s);
  // Traces (dim; pulses are added in the shader)
  g.strokeStyle = "rgba(255,255,255,0.30)";
  g.lineWidth = 0.0026 * s;
  L.traces.forEach((t) => {
    g.beginPath();
    t.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    g.stroke();
    const [ex, ey] = t[t.length - 1];
    g.beginPath();
    g.arc(X(ex), Y(ey), 0.008 * s, 0, Math.PI * 2);
    g.fillStyle = "rgba(255,255,255,0.45)";
    g.fill();
  });
  // Chip outlines with pin rows
  L.chips.forEach((c) => {
    g.fillStyle = "rgba(255,255,255,0.06)";
    g.fillRect(X(c.x - c.w / 2), Y(c.y + c.h / 2), c.w * s, c.h * s);
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.lineWidth = 0.004 * s;
    g.strokeRect(X(c.x - c.w / 2), Y(c.y + c.h / 2), c.w * s, c.h * s);
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.strokeRect(
      X(c.x - c.w / 2 + 0.015),
      Y(c.y + c.h / 2 - 0.015),
      (c.w - 0.03) * s,
      (c.h - 0.03) * s,
    );
    g.fillStyle = "rgba(255,255,255,0.5)";
    const n = Math.max(3, Math.floor(c.w / 0.02));
    for (let i = 0; i < n; i++) {
      const px = c.x - c.w / 2 + ((i + 0.5) / n) * c.w;
      g.fillRect(X(px) - 0.002 * s, Y(c.y + c.h / 2) - 0.012 * s, 0.004 * s, 0.009 * s);
      g.fillRect(X(px) - 0.002 * s, Y(c.y - c.h / 2) + 0.003 * s, 0.004 * s, 0.009 * s);
    }
  });
  // Pads: soft radial glow, ring and core
  L.pads.forEach((p) => {
    const gr = g.createRadialGradient(X(p.x), Y(p.y), 0, X(p.x), Y(p.y), p.r * 4.5 * s);
    gr.addColorStop(0, "rgba(255,255,255,0.35)");
    gr.addColorStop(0.25, "rgba(255,255,255,0.08)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(X(p.x), Y(p.y), p.r * 4.5 * s, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,1)";
    g.lineWidth = 0.006 * s;
    g.beginPath();
    g.arc(X(p.x), Y(p.y), p.r * 1.25 * s, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.arc(X(p.x), Y(p.y), p.r * 0.85 * s, 0, Math.PI * 2);
    g.fill();
  });
  return cv;
};

let textures: THREE.Texture[] | null = null;

/** Builds the circuit textures once (call before the canvas mounts). */
export const prepareCircuitTextures = async () => {
  if (textures) return;
  textures = LAYOUTS.map((L) => {
    const t = new THREE.CanvasTexture(drawCircuit(L));
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  });
};

export const circuitTextures = () => {
  if (!textures) throw new Error("Circuit textures not prepared");
  return textures;
};
