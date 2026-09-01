import React, { useLayoutEffect, useMemo, useRef } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  COLUMN_GLYPH_SIZE,
  COLUMN_TILE_HEIGHT,
  COLUMN_WIDTH,
  HEIGHT,
  TIMING,
  WIDTH,
} from "../layout";
import { accentDashOffset, columnDrift, squareFlicker } from "../motion";
import type { Palette } from "../variants";
import { createOffscreen, pick, randInt, randRange, withAlpha } from "../util";

/** Deliberately illegible - shape and rhythm, not readable content. */
const GLYPHS = "0123456789ABCDEF+-<>/\\|:.=*#";
const GLYPH_FONT = `${COLUMN_GLYPH_SIZE}px ui-monospace, "DejaVu Sans Mono", monospace`;

type Square = {
  x: number;
  y: number;
  size: number;
  period: number;
  offset: number;
};

type Props = { index: number; palette: Palette };

/**
 * One vertical column of drifting characters plus the brighter accent squares
 * scattered among them. The character run is baked into a tile once and
 * blitted repeatedly; the tile advances a whole number of tile-heights over
 * the 600 frame loop, so it closes seamlessly.
 */
export const DataColumn: React.FC<Props> = ({ index, palette }) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seed = `column-${index}`;

  const tilesPerLoop = useMemo(() => randInt(`${seed}-speed`, 1, 4), [seed]);
  const columnAlpha = useMemo(() => randRange(`${seed}-alpha`, 0.45, 1), [seed]);

  const tile = useMemo(() => {
    const buffer = createOffscreen(COLUMN_WIDTH, COLUMN_TILE_HEIGHT);
    const ctx = buffer?.getContext("2d");
    if (!buffer || !ctx) return buffer;

    ctx.font = GLYPH_FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const rowHeight = randRange(`${seed}-row`, 30, 42);
    const rows = Math.round(COLUMN_TILE_HEIGHT / rowHeight);
    // Snap the row pitch so the last row does not collide with the first
    // when the tile repeats.
    const pitch = COLUMN_TILE_HEIGHT / rows;
    const centerX = COLUMN_WIDTH / 2 + randRange(`${seed}-off`, -26, 26);

    for (let row = 0; row < rows; row++) {
      const rowSeed = `${seed}-r${row}`;
      if (randRange(rowSeed, 0, 1) < 0.16) continue;
      const y = (row + 0.5) * pitch;
      ctx.fillStyle = withAlpha(palette.columnDim, randRange(`${rowSeed}-a`, 0.35, 1));
      if (randRange(`${rowSeed}-kind`, 0, 1) < 0.22) {
        // A short dash instead of a glyph.
        const w = randRange(`${rowSeed}-w`, 18, 54);
        ctx.fillRect(centerX - w / 2, y - 2, w, 4);
      } else {
        const count = randInt(`${rowSeed}-n`, 1, 4);
        let text = "";
        for (let i = 0; i < count; i++) {
          text += pick(`${rowSeed}-g${i}`, [...GLYPHS]);
        }
        ctx.fillText(text, centerX, y);
      }
    }
    return buffer;
  }, [seed, palette.columnDim]);

  const squares = useMemo<Square[]>(() => {
    const count = randInt(`${seed}-sq-n`, 2, 6);
    return Array.from({ length: count }, (_, i) => {
      const s = `${seed}-sq${i}`;
      const period = pick(`${s}-p`, TIMING.squareFlickerPeriods);
      return {
        x: randRange(`${s}-x`, 18, COLUMN_WIDTH - 18),
        y: randRange(`${s}-y`, 0, COLUMN_TILE_HEIGHT),
        size: randRange(`${s}-s`, 12, 26),
        period,
        offset: randInt(`${s}-o`, 0, period),
      };
    });
  }, [seed]);

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !tile) return;

    ctx.clearRect(0, 0, COLUMN_WIDTH, HEIGHT);

    const fade = interpolate(frame, TIMING.backdropFadeIn, [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    if (fade <= 0) return;

    const drift = columnDrift(frame, tilesPerLoop);

    ctx.globalAlpha = columnAlpha * fade;
    for (let y = drift - COLUMN_TILE_HEIGHT; y < HEIGHT; y += COLUMN_TILE_HEIGHT) {
      ctx.drawImage(tile, 0, y);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = palette.columnBright;
    ctx.shadowColor = palette.columnBright;
    for (const square of squares) {
      const flicker = squareFlicker(frame, square.period, square.offset);
      ctx.globalAlpha = flicker * fade * 0.9;
      ctx.shadowBlur = 18 * flicker;
      const base = (square.y + drift) % COLUMN_TILE_HEIGHT;
      for (let y = base - COLUMN_TILE_HEIGHT; y < HEIGHT; y += COLUMN_TILE_HEIGHT) {
        ctx.fillRect(square.x - square.size / 2, y, square.size, square.size);
      }
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });

  return (
    <canvas
      ref={canvasRef}
      width={COLUMN_WIDTH}
      height={HEIGHT}
      style={{
        position: "absolute",
        left: `${((index * COLUMN_WIDTH) / WIDTH) * 100}%`,
        top: 0,
        width: `${(COLUMN_WIDTH / WIDTH) * 100}%`,
        height: "100%",
      }}
    />
  );
};

/**
 * Bands the accent rules are allowed to live in. The central group is left
 * clear on purpose - a dashed rule crossing the verdict icon reads as damage.
 */
const RULE_ZONES: readonly { x: [number, number]; y: [number, number] }[] = [
  { x: [140, 2600], y: [200, 540] },
  { x: [200, 2400], y: [1580, 1980] },
  { x: [120, 900], y: [640, 1460] },
  { x: [2700, 3500], y: [640, 1460] },
];

type RulesProps = { palette: Palette };

/**
 * The few short horizontal dashed rules in the secondary hue. Sparse on
 * purpose - the accent appears nowhere else in the piece.
 */
export const DataRules: React.FC<RulesProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rules = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const s = `rule-${i}`;
        const zone = pick(`${s}-zone`, RULE_ZONES);
        const length = randRange(`${s}-l`, 180, 560);
        return {
          x: randRange(`${s}-x`, zone.x[0], Math.max(zone.x[0], zone.x[1] - length)),
          y: randRange(`${s}-y`, zone.y[0], zone.y[1]),
          length,
          dash: randRange(`${s}-d`, 14, 34),
          gap: randRange(`${s}-g`, 12, 26),
          alpha: randRange(`${s}-a`, 0.2, 0.55),
          direction: randRange(`${s}-dir`, 0, 1) < 0.5 ? -1 : 1,
        };
      }),
    [],
  );

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const fade = interpolate(frame, [12, 60], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    if (fade <= 0) return;

    ctx.lineWidth = 5;
    ctx.lineCap = "butt";
    ctx.strokeStyle = palette.accent;
    for (const rule of rules) {
      const cycle = rule.dash + rule.gap;
      ctx.setLineDash([rule.dash, rule.gap]);
      ctx.lineDashOffset = accentDashOffset(frame, rule.direction, cycle);
      ctx.globalAlpha = rule.alpha * fade;
      ctx.beginPath();
      ctx.moveTo(rule.x, rule.y);
      ctx.lineTo(rule.x + rule.length, rule.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  });

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
    />
  );
};
