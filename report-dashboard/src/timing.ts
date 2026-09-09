/**
 * The build. Every beat is a frame range at 30fps; nothing here is state, so
 * any frame can be rendered on its own thread in any order.
 */
export const TIMING = {
  badge: { from: 0, to: 30 },
  title: { from: 20, to: 60 },
  /** The subtitle trails the title by this many frames. */
  subtitleDelay: 8,
  card: { from: 50, to: 90 },
  chartDraw: { from: 80, to: 200 },
  markers: { from: 120, to: 260 },
  /** Each marker's own appear/halo animation, in frames. */
  markerAppear: 26,
  stats: { from: 180, to: 300 },
  statStagger: 10,
  /** How long a value takes to count up once its box has started. */
  countDuration: 90,
  /** Faded in ahead of its beat so it is established, not popped, by 240. */
  ecgFade: { from: 210, to: 250 },
  /** Pixels of scroll per frame at 3840 wide, right to left. */
  ecgSpeed: 5.2,
} as const;

export const DURATION_IN_FRAMES = 450;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
