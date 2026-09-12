import { PX_PER_SECOND, TRACK_X0 } from "./constants";
import {
  Clip,
  EditEvent,
  Track,
  TimelineScript,
  CursorKey,
  fillerClips,
} from "./model";

// Variant A: the reference framing. Two video tracks stacked over a tall
// music track, camera on the left, and an edit session that builds the
// way a real one does - lay the takes down, razor them into beats, trim,
// marquee, ripple-delete, then play the result back.

// Two video tracks over a stack of music/FX beds. The beds run deep:
// the camera's near side magnifies ~1.8x, so the panel has to keep
// giving content all the way down or the bottom of the frame falls off
// into empty black.
const TRACKS: Track[] = [
  { id: "V2", kind: "video", name: "V2", y: 130, height: 94 },
  { id: "V1", kind: "video", name: "V1", y: 294, height: 116 },
  { id: "A1", kind: "audio", name: "A1", y: 408, height: 262 },
  { id: "A2", kind: "audio", name: "A2", y: 700, height: 190 },
  { id: "A3", kind: "audio", name: "A3", y: 920, height: 150 },
];

const clip = (
  id: string,
  track: string,
  start: number,
  duration: number,
  label: string,
  color: Clip["color"] = "cyan",
  badges = 1,
): Clip => ({ id, track, start, duration, label, color, badges });

const CLIPS: Clip[] = [
  clip("v2a", "V2", 0.6, 3.0, "GRADE_02", "violet", 1),
  clip("v2b", "V2", 3.8, 4.3, "MVI_1147", "cyan", 2),
  clip("v2c", "V2", 8.6, 2.9, "MVI_1152", "cyan", 1),
  clip("v2d", "V2", 12.1, 5.0, "MVI_1160", "cyan", 2),
  clip("v2e", "V2", 17.6, 4.1, "B_ROLL_07", "cyan", 1),
  clip("v2f", "V2", 22.4, 6.2, "MVI_1168", "cyan", 2),

  clip("s1", "V1", 0.0, 6.4, "A004_C012", "cyan", 1),
  clip("s2", "V1", 6.6, 7.1, "A004_C013", "cyan", 2),
  clip("s3", "V1", 14.0, 5.9, "A004_C018", "cyan", 1),
  clip("s4", "V1", 20.2, 8.3, "A004_C021", "cyan", 2),
  clip("s5", "V1", 28.8, 5.4, "A004_C024", "cyan", 1),

  // Far field: the rest of the assembly, well past the focal plane.
  ...fillerClips("V2", 29.4, 96, 811, "cyan", "r"),
  ...fillerClips("V1", 34.6, 96, 907, "cyan", "q"),
];

// Razor pass. Each cut names the half produced by the previous one, so
// the chain reads top-to-bottom as the editor walking right along the
// track chopping it into beats.
const razor: EditEvent[] = [
  { kind: "cut", at: 156, clipId: "s2", offset: 1.5 },
  { kind: "cut", at: 186, clipId: "s2b", offset: 1.2 },
  { kind: "cut", at: 214, clipId: "s2bb", offset: 0.9 },
  { kind: "cut", at: 246, clipId: "s2bbb", offset: 1.4 },
  { kind: "cut", at: 278, clipId: "s2bbbb", offset: 0.8 },
  { kind: "cut", at: 312, clipId: "s3", offset: 1.1 },
  { kind: "cut", at: 340, clipId: "s3b", offset: 1.3 },
  { kind: "cut", at: 368, clipId: "s3bb", offset: 0.7 },
  { kind: "cut", at: 398, clipId: "s3bbb", offset: 1.0 },
  { kind: "cut", at: 430, clipId: "s4", offset: 1.6 },
  { kind: "cut", at: 462, clipId: "s4b", offset: 1.1 },
  { kind: "cut", at: 492, clipId: "s4bb", offset: 2.0 },
];

const EVENTS: EditEvent[] = [
  ...razor,

  // Audition the cut: select one beat, its music underneath lights up.
  { kind: "select", from: 560, to: 660, clipIds: ["s2bba"] },

  // Trim the tail of that beat in, with the duration tooltip up.
  { kind: "trim", from: 690, to: 780, clipId: "s2bba", edge: "end", delta: 0.55 },
  { kind: "select", from: 690, to: 800, clipIds: ["s2bba"] },

  // Marquee a run of short clips further right...
  {
    kind: "marquee",
    from: 850,
    to: 935,
    rect: [TRACK_X0 + 13.4 * PX_PER_SECOND, 196, TRACK_X0 + 19.6 * PX_PER_SECOND, 352],
  },
  { kind: "select", from: 930, to: 1010, clipIds: ["s3a", "s3ba", "s3bba"] },

  // ...and ripple-delete two of them, pulling the rest of the track left.
  { kind: "remove", at: 1015, clipId: "s3ba", ripple: true },
  { kind: "remove", at: 1048, clipId: "s3bba", ripple: true },

  // Drag a B-roll clip up the timeline to fill the hole.
  { kind: "move", from: 1105, to: 1210, clipId: "v2e", deltaStart: -3.3 },
  { kind: "select", from: 1105, to: 1250, clipIds: ["v2e"] },

  // Final trim, on a clip inside the focal band so the tooltip reads.
  { kind: "trim", from: 1285, to: 1360, clipId: "v2d", edge: "end", delta: 0.9 },
  { kind: "select", from: 1400, to: 1500, clipIds: ["s4a"] },
];

// The panel's resting scroll. The pointer is authored in edit seconds
// and converted here, so cursor and clips stay locked to each other -
// without subtracting the scroll the pointer drifts off the clip it is
// supposed to be operating on.
const BASE_SCROLL = 0;

const x = (seconds: number) =>
  TRACK_X0 + (seconds - BASE_SCROLL) * PX_PER_SECOND;

const CURSOR: CursorKey[] = [
  { frame: 0, x: x(24.5), y: 700, tool: "pointer" },
  { frame: 90, x: x(7.0), y: 340, tool: "pointer" },
  { frame: 140, x: x(8.1), y: 292, tool: "razor" },
  // walk right along V1, one pause per razor cut
  { frame: 156, x: x(8.1), y: 292, tool: "razor" },
  { frame: 186, x: x(9.3), y: 298, tool: "razor" },
  { frame: 214, x: x(10.2), y: 330, tool: "razor" },
  { frame: 246, x: x(11.6), y: 340, tool: "razor" },
  { frame: 278, x: x(12.4), y: 292, tool: "razor" },
  { frame: 312, x: x(15.1), y: 340, tool: "razor" },
  { frame: 340, x: x(16.4), y: 294, tool: "razor" },
  { frame: 368, x: x(17.1), y: 302, tool: "razor" },
  { frame: 398, x: x(18.1), y: 292, tool: "razor" },
  { frame: 430, x: x(21.8), y: 340, tool: "razor" },
  { frame: 462, x: x(22.9), y: 292, tool: "razor" },
  { frame: 492, x: x(24.9), y: 302, tool: "razor" },
  { frame: 540, x: x(10.4), y: 318, tool: "pointer" },
  { frame: 600, x: x(10.6), y: 330, tool: "pointer" },
  { frame: 686, x: x(11.2), y: 316, tool: "trim" },
  { frame: 780, x: x(11.8), y: 316, tool: "trim" },
  { frame: 830, x: x(13.4), y: 244, tool: "pointer" },
  { frame: 935, x: x(19.6), y: 378, tool: "pointer" },
  { frame: 1000, x: x(16.2), y: 326, tool: "pointer" },
  { frame: 1060, x: x(16.0), y: 326, tool: "pointer" },
  { frame: 1100, x: x(18.2), y: 176, tool: "hand" },
  { frame: 1210, x: x(14.9), y: 176, tool: "hand" },
  { frame: 1270, x: x(17.1), y: 176, tool: "trim" },
  { frame: 1360, x: x(18.0), y: 176, tool: "trim" },
  { frame: 1410, x: x(21.4), y: 304, tool: "pointer" },
  { frame: 1470, x: x(21.6), y: 314, tool: "pointer" },
  { frame: 1564, x: x(23.9), y: 340, tool: "pointer" },
];

const CLICKS = [
  156, 186, 214, 246, 278, 312, 340, 368, 398, 430, 462, 492, 560, 690, 850,
  1015, 1048, 1105, 1285, 1400,
];

export const SCRIPT_A: TimelineScript = {
  tracks: TRACKS,
  clips: CLIPS,
  events: EVENTS,
  cursor: CURSOR,
  clicks: CLICKS,
  playhead: [
    { frame: 0, seconds: 10.4 },
    { frame: 140, seconds: 10.4 },
    { frame: 520, seconds: 12.8 },
    { frame: 660, seconds: 10.6 },
    { frame: 840, seconds: 11.4 },
    { frame: 1060, seconds: 16.2 },
    { frame: 1300, seconds: 4.1 },
    { frame: 1564, seconds: 22.6 },
  ],
  scroll: [
    { frame: BASE_SCROLL, seconds: BASE_SCROLL },
    { frame: 1240, seconds: BASE_SCROLL },
    // Only the closing playback pass scrolls the panel, and the pointer
    // is parked on screen-anchored chrome by then.
    { frame: 1564, seconds: BASE_SCROLL + 4.6 },
  ],
  rubberBand: [{ track: "A1", level: 0.2 }],
  seed: 1907,
};
