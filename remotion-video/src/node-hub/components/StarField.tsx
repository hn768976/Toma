/**
 * The starfield backdrop, shared by all three variants.
 *
 * The dark field, the broad wash behind the hub and every star are static, so
 * they are drawn ONCE into an offscreen canvas and blitted each frame — at 4K
 * that is the difference between one 1400-point scatter and 450 of them. Only
 * the bokeh discs move, and they drift on closed elliptical paths whose
 * periods divide the loop, so frame 0 and frame 450 match exactly.
 */
import { useMemo } from "react";
import { withAlpha } from "../color";
import { makeOffscreen } from "../passes";
import { LOOP_FRAMES, PERIODS } from "../constants";
import { pick, rand, randRange } from "../seed";
import { Layer } from "./Layer";
import type { Palette } from "../variants";

const STAR_COUNT = 1500;
const BRIGHT_STAR_COUNT = 26;
const BOKEH_COUNT = 20;

type Bokeh = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  driftX: number;
  driftY: number;
  period: number;
  phase: number;
};

/**
 * Rejection-samples a point that is likelier to land near the centre: a
 * candidate at the frame's edge is accepted about a fifth as often as one at
 * the middle, which thins the field toward the margins without leaving a
 * visible boundary.
 */
const sampleStar = (
  seed: string,
  index: number,
  width: number,
  height: number,
): { x: number; y: number } => {
  const halfDiagonal = Math.hypot(width, height) / 2;
  let x = width / 2;
  let y = height / 2;
  for (let attempt = 0; attempt < 6; attempt++) {
    x = rand(`${seed}/sx/${index}/${attempt}`) * width;
    y = rand(`${seed}/sy/${index}/${attempt}`) * height;
    const d = Math.hypot(x - width / 2, y - height / 2) / halfDiagonal;
    if (rand(`${seed}/keep/${index}/${attempt}`) < 1 - 0.8 * d) break;
  }
  return { x, y };
};

const drawStatic = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: Palette,
  seed: string,
) => {
  ctx.fillStyle = palette.bgDeep;
  ctx.fillRect(0, 0, width, height);

  // Broad soft wash behind the hub, plus a smaller lift above it so the frame
  // is not evenly lit top to bottom.
  const wash = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    height * 0.78,
  );
  wash.addColorStop(0, withAlpha(palette.bgWash, 0.85));
  wash.addColorStop(0.42, withAlpha(palette.bgWash, 0.34));
  wash.addColorStop(1, withAlpha(palette.bgWash, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  const lift = ctx.createRadialGradient(
    width * 0.5,
    height * 0.06,
    0,
    width * 0.5,
    height * 0.06,
    height * 0.5,
  );
  lift.addColorStop(0, withAlpha(palette.bgWash, 0.5));
  lift.addColorStop(1, withAlpha(palette.bgWash, 0));
  ctx.fillStyle = lift;
  ctx.fillRect(0, 0, width, height);

  // The field: mostly dim. Cubing the brightness draw pushes the bulk of the
  // points down near invisible and leaves a scattering that reads.
  for (let i = 0; i < STAR_COUNT; i++) {
    const { x, y } = sampleStar(seed, i, width, height);
    const brightness = Math.pow(rand(`${seed}/sb/${i}`), 3);
    const radius = randRange(`${seed}/sr/${i}`, 1.1, 2.6);
    ctx.fillStyle = withAlpha(palette.starPale, 0.16 + brightness * 0.72);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // A few larger, brighter points scattered among them, each with a small halo.
  for (let i = 0; i < BRIGHT_STAR_COUNT; i++) {
    const { x, y } = sampleStar(`${seed}/brightpos`, i, width, height);
    const radius = randRange(`${seed}/br/${i}`, 3.2, 6.4);
    const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 7);
    halo.addColorStop(0, withAlpha(palette.hubText, 0.5));
    halo.addColorStop(0.3, withAlpha(palette.starPale, 0.16));
    halo.addColorStop(1, withAlpha(palette.starPale, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, radius * 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(palette.hubText, 0.92);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
};

export type StarFieldProps = {
  palette: Palette;
  frame: number;
  width: number;
  height: number;
  seed: string;
};

export const StarField: React.FC<StarFieldProps> = ({
  palette,
  frame,
  width,
  height,
  seed,
}) => {
  const stars = useMemo(() => {
    const { canvas, ctx } = makeOffscreen(width, height);
    drawStatic(ctx, width, height, palette, seed);
    return canvas;
  }, [width, height, palette, seed]);

  const bokeh = useMemo<Bokeh[]>(
    () =>
      Array.from({ length: BOKEH_COUNT }, (_, i) => ({
        x: randRange(`${seed}/bk/x/${i}`, -0.05, 1.05) * width,
        y: randRange(`${seed}/bk/y/${i}`, -0.05, 1.05) * height,
        radius: randRange(`${seed}/bk/r/${i}`, 44, 168),
        alpha: randRange(`${seed}/bk/a/${i}`, 0.016, 0.058),
        driftX: randRange(`${seed}/bk/dx/${i}`, 28, 120),
        driftY: randRange(`${seed}/bk/dy/${i}`, 20, 96),
        period: pick(`${seed}/bk/p/${i}`, PERIODS.bokeh),
        phase: rand(`${seed}/bk/ph/${i}`) * Math.PI * 2,
      })),
    [width, height, seed],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.drawImage(stars, 0, 0);

    const f = frame % LOOP_FRAMES;
    for (const disc of bokeh) {
      // A closed ellipse: whatever the period, the dot is back where it
      // started after a whole number of cycles within the loop.
      const angle = (f / disc.period) * Math.PI * 2 + disc.phase;
      const x = disc.x + Math.cos(angle) * disc.driftX;
      const y = disc.y + Math.sin(angle) * disc.driftY;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, disc.radius);
      gradient.addColorStop(0, withAlpha(palette.hubArc, disc.alpha));
      gradient.addColorStop(0.72, withAlpha(palette.hubArc, disc.alpha * 0.55));
      gradient.addColorStop(1, withAlpha(palette.hubArc, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, disc.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  return <Layer draw={draw} width={width} height={height} />;
};
