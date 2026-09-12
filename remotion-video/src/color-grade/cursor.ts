// A tiny scripted-pointer engine.
//
// The point of this file is causality: the cursor does not just wander
// over a static screenshot. Every drag is bound to a named control, the
// control's value is what the wheels/sliders render from, and the scopes
// read the same values back out. So when the pointer pulls the Gain wheel
// toward blue, the blue trace in the parade really does lift. That
// cause-and-effect is most of what sells a UI shot as real footage.

import { clamp, easeInOut, easeOutCubic, fbm, mix } from "./noise";

export type P = { x: number; y: number };

export type Seg =
  /** Travel to a point with the button up. */
  | {
      kind: "move";
      dur: number;
      to: P;
      arc?: number;
      control?: string;
      value?: P;
    }
  /** Hold still (reading the screen, waiting for a render). */
  | { kind: "dwell"; dur: number }
  /** Press, travel, release — optionally driving a control. */
  | {
      kind: "drag";
      dur: number;
      to: P;
      arc?: number;
      control?: string;
      value?: P;
    }
  /** Press and release in place. */
  | { kind: "click"; dur: number; control?: string; value?: P }
  /** Fast shuttle back and forth across a strip, button down. */
  | { kind: "scrub"; dur: number; to: P; arc?: number; control?: string; value?: P };

export type Script = {
  start: P;
  /** Starting value for any control the script will touch. */
  initial: Record<string, P>;
  segments: Seg[];
};

export type CursorState = {
  x: number;
  y: number;
  pressed: boolean;
  /** 0 -> 1 -> 0 pulse used to draw the click ripple. */
  clickPulse: number;
  controls: Record<string, P>;
};

const lerpP = (a: P, b: P, t: number): P => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
});

// A straight line between two UI targets looks robotic. Real pointer
// moves bow slightly and overshoot a touch before settling, so we bend
// the path along its perpendicular and let the easing come back.
const arcOffset = (a: P, b: P, t: number, amount: number): P => {
  if (!amount) return { x: 0, y: 0 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.sin(t * Math.PI) * amount;
  return { x: (-dy / len) * bow, y: (dx / len) * bow };
};

// Sub-pixel hand tremor. Always present, even while "still" — a perfectly
// static cursor in an otherwise live frame looks pasted on.
const tremor = (frame: number): P => ({
  x: (fbm(frame * 0.07, 17, 3) - 0.5) * 2.6,
  y: (fbm(frame * 0.07, 91, 3) - 0.5) * 2.6,
});

export const evaluateScript = (script: Script, frame: number): CursorState => {
  let pos: P = script.start;
  const controls: Record<string, P> = { ...script.initial };
  let pressed = false;
  let clickPulse = 0;
  let t0 = 0;

  for (const seg of script.segments) {
    const t1 = t0 + seg.dur;
    const active = frame >= t0 && frame < t1;
    // Local progress; for segments already in the past this is 1, which
    // is what leaves their control value latched at its end state.
    const raw = seg.dur <= 0 ? 1 : clamp((frame - t0) / seg.dur, 0, 1);

    if (seg.kind === "dwell") {
      if (frame >= t1) t0 = t1;
      else if (active) break;
      else break;
      continue;
    }

    if (seg.kind === "click") {
      if (seg.control && seg.value && raw > 0.35) {
        controls[seg.control] = seg.value;
      }
      if (active) {
        // Down for the first 40% of the segment, then the ripple.
        pressed = raw < 0.4;
        clickPulse = raw < 0.12 ? 0 : clamp((raw - 0.12) / 0.6, 0, 1);
        break;
      }
      t0 = t1;
      continue;
    }

    const from = pos;
    const to = seg.to;

    let eased: number;
    if (seg.kind === "scrub") {
      // Two fast passes with a snap back, rather than one smooth glide.
      const s = raw * 2;
      eased = s < 1 ? easeOutCubic(s) : 1 - easeInOut(s - 1) * 0.42;
    } else {
      eased = easeInOut(raw);
    }

    if (seg.control && seg.value) {
      const startVal = controls[seg.control] ?? { x: 0, y: 0 };
      controls[seg.control] = lerpP(startVal, seg.value, eased);
    }

    if (active) {
      const base = lerpP(from, to, eased);
      const bow = arcOffset(from, to, raw, seg.arc ?? 0);
      pos = { x: base.x + bow.x, y: base.y + bow.y };
      pressed = seg.kind === "drag" || seg.kind === "scrub";
      break;
    }

    pos = to;
    t0 = t1;
  }

  const shake = tremor(frame);
  return {
    x: pos.x + shake.x,
    y: pos.y + shake.y,
    pressed,
    clickPulse,
    controls,
  };
};

export const scriptLength = (script: Script) =>
  script.segments.reduce((sum, s) => sum + s.dur, 0);
