import { PX_PER_SECOND, TRACK_X0 } from "./constants";
import {
  Clip,
  EditEvent,
  Track,
  TimelineScript,
  CursorKey,
  fillerClips,
} from "./model";

// Variant B: same room, different setup. The panel is re-stacked with
// the music bed on top and three video layers beneath it (a compositing
// stack rather than an A/B roll), the lens is on the other side of the
// monitor, and the session is a different kind of work - scrubbing,
// moving clips between layers and nudging, instead of a razor pass.

// B's panel is stacked the other way up: the music bed sits on top,
// three video layers run beneath it, and the FX beds close the stack -
// a compositing session rather than A's A/B-roll assembly.
const TRACKS: Track[] = [
  { id: "A1", kind: "audio", name: "A1", y: 96, height: 244 },
  { id: "V1", kind: "video", name: "V1", y: 380, height: 116 },
  { id: "V2", kind: "video", name: "V2", y: 524, height: 116 },
  { id: "V3", kind: "video", name: "V3", y: 668, height: 98 },
  { id: "A2", kind: "audio", name: "A2", y: 812, height: 250 },
  { id: "A3", kind: "audio", name: "A3", y: 1092, height: 160 },
];

// B's camera looks down the timeline from the other end, so the far
// half of its frame is earlier material. The authored session therefore
// sits well into the edit, with generated assembly running back past it
// toward 00:00 - otherwise the far side of the shot is bare panel.
const OFFSET = 46;

const clip = (
  id: string,
  track: string,
  start: number,
  duration: number,
  label: string,
  color: Clip["color"] = "cyan",
  badges = 1,
): Clip => ({
  id,
  track,
  start: start + OFFSET,
  duration,
  label,
  color,
  badges,
});

const CLIPS: Clip[] = [
  // V1 - the cut itself, already chopped fine when we join the session.
  clip("p1", "V1", 0.3, 1.9, "C0021", "cyan", 1),
  clip("p2", "V1", 2.4, 1.4, "C0022", "cyan", 2),
  clip("p3", "V1", 4.0, 2.6, "C0027", "cyan", 1),
  clip("p4", "V1", 6.8, 1.2, "C0031", "cyan", 2),
  clip("p5", "V1", 8.2, 3.1, "C0034", "cyan", 1),
  clip("p6", "V1", 11.5, 1.6, "C0039", "cyan", 2),
  clip("p7", "V1", 13.3, 2.2, "C0042", "cyan", 1),
  clip("p8", "V1", 15.7, 4.0, "C0048", "cyan", 2),
  clip("p9", "V1", 19.9, 2.4, "C0051", "cyan", 1),
  clip("p10", "V1", 22.5, 3.6, "C0056", "cyan", 2),

  // V2 - graded/titled overlays sitting above the cut.
  clip("g1", "V2", 1.2, 3.4, "LUT_TEAL", "violet", 1),
  clip("g2", "V2", 5.6, 2.2, "TITLE_03", "violet", 2),
  clip("g3", "V2", 9.4, 4.8, "LUT_TEAL", "violet", 1),
  clip("g4", "V2", 15.0, 2.6, "LOWER_3RD", "violet", 2),
  clip("g5", "V2", 18.6, 5.4, "LUT_WARM", "violet", 1),

  // V3 - mattes and adjustment layers, deliberately duller.
  clip("m1", "V3", 0.0, 6.2, "ADJ_GRAIN", "steel", 1),
  clip("m2", "V3", 7.0, 5.4, "MATTE_01", "steel", 2),
  clip("m3", "V3", 13.2, 8.0, "ADJ_SHARP", "steel", 1),
  clip("m4", "V3", 21.8, 4.6, "MATTE_02", "steel", 2),

  // Assembly running back toward the head of the timeline (the far
  // half of B's frame) and on past the session (the near edge).
  ...fillerClips("V1", 0, OFFSET - 0.4, 331, "cyan", "h"),
  ...fillerClips("V2", 0, OFFSET - 1.6, 457, "violet", "i"),
  ...fillerClips("V3", 0, OFFSET - 0.9, 613, "steel", "j"),
  ...fillerClips("V1", OFFSET + 26.4, 104, 733, "cyan", "q"),
  ...fillerClips("V2", OFFSET + 24.2, 104, 859, "violet", "r"),
  ...fillerClips("V3", OFFSET + 26.6, 104, 971, "steel", "t"),
];

// See script-a: pointer keys are authored in edit seconds and converted
// against the panel's resting scroll so they track the clips.
const BASE_SCROLL = 0;

/** Pointer keys are authored in session-relative seconds, like the clips. */
const x = (seconds: number) =>
  TRACK_X0 + (seconds + OFFSET - BASE_SCROLL) * PX_PER_SECOND;

const EVENTS: EditEvent[] = [
  // Nudge a pair of cuts tighter while scrubbing.
  { kind: "select", from: 48, to: 92, clipIds: ["p3"] },
  { kind: "trim", from: 56, to: 88, clipId: "p3", edge: "start", delta: 0.45 },

  // Lift an overlay off V2 and drop it a layer down onto V3.
  { kind: "select", from: 112, to: 186, clipIds: ["g2"] },
  { kind: "move", from: 120, to: 176, clipId: "g2", deltaStart: 1.8, toTrack: "V3" },

  // A run of quick alternating nudges - the fiddly part of any session.
  { kind: "move", from: 200, to: 226, clipId: "p5", deltaStart: -0.35 },
  { kind: "select", from: 196, to: 238, clipIds: ["p5"] },
  { kind: "move", from: 244, to: 270, clipId: "p6", deltaStart: -0.4 },
  { kind: "select", from: 240, to: 282, clipIds: ["p6"] },
  { kind: "move", from: 288, to: 314, clipId: "p7", deltaStart: -0.5 },
  { kind: "select", from: 284, to: 326, clipIds: ["p7"] },

  // Razor, but working right to left back through the tail.
  { kind: "cut", at: 340, clipId: "p10", offset: 1.4 },
  { kind: "cut", at: 362, clipId: "p10a", offset: 0.6 },
  { kind: "cut", at: 384, clipId: "p9", offset: 1.1 },
  { kind: "cut", at: 406, clipId: "p8", offset: 2.3 },
  { kind: "cut", at: 428, clipId: "p8a", offset: 1.0 },
  { kind: "cut", at: 450, clipId: "p8b", offset: 0.7 },

  // Sweep a tall marquee down through all three video layers at once.
  {
    kind: "marquee",
    from: 478,
    to: 532,
    rect: [x(15.2), 372, x(21.0), 800],
  },
  { kind: "select", from: 528, to: 566, clipIds: ["p8a", "p8ba", "m3", "g5"] },
  { kind: "remove", at: 570, clipId: "p8ba", ripple: true },

  // Stretch the closing overlay out over the new tail.
  { kind: "trim", from: 590, to: 636, clipId: "g5", edge: "end", delta: 1.9 },
  { kind: "select", from: 586, to: 650, clipIds: ["g5"] },
  { kind: "select", from: 652, to: 659, clipIds: ["m4"] },
];

// Variant B's pointer behaves differently from A's: long horizontal
// scrubs along the ruler, deliberate vertical hops between layers, and
// a drag across layers, instead of A's steady left-to-right walk.
const CURSOR: CursorKey[] = [
  { frame: 0, x: x(1.2), y: 60, tool: "pointer" },
  { frame: 44, x: x(17.4), y: 52, tool: "pointer" },
  { frame: 56, x: x(4.1), y: 416, tool: "trim" },
  { frame: 88, x: x(4.6), y: 416, tool: "trim" },
  { frame: 112, x: x(6.2), y: 560, tool: "pointer" },
  { frame: 120, x: x(6.2), y: 560, tool: "hand" },
  { frame: 176, x: x(8.0), y: 704, tool: "hand" },
  { frame: 196, x: x(9.4), y: 434, tool: "pointer" },
  { frame: 226, x: x(9.0), y: 434, tool: "pointer" },
  { frame: 244, x: x(12.0), y: 422, tool: "pointer" },
  { frame: 270, x: x(11.6), y: 422, tool: "pointer" },
  { frame: 288, x: x(13.9), y: 436, tool: "pointer" },
  { frame: 314, x: x(13.4), y: 436, tool: "pointer" },
  { frame: 334, x: x(24.2), y: 404, tool: "razor" },
  { frame: 340, x: x(23.9), y: 404, tool: "razor" },
  { frame: 362, x: x(22.6), y: 414, tool: "razor" },
  { frame: 384, x: x(21.0), y: 404, tool: "razor" },
  { frame: 406, x: x(18.0), y: 416, tool: "razor" },
  { frame: 428, x: x(16.8), y: 404, tool: "razor" },
  { frame: 450, x: x(16.1), y: 414, tool: "razor" },
  { frame: 478, x: x(15.2), y: 372, tool: "pointer" },
  { frame: 532, x: x(21.0), y: 790, tool: "pointer" },
  { frame: 556, x: x(18.4), y: 580, tool: "pointer" },
  { frame: 578, x: x(18.1), y: 580, tool: "pointer" },
  { frame: 596, x: x(23.8), y: 548, tool: "trim" },
  { frame: 636, x: x(25.6), y: 548, tool: "trim" },
  { frame: 652, x: x(22.4), y: 706, tool: "pointer" },
  { frame: 659, x: x(21.9), y: 716, tool: "pointer" },
];

const CLICKS = [
  44, 56, 112, 120, 200, 244, 288, 340, 362, 384, 406, 428, 450, 478, 570, 590,
  652,
];

export const SCRIPT_B: TimelineScript = {
  tracks: TRACKS,
  clips: CLIPS,
  events: EVENTS,
  cursor: CURSOR,
  clicks: CLICKS,
  // B scrubs: the playhead is dragged around by hand far more than it
  // plays, which is the other half of "different cursor motion".
  playhead: [
    { frame: 0, seconds: OFFSET + 1.2 },
    { frame: 44, seconds: OFFSET + 17.4 },
    { frame: 88, seconds: OFFSET + 17.4 },
    { frame: 120, seconds: OFFSET + 6.4 },
    { frame: 200, seconds: OFFSET + 9.3 },
    { frame: 334, seconds: OFFSET + 24.1 },
    { frame: 478, seconds: OFFSET + 15.4 },
    { frame: 560, seconds: OFFSET + 11.2 },
    { frame: 659, seconds: OFFSET + 20.4 },
  ],
  // See script-a: held still, because every beat here is anchored to a
  // clip the pointer is working on.
  scroll: [
    { frame: 0, seconds: BASE_SCROLL },
    { frame: 659, seconds: BASE_SCROLL },
  ],
  rubberBand: [
    { track: "A1", level: 0.78 },
    { track: "V3", level: 0.4 },
  ],
  seed: 4231,
};
