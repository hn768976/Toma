// Colour + number helpers shared by both market-arrow scenes.

const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Samples an evenly-spaced list of hex stops at position t (0..1) and
// returns an rgb() string. Used for every "colour ramps as the move
// intensifies" effect in both scenes.
export const sampleRamp = (ramp: readonly string[], t: number): string => {
  const clamped = clamp01(t) * (ramp.length - 1);
  const lowerIndex = Math.floor(clamped);
  const upperIndex = Math.min(ramp.length - 1, lowerIndex + 1);
  const localT = clamped - lowerIndex;
  const a = hexToRgb(ramp[lowerIndex]);
  const b = hexToRgb(ramp[upperIndex]);
  return `rgb(${Math.round(a.r + (b.r - a.r) * localT)}, ${Math.round(
    a.g + (b.g - a.g) * localT,
  )}, ${Math.round(a.b + (b.b - a.b) * localT)})`;
};

// Same ramp sample, but returned with an alpha channel so it can be
// used for glows without a second colour definition.
export const sampleRampAlpha = (
  ramp: readonly string[],
  t: number,
  alpha: number,
): string =>
  sampleRamp(ramp, t).replace("rgb(", "rgba(").replace(")", `, ${alpha})`);

// 73715.4 -> "-73,715.40". Hand-rolled because the project's tsconfig
// only pulls in the es2015 lib, so Intl-flavoured toLocaleString()
// overloads aren't available.
export const formatSigned = (value: number): string => {
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(2);
  const dot = fixed.indexOf(".");
  const whole = fixed.slice(0, dot);
  const fraction = fixed.slice(dot);
  let grouped = "";
  for (let i = 0; i < whole.length; i++) {
    const fromEnd = whole.length - i;
    grouped += whole[i];
    if (fromEnd > 1 && fromEnd % 3 === 1) grouped += ",";
  }
  return `${negative ? "-" : ""}${grouped}${fraction}`;
};

// 5000 -> "5.000", 750 -> "750". Dot separator, matching the reference
// ladder readout in V2.
export const formatLadder = (value: number): string => {
  if (value < 1000) return String(value);
  const whole = String(value);
  let grouped = "";
  for (let i = 0; i < whole.length; i++) {
    const fromEnd = whole.length - i;
    grouped += whole[i];
    if (fromEnd > 1 && fromEnd % 3 === 1) grouped += ".";
  }
  return grouped;
};
