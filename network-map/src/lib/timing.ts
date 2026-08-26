import {Easing, interpolate} from 'remotion';
import {LOOP_FRAMES} from '../config';
import type {Arc} from './arcs';

export type ArcState = {
  /** Position inside this arc's own cycle, 0..cycle. */
  local: number;
  /** Eased draw-on progress, 0..1. */
  progress: number;
  /** Overall opacity, 0 at both ends of the cycle so the loop closes. */
  alpha: number;
};

export const arcStateAt = (arc: Arc, frame: number): ArcState => {
  const local = ((frame - arc.offset) % arc.cycle + arc.cycle) % arc.cycle;

  const progress = interpolate(local, [0, arc.drawFrames], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const rampFrames = Math.min(10, arc.drawFrames);
  let alpha: number;
  if (local <= arc.drawFrames) {
    alpha = Math.min(1, local / rampFrames);
  } else if (local < arc.fadeStart) {
    alpha = 1;
  } else if (local < arc.fadeStart + arc.fadeFrames) {
    alpha = interpolate(
      local,
      [arc.fadeStart, arc.fadeStart + arc.fadeFrames],
      [1, 0],
      {easing: Easing.inOut(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
    );
  } else {
    alpha = 0;
  }

  return {local, progress, alpha};
};

/** How far past its draw-on an arc is, 0..1, used to gate travelling dots. */
export const travelGate = (arc: Arc, state: ArcState): number =>
  Math.max(0, Math.min(1, (state.local - arc.drawFrames) / 12));

/**
 * Locked camera with a slight ambient drift on a closed Lissajous path.
 * Peak excursion is under 10px on both axes and the path returns to its start
 * at frame 600.
 */
export const cameraDrift = (frame: number): {x: number; y: number} => {
  const a = (2 * Math.PI * (frame % LOOP_FRAMES)) / LOOP_FRAMES;
  return {
    x: 6.5 * Math.sin(a) + 3 * Math.sin(2 * a + 1.1),
    y: 5.5 * Math.cos(a) + 2.5 * Math.sin(3 * a + 0.4),
  };
};
