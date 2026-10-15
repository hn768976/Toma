// Side-view (profile facing right) head with a midline sagittal brain section.
// All coordinates are in "reference units": a 898 x 506 frame, scaled to the
// 3840 x 2160 design frame by K. Paths are smooth Catmull-Rom curves.
import { mulberry32, range, Rng } from "../../lib/rand";
import { catmull, catmullClosed, cumulative, samplePoly, V2 } from "../../lib/spline";
void samplePoly;

export const REF_W = 898;
export const REF_H = 506;
export const K = 3840 / REF_W;

const v = (x: number, y: number): V2 => [x, y];

// ---------------------------------------------------------------- outlines
export const SKIN: V2[] = [
  v(262, 540), v(240, 470), v(222, 420), v(203, 360), v(188, 292), v(182, 228), v(190, 163), v(218, 100),
  v(270, 52), v(342, 22), v(430, 12), v(515, 18), v(588, 44), v(638, 84), v(667, 134), v(680, 192),
  v(687, 246), v(695, 280), v(699, 300), v(708, 330), v(722, 362), v(736, 390), v(739, 401), v(733, 412),
  v(718, 421), v(706, 428), v(707, 442), v(712, 455), v(705, 466), v(708, 480), v(700, 494), v(694, 512), v(690, 540),
];

export const SKULL_OUT: V2[] = [
  v(372, 424), v(322, 424), v(274, 414), v(246, 390), v(222, 345), v(203, 280), v(197, 215), v(206, 158), v(234, 104), v(284, 61), v(350, 33),
  v(430, 24), v(510, 30), v(580, 55), v(626, 92), v(654, 140), v(667, 195), v(674, 245), v(682, 285), v(688, 302),
];
export const SKULL_IN: V2[] = [
  v(374, 412), v(326, 412), v(282, 402), v(256, 380), v(236, 342), v(216, 280), v(210, 216), v(219, 162), v(245, 114), v(291, 74), v(354, 47),
  v(430, 38), v(506, 44), v(571, 67), v(613, 101), v(640, 146), v(652, 198), v(657, 245), v(660, 278),
];
// Floor of the cranium: anterior fossa, sella turcica, clivus.
export const SKULL_BASE: V2[] = [
  v(660, 278), v(630, 286), v(590, 290), v(550, 290), v(520, 296), v(504, 310), v(490, 322), v(478, 312),
];
// Clivus: thick bone from the sella down to the front of the foramen magnum.
export const CLIVUS: V2[] = [v(478, 318), v(500, 322), v(486, 352), v(466, 384), v(452, 398), v(444, 392), v(456, 360), v(470, 332)];

// Cerebrum (medial surface), closed.
export const CEREBRUM: V2[] = [
  v(646, 230), v(650, 208), v(646, 176), v(629, 130), v(600, 96), v(558, 70), v(500, 54), v(430, 49),
  v(362, 57), v(302, 82), v(258, 117), v(232, 162), v(222, 212), v(226, 256), v(240, 290), v(262, 304),
  v(298, 300), v(336, 290), v(372, 278), v(402, 264), v(432, 262), v(466, 274), v(498, 282), v(534, 278),
  v(574, 268), v(612, 254), v(636, 242),
];

// Corpus callosum as a closed band (upper surface forward, lower back).
export const CORPUS_CALLOSUM: V2[] = [
  v(362, 236), v(368, 212), v(398, 194), v(450, 186), v(500, 186), v(542, 192), v(570, 208), v(582, 230),
  v(576, 254), v(558, 266), v(544, 258), v(552, 242), v(548, 224), v(532, 208), v(500, 197), v(455, 196),
  v(416, 202), v(398, 214), v(394, 230), v(388, 248), v(372, 252),
];
export const FORNIX: V2[] = [v(394, 248), v(418, 230), v(455, 222), v(494, 224), v(520, 238), v(528, 256), v(518, 272)];
export const CINGULATE_SULCUS: V2[] = [
  v(356, 220), v(372, 184), v(415, 164), v(470, 157), v(525, 160), v(566, 174), v(592, 202), v(598, 236), v(588, 262),
];
export const THALAMUS: V2[] = [v(420, 248), v(436, 234), v(466, 230), v(490, 240), v(486, 258), v(458, 266), v(430, 262)];
export const HYPOTHALAMUS: V2[] = [v(498, 262), v(510, 278), v(505, 296), v(496, 304)];
// Pituitary gland on its stalk, sitting in the sella turcica.
export const PITUITARY: V2[] = [v(483, 309), v(492, 304), v(500, 309), v(498, 318), v(488, 320), v(481, 315)];
export const PITUITARY_STALK: V2[] = [v(496, 303), v(492, 307)];

export const BRAINSTEM_DORSAL: V2[] = [
  v(414, 262), v(408, 282), v(402, 302), v(400, 318), v(398, 346), v(392, 372), v(386, 400), v(383, 440), v(382, 480), v(381, 540),
];
export const BRAINSTEM_VENTRAL: V2[] = [
  v(452, 266), v(448, 284), v(462, 300), v(480, 318), v(484, 342), v(466, 362), v(436, 374), v(416, 392),
  v(404, 420), v(399, 460), v(397, 500), v(396, 540),
];
export const FOURTH_VENTRICLE: V2[] = [v(402, 306), v(390, 318), v(384, 330), v(392, 344), v(400, 352)];
export const PONS_LINES: V2[][] = [
  [v(410, 292), v(430, 296), v(450, 296)], // midbrain / pons boundary
  [v(408, 370), v(426, 372), v(444, 368)], // pons / medulla boundary
  [v(440, 312), v(462, 322), v(470, 340), v(458, 356)],
  [v(430, 318), v(448, 330), v(452, 350)],
];

export const CEREBELLUM: V2[] = [
  v(394, 298), v(368, 296), v(336, 300), v(300, 308), v(270, 318), v(250, 336), v(246, 360), v(262, 382),
  v(292, 398), v(330, 404), v(362, 396), v(384, 378), v(394, 354), v(390, 326),
];
export const CEREBELLUM_ROOT: V2 = v(386, 334);
// Cerebellar peduncle: white-matter stalk joining the cerebellum to the pons.
export const PEDUNCLE: V2[] = [v(366, 318), v(392, 312), v(424, 318), v(430, 340), v(404, 350), v(366, 346)];
export const CEREBELLUM_C: V2 = v(322, 350);

// Neck: vertebral bodies (front of the cord) and spinous processes (behind).
export const VERTEBRAE: { c: V2; w: number; h: number; a: number }[] = [
  { c: v(444, 404), w: 14, h: 10, a: 0.08 }, // C1 anterior arch
  { c: v(426, 438), w: 32, h: 28, a: 0.06 }, // C2 body
  { c: v(423, 472), w: 32, h: 28, a: 0.05 },
  { c: v(420, 506), w: 32, h: 28, a: 0.04 },
  { c: v(418, 540), w: 32, h: 28, a: 0.03 },
];
export const DENS: V2[] = [v(424, 424), v(426, 408), v(432, 402), v(436, 410), v(434, 424)];
export const CANAL_FRONT: V2[] = [v(404, 410), v(402, 460), v(401, 540)];
export const CANAL_BACK: V2[] = [v(376, 410), v(374, 460), v(373, 540)];
// Pons body (brighter tissue) and the septum pellucidum / ventricle.
export const PONS: V2[] = [v(420, 300), v(452, 298), v(478, 318), v(482, 342), v(462, 362), v(430, 370), v(412, 350), v(410, 320)];
export const SEPTUM: V2[] = [v(398, 216), v(450, 198), v(530, 210), v(546, 242), v(520, 238), v(494, 224), v(455, 222), v(418, 230)];
export const SPINOUS: V2[][] = [
  [v(372, 404), v(350, 398), v(326, 402)],
  [v(372, 440), v(348, 440), v(320, 452)],
  [v(371, 474), v(348, 476), v(324, 492)],
  [v(370, 508), v(348, 512), v(328, 528)],
];

// Face.
export const FRONTAL_SINUS: V2[] = [v(662, 236), v(670, 230), v(677, 244), v(677, 262), v(667, 266), v(661, 252)];
export const NASAL_CAVITY: V2[] = [
  v(684, 300), v(700, 330), v(716, 368), v(712, 392), v(690, 398), v(640, 400), v(590, 398), v(562, 392),
  v(552, 360), v(560, 330), v(600, 315), v(650, 304),
];
// Superior (small), middle, inferior (largest): scroll-shaped, curling down.
export const TURBINATES: V2[][] = [
  [v(586, 330), v(606, 322), v(628, 322), v(640, 330), v(634, 340), v(622, 336), v(604, 336)],
  [v(578, 350), v(606, 340), v(640, 340), v(662, 350), v(658, 364), v(642, 358), v(608, 356)],
  [v(574, 374), v(610, 364), v(652, 364), v(684, 374), v(682, 390), v(660, 384), v(612, 382)],
];
export const SPHENOID_SINUS: V2[] = [v(508, 326), v(526, 320), v(540, 330), v(538, 346), v(522, 350), v(510, 342)];
export const PALATE: V2[] = [v(558, 400), v(600, 404), v(650, 405), v(692, 404), v(704, 410)];
export const PALATE_LOWER: V2[] = [v(560, 408), v(600, 411), v(650, 412), v(690, 411), v(700, 415)];
export const SOFT_PALATE: V2[] = [v(558, 400), v(545, 412), v(534, 428), v(528, 440)];
export const PHARYNX_BACK: V2[] = [v(548, 352), v(522, 362), v(500, 382), v(484, 408), v(476, 436), v(472, 472), v(470, 540)];
export const PHARYNX_FRONT: V2[] = [v(528, 440), v(516, 460), v(506, 482), v(500, 510), v(498, 540)];
export const TONGUE: V2[] = [
  v(530, 450), v(552, 424), v(590, 412), v(640, 414), v(676, 428), v(684, 446), v(668, 462), v(640, 480),
  v(612, 500), v(580, 512), v(548, 506), v(530, 482),
];
export const MANDIBLE: V2[] = [v(560, 540), v(600, 518), v(650, 508), v(684, 504), v(692, 492), v(684, 470)];
export const TEETH_UP: V2[] = [v(682, 410), v(694, 412), v(698, 428), v(688, 432)];
export const TEETH_LO: V2[] = [v(680, 446), v(692, 446), v(692, 462), v(680, 462)];
export const LIP_LINE: V2[] = [v(690, 438), v(700, 440), v(708, 442)];

// ----------------------------------------------------------- generated parts
export type Generated = {
  sulci: V2[][]; // cortex folds (drawn as lines; also spark tracks)
  gyri: { w: number; h: number; x0: number; y0: number; data: Float32Array }; // gyrus shading
  arbor: { pts: V2[]; w: number }[]; // cerebellar white-matter tree
  folia: V2[][]; // cerebellar lamellae
  sparkPaths: V2[][]; // tracks the signals travel along
  burstPoints: V2[];
};

const polyArea = (p: V2[]) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
};

const inside = (pt: V2, poly: V2[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** Wiggly line from p along direction ang, staying inside `region`. */
const wander = (r: Rng, p: V2, ang: number, len: number, step: number, curl: number, region: V2[], avoid?: V2[]) => {
  const pts: V2[] = [p];
  let [x, y] = p;
  let a = ang;
  const n = Math.max(2, Math.round(len / step));
  for (let i = 0; i < n; i++) {
    a += range(r, -curl, curl);
    // pull back toward the original heading so folds stay roughly radial
    a += (ang - a) * 0.25;
    const nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
    if (!inside([nx, ny], region)) break;
    if (avoid && inside([nx, ny], avoid)) break;
    x = nx;
    y = ny;
    pts.push([x, y]);
  }
  return pts;
};

// ---------------------------------------------------------------- cortex
const lattice = (seed: number) => {
  const N = 256;
  const r = mulberry32(seed);
  const t = new Float32Array(N * N);
  for (let i = 0; i < t.length; i++) t[i] = r();
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const g = (i: number, j: number) => t[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
};

const cortexField = () => {
  const n1 = lattice(1301), n2 = lattice(7717), n3 = lattice(4441);
  const x0 = 214, y0 = 44, w = 446, h = 262; // grid in reference units, step 1
  // Raster mask of where cortex is (cerebrum minus CC, cingulate gyrus band,
  // deep structures and a thin rim under the surface).
  const mc = document.createElement("canvas");
  mc.width = w;
  mc.height = h;
  const m = mc.getContext("2d", { willReadFrequently: true })!;
  m.translate(-x0, -y0);
  const poly = (pts: V2[], closed: boolean, seg = 10) => {
    const c = closed ? catmullClosed(pts, seg) : catmull(pts, seg);
    const p = new Path2D();
    p.moveTo(c[0][0], c[0][1]);
    for (const q of c) p.lineTo(q[0], q[1]);
    if (closed) p.closePath();
    return p;
  };
  m.fillStyle = "#fff";
  m.fill(poly(CEREBRUM, true, 16));
  m.strokeStyle = "#000";
  m.fillStyle = "#000";
  m.lineWidth = 5;
  m.stroke(poly(CEREBRUM, true, 16));
  m.lineWidth = 6;
  m.stroke(poly(CINGULATE_SULCUS, false));
  m.fill(poly(CORPUS_CALLOSUM, true, 8));
  // cingulate gyrus (between CC and cingulate sulcus) stays smooth
  const cingBand = [...catmull(CINGULATE_SULCUS, 10), ...catmull([v(556, 266), v(582, 232), v(570, 208), v(542, 192), v(500, 186), v(450, 186), v(398, 194), v(368, 212), v(362, 236), v(356, 244)], 10)];
  m.fill(poly(cingBand, true, 1));
  const deep = [v(390, 252), v(416, 203), v(500, 198), v(548, 222), v(552, 242), v(544, 258), v(566, 268), v(552, 292), v(470, 290), v(400, 272), v(378, 260)];
  m.fill(poly(deep, true, 1));
  m.lineWidth = 9;
  for (const l of LANDMARKS) m.stroke(poly(l, false, 8));
  // folds live in a band under the surface and dip inward from it
  const band = document.createElement("canvas");
  band.width = w;
  band.height = h;
  const bc = band.getContext("2d")!;
  bc.translate(-x0, -y0);
  bc.strokeStyle = "#fff";
  bc.lineWidth = 2 * 80;
  bc.stroke(poly(CEREBRUM, true, 16));
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.globalCompositeOperation = "destination-in";
  m.drawImage(band, 0, 0);
  m.globalCompositeOperation = "source-over";
  const md = m.getImageData(0, 0, w, h).data;
  const C: V2 = [440, 196];
  const f = new Float32Array(w * h);
  const inC = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = x0 + i, y = y0 + j;
      const dx = x - C[0], dy = y - C[1];
      const ang = Math.atan2(dy, dx);
      const rad = Math.hypot(dx, dy * 1.35);
      // light isotropic warp for organic meanders
      const wx = (n3(x / 26, y / 26) - 0.5) * 0.3;
      const u = (ang + wx) * 30; // ~ around the brain
      const vv = rad / 40; // slower with depth: mostly radial folds
      const val = 0.72 * n1(u, vv) + 0.22 * n2(u * 2.1 + 5, vv * 2.1) + 0.06 * n3(u * 4.3, vv * 4.3);
      f[j * w + i] = val;
      inC[j * w + i] = md[(j * w + i) * 4] > 127 ? 1 : 0;
    }
  }
  // Marching squares at level 0.5 -> segments, chained into polylines.
  const LV = 0.5;
  const segs: [V2, V2][] = [];
  const lerp = (a: number, b: number) => (LV - a) / (b - a);
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const k = j * w + i;
      if (!inC[k] || !inC[k + 1] || !inC[k + w] || !inC[k + w + 1]) continue;
      const a = f[k], b = f[k + 1], c = f[k + w + 1], d = f[k + w];
      const idx = (a > LV ? 8 : 0) | (b > LV ? 4 : 0) | (c > LV ? 2 : 0) | (d > LV ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const X = x0 + i, Y = y0 + j;
      const T: V2 = [X + lerp(a, b), Y];
      const R: V2 = [X + 1, Y + lerp(b, c)];
      const B: V2 = [X + lerp(d, c), Y + 1];
      const Lp: V2 = [X, Y + lerp(a, d)];
      const table: Record<number, [V2, V2][]> = {
        1: [[Lp, B]], 2: [[B, R]], 3: [[Lp, R]], 4: [[T, R]], 5: [[Lp, T], [B, R]], 6: [[T, B]], 7: [[Lp, T]],
        8: [[Lp, T]], 9: [[T, B]], 10: [[Lp, B], [T, R]], 11: [[T, R]], 12: [[Lp, R]], 13: [[B, R]], 14: [[Lp, B]],
      };
      for (const sg of table[idx]) segs.push(sg);
    }
  }
  const key = (p: V2) => `${Math.round(p[0] * 64)},${Math.round(p[1] * 64)}`;
  const adj = new Map<string, number[]>();
  segs.forEach((sg, i) => {
    for (const p of sg) {
      const kk = key(p);
      const l = adj.get(kk);
      if (l) l.push(i); else adj.set(kk, [i]);
    }
  });
  const used = new Uint8Array(segs.length);
  const contours: V2[][] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const line: V2[] = [segs[i][0], segs[i][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const end = dir ? line[line.length - 1] : line[0];
        const cand = (adj.get(key(end)) ?? []).find((s2) => !used[s2]);
        if (cand === undefined) break;
        used[cand] = 1;
        const [p, q] = segs[cand];
        const nxt = key(p) === key(end) ? q : p;
        if (dir) line.push(nxt); else line.unshift(nxt);
      }
    }
    if (line.length < 12) continue;
    // drop small closed loops (they read as rings, not folds)
    const a0 = line[0], a1 = line[line.length - 1];
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (const q of line) { bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); }
    if (Math.hypot(a0[0] - a1[0], a0[1] - a1[1]) < 2 && Math.max(bx1 - bx0, by1 - by0) < 40) continue;
    // light smoothing + decimation
    const sm: V2[] = [];
    for (let k = 0; k < line.length; k += 2) {
      const a = line[Math.max(0, k - 2)], b = line[k], c = line[Math.min(line.length - 1, k + 2)];
      sm.push([(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4]);
    }
    contours.push(sm);
  }
  // gyrus shading: smooth step of the field inside the cortex mask
  const gy = new Float32Array(w * h);
  for (let k = 0; k < gy.length; k++) {
    const t = Math.min(1, Math.max(0, (f[k] - 0.42) / 0.16));
    gy[k] = inC[k] ? t * t * (3 - 2 * t) : 0.5;
  }
  return { contours, gyri: { w, h, x0, y0, data: gy } };
};

// Named medial sulci: calcarine, parieto-occipital, central (marginal end),
// cingulate's marginal ramus. Curved, deliberately prominent.
export const LANDMARKS: V2[][] = [
  [v(232, 234), v(250, 230), v(270, 236), v(290, 232), v(310, 240), v(332, 246), v(352, 244)],
  [v(310, 240), v(306, 222), v(298, 208), v(298, 190), v(288, 176), v(284, 158), v(274, 142)],
  [v(458, 52), v(466, 68), v(462, 84), v(472, 100), v(468, 116), v(476, 132)],
  [v(372, 182), v(368, 160), v(362, 134), v(352, 112), v(344, 92)],
];

export const generate = (): Generated => {
  const r = mulberry32(20250409);
  const sulci: V2[][] = [];
  const outline = catmullClosed(CEREBRUM, 16);
  const cum = cumulative([...outline, outline[0]]);
  const L = cum[cum.length - 1];
  const ccRegion = catmullClosed(CORPUS_CALLOSUM, 8);
  const sign = polyArea(CEREBRUM) > 0 ? 1 : -1;
  // Gyri and sulci: contour lines of an anisotropic noise field over the
  // cortex. The field varies fast around the brain and slowly with radius,
  // so folds run roughly radially near the surface and meander deeper in.
  const field = cortexField();
  sulci.push(...field.contours);
  const cingPts = catmull(CINGULATE_SULCUS, 10);
  void outline; void cum; void L; void ccRegion; void sign; void wander;
  // Named sulci on the medial surface.
  sulci.push(...LANDMARKS.map((l) => catmull(l, 8)));

  // Cerebellum: arbor vitae (branching tree) and folia.
  const arbor: { pts: V2[]; w: number }[] = [];
  const cb = catmullClosed(CEREBELLUM, 10);
  const grow = (p: V2, ang: number, len: number, w: number, depth: number) => {
    const pts = wander(r, p, ang, len, 2.2, 0.28, cb);
    if (pts.length < 2) return;
    arbor.push({ pts, w });
    if (depth <= 0) return;
    const n = depth > 2 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const at = pts[Math.min(pts.length - 1, Math.floor(((k + 1) / (n + 0.6)) * pts.length))];
      grow(at, ang + range(r, -0.75, 0.75), len * range(r, 0.5, 0.72), w * 0.62, depth - 1);
    }
  };
  const root = CEREBELLUM_ROOT;
  const trunkEnd: V2 = [root[0] - 20, root[1] + 3];
  arbor.push({ pts: [root, trunkEnd], w: 4.2 });
  for (let i = 0; i < 7; i++) {
    const ang = Math.PI + (i - 3) * 0.36 + range(r, -0.08, 0.08);
    grow(trunkEnd, ang, range(r, 34, 48), 2.6, 4);
  }
  const folia: V2[][] = [];
  const c = CEREBELLUM_C;
  const SECT = 30;
  const span = Math.PI * 2 - 0.9;
  for (let sct = 0; sct < SECT; sct++) {
    const a0 = 0.45 + (sct / SECT) * span;
    const a1 = a0 + span / SECT;
    const stagger = range(r, 0, 0.03);
    for (let k = 1; k <= 8; k++) {
      const sc = 1 - k * 0.045 - stagger;
      const arc: V2[] = [];
      for (let q = 0; q <= 5; q++) {
        const ang = a0 + ((a1 - a0) * q) / 5;
        let best = cb[0], bd = 1e9;
        for (const pnt of cb) {
          let d = Math.atan2(pnt[1] - c[1], pnt[0] - c[0]) - ang;
          d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
          if (d < bd) { bd = d; best = pnt; }
        }
        const R = Math.hypot(best[0] - c[0], best[1] - c[1]) * sc;
        arc.push([c[0] + Math.cos(ang) * R, c[1] + Math.sin(ang) * R]);
      }
      folia.push(arc);
    }
  }

  // Signal tracks: the longest folds, the corpus callosum arcs, cingulate.
  const tracks = sulci
    .filter((s) => s.length >= 14)
    .map((s) => (r() < 0.5 ? s : [...s].reverse()))
    .slice(0, 160);
  const ccMid = catmull([v(374, 222), v(398, 198), v(450, 183), v(505, 183), v(548, 194), v(574, 216), v(576, 238), v(560, 254)], 12);
  const sparkPaths: V2[][] = [
    ...tracks,
    ccMid,
    [...ccMid].reverse(),
    catmull(FORNIX, 10),
    cingPts,
    [...cingPts].reverse(),
    catmull([v(410, 266), v(432, 246), v(462, 238), v(500, 244)], 10),
    catmull([v(388, 330), v(360, 336), v(326, 344), v(290, 352)], 8),
    catmull([v(440, 266), v(440, 300), v(440, 340), v(410, 380), v(392, 430), v(389, 500)], 10),
  ];
  const burstPoints: V2[] = [v(300, 180), v(440, 120), v(560, 140), v(455, 250), v(322, 350), v(600, 230)];
  // hotspot where the brainstem meets the cerebellum
  burstPoints.push(v(392, 318));
  return { sulci, gyri: field.gyri, arbor, folia, sparkPaths, burstPoints };
};
