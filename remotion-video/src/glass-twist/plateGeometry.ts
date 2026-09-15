import { Curve, TubeGeometry, Vector3 } from "three/webgpu";
import {
  PLATE_ASPECT,
  PLATE_CORNER_RADIUS,
  PLATE_OUTER_SIZE,
  PLATE_RADIAL_SEGMENTS,
  PLATE_TUBE_RADIUS,
  PLATE_TUBULAR_SEGMENTS,
} from "./constants";

// A closed rounded-rectangle path in the XY plane, parameterised by arc
// length so the tube's segments come out evenly spaced along it.
//
// Traced counter-clockwise starting from the middle of the bottom edge:
// half the bottom edge, then corner/edge/corner/edge... and finally the
// other half of the bottom edge.
class RoundedRectCurve extends Curve<Vector3> {
  private readonly hx: number;
  private readonly hy: number;
  private readonly r: number;
  private readonly runX: number; // length of a full horizontal edge
  private readonly runY: number; // length of a full vertical edge
  private readonly arc: number; // length of one corner arc
  private readonly perimeter: number;

  constructor(width: number, height: number, cornerRadius: number) {
    super();
    this.hx = width / 2;
    this.hy = height / 2;
    this.r = Math.min(cornerRadius, this.hx, this.hy);
    this.runX = width - 2 * this.r;
    this.runY = height - 2 * this.r;
    this.arc = (Math.PI / 2) * this.r;
    this.perimeter = 2 * this.runX + 2 * this.runY + 4 * this.arc;
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const { hx, hy, r, runX, runY, arc } = this;
    const ix = hx - r; // x of the corner-arc centres
    const iy = hy - r; // y of the corner-arc centres
    let s = (((t % 1) + 1) % 1) * this.perimeter;
    const halfRun = runX / 2;

    // Bottom edge, right half
    if (s < halfRun) return target.set(s, -hy, 0);
    s -= halfRun;
    // Bottom-right corner
    if (s < arc) {
      const a = -Math.PI / 2 + (s / arc) * (Math.PI / 2);
      return target.set(ix + r * Math.cos(a), -iy + r * Math.sin(a), 0);
    }
    s -= arc;
    // Right edge
    if (s < runY) return target.set(hx, -iy + s, 0);
    s -= runY;
    // Top-right corner
    if (s < arc) {
      const a = (s / arc) * (Math.PI / 2);
      return target.set(ix + r * Math.cos(a), iy + r * Math.sin(a), 0);
    }
    s -= arc;
    // Top edge
    if (s < runX) return target.set(ix - s, hy, 0);
    s -= runX;
    // Top-left corner
    if (s < arc) {
      const a = Math.PI / 2 + (s / arc) * (Math.PI / 2);
      return target.set(-ix + r * Math.cos(a), iy + r * Math.sin(a), 0);
    }
    s -= arc;
    // Left edge
    if (s < runY) return target.set(-hx, iy - s, 0);
    s -= runY;
    // Bottom-left corner
    if (s < arc) {
      const a = Math.PI + (s / arc) * (Math.PI / 2);
      return target.set(-ix + r * Math.cos(a), -iy + r * Math.sin(a), 0);
    }
    s -= arc;
    // Bottom edge, left half
    return target.set(-ix + s, -hy, 0);
  }
}

// One plate: a glass rod of circular cross-section bent into a closed
// rounded rectangle.
//
// The circular cross-section is the point. A flat-sided bar mirrors the
// studio at a single angle, so it goes uniformly bright or uniformly dark
// and stamps hard-edged patches onto its straight runs. A round one
// sweeps continuously through every reflection angle, so some part of it
// always catches the key light -- which is what draws the single
// unbroken, blown-out streak running the length of every bar.
export const createPlateGeometry = (
  outerSize: number = PLATE_OUTER_SIZE,
  tubeRadius: number = PLATE_TUBE_RADIUS,
  aspect: number = PLATE_ASPECT,
): TubeGeometry => {
  // Corner radius follows plate size so tuning the size keeps proportions.
  const cornerRadius = PLATE_CORNER_RADIUS * (outerSize / PLATE_OUTER_SIZE);
  // The path is the rod's centreline, so inset it by the rod radius to
  // keep the requested outer silhouette.
  const curve = new RoundedRectCurve(
    outerSize - tubeRadius * 2,
    outerSize * aspect - tubeRadius * 2,
    Math.max(0.01, cornerRadius - tubeRadius),
  );
  return new TubeGeometry(
    curve,
    PLATE_TUBULAR_SEGMENTS,
    tubeRadius,
    PLATE_RADIAL_SEGMENTS,
    true,
  );
};
