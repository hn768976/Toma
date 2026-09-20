import * as THREE from 'three/webgpu';
import { Rng } from '../engine/rng';
import { BUS_COUNT } from './board';
import type { Theme } from '../themes';

/**
 * Every texture in the project is drawn procedurally into a 2D canvas at
 * render time. Two reasons: the project stays asset-free (nothing to ship
 * alongside the source), and the drawing is seeded, so the 1080p and 4K
 * compositions lay out *identically* — only the texel density changes.
 *
 * All drawing is done in normalised coordinates multiplied by `size`, so a
 * 4096px board texture is the same artwork as a 2048px one, just sharper.
 */

const makeCanvas = (size: number, height = size) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { canvas, ctx };
};

const toTexture = (canvas: HTMLCanvasElement, srgb: boolean) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

/** The eight directions a PCB trace is allowed to travel (45° routing). */
const DIRS: Array<[number, number]> = [
  [1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071],
  [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071],
];

/**
 * Walks a 45°-routed staircase outward from `startR` until it leaves the
 * canvas, alternating between the two compass directions that bracket
 * `angle`. Returns the polyline in normalised (-0.5 .. 0.5) space.
 */
const routeOutward = (rng: Rng, angle: number, startR: number, maxR: number) => {
  const ideal = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const octant = ideal / (Math.PI / 4);
  const a = DIRS[Math.floor(octant) % 8];
  const b = DIRS[(Math.floor(octant) + 1) % 8];

  const pts: Array<[number, number]> = [];
  let x = Math.cos(angle) * startR;
  let y = Math.sin(angle) * startR;
  pts.push([x, y]);

  // Bias the run lengths so the path tracks the requested angle overall.
  const frac = octant - Math.floor(octant);
  let guard = 0;
  while (Math.hypot(x, y) < maxR && guard++ < 40) {
    const useB = rng.float() < frac;
    const dir = useB ? b : a;
    const run = rng.range(0.02, 0.12) * maxR * (1 + Math.hypot(x, y) / maxR);
    x += dir[0] * run;
    y += dir[1] * run;
    pts.push([x, y]);
  }
  return pts;
};

const strokePath = (
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  size: number,
  offX: number,
  offY: number,
  width: number,
) => {
  const c = size / 2;
  ctx.beginPath();
  ctx.moveTo(c + (pts[0][0] + offX) * size, c + (pts[0][1] + offY) * size);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(c + (pts[i][0] + offX) * size, c + (pts[i][1] + offY) * size);
  }
  ctx.lineWidth = width * size;
  ctx.stroke();
};

export interface BoardTextures {
  albedo: THREE.Texture;
  /** Greyscale: white where copper routing runs. Drives the energy wave. */
  traceMask: THREE.Texture;
  roughness: THREE.Texture;
  dispose: () => void;
}

/**
 * The motherboard surface: solder mask, silkscreen, and a dense fan-out of
 * 45°-routed buses radiating from the socket. The mask channel is what the
 * energy wave lights up, so routing and glow are guaranteed to line up.
 */
export const createBoardTextures = (theme: Theme, size: number): BoardTextures => {
  const rng = new Rng(theme.seed);
  const { canvas: albedoC, ctx: a } = makeCanvas(size);
  const { canvas: maskC, ctx: m } = makeCanvas(size);
  const { canvas: roughC, ctx: r } = makeCanvas(size);

  // --- base solder mask -------------------------------------------------
  a.fillStyle = theme.board.color;
  a.fillRect(0, 0, size, size);
  m.fillStyle = '#000000';
  m.fillRect(0, 0, size, size);
  r.fillStyle = `rgb(${Math.round(theme.board.roughness * 255)},${Math.round(
    theme.board.roughness * 255,
  )},${Math.round(theme.board.roughness * 255)})`;
  r.fillRect(0, 0, size, size);

  // Subtle mottling so the mask is not a flat colour.
  for (let i = 0; i < 2400; i++) {
    const x = rng.float() * size;
    const y = rng.float() * size;
    const rad = rng.range(0.002, 0.02) * size;
    a.fillStyle = `rgba(255,255,255,${rng.range(0.004, 0.016)})`;
    a.beginPath();
    a.arc(x, y, rad, 0, Math.PI * 2);
    a.fill();
  }

  // --- copper fan-out ---------------------------------------------------
  const socketR = 0.045; // normalised socket radius on the board texture
  const maxR = 0.72;
  a.lineCap = 'round';
  a.lineJoin = 'round';
  m.lineCap = 'round';
  m.lineJoin = 'round';
  r.lineCap = 'round';
  r.lineJoin = 'round';

  const busCount = BUS_COUNT;
  for (let i = 0; i < busCount; i++) {
    const angle = (i / busCount) * Math.PI * 2 + rng.range(-0.016, 0.016);
    const lanes = rng.int(2, 7);
    const pitch = rng.range(0.0045, 0.0085);
    const width = rng.range(0.0016, 0.0031);
    const pts = routeOutward(rng, angle, socketR, maxR);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);

    for (let lane = 0; lane < lanes; lane++) {
      const off = (lane - (lanes - 1) / 2) * pitch;
      const ox = nx * off;
      const oy = ny * off;

      a.strokeStyle = theme.board.traceColor;
      strokePath(a, pts, size, ox, oy, width);

      // The mask fades with radius so the far board never over-glows.
      const fade = 1 - i / (busCount * 6);
      m.strokeStyle = `rgba(255,255,255,${(0.75 * fade).toFixed(3)})`;
      strokePath(m, pts, size, ox, oy, width);

      r.strokeStyle = 'rgba(90,90,90,0.9)'; // copper is glossier than mask
      strokePath(r, pts, size, ox, oy, width);
    }
  }

  // --- vias and pads ----------------------------------------------------
  for (let i = 0; i < 1500; i++) {
    const ang = rng.float() * Math.PI * 2;
    const rad = Math.sqrt(rng.range(socketR * socketR, maxR * maxR));
    const x = size / 2 + Math.cos(ang) * rad * size;
    const y = size / 2 + Math.sin(ang) * rad * size;
    const vr = rng.range(0.0015, 0.0038) * size;

    a.fillStyle = theme.socket.padColor;
    a.globalAlpha = 0.55;
    a.beginPath();
    a.arc(x, y, vr, 0, Math.PI * 2);
    a.fill();
    a.globalAlpha = 1;

    a.fillStyle = theme.board.color;
    a.beginPath();
    a.arc(x, y, vr * 0.42, 0, Math.PI * 2);
    a.fill();

    m.fillStyle = 'rgba(255,255,255,0.5)';
    m.beginPath();
    m.arc(x, y, vr * 0.9, 0, Math.PI * 2);
    m.fill();
  }

  // --- silkscreen print -------------------------------------------------
  a.strokeStyle = theme.board.silkColor;
  a.globalAlpha = 0.5;
  for (let i = 0; i < 260; i++) {
    const ang = rng.float() * Math.PI * 2;
    const rad = Math.sqrt(rng.range(0.02, 0.5)) * 1.1;
    const x = size / 2 + Math.cos(ang) * rad * size;
    const y = size / 2 + Math.sin(ang) * rad * size;
    const w = rng.range(0.01, 0.05) * size;
    const h = rng.range(0.008, 0.03) * size;
    a.lineWidth = 0.0012 * size;
    a.strokeRect(x - w / 2, y - h / 2, w, h);
  }
  a.globalAlpha = 1;

  const albedo = toTexture(albedoC, true);
  const traceMask = toTexture(maskC, false);
  const roughness = toTexture(roughC, false);

  return {
    albedo,
    traceMask,
    roughness,
    dispose: () => {
      albedo.dispose();
      traceMask.dispose();
      roughness.dispose();
    },
  };
};

/**
 * Draws a geometric "AI" from explicit paths rather than a system font —
 * headless Chrome has no guaranteed font stack, and this keeps the
 * letterform identical on every machine and at every resolution.
 */
const drawAI = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  h: number,
  color: string,
  strokeScale = 1,
) => {
  const w = h * 0.78; // width of the A
  const gap = h * 0.2;
  const stroke = h * 0.115 * strokeScale;
  const iW = stroke;
  const total = w + gap + iW;
  const left = cx - total / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = stroke;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  // A — apex slightly flattened, as in the reference letterform.
  const apexX = left + w / 2;
  const flat = w * 0.1;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(apexX - flat / 2, top);
  ctx.lineTo(apexX + flat / 2, top);
  ctx.lineTo(left + w, bottom);
  ctx.stroke();

  // Crossbar at 64% height.
  const barY = top + h * 0.64;
  const barInset = w * 0.145;
  ctx.beginPath();
  ctx.moveTo(left + barInset, barY);
  ctx.lineTo(left + w - barInset, barY);
  ctx.stroke();

  // I
  const iX = left + w + gap + iW / 2;
  ctx.beginPath();
  ctx.moveTo(iX, top);
  ctx.lineTo(iX, bottom);
  ctx.stroke();

  ctx.restore();
};

export interface DieTextures {
  albedo: THREE.Texture;
  /** White where the die should emit — logic lanes plus the "AI" glyphs. */
  emissive: THREE.Texture;
  dispose: () => void;
}

/**
 * The top of the package: a die-shot style layout with the glowing label.
 *
 * Built in layers, coarse to fine, so the die still reads as silicon when
 * the camera is close: functional blocks, regular cache banks, a bond-pad
 * ring, two scales of interconnect, and the label last. The emissive channel
 * carries the lit parts — lanes, pads and the glyphs — so the whole die
 * ignites together rather than the label floating on top of it.
 */
export const createDieTextures = (theme: Theme, size: number): DieTextures => {
  const rng = new Rng(theme.seed ^ 0x5eed);
  const { canvas: albedoC, ctx: a } = makeCanvas(size);
  const { canvas: emisC, ctx: e } = makeCanvas(size);

  a.fillStyle = theme.chip.bodyColor;
  a.fillRect(0, 0, size, size);
  e.fillStyle = '#000000';
  e.fillRect(0, 0, size, size);

  // Die area inset inside the heat spreader.
  const inset = size * 0.1;
  const dieSize = size - inset * 2;
  const grad = a.createLinearGradient(inset, inset, size - inset, size - inset);
  const darken = (hex: string, k: number) =>
    `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;
  // The glass V2 package keeps its full-strength gradient; the silicon
  // packages get a much darker die so the lit interconnect and the label
  // stand off it instead of washing into it.
  const k = theme.chip.iridescent ? 1 : 0.38;
  grad.addColorStop(0, darken(theme.chip.dieColorB, k));
  grad.addColorStop(1, darken(theme.chip.dieColorA, k));
  a.fillStyle = grad;
  a.fillRect(inset, inset, dieSize, dieSize);

  // --- functional blocks: cores, uncore, IO --------------------------------
  interface Block { x: number; y: number; w: number; h: number }
  const blocks: Block[] = [];
  for (let i = 0; i < 120; i++) {
    const bw = rng.range(0.05, 0.26) * dieSize;
    const bh = rng.range(0.05, 0.22) * dieSize;
    const bx = inset + rng.float() * (dieSize - bw);
    const by = inset + rng.float() * (dieSize - bh);
    blocks.push({ x: bx, y: by, w: bw, h: bh });
    a.fillStyle = `rgba(255,255,255,${rng.range(0.015, 0.06).toFixed(3)})`;
    a.fillRect(bx, by, bw, bh);
    a.strokeStyle = `rgba(255,255,255,${rng.range(0.05, 0.18).toFixed(3)})`;
    a.lineWidth = size * 0.0015;
    a.strokeRect(bx, by, bw, bh);
  }

  // --- cache banks: tight regular arrays inside some of the blocks ---------
  for (const b of blocks) {
    if (!rng.chance(0.34) || b.w < dieSize * 0.08) continue;
    const vertical = rng.chance(0.5);
    const pitch = rng.range(0.006, 0.016) * dieSize;
    const inner = size * 0.0016;
    a.fillStyle = `rgba(255,255,255,${rng.range(0.05, 0.12).toFixed(3)})`;
    e.fillStyle = `rgba(255,255,255,${rng.range(0.04, 0.1).toFixed(3)})`;
    if (vertical) {
      for (let x = b.x + pitch; x < b.x + b.w - pitch; x += pitch) {
        a.fillRect(x, b.y + inner, inner, b.h - inner * 2);
        e.fillRect(x, b.y + inner, inner, b.h - inner * 2);
      }
    } else {
      for (let y = b.y + pitch; y < b.y + b.h - pitch; y += pitch) {
        a.fillRect(b.x + inner, y, b.w - inner * 2, inner);
        e.fillRect(b.x + inner, y, b.w - inner * 2, inner);
      }
    }
  }

  // --- interconnect, two scales -------------------------------------------
  e.lineCap = 'butt';
  const drawLanes = (count: number, lenMin: number, lenMax: number, wMin: number, wMax: number, aMin: number, aMax: number) => {
    for (let i = 0; i < count; i++) {
      const horizontal = rng.chance(0.5);
      const len = rng.range(lenMin, lenMax) * dieSize;
      const x = inset + rng.float() * (dieSize - (horizontal ? len : 0));
      const y = inset + rng.float() * (dieSize - (horizontal ? 0 : len));
      const w = rng.range(wMin, wMax) * size;
      const alpha = rng.range(aMin, aMax);
      const x2 = horizontal ? x + len : x;
      const y2 = horizontal ? y : y + len;

      e.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      e.lineWidth = w;
      e.beginPath();
      e.moveTo(x, y);
      e.lineTo(x2, y2);
      e.stroke();

      a.strokeStyle = `rgba(255,255,255,${(alpha * 0.4).toFixed(3)})`;
      a.lineWidth = w;
      a.beginPath();
      a.moveTo(x, y);
      a.lineTo(x2, y2);
      a.stroke();
    }
  };
  drawLanes(180, 0.12, 0.62, 0.0018, 0.004, 0.06, 0.26); // power/IO spines
  drawLanes(520, 0.02, 0.16, 0.0006, 0.0016, 0.03, 0.14); // fine signal routing

  // --- bond pad ring -------------------------------------------------------
  const padInset = inset + dieSize * 0.028;
  const padSpan = dieSize - dieSize * 0.056;
  const padCount = 46;
  for (let i = 0; i < padCount; i++) {
    const t = (i + 0.5) / padCount;
    const pr = size * 0.0032;
    const spots: Array<[number, number]> = [
      [padInset + t * padSpan, padInset],
      [padInset + t * padSpan, padInset + padSpan],
      [padInset, padInset + t * padSpan],
      [padInset + padSpan, padInset + t * padSpan],
    ];
    for (const [px, py] of spots) {
      a.fillStyle = 'rgba(255,255,255,0.3)';
      a.beginPath();
      a.arc(px, py, pr, 0, Math.PI * 2);
      a.fill();
      e.fillStyle = 'rgba(255,255,255,0.22)';
      e.beginPath();
      e.arc(px, py, pr * 0.85, 0, Math.PI * 2);
      e.fill();
    }
  }

  // --- heat-spreader lip and pin-1 marker ---------------------------------
  a.strokeStyle = 'rgba(255,255,255,0.22)';
  a.lineWidth = size * 0.012;
  a.strokeRect(inset * 0.5, inset * 0.5, size - inset, size - inset);
  a.strokeStyle = 'rgba(255,255,255,0.1)';
  a.lineWidth = size * 0.003;
  a.strokeRect(inset * 0.78, inset * 0.78, size - inset * 1.56, size - inset * 1.56);

  // Pin-1 corner triangle, as on a real package.
  a.fillStyle = 'rgba(255,255,255,0.3)';
  a.beginPath();
  a.moveTo(inset * 0.62, inset * 0.62);
  a.lineTo(inset * 1.5, inset * 0.62);
  a.lineTo(inset * 0.62, inset * 1.5);
  a.closePath();
  a.fill();

  // The label. Drawn into both channels so it reads when unlit too.
  drawAI(e, size / 2, size / 2, size * 0.42, '#ffffff', 1);
  drawAI(a, size / 2, size / 2, size * 0.42, theme.chip.labelColor, 1);

  // A very restrained halo behind the glyphs. Anything stronger and the
  // bloom swallows the letterforms, which are the whole point of the shot.
  const halo = e.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.44);
  halo.addColorStop(0, 'rgba(255,255,255,0.1)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  e.globalCompositeOperation = 'lighter';
  e.fillStyle = halo;
  e.fillRect(0, 0, size, size);
  e.globalCompositeOperation = 'source-over';

  const albedo = toTexture(albedoC, true);
  const emissive = toTexture(emisC, false);
  return {
    albedo,
    emissive,
    dispose: () => {
      albedo.dispose();
      emissive.dispose();
    },
  };
};

/** LGA contact grid — used for the socket floor and the chip underside. */
export const createPadGridTexture = (theme: Theme, size: number, cells = 46) => {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = theme.socket.frameColor;
  ctx.fillRect(0, 0, size, size);
  const step = size / cells;
  const r = step * 0.3;
  for (let ix = 0; ix < cells; ix++) {
    for (let iy = 0; iy < cells; iy++) {
      const x = (ix + 0.5) * step;
      const y = (iy + 0.5) * step;
      ctx.fillStyle = theme.socket.padColor;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(x + r * 0.18, y + r * 0.18, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toTexture(canvas, true);
};

/** Soft elongated streak used by the additive ray/stream instances. */
export const createStreakTexture = (size = 256) => {
  const { canvas, ctx } = makeCanvas(size, size);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.42, 'rgba(255,255,255,1)');
  g.addColorStop(0.58, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Taper the head and tail horizontally as well.
  const h = ctx.createLinearGradient(0, 0, size, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)');
  h.addColorStop(0.25, 'rgba(0,0,0,0)');
  h.addColorStop(0.75, 'rgba(0,0,0,0)');
  h.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  return toTexture(canvas, false);
};

/** Radially fading dot — dust motes and glow sprites. */
export const createDotTexture = (size = 128, hardness = 0.0) => {
  const { canvas, ctx } = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * hardness * 0.5, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas, false);
};

/** The V2 signature: a ring of halftone dots that grows out of the socket. */
export const createHalftoneTexture = (size = 1024, cells = 54) => {
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  const step = size / cells;
  const c = size / 2;
  for (let ix = 0; ix < cells; ix++) {
    for (let iy = 0; iy < cells; iy++) {
      const x = (ix + 0.5) * step;
      const y = (iy + 0.5) * step;
      const d = Math.hypot(x - c, y - c) / c;
      if (d > 1) continue;
      // Dots grow toward the rim, then fall away at the very edge.
      const s = Math.sin(Math.min(1, d) * Math.PI) * (1 - d * 0.35);
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, s).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, step * 0.3 * Math.max(0.05, s), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toTexture(canvas, false);
};

/**
 * Seamless fine-grain PCB detail, tiled across the far board. The hero
 * routing lives on its own higher-density plane; this only has to survive
 * being heavily fogged and defocused.
 */
export const createBoardGrainTexture = (theme: Theme, size = 1024) => {
  const rng = new Rng(theme.seed ^ 0x9e37);
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = theme.board.color;
  ctx.fillRect(0, 0, size, size);

  // Wrap-safe drawing: everything is drawn nine times, offset by the tile,
  // so strokes that leave one edge re-enter on the other.
  const tiled = (draw: (ox: number, oy: number) => void) => {
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) draw(ox * size, oy * size);
  };

  ctx.lineCap = 'square';
  for (let i = 0; i < 420; i++) {
    const horizontal = rng.chance(0.5);
    const x = rng.float() * size;
    const y = rng.float() * size;
    const len = rng.range(0.04, 0.3) * size;
    const w = rng.range(0.0018, 0.0042) * size;
    ctx.strokeStyle = theme.board.traceColor;
    ctx.globalAlpha = rng.range(0.35, 0.9);
    ctx.lineWidth = w;
    tiled((ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(horizontal ? x + len + ox : x + ox, horizontal ? y + oy : y + len + oy);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < 700; i++) {
    const x = rng.float() * size;
    const y = rng.float() * size;
    const r = rng.range(0.0018, 0.005) * size;
    ctx.fillStyle = theme.socket.padColor;
    ctx.globalAlpha = 0.45;
    tiled((ox, oy) => {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.globalAlpha = 1;

  const tex = toTexture(canvas, true);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

/** Soft annulus used for the expanding shockwave. */
export const createRingTexture = (size = 512, inner = 0.66, outer = 0.98) => {
  const { canvas, ctx } = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      let a = 0;
      if (d > inner && d < outer) {
        const t = (d - inner) / (outer - inner);
        a = Math.sin(t * Math.PI); // soft on both edges
        a = Math.pow(a, 1.6);
      }
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, false);
};

/** Inverted soft blob used as a fake contact shadow under the package. */
export const createShadowTexture = (size = 256) => {
  const { canvas, ctx } = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas, false);
};
