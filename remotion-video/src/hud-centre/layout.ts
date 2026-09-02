// Every rectangle in the frame, in 4K pixel units. One place to move things.
//
// The frame is a 5-band grid. Three narrow columns on the left carry the
// small instrumentation, a wide centre-right column carries the centre stage,
// and a narrow far-right column carries the indicator stack.
//
//   colA  colB  colC        ctr (STAGE)         far
//   |     |     |           |                   |
//   waveform    barPanel    header              textTR
//   readout1/2  ...         STAGE               gaugeCol4
//   dataTable   gaugeCol3   textBR              icon squares
//   radar       circGauge   indicators          ID label
//
// Nothing here reads the variant. The layout is identical in all three
// versions by construction, because there is only one copy of it.

export const FRAME_W = 3840;
export const FRAME_H = 2160;

export type Rect = { x: number; y: number; w: number; h: number };

const colA = 56;
const colB = 780;
const colC = 1504;
const ctr = 2050;
const far = 3380;

const wA = 700;
const wB = 700;
const wC = 522;
const wCtr = 1306;
const wFar = 404;

const r1 = 56;
const r2 = 380;
const r3 = 700;
const r4 = 1354;

export const LAYOUT = {
  // --- top band -------------------------------------------------------------
  waveform: { x: colA, y: r1, w: wA, h: 300 },
  barStrip: { x: colB, y: r1, w: wB, h: 300 },
  // "taller bar panel" — spans the top two rows of its column
  barPanel: { x: colC, y: r1, w: wC, h: 620 },
  textTR: { x: far, y: r1, w: wFar, h: 340 },

  // --- left instrumentation -------------------------------------------------
  readout1: { x: colA, y: r2, w: wA, h: 296 },
  readout2: { x: colB, y: r2, w: wB, h: 296 },
  dataTable: { x: colA, y: r3, w: wA, h: 630 },
  bracketEmpty: { x: colB, y: r3, w: wB, h: 630 },
  gaugeCol3: { x: colC, y: r3, w: wC, h: 1404 },

  // --- bottom band ----------------------------------------------------------
  radar: { x: colA, y: r4, w: wA, h: 750 },
  circGauge: { x: colB, y: r4, w: wB, h: 750 },

  // --- centre-right column --------------------------------------------------
  header: { x: ctr, y: r1, w: wCtr, h: 340 },
  stage: { x: ctr, y: 420, w: wCtr, h: 950 },
  textBR: { x: ctr, y: 1394, w: wCtr, h: 480 },
  indicators: { x: ctr, y: 1904, w: wCtr, h: 90 },

  // --- far-right column -----------------------------------------------------
  gaugeCol4: { x: far, y: 420, w: wFar, h: 1100 },
  iconSq1: { x: far, y: 1544, w: 190, h: 190 },
  iconSq2: { x: far + 214, y: 1544, w: 190, h: 190 },
  idLabel: { x: far, y: 1880, w: wFar, h: 224 },
} as const satisfies Record<string, Rect>;

// The centre stage is 1306 x 950 = 34.0% of frame width and 44.0% of frame
// height, sitting centre-right. Identical in all three versions.
export const STAGE = LAYOUT.stage;
export const STAGE_CX = STAGE.x + STAGE.w / 2;
export const STAGE_CY = STAGE.y + STAGE.h / 2;

// Shared panel chrome metrics.
export const PANEL_BORDER_W = 2;
export const PANEL_LABEL_H = 38;
export const PANEL_CORNER_TICK = 20;
export const PANEL_PAD = 18;
