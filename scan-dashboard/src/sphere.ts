/**
 * Geometry for the wireframe sphere.
 *
 * The sphere is drawn as latitude and longitude curves projected orthographically
 * from a camera raised `tilt` degrees above the equator. Sampling the true
 * parametric curves (rather than stacking plain ovals) is what makes the
 * longitudes narrow to a line as they turn edge-on, and is the single detail
 * that makes the group read as a sphere.
 */

export type Pt = { x: number; y: number; z: number };

type Projector = (phi: number, theta: number) => Pt;

/**
 * Build a projector for a sphere of radius `r` centred on (cx, cy), spun by
 * `spin` radians about its own axis and viewed from `tilt` radians above the
 * equator. Returns screen-space x/y (SVG, y down) plus the view-space z used to
 * tell the near half of a curve from the far half.
 */
export const makeProjector = (
  cx: number,
  cy: number,
  r: number,
  tilt: number,
  spin: number,
): Projector => {
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  return (phi, theta) => {
    const t = theta + spin;
    const x = r * Math.cos(phi) * Math.sin(t);
    const y = r * Math.sin(phi);
    const z = r * Math.cos(phi) * Math.cos(t);
    // Tilt the pole towards the viewer.
    const yr = y * ct - z * st;
    const zr = y * st + z * ct;
    return { x: cx + x, y: cy - yr, z: zr };
  };
};

const fmt = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;

/**
 * Split a closed sampled curve into the part facing the camera and the part
 * behind the sphere, as two `d` strings each possibly holding several subpaths.
 */
export const splitNearFar = (pts: Pt[]) => {
  const near: string[] = [];
  const far: string[] = [];
  let run: string[] = [];
  let runNear = pts[0].z >= 0;
  const flush = () => {
    if (run.length > 1) (runNear ? near : far).push(`M${run.join('L')}`);
    run = [];
  };
  for (const p of pts) {
    const isNear = p.z >= 0;
    if (isNear !== runNear) {
      // Carry the crossing point into both runs so the halves meet cleanly.
      run.push(fmt(p));
      flush();
      runNear = isNear;
      run = [fmt(p)];
    } else {
      run.push(fmt(p));
    }
  }
  flush();
  return { near: near.join(' '), far: far.join(' ') };
};

/** A line of constant latitude, sampled all the way round. */
export const latitude = (project: Projector, phi: number, samples = 128) => {
  const pts: Pt[] = [];
  for (let i = 0; i <= samples; i++) {
    pts.push(project(phi, (i / samples) * Math.PI * 2));
  }
  return splitNearFar(pts);
};

/** A great circle through both poles at meridian `theta`. */
export const longitude = (project: Projector, theta: number, samples = 128) => {
  const pts: Pt[] = [];
  for (let i = 0; i <= samples; i++) {
    pts.push(project((i / samples) * Math.PI * 2, theta));
  }
  return splitNearFar(pts);
};

export const LAT_STEPS = [-72, -54, -36, -18, 0, 18, 36, 54, 72].map((d) => (d * Math.PI) / 180);
/** Eight great circles — sixteen visible meridians. */
export const LON_COUNT = 8;
