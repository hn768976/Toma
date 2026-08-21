import React from "react";
import { zColor } from "@remotion/zod-types";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { config } from "./config";
import { NeonStreaks } from "./NeonStreaks";

export const titleOverlaySchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  /** Tint of the subtitle and the hairline rule. */
  accent: zColor(),
  /** Frame the title starts animating in on. */
  startFrame: z.number().int().min(0),
  /** How long the title holds before it fades back out, in frames. */
  holdFrames: z.number().int().min(1),
});

export type TitleOverlayProps = z.infer<typeof titleOverlaySchema>;

/**
 * A clean system stack — the piece ships no font files, so nothing is
 * downloaded at render time and there is no licensing tail.
 */
const FONT_STACK =
  '"Inter", "Helvetica Neue", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

/**
 * Title + subtitle over the streaks: fade, a slight upward move, and
 * letter-spacing that settles from wide to tight. Driven entirely by
 * useCurrentFrame(), with `fps` taken from useVideoConfig() for the springs.
 *
 * The text also fades back out before the end, so this composition loops just
 * like the background does.
 */
export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  title,
  subtitle,
  accent,
  startFrame,
  holdFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, height, durationInFrames } = useVideoConfig();

  const local = frame - startFrame;

  const enter = spring({
    frame: local,
    fps,
    config: { damping: 200, mass: 0.9, stiffness: 90 },
    durationInFrames: 34,
  });
  const subEnter = spring({
    frame: local - 9,
    fps,
    config: { damping: 200, mass: 0.9, stiffness: 90 },
    durationInFrames: 34,
  });

  // Fade out in the last stretch so the composition returns to a clean frame.
  const exitStart = startFrame + holdFrames;
  const exit = interpolate(
    frame,
    [exitStart, Math.min(exitStart + 26, durationInFrames)],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const titleOpacity = enter * exit;
  const subOpacity = subEnter * exit;

  const lift = (t: number) => (1 - t) * height * 0.024;
  const tracking = (t: number, from: number, to: number) =>
    from + (to - from) * t;

  return (
    <AbsoluteFill>
      <NeonStreaks />

      {/* A very faint scrim so text stays legible over a bright streak. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 42% at 50% 44%, rgba(0,3,8,0.72) 0%, rgba(0,3,8,0) 100%)`,
          opacity: Math.max(titleOpacity, subOpacity),
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          paddingBottom: height * 0.16,
        }}
      >
        <div
          style={{
            fontFamily: FONT_STACK,
            fontSize: height * 0.082,
            fontWeight: 600,
            color: config.palette.core,
            letterSpacing: `${tracking(enter, 0.34, 0.055)}em`,
            // Trailing letter-spacing adds a phantom gap on the right; pull it back.
            marginRight: `-${tracking(enter, 0.34, 0.055)}em`,
            opacity: titleOpacity,
            transform: `translateY(${lift(enter)}px)`,
            textAlign: "center",
            textShadow: `0 0 ${height * 0.05}px rgba(46,107,255,0.55)`,
            whiteSpace: "pre-wrap",
          }}
        >
          {title}
        </div>

        <div
          style={{
            width: height * 0.1,
            height: 1,
            marginTop: height * 0.035,
            background: accent,
            opacity: subOpacity * 0.7,
            transform: `scaleX(${subEnter})`,
          }}
        />

        <div
          style={{
            fontFamily: FONT_STACK,
            fontSize: height * 0.023,
            fontWeight: 400,
            color: accent,
            letterSpacing: `${tracking(subEnter, 0.5, 0.22)}em`,
            marginRight: `-${tracking(subEnter, 0.5, 0.22)}em`,
            marginTop: height * 0.032,
            opacity: subOpacity,
            transform: `translateY(${lift(subEnter)}px)`,
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
