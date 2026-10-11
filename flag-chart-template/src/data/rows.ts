// The template data: one row per country, two direction presets.
// Compositions: FlagChart-<id>-Growth and FlagChart-<id>-Decline
// (Remotion IDs cannot contain "_"; rendered files are named FlagChart_<id>_<dir>.mp4).
//
// Adding a country = one row here (plus its flag in src/flags/flags.ts).
import {FLAGS, type FlagId} from '../flags/flags';
import {seeded} from '../lib/random';

export type Row = {
  id: string;
  label: string;
  flag: FlagId;
  /** Optional nudge of the card (fractions of the card's width / height) so the chart never hides the emblem. */
  cardOffset?: {x?: number; y?: number};
};

export const ROWS: Row[] = [
  {id: 'USA', label: 'United States', flag: 'USA'},
  {id: 'China', label: 'China', flag: 'China'},
  {id: 'Japan', label: 'Japan', flag: 'Japan'},
  {id: 'Germany', label: 'Germany', flag: 'Germany'},
  {id: 'UK', label: 'United Kingdom', flag: 'UK'},
  {id: 'India', label: 'India', flag: 'India'},
  {id: 'France', label: 'France', flag: 'France'},
  {id: 'Italy', label: 'Italy', flag: 'Italy'},
  {id: 'Canada', label: 'Canada', flag: 'Canada'},
  {id: 'Brazil', label: 'Brazil', flag: 'Brazil'},
  {id: 'Russia', label: 'Russia', flag: 'Russia'},
  {id: 'SouthKorea', label: 'South Korea', flag: 'SouthKorea'},
  {id: 'Australia', label: 'Australia', flag: 'Australia'},
  {id: 'Spain', label: 'Spain', flag: 'Spain', cardOffset: {x: 0.2}}, // coat of arms sits toward the hoist
  {id: 'Mexico', label: 'Mexico', flag: 'Mexico'},
  {id: 'Indonesia', label: 'Indonesia', flag: 'Indonesia'},
  {id: 'Netherlands', label: 'Netherlands', flag: 'Netherlands'},
  {id: 'UAE', label: 'United Arab Emirates', flag: 'UAE'},
  {id: 'Turkiye', label: 'Türkiye', flag: 'Turkiye', cardOffset: {x: 0.14}}, // crescent sits toward the hoist
  {id: 'Switzerland', label: 'Switzerland', flag: 'Switzerland'},
  {id: 'Argentina', label: 'Argentina', flag: 'Argentina'},
  {id: 'SouthAfrica', label: 'South Africa', flag: 'SouthAfrica'},
  {id: 'Nigeria', label: 'Nigeria', flag: 'Nigeria'},
  {id: 'Egypt', label: 'Egypt', flag: 'Egypt'},
  {id: 'Pakistan', label: 'Pakistan', flag: 'Pakistan'},
];

export const DIRECTIONS = {
  // cardShift (world units, +x = right): Growth's tall bars stand at the near
  // end, in front of the card's centre, so its card sits further right.
  Growth: {arrow: '#3AE84A', arrowTop: '#6CF06A', bars: 'rising', glow: 0.04, cardShift: 3.8},
  Decline: {arrow: '#E8203A', arrowTop: '#FF4A4A', bars: 'falling', glow: 0.15, cardShift: 0},
} as const;
export type Direction = keyof typeof DIRECTIONS;

export const BAR_COUNT = 9;

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * Rising bar heights (0..1 of the chart height), seeded per flag: mostly
 * increasing from ~10% to 100%, with two small dips. Decline uses the same
 * heights mirrored (high on the left, low on the right).
 */
const growthHeights = (id: string) => {
  const rand = seeded(hash(id));
  const n = BAR_COUNT;
  const h = Array.from({length: n}, (_, i) => 0.1 + (0.9 * i) / (n - 1) + (rand() - 0.5) * 0.05);
  // two dips at distinct positions in the middle of the run
  const a = 2 + Math.floor(rand() * 3); // 2..4
  const b = 5 + Math.floor(rand() * 2); // 5..6
  for (const i of [a, b]) h[i] = h[i - 1] - (0.05 + rand() * 0.05);
  h[0] = 0.1 + rand() * 0.03;
  h[n - 1] = 1;
  return h.map((v) => Math.min(1, Math.max(0.08, v)));
};

// Computed once at module level, so every render (any thread, any frame) sees the same chart.
export const HEIGHTS: Record<string, {Growth: number[]; Decline: number[]}> = Object.fromEntries(
  ROWS.map((r) => {
    const g = growthHeights(r.id);
    return [r.id, {Growth: g, Decline: [...g].reverse()}];
  }),
);

export const ROW_BY_ID: Record<string, Row> = Object.fromEntries(ROWS.map((r) => [r.id, r]));
export const flagRatio = (r: Row) => FLAGS[r.flag].w / FLAGS[r.flag].h;
