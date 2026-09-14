import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  Easing,
} from "remotion";
import { z } from "zod";
import {
  CAMERA_END_SCALE,
  CAMERA_SETTLE_FRAME,
  CAMERA_SETTLE_SCALE,
  CAMERA_START_SCALE,
  CENTER_X,
  CENTER_Y,
  DURATION_IN_FRAMES,
  PALETTE_DARK_BLUE,
  PALETTE_REFERENCE,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  type Palette,
} from "./constants";
import { Backdrop, Vignette } from "./Backdrop";
import { Bokeh } from "./Bokeh";
import { NeonRings } from "./NeonRings";
import { Globe } from "./Globe";
import { IconRing } from "./IconRing";
import { Defs } from "./Defs";

export const globalNetworkSchema = z.object({
  variant: z.enum(["reference", "darkBlue"]),
});

export type GlobalNetworkProps = z.infer<typeof globalNetworkSchema>;

export const globalNetworkDefaults: GlobalNetworkProps = {
  variant: "reference",
};

const PALETTES: Record<GlobalNetworkProps["variant"], Palette> = {
  reference: PALETTE_REFERENCE,
  darkBlue: PALETTE_DARK_BLUE,
};

// Opens tight, pulls back hard over the first ~1.2s, then drifts in
// again so slowly it reads as a locked-off shot rather than a zoom.
const useCameraScale = (frame: number) => {
  const pullBack = interpolate(
    frame,
    [0, CAMERA_SETTLE_FRAME],
    [CAMERA_START_SCALE, CAMERA_SETTLE_SCALE],
    {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const creepIn = interpolate(
    frame,
    [CAMERA_SETTLE_FRAME, DURATION_IN_FRAMES - 1],
    [CAMERA_SETTLE_SCALE, CAMERA_END_SCALE],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return frame <= CAMERA_SETTLE_FRAME ? pullBack : creepIn;
};

export const GlobalNetwork: React.FC<GlobalNetworkProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const palette = PALETTES[variant];
  const scale = useCameraScale(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.backdrop }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block" }}
      >
        <Defs palette={palette} frame={frame} />
        <Backdrop palette={palette} />
        {/* The whole scene shares one camera transform, so the bokeh
            parallaxes with the rings instead of sitting on glass. */}
        <g
          transform={`translate(${CENTER_X} ${CENTER_Y}) scale(${scale}) translate(${-CENTER_X} ${-CENTER_Y})`}
        >
          <Bokeh palette={palette} frame={frame} />
          <NeonRings frame={frame} />
          <Globe palette={palette} frame={frame} />
          <IconRing palette={palette} frame={frame} />
        </g>
        <Vignette />
      </svg>
    </AbsoluteFill>
  );
};
