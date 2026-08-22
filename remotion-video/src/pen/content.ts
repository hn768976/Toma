// The sheet, drawn left to right. Every mark's frame comes from the cue sheet
// minus 6, so each visual lands before the words explain it.
//
// Sheet x-bands, chosen so each scene is fully inside the camera's window at
// the moment it is drawn (the camera only travels 2400px in total, so scenes
// overlap on screen and old marks stay visible at the left — which is the
// point: the camera moves past them, it does not clear them).
//
//   scene 1   100 – 1150     scene 4  2450 – 3060
//   scene 2  1250 – 1900     scene 5  3100 – 3900
//   scene 3  1950 – 2400     scene 6  2860 – 3980 (on white, after the erase)

import { ERASE_FRAME, INK, MUSTARD, RED, lead } from "./constants";
import {
  arcPath,
  arrow,
  boxPath,
  circlePath,
  crossOut,
  ellipsePath,
  line,
  poly,
  questionMark,
  type Pt,
} from "./geometry";
import { Sheet } from "./sheet";

/** A stick figure: a circle head and five lines. Nothing else, ever. */
const stickFigure = (
  cx: number,
  headY: number,
  headR: number,
  scale: number,
  seed: number,
): Pt[][] => {
  const shoulder = headY + headR + 4;
  const hip = shoulder + 150 * scale;
  return [
    circlePath(cx, headY, headR, seed),
    line(cx, shoulder, cx, hip, seed + 1),
    line(cx - 62 * scale, shoulder + 42 * scale, cx + 62 * scale, shoulder + 42 * scale, seed + 2),
    line(cx, hip, cx - 46 * scale, hip + 96 * scale, seed + 3),
    line(cx, hip, cx + 46 * scale, hip + 96 * scale, seed + 4),
  ];
};

/** The little crown. Drawn twice: mustard in scene 1, black in scene 4. */
const crownPath = (cx: number, baseY: number, w: number, seed: number): Pt[] => {
  const h = w * 0.53;
  return poly(
    [
      [cx - w / 2, baseY],
      [cx - w / 2, baseY - h * 0.78],
      [cx - w * 0.27, baseY - h * 0.38],
      [cx, baseY - h],
      [cx + w * 0.27, baseY - h * 0.38],
      [cx + w / 2, baseY - h * 0.78],
      [cx + w / 2, baseY],
      [cx - w / 2, baseY],
    ],
    seed,
    1.4,
  );
};

/** An alarm bell: dome, base, clapper. */
export const bellDome = (cx: number, cy: number, w: number, seed: number): Pt[] =>
  poly(
    [
      [cx - w / 2, cy + w * 0.36],
      [cx - w * 0.42, cy - w * 0.06],
      [cx - w * 0.2, cy - w * 0.36],
      [cx + w * 0.2, cy - w * 0.36],
      [cx + w * 0.42, cy - w * 0.06],
      [cx + w / 2, cy + w * 0.36],
    ],
    seed,
    1.5,
  );

export const buildSheet = (): Sheet => {
  const s = new Sheet();

  // ── SCENE 1 ── f0–240 ─────────────────────────────────────────────────────
  // "Why build the thing at all. For all of human history, fat was the crown
  //  jewels."

  s.at(lead(0));
  s.stroke(boxPath(150, 330, 250, 150, 3), 12);
  s.stroke(line(275, 480, 275, 545, 4), 4);
  s.text("the vault", 275, 600, 13);
  // Bigger than the box, as the cue sheet asks.
  const [qHook, qDot] = questionMark(566, 512, 226, 9);
  s.stroke(qHook, 12).stroke(qDot, 2);
  s.fill(qDot, INK, 2);

  s.at(lead(60));
  const [shaft, barbA, barbB] = arrow(200, 760, 1110, 760, 30, 7);
  s.stroke(shaft, 16).stroke(barbA, 4).stroke(barbB, 4);
  s.text("all of human history", 655, 700, 18, { size: 52 });

  // Tick marks along the arrow, one every 3 frames.
  for (let i = 0; i < 12; i++) {
    s.at(lead(120) + i * 3);
    s.stroke(line(258 + i * 71, 740, 258 + i * 71, 782, 20 + i), 2);
  }

  s.at(lead(180));
  s.stroke(crownPath(1040, 700, 112, 31), 12);
  s.fill(crownPath(1040, 700, 112, 31), MUSTARD, 6);

  // ── SCENE 2 ── f240–585 ───────────────────────────────────────────────────
  // "Colin, 1340, February. No food, no fields, no sky, no Colin."

  s.shift(0, 80).at(lead(240));
  const colin = stickFigure(1400, 300, 40, 1, 40);
  s.stroke(colin[0], 6).stroke(colin[1], 4).stroke(colin[2], 4);
  s.stroke(colin[3], 3).stroke(colin[4], 3);
  s.stroke(line(1400, 640, 1400, 692, 46), 3);
  s.text("colin", 1400, 748, 10);

  s.at(lead(300));
  s.text("1340", 1250, 150, 12, { size: 60 });
  s.text("february", 1250, 226, 14, { size: 52 });
  const [tShaft, tA, tB] = arrow(1250, 252, 1362, 284, 20, 50);
  s.stroke(tShaft, 5).stroke(tA, 3).stroke(tB, 3);

  // Four boxes, each crossed out. Corrections are crossings-out, never erasures.
  const scratchBox = (
    label: string,
    y: number,
    seed: number,
    boxDur: number,
    textDur: number,
    hesitate = 0,
  ) => {
    s.stroke(boxPath(1560, y, 210, 100, seed), boxDur);
    s.text(label, 1665, y + 68, textDur, { size: 46 });
    if (hesitate) s.pause(hesitate);
    const [c1, c2] = crossOut(1560, y, 210, 100, seed + 2);
    s.stroke(c1, 3).stroke(c2, 3);
  };

  s.at(lead(375));
  scratchBox("food", 180, 60, 8, 9);

  s.at(lead(450));
  scratchBox("fields", 320, 64, 6, 8);
  scratchBox("sky", 460, 68, 6, 7);

  s.at(lead(510));
  scratchBox("colin", 600, 72, 6, 9, 14); // one beat of hesitation

  // ── SCENE 3 ── f585–855 ───────────────────────────────────────────────────
  // "The only thing between Colin and death is the fat on Colin's body."

  s.shift(0, 0).at(lead(585));
  const colin2 = stickFigure(2020, 285, 34, 0.86, 80);
  s.stroke(colin2[0], 6).stroke(colin2[1], 4).stroke(colin2[2], 4);
  s.stroke(colin2[3], 3).stroke(colin2[4], 3);

  // First use of red.
  const red = { color: RED };
  s.stroke(arcPath(2330, 296, 46, 168, 244, 84), 7, red);
  s.stroke(poly([[2292, 322], [2292, 354], [2368, 354], [2368, 322]], 85), 4, red);
  s.stroke(circlePath(2312, 290, 11, 86), 2, red);
  s.stroke(circlePath(2348, 290, 11, 87), 2, red);
  s.stroke(line(2306, 344, 2354, 344, 88), 3, red);

  s.at(lead(645));
  const fatBlob = ellipsePath(2020, 425, 36, 27, 90);
  s.stroke(fatBlob, 8);
  s.fill(fatBlob, MUSTARD, 6);
  s.stroke(line(2058, 425, 2118, 452, 91), 3);
  s.text("fat", 2130, 470, 8, { anchor: "start", size: 50 });

  s.at(lead(720));
  s.stroke(line(2228, 235, 2228, 555, 95), 8);
  s.stroke(poly([[1975, 625], [1975, 656], [2375, 656], [2375, 625]], 96), 12);

  s.at(lead(780));
  s.text("the whole plan", 2175, 730, 16, { size: 52 });
  s.stroke(line(2025, 764, 2325, 764, 97), 6);

  // ── SCENE 4 ── f855–1140 ──────────────────────────────────────────────────
  // "Fat is your only long-term energy storage, and running out of it was the
  //  most popular way to die."

  s.at(lead(855));
  const batteryBody = boxPath(2470, 150, 130, 86, 100);
  s.stroke(batteryBody, 9);
  s.stroke(boxPath(2600, 178, 16, 30, 101), 3);
  s.fill(batteryBody, MUSTARD, 6);
  s.stroke(line(2535, 236, 2535, 278, 102), 3);
  s.text("long-term storage", 2535, 322, 16, { size: 44 });

  s.at(lead(915));
  // Four alternatives, each crossed out 15 frames after the last.
  ["glycogen", "protein", "sugar", "hope"].forEach((label, i) => {
    s.at(lead(915) + i * 15);
    const y = 372 + i * 98;
    s.stroke(boxPath(2470, y, 196, 64, 110 + i), 4);
    s.text(label, 2568, y + 46, 5, { size: 36 });
    const [c1, c2] = crossOut(2470, y, 196, 64, 120 + i);
    s.stroke(c1, 2).stroke(c2, 2);
  });

  s.at(lead(990));
  s.stroke(line(2700, 940, 2700, 470, 130), 6);
  s.stroke(line(2700, 940, 2950, 940, 131), 6);
  const barHeights = [96, 158, 268, 82];
  barHeights.forEach((h, i) => {
    const x = 2718 + i * 56;
    const tallest = i === 2;
    s.stroke(boxPath(x, 940 - h, 46, h, 140 + i), 5, tallest ? red : undefined);
  });

  s.at(lead(1080));
  s.stroke(line(2853, 665, 2853, 622, 150), 4);
  s.text("ran out of fat", 2853, 598, 16, { size: 40 });
  // The same crown as scene 1 — but black. Colour is spent elsewhere here.
  s.stroke(crownPath(2853, 552, 92, 151), 11);

  // ── SCENE 5 ── f1140–1485 ─────────────────────────────────────────────────
  // "A bank treats a man sprinting out with the safe: alarms, phone calls,
  //  a guard."

  s.shift(-130, 60).at(lead(1140));
  s.stroke(boxPath(3260, 300, 260, 300, 160), 10);
  s.stroke(line(3316, 340, 3316, 600, 161), 4);
  s.stroke(line(3464, 340, 3464, 600, 162), 4);
  s.stroke(boxPath(3336, 452, 108, 148, 163), 6);
  s.text("bank", 3390, 262, 11, { size: 52 });

  s.at(lead(1200));
  s.stroke(circlePath(3672, 396, 26, 170), 5);
  s.stroke(line(3672, 424, 3660, 508, 171), 4);
  s.stroke(line(3660, 508, 3612, 574, 172), 4);
  s.stroke(line(3660, 508, 3718, 562, 173), 4);
  s.stroke(line(3672, 444, 3730, 470, 174), 4);
  s.stroke(boxPath(3730, 442, 84, 62, 175), 5);
  s.text("safe", 3772, 484, 6, { size: 30 });
  s.stroke(line(3576, 404, 3628, 404, 176), 2);
  s.stroke(line(3566, 444, 3618, 444, 177), 2);
  s.stroke(line(3580, 486, 3632, 486, 178), 2);

  s.at(lead(1275));
  [3170, 3570].forEach((cx, i) => {
    const seed = 180 + i * 6;
    s.stroke(bellDome(cx, 210, 76, seed), 5, red);
    s.stroke(line(cx - 44, 238, cx + 44, 238, seed + 1), 2, red);
    s.stroke(line(cx, 238, cx, 256, seed + 2), 2, red);
    s.stroke(arcPath(cx, 210, 62, 190, 40, seed + 3), 2, red);
    s.stroke(arcPath(cx, 210, 62, -50, 40, seed + 4), 2, red);
  });
  s.text("alarms", 3370, 140, 12, { size: 50 });

  s.at(lead(1335));
  s.stroke(boxPath(3688, 664, 116, 48, 200), 6);
  s.stroke(circlePath(3716, 688, 8, 204), 2);
  // Handset, off the hook.
  s.stroke(
    poly([[3668, 636], [3674, 610], [3688, 596], [3806, 596], [3820, 610], [3826, 636]], 201),
    7,
  );
  // Coiled cord, running from the base up to the handset.
  s.stroke(
    poly(
      [
        [3804, 682], [3830, 674], [3818, 660], [3844, 652],
        [3832, 638], [3852, 630], [3840, 618],
      ],
      202,
    ),
    6,
  );
  const [pShaft, pA, pB] = arrow(3866, 560, 3830, 598, 20, 203);
  s.stroke(pShaft, 4).stroke(pA, 2).stroke(pB, 2);
  s.text("phone calls", 3746, 790, 14, { size: 44 });

  s.at(lead(1410));
  s.stroke(circlePath(3390, 508, 20, 210), 5);
  s.stroke(line(3358, 488, 3422, 488, 211), 3); // hat brim
  s.stroke(arcPath(3390, 488, 22, 188, 164, 212), 4); // hat crown
  s.stroke(line(3390, 528, 3390, 578, 213), 4);
  s.stroke(line(3322, 548, 3458, 548, 214), 5); // arms, blocking the exit
  s.stroke(line(3390, 578, 3368, 612, 215), 3);
  s.stroke(line(3390, 578, 3412, 612, 216), 3);
  s.stroke(line(3390, 636, 3390, 672, 217), 3);
  s.text("a guard", 3390, 716, 12, { size: 46 });

  // ── SCENE 6 ── f1485–1740 ─────────────────────────────────────────────────
  // "That alarm has outlasted the mammoth, the Roman empire, and every diet
  //  book ever printed."

  // The single erase in the whole video.
  s.eraseEverything(ERASE_FRAME);

  // One bell, redrawn alone on white, shaking from here to the last frame.
  const shakingRed = { color: RED, shake: true };
  s.shift(0, 90).at(ERASE_FRAME);
  s.stroke(bellDome(2950, 400, 176, 220), 6, shakingRed);
  s.stroke(line(2860, 464, 3040, 464, 221), 3, shakingRed);
  s.stroke(line(2950, 464, 2950, 496, 222), 2, shakingRed);

  s.at(lead(1545));
  // Body with the shoulder hump, then the head, trunk and tusk in front.
  s.stroke(
    poly(
      [
        [3392, 486], [3400, 420], [3376, 380], [3320, 360],
        [3268, 372], [3242, 408], [3238, 486],
      ],
      230,
    ),
    11,
  );
  s.stroke(poly([[3242, 404], [3212, 400], [3192, 428], [3196, 470], [3232, 484]], 231), 7);
  // Trunk, curling forward.
  s.stroke(poly([[3200, 466], [3178, 502], [3172, 542], [3188, 568], [3212, 562]], 232), 7);
  // Tusk.
  s.stroke(poly([[3216, 478], [3184, 512], [3164, 508], [3170, 490]], 233), 5);
  [3256, 3300, 3346, 3384].forEach((x, i) => {
    s.stroke(line(x, 486, x, 556, 234 + i), 2);
  });
  const [mx1, mx2] = crossOut(3160, 352, 250, 216, 240);
  s.stroke(mx1, 4).stroke(mx2, 4);

  s.at(lead(1605));
  // Capital and base wider than the shaft, or it reads as an hourglass.
  s.stroke(boxPath(3554, 336, 132, 28, 250), 5);
  s.stroke(line(3586, 364, 3586, 520, 251), 5);
  s.stroke(line(3654, 364, 3654, 520, 252), 5);
  s.stroke(line(3606, 368, 3606, 516, 253), 4);
  s.stroke(line(3634, 368, 3634, 516, 256), 4);
  s.stroke(boxPath(3554, 520, 132, 32, 254), 5);
  const [cx1, cx2] = crossOut(3548, 328, 144, 232, 255);
  s.stroke(cx1, 4).stroke(cx2, 4);

  s.at(lead(1665));
  s.stroke(boxPath(3810, 500, 150, 30, 260), 4);
  s.stroke(boxPath(3818, 466, 138, 30, 261), 4);
  s.stroke(boxPath(3806, 432, 156, 30, 262), 4);
  s.stroke(boxPath(3822, 398, 132, 30, 263), 4);
  s.text("diets", 3884, 626, 10, { size: 46 });
  const [bx1, bx2] = crossOut(3796, 388, 176, 148, 264);
  s.stroke(bx1, 4).stroke(bx2, 4);

  return s;
};

/** Where the lone scene-6 bell lives, for the vibration lines. */
export const FINAL_BELL = { x: 2950, y: 400, w: 176 };
