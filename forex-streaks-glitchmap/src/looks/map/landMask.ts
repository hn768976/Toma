import topo from "../../data/natural-earth-land-110m.topo.json";

// Natural Earth 110m land (public domain), as TopoJSON from `world-atlas`.
// It is decoded and rasterised ONCE into a grid of COLS x ROWS cells.

// Grid size. The brief says about 230 x 130 (17 px at 4K), but measuring the
// reference clip (autocorrelation of the land texture) gives a glyph pitch of
// about 5.1 x 5.6 px at 768 px wide: roughly 150 x 77 cells (25.6 x 28 px at
// 4K). The reference wins; change these two numbers to get the 230 x 130 grid.
export const COLS = 150;
export const ROWS = 77;

/** Latitude (degrees) at the top edge of the map frame (Miller projection). */
export const TOP_LAT = 79.5;

type Pt = [number, number];

const decodeArcs = (): Pt[][] => {
  const [sx, sy] = topo.transform.scale;
  const [tx, ty] = topo.transform.translate;
  return (topo.arcs as number[][][]).map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty] as Pt;
    });
  });
};

const ringFromArcs = (indices: number[], arcs: Pt[][]): Pt[] => {
  const out: Pt[] = [];
  for (const i of indices) {
    const arc = i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
    for (let k = out.length ? 1 : 0; k < arc.length; k++) out.push(arc[k]);
  }
  return out;
};

const getRings = (): Pt[][] => {
  const arcs = decodeArcs();
  const rings: Pt[][] = [];
  const obj = topo.objects.land as {
    type: string;
    geometries?: Array<{ type: string; arcs: number[][] | number[][][] }>;
    arcs?: number[][] | number[][][];
  };
  const geoms = obj.geometries ?? [obj as { type: string; arcs: number[][] | number[][][] }];
  for (const g of geoms) {
    if (g.type === "MultiPolygon") {
      for (const poly of g.arcs as number[][][]) for (const ring of poly as unknown as number[][]) rings.push(ringFromArcs(ring, arcs));
    } else if (g.type === "Polygon") {
      for (const ring of g.arcs as unknown as number[][]) rings.push(ringFromArcs(ring, arcs));
    }
  }
  return rings;
};

const miller = (latDeg: number): number => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * (latDeg * Math.PI) / 180));

export interface LandGrid {
  /** Coverage 0..1 per cell (row-major, ROWS x COLS). */
  coverage: Float32Array;
  /** Coverage blurred over a few cells; high deep inland, low on coasts and in the sea. */
  inland: Float32Array;
}

let cached: LandGrid | null = null;

export const buildLandGrid = (): LandGrid => {
  if (cached) return cached;
  const SS = 6; // supersampling per cell
  const W = COLS * SS;
  const H = ROWS * SS;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  const unit = W / (2 * Math.PI); // px per Miller unit
  const top = miller(TOP_LAT);
  const project = ([lon, lat]: Pt): Pt => [((lon + 180) / 360) * W, (top - miller(lat)) * unit];

  ctx.beginPath();
  for (const ring of getRings()) {
    // Skip Antarctica: the polar edge is drawn as a thin dashed band instead.
    let maxLat = -90;
    for (const p of ring) if (p[1] > maxLat) maxLat = p[1];
    if (maxLat < -60) continue;
    // Unwrap longitudes so rings that cross the antimeridian (Chukotka, Fiji)
    // stay contiguous, then draw them shifted by -360/0/+360 so the part that
    // wraps appears on the other edge instead of smearing across the map.
    const lon: number[] = [];
    let prev = ring[0][0];
    for (const p of ring) {
      let l = p[0];
      while (l - prev > 180) l -= 360;
      while (l - prev < -180) l += 360;
      lon.push(l);
      prev = l;
    }
    for (const shift of [-360, 0, 360]) {
      ring.forEach((p, i) => {
        const [x, y] = project([lon[i] + shift, Math.max(-84, Math.min(84, p[1]))]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
  }
  ctx.fillStyle = "#fff";
  ctx.fill("evenodd");

  const data = ctx.getImageData(0, 0, W, H).data;
  const coverage = new Float32Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let sum = 0;
      for (let y = 0; y < SS; y++) {
        for (let x = 0; x < SS; x++) sum += data[((r * SS + y) * W + c * SS + x) * 4];
      }
      coverage[r * COLS + c] = sum / (255 * SS * SS);
    }
  }

  // Separable box blur (radius 3 cells) for the "inland-ness" measure.
  const R = 3;
  const tmp = new Float32Array(COLS * ROWS);
  const inland = new Float32Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let s = 0;
      for (let k = -R; k <= R; k++) s += coverage[r * COLS + Math.min(COLS - 1, Math.max(0, c + k))];
      tmp[r * COLS + c] = s / (2 * R + 1);
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let s = 0;
      for (let k = -R; k <= R; k++) s += tmp[Math.min(ROWS - 1, Math.max(0, r + k)) * COLS + c];
      inland[r * COLS + c] = s / (2 * R + 1);
    }
  }
  cached = { coverage, inland };
  return cached;
};
