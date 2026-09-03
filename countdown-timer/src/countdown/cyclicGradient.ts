/**
 * A gradient that closes back on itself, for colouring anything laid out
 * around a circle.
 *
 * Sampling a plain stop list around a ring leaves a hard seam where the
 * last colour meets the first. This repeats the first colour as a final
 * stop, so position 1 lands exactly back on position 0 and the sweep is
 * continuous the whole way round.
 *
 * Palette-agnostic: pass whatever colours you like, in order.
 *
 * @example
 *   const sweep = makeCyclicGradient(["#2EE8E0", "#3F6FF5", "#7B4FE8", "#E85FD4"]);
 *   sweep(0.5); // -> "rgb(...)" halfway around
 */

type Rgb = { r: number; g: number; b: number };

const parseHex = (hex: string): Rgb => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

export type CyclicGradient = (t: number) => string;

/**
 * Builds a sampler over `colors` (hex strings), evenly spaced around the
 * cycle. `t` wraps, so any real number is valid.
 */
export const makeCyclicGradient = (colors: string[]): CyclicGradient => {
  if (colors.length === 0) return () => "rgb(0, 0, 0)";
  if (colors.length === 1) {
    const only = parseHex(colors[0]);
    const fixed = `rgb(${only.r}, ${only.g}, ${only.b})`;
    return () => fixed;
  }

  // Close the loop by repeating the first colour at t = 1.
  const rgbs = [...colors, colors[0]].map(parseHex);
  const spans = rgbs.length - 1;

  return (t: number) => {
    const wrapped = ((t % 1) + 1) % 1;
    const scaled = wrapped * spans;
    const index = Math.min(spans - 1, Math.floor(scaled));
    const local = scaled - index;
    const lower = rgbs[index];
    const upper = rgbs[index + 1];
    const mix = (a: number, b: number) => Math.round(a + (b - a) * local);
    return `rgb(${mix(lower.r, upper.r)}, ${mix(lower.g, upper.g)}, ${mix(
      lower.b,
      upper.b,
    )})`;
  };
};
