import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CosmicBackground } from "./CosmicBackground";
import { Grain } from "./Grain";
import { Sunburst } from "./Sunburst";
import { WheelLinework, type LabelMode } from "./WheelLinework";
import { DURATION_IN_FRAMES, WHEEL, type Palette } from "./config";
import { UNIT } from "./wheel-geometry";

export type ZodiacSceneProps = {
  palette: Palette;
  variantKey: string;
  seed: number;
  starCount: number;
  labelMode: LabelMode;
  /**
   * Wheel revolutions over the loop. 1 is the reference's measured rate and
   * closes the loop exactly, glyph identities included.
   */
  turns: number;
  /** Sunburst revolutions over the loop; counter to the wheel. */
  burstTurns: number;
  grain: number;
};

export const ZodiacScene: React.FC<ZodiacSceneProps> = ({
  palette,
  variantKey,
  seed,
  starCount,
  labelMode,
  turns,
  burstTurns,
  grain,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const loop = frame / DURATION_IN_FRAMES; // 0..1, exactly periodic
  const rotationDeg = loop * 360 * turns;
  const burstDeg = -loop * 360 * burstTurns;
  // Ring glow breathes on a whole number of cycles so it lands where it began.
  const breath = 0.5 + 0.5 * Math.sin(loop * Math.PI * 2 * 3);

  const R = WHEEL.radiusOfHeight * height;
  const cx = WHEEL.centerX * width;
  const cy = WHEEL.centerY * height;
  const s = R / UNIT;

  const discBase = `translate(${cx} ${cy}) scale(1 ${WHEEL.squash})`;
  const wheelTransform = `${discBase} rotate(${rotationDeg}) scale(${s})`;
  const burstTransform = `${discBase} rotate(${burstDeg}) scale(${s})`;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <CosmicBackground
        palette={palette}
        variantKey={variantKey}
        seed={seed}
        starCount={starCount}
        accentRamp={palette.accentRamp}
      />

      <AbsoluteFill>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            {/* Glow is deliberately tight: the line work is the product, and
                a wide blur would fog exactly the detail people are buying. */}
            <filter
              id={`${variantKey}-soft`}
              x="-6%"
              y="-6%"
              width="112%"
              height="112%"
            >
              <feGaussianBlur stdDeviation={7} />
            </filter>
            <radialGradient id={`${variantKey}-disc`}>
              <stop offset="0%" stopColor={palette.burstDeep} stopOpacity={0.05} />
              <stop offset="38%" stopColor={palette.burstDeep} stopOpacity={0.085} />
              <stop offset="76%" stopColor={palette.burstDeep} stopOpacity={0.045} />
              <stop offset="100%" stopColor={palette.burstDeep} stopOpacity={0} />
            </radialGradient>
            <filter
              id={`${variantKey}-bloom`}
              x="-70%"
              y="-70%"
              width="240%"
              height="240%"
            >
              <feGaussianBlur stdDeviation={26} />
            </filter>
          </defs>

          {/* Wheel: a blurred pass under the crisp pass. */}
          <g transform={wheelTransform}>
            {/* A breath of warmth inside the disc so the interior is not a
                dead black hole behind the line work. */}
            <circle
              cx={0}
              cy={0}
              r={WHEEL.rOuterCircle * UNIT}
              fill={`url(#${variantKey}-disc)`}
              style={{ mixBlendMode: "screen" }}
            />
            <g
              filter={`url(#${variantKey}-soft)`}
              opacity={0.34 + 0.16 * breath}
              style={{ mixBlendMode: "screen" }}
            >
              <WheelLinework
                palette={palette}
                rotationDeg={rotationDeg}
                labelMode={labelMode}
                idPrefix={`${variantKey}-glow`}
                variant="glow"
              />
            </g>
            <WheelLinework
              palette={palette}
              rotationDeg={rotationDeg}
              labelMode={labelMode}
              idPrefix={`${variantKey}-crisp`}
              variant="crisp"
            />
          </g>

          {/* Sunburst: the one element that gets real bloom. */}
          <g transform={burstTransform}>
            <g
              filter={`url(#${variantKey}-bloom)`}
              opacity={0.62 + 0.22 * breath}
              style={{ mixBlendMode: "screen" }}
            >
              <Sunburst
                palette={palette}
                radius={WHEEL.rBurst * UNIT}
                idPrefix={`${variantKey}-burst-glow`}
                breath={breath}
              />
            </g>
            <Sunburst
              palette={palette}
              radius={WHEEL.rBurst * UNIT}
              idPrefix={`${variantKey}-burst`}
              breath={breath}
            />
          </g>
        </svg>
      </AbsoluteFill>

      <Grain amount={grain} />
    </AbsoluteFill>
  );
};
