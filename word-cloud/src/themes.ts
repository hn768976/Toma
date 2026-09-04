/**
 * The two versions are the same build with a different palette: V1 is the
 * reference match (white on black), V2 the light-mode variant that gives a
 * visibly different thumbnail for decks and broadcast.
 *
 * Colour stops run near (t = 0) to far (t = 1); brightness tracks depth so
 * the field reads as receding even before the opacity ramp is applied.
 */
export type ColourStop = readonly [number, readonly [number, number, number]];

export type Theme = {
  id: string;
  background: string;
  colourStops: readonly ColourStop[];
  /** Glow on the nearest words. Off on the light version - on white it just
   *  reads as a rendering error. */
  glow: boolean;
  glowColour: string;
  /** Fine grain, mostly to stop the black field banding. */
  grain: number;
  /** Vignette strength, 0 = none. */
  vignette: number;
};

export const DARK: Theme = {
  id: "V1",
  background: "#000000",
  colourStops: [
    [0, [255, 255, 255]],
    [0.3, [255, 255, 255]],
    [0.58, [138, 138, 138]],
    [1, [58, 58, 58]],
  ],
  glow: true,
  glowColour: "255, 255, 255",
  grain: 0.16,
  vignette: 0.55,
};

export const LIGHT: Theme = {
  id: "V2",
  background: "#ffffff",
  colourStops: [
    [0, [17, 17, 17]],
    [0.3, [17, 17, 17]],
    [0.58, [138, 138, 138]],
    [1, [216, 216, 216]],
  ],
  glow: false,
  glowColour: "0, 0, 0",
  grain: 0,
  vignette: 0,
};

export const colourAt = (t: number, stops: readonly ColourStop[]) => {
  if (t <= stops[0][0]) {
    return stops[0][1];
  }
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    if (t <= t1) {
      const [t0, c0] = stops[i - 1];
      const k = (t - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * k),
        Math.round(c0[1] + (c1[1] - c0[1]) * k),
        Math.round(c0[2] + (c1[2] - c0[2]) * k),
      ] as const;
    }
  }
  return stops[stops.length - 1][1];
};
