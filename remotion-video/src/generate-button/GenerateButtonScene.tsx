import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import "./load-font";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  CAMERA_SCALE_REST,
  CAMERA_SCALE_START,
  CENTER_X,
  CLICK_FRAME,
  CURSOR_ARRIVE_FRAME,
  CURSOR_ENTER_FRAME,
  CURSOR_FADE_END,
  CURSOR_FADE_START,
  CURSOR_TIP_END_Y,
  CURSOR_TIP_PRESSED_Y,
  CURSOR_TIP_START_Y,
  TRACE_FADE_IN_END,
  TRACE_FADE_IN_START,
  ZOOM_END_FRAME,
  ZOOM_START_FRAME,
} from "./constants";
import { Backdrop } from "./Backdrop";
import { CircuitField } from "./CircuitField";
import { Cursor } from "./Cursor";
import { GenerateButton } from "./GenerateButton";
import { THEMES } from "./theme";

export const generateButtonSchema = z.object({
  label: z.string(),
  theme: z.enum(["dark", "light"]),
});

export type GenerateButtonProps = z.infer<typeof generateButtonSchema>;

export const generateButtonDefaults: GenerateButtonProps = {
  label: "Generate",
  theme: "dark",
};

/** Camera pull-back: accelerates off the click, settles softly. */
const ZOOM_EASING = Easing.bezier(0.38, 0, 0.22, 1);
/** Pointer glide: near-linear with a gentle arrival. */
const CURSOR_EASING = Easing.bezier(0.28, 0.16, 0.3, 1);

export const GenerateButtonScene: React.FC<GenerateButtonProps> = ({
  label,
  theme: themeName,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const theme = THEMES[themeName];

  // Everything below is authored in a 1920x1080 design space; this is the
  // only place the real composition size enters, which is what makes the
  // 1080p and 4K masters identical apart from resolution.
  const designScale = width / BASE_WIDTH;

  const cameraScale = interpolate(
    frame,
    [ZOOM_START_FRAME, ZOOM_END_FRAME],
    [CAMERA_SCALE_START, CAMERA_SCALE_REST],
    {
      easing: ZOOM_EASING,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const cursorTravel = interpolate(
    frame,
    [CURSOR_ENTER_FRAME, CURSOR_ARRIVE_FRAME],
    [CURSOR_TIP_START_Y, CURSOR_TIP_END_Y],
    {
      easing: CURSOR_EASING,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  // Small dip as the click lands, then it just holds there and fades.
  const cursorDip = interpolate(
    frame,
    [CLICK_FRAME, CLICK_FRAME + 5],
    [0, CURSOR_TIP_PRESSED_Y - CURSOR_TIP_END_Y],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const cursorOpacity = interpolate(
    frame,
    [CURSOR_FADE_START, CURSOR_FADE_END],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const press = interpolate(frame, [CLICK_FRAME, CLICK_FRAME + 4, CLICK_FRAME + 11], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const flash = interpolate(
    frame,
    [CLICK_FRAME - 1, CLICK_FRAME + 3, CLICK_FRAME + 14],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // The pool of light firms up as the circuit field comes alive.
  const ambient = interpolate(
    frame,
    [TRACE_FADE_IN_START, TRACE_FADE_IN_END],
    [0.75, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bgOuter, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${designScale})`,
          transformOrigin: "top left",
        }}
      >
        <Backdrop theme={theme} ambient={ambient} />
        <CircuitField
          frame={frame}
          theme={theme}
          designScale={designScale}
        />
        <GenerateButton
          label={label}
          theme={theme}
          scale={cameraScale}
          flash={flash}
          press={press}
        />
        <Cursor
          x={CENTER_X}
          y={cursorTravel + cursorDip}
          opacity={cursorOpacity}
          theme={theme}
        />
      </div>
    </AbsoluteFill>
  );
};
