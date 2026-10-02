// Minimal pinhole camera for the Pixi looks: world → screen px + view depth.
export class Projector {
  cx = 0;
  cy = 0;
  cz = 0;
  // rows of the world→view rotation
  r = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  focal = 1000;
  w = 1280;
  h = 720;
  // out
  x = 0;
  y = 0;
  z = 0;

  set(pos: [number, number, number], yaw: number, pitch: number, roll: number, fovDeg: number, w: number, h: number) {
    this.cx = pos[0];
    this.cy = pos[1];
    this.cz = pos[2];
    this.w = w;
    this.h = h;
    this.focal = h / 2 / Math.tan((fovDeg * Math.PI) / 360);
    // camera looks down -z; R = Rz(roll) * Rx(pitch) * Ry(yaw), applied to (p - c)
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw),
      cp = Math.cos(pitch),
      sp = Math.sin(pitch),
      cr = Math.cos(roll),
      sr = Math.sin(roll);
    // Ry
    const a = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
    // Rx
    const b = [1, 0, 0, 0, cp, sp, 0, -sp, cp];
    const ba = mul(b, a);
    const c = [cr, sr, 0, -sr, cr, 0, 0, 0, 1];
    this.r = mul(c, ba);
  }

  // returns false if behind the near plane
  project(px: number, py: number, pz: number, near = 0.2): boolean {
    const dx = px - this.cx,
      dy = py - this.cy,
      dz = pz - this.cz;
    const r = this.r;
    const vx = r[0] * dx + r[1] * dy + r[2] * dz;
    const vy = r[3] * dx + r[4] * dy + r[5] * dz;
    const vz = r[6] * dx + r[7] * dy + r[8] * dz;
    const z = -vz;
    this.z = z;
    if (z < near) return false;
    this.x = this.w / 2 + (vx / z) * this.focal;
    this.y = this.h / 2 - (vy / z) * this.focal;
    return true;
  }
}

const mul = (a: number[], b: number[]) => {
  const o = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return o;
};
