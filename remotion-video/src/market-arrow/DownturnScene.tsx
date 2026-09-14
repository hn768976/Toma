import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { MONO_FONT_FAMILY_NAME } from "../load-fonts";
import {
  DOWNTURN,
  DOWNTURN_BOTTOM_RAMP,
  DOWNTURN_SCROLL_DISTANCE,
  DOWNTURN_TOP_RAMP,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from "./constants";
import { DownturnRuler } from "./DownturnRuler";
import { Grid } from "./Grid";
import { MarketArrow } from "./MarketArrow";
import { sampleRamp, sampleRampAlpha } from "./palette";
import { DepthOfField, Stage, Vignette } from "./Stage";

export const downturnSchema = z.object({
  resolutionScale: z.number().min(0.25).max(4),
});

export const downturnDefaults: z.infer<typeof downturnSchema> = {
  resolutionScale: 1,
};

// V1 — "Downturn". A plunging arrow beside a scrolling loss ticker on a
// tilted grid, cooling cyan through pink into molten red as the number
// falls past -78,000 over 10 seconds.
export const DownturnScene: React.FC<z.infer<typeof downturnSchema>> = ({
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);

  // Ruler travel. Mostly linear — the reference loses a near-constant
  // ~8,000 per second — with a slight lean into the fall at the end.
  const scroll =
    DOWNTURN_SCROLL_DISTANCE * (0.86 * p + 0.14 * Math.pow(p, 2.2));

  // Camera. The grid is a tilted 3D backdrop that de-rotates and settles;
  // the ruler and arrow are a screen-aligned overlay that eases out of a
  // slight push-in, so they never look glued to the plane.
  const gridRotateX = interpolate(p, [0, 1], [7, 1.6]);
  const gridRotateZ = interpolate(p, [0, 1], [-3.2, -0.4]);
  const gridScale = interpolate(p, [0, 1], [1.1, 1.0]);
  const sway = Math.sin(p * Math.PI * 1.35) * 7;

  const overlayScale = interpolate(p, [0, 1], [1.07, 1.0]);
  const overlayX = sway - interpolate(p, [0, 1], [0, 14]);
  const overlayY = interpolate(p, [0, 1], [-10, 8]);

  // Colour ramps: the arrow's tail and tip heat up on slightly different
  // clocks, which is what makes the gradient sweep down the shaft.
  const tailColor = sampleRamp(DOWNTURN_TOP_RAMP, -0.05 + 0.95 * p);
  const tipColor = sampleRamp(DOWNTURN_BOTTOM_RAMP, 0.02 + 1.15 * p);
  const glowColor = sampleRampAlpha(DOWNTURN_BOTTOM_RAMP, 0.1 + 1.1 * p, 0.85);

  // The arrow drifts lower and bobs as the fall deepens.
  const tipY =
    interpolate(p, [0, 1], [690, 792]) + Math.sin(p * Math.PI * 2.4) * 16;

  const focusMask = `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) ${interpolate(
    p,
    [0, 1],
    [16, 11],
  )}%, rgba(0,0,0,1) ${interpolate(p, [0, 1], [74, 84])}%, rgba(0,0,0,0) 100%)`;

  const scene = (
    <>
      <Grid
        cell={64}
        boldEvery={5}
        fineColor={DOWNTURN.gridFine}
        boldColor={DOWNTURN.gridBold}
        lineWidth={2}
        offsetX={-scroll * 0.05}
        offsetY={scroll * 0.34}
        perspective={4200}
        rotateX={gridRotateX}
        rotateZ={gridRotateZ}
        scale={gridScale}
      />

      {/* Faint vertical light streaks drifting on the right, as in the
          reference plate. */}
      <AbsoluteFill style={{ opacity: 0.5 }}>
        {[0.62, 0.71, 0.78, 0.9].map((at, i) => (
          <div
            key={at}
            style={{
              position: "absolute",
              left: STAGE_WIDTH * at + Math.sin(p * Math.PI * 1.1 + i) * 18,
              top: -120,
              width: 2 + i,
              height: STAGE_HEIGHT + 240,
              background: `linear-gradient(to bottom, transparent, ${sampleRampAlpha(
                DOWNTURN_TOP_RAMP,
                0.1 + p,
                0.16 + 0.1 * i,
              )}, transparent)`,
            }}
          />
        ))}
      </AbsoluteFill>

      {/* Heat bloom behind the arrow. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 34% 46% at ${
            (DOWNTURN.arrowX / STAGE_WIDTH) * 100
          }% 58%, ${sampleRampAlpha(
            DOWNTURN_BOTTOM_RAMP,
            0.2 + 1.1 * p,
            0.05 + 0.19 * p,
          )}, transparent 70%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${overlayX}px, ${overlayY}px) scale(${overlayScale})`,
          transformOrigin: "32% 50%",
        }}
      >
        <DownturnRuler
          scroll={scroll}
          intensity={p}
          ramp={DOWNTURN_BOTTOM_RAMP}
          fontFamily={MONO_FONT_FAMILY_NAME}
        />
        <MarketArrow
            direction="down"
          x={DOWNTURN.arrowX}
          tipY={tipY}
          tailY={-260}
          shaftWidth={150}
          headWidth={218}
          headHeight={157}
          tailColor={tailColor}
          tipColor={tipColor}
          glowColor={glowColor}
          glowBlur={interpolate(p, [0, 1], [14, 40])}
          glowOpacity={interpolate(p, [0, 1], [0.35, 0.8])}
        />
      </div>
    </>
  );

  return (
    <Stage scale={resolutionScale} background={DOWNTURN.background}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 78% at 44% 46%, ${DOWNTURN.backgroundGlow} 0%, ${DOWNTURN.background} 72%)`,
        }}
      />
      <DepthOfField blurPx={13} focusMask={focusMask}>
        {scene}
      </DepthOfField>
      <Vignette color="rgba(3, 6, 12, 0.92)" strength={0.85} />
    </Stage>
  );
};
