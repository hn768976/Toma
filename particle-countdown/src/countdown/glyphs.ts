/**
 * Rasterises each countdown number with the bundled Barlow Medium font and
 * samples particle "home" positions from the glyph coverage.
 * Positions are returned in 4K reference pixels relative to the frame centre
 * (x right, y up) so they are independent of the output resolution.
 */
export const REF_W = 3840;
export const REF_H = 2160;

/** Height of the numerals' cap height relative to frame height (from reference ≈ 0.51). */
const DIGIT_HEIGHT = 0.51 * REF_H;
/** Vertical centre of the numerals, as a fraction of frame height from the top. */
const DIGIT_CENTER_Y = 0.51;

export const FONT_FAMILY = "CountdownBarlow";

/** Deterministic PRNG (mulberry32). */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type GlyphSamples = {
  /** interleaved x,y (reference px, centred, y up) */
  points: Float32Array;
  /** interleaved x,y of points close to the glyph outline (for edge sparkle) */
  edge: Float32Array;
  centroid: [number, number];
};

const RASTER = 1024; // raster size for sampling (glyph is scaled into it)

export const sampleGlyph = (text: string, count: number, edgeCount: number, seed: number): GlyphSamples => {
  const canvas = document.createElement("canvas");
  canvas.width = RASTER;
  canvas.height = RASTER;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");

  // Measure cap height to fit the reference digit height.
  const probeSize = 600;
  ctx.font = `500 ${probeSize}px ${FONT_FAMILY}`;
  const m = ctx.measureText("0");
  const capH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const fontSize = (probeSize * (RASTER * 0.8)) / capH; // cap height = 80 % of raster
  ctx.font = `500 ${fontSize}px ${FONT_FAMILY}`;
  // Slightly tight tracking like the reference ("10" sits close together).
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${-0.02 * fontSize}px`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  const mm = ctx.measureText(text);
  const glyphH = mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent;
  const baseline = RASTER / 2 + glyphH / 2 - mm.actualBoundingBoxDescent;
  ctx.fillText(text, RASTER / 2, baseline);

  const data = ctx.getImageData(0, 0, RASTER, RASTER).data;
  const alpha = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= RASTER || y >= RASTER) return 0;
    return data[(y * RASTER + x) * 4 + 3] / 255;
  };

  // Collect covered pixels + edge pixels.
  const inside: number[] = [];
  const edges: number[] = [];
  for (let y = 0; y < RASTER; y++) {
    for (let x = 0; x < RASTER; x++) {
      const a = alpha(x, y);
      if (a > 0.5) {
        inside.push(x, y);
        const e = alpha(x - 3, y) < 0.5 || alpha(x + 3, y) < 0.5 || alpha(x, y - 3) < 0.5 || alpha(x, y + 3) < 0.5;
        if (e) edges.push(x, y);
      }
    }
  }
  if (inside.length === 0) throw new Error(`Glyph "${text}" rasterised empty – font not loaded?`);

  const rand = mulberry32(seed);
  const scale = DIGIT_HEIGHT / (RASTER * 0.8);
  const cy = (0.5 - DIGIT_CENTER_Y) * REF_H; // y-up offset of the digit centre
  const toRef = (px: number, py: number): [number, number] => [
    (px - RASTER / 2 + (rand() - 0.5)) * scale,
    -(py - RASTER / 2 + (rand() - 0.5)) * scale + cy,
  ];

  const points = new Float32Array(count * 2);
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rand() * (inside.length / 2)) * 2;
    const [x, y] = toRef(inside[k], inside[k + 1]);
    points[i * 2] = x;
    points[i * 2 + 1] = y;
    sx += x;
    sy += y;
  }
  const edge = new Float32Array(edgeCount * 2);
  for (let i = 0; i < edgeCount; i++) {
    const k = Math.floor(rand() * (edges.length / 2)) * 2;
    const [x, y] = toRef(edges[k], edges[k + 1]);
    edge[i * 2] = x;
    edge[i * 2 + 1] = y;
  }
  return { points, edge, centroid: [sx / count, sy / count] };
};
