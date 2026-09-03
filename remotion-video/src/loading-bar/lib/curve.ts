/**
 * A progress curve expressed as (frame, progress) waypoints.
 *
 * Real progress bars advance in uneven steps with pauses; a linear fill
 * reads as fake immediately. Each segment is eased in-and-out so the bar
 * decelerates into a stall and accelerates out of it, which is what
 * makes a flat waypoint pair actually feel like a pause.
 *
 * Progress is clamped to the first waypoint before the curve starts and
 * held at the last waypoint after it ends — this is a one-shot, not a
 * loop.
 */
export type Waypoint = { frame: number; progress: number };

const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const progressAt = (frame: number, curve: Waypoint[]): number => {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (frame <= first.frame) {
    return first.progress;
  }
  if (frame >= last.frame) {
    return last.progress;
  }
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const span = b.frame - a.frame || 1;
      const t = easeInOut((frame - a.frame) / span);
      return a.progress + (b.progress - a.progress) * t;
    }
  }
  return last.progress;
};

/** Frame at which the curve first reaches its final value. */
export const completionFrame = (curve: Waypoint[]): number =>
  curve[curve.length - 1].frame;
