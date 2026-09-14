import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { Backdrop } from "./Backdrop";
import { Camera, QUARTER_PX, glide } from "./camera";
import {
  BarField,
  ChevronTrail,
  PerspectiveGrid,
  TimelineAxis,
} from "./Plane";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BACKGROUND_COLOR,
  TRAIL_RAMP,
  rgba,
  sampleRamp,
} from "./constants";

export const growthTimelineSchema = z.object({
  /** "chevron" reproduces the trail-only board, "bars" the mirrored chart. */
  variant: z.enum(["chevron", "bars"]),
  /**
   * 1 = 1080p (1920x1080), 2 = 4K (3840x2160). Must match the width/height
   * the Composition is registered with in Root.tsx. The scene is authored
   * at 1080p and scaled, so 4K is a true vector upscale.
   */
  resolutionScale: z.number().positive(),
});

export type GrowthTimelineProps = z.infer<typeof growthTimelineSchema>;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type Rig = {
  readonly cam: Camera;
  readonly head: number;
  readonly mapPan: number;
  readonly mapScale: number;
  readonly mapDrift: number;
  readonly dofBlur: number;
  readonly bandHalf: number;
};

/**
 * Version 1 flies backwards along the timeline: it starts tight on the
 * head of the trail and eases out as the trail lengthens, so the arrows
 * get denser and the frame gathers history.
 */
const chevronRig = (frame: number, duration: number): Rig => {
  const p = glide(frame, duration);
  const intro = easeOutCubic(interpolate(frame, [0, 62], [0, 1], {
    extrapolateRight: "clamp",
  }));
  const head = interpolate(p, [0, 1], [-1.2, 32.2]);
  const scale = interpolate(p, [0, 1], [1.24, 1.07]);
  const scroll = head * QUARTER_PX - 385 / scale;
  return {
    head,
    cam: {
      scroll,
      scale,
      rotateX: interpolate(p, [0, 1], [5.4, 3.2]),
      rotateY: interpolate(p, [0, 1], [15.5, 20]),
      rotateZ: interpolate(p, [0, 1], [-6.4, -9.6]),
      anchorY:
        interpolate(p, [0, 1], [668, 596]) +
        (1 - intro) * 330 +
        Math.sin(frame / 61) * 7,
      perspective: 1700,
    },
    mapPan: -scroll * 0.052,
    mapScale: interpolate(p, [0, 1], [1.08, 1.18]),
    mapDrift: interpolate(p, [0, 1], [26, -34]),
    dofBlur: 6,
    bandHalf: 0.32,
  };
};

/**
 * Version 2 does the opposite: a slow push in with the axis held higher
 * in frame, so the amber columns below the line get the space the green
 * ones have above it.
 */
const barRig = (frame: number, duration: number): Rig => {
  const p = glide(frame, duration);
  const intro = easeOutCubic(interpolate(frame, [0, 54], [0, 1], {
    extrapolateRight: "clamp",
  }));
  const head = interpolate(p, [0, 1], [-1, 24.4]);
  const scale = interpolate(p, [0, 1], [0.94, 1.1]);
  const scroll = head * QUARTER_PX - 350 / scale;
  return {
    head,
    cam: {
      scroll,
      scale,
      rotateX: interpolate(p, [0, 1], [2.6, 6.2]),
      rotateY: interpolate(p, [0, 1], [11.5, 16.5]),
      rotateZ: interpolate(p, [0, 1], [-10.6, -7.1]),
      anchorY:
        interpolate(p, [0, 1], [512, 566]) +
        (1 - intro) * -210 +
        Math.sin(frame / 47) * 10,
      perspective: 2050,
    },
    mapPan: -scroll * 0.042,
    mapScale: interpolate(p, [0, 1], [1.18, 1.06]),
    mapDrift: interpolate(p, [0, 1], [-22, 30]),
    dofBlur: 7,
    bandHalf: 0.34,
  };
};

/** Everything that lives on the tilted plane, in draw order. */
const PlaneLayers: React.FC<{
  readonly rig: Rig;
  readonly variant: "chevron" | "bars";
  readonly trailColor: string;
  readonly withGrid: boolean;
}> = ({ rig, variant, trailColor, withGrid }) => {
  const gridCam = useMemo<Camera>(
    () => ({ ...rig.cam, scroll: rig.cam.scroll * 0.86 }),
    [rig.cam],
  );
  return (
    <>
      {withGrid ? <PerspectiveGrid cam={gridCam} /> : null}
      {variant === "bars" ? <BarField cam={rig.cam} head={rig.head} /> : null}
      <TimelineAxis
        cam={rig.cam}
        head={rig.head}
        heatYears={variant === "chevron"}
      />
      <ChevronTrail cam={rig.cam} head={rig.head} hue={trailColor} />
    </>
  );
};

/** Low-res animated grain, stretched up. Cheap at any output resolution. */
const Grain: React.FC<{ readonly frame: number }> = ({ frame }) => (
  <AbsoluteFill
    style={{
      overflow: "hidden",
      mixBlendMode: "overlay",
      opacity: 0.075,
      pointerEvents: "none",
    }}
  >
    <svg
      width={480}
      height={270}
      style={{
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
      }}
      viewBox="0 0 480 270"
    >
      <filter id="gt-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves={2}
          seed={frame % 24}
          stitchTiles="stitch"
        />
      </filter>
      <rect width={480} height={270} filter="url(#gt-grain)" />
    </svg>
  </AbsoluteFill>
);

export const GrowthTimeline: React.FC<GrowthTimelineProps> = ({
  variant,
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const rig =
    variant === "chevron"
      ? chevronRig(frame, durationInFrames)
      : barRig(frame, durationInFrames);

  const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  // The bar version covers fewer years in the same running time, so it
  // only travels part-way along the hue ramp and lands on pale pink
  // rather than full magenta.
  const trailColor = sampleRamp(
    TRAIL_RAMP,
    progress * (variant === "bars" ? 0.62 : 1),
  );

  // Depth of field: one blurred copy of the plane under a sharp copy that
  // is masked to a band running parallel to the axis, with a second mask
  // softening the far end of the timeline. Two nested elements rather than
  // mask-composite, which keeps the compositing path boring.
  const centre = rig.cam.anchorY / BASE_HEIGHT;
  const bandAngle = 180 + rig.cam.rotateZ;
  const band = `linear-gradient(${bandAngle}deg, rgba(0,0,0,0) ${
    (centre - rig.bandHalf - 0.2) * 100
  }%, rgba(0,0,0,1) ${(centre - rig.bandHalf) * 100}%, rgba(0,0,0,1) ${
    (centre + rig.bandHalf) * 100
  }%, rgba(0,0,0,0) ${(centre + rig.bandHalf + 0.22) * 100}%)`;
  const depthFalloff =
    "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 9%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 99%)";

  const graphics = (
    <PlaneLayers
      rig={rig}
      variant={variant}
      trailColor={trailColor}
      withGrid={false}
    />
  );

  const fadeIn = interpolate(frame, [0, 16], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND_COLOR }}>
      <AbsoluteFill
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${resolutionScale})`,
          transformOrigin: "top left",
          overflow: "hidden",
        }}
      >
        <Backdrop
          pan={rig.mapPan}
          mapScale={rig.mapScale}
          drift={rig.mapDrift}
          blur={4.5}
        />

        <AbsoluteFill style={{ opacity: fadeIn }}>
          {/* Out-of-focus pass. */}
          <AbsoluteFill style={{ filter: `blur(${rig.dofBlur}px)` }}>
            <PlaneLayers
              rig={rig}
              variant={variant}
              trailColor={trailColor}
              withGrid
            />
          </AbsoluteFill>

          {/* In-focus pass, banded to the axis. */}
          <AbsoluteFill
            style={{ maskImage: band, WebkitMaskImage: band } as React.CSSProperties}
          >
            <AbsoluteFill
              style={
                {
                  maskImage: depthFalloff,
                  WebkitMaskImage: depthFalloff,
                } as React.CSSProperties
              }
            >
              <PlaneLayers
                rig={rig}
                variant={variant}
                trailColor={trailColor}
                withGrid
              />
            </AbsoluteFill>
          </AbsoluteFill>

          {/* Bloom: the graphics again, blurred wide and screened back on. */}
          <AbsoluteFill
            style={{
              filter: "blur(18px)",
              mixBlendMode: "screen",
              opacity: 0.34,
            }}
          >
            {graphics}
          </AbsoluteFill>
        </AbsoluteFill>

        {/* Grade + texture. */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 80% 86% at 50% 50%, rgba(0,0,0,0) 46%, ${rgba(
              "#010512",
              0.34,
            )} 82%, ${rgba("#00030c", 0.6)} 100%)`,
            pointerEvents: "none",
          }}
        />
        <AbsoluteFill
          style={{
            background:
              "repeating-linear-gradient(180deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 3px)",
            pointerEvents: "none",
          }}
        />
        <Grain frame={frame} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const growthTimelineChevronDefaults: GrowthTimelineProps = {
  variant: "chevron",
  resolutionScale: 1,
};

export const growthTimelineBarsDefaults: GrowthTimelineProps = {
  variant: "bars",
  resolutionScale: 1,
};
