// Canvas renderer for the North America data-map.
//
// Everything lands on one canvas so the layers can share additive compositing:
// overlapping glows accumulate the way they do in the reference, and a single
// downscaled blur pass at the end supplies the bloom.

import {
  BLOOM_BLUR_PX,
  BLOOM_DOWNSCALE,
  BLOOM_STRENGTH,
  DOT_FILL,
  PING_MIN_WEIGHT,
  PING_PERIOD,
} from "./constants";
import { Camera, makeProjector, Project, Projected, scratch } from "./camera";
import {
  borders,
  cities,
  cityPhase,
  coast,
  DOT_BUCKETS,
  DOT_SPACING,
  dotBuckets,
  graticule,
  routes,
} from "./geo";
import { mixRgb, rgba, Theme } from "./themes";

export type Scene = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Resolution multiple relative to 1080p. */
  res: number;
  frame: number;
  durationInFrames: number;
  theme: Theme;
  camera: Camera;
};

// ---------------------------------------------------------------- scratch

const p: Projected = scratch();
const q: Projected = scratch();
/** Reused vertex buffer; sized to the longest baked ring. */
const buf = new Float32Array(
  2 * Math.max(...coast.map((r) => r.length), ...borders.map((r) => r.length)),
);

let bloomCanvas: HTMLCanvasElement | null = null;

// ------------------------------------------------------------ dot sprites

const spriteCache = new Map<string, HTMLCanvasElement[]>();

/**
 * One soft round sprite per brightness bucket. Blitting a cached sprite is far
 * cheaper than building 20k arc paths every frame, and gives each land dot the
 * faint halo the reference has.
 */
const dotSprites = (theme: Theme): HTMLCanvasElement[] => {
  const key = theme.id;
  const hit = spriteCache.get(key);
  if (hit) return hit;

  const S = 32;
  const made: HTMLCanvasElement[] = [];
  for (let b = 0; b < DOT_BUCKETS; b++) {
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const g = c.getContext("2d")!;
    const t = b / (DOT_BUCKETS - 1);
    const col = mixRgb(theme.dotLow, theme.dotHigh, t);
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, rgba(col, 1));
    grad.addColorStop(0.16, rgba(col, 0.9));
    grad.addColorStop(0.30, rgba(col, 0.34));
    grad.addColorStop(0.52, rgba(col, 0.07));
    grad.addColorStop(1, rgba(col, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    made.push(c);
  }
  spriteCache.set(key, made);
  return made;
};

// ------------------------------------------------------------- primitives

/** Projects a flat [x, y, ...] ring into `buf`, returning the vertex count. */
const projectRing = (ring: Float32Array, project: Project): number => {
  let n = 0;
  for (let i = 0; i < ring.length; i += 2) {
    if (!project(ring[i], ring[i + 1], p)) continue;
    buf[n * 2] = p.x;
    buf[n * 2 + 1] = p.y;
    n++;
  }
  return n;
};

const strokeBuffer = (ctx: CanvasRenderingContext2D, n: number) => {
  if (n < 2) return;
  ctx.beginPath();
  ctx.moveTo(buf[0], buf[1]);
  for (let i = 1; i < n; i++) ctx.lineTo(buf[i * 2], buf[i * 2 + 1]);
  ctx.stroke();
};

// ------------------------------------------------------------------ layers

const drawBackground = (s: Scene) => {
  const { ctx, width, height, theme } = s;
  ctx.fillStyle = theme.bgOuter;
  ctx.fillRect(0, 0, width, height);

  const g = ctx.createRadialGradient(
    width * 0.42,
    height * 0.44,
    0,
    width * 0.42,
    height * 0.44,
    Math.max(width, height) * 0.78,
  );
  g.addColorStop(0, theme.bgInner);
  g.addColorStop(0.45, theme.bgMid);
  g.addColorStop(1, theme.bgOuter);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
};

const drawGraticule = (s: Scene, project: Project) => {
  const { ctx, res, theme } = s;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 1.15 * res;
  ctx.strokeStyle = theme.graticule;

  // Each baked line is a straight segment in map space; subdividing keeps it
  // well-behaved when one end swings close to the horizon.
  const STEPS = 48;
  for (let li = 0; li < graticule.length; li++) {
    const l = graticule[li];
    let n = 0;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const mx = l[0] + (l[2] - l[0]) * t;
      const my = l[1] + (l[3] - l[1]) * t;
      if (!project(mx, my, p)) continue;
      buf[n * 2] = p.x;
      buf[n * 2 + 1] = p.y;
      n++;
    }
    // Every third line reads as a "major" gridline, as in the reference.
    ctx.strokeStyle = li % 3 === 0 ? theme.graticuleBright : theme.graticule;
    strokeBuffer(ctx, n);
  }
  ctx.restore();
};

const drawDots = (s: Scene, project: Project) => {
  const { ctx, width, height, theme } = s;
  const sprites = dotSprites(theme);
  const margin = 40;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let b = 0; b < DOT_BUCKETS; b++) {
    const sprite = sprites[b];
    const arr = dotBuckets[b];
    for (let i = 0; i < arr.length; i += 2) {
      if (!project(arr[i], arr[i + 1], p)) continue;
      if (
        p.x < -margin ||
        p.x > width + margin ||
        p.y < -margin ||
        p.y > height + margin
      ) {
        continue;
      }
      // 2.4x oversize: the sprite's solid core lands at roughly DOT_FILL of
      // the projected lattice pitch, with the halo spilling past it.
      const d = DOT_SPACING * p.scale * DOT_FILL * 2.4;
      const h = d * 0.5;
      ctx.drawImage(sprite, p.x - h, p.y - h, d, d);
    }
  }
  ctx.restore();
};

const drawBorders = (s: Scene, project: Project) => {
  const { ctx, res, theme } = s;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1.0 * res;
  ctx.lineJoin = "round";
  for (const ring of borders) strokeBuffer(ctx, projectRing(ring, project));
  ctx.restore();
};

const drawCoast = (s: Scene, project: Project) => {
  const { ctx, res, theme } = s;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const ring of coast) {
    const n = projectRing(ring, project);
    if (n < 2) continue;
    // Wide soft pass first, then a tight core on top: cheap, stable glow that
    // survives the later bloom without smearing the coastline itself.
    ctx.strokeStyle = theme.coastGlow;
    ctx.lineWidth = 4.0 * res;
    strokeBuffer(ctx, n);
    ctx.strokeStyle = theme.coastCore;
    ctx.lineWidth = 1.1 * res;
    strokeBuffer(ctx, n);
  }
  ctx.restore();
};

const drawRoutes = (s: Scene, project: Project) => {
  const { ctx, res, theme, frame, durationInFrames } = s;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  const STEPS = 26;
  for (let ri = 0; ri < routes.length; ri++) {
    const r = routes[ri];
    const a = cities[r.a];
    const b = cities[r.b];

    // Quadratic control point bowed perpendicular to the chord, in map space,
    // so the arc foreshortens along with the plane it lies on.
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const cx = mx - dy * r.c;
    const cyy = my + dx * r.c;

    let n = 0;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const u = 1 - t;
      const px = u * u * a.x + 2 * u * t * cx + t * t * b.x;
      const py = u * u * a.y + 2 * u * t * cyy + t * t * b.y;
      if (!project(px, py, p)) continue;
      buf[n * 2] = p.x;
      buf[n * 2 + 1] = p.y;
      n++;
    }
    if (n < 2) continue;

    ctx.strokeStyle = theme.arc;
    ctx.lineWidth = 0.9 * res;
    strokeBuffer(ctx, n);

    // A pulse rides every other arc, staggered by the baked phase so the
    // network never flashes in unison.
    if (ri % 2 !== 0) continue;
    const cycle = frame / durationInFrames + r.p;
    const head = (cycle * 2) % 1;
    const tail = Math.max(0, head - 0.14);
    const i0 = Math.floor(tail * n);
    const i1 = Math.min(n - 1, Math.ceil(head * n));
    if (i1 - i0 < 1) continue;

    ctx.strokeStyle = theme.arcPulse;
    ctx.lineWidth = 1.2 * res;
    ctx.beginPath();
    ctx.moveTo(buf[i0 * 2], buf[i0 * 2 + 1]);
    for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(buf[i * 2], buf[i * 2 + 1]);
    ctx.stroke();
  }
  ctx.restore();
};

const drawPings = (s: Scene, project: Project) => {
  const { ctx, res, theme, frame } = s;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 1.0 * res;

  const STEPS = 44;
  for (let ci = 0; ci < cities.length; ci++) {
    const c = cities[ci];
    if (c.w < PING_MIN_WEIGHT) continue;
    const t = ((frame / PING_PERIOD + cityPhase[ci]) % 1 + 1) % 1;
    if (t > 0.75) continue;
    const k = t / 0.75;
    const radius = 14 + k * (46 + c.w * 62);
    const alpha = (1 - k) * (1 - k) * 0.17 * c.w;
    if (alpha < 0.01) continue;

    let n = 0;
    for (let i = 0; i <= STEPS; i++) {
      const a = (i / STEPS) * Math.PI * 2;
      if (!project(c.x + Math.cos(a) * radius, c.y + Math.sin(a) * radius, p)) {
        continue;
      }
      buf[n * 2] = p.x;
      buf[n * 2 + 1] = p.y;
      n++;
    }
    ctx.strokeStyle = rgba(theme.ping, alpha);
    strokeBuffer(ctx, n);
  }
  ctx.restore();
};

const drawCities = (s: Scene, project: Project) => {
  const { ctx, width, height, res, theme, frame, camera } = s;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Depth-normalised marker scale: markers shrink into the distance but stay
  // screen-space upright, which is what makes the light shafts read as beams.
  project(camera.targetX, camera.targetY, q);
  const refScale = q.scale;

  for (let ci = 0; ci < cities.length; ci++) {
    const c = cities[ci];
    if (!project(c.x, c.y, p)) continue;
    if (p.x < -120 || p.x > width + 120 || p.y < -160 || p.y > height + 120) {
      continue;
    }

    const ms = res * (p.scale / refScale);
    const twinkle =
      0.82 +
      0.18 * Math.sin((frame / 30 + cityPhase[ci] * 7) * Math.PI * 2 * 0.55) +
      0.08 * Math.sin((frame / 30 + cityPhase[ci] * 13) * Math.PI * 2 * 1.7);
    const w = c.w;

    // Ground glow.
    const gr = (7 + w * 30) * ms;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
    g.addColorStop(0, rgba(theme.cityGlow, 0.85 * twinkle));
    g.addColorStop(0.24, rgba(theme.cityGlow, 0.42 * twinkle));
    g.addColorStop(1, rgba(theme.cityGlow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(p.x - gr, p.y - gr, gr * 2, gr * 2);

    // Vertical light shaft: a soft wide pass with a bright filament inside.
    const bh = (17 + w * 66) * ms * (0.85 + 0.15 * twinkle);
    const bw = (0.9 + w * 1.9) * ms;
    const beam = ctx.createLinearGradient(p.x, p.y, p.x, p.y - bh);
    beam.addColorStop(0, rgba(theme.cityBeam, 0.7 * twinkle));
    beam.addColorStop(0.35, rgba(theme.cityBeam, 0.26 * twinkle));
    beam.addColorStop(1, rgba(theme.cityBeam, 0));
    ctx.fillStyle = beam;
    ctx.fillRect(p.x - bw * 1.5, p.y - bh, bw * 3.0, bh);
    ctx.fillRect(p.x - bw * 0.32, p.y - bh, bw * 0.64, bh);

    // Hot core.
    const cr = (0.75 + w * 1.7) * ms;
    ctx.fillStyle = theme.cityCore;
    ctx.globalAlpha = Math.min(0.82, 0.45 + 0.4 * twinkle);
    ctx.beginPath();
    ctx.arc(p.x, p.y, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
};

/** Pushes the far half of the plane into darkness and adds a horizon haze. */
const drawAtmosphere = (s: Scene) => {
  const { ctx, width, height, theme } = s;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const haze = ctx.createLinearGradient(0, height * 0.06, 0, height * 0.52);
  haze.addColorStop(0, theme.haze);
  haze.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.20;
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height * 0.55);
  ctx.restore();

  const fade = ctx.createLinearGradient(0, 0, 0, height * 0.46);
  fade.addColorStop(0, theme.bgOuter);
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(0, 0, width, height * 0.46);
  ctx.globalAlpha = 1;
};

const drawBloom = (s: Scene) => {
  const { ctx, width, height, res } = s;
  const bw = Math.max(2, Math.round(width / BLOOM_DOWNSCALE));
  const bh = Math.max(2, Math.round(height / BLOOM_DOWNSCALE));

  if (!bloomCanvas) bloomCanvas = document.createElement("canvas");
  if (bloomCanvas.width !== bw || bloomCanvas.height !== bh) {
    bloomCanvas.width = bw;
    bloomCanvas.height = bh;
  }
  const bctx = bloomCanvas.getContext("2d")!;
  bctx.clearRect(0, 0, bw, bh);
  bctx.drawImage(ctx.canvas, 0, 0, bw, bh);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = BLOOM_STRENGTH;
  ctx.filter = `blur(${BLOOM_BLUR_PX * res}px)`;
  ctx.drawImage(bloomCanvas, 0, 0, width, height);
  ctx.filter = "none";
  ctx.restore();
};

const drawVignette = (s: Scene) => {
  const { ctx, width, height, theme } = s;
  const g = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.22,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.76,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.62, "rgba(0,0,0,0)");
  g.addColorStop(1, theme.vignette);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // Corner crush, slightly stronger at the bottom where the plane runs out.
  const b = ctx.createLinearGradient(0, height * 0.72, 0, height);
  b.addColorStop(0, "rgba(0,0,0,0)");
  b.addColorStop(1, theme.vignette);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = b;
  ctx.fillRect(0, height * 0.72, width, height * 0.28);
  ctx.globalAlpha = 1;
};

// -------------------------------------------------------------------- entry

export const drawScene = (s: Scene) => {
  const project = makeProjector(s.camera);
  const { ctx } = s;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";

  drawBackground(s);
  drawGraticule(s, project);
  drawDots(s, project);
  drawBorders(s, project);
  drawCoast(s, project);
  drawRoutes(s, project);
  drawPings(s, project);
  drawCities(s, project);
  drawAtmosphere(s);
  drawBloom(s);
  drawVignette(s);
};
