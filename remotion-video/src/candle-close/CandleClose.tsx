import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  AMBIENT_DRIFT_X,
  AMBIENT_DRIFT_Y,
  BASE_HEIGHT,
  BASE_WIDTH,
  BODY_WIDTH,
  CANDLE_PITCH,
  DOF_FALLOFF,
  DOF_FOCAL_HALF_WIDTH,
  DOF_MAX_BLUR,
  DURATION_IN_FRAMES,
  FORM_ANCHOR_PX,
  GLOW_TIGHT_BLUR,
  GLOW_WIDE_BLUR,
  GRID_COLUMN_PITCH,
  GRID_LINE_WIDTH,
  GRID_ROW_PITCH,
  MONO_FONT_STACK,
  SERIES_WIDTH,
  SHADOW_BLUR,
  SHADOW_OFFSET_Y,
  VISIBLE_CANDLES,
  WICK_WIDTH,
} from "./constants";
import { mix, rgba } from "./color";
import { generateSeries } from "./series";
import { generateLabels, labelStateAt } from "./labels";
import { VARIANTS, VARIANT_NAMES } from "./variants";

export const candleCloseSchema = z.object({
  variant: z.enum(VARIANT_NAMES),
});

export type CandleCloseProps = z.infer<typeof candleCloseSchema>;

// The first registered variant, so a single-variant build of this
// component still has a valid default.
export const candleCloseDefaults: CandleCloseProps = {
  variant: VARIANT_NAMES[0],
};

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// One set of hairlines: `thickness` px of `color` every `pitch` px.
const hairlines = (
  direction: "to right" | "to bottom",
  color: string,
  alpha: number,
  thickness: number,
  pitch: number,
) => {
  const line = rgba(color, alpha);
  const gap = rgba(color, 0);
  return `repeating-linear-gradient(${direction}, ${line} 0px, ${line} ${thickness}px, ${gap} ${thickness}px, ${gap} ${pitch}px)`;
};

// Everything needed to draw one candle, resolved for the current frame.
type CandleView = {
  key: number;
  x: number;
  topY: number;
  bottomY: number;
  bodyTopY: number;
  bodyHeight: number;
  isUp: boolean;
  dof: number; // 0 = in the focal band, 1 = fully defocused
};

const CandleColumn: React.FC<{
  view: CandleView;
  color: string;
  blurPx: number;
  opacity: number;
}> = ({ view, color, blurPx, opacity }) => (
  <div
    style={{
      position: "absolute",
      left: view.x - BODY_WIDTH / 2,
      top: view.topY,
      width: BODY_WIDTH,
      height: Math.max(1, view.bottomY - view.topY),
      opacity,
      filter: blurPx > 0.3 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: (BODY_WIDTH - WICK_WIDTH) / 2,
        top: 0,
        width: WICK_WIDTH,
        height: "100%",
        backgroundColor: color,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 0,
        top: view.bodyTopY - view.topY,
        width: BODY_WIDTH,
        height: view.bodyHeight,
        backgroundColor: color,
      }}
    />
  </div>
);

// A tight, frontal candlestick close-up: ~30 large candles scrolling right
// to left over a textured backdrop of faint grid and drifting price quotes.
// No ladder, no volume, no tilt — candles and background only.
export const CandleClose: React.FC<CandleCloseProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const {
    palette,
    series: seriesParams,
    labels: labelConfig,
    treatment,
  } = VARIANTS[variant];

  // The scene is authored at 4K and scaled to whatever size the composition
  // is registered at, so every number below is in 4K pixels.
  const scale = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);

  const series = useMemo(
    () => generateSeries(seriesParams, VISIBLE_CANDLES),
    [seriesParams],
  );
  const floatingLabels = useMemo(
    () =>
      generateLabels(
        labelConfig,
        seriesParams.seed + 4211,
        BASE_WIDTH,
        BASE_HEIGHT,
      ),
    [labelConfig, seriesParams.seed],
  );

  const loopT = frame / DURATION_IN_FRAMES;
  const scrollPx = loopT * SERIES_WIDTH;

  // The price scale is fixed for the whole loop — no autoscaling — and the
  // reference price walks with the tile drift, so a trending series keeps
  // trending while the loop still closes exactly.
  const pxPerPrice =
    (BASE_HEIGHT * treatment.plotFill) / (series.high - series.low);
  const referencePrice = series.mid + series.driftPerTile * loopT;
  const priceToY = (price: number) =>
    BASE_HEIGHT / 2 - (price - referencePrice) * pxPerPrice;

  const views = useMemo(() => {
    const result: CandleView[] = [];
    const first = Math.floor(scrollPx / CANDLE_PITCH) - 1;
    const last = Math.ceil((scrollPx + BASE_WIDTH) / CANDLE_PITCH) + 1;
    // A candle starts forming as it appears at the right edge and locks once
    // it has travelled FORM_ANCHOR_PX inward.
    const formStartX = BASE_WIDTH + CANDLE_PITCH * 0.5;

    for (let j = first; j <= last; j++) {
      const index = ((j % series.count) + series.count) % series.count;
      const candle = series.candles[index];
      const tileOffset = series.driftPerTile * Math.floor(j / series.count);
      const x = j * CANDLE_PITCH + CANDLE_PITCH / 2 - scrollPx;

      // The rightmost candle's close drifts: the body grows, shrinks and can
      // flip colour, then settles as the scroll locks it in.
      const formT = clamp01((formStartX - x) / FORM_ANCHOR_PX);
      const decay = (1 - formT) * (1 - formT);
      const wobble =
        candle.wobbleAmplitude *
        decay *
        (Math.sin(formT * Math.PI * 5 + candle.wobblePhase) * 0.7 +
          Math.sin(formT * Math.PI * 2.2 + candle.wobblePhase * 1.7) * 0.55);

      const close = candle.close + wobble;
      const high = Math.max(candle.high, close);
      const low = Math.min(candle.low, close);

      const openY = priceToY(candle.open + tileOffset);
      const closeY = priceToY(close + tileOffset);
      const bodyTopY = Math.min(openY, closeY);
      const bodyHeight = Math.max(6, Math.abs(closeY - openY));

      const distance = Math.abs(x - BASE_WIDTH / 2) / BASE_WIDTH;
      const dofT = clamp01((distance - DOF_FOCAL_HALF_WIDTH) / DOF_FALLOFF);

      result.push({
        key: j,
        x,
        topY: Math.min(priceToY(high + tileOffset), bodyTopY),
        bottomY: Math.max(priceToY(low + tileOffset), bodyTopY + bodyHeight),
        bodyTopY,
        bodyHeight,
        isUp: close >= candle.open,
        dof: dofT * dofT,
      });
    }
    return result;
    // priceToY is derived from frame-dependent values already in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollPx, series, referencePrice, pxPerPrice]);

  const ambientX = AMBIENT_DRIFT_X * Math.sin(TAU * loopT);
  const ambientY = AMBIENT_DRIFT_Y * Math.cos(TAU * loopT);

  const sharpCandles = views.map((view) => {
    const base = view.isUp ? palette.candleUp : palette.candleDown;
    return (
      <CandleColumn
        key={view.key}
        view={view}
        // Defocused candles are lifted toward the ground before blurring, so
        // they soften toward the background rather than muddying against it.
        color={mix(base, palette.backgroundDeep, treatment.dofLift * view.dof)}
        blurPx={DOF_MAX_BLUR * view.dof}
        opacity={1 - 0.14 * view.dof}
      />
    );
  });

  const glowCandles = (blurPx: number, opacity: number) => (
    <AbsoluteFill
      style={{
        filter: `blur(${blurPx}px)`,
        mixBlendMode: "screen",
        opacity,
      }}
    >
      {views.map((view) => (
        <CandleColumn
          key={view.key}
          view={view}
          color={view.isUp ? palette.candleUp : palette.candleDown}
          blurPx={0}
          opacity={1}
        />
      ))}
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill
      style={{ backgroundColor: palette.backgroundDeep, overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          overflow: "hidden",
          backgroundColor: palette.backgroundDeep,
        }}
      >
        {/* A broad soft radial wash behind the candles. */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 72% 64% at 50% 50%, ${rgba(
              palette.backgroundWash,
              treatment.backgroundWashOpacity,
            )} 0%, ${rgba(palette.backgroundWash, 0)} 74%)`,
          }}
        />

        <AbsoluteFill
          style={{ transform: `translate(${ambientX}px, ${ambientY}px)` }}
        >
          {/* Textured backdrop: a faint grid. Its columns scroll with the
              chart at a pitch that divides the loop's scroll distance, so the
              grid loops with everything else; the rows stay put, since they
              stand for the space rather than for price. */}
          <AbsoluteFill style={{ opacity: treatment.gridOpacity }}>
            <AbsoluteFill
              style={{
                backgroundImage: hairlines(
                  "to bottom",
                  palette.gridLine,
                  0.5,
                  GRID_LINE_WIDTH,
                  GRID_ROW_PITCH,
                ),
              }}
            />
            <AbsoluteFill
              style={{
                left: -(scrollPx % GRID_COLUMN_PITCH),
                width: BASE_WIDTH + GRID_COLUMN_PITCH,
                backgroundImage: hairlines(
                  "to right",
                  palette.gridLine,
                  0.6,
                  GRID_LINE_WIDTH,
                  GRID_COLUMN_PITCH,
                ),
              }}
            />
            <AbsoluteFill
              style={{
                left: -(scrollPx % (GRID_COLUMN_PITCH / 4)),
                width: BASE_WIDTH + GRID_COLUMN_PITCH,
                backgroundImage: hairlines(
                  "to right",
                  palette.gridLine,
                  0.24,
                  1,
                  GRID_COLUMN_PITCH / 4,
                ),
              }}
            />
          </AbsoluteFill>

          {/* Dim price quotes drifting behind the candles. */}
          <AbsoluteFill>
            {floatingLabels.map((label, i) => {
              const { value, fade } = labelStateAt(label, frame);
              const angle =
                TAU * (frame / label.driftPeriod) + label.driftPhase;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: label.x + label.driftRx * Math.cos(angle),
                    top: label.y + label.driftRy * Math.sin(angle),
                    fontFamily: MONO_FONT_STACK,
                    fontSize: label.size,
                    // Pinned so the labels sit identically whatever ambient
                    // stylesheet the host project happens to load.
                    lineHeight: 1,
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                    color: label.bright
                      ? palette.labelBright
                      : palette.labelPale,
                    opacity: label.opacity * fade,
                  }}
                >
                  {value}
                </div>
              );
            })}
          </AbsoluteFill>

          {/* Each candle carries a soft glow in its own colour — the one place
              this family is more emissive than a flat graphic. */}
          {treatment.glow ? glowCandles(GLOW_WIDE_BLUR, 0.38) : null}
          {treatment.glow ? glowCandles(GLOW_TIGHT_BLUR, 0.55) : null}

          {/* On the light ground, a subtle soft shadow beneath each candle
              stands in for the glow. */}
          {treatment.shadow ? (
            <AbsoluteFill
              style={{
                filter: `blur(${SHADOW_BLUR}px)`,
                transform: `translateY(${SHADOW_OFFSET_Y}px)`,
                opacity: 0.26,
              }}
            >
              {views.map((view) => (
                <CandleColumn
                  key={view.key}
                  view={view}
                  color="#7E8B9B"
                  blurPx={0}
                  opacity={1}
                />
              ))}
            </AbsoluteFill>
          ) : null}

          <AbsoluteFill>{sharpCandles}</AbsoluteFill>
        </AbsoluteFill>

        {/* Vignette. Inverted on the light variant: the corners lighten. */}
        <AbsoluteFill
          style={{
            background: treatment.vignetteLighten
              ? `radial-gradient(ellipse at center, rgba(255, 255, 255, 0) 45%, rgba(255, 255, 255, ${treatment.vignetteStrength}) 100%)`
              : `radial-gradient(ellipse at center, ${rgba(
                  palette.backgroundDeep,
                  0,
                )} 42%, ${rgba(palette.backgroundDeep, treatment.vignetteStrength)} 100%)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
