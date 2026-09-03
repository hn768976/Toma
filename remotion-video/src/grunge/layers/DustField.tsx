import React, { useLayoutEffect, useMemo } from "react";
import { LOOP_OMEGA } from "../constants";
import { createCanvas } from "../lib/canvas";
import { rgba } from "../lib/color";
import { rnd, rndBool, rndInt, rndRange } from "../lib/rng";
import type { LayerBaseProps } from "./types";
import { layerContext } from "./types";
import type { LayerSettings, MotionSettings } from "../variants";

/**
 * Out-of-focus dust drifting through the frame.
 *
 * Depth is the organising idea: one value per mote drives size, wander
 * amplitude, opacity and how soft its edge is. Near motes are large, slow-
 * edged discs at low opacity; far ones are small, near-sharp and brighter.
 *
 * Two performance decisions matter at 4K:
 *
 *  - Sizes are quantised into depth brackets and each bracket is rendered
 *    once into a small sprite. Drawing a blurred radial gradient per mote per
 *    frame would be 450 gradient allocations a frame; blitting from an atlas
 *    is one drawImage each.
 *  - The mote table is built in a useMemo, so the several thousand random()
 *    calls happen once rather than 900 times.
 */

const BRACKETS = 8;
const MIN_SIZE = 4;
const MAX_SIZE = 70;
/** 8% of motes catch a light source and read noticeably brighter. */
const BRIGHT_FRACTION = 0.08;

const sizeForBracket = (bracket: number): number =>
  MIN_SIZE * Math.pow(MAX_SIZE / MIN_SIZE, bracket / (BRACKETS - 1));

/**
 * One sprite per (depth bracket, brightness class). The alpha profile goes
 * from a crisp dot at the far end to a flat-cored disc with a wide soft edge
 * at the near end — the shape a point of light takes when it is well outside
 * the focal plane.
 */
const buildSprite = (bracket: number, color: string): HTMLCanvasElement | null => {
  const size = sizeForBracket(bracket);
  const softness = bracket / (BRACKETS - 1);
  const dim = Math.ceil(size) + 4;
  const canvas = createCanvas(dim, dim);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const radius = size / 2;
  const centre = dim / 2;
  const core = 0.72 - 0.17 * softness;
  const gamma = 2.4 - 1.0 * softness;

  const gradient = ctx.createRadialGradient(centre, centre, 0, centre, centre, radius);
  const stops = 14;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const a = t <= core ? 1 : Math.pow((1 - t) / (1 - core), gamma);
    gradient.addColorStop(t, rgba(color, a));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, dim, dim);
  return canvas;
};

type Mote = {
  bracket: number;
  bright: boolean;
  opacity: number;
  x0: number;
  y0: number;
  ax1: number;
  ax2: number;
  kx1: number;
  kx2: number;
  px1: number;
  px2: number;
  ay1: number;
  ay2: number;
  ky1: number;
  ky2: number;
  py1: number;
  py2: number;
};

/**
 * Each mote travels its own closed path built from two sines per axis at
 * different integer harmonics of the loop. Integer harmonics are what make
 * the path close exactly at frame 900; two of them at different periods are
 * what stop it reading as straight-line drift, which looks like snow rather
 * than dust.
 */
const buildMotes = (
  count: number,
  width: number,
  height: number,
  wanderScale: number,
): Mote[] => {
  const motes: Mote[] = [];
  for (let i = 0; i < count; i++) {
    const s = "mote" + i;
    const depth = rnd(s + "|depth");
    const bracket = Math.min(BRACKETS - 1, Math.floor(depth * BRACKETS));
    const bright = rndBool(s + "|bright", BRIGHT_FRACTION);

    // Far motes read brighter and more solid; near ones are dimmer because
    // their light is spread over a much larger disc.
    const baseOpacity = 0.7 - 0.55 * depth + rndRange(s + "|ovar", -0.1, 0.1);
    const opacity = bright
      ? Math.max(0.25, Math.min(0.7, baseOpacity * 1.5 + 0.15))
      : Math.max(0.1, Math.min(0.7, baseOpacity));

    const amp = (40 + 620 * depth) * wanderScale;
    const kx1 = rndInt(s + "|kx1", 1, 2);
    const ky1 = rndInt(s + "|ky1", 1, 2);

    motes.push({
      bracket,
      bright,
      opacity,
      // Spread a little beyond the frame so motes enter and leave the edges.
      x0: rndRange(s + "|x0", -0.06 * width, 1.06 * width),
      y0: rndRange(s + "|y0", -0.06 * height, 1.06 * height),
      ax1: amp * rndRange(s + "|ax1", 0.6, 1),
      ax2: amp * rndRange(s + "|ax2", 0.15, 0.4),
      kx1,
      kx2: kx1 + rndInt(s + "|kx2", 1, 3),
      px1: rndRange(s + "|px1", 0, Math.PI * 2),
      px2: rndRange(s + "|px2", 0, Math.PI * 2),
      // Dust drifts more horizontally than vertically.
      ay1: amp * 0.7 * rndRange(s + "|ay1", 0.6, 1),
      ay2: amp * 0.7 * rndRange(s + "|ay2", 0.15, 0.4),
      ky1,
      ky2: ky1 + rndInt(s + "|ky2", 1, 3),
      py1: rndRange(s + "|py1", 0, Math.PI * 2),
      py2: rndRange(s + "|py2", 0, Math.PI * 2),
    });
  }
  return motes;
};

type DustFieldProps = LayerBaseProps & {
  settings: LayerSettings["dust"];
  motion: MotionSettings;
};

export const DustField: React.FC<DustFieldProps> = (props) => {
  const { frame, width, height, palette, intensity, settings, motion } = props;

  const paleColor = palette.dustPale;
  const brightColor = palette.dustBright ?? palette.dustPale;

  const sprites = useMemo(() => {
    const list: (HTMLCanvasElement | null)[] = [];
    for (let b = 0; b < BRACKETS; b++) {
      list.push(buildSprite(b, paleColor));
      list.push(buildSprite(b, brightColor));
    }
    return list;
  }, [paleColor, brightColor]);

  // The full table is always generated from the same seeds; intensity takes a
  // prefix of it, so a mote keeps its identity as intensity changes.
  const motes = useMemo(
    () => buildMotes(settings.count, width, height, motion.dustWander),
    [settings.count, width, height, motion.dustWander],
  );

  useLayoutEffect(() => {
    const ctx = layerContext(props);
    if (!ctx) return;

    const visible = Math.round(settings.count * intensity);
    if (visible <= 0) return;
    const alphaScale = 0.45 + 0.55 * intensity;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < visible && i < motes.length; i++) {
      const m = motes[i];
      const sprite = sprites[m.bracket * 2 + (m.bright ? 1 : 0)];
      if (!sprite) continue;
      const t = frame * LOOP_OMEGA;
      const x =
        m.x0 + m.ax1 * Math.sin(m.kx1 * t + m.px1) + m.ax2 * Math.sin(m.kx2 * t + m.px2);
      const y =
        m.y0 + m.ay1 * Math.sin(m.ky1 * t + m.py1) + m.ay2 * Math.sin(m.ky2 * t + m.py2);
      const half = sprite.width / 2;
      ctx.globalAlpha = m.opacity * alphaScale;
      ctx.drawImage(sprite, x - half, y - half);
    }
    ctx.restore();
  });

  return null;
};
