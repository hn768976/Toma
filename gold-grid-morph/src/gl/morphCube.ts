import * as THREE from "three";

// A unit cube whose edges can be rounded continuously all the way to a sphere.
// Vertices are re-placed analytically each frame (exact rounded-box surface and
// exact normals), with the parameter spacing biased toward the rounded edges so
// that both the crisp-cube and the sphere ends stay smooth.
export class MorphCube {
  readonly geometry = new THREE.BufferGeometry();
  private params: Float32Array; // per vertex: face-local (a, b) and face index

  constructor(segs = 14) {
    const n = segs + 1;
    const vCount = 6 * n * n;
    this.params = new Float32Array(vCount * 3);
    const index: number[] = [];
    let k = 0;
    for (let f = 0; f < 6; f++) {
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          this.params[k * 3] = (i / segs) * 2 - 1;
          this.params[k * 3 + 1] = (j / segs) * 2 - 1;
          this.params[k * 3 + 2] = f;
          k++;
        }
      }
      const base = f * n * n;
      for (let j = 0; j < segs; j++) {
        for (let i = 0; i < segs; i++) {
          const a = base + j * n + i;
          const b = a + 1;
          const c = a + n;
          const d = c + 1;
          index.push(a, b, d, a, d, c);
        }
      }
    }
    this.geometry.setIndex(index);
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vCount * 3), 3),
    );
    this.geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(vCount * 3), 3),
    );
    this.setRoundness(0.05);
  }

  // roundness: rounding radius relative to half-size, 0..1 (1 = sphere)
  setRoundness(roundness: number) {
    const r = 0.5 * THREE.MathUtils.clamp(roundness, 0.001, 1);
    const h = 0.5 - r;
    const q = 0.72 * (h / 0.5); // share of parameter range given to flat zone
    const warp = (s: number) => {
      const as = Math.abs(s);
      const x = as < q ? (as / Math.max(q, 1e-6)) * h : h + ((as - q) / (1 - q)) * r;
      return Math.sign(s) * x;
    };
    // Mid-morph the flat caps also swell toward the sphere, so they read as
    // pillows rather than flat mirrors (which look like rings at grazing
    // view angles).
    const swell = 0.4 * Math.sin(Math.PI * THREE.MathUtils.clamp(roundness, 0, 1));
    const pos = this.geometry.attributes.position.array as Float32Array;
    const nor = this.geometry.attributes.normal.array as Float32Array;
    const count = this.params.length / 3;
    for (let k = 0; k < count; k++) {
      const a = warp(this.params[k * 3]);
      const b = warp(this.params[k * 3 + 1]);
      const f = this.params[k * 3 + 2];
      let x = 0,
        y = 0,
        z = 0;
      // faces: +x, -x, +y, -y, +z, -z (winding chosen so normals face out)
      switch (f) {
        case 0: x = 0.5; y = b; z = -a; break;
        case 1: x = -0.5; y = b; z = a; break;
        case 2: x = a; y = 0.5; z = -b; break;
        case 3: x = a; y = -0.5; z = b; break;
        case 4: x = a; y = b; z = 0.5; break;
        default: x = -a; y = b; z = -0.5; break;
      }
      const cx = Math.max(-h, Math.min(h, x));
      const cy = Math.max(-h, Math.min(h, y));
      const cz = Math.max(-h, Math.min(h, z));
      let nx = x - cx,
        ny = y - cy,
        nz = z - cz;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      let px = cx + nx * r;
      let py = cy + ny * r;
      let pz = cz + nz * r;
      if (swell > 0) {
        const pl = Math.hypot(px, py, pz) || 1;
        const sx = px / pl, sy = py / pl, sz = pz / pl;
        px += (sx * 0.5 - px) * swell;
        py += (sy * 0.5 - py) * swell;
        pz += (sz * 0.5 - pz) * swell;
        nx += (sx - nx) * swell;
        ny += (sy - ny) * swell;
        nz += (sz - nz) * swell;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
      }
      pos[k * 3] = px;
      pos[k * 3 + 1] = py;
      pos[k * 3 + 2] = pz;
      nor[k * 3] = nx;
      nor[k * 3 + 1] = ny;
      nor[k * 3 + 2] = nz;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  dispose() {
    this.geometry.dispose();
  }
}
