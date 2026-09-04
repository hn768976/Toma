import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Layer } from './Layer';
import { mulberry32 } from '../lib/rng';

type Star = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  colour: string;
  halo: number;
  /** Twinkling stars only: whole cycles over the loop, and a phase offset. */
  cycles: number;
  phase: number;
};

type Props = {
  seed: number;
  /** 2000–3500 works well at 4K. */
  count?: number;
  /** Share of stars that twinkle. */
  twinkle?: number;
  brightness?: number;
};

const WHITE = 'rgb(255,255,255)';
const PALE_BLUE = 'rgb(186,208,255)';
const AMBER = 'rgb(255,214,166)';

const layoutCache = new Map<string, { fixed: Star[]; twinklers: Star[] }>();

const layout = (seed: number, count: number, twinkle: number, w: number, h: number) => {
  const key = `${seed}|${count}|${twinkle}|${w}x${h}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;

  const rnd = mulberry32(seed);
  const fixed: Star[] = [];
  const twinklers: Star[] = [];
  const px = h / 2160; // 1–3px sizes are quoted at 4K

  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    // Weight brightness hard toward the faint end so the field reads as depth
    // rather than as a scatter of equal dots.
    const b = Math.pow(rnd(), 2.6);
    const tint = rnd();
    const star: Star = {
      x,
      y,
      size: (1 + b * 2) * px,
      alpha: 0.1 + b * 0.85,
      colour: tint > 0.88 ? PALE_BLUE : tint > 0.8 ? AMBER : WHITE,
      halo: b > 0.86 ? (2.5 + b * 5) * px : 0,
      cycles: 2 + Math.floor(rnd() * 6),
      phase: rnd(),
    };
    if (rnd() < twinkle) twinklers.push(star);
    else fixed.push(star);
  }

  const result = { fixed, twinklers };
  layoutCache.set(key, result);
  return result;
};

const paint = (ctx: CanvasRenderingContext2D, s: Star, alpha: number) => {
  if (s.halo > 0) {
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.halo);
    g.addColorStop(0, s.colour.replace('rgb', 'rgba').replace(')', `,${alpha * 0.5})`));
    g.addColorStop(1, s.colour.replace('rgb', 'rgba').replace(')', ',0)'));
    ctx.fillStyle = g;
    ctx.fillRect(s.x - s.halo, s.y - s.halo, s.halo * 2, s.halo * 2);
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = s.colour;
  ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
  ctx.globalAlpha = 1;
};

/**
 * The still stars. Memoised on its props, so across a sequential run of frames
 * React never re-renders it, the layout effect never fires again, and the
 * full-resolution canvas keeps the content it was given on the first frame.
 * Repainting ~2700 stars into a 4K canvas 600 times over would be pure waste —
 * the sky never moves.
 */
const FixedStars = React.memo<Props>(({ seed, count = 2800, twinkle = 0.06, brightness = 1 }) => (
  <Layer
    res={1}
    draw={(ctx, w, h) => {
      for (const s of layout(seed, count, twinkle, w, h).fixed) paint(ctx, s, s.alpha * brightness);
    }}
  />
));
FixedStars.displayName = 'FixedStars';

/**
 * A fixed sky — it never rotates or drifts. Only a small share of the stars
 * twinkle, on slow staggered cycles that each complete a whole number of times
 * over the loop, so the twinkling closes seamlessly.
 */
export const Starfield: React.FC<Props> = (props) => {
  const { seed, count = 2800, twinkle = 0.06, brightness = 1 } = props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;

  return (
    <>
      <FixedStars {...props} />
      <Layer
        res={1}
        draw={(ctx, w, h) => {
          for (const s of layout(seed, count, twinkle, w, h).twinklers) {
            const osc = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (t * s.cycles + s.phase));
            paint(ctx, s, s.alpha * brightness * (0.25 + 0.75 * osc));
          }
        }}
      />
    </>
  );
};
