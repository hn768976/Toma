import { Graphics } from "pixi.js";
import { interpolate } from "remotion";
import { PixiStage, type SceneFactory } from "../PixiStage";
import { STREAK_DARK, STREAK_LIGHT, hexToNumber } from "../constants";
import { createRng, range, rangeInt } from "../rng";

/**
 * Version 2 - "Streaks".
 *
 * Horizontal bars of wildly different weights fly across the frame, from
 * hairlines to full blocks. The piece cuts twice between a dark and a light
 * treatment; each cut is hidden behind a white flash, the same trick the
 * reference uses.
 */

type Bar = {
  y: number; // 0..1 down the frame
  thickness: number; // fraction of frame height
  length: number; // fraction of frame width
  speed: number; // frame widths per second
  direction: 1 | -1;
  offset: number; // starting position along the travel axis
  colourIndex: number;
  /** Bars below their density threshold are hidden, which drives the build-ups. */
  threshold: number;
};

const BAR_COUNT = 150;

const buildBars = (): Bar[] => {
  const rng = createRng(0x5eed1234);
  return Array.from({ length: BAR_COUNT }, () => {
    // A third of the bars are heavy blocks; the rest are thin streaks.
    const heavy = rng() < 0.32;
    return {
      y: rng(),
      thickness: heavy ? range(rng, 0.045, 0.16) : range(rng, 0.004, 0.022),
      length: heavy ? range(rng, 0.18, 0.55) : range(rng, 0.25, 0.95),
      speed: range(rng, 0.35, 1.9),
      direction: rng() < 0.5 ? -1 : 1,
      offset: rng(),
      colourIndex: rangeInt(rng, 0, 4),
      threshold: rng(),
    };
  });
};

/** White flashes that cover the two theme cuts and open the piece. */
const flashAt = (time: number) => {
  const flashes: [number, number][] = [
    [0.0, 0.3],
    [2.6, 2.82],
    [5.34, 5.56],
  ];
  let value = 0;
  for (const [start, end] of flashes) {
    const mid = (start + end) / 2;
    value = Math.max(
      value,
      interpolate(time, [start, mid, end], [0, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  }
  return value;
};

const createStreaksScene: SceneFactory = (app) => {
  const bars = buildBars();
  const background = new Graphics();
  const barLayer = new Graphics();
  const flash = new Graphics();
  app.stage.addChild(background, barLayer, flash);

  const darkBars = STREAK_DARK.bars.map(hexToNumber);
  const lightBars = STREAK_LIGHT.bars.map(hexToNumber);
  const darkBg = hexToNumber(STREAK_DARK.background);
  const lightBg = hexToNumber(STREAK_LIGHT.background);

  return ({ time, width, height }) => {
    // Theme flips inside the flashes, so the cut itself is never visible.
    const isLight = time >= 2.72 && time < 5.45;
    const palette = isLight ? lightBars : darkBars;

    background.clear();
    background.rect(0, 0, width, height).fill({ color: isLight ? lightBg : darkBg });

    // Density curve: heavy build, empty middle, second build, hard finish.
    const density = interpolate(
      time,
      [0.3, 1.1, 2.4, 2.72, 3.4, 4.6, 5.3, 5.56, 6.0],
      [0.15, 1.0, 1.0, 0.0, 0.08, 0.55, 1.0, 0.7, 1.0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    barLayer.clear();
    for (const bar of bars) {
      if (bar.threshold > density) continue;

      const travel = 1 + bar.length;
      // Wrap into [0, travel) so bars re-enter the frame continuously.
      const raw = bar.offset * travel + bar.direction * bar.speed * time;
      const wrapped = ((raw % travel) + travel) % travel;
      const x = (wrapped - bar.length) * width;

      const h = Math.max(1, bar.thickness * height);
      barLayer
        .rect(x, bar.y * height, bar.length * width, h)
        .fill({ color: palette[bar.colourIndex] });
    }

    const flashAlpha = flashAt(time);
    flash.clear();
    if (flashAlpha > 0.001) {
      flash
        .rect(0, 0, width, height)
        .fill({ color: 0xffffff, alpha: flashAlpha });
    }
  };
};

export const SpeedStreaks: React.FC = () => (
  <PixiStage createScene={createStreaksScene} backgroundColor={STREAK_DARK.background} />
);
