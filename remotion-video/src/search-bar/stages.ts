import { interpolate, spring } from "remotion";
import type { StageConfig } from "./variants";

/** A scale-and-fade applied to every bar-attached layer during an entrance. */
export type Entrance = { scale: number; opacity: number };

export const NO_ENTRANCE: Entrance = { scale: 1, opacity: 1 };

export type StageState = {
  entrance: Entrance;
  /** How much of the border has been stroked on; 1 when there is no draw-on. */
  reveal: number;
  /**
   * The chrome that lives inside the pill — the magnifier and the button —
   * arriving just behind the border rather than snapping in with it.
   */
  chromeFade: number;
  /** The field has been clicked: border brightens, placeholder clears. */
  focused: boolean;
  placeholderOpacity: number;
  /** The search button is flashing to its hover colour. */
  buttonHot: boolean;
  caretVisible: boolean;
  /** Ground-colour wash over everything, closing the loop. */
  fade: number;
};

/** What the simple looping variants get: no staging at all. */
export const IDLE_STAGE: StageState = {
  entrance: NO_ENTRANCE,
  reveal: 1,
  chromeFade: 1,
  focused: false,
  placeholderOpacity: 0,
  buttonHot: false,
  caretVisible: true,
  fade: 0,
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Resolves the interactive timeline for one frame. Everything here is a pure
 * function of the frame number, so the staged variants stay as deterministic
 * as the looping ones.
 */
export const stageState = (
  frame: number,
  stages: StageConfig | null,
  fps: number,
): StageState => {
  if (stages === null) {
    return IDLE_STAGE;
  }

  const entrance = stages.barEntrance;
  let reveal = 1;
  let chromeFade = 1;
  let scale = 1;
  let opacity = 1;
  if (entrance !== null) {
    if (entrance.kind === "draw") {
      reveal = interpolate(frame, [entrance.start, entrance.end], [0, 1], clamp);
      chromeFade = interpolate(frame, [entrance.end, entrance.end + 8], [0, 1], clamp);
    } else {
      // A soft spring: it settles rather than overshooting into a bounce.
      const settle = spring({
        frame: frame - entrance.start,
        fps,
        config: { damping: 14, mass: 0.7 },
      });
      scale = 0.96 + 0.04 * settle;
      opacity = interpolate(
        frame,
        [entrance.start, entrance.start + (entrance.end - entrance.start) * 0.5],
        [0, 1],
        clamp,
      );
    }
  }

  const focused = stages.focusFrame !== null && frame >= stages.focusFrame;

  let placeholderOpacity = 0;
  if (stages.placeholderIn !== null) {
    placeholderOpacity = interpolate(
      frame,
      [stages.placeholderIn.start, stages.placeholderIn.end],
      [0, 1],
      clamp,
    );
    if (focused) {
      // Clicking into the field clears it outright, as a real one does.
      placeholderOpacity = 0;
    }
    placeholderOpacity *= opacity;
  }

  const flash = stages.buttonFlash;
  const buttonHot =
    flash !== null && frame >= flash.frame && frame < flash.frame + flash.frames;

  const fadeOut = stages.fadeOut;
  const fade =
    fadeOut === null
      ? 0
      : interpolate(frame, [fadeOut.start, fadeOut.end], [0, 1], clamp);

  return {
    entrance: { scale, opacity },
    reveal,
    chromeFade,
    focused,
    placeholderOpacity,
    buttonHot,
    caretVisible: stages.focusFrame === null || frame >= stages.focusFrame,
    fade,
  };
};
