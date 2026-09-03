/**
 * Light-leak scheduling and geometry.
 *
 * This lives outside the component because two layers need it: <LightLeak>
 * draws the bloom, and <FilmGrain> raises grain amplitude inside the lit
 * region only — grain gets more visible where the film is exposed, and that
 * detail is a large part of why a leak reads as light on emulsion rather than
 * as a gradient pasted over the top.
 */
import { rndBool, rndInt, rndRange } from "./rng";
import { smoothstep } from "./canvas";
import type { LayerSettings } from "../variants";

export type LeakEdge = "left" | "right" | "top" | "bottom";

export type LeakEvent = {
  id: string;
  start: number;
  build: number;
  hold: number;
  recede: number;
  edge: LeakEdge;
  /** Where along that edge the leak enters, 0..1. */
  along: number;
  /** How far across the frame it reaches, as a fraction. */
  reach: number;
  /** How elongated the bloom is along the edge. */
  spread: number;
  /** A brief burn-through, or null. */
  flashStart: number;
  flashLife: number;
};

const EDGES: LeakEdge[] = ["left", "right", "top", "bottom"];

/**
 * Two or three events spread across the loop, each from a different edge and
 * each contained entirely within it, so the schedule is a pure function of
 * frame % loopFrames.
 */
export const buildLeakEvents = (
  settings: LayerSettings["leak"],
  loopFrames: number,
): LeakEvent[] => {
  const events: LeakEvent[] = [];
  const count = settings.eventCount;
  if (count <= 0) return events;

  // A seeded rotation plus a swap gives each event a different edge without
  // the sequence being the same every project.
  const rotation = rndInt("leak|rotation", 0, 3);
  const slot = loopFrames / count;

  for (let i = 0; i < count; i++) {
    const s = "leak|e" + i;
    const build = Math.round(settings.buildFrames * rndRange(s + "|build", 0.85, 1.15));
    const hold = Math.round(settings.holdFrames * rndRange(s + "|hold", 0.6, 1.5));
    const recede = Math.round(settings.recedeFrames * rndRange(s + "|recede", 0.85, 1.15));
    const life = build + hold + recede;
    const slack = Math.max(0, slot - life);
    const start = Math.min(
      loopFrames - life,
      Math.round(i * slot + rndRange(s + "|start", 0, slack)),
    );
    if (start < 0) continue;

    const hasFlash = rndBool(s + "|hasflash", settings.flashChance);
    const flashLife = rndInt(s + "|flashlife", 3, 4);

    events.push({
      id: s,
      start,
      build,
      hold,
      recede,
      edge: EDGES[(i + rotation) % EDGES.length],
      along: rndRange(s + "|along", 0.2, 0.8),
      reach: rndRange(s + "|reach", settings.minReach, settings.maxReach),
      spread: rndRange(s + "|spread", 1.25, 2.1),
      // Placed inside the hold so the flash lands at the leak's peak.
      flashStart: hasFlash
        ? start + build + rndInt(s + "|flashat", 2, Math.max(3, hold - flashLife - 2))
        : -1,
      flashLife,
    });
  }
  return events;
};

export type ActiveLeak = {
  event: LeakEvent;
  /** 0..1 envelope over build / hold / recede. */
  strength: number;
  /** 0..1 burn-through flash, usually 0. */
  flash: number;
};

export const activeLeaks = (events: LeakEvent[], frame: number): ActiveLeak[] => {
  const out: ActiveLeak[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const life = e.build + e.hold + e.recede;
    const since = frame - e.start;
    if (since < 0 || since >= life) continue;

    let strength: number;
    if (since < e.build) strength = smoothstep(0, 1, since / e.build);
    else if (since < e.build + e.hold) strength = 1;
    else strength = smoothstep(0, 1, 1 - (since - e.build - e.hold) / e.recede);

    let flash = 0;
    if (e.flashStart >= 0 && frame >= e.flashStart && frame < e.flashStart + e.flashLife) {
      // Strikes almost immediately, then falls away over the remaining frames.
      const u = (frame - e.flashStart) / e.flashLife;
      flash = u < 0.25 ? u / 0.25 : Math.pow(1 - (u - 0.25) / 0.75, 1.5);
    }

    out.push({ event: e, strength, flash });
  }
  return out;
};

/** The bloom's origin, just outside the frame, in pixels. */
export const leakOrigin = (
  event: LeakEvent,
  width: number,
  height: number,
): { x: number; y: number; radius: number; scaleX: number; scaleY: number } => {
  const overshoot = 0.06;
  switch (event.edge) {
    case "left": {
      const radius = event.reach * width;
      return {
        x: -overshoot * width,
        y: event.along * height,
        radius,
        scaleX: 1,
        scaleY: event.spread,
      };
    }
    case "right": {
      const radius = event.reach * width;
      return {
        x: (1 + overshoot) * width,
        y: event.along * height,
        radius,
        scaleX: 1,
        scaleY: event.spread,
      };
    }
    case "top": {
      const radius = event.reach * height;
      return {
        x: event.along * width,
        y: -overshoot * height,
        radius,
        scaleX: event.spread,
        scaleY: 1,
      };
    }
    default: {
      const radius = event.reach * height;
      return {
        x: event.along * width,
        y: (1 + overshoot) * height,
        radius,
        scaleX: event.spread,
        scaleY: 1,
      };
    }
  }
};

/**
 * How lit a point is by a leak, 0..1. Cheap enough to evaluate on the grain
 * layer's coarse density grid every frame.
 */
export const leakMaskAt = (
  leak: ActiveLeak,
  x: number,
  y: number,
  width: number,
  height: number,
): number => {
  const origin = leakOrigin(leak.event, width, height);
  const dx = (x - origin.x) / (origin.radius * origin.scaleX);
  const dy = (y - origin.y) / (origin.radius * origin.scaleY);
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= 1) return 0;
  return leak.strength * (1 - d) * (1 - d);
};
