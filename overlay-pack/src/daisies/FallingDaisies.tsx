import { useCallback } from "react";
import { CanvasStage, DrawInfo, makeCanvas } from "../lib/CanvasStage";
import { mulberry32, range, Rng } from "../lib/random";
import { DAISIES, GREEN } from "../config";

const LOOP = 600;

type Layer = {
  count: number;
  size: [number, number]; // diameter, fraction of H
  passes: number[]; // whole falls through the frame per loop
  sway: [number, number]; // fraction of W
  blur: number; // px at 4K (0 = sharp)
};

const LAYERS: Layer[] = [
  { count: DAISIES.far, size: [0.024, 0.038], passes: [1, 2], sway: [0.004, 0.012], blur: 0 },
  { count: DAISIES.mid, size: [0.05, 0.07], passes: [2, 3], sway: [0.01, 0.022], blur: 0 },
  { count: DAISIES.near, size: [0.085, 0.105], passes: [3, 4], sway: [0.018, 0.035], blur: 6.5 },
];

type Daisy = {
  layer: number;
  seed: number;
  size: number;
  x0: number;
  y0: number;
  passes: number;
  swayAmp: number;
  swayCycles: number;
  swayPhase: number;
  spin0: number;
  spinCycles: number;
  tiltCycles: number;
  tiltPhase: number;
  axis0: number;
  axisCycles: number;
  tiltDepth: number;
};

const rng = mulberry32(4035586413);
const sign = (r: Rng) => (r() < 0.5 ? -1 : 1);
const DAISY_LIST: Daisy[] = LAYERS.flatMap((L, li) =>
  Array.from({ length: L.count }, (_, i) => ({
    layer: li,
    seed: li * 1000 + i + 1,
    size: range(rng, L.size[0], L.size[1]),
    x0: range(rng, -0.01, 1.01),
    y0: rng(),
    passes: L.passes[Math.floor(rng() * L.passes.length)],
    swayAmp: range(rng, L.sway[0], L.sway[1]),
    swayCycles: 3 + Math.floor(rng() * 5),
    swayPhase: range(rng, 0, Math.PI * 2),
    spin0: range(rng, 0, Math.PI * 2),
    spinCycles: sign(rng) * (1 + Math.floor(rng() * 2)),
    tiltCycles: 2 + Math.floor(rng() * 4),
    tiltPhase: range(rng, 0, Math.PI * 2),
    axis0: range(rng, 0, Math.PI),
    axisCycles: sign(rng) * Math.floor(rng() * 2),
    tiltDepth: range(rng, 0.2, 0.42),
  })),
);

// Paint one daisy (radius R) centred at the origin.
const paintDaisy = (ctx: CanvasRenderingContext2D, R: number, seed: number) => {
  const r = mulberry32(seed * 7919);
  const petals = 16 + Math.floor(r() * 3);
  const core = R * range(r, 0.21, 0.25);
  const petalGrad = ctx.createRadialGradient(0, 0, core * 0.8, 0, 0, R);
  petalGrad.addColorStop(0, DAISIES.shade);
  petalGrad.addColorStop(0.5, DAISIES.petal);
  petalGrad.addColorStop(1, DAISIES.petal);

  const off = range(r, 0, Math.PI * 2);
  for (let p = 0; p < petals; p++) {
    const a = off + (p / petals) * Math.PI * 2 + range(r, -0.07, 0.07);
    const len = R * range(r, 0.84, 1.0);
    const halfW = ((Math.PI * R) / petals) * range(r, 0.7, 0.85);
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(core * 0.6, 0);
    ctx.bezierCurveTo(core + (len - core) * 0.3, -halfW * 1.1, len - halfW * 0.6, -halfW, len, 0);
    ctx.bezierCurveTo(len - halfW * 0.6, halfW, core + (len - core) * 0.3, halfW * 1.1, core * 0.6, 0);
    ctx.closePath();
    ctx.rotate(-a);
    ctx.fillStyle = petalGrad;
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, R * 0.025);
    ctx.strokeStyle = "rgba(170,170,165,0.45)";
    ctx.stroke();
    ctx.restore();
  }
  const cg = ctx.createRadialGradient(-core * 0.3, -core * 0.3, 0, 0, 0, core);
  cg.addColorStop(0, "#FFD24A");
  cg.addColorStop(0.6, DAISIES.centre);
  cg.addColorStop(1, "#D98A0E");
  ctx.beginPath();
  ctx.arc(0, 0, core, 0, Math.PI * 2);
  ctx.fillStyle = cg;
  ctx.fill();
};

// Sprites are rendered once per output resolution, at each daisy's display size.
let spriteCache: { ratio: number; sprites: HTMLCanvasElement[] } | null = null;
const getSprites = (H: number, ratio: number) => {
  if (spriteCache && spriteCache.ratio === ratio) return spriteCache.sprites;
  const sprites = DAISY_LIST.map((d) => {
    const R = (d.size * H * ratio) / 2;
    const blur = LAYERS[d.layer].blur * ratio;
    const pad = Math.ceil(blur * 3 + 2);
    const side = Math.ceil(2 * R + 2 * pad);
    const c = makeCanvas(side, side);
    const g = c.getContext("2d")!;
    g.translate(side / 2, side / 2);
    if (blur > 0) {
      const tmp = makeCanvas(side, side);
      const t = tmp.getContext("2d")!;
      t.translate(side / 2, side / 2);
      paintDaisy(t, R, d.seed);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.filter = `blur(${blur}px)`;
      g.drawImage(tmp, 0, 0);
      g.filter = "none";
    } else {
      paintDaisy(g, R, d.seed);
    }
    return c;
  });
  spriteCache = { ratio, sprites };
  return sprites;
};

export const FallingDaisies: React.FC<{ extraFrames?: number }> = () => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, info: DrawInfo) => {
    const { width: W, height: H, frame, pxRatio } = info;
    const sprites = getSprites(H, pxRatio);
    const t = (((frame % LOOP) + LOOP) % LOOP) / LOOP;
    const TAU = Math.PI * 2;
    DAISY_LIST.forEach((d, i) => {
      const img = sprites[i];
      const halfSide = img.width / pxRatio / 2;
      const margin = halfSide * 1.05;
      const travel = H + 2 * margin;
      const y = ((d.y0 + d.passes * t) % 1) * travel - margin;
      const x = d.x0 * W + d.swayAmp * W * Math.sin(TAU * d.swayCycles * t + d.swayPhase);
      const spin = d.spin0 + TAU * d.spinCycles * t + 0.25 * Math.sin(TAU * d.swayCycles * t + d.swayPhase);
      const axis = d.axis0 + TAU * d.axisCycles * t;
      // 3D turn: squash along a slowly rotating axis (petals foreshorten).
      const squash = 1 - d.tiltDepth * (0.5 + 0.5 * Math.cos(TAU * d.tiltCycles * t + d.tiltPhase));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(axis);
      ctx.scale(1, squash);
      ctx.rotate(spin - axis);
      ctx.drawImage(img, -halfSide, -halfSide, halfSide * 2, halfSide * 2);
      ctx.restore();
    });
  }, []);
  return <CanvasStage background={GREEN} draw={draw} />;
};
