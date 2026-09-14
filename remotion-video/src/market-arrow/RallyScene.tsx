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
  FPS,
  RALLY,
  RALLY_ARROW_RAMP,
  RALLY_LINE_RAMP,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from "./constants";
import { Grid } from "./Grid";
import { MarketArrow } from "./MarketArrow";
import { RallyLadder } from "./RallyLadder";
import { sampleRamp, sampleRampAlpha } from "./palette";
import { DepthOfField, Stage, Vignette } from "./Stage";
import { TrendLine } from "./TrendLine";
import { WorldMap } from "./WorldMap";

export const rallySchema = z.object({
  resolutionScale: z.number().min(0.25).max(4),
});

export const rallyDefaults: z.infer<typeof rallySchema> = {
  resolutionScale: 1,
};

// Camera keyframes, in seconds. The move is a continuous pull-back and
// pan-up: the ladder compresses from ~300px per rung down to 185px while
// the frame climbs from rung 1.8 to rung 9.3, so the chart keeps
// outrunning the scale it is drawn against.
const CAMERA_TIMES = [0, 1.5, 3, 6, 9, 12];
const CAMERA_RUNG = [1.8, 2.5, 4.02, 7.99, 8.73, 9.3];
const CAMERA_ZOOM = [1.62, 1.48, 1.29, 1.17, 1.02, 1.0];
const CAMERA_X = [222, 223, 294, 516, 618, 590];

// How much of the tick chart is plotted, and how high the hero arrow has
// climbed, at each of those same times.
const TREND_HEAD = [0.02, 0.233, 0.41, 0.612, 0.8, 1.0];
const ARROW_RUNG = [-0.8, 2.58, 3.93, 6.16, 8.73, 11.2];

// The backdrop map drifts at half camera speed, so it reads as distance.
const MAP_PARALLAX = 0.5;
// Equirectangular, so 2:1. Sized and placed so the pull-back lands on
// the Americas-to-Africa framing the reference settles into.
const MAP_WORLD_WIDTH = 3000;
const MAP_WORLD_HEIGHT = 1500;
const MAP_WORLD_LEFT = 562 - MAP_WORLD_WIDTH / 2;
const MAP_WORLD_TOP = -701 - MAP_WORLD_HEIGHT / 2;

// V2 — "Rally". A climbing arrow and a glowing tick chart on a quasi-log
// ladder, over a world map, with the camera pulling back as the numbers
// run from 10 to 5.000 across 12 seconds.
export const RallyScene: React.FC<z.infer<typeof rallySchema>> = ({
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const seconds = frame / FPS;
  const p = durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);

  const key = (values: number[]) =>
    interpolate(seconds, CAMERA_TIMES, values, {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const zoom = key(CAMERA_ZOOM);
  const camX = key(CAMERA_X);
  const camY = -key(CAMERA_RUNG) * RALLY.ladderGap;

  const toScreenX = (worldX: number) =>
    STAGE_WIDTH / 2 + (worldX - camX) * zoom;
  const toScreenY = (worldY: number) =>
    STAGE_HEIGHT / 2 + (worldY - camY) * zoom;
  const toScreenIndexY = (index: number) => toScreenY(-index * RALLY.ladderGap);

  // Hero arrow. Its tail is parked well below the frame so the shaft
  // always runs off the bottom edge no matter how far the camera pans.
  const arrowTipY = toScreenIndexY(key(ARROW_RUNG));
  const arrowX = toScreenX(RALLY.arrowWorldX);

  const arrowTail = sampleRamp(RALLY_ARROW_RAMP, 0.02 + 0.55 * p);
  const arrowTip = sampleRamp(RALLY_ARROW_RAMP, 0.18 + 0.92 * p);
  const lineColor = sampleRamp(RALLY_LINE_RAMP, 0.1 + 0.95 * p);

  // The map fades up once the camera has pulled back far enough for it
  // to read as a globe rather than a smear.
  const mapOpacity = interpolate(seconds, [2.2, 5.2], [0, 0.45], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const focusMask = `radial-gradient(ellipse ${interpolate(
    p,
    [0, 1],
    [80, 96],
  )}% 78% at 56% 46%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 52%, rgba(0,0,0,0) 100%)`;

  const scene = (
    <>
      <WorldMap
        width={MAP_WORLD_WIDTH * zoom}
        height={MAP_WORLD_HEIGHT * zoom}
        left={STAGE_WIDTH / 2 + (MAP_WORLD_LEFT - camX * MAP_PARALLAX) * zoom}
        top={STAGE_HEIGHT / 2 + (MAP_WORLD_TOP - camY * MAP_PARALLAX) * zoom}
        color={RALLY.landmass}
        opacity={mapOpacity}
        blurPx={6}
      />

      <Grid
        cell={95 * zoom}
        boldEvery={5}
        fineColor={RALLY.gridFine}
        boldColor={RALLY.gridBold}
        lineWidth={Math.max(1, 2 * zoom)}
        offsetX={STAGE_WIDTH / 2 - camX * zoom}
        offsetY={STAGE_HEIGHT / 2 - camY * zoom}
      />

      <RallyLadder
        toScreenX={toScreenX}
        toScreenY={toScreenY}
        zoom={zoom}
        fontFamily={MONO_FONT_FAMILY_NAME}
        labelColor={sampleRamp([RALLY.label, RALLY.label, RALLY.labelHot], p)}
      />

      <TrendLine
        head={key(TREND_HEAD)}
        toScreenX={toScreenX}
        toScreenIndexY={toScreenIndexY}
        strokeWidth={Math.max(3, 15 * zoom)}
        color={lineColor}
        glowColor={sampleRampAlpha(RALLY_LINE_RAMP, 0.2 + 0.9 * p, 0.55)}
        glowBlur={Math.max(4, 16 * zoom)}
      />

      <MarketArrow
        idPrefix="rally-arrow"
        direction="up"
        x={arrowX}
        tipY={arrowTipY}
        tailY={STAGE_HEIGHT + 600}
        shaftWidth={102 * zoom}
        headWidth={200 * zoom}
        headHeight={135 * zoom}
        tailColor={arrowTail}
        tipColor={arrowTip}
        glowColor={sampleRampAlpha(RALLY_ARROW_RAMP, 0.3 + 0.9 * p, 0.7)}
        glowBlur={Math.max(6, 24 * zoom)}
        glowOpacity={interpolate(p, [0, 1], [0.32, 0.7])}
      />
    </>
  );

  return (
    <Stage scale={resolutionScale} background={RALLY.background}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 74% 66% at 34% 44%, ${RALLY.backgroundGlow} 0%, ${RALLY.background} 78%)`,
        }}
      />
      <DepthOfField blurPx={11} focusMask={focusMask}>
        {scene}
      </DepthOfField>
      <Vignette color="rgba(2, 8, 18, 0.94)" strength={0.8} />
    </Stage>
  );
};
