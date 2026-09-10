// Chalk stroking helpers.
//
// Clean vector line work makes this read as a technical diagram. The
// reference reads as chalk on slate: width wanders along a line, edges
// are soft, and the pigment breaks up in patches. All three are faked
// here -- geometry is jittered before it is stroked, every line is laid
// down in two slightly offset passes, and the finished drawing gets its
// alpha channel multiplied by a tileable noise mask.
//
// Everything is driven by a seeded PRNG. Remotion renders frames out of
// order across workers, so nothing may depend on Math.random() or on
// call order across frames -- the wheel is built once per worker and the
// same seed must reproduce it byte for byte.

export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export type Point = { x: number; y: number };

export const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// A circle as a jittered polyline. `wobble` is in the same units as the
// radius, so a hand-drawn circle stays proportionally wobbly at any size.
export const jitterCircle = (
  cx: number,
  cy: number,
  radius: number,
  rng: Rng,
  wobble: number,
  segments = 220,
): Point[] => {
  const points: Point[] = [];
  // Two slow harmonics rather than per-vertex noise: a hand-drawn circle
  // drifts off-round, it doesn't have a furry edge.
  const phase1 = rng() * Math.PI * 2;
  const phase2 = rng() * Math.PI * 2;
  const amp1 = wobble * (0.6 + rng() * 0.5);
  const amp2 = wobble * (0.3 + rng() * 0.4);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const r =
      radius +
      amp1 * Math.sin(a * 2 + phase1) +
      amp2 * Math.sin(a * 3 + phase2) +
      (rng() - 0.5) * wobble * 0.35;
    points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return points;
};

// A straight run, bowed slightly off true and broken into a few segments
// so the stroke pass can vary its width along the length.
export const jitterLine = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rng: Rng,
  wobble: number,
  segments = 8,
): Point[] => {
  const points: Point[] = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bow = (rng() - 0.5) * wobble * 2;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Bow peaks mid-line and dies at both ends so joins stay tight.
    const off = bow * Math.sin(Math.PI * t) + (rng() - 0.5) * wobble * 0.5;
    points.push({ x: x1 + dx * t + nx * off, y: y1 + dy * t + ny * off });
  }
  return points;
};

// Strokes a polyline segment by segment with a wandering width. Drawn
// twice at a sub-pixel offset: the overlap thickens some stretches and
// leaves others thin, which is most of the chalk impression.
export const strokeChalkPolyline = (
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  alpha: number,
  rng: Rng,
) => {
  if (points.length < 2) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let pass = 0; pass < 2; pass++) {
    const ox = (rng() - 0.5) * width * 0.5;
    const oy = (rng() - 0.5) * width * 0.5;
    ctx.globalAlpha = alpha * (pass === 0 ? 0.78 : 0.5);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      ctx.lineWidth = width * (0.68 + rng() * 0.72);
      ctx.beginPath();
      ctx.moveTo(a.x + ox, a.y + oy);
      ctx.lineTo(b.x + ox, b.y + oy);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
};

// Same idea for glyph outlines, which arrive as Path2D and can't be
// re-sampled: vary the whole stroke instead of each segment.
export const strokeChalkPath = (
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  width: number,
  alpha: number,
  rng: Rng,
) => {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const passes = 3;
  for (let pass = 0; pass < passes; pass++) {
    ctx.save();
    ctx.translate((rng() - 0.5) * width * 0.42, (rng() - 0.5) * width * 0.42);
    ctx.rotate((rng() - 0.5) * 0.004);
    ctx.lineWidth = width * (0.72 + rng() * 0.5);
    ctx.globalAlpha = alpha * (pass === 0 ? 0.72 : 0.34);
    ctx.stroke(path);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
};

// A tileable grain mask, used two ways: multiplied into the wheel's
// alpha so pigment breaks up along every line, and laid over the whole
// frame as dust. The blur is a wrap-around box blur done by hand --
// ctx.filter clamps at the canvas edge and would leave a visible grid
// once the tile repeats.
export const createNoiseTile = (
  size: number,
  seed: number,
  floor: number,
  gain: number,
) => {
  const rng = mulberry32(seed);
  const count = size * size;
  const raw = new Float32Array(count);
  for (let i = 0; i < count; i++) raw[i] = rng();

  const blurred = new Float32Array(count);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = (y + dy + size) % size;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = (x + dx + size) % size;
          sum += raw[yy * size + xx];
        }
      }
      blurred[y * size + x] = sum / 9;
    }
  }

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < count; i++) {
    // Push the blurred field back out around its mean so the patches
    // read as pigment density rather than flat grey.
    const centred = (blurred[i] - 0.5) * 2.4 + 0.5;
    const value = Math.max(0, Math.min(1, floor + gain * centred));
    image.data[i * 4] = 255;
    image.data[i * 4 + 1] = 255;
    image.data[i * 4 + 2] = 255;
    image.data[i * 4 + 3] = Math.round(value * 255);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};
