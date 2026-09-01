import { interpolate, random, spring } from "remotion";
import { TIMELINE } from "./timeline";
import type { IconKind, Variant } from "./variants";
import {
  fillColorAt,
  hatchScroll,
  iconColorAt,
  progressAt,
  statusLineAt,
} from "./progress";

/** Plane px the hatching travels per frame while the bar is working. */
export const HATCH_SPEED = 4.2;

export type ScreenState = {
  frame: number;
  /** Backdrop, grid and side panels fade up over frames 30-70. */
  backdropAlpha: number;
  /** Side panels are wiped on individually; this is the global gate. */
  dialogScale: number;
  dialogAlpha: number;
  /** 0-1: the border drawing itself on before any contents appear. */
  borderDraw: number;
  contentAlpha: number;
  /** True once the contents have swapped to the outcome state. */
  swapped: boolean;
  titleText: string;
  labelBanner: string;
  titleBarColor: string;
  progress: number;
  fillColor: string;
  hatchOffset: number;
  statusText: string;
  icon: IconKind;
  iconStroke: string;
  iconGlow: string;
  /** Gentle pulse of the outcome icon, 1 when it does not pulse. */
  iconPulse: number;
  /** 0-1 draw-on of the outcome icon. */
  iconDraw: number;
  crossOn: boolean;
  flashAlpha: number;
  glitchOn: boolean;
  /** Black overlay: the opening hold and the closing fade. */
  fadeToBlack: number;
  deadPanels: readonly number[];
  garbleColumn: number | null;
};

const flickerWindows = (): readonly (readonly [number, number])[] => {
  const out: [number, number][] = [];
  let f = TIMELINE.transitionEnd + 8;
  let i = 0;
  while (f < TIMELINE.outcomeEnd - 5) {
    const len = 2 + Math.floor(random(`dialog-flicker-len-${i}`) * 2);
    out.push([f, f + len]);
    f += 25 + Math.floor(random(`dialog-flicker-gap-${i}`) * 21);
    i++;
  }
  return out;
};

const FLICKER = flickerWindows();

const inWindow = (
  frame: number,
  windows: readonly (readonly [number, number])[],
): boolean => windows.some(([a, b]) => frame >= a && frame < b);

export const deriveState = (
  variant: Variant,
  frame: number,
  fps: number,
): ScreenState => {
  const { palette, labels, transitionSpec, outcome } = variant;

  const backdropAlpha = interpolate(
    frame,
    [TIMELINE.blackOut, TIMELINE.backdropIn],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const springed = spring({
    frame: frame - TIMELINE.backdropIn,
    fps,
    config: { damping: 15, mass: 0.75, stiffness: 110 },
  });
  const dialogScale = 0.96 + 0.04 * springed;

  const borderDraw = interpolate(
    frame,
    [TIMELINE.backdropIn, TIMELINE.backdropIn + 22],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const contentAlpha = interpolate(
    frame,
    [TIMELINE.backdropIn + 14, TIMELINE.dialogIn],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  let dialogAlpha = interpolate(
    frame,
    [TIMELINE.backdropIn, TIMELINE.backdropIn + 10],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  if (
    outcome.flicker &&
    frame >= TIMELINE.transitionEnd &&
    frame < TIMELINE.outcomeEnd &&
    inWindow(frame, FLICKER)
  ) {
    dialogAlpha *= 0.6;
  }

  // The contents swap behind the flash, while it is still at full opacity.
  const swapAt = TIMELINE.progressEnd + Math.max(1, transitionSpec.flashHold - 1);
  const swapped = frame >= swapAt;

  const flashSpan = transitionSpec.flashHold + transitionSpec.flashDecay;
  const flashAlpha =
    frame < TIMELINE.progressEnd || frame > TIMELINE.progressEnd + flashSpan
      ? 0
      : frame < TIMELINE.progressEnd + transitionSpec.flashHold
        ? 1
        : interpolate(
            frame,
            [
              TIMELINE.progressEnd + transitionSpec.flashHold,
              TIMELINE.progressEnd + flashSpan,
            ],
            [1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

  const glitchAt = TIMELINE.progressEnd + transitionSpec.glitchAt;
  const glitchOn =
    transitionSpec.glitch &&
    frame >= glitchAt &&
    frame < glitchAt + transitionSpec.glitchFrames;

  const iconColor = iconColorAt(variant, frame);
  const outcomeAge = frame - swapAt;
  const iconDraw = swapped
    ? interpolate(outcomeAge, [0, 12], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const iconPulse =
    swapped && outcome.pulse
      ? 1 + 0.035 * Math.sin((outcomeAge / 58) * Math.PI * 2)
      : 1;

  const fadeToBlack =
    frame < TIMELINE.blackOut
      ? 1
      : interpolate(
          frame,
          [TIMELINE.outcomeEnd, TIMELINE.end],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

  return {
    frame,
    backdropAlpha,
    dialogScale,
    dialogAlpha,
    borderDraw,
    contentAlpha,
    swapped,
    titleText: swapped ? labels.outcomeTitle : labels.title,
    labelBanner: labels.outcomeBanner,
    titleBarColor: swapped ? palette.titleBarBright : palette.titleBar,
    progress: progressAt(variant, frame),
    fillColor: fillColorAt(variant, frame),
    hatchOffset: hatchScroll(variant, frame, HATCH_SPEED),
    statusText: statusLineAt(variant, frame),
    icon: swapped ? variant.icon.outcome : variant.icon.progress,
    iconStroke: iconColor.stroke,
    iconGlow: iconColor.glow,
    iconPulse,
    iconDraw,
    // Hard, no easing: the cross is simply there from the swap.
    crossOn: transitionSpec.cross && swapped,
    flashAlpha,
    glitchOn,
    fadeToBlack,
    deadPanels: swapped ? outcome.deadPanels : [],
    garbleColumn:
      frame >= TIMELINE.transitionEnd ? outcome.garbleColumn : null,
  };
};
