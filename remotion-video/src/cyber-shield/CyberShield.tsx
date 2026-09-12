import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { Background } from "./Background";
import { Emblem } from "./Emblem";
import { HudDeck } from "./HudDeck";
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  DURATION_IN_FRAMES,
  INTRO_END_FRAME,
  INTRO_PITCH_DEG,
  INTRO_ROLL_DEG,
  INTRO_SCALE,
  INTRO_START_FRAME,
  INTRO_YAW_DEG,
  REST_PITCH_DEG,
  REST_ROLL_DEG,
  REST_YAW_DEG,
  SWAY_PITCH_DEG,
  SWAY_PITCH_PERIOD,
  SWAY_ROLL_DEG,
  SWAY_ROLL_PERIOD,
  SWAY_YAW_DEG,
  SWAY_YAW_PERIOD,
} from "./constants";
import { Pose, degToRad } from "./projection";
import { ThemeName, getTheme } from "./theme";

export const cyberShieldSchema = z.object({
  // Which of the two visual treatments to render. See theme.ts.
  theme: z.enum(["navy", "cyan"]),
});

export type CyberShieldProps = z.infer<typeof cyberShieldSchema>;

export const cyberShieldDefaults: CyberShieldProps = { theme: "navy" };

/**
 * Cyber-shield emblem: a mosaic shield inside a stack of HUD rings,
 * swinging from a steep three-quarter view to near-frontal while a
 * dashboard assembles around it.
 *
 * The whole piece is authored in a fixed 1920x1080 SVG user space and
 * the <svg> is stretched to the composition size, so the 1080p and 4K
 * compositions are the same source rendered at different raster sizes —
 * true vector output, nothing to keep in sync between them.
 */
export const CyberShield: React.FC<CyberShieldProps> = ({
  theme: themeName,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const theme = getTheme(themeName as ThemeName);

  const progress = frame / Math.max(1, durationInFrames - 1);

  // Opening swing: steeply rotated and slightly oversized, settling to
  // the rest pose over 10s. inOut(cubic) holds the steep three-quarter
  // view for the first couple of seconds, swings through the middle, then
  // eases in without an elastic snap — the reference's long settle.
  const intro = interpolate(
    frame,
    [INTRO_START_FRAME, INTRO_END_FRAME],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  // After the settle the emblem never fully stops — three slow,
  // non-commensurate sways keep it breathing for the rest of the runtime.
  const sway = interpolate(
    frame,
    [INTRO_END_FRAME - 120, INTRO_END_FRAME],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const swayYaw =
    Math.sin((frame / SWAY_YAW_PERIOD) * Math.PI * 2) * SWAY_YAW_DEG * sway;
  const swayPitch =
    Math.sin((frame / SWAY_PITCH_PERIOD) * Math.PI * 2 + 1.1) *
    SWAY_PITCH_DEG *
    sway;
  const swayRoll =
    Math.sin((frame / SWAY_ROLL_PERIOD) * Math.PI * 2 + 2.3) *
    SWAY_ROLL_DEG *
    sway;

  const pose: Pose = {
    yaw: degToRad(
      INTRO_YAW_DEG + (REST_YAW_DEG - INTRO_YAW_DEG) * intro + swayYaw,
    ),
    pitch: degToRad(
      INTRO_PITCH_DEG + (REST_PITCH_DEG - INTRO_PITCH_DEG) * intro + swayPitch,
    ),
    roll: degToRad(
      INTRO_ROLL_DEG + (REST_ROLL_DEG - INTRO_ROLL_DEG) * intro + swayRoll,
    ),
    centerX: theme.emblem.x,
    centerY: theme.emblem.y,
    scale: theme.emblem.scale * (INTRO_SCALE + (1 - INTRO_SCALE) * intro),
  };

  // The reference opens on the emblem already lit and mid-swing, so
  // there is no fade-up here — only the HUD deck stages itself in.
  const reveal = 1;

  const uid = `cs-${themeName}`;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.palette.backdropBottom }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="geometricPrecision"
      >
        <Background theme={theme} frame={frame} progress={progress} uid={uid} />
        <HudDeck theme={theme} frame={frame} />
        <Emblem
          theme={theme}
          pose={pose}
          frame={frame}
          uid={uid}
          reveal={reveal}
        />
      </svg>
    </AbsoluteFill>
  );
};

export const CYBER_SHIELD_DURATION = DURATION_IN_FRAMES;
