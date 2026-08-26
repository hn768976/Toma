import { P, W, H, FPS, SCENES, kf, track, ellipse, rect, poly, glow,
         DEPTH, cameraTracks, ANCHOR } from "./lib.mjs";

const G = [], SH = [], NE = [], TX = [];
const g = (o) => { G.push(o); return o.id; };
const sh = (o) => { SH.push(o); return o.id; };
const ne = (o) => { NE.push(o); return o.id; };
const tx = (o) => { TX.push(o); return o.id; };

// A stroked, unfilled shape (checkmarks, arcs, brackets, outlines).
const line = (id, x, y, points, color, thickness, extra = {}) => ({
  id, type: "polygon", x, y, points, fill: { color: "#00000000" },
  stroke: { color, thickness, cap: "round", join: "round" }, closed: false, ...extra });

// ---------------------------------------------------------------- layout ---
// Character artboard: feet at (100,262), head centre at (100,66) => 196 apart.
// Placing a wrapper group at (gx,gy) with scale s maps artboard (px,py) to
// (gx + px*s, gy + py*s).
const charWrap = (id, parent, footX, footY, headY) => {
  const s = (footY - headY) / 196;
  return { id, parent, x: footX - 100 * s, y: footY - 262 * s, scaleX: s, scaleY: s };
};

export function buildMain(fontId, bodyFontId) {
  // ---- camera scaffold: three depth layers, each moving at its own rate ----
  g({ id: "Cam", x: 0, y: 0 });
  g({ id: "camFar", parent: "Cam", x: 0, y: 0 });
  g({ id: "camMid", parent: "Cam", x: 0, y: 0 });
  g({ id: "camNear", parent: "Cam", x: 0, y: 0 });

  // Background field + per-scene glow, all in the FAR layer.
  sh(rect("bgField", W / 2, H / 2, W * 1.6, H * 1.6, P.bg, { parent: "camFar" }));
  const GLOWS = {
    A: { x: 700, y: 520, r: 620, c: P.mint },    B: { x: 1180, y: 470, r: 700, c: P.lavender },
    C: { x: 960, y: 540, r: 700, c: P.sky },     D: { x: 820, y: 600, r: 680, c: P.amber },
    E: { x: 1000, y: 520, r: 680, c: P.sky },    F: { x: 960, y: 540, r: 700, c: P.amber },
  };
  for (const [k, v] of Object.entries(GLOWS))
    sh({ ...glow(`glow${k}`, v.x, v.y, v.r, v.c, "59"), parent: "camFar", opacity: 0 });

  // Scene wrappers in the MID layer.
  for (const s of "ABCDEF") g({ id: `s${s}`, parent: "camMid", x: 0, y: 0, opacity: 0 });

  // Ambient particles in the NEAR layer.
  g({ id: "partWrap", parent: "camNear", x: 0, y: 0, opacity: 0.9 });
  ne({ id: "partI", artboard: "Particles", parent: "partWrap", x: 0, y: 0, z: 9000 });

  // ======================================================== SCENE A ========
  g({ id: "earWrapA", parent: "sA", x: 640, y: 470, scaleX: 1.9, scaleY: 1.9, opacity: 0 });
  sh(ellipse("haloA", 640, 470, 460, 460, "#00000000", { parent: "sA", opacity: 0,
      stroke: { color: P.mint, thickness: 9 } }));
  ne({ id: "earA", artboard: "Ear", parent: "earWrapA", x: -110, y: -130 });

  sh(line("checkA", 1470, 250, [{ x: -46, y: 4 }, { x: -14, y: 38 }, { x: 50, y: -38 }],
      P.mint, 10, { parent: "sA", opacity: 0 }));
  tx({ id: "fineA", parent: "sA", x: 1310, y: 330, width: 320, height: 70, align: "center",
       font: fontId, size: 58, opacity: 0, runs: [{ name: "fineRun", text: "FINE", color: P.mint }] });

  g(charWrap("heroWrapA", "sA", 1150, 800, 470));
  G[G.length - 1].opacity = 0;
  ne({ id: "heroA", artboard: "CharacterHero", parent: "heroWrapA", x: 0, y: 0 });

  // Headphones drop onto the existing head — never a rebuilt character.
  g({ id: "hpA", parent: "sA", x: 1150, y: 470, opacity: 0 });
  sh(line("hpBand", 0, 0, [{ x: -62, y: 6 }, { x: -44, y: -46 }, { x: 0, y: -62 },
      { x: 44, y: -46 }, { x: 62, y: 6 }], P.dim, 14, { parent: "hpA" }));
  sh(rect("hpCupL", -64, 12, 30, 46, P.dim, { parent: "hpA", cornerRadius: 12 }));
  sh(rect("hpCupR", 64, 12, 30, 46, P.dim, { parent: "hpA", cornerRadius: 12 }));

  sh(ellipse("btnA", 1214, 592, 58, 58, P.coral, { parent: "sA", opacity: 0 }));
  sh(ellipse("btnAi", 1214, 592, 24, 24, "#00000033", { parent: "sA", opacity: 0 }));

  // Beep arcs pulsing out of the headphones.
  for (let i = 0; i < 3; i++) {
    const r = 74 + i * 40;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const a = (-52 + (k / 6) * 104) * Math.PI / 180;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    sh(line(`beepA${i}`, 1196, 452, pts, P.mint, 8, { parent: "sA", opacity: 0 }));
  }

  // ======================================================== SCENE B ========
  sh(rect("wipeB", W / 2, H / 2, W * 1.2, H * 1.4, P.amber, { parent: "sB", opacity: 0, z: 8000 }));
  g(charWrap("speakWrapB", "sB", 560, 830, 520)); G[G.length - 1].opacity = 0;
  ne({ id: "speakB", artboard: "CharacterSpeak", parent: "speakWrapB", x: 0, y: 0 });

  // The listener's head lands exactly on the camera anchor (1250, 470).
  g(charWrap("listenWrapB", "sB", ANCHOR.x, 780, ANCHOR.y)); G[G.length - 1].opacity = 0;
  ne({ id: "listenB", artboard: "CharacterHero", parent: "listenWrapB", x: 0, y: 0 });

  g({ id: "bubWrapB", parent: "sB", x: 700, y: 250, scaleX: 1.15, scaleY: 1.15, opacity: 0 });
  ne({ id: "bubB", artboard: "SpeechBubble", parent: "bubWrapB", x: 0, y: 0 });

  for (let i = 0; i < 3; i++)
    sh(rect(`tallyB${i}`, 636 + i * 74, 762, 26, 116, P.offWhite, { parent: "sB", opacity: 0, cornerRadius: 10 }));

  g({ id: "clockB", parent: "sB", x: 1640, y: 830, opacity: 0 });
  sh(ellipse("clockFace", 0, 0, 150, 150, "#00000000", { parent: "clockB",
      stroke: { color: P.offWhite, thickness: 9 } }));
  sh(rect("clockHandM", 0, -26, 8, 56, P.offWhite, { parent: "clockB", cornerRadius: 4 }));
  sh(rect("clockHandH", 0, -16, 8, 38, P.offWhite, { parent: "clockB", cornerRadius: 4, rotation: 90 }));

  // The skull outline and the memory slot that never fills.
  sh(ellipse("skullB", ANCHOR.x, ANCHOR.y - 34, 268, 320, "#00000000", { parent: "sB", opacity: 0,
      stroke: { color: P.offWhite, thickness: 7 } }));
  sh(rect("memB", ANCHOR.x, ANCHOR.y - 122, 130, 70, "#00000000", { parent: "sB", opacity: 0,
      cornerRadius: 12, stroke: { color: P.offWhite, thickness: 6 } }));

  tx({ id: "notIgnB", parent: "sB", x: 420, y: 300, width: 620, height: 70, align: "center",
       font: fontId, size: 56, opacity: 0, runs: [{ name: "niRun", text: "NOT IGNORED", color: P.offWhite }] });
  sh(rect("strikeB", 730, 332, 0, 11, P.coral, { parent: "sB", cornerRadius: 6 }));
  tx({ id: "noMemB", parent: "sB", x: 420, y: 400, width: 620, height: 70, align: "center",
       font: fontId, size: 56, opacity: 0, runs: [{ name: "nmRun", text: "NO MEMORY", color: P.offWhite }] });
  sh(rect("ulB0", 730, 478, 300, 10, P.coral, { parent: "sB", cornerRadius: 5, opacity: 0 }));
  sh(rect("ulB1", 730, 496, 300, 10, P.coral, { parent: "sB", cornerRadius: 5, opacity: 0 }));

  // ======================================================== SCENE C ========
  g({ id: "ribC", parent: "sC", x: 700, y: 470, scaleX: 2.6, scaleY: 2.6, opacity: 0 });
  ne({ id: "ribCi", artboard: "WaveRibbon", parent: "ribC", x: -150, y: -40 });
  sh(line("xC0", 1010, 470, [{ x: -76, y: -76 }, { x: 76, y: 76 }], P.coral, 16, { parent: "sC", opacity: 0 }));
  sh(line("xC1", 1010, 470, [{ x: 76, y: -76 }, { x: -76, y: 76 }], P.coral, 16, { parent: "sC", opacity: 0 }));
  tx({ id: "qC", parent: "sC", x: 740, y: 108, width: 440, height: 300, align: "center",
       font: fontId, size: 250, opacity: 0, runs: [{ name: "qRun", text: "?", color: P.sky }] });

  // Six listeners, deliberately unevenly spaced — the overload is the point.
  const CROWD = [[430, 880, 660], [700, 940, 740], [1010, 860, 640],
                 [1240, 950, 760], [1520, 890, 690], [1720, 960, 780]];
  const CROWD_AB = ["CharacterCrowdA", "CharacterCrowdB", "CharacterCrowdC"];
  CROWD.forEach(([x, fy, hy], i) => {
    g(charWrap(`crowdW${i}`, "sC", x, fy, hy)); G[G.length - 1].opacity = 0;
    ne({ id: `crowd${i}`, artboard: CROWD_AB[i % 3], parent: `crowdW${i}`, x: 0, y: 0 });
    g({ id: `crowdRib${i}`, parent: "sC", x: x + 130, y: hy - 74, scaleX: 0.5, scaleY: 0.5, opacity: 0,
        rotation: -30 + i * 12 });
    ne({ id: `crowdRibI${i}`, artboard: "WaveRibbon", parent: `crowdRib${i}`, x: -150, y: -40 });
  });
  sh(rect("roomC", 1010, 700, 1660, 620, "#00000000", { parent: "sC", opacity: 0,
      cornerRadius: 26, stroke: { color: P.sky, thickness: 8 } }));

  // ======================================================== SCENE D ========
  // The desk lives in its own wrapper: it stays on screen from D to the end.
  g({ id: "deskWrap", parent: "camMid", x: 760, y: 620, scaleX: 1.5, scaleY: 1.5, opacity: 0 });
  ne({ id: "deskI", artboard: "MixDesk", parent: "deskWrap", x: -260, y: -150, z: 50 });
  tx({ id: "deskLabel", parent: "sD", x: 460, y: 900, width: 620, height: 70, align: "center",
       font: fontId, size: 56, opacity: 0, runs: [{ name: "dlRun", text: "THE DESK", color: P.amber }] });

  // Ear on the right; six ribbons converge on it from six directions at once.
  g({ id: "earWrapD", parent: "camMid", x: 1400, y: 500, scaleX: 2.3, scaleY: 2.3, opacity: 0 });
  ne({ id: "earD", artboard: "Ear", parent: "earWrapD", x: -110, y: -130, z: 300 });
  sh(ellipse("flashD", 1400, 500, 300, 300, P.mint, { parent: "camMid", opacity: 0, blendMode: "screen" }));

  const RIB_DIRS = [-150, -100, -40, 25, 90, 160];
  RIB_DIRS.forEach((ang, i) => {
    g({ id: `ribD${i}`, parent: "camMid", x: 1400, y: 500, rotation: ang, scaleX: 0.95, scaleY: 0.95, opacity: 0 });
    ne({ id: `ribDi${i}`, artboard: "WaveRibbon", parent: `ribD${i}`, x: -150, y: -40, z: 250 });
  });

  // ======================================================== SCENE E ========
  g({ id: "funnelE", parent: "sE", x: 1400, y: 500, opacity: 0, scaleX: 1.3, scaleY: 1.3 });
  sh(line("funnelShape", 0, 0, [{ x: -150, y: -120 }, { x: -46, y: 20 }, { x: -46, y: 120 },
      { x: 46, y: 120 }, { x: 46, y: 20 }, { x: 150, y: -120 }], P.offWhite, 8, { parent: "funnelE" }));
  g({ id: "meshE", parent: "sE", x: 1400, y: 452, opacity: 0, scaleX: 1.2, scaleY: 1.2 });
  for (let i = 0; i < 5; i++)
    sh(rect(`meshV${i}`, -80 + i * 40, 0, 6, 150, P.offWhite, { parent: "meshE", cornerRadius: 3 }));
  for (let i = 0; i < 4; i++)
    sh(rect(`meshH${i}`, 0, -56 + i * 38, 190, 6, P.offWhite, { parent: "meshE", cornerRadius: 3 }));
  sh(line("xE0", 1400, 452, [{ x: -70, y: -70 }, { x: 70, y: 70 }], P.coral, 14, { parent: "sE", opacity: 0 }));
  sh(line("xE1", 1400, 452, [{ x: 70, y: -70 }, { x: -70, y: 70 }], P.coral, 14, { parent: "sE", opacity: 0 }));

  // Ear and Mic are stacked and cross-registered for the morph.
  g({ id: "micWrapE", parent: "sE", x: 1400, y: 500, scaleX: 2.3, scaleY: 2.3, opacity: 0 });
  ne({ id: "micE", artboard: "Mic", parent: "micWrapE", x: -110, y: -130, z: 300 });

  g({ id: "thoughtE", parent: "sE", x: 900, y: 330, opacity: 0 });
  sh(ellipse("thBody", 0, 0, 300, 190, "#00000000", { parent: "thoughtE",
      stroke: { color: P.offWhite, thickness: 7 } }));
  sh(ellipse("thDot1", -140, 110, 46, 46, "#00000000", { parent: "thoughtE",
      stroke: { color: P.offWhite, thickness: 6 } }));
  sh(ellipse("thDot2", -186, 160, 26, 26, "#00000000", { parent: "thoughtE",
      stroke: { color: P.offWhite, thickness: 5 } }));
  sh(line("xE2", 900, 330, [{ x: -66, y: -56 }, { x: 66, y: 56 }], P.coral, 13, { parent: "sE", opacity: 0 }));
  sh(line("xE3", 900, 330, [{ x: 66, y: -56 }, { x: -66, y: 56 }], P.coral, 13, { parent: "sE", opacity: 0 }));

  // ======================================================== SCENE F ========
  // Three instances of ONE artboard at ONE scale — the equal sizing is the joke.
  const BOX_X = [420, 960, 1500], BOX_Y = 520;
  BOX_X.forEach((x, i) => {
    g({ id: `boxW${i}`, parent: "sF", x, y: BOX_Y, scaleX: 1.25, scaleY: 1.25, opacity: 0 });
    ne({ id: `boxI${i}`, artboard: "QueueBox", parent: `boxW${i}`, x: -150, y: -130, z: 100 + i });
  });
  // box 1 — a cough
  g(charWrap("coughW", "sF", 420, 620, 450)); G[G.length - 1].opacity = 0;
  ne({ id: "coughC", artboard: "CharacterCrowdC", parent: "coughW", x: 0, y: 0, z: 300 });
  for (let i = 0; i < 3; i++)
    sh(ellipse(`coughP${i}`, 470 + i * 34, 430 - i * 16, 20 - i * 4, 20 - i * 4, P.coral,
      { parent: "sF", opacity: 0, z: 400 }));
  // box 2 — a bin lorry
  g({ id: "lorryW", parent: "sF", x: 960, y: 540, opacity: 0 });
  sh(rect("lorryBody", -10, 0, 190, 92, P.mint, { z: 350, z: 350, z: 350, z: 350, z: 350, parent: "lorryW", cornerRadius: 10 }));
  sh(rect("lorryCab", 106, 12, 74, 68, P.mint, { z: 350, z: 350, z: 350, z: 350, z: 350, parent: "lorryW", cornerRadius: 10 }));
  sh(rect("lorryWin", 116, -6, 44, 30, P.bgMid, { z: 350, z: 350, z: 350, z: 350, z: 350, parent: "lorryW", cornerRadius: 6 }));
  sh(ellipse("lorryW1", -52, 56, 44, 44, P.dim, { parent: "lorryW", z: 350 }));
  sh(ellipse("lorryW2", 96, 56, 44, 44, P.dim, { parent: "lorryW", z: 350 }));
  // box 3 — a marriage proposal
  g(charWrap("kneelW", "sF", 1470, 640, 500)); G[G.length - 1].opacity = 0;
  ne({ id: "kneelC", artboard: "CharacterCrowdA", parent: "kneelW", x: 0, y: 0, z: 300 });
  sh(ellipse("ringF", 1596, 452, 46, 46, "#00000000", { parent: "sF", opacity: 0, z: 400,
      stroke: { color: P.amber, thickness: 8 } }));

  [690, 1230].forEach((x, i) => {
    sh(rect(`eqA${i}`, x, 500, 62, 13, P.offWhite, { parent: "sF", opacity: 0, z: 500, cornerRadius: 7 }));
    sh(rect(`eqB${i}`, x, 540, 62, 13, P.offWhite, { parent: "sF", opacity: 0, z: 500, cornerRadius: 7 }));
  });
  // The ONE permitted stroke reveal: a bracket is a measurement mark.
  sh(line("bracketF", 230, 320, [{ x: 36, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 400 }, { x: 36, y: 400 }],
      P.amber, 9, { parent: "sF", z: 500, stroke: { color: P.amber, thickness: 9, cap: "round", join: "round",
      trim: { start: 0, end: 0, mode: "synchronized" } } }));
  tx({ id: "idF", parent: "sF", x: 460, y: 830, width: 1000, height: 90, align: "center",
       font: fontId, size: 62, opacity: 0, runs: [{ name: "idRun", text: "IDENTICAL PRIORITY", color: P.amber }] });

  // ------------------------------------------------- caption band (no Cam) --
  sh(rect("capBand", W / 2, 1006, W, 116, "#CC0B1024", { z: 9500 }));
  const CAPS = {
    A: "Your hearing is fine. You passed the test without trying.",
    B: "Somebody said your name three times. No memory of any of them.",
    C: "So where does the sound go? Why only with more than one person?",
    D: "Every sound in a room hits your ears at the same instant,",
    E: "The ear is a microphone, and microphones don't have opinions.",
    F: "A cough, a bin lorry, and a marriage proposal — identical priority.",
  };
  for (const [k, t] of Object.entries(CAPS))
    tx({ id: `cap${k}`, x: 160, y: 978, width: 1600, height: 70, align: "center", z: 9600,
         font: bodyFontId, size: 40, opacity: 0, runs: [{ name: `cap${k}Run`, text: t, color: P.offWhite }] });

  return { groups: G, shapes: SH, nested: NE, texts: TX, GLOWS };
}
