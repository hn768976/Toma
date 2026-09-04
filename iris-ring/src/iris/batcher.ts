const LEVELS = 32; // per channel

// Channels are quantised on a square-root (roughly perceptual) curve rather
// than linearly. With additive compositing most dots are very dim and carry
// the body of the iris; a linear 8-level-wide bucket would round them all to
// zero and hollow the field out.
const ENC = new Uint8Array(256);
const DEC = new Float64Array(LEVELS);
for (let v = 0; v < 256; v++) {
  ENC[v] = Math.round(Math.sqrt(v / 255) * (LEVELS - 1));
}
for (let i = 0; i < LEVELS; i++) {
  DEC[i] = Math.round(Math.pow(i / (LEVELS - 1), 2) * 255);
}

// Groups additive dots by quantised colour so the canvas takes one
// fillStyle assignment and one fill() per colour bucket instead of per dot.
// With ~100k dots a frame this is the difference between usable and not.
export class DotBatcher {
  private buckets = new Map<number, number[]>();

  add(x: number, y: number, radius: number, r: number, g: number, b: number) {
    const qr = ENC[r < 0 ? 0 : r > 255 ? 255 : r | 0];
    const qg = ENC[g < 0 ? 0 : g > 255 ? 255 : g | 0];
    const qb = ENC[b < 0 ? 0 : b > 255 ? 255 : b | 0];
    if (qr === 0 && qg === 0 && qb === 0) return; // invisible once quantised
    const key = (qr << 10) | (qg << 5) | qb;
    let bucket = this.buckets.get(key);
    if (bucket === undefined) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    bucket.push(x, y, radius);
  }

  get bucketCount() {
    return this.buckets.size;
  }

  flush(ctx: CanvasRenderingContext2D) {
    const TAU = Math.PI * 2;
    for (const [key, pts] of this.buckets) {
      const r = DEC[(key >> 10) & 31];
      const g = DEC[(key >> 5) & 31];
      const b = DEC[key & 31];
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 3) {
        const x = pts[i];
        const y = pts[i + 1];
        const rad = pts[i + 2];
        ctx.moveTo(x + rad, y);
        ctx.arc(x, y, rad, 0, TAU);
      }
      ctx.fill();
    }
    this.buckets.clear();
  }
}
