/**
 * Busy "network" background tiles for the Wireframe Bulb, drawn once with
 * canvas 2D. Every tile wraps seamlessly on both axes (each element is drawn
 * again at ±tile offsets), so a layer can drift by a whole tile per loop.
 */
import * as THREE from "three";
import { mulberry32 } from "../lib/random";

export type LayerSpec = {
  w: number;
  h: number;
  seed: number;
  nodes: number;
  linkDist: number; // px
  people: number;
  numbers: number;
  boxes: number;
  lineAlpha: number;
  nodeSize: number;
  iconSize: number;
  fontSize: number;
  /** hub nodes with long radiating lines */
  hubs?: number;
};

/** head-and-shoulders glyph */
const person = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  ctx.beginPath();
  ctx.arc(x, y - s * 0.32, s * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.46, y + s * 0.5);
  ctx.quadraticCurveTo(x - s * 0.46, y - s * 0.02, x, y - s * 0.02);
  ctx.quadraticCurveTo(x + s * 0.46, y - s * 0.02, x + s * 0.46, y + s * 0.5);
  ctx.closePath();
  ctx.fill();
};

// short generic number strings, led by a small triangle marker
const numberString = (r: () => number) => {
  const n = 6 + Math.floor(r() * 4);
  let t = "";
  for (let i = 0; i < n; i++) t += Math.floor(r() * 10);
  return t;
};

export const drawLayer = (spec: LayerSpec) => {
  const { w, h } = spec;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const rng = mulberry32(spec.seed);
  const wraps = [-1, 0, 1];
  const each = (fn: (ox: number, oy: number) => void) => {
    for (const i of wraps) for (const j of wraps) fn(i * w, j * h);
  };

  // nodes + links to near neighbours (toroidal distance)
  const pts: [number, number, number][] = [];
  for (let i = 0; i < spec.nodes; i++) pts.push([rng() * w, rng() * h, 0.4 + 0.6 * rng()]);
  ctx.lineWidth = Math.max(1, spec.nodeSize * 0.28);
  for (let i = 0; i < pts.length; i++) {
    let links = 0;
    for (let j = i + 1; j < pts.length && links < 4; j++) {
      let dx = pts[j][0] - pts[i][0];
      let dy = pts[j][1] - pts[i][1];
      dx -= Math.round(dx / w) * w;
      dy -= Math.round(dy / h) * h;
      const d = Math.hypot(dx, dy);
      if (d < spec.linkDist) {
        links++;
        const a = spec.lineAlpha * (1 - d / spec.linkDist) * pts[i][2];
        ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        each((ox, oy) => {
          ctx.beginPath();
          ctx.moveTo(pts[i][0] + ox, pts[i][1] + oy);
          ctx.lineTo(pts[i][0] + dx + ox, pts[i][1] + dy + oy);
          ctx.stroke();
        });
      }
    }
  }
  for (const [x, y, b] of pts) {
    ctx.fillStyle = `rgba(255,255,255,${(0.35 + 0.65 * b).toFixed(3)})`;
    const r = spec.nodeSize * (0.5 + b);
    each((ox, oy) => {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // hubs: bright nodes with long radiating lines (dotted ones too)
  for (let i = 0; i < (spec.hubs ?? 0); i++) {
    const hx = rng() * w;
    const hy = rng() * h;
    const spokes = 5 + Math.floor(rng() * 5);
    for (let k = 0; k < spokes; k++) {
      const ang = rng() * Math.PI * 2;
      const len = spec.linkDist * (1.5 + 3 * rng());
      const ex = hx + Math.cos(ang) * len;
      const ey = hy + Math.sin(ang) * len;
      const dotted = rng() < 0.3;
      const a = 0.35 + 0.5 * rng();
      each((ox, oy) => {
        ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.lineWidth = Math.max(1, spec.nodeSize * 0.35);
        ctx.setLineDash(dotted ? [spec.nodeSize * 1.2, spec.nodeSize * 2.5] : []);
        ctx.beginPath();
        ctx.moveTo(hx + ox, hy + oy);
        ctx.lineTo(ex + ox, ey + oy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(ex + ox, ey + oy, spec.nodeSize * 0.9, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    each((ox, oy) => {
      const g = ctx.createRadialGradient(hx + ox, hy + oy, 0, hx + ox, hy + oy, spec.nodeSize * 6);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx + ox, hy + oy, spec.nodeSize * 6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // people icons
  for (let i = 0; i < spec.people; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const s = spec.iconSize * (0.75 + 0.5 * rng());
    ctx.fillStyle = `rgba(255,255,255,${(0.55 + 0.45 * rng()).toFixed(3)})`;
    each((ox, oy) => person(ctx, x + ox, y + oy, s));
  }

  // short number strings
  ctx.font = `500 ${spec.fontSize}px "JetBrains Mono"`;
  for (let i = 0; i < spec.numbers; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const t = numberString(rng);
    const fs = spec.fontSize;
    ctx.fillStyle = `rgba(255,255,255,${(0.4 + 0.5 * rng()).toFixed(3)})`;
    each((ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + ox + fs * 0.5, y + oy);
      ctx.lineTo(x + ox + fs * 0.25, y + oy - fs * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillText(t, x + ox + fs * 0.8, y + oy);
    });
  }

  // data boxes: thin rectangles with tiny text lines
  for (let i = 0; i < spec.boxes; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const bw = spec.fontSize * (5 + 4 * rng());
    const bh = spec.fontSize * (2 + 2 * rng());
    const a = 0.35 + 0.4 * rng();
    const rows = Math.floor(bh / (spec.fontSize * 0.55));
    const lens = Array.from({ length: rows }, () => 0.3 + 0.6 * rng());
    each((ox, oy) => {
      ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.lineWidth = Math.max(1, spec.fontSize * 0.06);
      ctx.strokeRect(x + ox, y + oy, bw, bh);
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.6).toFixed(3)})`;
      ctx.fillRect(x + ox, y + oy, bw, Math.max(1, spec.fontSize * 0.18));
      lens.forEach((l, r) => {
        ctx.fillRect(
          x + ox + spec.fontSize * 0.3,
          y + oy + spec.fontSize * (0.5 + r * 0.55),
          (bw - spec.fontSize * 0.6) * l,
          Math.max(1, spec.fontSize * 0.12),
        );
      });
    });
  }
  return c;
};

export const layerTexture = (canvas: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
};
