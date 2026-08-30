import { useLayoutEffect, useMemo } from "react";
import {
  beginWorld,
  context2d,
  layerFor,
  makeCanvas,
  type Buffers,
} from "./buffers";
import { withAlpha } from "./color";
import {
  CANVAS_H,
  CANVAS_W,
  DURATION,
  RING_OUTER,
  SYMBOL_CX,
  SYMBOL_CY,
} from "./layout";
import { rnd, rndInt, rndRange } from "./rng";
import type { Depth, VariantConfig } from "./variants";

const SPRITE_SIZE = 256;

type Disc = {
  x: number;
  y: number;
  r: number;
  alpha: number;
  ax: number;
  ay: number;
  kx: number;
  ky: number;
  px: number;
  py: number;
  twinkle: number;
  twinklePhase: number;
  depth: Depth;
  front: boolean;
  spriteKey: string;
};

/**
 * Softness profiles. Profiles 0-2 cover receding depth; profile 3 is reserved
 * for the discs that pass in front of the symbol -- soft edged but solid
 * enough to genuinely occlude, which is what places the symbol inside the
 * space rather than on top of a background.
 */
const SOFTNESS: readonly (readonly [number, number][])[] = [
  [
    [0, 0.85],
    [0.68, 0.82],
    [0.88, 1],
    [1, 0],
  ],
  [
    [0, 0.7],
    [0.52, 0.6],
    [0.86, 0.42],
    [1, 0],
  ],
  [
    [0, 0.55],
    [0.38, 0.44],
    [0.78, 0.16],
    [1, 0],
  ],
  [
    [0, 0.95],
    [0.5, 0.9],
    [0.82, 0.6],
    [1, 0],
  ],
];

const makeDiscSprite = (color: string, softness: number) => {
  const canvas = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = context2d(canvas);
  const c = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (const [stop, alpha] of SOFTNESS[softness]) {
    gradient.addColorStop(stop, withAlpha(color, alpha));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
};

type Props = {
  buffers: Buffers;
  cfg: VariantConfig;
  frame: number;
  drift: { x: number; y: number };
  /** "back" draws the field behind the rings, "front" the discs that occlude. */
  pass: "back" | "front";
};

/**
 * Soft out-of-focus discs at mixed depths. The colour mix matters: a
 * single-hue field reads as a gradient, the scattered warm and accent discs
 * are what make it read as an out-of-focus environment.
 */
export const BokehField: React.FC<Props> = ({ buffers, cfg, frame, drift, pass }) => {
  const field = useMemo(() => {
    const sprites = new Map<string, HTMLCanvasElement>();
    const colorFor = (i: number) => {
      const u = rnd(`${cfg.seed}-bok-hue-${i}`);
      if (u < 0.65) return { key: "p", color: cfg.palette.bokehPrimary };
      if (u < 0.85) return { key: "w", color: cfg.palette.bokehWarm };
      return { key: "a", color: cfg.palette.bokehAccent };
    };

    const discs: Disc[] = [];
    for (let i = 0; i < cfg.bokehCount; i++) {
      const front = rnd(`${cfg.seed}-bok-front-${i}`) < 0.18;
      const r = front
        ? rndRange(`${cfg.seed}-bok-r-${i}`, 90, 160)
        : rndRange(`${cfg.seed}-bok-r-${i}`, 20, 160);

      // Front discs are placed over the symbol so they genuinely overlap it.
      const angle = rndRange(`${cfg.seed}-bok-ang-${i}`, 0, Math.PI * 2);
      const reach = rndRange(`${cfg.seed}-bok-reach-${i}`, 0, 0.55) * RING_OUTER;
      const x = front
        ? SYMBOL_CX + Math.cos(angle) * reach
        : rndRange(`${cfg.seed}-bok-x-${i}`, -120, CANVAS_W + 120);
      const y = front
        ? SYMBOL_CY + Math.sin(angle) * reach
        : rndRange(`${cfg.seed}-bok-y-${i}`, -120, CANVAS_H + 120);

      // Larger discs sit further out and read blurrier; front discs stay in the
      // sharp buffer but use the softest profile so they still read defocused.
      const softness = front ? 3 : r > 105 ? 2 : r > 60 ? 1 : 0;
      const depth: Depth = front ? "near" : r > 105 ? "far" : r > 60 ? "mid" : "near";

      const { key, color } = colorFor(i);
      const spriteKey = `${key}-${softness}`;
      if (!sprites.has(spriteKey)) {
        sprites.set(spriteKey, makeDiscSprite(color, softness));
      }

      discs.push({
        x,
        y,
        r,
        alpha:
          (front
            ? rndRange(`${cfg.seed}-bok-al-${i}`, 0.34, 0.6)
            : rndRange(`${cfg.seed}-bok-al-${i}`, 0.15, 0.6)) *
          cfg.bokehOpacityScale,
        ax: rndRange(`${cfg.seed}-bok-ax-${i}`, 40, 260),
        ay: rndRange(`${cfg.seed}-bok-ay-${i}`, 40, 220),
        kx: rndInt(`${cfg.seed}-bok-kx-${i}`, 1, 3),
        ky: rndInt(`${cfg.seed}-bok-ky-${i}`, 1, 3),
        px: rndRange(`${cfg.seed}-bok-px-${i}`, 0, Math.PI * 2),
        py: rndRange(`${cfg.seed}-bok-py-${i}`, 0, Math.PI * 2),
        twinkle: rndInt(`${cfg.seed}-bok-tw-${i}`, 1, 5),
        twinklePhase: rndRange(`${cfg.seed}-bok-tp-${i}`, 0, Math.PI * 2),
        depth,
        front,
        spriteKey,
      });
    }
    return { discs, sprites };
  }, [cfg]);

  useLayoutEffect(() => {
    const t = frame / DURATION;
    for (const d of field.discs) {
      if (d.front !== (pass === "front")) {
        continue;
      }
      const sprite = field.sprites.get(d.spriteKey);
      if (!sprite) {
        continue;
      }
      // Closed drift paths: integer harmonics return to the start at frame 900.
      const x = d.x + d.ax * Math.sin(2 * Math.PI * d.kx * t + d.px);
      const y = d.y + d.ay * Math.cos(2 * Math.PI * d.ky * t + d.py);
      const alpha =
        d.alpha * (1 + 0.18 * Math.sin(2 * Math.PI * d.twinkle * t + d.twinklePhase));

      const layer = layerFor(buffers, d.depth);
      const ctx = beginWorld(layer, drift);
      // Front discs occlude rather than add, which is what places the symbol
      // inside the space instead of on top of it.
      ctx.globalCompositeOperation = d.front ? "source-over" : "lighter";
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.drawImage(sprite, x - d.r, y - d.r, d.r * 2, d.r * 2);
    }
  });

  return null;
};
