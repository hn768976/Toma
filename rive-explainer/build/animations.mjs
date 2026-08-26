import { P, W, H, FPS, SCENES, kf, track, DEPTH, cameraTracks } from "./lib.mjs";

const KEYS = "ABCDEF".split("");
// Entrances scale from 0.7 and settle; nothing arrives and stops dead.
const IN = "ease-out-back", OUT = "emphasized-accel", DEC = "emphasized-decel", SM = "ease-in-out";

// opacity fade helper
const fade = (id, a, b, from, to, easing = SM) =>
  track(id, "opacity", [kf(a, from, "hold"), kf(b, to, easing)]);

// scale-from helper: settles at `base` with overshoot
const popScale = (id, a, b, base, from = 0.7, easing = IN) => [
  track(id, "scaleX", [kf(a, base * from, "hold"), kf(b, base, easing)]),
  track(id, "scaleY", [kf(a, base * from, "hold"), kf(b, base, easing)]),
];

// Every scene asserts the visibility of every scene group at frame 0, so the
// timelines stay independent of each other's end state.
function visReset(key, extra = {}) {
  const t = [];
  for (const k of KEYS) t.push(track(`s${k}`, "opacity", [kf(0, k === key ? 1 : 0, "hold")]));
  for (const k of KEYS) t.push(track(`glow${k}`, "opacity", [kf(0, k === key ? 1 : 0, "hold")]));
  for (const k of KEYS) t.push(track(`cap${k}`, "opacity", [kf(0, k === key ? 0 : 0, "hold")]));
  t.push(track(`cap${key}`, "opacity", [kf(0, 0, "hold"), kf(10, 1, SM)]));
  for (const [id, v] of Object.entries(extra)) t.push(track(id, "opacity", [kf(0, v, "hold")]));
  return t;
}

const camera = (scene) => [
  ...cameraTracks("camFar", scene.start, scene.len, DEPTH.far),
  ...cameraTracks("camMid", scene.start, scene.len, DEPTH.mid),
  ...cameraTracks("camNear", scene.start, scene.len, DEPTH.near),
];

const bgTo = (color, len) => [track("bgField", "fillColor", [
  { frame: 0, color, easing: "hold" }, { frame: len, color }])];

export function buildAnimations() {
  const A = {};
  const S = Object.fromEntries(SCENES.map((s) => [s.name, s]));

  // ======================================================== A_Test =========
  {
    const s = S.A_Test, t = [];
    t.push(...visReset("A", { deskWrap: 0 }), ...camera(s), ...bgTo(P.bg, s.len));
    // "your hearing" — the ear blooms in, halo behind it
    t.push(fade("earWrapA", 4, 20, 0, 1), ...popScale("earWrapA", 4, 26, 1.9, 0.7));
    t.push(fade("haloA", 10, 30, 0, 0.85), ...popScale("haloA", 10, 34, 1, 0.55, DEC));
    t.push(track("haloA", "opacity", [kf(10, 0, "hold"), kf(30, 0.85, DEC), kf(60, 0.45, SM)]));
    // "is fine" — checkmark pops top-right, FINE rises under it
    t.push(fade("checkA", 30, 44, 0, 1), ...popScale("checkA", 30, 48, 1, 0.6));
    t.push(fade("fineA", 36, 52, 0, 1),
           track("fineA", "y", [kf(36, 345, "hold"), kf(54, 330, DEC)]));
    // "passed the test" — the character rises from below and settles with a bob
    t.push(fade("heroWrapA", 58, 72, 0, 1));
    t.push(track("heroWrapA", "y", [
      kf(58, 800 - 262 * 1.6837 + 170, "hold"),
      kf(80, 800 - 262 * 1.6837 - 12, DEC),
      kf(94, 800 - 262 * 1.6837, "ease-in-out")]));
    // "the headphones" — they drop onto the EXISTING head and squash on landing
    t.push(fade("hpA", 88, 96, 0, 1));
    t.push(track("hpA", "y", [kf(88, 470 - 200, "hold"), kf(102, 470, "ease-in")]));
    t.push(track("hpA", "scaleY", [kf(102, 1, "hold"), kf(106, 0.78, "ease-out"), kf(116, 1, IN)]));
    t.push(track("hpA", "scaleX", [kf(102, 1, "hold"), kf(106, 1.18, "ease-out"), kf(116, 1, IN)]));
    // "the little button" — coral button at the hand, one pulse
    t.push(fade("btnA", 112, 122, 0, 1), fade("btnAi", 112, 122, 0, 1));
    for (const id of ["btnA", "btnAi"]) {
      t.push(...popScale(id, 112, 126, 1, 0.5));
      t.push(track(id, "scaleX", [kf(126, 1, "hold"), kf(134, 1.22, "ease-out"), kf(146, 1, IN)]));
      t.push(track(id, "scaleY", [kf(126, 1, "hold"), kf(134, 1.22, "ease-out"), kf(146, 1, IN)]));
    }
    // "beeps" — mint arcs pulse outward from the headphones on a 0.8s loop
    for (let i = 0; i < 3; i++) {
      const o = 128 + i * 6, cyc = 24, ko = [], ks = [];
      for (let c = 0; o + c * cyc < s.len; c++) {
        const b = o + c * cyc;
        ko.push(kf(b, 0, "hold"), kf(b + 7, 0.85, "ease-out"), kf(b + cyc - 2, 0, SM));
        ks.push(kf(b, 0.72, "hold"), kf(b + cyc - 2, 1.12, "ease-out"));
      }
      t.push(track(`beepA${i}`, "opacity", ko), track(`beepA${i}`, "scaleX", ks),
             track(`beepA${i}`, "scaleY", ks.map((k) => ({ ...k }))));
    }
    A.A_Test = { name: "A_Test", fps: FPS, duration: s.len, loop: "oneShot", tracks: t };
  }

  // ==================================================== B_NoMemory =========
  {
    const s = S.B_NoMemory, t = [];
    t.push(...visReset("B", { deskWrap: 0 }), ...camera(s), ...bgTo(P.bgViolet, s.len));
    // amber wipe in, 12 frames
    t.push(track("wipeB", "opacity", [kf(0, 1, "hold"), kf(24, 1, "hold"), kf(25, 0, "hold")]));
    t.push(track("wipeB", "x", [kf(0, -1150, "hold"), kf(11, 960, "ease-in-out"), kf(24, 3070, "ease-in")]));
    // "somebody has said" — the speaker slides in
    t.push(fade("speakWrapB", 14, 28, 0, 1));
    t.push(track("speakWrapB", "x", [kf(14, 560 - 100 * 1.5816 - 260, "hold"),
                                     kf(32, 560 - 100 * 1.5816, DEC)]));
    t.push(fade("listenWrapB", 16, 32, 0, 1));
    // the bubble scales from its tail
    t.push(fade("bubWrapB", 26, 38, 0, 1), ...popScale("bubWrapB", 26, 46, 1.15, 0.45));
    // "three times" — three tallies pop ONE AT A TIME, 8 frames apart
    for (let i = 0; i < 3; i++) {
      const b = 55 + i * 8;
      t.push(fade(`tallyB${i}`, b, b + 6, 0, 1));
      t.push(track(`tallyB${i}`, "scaleY", [kf(b, 0.3, "hold"), kf(b + 12, 1, IN)]));
      t.push(track(`tallyB${i}`, "scaleX", [kf(b, 1.3, "hold"), kf(b + 12, 1, IN)]));
    }
    // "in the last minute" — the clock sweeps once
    t.push(fade("clockB", 85, 98, 0, 1), ...popScale("clockB", 85, 102, 1, 0.6));
    t.push(track("clockHandM", "rotation", [kf(88, 0, "hold"), kf(112, 360, "ease-in-out")]));
    // "no memory of any" — the bubble drops back but STAYS VISIBLE
    t.push(track("bubWrapB", "opacity", [kf(100, 1, "hold"), kf(114, 0.38, SM)]));
    // the memory slot scales in and stays EMPTY for the rest of the scene
    t.push(fade("skullB", 122, 136, 0, 0.9), ...popScale("skullB", 122, 140, 1, 0.7, DEC));
    t.push(fade("memB", 130, 144, 0, 1), ...popScale("memB", 130, 148, 1, 0.5));
    // "not ignored" — coral bar sweeps across as a strikethrough
    t.push(fade("notIgnB", 145, 158, 0, 1));
    t.push(track("strikeB", "width", [kf(152, 0, "hold"), kf(168, 470, DEC)]));
    // "no memory" — two coral underline bars, 4 frames apart
    t.push(fade("noMemB", 165, 178, 0, 1));
    t.push(fade("ulB0", 178, 186, 0, 1), fade("ulB1", 182, 190, 0, 1));
    t.push(track("ulB0", "width", [kf(178, 0, "hold"), kf(190, 380, DEC)]));
    t.push(track("ulB1", "width", [kf(182, 0, "hold"), kf(194, 380, DEC)]));
    A.B_NoMemory = { name: "B_NoMemory", fps: FPS, duration: s.len, loop: "oneShot", tracks: t };
  }

  // ======================================================= C_Crowd =========
  {
    const s = S.C_Crowd, t = [];
    t.push(...visReset("C", { deskWrap: 0 }), ...camera(s), ...bgTo(P.bgTeal, s.len));
    // "where does the sound go" — the ribbon travels speaker -> listener
    t.push(fade("ribC", 2, 12, 0, 1));
    t.push(track("ribC", "x", [kf(2, 600, "hold"), kf(26, 1150, "ease-in-out")]));
    // the coral X SNAPS on in 3 frames — the only hard cut in the piece
    t.push(track("xC0", "opacity", [kf(28, 0, "hold"), kf(31, 1, "linear")]));
    t.push(track("xC1", "opacity", [kf(28, 0, "hold"), kf(31, 1, "linear")]));
    // "?" scales in with a rotation settle, and STAYS as the crowd fills in
    t.push(fade("qC", 40, 52, 0, 1), ...popScale("qC", 40, 58, 1, 0.5));
    t.push(track("qC", "rotation", [kf(40, -14, "hold"), kf(58, 5, "ease-out"), kf(70, 0, IN)]));
    // "more than one person" — six listeners, 4 frames apart, each with a ribbon
    for (let i = 0; i < 6; i++) {
      const b = 60 + i * 4;
      t.push(fade(`crowdW${i}`, b, b + 8, 0, 1));
      const sc = (CROWD_S[i]);
      t.push(track(`crowdW${i}`, "scaleX", [kf(b, sc * 0.6, "hold"), kf(b + 14, sc, IN)]));
      t.push(track(`crowdW${i}`, "scaleY", [kf(b, sc * 0.6, "hold"), kf(b + 14, sc, IN)]));
      t.push(fade(`crowdRib${i}`, b + 6, b + 16, 0, 0.85));
    }
    // "in the room" — the room closes around them
    t.push(fade("roomC", 105, 120, 0, 0.9), ...popScale("roomC", 105, 128, 1, 0.86, DEC));
    A.C_Crowd = { name: "C_Crowd", fps: FPS, duration: s.len, loop: "oneShot", tracks: t };
  }

  // ======================================================== D_Desk =========
  {
    const s = S.D_Desk, t = [];
    // The crowd is still on screen at the top of D so it can scale down and go.
    t.push(...visReset("D", { deskWrap: 0 }), ...camera(s), ...bgTo(P.bgMid, s.len));
    t.push(track("sC", "opacity", [kf(0, 1, "hold"), kf(16, 0, OUT)]));
    t.push(track("sC", "scaleX", [kf(0, 1, "hold"), kf(16, 0.82, OUT)]));
    t.push(track("sC", "scaleY", [kf(0, 1, "hold"), kf(16, 0.82, OUT)]));
    // "look at the mixing desk" — it arrives SLOWLY, with weight
    t.push(fade("deskWrap", 16, 34, 0, 1));
    t.push(track("deskWrap", "scaleX", [kf(16, 1.5 * 0.66, "hold"), kf(52, 1.5, DEC)]));
    t.push(track("deskWrap", "scaleY", [kf(16, 1.5 * 0.66, "hold"), kf(52, 1.5, DEC)]));
    t.push(fade("deskLabel", 60, 74, 0, 1));
    t.push(track("deskLabel", "y", [kf(60, 915, "hold"), kf(78, 900, DEC)]));
    // "hits your ears" — the ear arrives right of centre
    t.push(fade("earWrapD", 90, 104, 0, 1), ...popScale("earWrapD", 90, 110, 2.3, 0.65));
    // Six ribbons enter from six directions SIMULTANEOUSLY and land together.
    for (let i = 0; i < 6; i++) {
      t.push(fade(`ribD${i}`, 108, 116, 0, 1));
      t.push(track(`ribD${i}`, "x", [kf(108, 1400 + RIB_OFF[i][0], "hold"), kf(132, 1400, DEC)]));
      t.push(track(`ribD${i}`, "y", [kf(108, 500 + RIB_OFF[i][1], "hold"), kf(132, 500, DEC)]));
    }
    // one mint flash at contact
    t.push(track("flashD", "opacity", [kf(130, 0, "hold"), kf(133, 0.6, "linear"), kf(146, 0, SM)]));
    A.D_Desk = { name: "D_Desk", fps: FPS, duration: s.len, loop: "oneShot", tracks: t };
  }

  // ================================================== E_Microphone =========
  {
    const s = S.E_Microphone, t = [];
    t.push(...visReset("E", { deskWrap: 1 }), ...camera(s), ...bgTo(P.bgTeal, s.len));
    t.push(track("earWrapD", "opacity", [kf(0, 1, "hold")]));
    t.push(track("deskWrap", "x", [kf(0, 760, "hold")]), track("deskWrap", "y", [kf(0, 620, "hold")]),
           track("deskWrap", "scaleX", [kf(0, 1.5, "hold")]), track("deskWrap", "scaleY", [kf(0, 1.5, "hold")]));
    // "take all of it" — the ribbons pass STRAIGHT THROUGH and out the far side
    for (let i = 0; i < 6; i++) {
      t.push(track(`ribD${i}`, "x", [kf(0, 1400, "hold"), kf(40, 1400 - RIB_OFF[i][0] * 1.1, "ease-in")]));
      t.push(track(`ribD${i}`, "y", [kf(0, 500, "hold"), kf(40, 500 - RIB_OFF[i][1] * 1.1, "ease-in")]));
      t.push(track(`ribD${i}`, "opacity", [kf(0, 1, "hold"), kf(30, 1, "hold"), kf(44, 0, OUT)]));
    }
    // "no filter" — a mesh grid inside a funnel
    t.push(fade("funnelE", 50, 64, 0, 1), ...popScale("funnelE", 50, 70, 1, 0.7, DEC));
    t.push(fade("meshE", 56, 70, 0, 1), ...popScale("meshE", 56, 74, 1, 0.6, DEC));
    // "at the ear" — the X snaps, the mesh desaturates and drops 10px
    t.push(track("xE0", "opacity", [kf(72, 0, "hold"), kf(75, 1, "linear")]));
    t.push(track("xE1", "opacity", [kf(72, 0, "hold"), kf(75, 1, "linear")]));
    t.push(track("meshE", "opacity", [kf(76, 1, "hold"), kf(88, 0.3, SM)]));
    t.push(track("meshE", "y", [kf(76, 470, "hold"), kf(88, 480, "ease-in")]));
    // "the ear is a microphone" — the morph, same position and scale
    t.push(track("earWrapD", "opacity", [kf(95, 1, "hold"), kf(113, 0, "ease-in-out")]));
    t.push(track("micWrapE", "opacity", [kf(95, 0, "hold"), kf(113, 1, "ease-in-out")]));
    t.push(track("earWrapD", "scaleX", [kf(95, 2.3, "hold"), kf(113, 2.1, SM)]));
    t.push(track("earWrapD", "scaleY", [kf(95, 2.3, "hold"), kf(113, 2.1, SM)]));
    t.push(track("micWrapE", "scaleX", [kf(95, 2.5, "hold"), kf(113, 2.3, SM)]));
    t.push(track("micWrapE", "scaleY", [kf(95, 2.5, "hold"), kf(113, 2.3, SM)]));
    // "microphones" — the mic holds alone
    for (const id of ["funnelE", "meshE", "xE0", "xE1"])
      t.push(track(id, "opacity", [kf(114, id === "meshE" ? 0.3 : 1, "hold"), kf(128, 0, OUT)]));
    // "don't have opinions" — an empty thought bubble, then the X
    t.push(fade("thoughtE", 148, 162, 0, 1), ...popScale("thoughtE", 148, 168, 1, 0.6));
    t.push(track("xE2", "opacity", [kf(168, 0, "hold"), kf(171, 1, "linear")]));
    t.push(track("xE3", "opacity", [kf(168, 0, "hold"), kf(171, 1, "linear")]));
    A.E_Microphone = { name: "E_Microphone", fps: FPS, duration: s.len, loop: "oneShot", tracks: t };
  }

  // ==================================================== F_Priority =========
  {
    const s = S.F_Priority, t = [];
    t.push(...visReset("F", { deskWrap: 1 }), ...camera(s), ...bgTo(P.bgMid, s.len));
    // The desk stays on screen but steps back so the three boxes read cleanly.
    t.push(track("deskWrap", "x", [kf(0, 760, "hold"), kf(26, 268, SM)]));
    t.push(track("deskWrap", "y", [kf(0, 620, "hold"), kf(26, 812, SM)]));
    t.push(track("deskWrap", "scaleX", [kf(0, 1.5, "hold"), kf(26, 0.82, SM)]));
    t.push(track("deskWrap", "scaleY", [kf(0, 1.5, "hold"), kf(26, 0.82, SM)]));
    t.push(track("deskWrap", "opacity", [kf(0, 1, "hold"), kf(26, 0.55, SM)]));
    // Scene E's ribbons and props are wrapper groups outside sF; hide them here.
    for (let i = 0; i < 6; i++) t.push(track(`ribD${i}`, "opacity", [kf(0, 0, "hold")]));
    for (const id of ["earWrapD", "micWrapE"]) t.push(track(id, "opacity", [kf(0, 0, "hold")]));
    // Three boxes slide in from the left, 6 frames apart, identical scale.
    const BX = [420, 960, 1500];
    for (let i = 0; i < 3; i++) {
      const b = i * 6;
      t.push(fade(`boxW${i}`, b, b + 10, 0, 1));
      t.push(track(`boxW${i}`, "x", [kf(b, BX[i] - 620, "hold"), kf(b + 24, BX[i], DEC)]));
    }
    // "a cough"
    t.push(fade("coughW", 34, 46, 0, 1));
    for (let i = 0; i < 3; i++) {
      const b = 44 + i * 5;
      t.push(track(`coughP${i}`, "opacity", [kf(b, 0, "hold"), kf(b + 4, 0.9, "ease-out"), kf(b + 16, 0, SM)]));
      t.push(track(`coughP${i}`, "x", [kf(b, 470 + i * 34, "hold"), kf(b + 16, 500 + i * 44, "ease-out")]));
    }
    // "a bin lorry"
    t.push(fade("lorryW", 50, 62, 0, 1), ...popScale("lorryW", 50, 68, 1, 0.6));
    // "a marriage proposal"
    t.push(fade("kneelW", 66, 78, 0, 1));
    t.push(fade("ringF", 74, 84, 0, 1), ...popScale("ringF", 74, 90, 1, 0.4));
    // "identical" — two equals signs, 6 frames apart
    for (let i = 0; i < 2; i++) {
      const b = 84 + i * 6;
      for (const p of ["eqA", "eqB"]) {
        t.push(fade(`${p}${i}`, b, b + 8, 0, 1));
        t.push(...popScale(`${p}${i}`, b, b + 14, 1, 0.4));
      }
    }
    // "priority" — the ONE permitted stroke reveal
    t.push(track("bracketF", "trimEnd", [kf(96, 0, "hold"), kf(111, 1, "ease-in-out")]));
    t.push(fade("idF", 112, 126, 0, 1));
    t.push(track("idF", "y", [kf(112, 845, "hold"), kf(130, 830, DEC)]));
    // HOLD 30 frames — nothing moves but particles.
    A.F_Priority = { name: "F_Priority", fps: FPS, duration: s.len, loop: "oneShot", tracks: t };
  }

  return SCENES.map((s) => A[s.name]);
}

// crowd wrapper scales, mirrored from scenes.mjs layout
export const CROWD_S = [[430, 880, 660], [700, 940, 740], [1010, 860, 640],
  [1240, 950, 760], [1520, 890, 690], [1720, 960, 780]].map(([, fy, hy]) => (fy - hy) / 196);
// six approach directions for the ribbons in Scene D
export const RIB_OFF = [[-150, -100], [-100, -260], [-40, 300], [25, 280], [90, -280], [160, 120]]
  .map(([a, b]) => [a * 2.4, b * 1.5]);
