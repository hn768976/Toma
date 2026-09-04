/**
 * Screen geometry.
 *
 * The corruption is drawn on a flat plane that is then tilted in 3D. The plane
 * has to overfill the frame so that no edge of it ever enters shot after the
 * rotation - 1.6 leaves ~100px of margin at the tightest corner (top right).
 */
export const OVERFILL = 1.6;

/** Screen angle. rotateZ runs the horizontal structures downhill to the right. */
export const ROTATE_Y = 12;
export const ROTATE_Z = 4;
export const PERSPECTIVE_RATIO = 0.62;

export const planeSize = (width: number, height: number) => ({
  planeWidth: width * OVERFILL,
  planeHeight: height * OVERFILL,
});

/**
 * The composite is cut into horizontal bands for slice tearing. Canvas and DOM
 * both derive band edges from here, which is what makes the message tear in
 * lockstep with the corruption behind it.
 */
export const TEAR_BANDS = 36;

/**
 * Band edges are snapped to even CSS pixels so they land on whole device
 * pixels both in the 1080p preview (dpr 0.5) and in a 4K render (dpr 1). Odd
 * edges would leave antialiased hairlines between the bands.
 */
export const bandEdge = (index: number, planeHeight: number): number => {
  if (index <= 0) return 0;
  if (index >= TEAR_BANDS) return Math.round(planeHeight / 2) * 2;
  return Math.round((index * planeHeight) / TEAR_BANDS / 2) * 2;
};

export const bandRange = (index: number, planeHeight: number) => {
  const top = bandEdge(index, planeHeight);
  return { top, height: bandEdge(index + 1, planeHeight) - top };
};

/** Indices of the bands that overlap [top, top + height] in plane space. */
export const bandsCovering = (top: number, height: number, planeHeight: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < TEAR_BANDS; i++) {
    const band = bandRange(i, planeHeight);
    if (band.top + band.height > top && band.top < top + height) {
      out.push(i);
    }
  }
  return out;
};
