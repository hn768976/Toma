import type { Theme } from "../themes";

// Every chart fills the content area of a Panel and animates relative to
// the panel's own `delay` (frames), so panels can build in staggered.
export type ChartProps = {
  width: number;
  height: number;
  theme: Theme;
  delay: number;
  seed: number;
};
