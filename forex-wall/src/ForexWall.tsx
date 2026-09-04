import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  BLOCK_H,
  BLOCK_PITCH,
  BLOCK_W,
  COL_MAX,
  COL_MIN,
  DOF_SLICES,
  DURATION_IN_FRAMES,
  MIN_SCALE,
  ORIGIN_X,
  ORIGIN_Y,
  PERSPECTIVE,
  REF_WIDTH,
  ROT_X_DEG,
  ROT_Y_DEG,
  ROW_MAX,
  ROW_MIN,
  ROW_PITCH,
  RULE_H,
  RULE_OFFSET,
  RULE_X0,
  RULE_X1,
  SCROLL_BLOCKS_PER_LOOP,
  SCROLL_ROWS_PER_LOOP,
  sliceForScale,
} from "./constants";
import { FONT_FAMILY } from "./load-fonts";
import { Grain, HorizonHaze, ScreenGlow, Vignette } from "./overlays";
import { isOnScreen, scaleAt } from "./projection";
import { QuoteBlock } from "./QuoteBlock";
import { pairIndexFor, quoteAt } from "./quote";
import type { Theme } from "./theme";

/** Depth at which quotes reach full brightness. */
const FULL_BRIGHT_SCALE = 0.85;
const FADE_START_SCALE = 0.17;

const depthBrightness = (s: number, floor: number): number => {
  const t = Math.min(
    1,
    Math.max(0, (s - FADE_START_SCALE) / (FULL_BRIGHT_SCALE - FADE_START_SCALE)),
  );
  return floor + (1 - floor) * t;
};

type Cell = { key: string; x: number; y: number; s: number; row: number; col: number };

/**
 * One depth slice: its own perspective container and its own rotated plane,
 * holding only the blocks at that depth. The blur lives here, on a plain
 * screen-space layer, so the type inside is never rasterised and magnified.
 */
const Slice: React.FC<{
  cells: Cell[];
  blur: number;
  theme: Theme;
  frame: number;
  u: number;
}> = ({ cells, blur, theme, frame, u }) => {
  if (cells.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        perspective: PERSPECTIVE * u,
        perspectiveOrigin: `${ORIGIN_X * 100}% ${ORIGIN_Y * 100}%`,
        filter: blur > 0 ? `blur(${(blur * u).toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transformOrigin: `${ORIGIN_X * 100}% ${ORIGIN_Y * 100}%`,
          transform: `rotateX(${ROT_X_DEG}deg) rotateY(${ROT_Y_DEG}deg)`,
        }}
      >
        {cells.map((c) => (
          <div
            key={c.key}
            style={{
              position: "absolute",
              left: `${ORIGIN_X * 100}%`,
              top: `${ORIGIN_Y * 100}%`,
              transform: `translate3d(${c.x * u}px, ${c.y * u}px, 0)`,
            }}
          >
            <QuoteBlock
              quote={quoteAt(
                pairIndexFor(
                  c.row,
                  c.col,
                  SCROLL_BLOCKS_PER_LOOP,
                  SCROLL_ROWS_PER_LOOP,
                ),
                frame,
              )}
              theme={theme}
              depth={depthBrightness(c.s, theme.depthFloor)}
              u={u}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export const ForexWall: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  // Reference px -> composition px. Font sizes, translations, perspective
  // and blur radii all go through it, so the 1080p preview and the 4K
  // master are the same picture at two resolutions.
  const u = width / REF_WIDTH;

  const t = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
  const dx = -t * SCROLL_BLOCKS_PER_LOOP * BLOCK_PITCH;
  const dy = -t * SCROLL_ROWS_PER_LOOP * ROW_PITCH;

  const { rules, slices } = useMemo(() => {
    const rulesOut: { key: string; x: number; y: number }[] = [];
    const slicesOut: Cell[][] = DOF_SLICES.map(() => []);

    for (let row = ROW_MIN; row <= ROW_MAX; row++) {
      const y = row * ROW_PITCH + dy;

      const ruleY = y - RULE_OFFSET;
      if (isOnScreen(RULE_X0, ruleY, RULE_X1 - RULE_X0, RULE_H, 8)) {
        rulesOut.push({ key: `r${row}`, x: RULE_X0, y: ruleY });
      }

      for (let col = COL_MIN; col <= COL_MAX; col++) {
        const x = col * BLOCK_PITCH + dx;
        const s = scaleAt(x + BLOCK_W / 2, y + BLOCK_H / 2);
        if (!Number.isFinite(s) || s < MIN_SCALE) continue;
        if (!isOnScreen(x, y, BLOCK_W, BLOCK_H, 60)) continue;
        slicesOut[sliceForScale(s)].push({
          key: `b${row}_${col}`,
          x,
          y,
          s,
          row,
          col,
        });
      }
    }

    return { rules: rulesOut, slices: slicesOut };
  }, [dx, dy]);

  return (
    <AbsoluteFill
      style={{
        background: theme.background,
        overflow: "hidden",
        fontFamily: FONT_FAMILY,
        fontWeight: 400,
      }}
    >
      {/* Rules stay sharp all the way to the horizon, as they do on a real
          board: they are hairlines, and softening them only muddies the
          structure the receding rows are read against. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: PERSPECTIVE * u,
          perspectiveOrigin: `${ORIGIN_X * 100}% ${ORIGIN_Y * 100}%`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transformOrigin: `${ORIGIN_X * 100}% ${ORIGIN_Y * 100}%`,
            transform: `rotateX(${ROT_X_DEG}deg) rotateY(${ROT_Y_DEG}deg)`,
          }}
        >
          {rules.map((r) => (
            <div
              key={r.key}
              style={{
                position: "absolute",
                left: `${ORIGIN_X * 100}%`,
                top: `${ORIGIN_Y * 100}%`,
                width: (RULE_X1 - RULE_X0) * u,
                height: RULE_H * u,
                background: theme.rule,
                transform: `translate3d(${r.x * u}px, ${r.y * u}px, 0)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Deepest slice first, so nearer, sharper quotes paint over the haze. */}
      {slices.map((cells, i) => (
        <Slice
          key={i}
          cells={cells}
          blur={DOF_SLICES[i].blur}
          theme={theme}
          frame={frame}
          u={u}
        />
      ))}

      <HorizonHaze theme={theme} />
      {theme.glow > 0 ? <ScreenGlow strength={theme.glow} /> : null}
      {theme.grain > 0 ? (
        <Grain opacity={theme.grain} frame={frame} u={u} />
      ) : null}
      {theme.vignette ? <Vignette /> : null}
    </AbsoluteFill>
  );
};
