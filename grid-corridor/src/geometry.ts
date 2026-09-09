/**
 * Closed-form perspective for a flat corridor. No 3D engine, no per-point
 * transform: the camera never moves and the planes are undeformed, so both
 * families of lines have exact analytic screen positions.
 *
 * The camera sits at the origin looking down +z, the floor plane is
 * PLANE_OFFSET world units below it and the ceiling the same distance above.
 * With focal length f (in pixels), a floor point (x, -PLANE_OFFSET, z) lands at
 *
 *     screenX = cx + f * x / z
 *     screenY = cy + f * PLANE_OFFSET / z
 *
 * so the offset below the horizon is u = f * PLANE_OFFSET / z — strictly
 * proportional to 1/z. That one fact drives everything below. Transverse lines
 * bunch toward the horizon on their own, and they accelerate on screen as they
 * approach without any easing curve; both fall out of the projection.
 *
 * Choosing f = frame height and PLANE_OFFSET = 1 fixes the scale: the frame
 * edge (u = H/2) is exactly z = 2, so all depths below are readable as
 * multiples of the near clip.
 *
 * The constants were fitted to the reference clip. Its floor transverse lines
 * solve 1/u = a - n*d to under a pixel, confirming uniform world spacing, and
 * its longitudinal lines are straight rays whose on-screen spacing grows
 * linearly with u, confirming uniform world spacing there too.
 */

/** Distance from the camera to each plane, in world units. */
export const PLANE_OFFSET = 1;

/** Focal length as a multiple of frame height. f = H puts the frame edge at z = 2. */
export const FOCAL_PER_HEIGHT = 1;

/** Depth at which a transverse line reaches the frame edge and is recycled. */
export const Z_EXIT = 2 * FOCAL_PER_HEIGHT * PLANE_OFFSET;

/**
 * World gap between transverse lines. 11 gaps across the visible corridor, which
 * is the reference's density: 12 lines per plane, bunching hard toward the horizon.
 */
export const WORLD_SPACING = 0.45;

/**
 * Far end of the drawn range, and the depth at which lines reach full strength.
 * Z_FAR sets the dark horizon band: the grid stops at u = H / Z_FAR, so the gap
 * is 2 * 14.4% = 28.8% of frame height of protected title space.
 */
export const Z_FAR = 6.95;
export const Z_FULL = 5.4;

/** Half-height of the dark horizon band, as a fraction of frame height. */
export const HORIZON_GAP = (FOCAL_PER_HEIGHT * PLANE_OFFSET) / Z_FAR;

/**
 * World gap between longitudinal lines, as a multiple of PLANE_OFFSET, and how
 * many are drawn either side of centre. 0.70 puts k = +-2 through the bottom
 * edge and sends k = +-3..7 out through the sides: 15 rays per plane.
 */
export const LONGITUDINAL_SPACING = 0.95;
export const LONGITUDINAL_COUNT = 6;

/** Screen offset below the horizon, in pixels, for a transverse line at depth z. */
export const horizonOffset = (z: number, height: number): number =>
  (FOCAL_PER_HEIGHT * height * PLANE_OFFSET) / z;

/**
 * Screen-x slope of longitudinal line k: a point on that line sitting u pixels
 * below the horizon is m * u pixels to the side of the vanishing point. Each
 * line is therefore a straight ray from the vanishing point, and — since its
 * world width is constant while its screen width scales with u — an exact
 * triangle with its apex on the vanishing point. That is why they are filled as
 * wedges rather than stroked: the taper is the perspective, not a style choice.
 */
export const longitudinalSlope = (k: number): number =>
  (k * LONGITUDINAL_SPACING) / PLANE_OFFSET;

/**
 * Depths of every drawn transverse line at a given loop phase, near to far.
 *
 * `phase` runs 0 -> 1 across one spacing. Depths are z = (n - phase) * spacing,
 * so at phase 1 every line has taken over its neighbour's position and the image
 * is identical to phase 0. Lines that pass the camera fall below Z_EXIT and are
 * recycled to the far end by the changing `first` index.
 */
export const transverseDepths = (phase: number): number[] => {
  const depths: number[] = [];
  const first = Math.ceil(Z_EXIT / WORLD_SPACING + phase);
  for (let n = first; ; n++) {
    const z = (n - phase) * WORLD_SPACING;
    if (z > Z_FAR) break;
    depths.push(z);
  }
  return depths;
};

/**
 * How far a ray of slope m runs from the vanishing point before it leaves the
 * frame, measured as an offset below the horizon. Shallow rays exit through the
 * bottom edge, steep ones through the side.
 */
export const rayExtent = (m: number, width: number, height: number): number => {
  const bottom = height / 2;
  if (m === 0) return bottom;
  return Math.min(bottom, width / 2 / Math.abs(m));
};

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
