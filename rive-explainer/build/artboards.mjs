import { P, FPS, W, H, kf, track, ellipse, rect, poly, glow } from "./lib.mjs";

// ============================================================ CHARACTER ====
// Circle head, rounded-trapezoid body, stub limbs. Bone rig: spine(2)+neck,
// arms(2 each), legs(2 each). Visual groups hang off the bones and carry a
// +90 counter-rotation so their children stay in screen orientation while
// still inheriting the bone's motion.
function characterArtboard(name, bodyColor, opts = {}) {
  const skin = P.cream;
  // ~5 heads tall: head 46 + neck 16 + chest 48 + hip 55 + legs 70 = 235.
  const bones = [
    { id: "hip",   parent: "root",  x: 0, y: -70, length: 55, rotation: -90 },
    { id: "chest", parent: "hip",   length: 48 },
    { id: "neck",  parent: "chest", length: 16 },
    { id: "armL0", parent: "chest", x: 0, y: 0, length: 26, rotation: 206 },
    { id: "armL1", parent: "armL0", length: 24 },
    { id: "armR0", parent: "chest", x: 0, y: 0, length: 26, rotation: 154 },
    { id: "armR1", parent: "armR0", length: 24 },
    { id: "legL0", parent: "root",  x: -13, y: -70, length: 36, rotation: 100 },
    { id: "legL1", parent: "legL0", length: 34 },
    { id: "legR0", parent: "root",  x: 13,  y: -70, length: 36, rotation: 80 },
    { id: "legR1", parent: "legR0", length: 34 },
  ];
  // Only the torso/head groups need a counter-rotation (their art is authored
  // in screen orientation); limb art is authored along its bone's +x axis.
  const groups = [
    { id: "root", x: 100, y: 262 },
    { id: "torsoG", parent: "hip",   rotation: 90 },
    { id: "chestG", parent: "chest", rotation: 90 },
    { id: "headG",  parent: "neck",  rotation: 90 },
  ];
  const limb = (id, bone, len, thick) =>
    rect(id, len / 2, 0, len + thick, thick, bodyColor, { parent: bone, cornerRadius: thick / 2 });
  const shapes = [
    limb("legLu", "legL0", 36, 15), limb("legLd", "legL1", 34, 14),
    limb("legRu", "legR0", 36, 15), limb("legRd", "legR1", 34, 14),
    limb("armLu", "armL0", 26, 13), limb("armLd", "armL1", 24, 12),
    limb("armRu", "armR0", 26, 13), limb("armRd", "armR1", 24, 12),
    // body: rounded trapezoid, wider at the base
    poly("body", 0, -24, [
      { x: -29, y: 27 }, { x: 29, y: 27 }, { x: 22, y: -27 }, { x: -22, y: -27 },
    ], bodyColor, { parent: "torsoG", cornerRadius: 11 }),
    ellipse("head", 0, -23, 46, 46, skin, { parent: "headG" }),
    ellipse("eyeL", -10, -26, 7, 8, "#1B2340", { parent: "headG" }),
    ellipse("eyeR", 10, -26, 7, 8, "#1B2340", { parent: "headG" }),
    rect("mouth", 0, -11, 12, 3, "#1B2340", { parent: "headG", cornerRadius: 1.5, opacity: opts.mouth ?? 0 }),
  ];

  // Posture extremes for the blend state, plus a pre-blended 30% pose that a
  // time-based transition can reach (a parent timeline cannot key a nested
  // state machine's input).
  const pose = (n, tilt) => ({
    name: n, fps: FPS, duration: 2, loop: "oneShot", tracks: [
      track("hip", "rotation", [kf(0, -90 + tilt)]),
      track("chest", "rotation", [kf(0, tilt * 0.6)]),
      track("headG", "y", [kf(0, tilt * 0.35)]),
    ],
  });

  const animations = [
    pose("upright", 0),
    pose("slumped", 11),
    // breathe: a separate looping layer, running under everything.
    { name: "breathe", fps: FPS, duration: 108, loop: "loop", tracks: [
      track("torsoG", "scaleY", [kf(0, 1), kf(54, 1.015, "ease-in-out"), kf(108, 1, "ease-in-out")]),
      track("torsoG", "scaleX", [kf(0, 1), kf(54, 0.994, "ease-in-out"), kf(108, 1, "ease-in-out")]),
      track("headG", "y", [kf(0, 0), kf(54, -1.6, "ease-in-out"), kf(108, 0, "ease-in-out")]),
    ]},
  ];

  const smStates = [{ name: "posture", blend1d: {
    input: "posture", animations: [
      { animation: "upright", value: 0 }, { animation: "slumped", value: 100 }] } }];
  const smTransitions = [{ from: "entry", to: "posture" }];

  if (opts.slumpAt !== undefined) {
    // Scene A drives posture to ~30% on "without trying".
    animations.push({ name: "slump30", fps: FPS, duration: 22, loop: "oneShot", tracks: [
      track("hip", "rotation", [kf(0, -90), kf(22, -90 + 11 * 0.3, "emphasized-decel")]),
      track("chest", "rotation", [kf(0, 0), kf(22, 11 * 0.6 * 0.3, "emphasized-decel")]),
      track("headG", "y", [kf(0, 0), kf(22, 11 * 0.35 * 0.3, "emphasized-decel")]),
    ]});
    smStates.length = 0; smTransitions.length = 0;
    smStates.push({ name: "stand", animation: "upright" }, { name: "slumping", animation: "slump30" });
    smTransitions.push(
      { from: "entry", to: "stand" },
      { from: "stand", to: "slumping", exitTimeMs: opts.slumpAt });
  }

  return {
    name, width: 200, height: 300, bones, groups, shapes, animations,
    stateMachine: [
      { name: "Posture", inputs: [{ name: "posture", type: "number" }],
        states: smStates, transitions: smTransitions },
      { name: "Breathe", states: [{ name: "b", animation: "breathe" }],
        transitions: [{ from: "entry", to: "b" }] },
    ],
  };
}

// ================================================================== EAR ====
// Ear and Mic are generated from ONE point set so they share a point count and
// winding; Mic is a per-point transform of the ear outline, not a fresh shape.
const EAR_PTS = [
  { x: 0, y: -66 }, { x: 22, y: -58 }, { x: 38, y: -38 }, { x: 44, y: -10 },
  { x: 42, y: 16 }, { x: 34, y: 38 }, { x: 22, y: 56 }, { x: 4, y: 66 },
  { x: -12, y: 60 }, { x: -22, y: 44 }, { x: -26, y: 22 }, { x: -24, y: 0 },
  { x: -26, y: -22 }, { x: -20, y: -42 }, { x: -10, y: -58 },
];
// Mic: authored from the ear's point set (same count, same winding) pulled to
// a capsule-on-a-stem silhouette, so the two can be cross-registered.
const MIC_PTS = [
  { x: 0, y: -62 }, { x: 26, y: -54 }, { x: 36, y: -36 }, { x: 36, y: -14 },
  { x: 26, y: 4 }, { x: 11, y: 14 }, { x: 10, y: 40 }, { x: 22, y: 58 },
  { x: 0, y: 62 }, { x: -22, y: 58 }, { x: -10, y: 40 }, { x: -11, y: 14 },
  { x: -26, y: 4 }, { x: -36, y: -14 }, { x: -30, y: -44 },
]

const earArtboard = (name, pts, accent, isMic) => ({
  name, width: 220, height: 260,
  shapes: [
    poly("outline", 110, 130, pts.map((p) => ({ x: p.x * 1.15, y: p.y * 1.15 })), P.cream,
      { cornerRadius: 9 }),
    isMic
      // grille band across the mic head
      ? rect("inner", 110, 100, 54, 42, accent, { cornerRadius: 10, opacity: 0.55 })
      // concha: a crescent read as two offset ellipses, the upper one cut out
      : ellipse("inner", 118, 136, 46, 74, accent, { rotation: 12, opacity: 0.5 }),
    ...(isMic ? [] : [ellipse("conchaCut", 130, 128, 36, 58, P.cream, { rotation: 12 })]),
  ],
});

// ========================================================= SPEECH BUBBLE ===
const speechBubble = (fontId) => ({
  name: "SpeechBubble", width: 380, height: 240,
  shapes: [
    rect("bubbleBody", 190, 100, 340, 150, P.coral, { cornerRadius: 26 }),
    poly("tail", 130, 186, [{ x: 0, y: 0 }, { x: 40, y: -14 }, { x: 22, y: 30 }], P.coral),
  ],
  texts: [{ id: "bubbleText", x: 20, y: 74, width: 340, height: 60, align: "center",
            font: fontId, size: 46, runs: [{ name: "nameRun", text: "YOUR NAME", color: P.offWhite }] }],
});

// ============================================================ WAVE RIBBON ==
// A flat sound wave: a chevron band that reads as direction of travel.
const waveRibbon = (accent) => ({
  name: "WaveRibbon", width: 300, height: 80,
  shapes: [
    poly("ribbon", 150, 40, [
      { x: -150, y: -6 }, { x: -80, y: -20 }, { x: -10, y: -4 }, { x: 60, y: -22 },
      { x: 130, y: -6 }, { x: 150, y: 0 }, { x: 130, y: 8 }, { x: 60, y: -8 },
      { x: -10, y: 10 }, { x: -80, y: -6 }, { x: -150, y: 8 },
    ], accent),
  ],
});

// =============================================================== MIX DESK ==
function mixDesk() {
  const shapes = [
    rect("deskBody", 260, 150, 500, 280, P.bgViolet, { cornerRadius: 18 }),
    rect("deskTop", 260, 34, 500, 48, P.dim, { cornerRadius: 18, opacity: 0.5 }),
  ];
  const drop = [];
  // 12 faders, evenly spaced, all at mid position.
  for (let i = 0; i < 12; i++) {
    const x = 44 + i * 38;
    shapes.push(rect(`slot${i}`, x, 172, 6, 150, P.bg, { cornerRadius: 3 }));
    shapes.push(rect(`fader${i}`, x, 172, 26, 14, P.amber, { cornerRadius: 4, opacity: 0 }));
    // Faders drop in last, 2 frames apart, landing at mid position.
    const t = i * 2;
    drop.push(track(`fader${i}`, "opacity", [kf(t, 0, "hold"), kf(t + 6, 1, "ease-out")]));
    drop.push(track(`fader${i}`, "y", [kf(t, 96, "hold"), kf(t + 12, 172, "ease-out-back")]));
  }
  return {
    name: "MixDesk", width: 520, height: 300, shapes,
    // The parent timeline cannot key a nested artboard's children, so the
    // fader drop is timed from load: Scene D starts at frame 555 and the
    // faders land at scene-frame 44 => 599/30 = 19.966s.
    animations: [
      { name: "deskHold", fps: FPS, duration: 2, loop: "oneShot",
        tracks: [track("fader0", "opacity", [kf(0, 0)])] },
      { name: "deskFaders", fps: FPS, duration: 40, loop: "oneShot", tracks: drop },
    ],
    stateMachine: { name: "DeskSM",
      states: [{ name: "hold", animation: "deskHold" }, { name: "drop", animation: "deskFaders" }],
      transitions: [{ from: "entry", to: "hold" },
                    { from: "hold", to: "drop", exitTimeMs: 19966 }] },
  };
}

// ============================================================== QUEUE BOX ==
// Used three times in Scene F at identical scale; instancing guarantees that.
const queueBox = () => ({
  name: "QueueBox", width: 300, height: 260,
  shapes: [
    rect("boxFill", 150, 130, 280, 240, P.bgViolet, { cornerRadius: 20 }),
    rect("boxEdge", 150, 130, 280, 240, "#00000000", {
      cornerRadius: 20, stroke: { color: P.dim, thickness: 6 } }),
  ],
});

// ============================================================== PARTICLES ==
// Ambient dot field. Sits in the NEAR parallax layer; drifts upward with sway.
function particles(seedCount = 52) {
  const shapes = [], tracks = [];
  let s = 20260826;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < seedCount; i++) {
    const x = rnd() * W, y = rnd() * H, r = 3 + rnd() * 7;
    const op = 0.10 + rnd() * 0.15, rise = 90 + rnd() * 150, sway = 14 + rnd() * 26;
    const phase = rnd();
    shapes.push(ellipse(`p${i}`, x, y, r * 2, r * 2, P.offWhite, { opacity: op }));
    const D = 240, o = Math.round(phase * D);
    const at = (f) => (f + o) % D;
    // Wrap-around is hidden by keying opacity to 0 at the seam.
    tracks.push(track(`p${i}`, "y", [
      kf(0, y - (at(0) / D) * rise), kf(D - at(0), y - rise, "linear"),
      kf(D - at(0), y, "hold"), kf(D, y - (at(D) / D) * rise, "linear"),
    ].filter((k, idx, a) => idx === 0 || k.frame > a[idx - 1].frame)));
    tracks.push(track(`p${i}`, "x", [
      kf(0, x), kf(D * 0.5, x + sway * (phase > 0.5 ? 1 : -1), "ease-in-out"), kf(D, x, "ease-in-out"),
    ]));
  }
  return {
    name: "Particles", width: W, height: H, shapes,
    animations: [{ name: "drift", fps: FPS, duration: 240, loop: "loop", tracks }],
    stateMachine: { name: "PSM", states: [{ name: "d", animation: "drift" }],
                    transitions: [{ from: "entry", to: "d" }] },
  };
}

export function sharedArtboards(fontId) {
  return [
    characterArtboard("CharacterHero", P.sky, { slumpAt: 5000, mouth: 0 }),
    characterArtboard("CharacterSpeak", P.lavender, { mouth: 1 }),
    characterArtboard("CharacterCrowdA", P.mint),
    characterArtboard("CharacterCrowdB", P.amber),
    characterArtboard("CharacterCrowdC", P.coral),
    earArtboard("Ear", EAR_PTS, P.mint, false),
    earArtboard("Mic", MIC_PTS, P.sky, true),
    speechBubble(fontId),
    waveRibbon(P.sky),
    mixDesk(),
    queueBox(),
    particles(),
  ];
}
