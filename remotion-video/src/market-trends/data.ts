// Deterministic, periodic scene data. Everything is a pure function of a
// seed so frames render identically across Remotion's render workers,
// and every series repeats every LOOP_SCROLL world units so the loop is
// seamless when the plane has scrolled exactly one period.

import { mulberry32 } from "../particle-ring/random";
import { LOOP_SCROLL } from "./constants";

const TAU = Math.PI * 2;

export type Harmonic = { k: number; amp: number; phase: number };

export type Series = { harmonics: Harmonic[]; offset: number };

export const sampleSeries = (series: Series, u: number) => {
  let v = series.offset;
  for (const h of series.harmonics) {
    v += h.amp * Math.sin((TAU * h.k * u) / LOOP_SCROLL + h.phase);
  }
  return v;
};

export type Bar = {
  index: number;
  center: number;
  half: number;
  phase: number;
};

export type Vertex = { u: number; v: number };

export type Label = {
  u: number;
  v: number;
  up: boolean;
  text: string;
  size: number;
  alpha: number;
};

export type ValueTag = { u: number; v: number; text: string };

export type TickerToken = {
  u: number;
  text: string;
  tone: "up" | "down" | "neutral";
  size: number;
  alpha: number;
};

export type TickerRow = { v: number; tokens: TickerToken[] };

export type NodeLink = { a: Vertex; b: Vertex };

export type HBarGroup = { u: number; v: number; widths: number[] };

export type SceneData = {
  greenPitch: number;
  greenWidth: number;
  greenBars: Bar[];
  greenTrend: Series;
  cyanPitch: number;
  cyanWidth: number;
  cyanBars: Bar[];
  purple: Vertex[];
  purplePitch: number;
  lime: Vertex[];
  limePitch: number;
  curvePrimary: Series;
  curveAccent: Series;
  labelsMain: Label[];
  labelsMid: Label[];
  valueTags: ValueTag[];
  gridRows: number[];
  gridColPitch: number;
  gridColOffsets: number[];
  nodes: Vertex[];
  nodeLinks: NodeLink[];
  tickerRows: TickerRow[];
  hbarGroups: HBarGroup[];
};

const makeSeries = (
  rand: () => number,
  offset: number,
  amps: number[],
  maxHarmonic: number,
): Series => {
  const harmonics: Harmonic[] = amps.map((amp, i) => ({
    k: 1 + Math.floor(rand() * maxHarmonic) + i,
    amp,
    phase: rand() * TAU,
  }));
  return { harmonics, offset };
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const timeText = (rand: () => number) =>
  `${pad2(Math.floor(rand() * 13))}:${pad2(Math.floor(rand() * 60))}`;

const numberText = (rand: () => number) => {
  const r = rand();
  if (r < 0.4) return (rand() * 9).toFixed(1);
  if (r < 0.8) return (rand() * 9).toFixed(2);
  return `${Math.floor(rand() * 90 + 10)}`;
};

const makeBars = (
  rand: () => number,
  pitch: number,
  trend: Series,
  halfMin: number,
  halfMax: number,
): Bar[] => {
  const count = Math.round(LOOP_SCROLL / pitch);
  const bars: Bar[] = [];
  let half = (halfMin + halfMax) / 2;
  for (let i = 0; i < count; i++) {
    // Random-walk the bar size so neighbours are related, like a real
    // volatility series, with occasional jumps.
    half += (rand() - 0.5) * (halfMax - halfMin) * 0.5;
    if (rand() < 0.12) half = halfMin + rand() * (halfMax - halfMin);
    half = Math.max(halfMin, Math.min(halfMax, half));
    bars.push({
      index: i,
      center: sampleSeries(trend, i * pitch),
      half,
      phase: rand() * TAU,
    });
  }
  return bars;
};

const makeZigzag = (
  rand: () => number,
  pitch: number,
  trend: Series,
  spread: number,
): Vertex[] => {
  const count = Math.round(LOOP_SCROLL / pitch);
  const verts: Vertex[] = [];
  for (let i = 0; i < count; i++) {
    const u = i * pitch;
    // Alternate above/below the trend so it reads as a saw-tooth.
    const sign = i % 2 === 0 ? 1 : -1;
    verts.push({
      u,
      v: sampleSeries(trend, u) + sign * (0.35 + rand() * 0.65) * spread,
    });
  }
  return verts;
};

export const generateSceneData = (seed: number): SceneData => {
  const rand = mulberry32(seed);

  const greenTrend = makeSeries(rand, -40, [150, 95, 55], 2);
  const greenPitch = 40;
  const greenBars = makeBars(rand, greenPitch, greenTrend, 22, 100);

  const cyanTrend = makeSeries(rand, 250, [120, 70, 40], 2);
  const cyanPitch = 75;
  const cyanBars = makeBars(rand, cyanPitch, cyanTrend, 25, 95);

  const purpleTrend = makeSeries(rand, -110, [130, 80], 2);
  const purplePitch = 50;
  const purple = makeZigzag(rand, purplePitch, purpleTrend, 190);

  const limeTrend = makeSeries(rand, -170, [120, 70], 2);
  const limePitch = 60;
  const lime = makeZigzag(rand, limePitch, limeTrend, 150);

  const curvePrimary = makeSeries(rand, 60, [260, 110, 40], 2);
  const curveAccent = makeSeries(rand, -20, [230, 130, 50], 2);

  const labelsMain: Label[] = [];
  for (let i = 0; i < 34; i++) {
    labelsMain.push({
      u: rand() * LOOP_SCROLL,
      v: -520 + rand() * 1040,
      up: rand() < 0.5,
      text: timeText(rand),
      size: 15 + rand() * 6,
      alpha: 0.8 + rand() * 0.2,
    });
  }
  const labelsMid: Label[] = [];
  for (let i = 0; i < 26; i++) {
    labelsMid.push({
      u: rand() * LOOP_SCROLL,
      v: -560 + rand() * 1120,
      up: rand() < 0.5,
      text: timeText(rand),
      size: 13 + rand() * 5,
      alpha: 0.55 + rand() * 0.3,
    });
  }

  const valueTags: ValueTag[] = [];
  for (let i = 0; i < 10; i++) {
    const u = rand() * LOOP_SCROLL;
    valueTags.push({
      u,
      v: sampleSeries(greenTrend, u) + 120 + rand() * 60,
      text: (rand() * 9).toFixed(3),
    });
  }

  const gridRows: number[] = [];
  for (let v = -650; v <= 650; v += 130) gridRows.push(v);
  const gridColPitch = 150;
  const gridColOffsets: number[] = [];
  for (let i = 0; i < LOOP_SCROLL / gridColPitch; i++) {
    gridColOffsets.push((rand() - 0.5) * 40);
  }

  const nodes: Vertex[] = [];
  for (const v of gridRows) {
    const perRow = 7 + Math.floor(rand() * 5);
    for (let i = 0; i < perRow; i++) {
      nodes.push({ u: rand() * LOOP_SCROLL, v });
    }
  }
  const nodeLinks: NodeLink[] = [];
  for (let i = 0; i < 26; i++) {
    const a = nodes[Math.floor(rand() * nodes.length)];
    // Link to a node on a neighbouring row, nearby in u.
    const b: Vertex = {
      u: a.u + (rand() - 0.5) * 420,
      v: a.v + (rand() < 0.5 ? 130 : -130),
    };
    nodeLinks.push({ a, b });
  }

  const tickerRows: TickerRow[] = [];
  for (let v = -720; v <= 720; v += 72) {
    const tokens: TickerToken[] = [];
    let u = rand() * 60;
    while (u < LOOP_SCROLL - 40) {
      const r = rand();
      const tone: TickerToken["tone"] =
        r < 0.42 ? "down" : r < 0.84 ? "up" : "neutral";
      const size = rand() < 0.15 ? 46 : 28 + rand() * 10;
      const text = numberText(rand);
      tokens.push({ u, text, tone, size, alpha: 0.35 + rand() * 0.45 });
      u += text.length * size * 0.62 + 40 + rand() * 120;
    }
    tickerRows.push({ v, tokens });
  }

  const hbarGroups: HBarGroup[] = [];
  for (let i = 0; i < 2; i++) {
    const widths: number[] = [];
    for (let j = 0; j < 6; j++) widths.push(120 + rand() * 260);
    hbarGroups.push({
      u: rand() * LOOP_SCROLL,
      v: -560 + rand() * 300,
      widths,
    });
  }

  return {
    greenPitch,
    greenWidth: 24,
    greenBars,
    greenTrend,
    cyanPitch,
    cyanWidth: 9,
    cyanBars,
    purple,
    purplePitch,
    lime,
    limePitch,
    curvePrimary,
    curveAccent,
    labelsMain,
    labelsMid,
    valueTags,
    gridRows,
    gridColPitch,
    gridColOffsets,
    nodes,
    nodeLinks,
    tickerRows,
    hbarGroups,
  };
};
