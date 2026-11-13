import * as THREE from "three";

export const KIND_SHELL = 0;
export const KIND_WIRE = 1;
export const KIND_RUNG = 2;
export const KIND_RING = 3;

export type HelixSpec = {
  /** Helix radius (axis -> strand centre). */
  radius: number;
  /** Axial length of one full turn. */
  pitch: number;
  phase: number;
  /** Axial extent of the built geometry. */
  x0: number;
  x1: number;
  /** Tube radius of the thick strand; the thin strand is derived from it. */
  tube: number;
  rng: () => number;
};

const TWO_PI = Math.PI * 2;
/** Angular offset between the two strands (slightly less than PI -> major/minor groove). */
export const STRAND_OFFSET = Math.PI * 0.94;

class Builder {
  pos: number[] = [];
  nor: number[] = [];
  ax: number[] = [];
  data: number[] = [];
  idx: number[] = [];
  count = 0;

  vertex(
    p: THREE.Vector3,
    n: THREE.Vector3,
    x: number,
    kind: number,
    strand: number,
    v: number,
  ) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.ax.push(x);
    this.data.push(kind, strand, v);
    return this.count++;
  }

  /** Connect two consecutive rings of `radial` vertices each. */
  bridge(a: number, b: number, radial: number) {
    for (let j = 0; j < radial; j++) {
      const j1 = (j + 1) % radial;
      this.idx.push(a + j, a + j1, b + j, a + j1, b + j1, b + j);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("aX", new THREE.Float32BufferAttribute(this.ax, 1));
    g.setAttribute("aData", new THREE.Float32BufferAttribute(this.data, 3));
    g.setIndex(this.idx);
    return g;
  }
}

/**
 * Builds one double helix as a single geometry. Every vertex carries its axial
 * coordinate (aX) so the shader can reveal the strands progressively, and a
 * (kind, strand, v) tuple that selects the look.
 */
export const buildHelixGeometry = (spec: HelixSpec) => {
  const { radius: R, pitch, phase, x0, x1, tube, rng } = spec;
  const k = TWO_PI / pitch;
  const b = new Builder();

  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const N1 = new THREE.Vector3();
  const N2 = new THREE.Vector3();
  const tmpP = new THREE.Vector3();
  const tmpN = new THREE.Vector3();

  const frame = (x: number, strand: number) => {
    const th = k * x + phase + strand * STRAND_OFFSET;
    const c = Math.cos(th);
    const s = Math.sin(th);
    P.set(x, R * c, R * s);
    T.set(1, -R * k * s, R * k * c).normalize();
    N1.set(0, c, s);
    N2.crossVectors(T, N1).normalize();
  };

  const ring = (
    x: number,
    strand: number,
    rho: number,
    radial: number,
    kind: number,
    v: number,
    shift = 0,
  ) => {
    frame(x, strand);
    const first = b.count;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * TWO_PI;
      tmpN
        .copy(N1)
        .multiplyScalar(Math.cos(a))
        .addScaledVector(N2, Math.sin(a));
      tmpP.copy(P).addScaledVector(tmpN, rho).addScaledVector(T, shift);
      b.vertex(tmpP, tmpN, x, kind, strand, v);
    }
    return first;
  };

  // Segment layout for the shells: irregular lengths, some sleeves slightly thicker.
  const segStep = 0.075;
  for (let strand = 0; strand < 2; strand++) {
    const baseRho = strand === 0 ? tube : tube * 0.66;

    // ---- shell (segmented tube) ----
    let x = x0;
    let prev = -1;
    while (x < x1) {
      const segLen = 0.55 + rng() * 0.75;
      const thick = rng() > 0.62 ? 1.14 : 1.0;
      const tone = rng();
      const xe = Math.min(x + segLen, x1);
      const n = Math.max(2, Math.ceil((xe - x) / segStep));
      prev = -1;
      for (let i = 0; i <= n; i++) {
        const xi = x + ((xe - x) * i) / n;
        // v packs per-segment tone (integer part unused) and the 0..1 position in the segment
        const first = ring(
          xi,
          strand,
          baseRho * thick,
          14,
          KIND_SHELL,
          i / n + Math.floor(tone * 8) * 2,
        );
        if (prev >= 0) b.bridge(prev, first, 14);
        prev = first;
      }
      x = xe;
    }

    // ---- wire (thin emissive core that leads the growth) ----
    {
      const n = Math.ceil((x1 - x0) / 0.09);
      let p = -1;
      for (let i = 0; i <= n; i++) {
        const xi = x0 + ((x1 - x0) * i) / n;
        const first = ring(xi, strand, tube * 0.2, 6, KIND_WIRE, 0);
        if (p >= 0) b.bridge(p, first, 6);
        p = first;
      }
    }

    // ---- marker rings ----
    {
      let xr = x0 + rng() * 0.6;
      while (xr < x1 - 0.2) {
        const rho = baseRho * (strand === 0 ? 1.16 : 1.3);
        const half = strand === 0 ? 0.013 : 0.011;
        const a = ring(xr - half, strand, rho, 14, KIND_RING, 0);
        const c = ring(xr + half, strand, rho, 14, KIND_RING, 1);
        b.bridge(a, c, 14);
        xr += (strand === 0 ? 0.45 : 0.7) + rng() * (strand === 0 ? 1.1 : 1.6);
      }
    }

    // ---- rungs (base pairs): ladder steps from the thick strand to the thin one ----
    if (strand === 0) {
      let xr = x0 + rng() * 0.3;
      const X = new THREE.Vector3(1, 0, 0);
      const side = new THREE.Vector3();
      const pA = new THREE.Vector3();
      const dir = new THREE.Vector3();
      while (xr < x1 - 0.1) {
        if (rng() > 0.12) {
          const thA = k * xr + phase;
          const thB = thA + STRAND_OFFSET;
          pA.set(xr, R * Math.cos(thA), R * Math.sin(thA));
          dir.set(xr, R * Math.cos(thB), R * Math.sin(thB)).sub(pA);
          const L = dir.length();
          dir.normalize();
          // most steps span the full gap, some are short teeth
          const full = rng() > 0.3;
          const reach = full ? L - tube * 0.4 : L * (0.25 + rng() * 0.4);
          const rr = tube * 0.055;
          side.crossVectors(X, dir).normalize();
          const rings: number[] = [];
          for (let e = 0; e < 2; e++) {
            const d = e === 0 ? baseRho * 0.6 : reach;
            const first = b.count;
            for (let j = 0; j < 5; j++) {
              const a = (j / 5) * TWO_PI;
              tmpN
                .copy(X)
                .multiplyScalar(Math.cos(a))
                .addScaledVector(side, Math.sin(a));
              tmpP.copy(pA).addScaledVector(dir, d).addScaledVector(tmpN, rr);
              b.vertex(tmpP, tmpN, xr, KIND_RUNG, strand, e);
            }
            rings.push(first);
          }
          b.bridge(rings[0], rings[1], 5);
        }
        xr += 0.3 + rng() * 0.12;
      }
    }
  }

  return b.build();
};
