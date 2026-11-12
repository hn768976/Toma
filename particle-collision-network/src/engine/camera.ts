import { V3, cross, dot, norm, sub } from "./math";

export type Projected = { x: number; y: number; z: number; f: number };

/**
 * Pinhole camera working in 4K composition pixel units (3840x2160).
 * project() returns screen position, view depth and pixels-per-world-unit.
 */
export class Camera {
  readonly W: number;
  readonly H: number;
  private pos: V3;
  private r: V3;
  private u: V3;
  private fwd: V3;
  private F: number;
  private cr: number;
  private sr: number;
  near = 0.05;

  constructor(W: number, H: number, pos: V3, target: V3, fovDeg: number, roll = 0) {
    this.W = W;
    this.H = H;
    this.pos = pos;
    this.fwd = norm(sub(target, pos));
    let up: V3 = [0, 1, 0];
    if (Math.abs(dot(up, this.fwd)) > 0.98) up = [0, 0, 1];
    this.r = norm(cross(this.fwd, up));
    this.u = cross(this.r, this.fwd);
    this.F = H / 2 / Math.tan((fovDeg * Math.PI) / 360);
    this.cr = Math.cos(roll);
    this.sr = Math.sin(roll);
  }

  get position() {
    return this.pos;
  }
  get focal() {
    return this.F;
  }

  project(p: V3): Projected | null {
    const d = sub(p, this.pos);
    const z = dot(d, this.fwd);
    if (z < this.near) return null;
    const x = dot(d, this.r) / z;
    const y = dot(d, this.u) / z;
    const xr = x * this.cr - y * this.sr;
    const yr = x * this.sr + y * this.cr;
    return { x: this.W / 2 + xr * this.F, y: this.H / 2 - yr * this.F, z, f: this.F / z };
  }

  depth(p: V3) {
    return dot(sub(p, this.pos), this.fwd);
  }
}
