import { PX_PER_SECOND, TRACK_X0 } from "./constants";
import { seeded } from "./random";

// --- tracks ----------------------------------------------------------

export type TrackKind = "video" | "audio";

export type Track = {
  id: string;
  kind: TrackKind;
  name: string;
  y: number; // UI-space top edge
  height: number;
};

export type ClipColor = "cyan" | "violet" | "teal" | "steel";

export type Clip = {
  id: string;
  track: string;
  start: number; // seconds on the edit timeline
  duration: number; // seconds
  color: ClipColor;
  label: string;
  /** Small coloured badge squares drawn in the clip's label bar. */
  badges: number;
};

// --- edit script -----------------------------------------------------
// The timeline is not keyframed state-by-state; it is a fold. We start
// from `clips` and replay every event whose start frame has passed,
// which keeps the edit causally consistent (a clip that was razored at
// 0:06 stays razored) and makes the script readable as a list of the
// operations an editor actually performs.

export type EditEvent =
  /** Razor cut: splits `clipId` `offset` seconds in, into `${id}a`/`${id}b`. */
  | { kind: "cut"; at: number; clipId: string; offset: number }
  /** Slide a clip along its track (and optionally to another track). */
  | {
      kind: "move";
      from: number;
      to: number;
      clipId: string;
      deltaStart: number;
      toTrack?: string;
    }
  /** Drag one edge of a clip. Shows the red trim highlight + tooltip. */
  | {
      kind: "trim";
      from: number;
      to: number;
      clipId: string;
      edge: "start" | "end";
      delta: number;
    }
  /** Ripple delete: remove a clip and pull everything after it left. */
  | { kind: "remove"; at: number; clipId: string; ripple: boolean }
  | { kind: "select"; from: number; to: number; clipIds: string[] }
  | {
      kind: "marquee";
      from: number;
      to: number;
      rect: [number, number, number, number]; // UI space x0,y0,x1,y1
    }
  | { kind: "insert"; at: number; clip: Clip };

export type TimelineScript = {
  tracks: Track[];
  clips: Clip[];
  events: EditEvent[];
  /** Cursor path keyframes, UI space. */
  cursor: CursorKey[];
  /** Frames on which the pointer "clicks" (drives the click ripple). */
  clicks: number[];
  /** Playhead position in seconds, as keyframes. */
  playhead: { frame: number; seconds: number }[];
  /** Horizontal scroll of the edit view, in seconds, as keyframes. */
  scroll: { frame: number; seconds: number }[];
  /** Warm keyframe/rubber-band lines drawn across a track. */
  rubberBand: { track: string; level: number }[];
  /** Seed for waveform + badge generation. */
  seed: number;
};

export type CursorKey = {
  frame: number;
  x: number;
  y: number;
  /** "pointer" | "razor" | "hand" - changes the drawn tool glyph. */
  tool?: CursorTool;
};

export type CursorTool = "pointer" | "razor" | "hand" | "trim";

// --- evaluation ------------------------------------------------------

export type ClipState = Clip & {
  /** 0..1 - how selected the clip is drawn (white outline). */
  selected: number;
  /** 0..1 - red trim highlight while an edge is being dragged. */
  trimming: number;
  /** 0..1 - lifted/ghosted while being dragged to a new position. */
  dragging: number;
};

export type TooltipState = {
  text: string;
  x: number;
  y: number;
  opacity: number;
} | null;

export type MarqueeState = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
} | null;

export type TimelineState = {
  clips: ClipState[];
  tooltip: TooltipState;
  marquee: MarqueeState;
  /** Seconds range of the audio bed drawn "hot" (selected). */
  hotRange: [number, number] | null;
};

const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const progress = (frame: number, from: number, to: number) => {
  if (frame <= from) return 0;
  if (frame >= to) return 1;
  return easeInOut((frame - from) / (to - from));
};

/** Bell curve peaking mid-way through [from, to]; drives transient UI. */
const pulse = (frame: number, from: number, to: number) => {
  if (frame < from - 6 || frame > to + 8) return 0;
  if (frame < from) return (frame - from + 6) / 6;
  if (frame > to) return 1 - (frame - to) / 8;
  return 1;
};

const formatTimecode = (seconds: number) => {
  const sign = seconds < 0 ? "-" : "+";
  const abs = Math.abs(seconds);
  const f = Math.round((abs % 1) * 30);
  const s = Math.floor(abs) % 60;
  const m = Math.floor(abs / 60) % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${sign}00:${pad(m)}:${pad(s)}:${pad(f)}`;
};

export const evaluateTimeline = (
  script: TimelineScript,
  frame: number,
): TimelineState => {
  const byId = new Map<string, ClipState>();
  for (const clip of script.clips) {
    byId.set(clip.id, { ...clip, selected: 0, trimming: 0, dragging: 0 });
  }

  let tooltip: TooltipState = null;
  let marquee: MarqueeState = null;
  let hotRange: [number, number] | null = null;

  const trackOf = (id: string) => script.tracks.find((t) => t.id === id);

  for (const event of script.events) {
    switch (event.kind) {
      case "cut": {
        if (frame < event.at) break;
        const source = byId.get(event.clipId);
        if (!source) break;
        byId.delete(event.clipId);
        byId.set(`${event.clipId}a`, {
          ...source,
          id: `${event.clipId}a`,
          duration: event.offset,
        });
        byId.set(`${event.clipId}b`, {
          ...source,
          id: `${event.clipId}b`,
          start: source.start + event.offset,
          duration: source.duration - event.offset,
          badges: (source.badges + 1) % 3,
        });
        break;
      }
      case "move": {
        const clip = byId.get(event.clipId);
        if (!clip) break;
        const t = progress(frame, event.from, event.to);
        if (t === 0) break;
        clip.start += event.deltaStart * t;
        clip.dragging = frame <= event.to ? 1 : 0;
        if (event.toTrack && t > 0.5) clip.track = event.toTrack;
        if (frame >= event.from && frame <= event.to) {
          const track = trackOf(clip.track);
          tooltip = {
            text: `${formatTimecode(event.deltaStart * t)}  Shift`,
            x: TRACK_X0 + clip.start * PX_PER_SECOND + 14,
            y: (track?.y ?? 0) + (track?.height ?? 0) + 14,
            opacity: 1,
          };
        }
        break;
      }
      case "trim": {
        const clip = byId.get(event.clipId);
        if (!clip) break;
        const t = progress(frame, event.from, event.to);
        if (t === 0) break;
        const delta = event.delta * t;
        if (event.edge === "start") {
          clip.start += delta;
          clip.duration -= delta;
        } else {
          clip.duration += delta;
        }
        clip.trimming = pulse(frame, event.from, event.to);
        if (frame >= event.from && frame <= event.to) {
          const track = trackOf(clip.track);
          tooltip = {
            text: `${formatTimecode(delta)}  Duration: ${formatTimecode(
              clip.duration,
            ).slice(1)}`,
            x:
              TRACK_X0 +
              (clip.start + (event.edge === "end" ? clip.duration : 0)) *
                PX_PER_SECOND +
              10,
            y: (track?.y ?? 0) + (track?.height ?? 0) + 12,
            opacity: 1,
          };
        }
        break;
      }
      case "remove": {
        if (frame < event.at) break;
        const clip = byId.get(event.clipId);
        if (!clip) break;
        byId.delete(event.clipId);
        if (event.ripple) {
          const gap = clip.duration;
          for (const other of byId.values()) {
            if (other.track === clip.track && other.start >= clip.start) {
              other.start -= gap;
            }
          }
        }
        break;
      }
      case "select": {
        const amount = pulse(frame, event.from, event.to);
        if (amount <= 0) break;
        for (const id of event.clipIds) {
          const clip = byId.get(id);
          if (clip) {
            clip.selected = Math.max(clip.selected, amount);
            if (!hotRange) {
              hotRange = [clip.start, clip.start + clip.duration];
            } else {
              hotRange = [
                Math.min(hotRange[0], clip.start),
                Math.max(hotRange[1], clip.start + clip.duration),
              ];
            }
          }
        }
        break;
      }
      case "marquee": {
        if (frame < event.from || frame > event.to + 6) break;
        const t = progress(frame, event.from, event.to);
        const [x0, y0, x1, y1] = event.rect;
        marquee = {
          x: Math.min(x0, x0 + (x1 - x0) * t),
          y: Math.min(y0, y0 + (y1 - y0) * t),
          width: Math.abs((x1 - x0) * t),
          height: Math.abs((y1 - y0) * t),
          opacity: frame > event.to ? 1 - (frame - event.to) / 6 : 1,
        };
        break;
      }
      case "insert": {
        if (frame < event.at) break;
        byId.set(event.clip.id, {
          ...event.clip,
          selected: 0,
          trimming: 0,
          dragging: 0,
        });
        break;
      }
    }
  }

  return {
    clips: [...byId.values()].filter((c) => c.duration > 0.01),
    tooltip,
    marquee,
    hotRange,
  };
};

// --- cursor ----------------------------------------------------------

export const cursorAt = (
  keys: CursorKey[],
  frame: number,
): { x: number; y: number; tool: CursorTool } => {
  if (keys.length === 0) return { x: 0, y: 0, tool: "pointer" };
  if (frame <= keys[0].frame)
    return { x: keys[0].x, y: keys[0].y, tool: keys[0].tool ?? "pointer" };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const t = easeInOut((frame - a.frame) / Math.max(1, b.frame - a.frame));
      // A real hand never travels in a straight line; bow the path
      // slightly perpendicular to its direction, sign alternating per
      // segment so successive moves don't all arc the same way.
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const bow = Math.sin(t * Math.PI) * (i % 2 === 0 ? 0.06 : -0.06);
      return {
        x: a.x + dx * t - dy * bow,
        y: a.y + dy * t + dx * bow,
        tool: (t < 0.5 ? a.tool : b.tool) ?? a.tool ?? "pointer",
      };
    }
  }
  const last = keys[keys.length - 1];
  return { x: last.x, y: last.y, tool: last.tool ?? "pointer" };
};

/** 1 for a few frames after a click, easing out - drives the click ring. */
export const clickPulse = (clicks: number[], frame: number) => {
  let best = 0;
  for (const c of clicks) {
    if (frame >= c && frame < c + 10) {
      best = Math.max(best, 1 - (frame - c) / 10);
    }
  }
  return best;
};

// --- keyframe helper -------------------------------------------------

export const sampleKeys = (
  keys: { frame: number; seconds: number }[],
  frame: number,
) => {
  if (keys.length === 0) return 0;
  if (frame <= keys[0].frame) return keys[0].seconds;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const t = (frame - a.frame) / Math.max(1, b.frame - a.frame);
      return a.seconds + (b.seconds - a.seconds) * t;
    }
  }
  return keys[keys.length - 1].seconds;
};

// --- waveform --------------------------------------------------------

/**
 * Deterministic audio envelope for the music track, sampled in seconds.
 * Layered slow/fast components so it reads as real music rather than
 * uniform noise: a bar-level swell, a beat transient, and grain.
 */
export const waveformAmplitude = (seconds: number, seed: number) => {
  // Slow swell (phrase level) x dense per-sample grain, plus a sparse
  // transient. Real music waveforms are mostly grain riding an
  // envelope; leaning on the periodic term instead makes an obviously
  // synthetic comb pattern once it is magnified this far.
  const phrase = 0.5 + 0.26 * Math.sin(seconds * 0.31 + seed * 0.7);
  const swell = 0.5 + 0.22 * Math.sin(seconds * 1.13 + seed);
  const grain = seeded(Math.round(seconds * 420), seed) * 0.8;
  const fine = seeded(Math.round(seconds * 1400), seed + 7) * 0.45;
  const transient =
    seeded(Math.round(seconds * 4.2), seed + 19) > 0.88 ? 0.28 : 0;
  return Math.min(
    1,
    phrase * swell * (0.42 + grain + fine) * 1.9 + transient,
  );
};

/**
 * Plausible filler clips for the far end of the timeline. The authored
 * script only choreographs the part of the edit the lens can resolve;
 * everything past that still has to be there, because a panel that runs
 * out of content mid-frame reads as a set rather than a session.
 */
export const fillerClips = (
  track: string,
  fromSeconds: number,
  toSeconds: number,
  seed: number,
  color: Clip["color"] = "cyan",
  prefix = "f",
): Clip[] => {
  const out: Clip[] = [];
  let t = fromSeconds;
  let i = 0;
  while (t < toSeconds) {
    const duration = 0.7 + seeded(i, seed) * 3.4;
    const gap = seeded(i, seed + 5) > 0.78 ? 0.3 + seeded(i, seed + 9) * 1.6 : 0.06;
    out.push({
      id: `${prefix}${track}${i}`,
      track,
      start: t,
      duration: Math.min(duration, toSeconds - t),
      color,
      label: `${prefix.toUpperCase()}_${1000 + Math.round(seeded(i, seed + 13) * 800)}`,
      badges: seeded(i, seed + 17) > 0.55 ? 2 : 1,
    });
    t += duration + gap;
    i += 1;
  }
  return out;
};
