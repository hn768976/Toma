// Small colour helpers for the market map.
//
// The theme stores colours as CSS strings because most of them go straight
// into style props; the canvas passes need them as components so dots can
// be shaded by depth. Rather than build a colour string per dot per frame
// (5000+ allocations a frame), buildRamp() bakes a short ladder of opaque
// rgb() strings once and the draw loop indexes into it.

export type Rgb = readonly [number, number, number];

const RGB_PATTERN = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/;

export const parseRgb = (color: string): Rgb => {
  const match = RGB_PATTERN.exec(color);
  if (!match) {
    throw new Error(`market-map theme colours must be rgb()/rgba(): ${color}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

export const mixRgb = (from: Rgb, to: Rgb, t: number): Rgb => {
  const k = Math.min(1, Math.max(0, t));
  return [
    Math.round(from[0] + (to[0] - from[0]) * k),
    Math.round(from[1] + (to[1] - from[1]) * k),
    Math.round(from[2] + (to[2] - from[2]) * k),
  ];
};

export const rgbString = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;

export const rgbaString = ([r, g, b]: Rgb, alpha: number) =>
  `rgba(${r}, ${g}, ${b}, ${alpha})`;

/** `steps` opaque rgb() strings walking from `from` to `to`. */
export const buildRamp = (from: Rgb, to: Rgb, steps: number): string[] => {
  const ramp: string[] = [];
  for (let i = 0; i < steps; i++) {
    ramp.push(rgbString(mixRgb(from, to, steps === 1 ? 0 : i / (steps - 1))));
  }
  return ramp;
};
