import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, continueRender, delayRender, random, staticFile, useCurrentFrame} from 'remotion';
import {getInfo} from '@remotion/google-fonts/RobotoMono';

/* ══════════════════════════════════════════════════════════════════════════
   FONT — gated so numerals never draw before the face is ready.
   Module scope keeps the composition free of React state.
   ══════════════════════════════════════════════════════════════════════════ */

const fontHandle = delayRender('Loading monospace font');

// The family name comes from @remotion/google-fonts, but the face itself is
// self-hosted from public/ so a render never depends on reaching a CDN.
const {fontFamily} = getInfo();

const monoFace = new FontFace(fontFamily, `url(${staticFile('fonts/RobotoMono-latin.woff2')}) format('woff2')`, {
  weight: '100 700',
  style: 'normal',
  display: 'block',
});

monoFace
  .load()
  .then((face) => {
    (document.fonts as unknown as {add: (f: FontFace) => void}).add(face);
    return document.fonts.ready;
  })
  .then(() => continueRender(fontHandle))
  .catch(() => continueRender(fontHandle));

export const MONO = `"${fontFamily}", monospace`;

/* ══════════════════════════════════════════════════════════════════════════
   THEME — the ONLY place a hex literal is allowed to live.
   Every draw call in this file reads its colours from here.
   ══════════════════════════════════════════════════════════════════════════ */

export type Variant = 'navy';

export type Theme = {
  bgDeep: string;
  bgMid: string;
  numeral: string;
  bright: string;
  dim: string;
  arc: string;
  accent: string;
  lockWhite: string;
  fringeWarm: string;
  fringeCool: string;
};

export const THEME: Record<Variant, Theme> = {
  navy: {
    bgDeep: '#0B1428',
    bgMid: '#16244A',
    numeral: '#2E7FE0',
    bright: '#4FB8F5',
    dim: '#1A2C52',
    arc: '#E8D5A8',
    accent: '#E05A6B',
    lockWhite: '#FFFFFF',
    fringeWarm: '#E05A6B',
    fringeCool: '#4FB8F5',
  },
};

/** Per-variant intensity trim, so a future palette can be graded independently. */
const GRADE: Record<Variant, {field: number; arc: number; lock: number; vignette: number}> = {
  navy: {field: 1, arc: 1, lock: 1, vignette: 0.22},
};

const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

/* ══════════════════════════════════════════════════════════════════════════
   GEOMETRY / TIMING CONSTANTS
   ══════════════════════════════════════════════════════════════════════════ */

const W = 3840;
const H = 2160;
const CX = W / 2;
const CY = H / 2;
const DUR = 960;
const TAU = Math.PI * 2;

const PULSE_PERIOD = 240; // 960 / 240 = 4 whole cycles → loop closes
const FLARE_IN = 660;
const FLARE_OUT = 780;
const GRAIN_TILES = 8; // 960 % 8 === 0 → loop closes
const GRAIN_TILE_PX = 160;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ══════════════════════════════════════════════════════════════════════════
   LAYER 1 — THE DATA FIELD
   Element set is generated once (seeded) and reused every frame; only the
   radial progress `p` is recomputed per frame.
   ══════════════════════════════════════════════════════════════════════════ */

type FieldNumeral = {
  text: string;
  angle: number;
  phase: number;
  speed: number;
  size: number;
  alpha: number;
  weight: number;
};

type FieldSquare = {
  angle: number;
  phase: number;
  speed: number;
  size: number;
  alpha: number;
  nested: boolean;
  hot: boolean;
  front: boolean;
};

const R_MIN = 0.07 * H;
const R_MAX = 0.98 * H;
const X_STRETCH = 1.18; // widen the field to fill the 16:9 frame

/** Cluster seeds so placement reads as clumps and voids, never a lattice. */
const clusteredAngle = (seed: string) => {
  const pick = random(`${seed}-cluster`);
  if (pick < 0.62) {
    const c = Math.floor(random(`${seed}-cidx`) * 7);
    const clusterCentre = random(`field-cluster-${c}`) * TAU;
    return clusterCentre + (random(`${seed}-jit`) - 0.5) * 0.9;
  }
  return random(`${seed}-free`) * TAU;
};

const buildField = () => {
  const numerals: FieldNumeral[] = [];
  const squares: FieldSquare[] = [];

  const seedTexts = ['52', '65', '40', '37', '14', '46', '33', '13', '24', '93', '29', '55', '83', '16', '23', '10', '78', '38', '61', '07'];

  for (let i = 0; i < 172; i += 1) {
    const s = `num-${i}`;
    const lone = random(`${s}-lone`) < 0.3;
    const text = lone
      ? String(Math.floor(random(`${s}-digit`) * 10))
      : seedTexts[Math.floor(random(`${s}-pair`) * seedTexts.length)];
    numerals.push({
      text,
      angle: clusteredAngle(s),
      phase: random(`${s}-phase`),
      speed: random(`${s}-speed`) < 0.72 ? 1 : 2,
      size: lerp(24, 90, random(`${s}-size`) ** 1.6),
      alpha: lerp(0.15, 0.7, random(`${s}-alpha`)),
      weight: random(`${s}-weight`) < 0.25 ? 700 : 400,
    });
  }

  for (let i = 0; i < 25; i += 1) {
    const s = `sq-${i}`;
    squares.push({
      angle: clusteredAngle(s),
      phase: random(`${s}-phase`),
      speed: random(`${s}-speed`) < 0.75 ? 1 : 2,
      size: lerp(30, 70, random(`${s}-size`)),
      alpha: lerp(0.25, 0.85, random(`${s}-alpha`)),
      nested: random(`${s}-nest`) < 0.45,
      hot: random(`${s}-hot`) < 0.22,
      front: random(`${s}-front`) < 0.3,
    });
  }

  return {numerals, squares};
};

/** Radial progress in [0,1). Integer `speed` guarantees the wrap at DUR. */
const progress = (frame: number, phase: number, speed: number) => {
  const p = ((frame / DUR) * speed + phase) % 1;
  return p < 0 ? p + 1 : p;
};

/** Exponential expansion — reads as the camera easing forward. */
const radiusAt = (p: number) => R_MIN * Math.pow(R_MAX / R_MIN, p);

/** 0 at both ends of the travel so respawn is invisible. */
const travelFade = (p: number) => Math.sin(Math.PI * p) ** 0.55;

const drawBackdrop = (ctx: CanvasRenderingContext2D, t: Theme) => {
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.hypot(CX, CY));
  g.addColorStop(0, t.bgMid);
  g.addColorStop(0.4, rgba(t.bgMid, 0.7));
  g.addColorStop(1, t.bgDeep);
  ctx.fillStyle = t.bgDeep;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
};

const GRID_PITCH = 90;

const drawGrid = (ctx: CanvasRenderingContext2D, t: Theme, grade: number) => {
  ctx.save();
  ctx.strokeStyle = rgba(t.dim, 0.55 * grade);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = CX % GRID_PITCH; x <= W; x += GRID_PITCH) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = CY % GRID_PITCH; y <= H; y += GRID_PITCH) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  ctx.restore();
};

const drawSquare = (ctx: CanvasRenderingContext2D, t: Theme, sq: FieldSquare, frame: number, grade: number) => {
  const p = progress(frame, sq.phase, sq.speed);
  const fade = travelFade(p);
  if (fade <= 0.002) return;
  const r = radiusAt(p);
  const x = CX + Math.cos(sq.angle) * r * X_STRETCH;
  const y = CY + Math.sin(sq.angle) * r;
  const size = sq.size * lerp(0.55, 1.5, p);
  if (x < -size * 3 || x > W + size * 3 || y < -size * 3 || y > H + size * 3) return;

  const a = sq.alpha * fade * grade;
  ctx.save();
  ctx.lineWidth = sq.hot ? 5 : 3;
  ctx.strokeStyle = rgba(t.bright, Math.min(1, a));
  ctx.shadowColor = rgba(t.bright, Math.min(1, a));
  ctx.shadowBlur = sq.hot ? 42 : 14;
  ctx.strokeRect(x - size / 2, y - size / 2, size, size);
  if (sq.hot) ctx.strokeRect(x - size / 2, y - size / 2, size, size);
  if (sq.nested) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(t.bright, Math.min(1, a * 0.8));
    const inner = size * 0.34;
    ctx.fillRect(x - inner / 2, y - inner / 2, inner, inner);
  }
  ctx.restore();
};

const drawField = (
  ctx: CanvasRenderingContext2D,
  t: Theme,
  field: ReturnType<typeof buildField>,
  frame: number,
  grade: number,
  front: boolean,
) => {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (!front) {
    for (const n of field.numerals) {
      const p = progress(frame, n.phase, n.speed);
      const fade = travelFade(p);
      if (fade <= 0.002) continue;
      const r = radiusAt(p);
      const x = CX + Math.cos(n.angle) * r * X_STRETCH;
      const y = CY + Math.sin(n.angle) * r;
      const size = n.size * lerp(0.55, 1.5, p);
      if (x < -size * 4 || x > W + size * 4 || y < -size * 4 || y > H + size * 4) continue;
      const a = n.alpha * fade * grade;
      ctx.font = `${n.weight} ${size}px ${MONO}`;
      ctx.fillStyle = rgba(t.numeral, Math.min(1, a));
      ctx.shadowColor = rgba(t.numeral, Math.min(1, a * 0.7));
      ctx.shadowBlur = size * 0.35;
      ctx.fillText(n.text, x, y);
    }
  }

  for (const sq of field.squares) {
    if (sq.front !== front) continue;
    drawSquare(ctx, t, sq, frame, grade);
  }
  ctx.restore();
};

/* ══════════════════════════════════════════════════════════════════════════
   LAYER 2 — THE HUD RING
   Broken arc segments only. Each band has N-fold symmetry and turns through a
   whole number of its own symmetry periods across the loop, so frame 960 is
   pixel-identical to frame 0. Direction alternates band to band.
   ══════════════════════════════════════════════════════════════════════════ */

type Band = {
  id: string;
  radius: number; // fraction of frame height
  thickness: number; // px at 4K
  segments: number; // N-fold symmetry
  sweep: number; // degrees covered by each segment
  turns: number; // signed turns over the loop; |turns| * segments must be integral
  phase: number; // degrees
  colour: 'arc' | 'accent';
  alpha: number;
  glow: number;
  /**
   * Fine crosshatch inside the arc fill. Applied to every segment in the band:
   * segments must stay identical, or a whole-period rotation would land a
   * textured arc where a plain one was and the loop would not close.
   */
  gridTexture?: boolean;
};

const BANDS: Band[] = [
  // 1 — three thick sand blocks, the visual anchor. One symmetry period per loop.
  {id: 'anchor', radius: 0.3, thickness: 104, segments: 3, sweep: 88, turns: 1 / 3, phase: 18, colour: 'arc', alpha: 0.95, glow: 70},
  // 2 — thin accent, ~200° broken once.
  {id: 'accent-in', radius: 0.365, thickness: 11, segments: 2, sweep: 100, turns: -0.5, phase: 62, colour: 'accent', alpha: 0.9, glow: 34},
  // 3 — thick sand, crosshatched, faster than band 1 so gaps never align.
  {id: 'anchor-out', radius: 0.45, thickness: 112, segments: 3, sweep: 76, turns: 2 / 3, phase: 47, colour: 'arc', alpha: 0.88, glow: 74, gridTexture: true},
  // 4 — narrower sand blocks, counter-rotating.
  {id: 'combs', radius: 0.525, thickness: 54, segments: 6, sweep: 29, turns: -1 / 3, phase: 11, colour: 'arc', alpha: 0.6, glow: 40},
  // 5 — thin accent, several short segments.
  {id: 'accent-out', radius: 0.555, thickness: 9, segments: 5, sweep: 18, turns: 0.4, phase: 33, colour: 'accent', alpha: 0.8, glow: 30},
  // 6 — long sparse sand, low opacity, a full turn.
  {id: 'sparse', radius: 0.7, thickness: 7, segments: 2, sweep: 130, turns: -1, phase: 88, colour: 'arc', alpha: 0.26, glow: 24},
  // 7/8 — very faint outer arcs, nearly lost in the field.
  {id: 'ghost-a', radius: 0.84, thickness: 5, segments: 3, sweep: 62, turns: 2 / 3, phase: 5, colour: 'arc', alpha: 0.11, glow: 18},
  {id: 'ghost-b', radius: 0.96, thickness: 4, segments: 4, sweep: 40, turns: -1.25, phase: 52, colour: 'accent', alpha: 0.09, glow: 16},
];
const RAD = Math.PI / 180;

const TICK_COUNT = 60;
const TICK_MAJOR = 5;
/** Long ticks repeat every 5th slot, so the ring's true symmetry is 12-fold. */
const TICK_SYMMETRY = TICK_COUNT / TICK_MAJOR;

/** Annulus sector as a fillable path — used to clip the crosshatch texture. */
const sectorPath = (ctx: CanvasRenderingContext2D, r: number, thickness: number, a0: number, a1: number) => {
  const rOut = r + thickness / 2;
  const rIn = r - thickness / 2;
  ctx.beginPath();
  ctx.arc(0, 0, rOut, a0, a1);
  ctx.arc(0, 0, rIn, a1, a0, true);
  ctx.closePath();
};

/**
 * Fine crosshatch inside an arc fill.
 *
 * Three line families 60° apart, laid out symmetrically about the origin, so
 * the pattern maps onto itself under any 60° rotation — and therefore under
 * the 120° symmetry period of the band that carries it. A plain square grid
 * would only survive 90° steps, which would leave the texture in a different
 * orientation at frame 960 and break the loop.
 */
const drawArcTexture = (ctx: CanvasRenderingContext2D, t: Theme, r: number, thickness: number, a0: number, a1: number) => {
  ctx.save();
  sectorPath(ctx, r, thickness, a0, a1);
  ctx.clip();
  const outer = r + thickness / 2;
  const step = 22;
  const reach = outer * 1.1;
  const count = Math.ceil(reach / step);
  ctx.strokeStyle = rgba(t.bgDeep, 0.26);
  ctx.lineWidth = 2;
  for (let family = 0; family < 3; family += 1) {
    ctx.save();
    ctx.rotate((family * Math.PI) / 3);
    ctx.beginPath();
    for (let k = -count; k <= count; k += 1) {
      const x = k * step;
      ctx.moveTo(x, -reach);
      ctx.lineTo(x, reach);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
};

const drawRing = (ctx: CanvasRenderingContext2D, t: Theme, frame: number, grade: number) => {
  const spin = frame / DUR;

  for (const band of BANDS) {
    const r = band.radius * H;
    const colour = band.colour === 'arc' ? t.arc : t.accent;
    const rotation = band.phase * RAD + band.turns * TAU * spin;

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(rotation);

    for (let i = 0; i < band.segments; i += 1) {
      const a0 = (i * TAU) / band.segments;
      const a1 = a0 + band.sweep * RAD;
      const alpha = Math.min(1, band.alpha * grade);

      // Soft outer bloom pass, then the solid stroke.
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(colour, alpha * 0.5);
      ctx.lineWidth = band.thickness;
      ctx.shadowColor = rgba(colour, alpha);
      ctx.shadowBlur = band.glow;
      ctx.beginPath();
      ctx.arc(0, 0, r, a0, a1);
      ctx.stroke();

      ctx.shadowBlur = band.glow * 0.35;
      ctx.strokeStyle = rgba(colour, alpha);
      ctx.beginPath();
      ctx.arc(0, 0, r, a0, a1);
      ctx.stroke();

      if (band.gridTexture) {
        ctx.shadowBlur = 0;
        drawArcTexture(ctx, t, r, band.thickness, a0, a1);
      }
    }
    ctx.restore();
  }

  // Fine tick ring. Every fifth tick is long, so the pattern repeats every
  // 360/12 = 30°, not every 6° — the rotation is a whole number of THAT period.
  ctx.save();
  ctx.translate(CX, CY);
  ctx.rotate(-TAU * (2 / TICK_SYMMETRY) * spin);
  ctx.strokeStyle = rgba(t.arc, 0.22 * grade);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const tr = 0.335 * H;
  ctx.beginPath();
  for (let i = 0; i < TICK_COUNT; i += 1) {
    const a = (i * TAU) / TICK_COUNT;
    const long = i % TICK_MAJOR === 0;
    const len = long ? 26 : 13;
    ctx.moveTo(Math.cos(a) * tr, Math.sin(a) * tr);
    ctx.lineTo(Math.cos(a) * (tr + len), Math.sin(a) * (tr + len));
  }
  ctx.stroke();
  ctx.restore();
};

/* ══════════════════════════════════════════════════════════════════════════
   ENERGY FLARE — frames 660–780, fully faded at both ends.
   ══════════════════════════════════════════════════════════════════════════ */

const flareEnvelope = (frame: number) => {
  if (frame <= FLARE_IN || frame >= FLARE_OUT) return 0;
  const t = (frame - FLARE_IN) / (FLARE_OUT - FLARE_IN);
  return Math.sin(Math.PI * t) ** 1.2;
};

const flareHead = (frame: number) => {
  const t = clamp01((frame - FLARE_IN) / (FLARE_OUT - FLARE_IN));
  const eased = t * t * (3 - 2 * t);
  return {
    x: lerp(0.06 * W, 0.44 * W, eased),
    y: lerp(1.02 * H, 0.52 * H, eased),
  };
};

const drawFlare = (ctx: CanvasRenderingContext2D, t: Theme, frame: number, scale: number) => {
  const env = flareEnvelope(frame);
  if (env <= 0) return;
  const head = flareHead(frame);

  // Travel direction, so the tail can be jittered across the path rather than
  // along it — a straight-sided cone is what makes a flare read as an object.
  const dx = 0.38 * W;
  const dy = -0.5 * H;
  const len = Math.hypot(dx, dy);
  const ax = dx / len;
  const ay = dy / len;
  const px = -ay;
  const py = ax;

  const puff = (x: number, y: number, radius: number, a: number) => {
    if (a <= 0.002) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, rgba(t.lockWhite, a));
    g.addColorStop(0.18, rgba(t.lockWhite, a * 0.72));
    g.addColorStop(0.44, rgba(t.bright, a * 0.34));
    g.addColorStop(0.74, rgba(t.bright, a * 0.1));
    g.addColorStop(1, rgba(t.bright, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  };

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (typeof ctx.filter === 'string') ctx.filter = 'blur(90px)';

  // A broad, shapeless wash so the whole lower-left lifts, not just the mass.
  puff(head.x - ax * 0.18 * W, head.y - ay * 0.18 * W, 1750, env * scale * 0.06);

  // The mass and its wispy trailing tail.
  const blobs = 16;
  for (let i = 0; i < blobs; i += 1) {
    const k = i / (blobs - 1);
    const along = k * 0.62 * len * (0.7 + random(`flare-along-${i}`) * 0.7);
    const across = (random(`flare-across-${i}`) - 0.5) * lerp(320, 1150, k);
    const x = head.x - ax * along + px * across;
    const y = head.y - ay * along + py * across;
    const radius = lerp(780, 340, k) * (0.7 + random(`flare-r-${i}`) * 0.9);
    const a = env * scale * lerp(0.2, 0.025, k ** 0.55) * (0.6 + random(`flare-a-${i}`) * 0.8);
    puff(x, y, radius, a);
  }

  // Off-axis puffs around the head keep the leading edge irregular.
  for (let i = 0; i < 5; i += 1) {
    const ang = random(`flare-head-ang-${i}`) * TAU;
    const dist = 220 + random(`flare-head-d-${i}`) * 620;
    puff(
      head.x + Math.cos(ang) * dist,
      head.y + Math.sin(ang) * dist,
      420 + random(`flare-head-r-${i}`) * 560,
      env * scale * (0.05 + random(`flare-head-a-${i}`) * 0.09),
    );
  }

  // Hot core.
  puff(head.x, head.y, 900, env * scale * 0.26);
  ctx.restore();
};

/* ══════════════════════════════════════════════════════════════════════════
   BACKGROUND CANVAS — field + ring + flare
   ══════════════════════════════════════════════════════════════════════════ */

const BackgroundLayer: React.FC<{theme: Theme; variant: Variant; frame: number}> = ({theme, variant, frame}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const field = useMemo(() => buildField(), []);
  const grade = GRADE[variant];

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, W, H);

    drawBackdrop(ctx, theme);
    drawGrid(ctx, theme, grade.field);
    drawField(ctx, theme, field, frame, grade.field, false);
    drawFlare(ctx, theme, frame, 0.4); // soft under-glow beneath the ring
    drawRing(ctx, theme, frame, grade.arc);
    drawField(ctx, theme, field, frame, grade.field, true);
    drawFlare(ctx, theme, frame, 1); // main mass, brightens the arcs it crosses

    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
  }, [theme, frame, field, grade]);

  return <canvas ref={ref} width={W} height={H} style={{width: '100%', height: '100%', display: 'block'}} />;
};

/* ══════════════════════════════════════════════════════════════════════════
   LAYER 3 — THE LOCK GLYPH
   Every dimension of both silhouettes lives here and nowhere else.
   ══════════════════════════════════════════════════════════════════════════ */

/** Bounding box of a glyph, in px, for a given glyph height. */
const glyphBox = (variant: Variant, size: number) => {
  if (variant === 'navy') return {w: 0.86 * size, h: size};
  return {w: 0.86 * size, h: size};
};

/** Padlock proportions — the single source of truth for the navy silhouette. */
const padlock = (size: number) => {
  const shR = 0.27 * size; // shackle centreline radius
  const shLW = 0.1 * size; // shackle stroke width
  return {
    bodyW: 0.88 * size,
    bodyTop: 0.42 * size,
    bodyH: 0.58 * size,
    bodyR: 0.1 * size,
    shR,
    shLW,
    shRin: shR - shLW / 2,
    shCy: shR + shLW / 2,
    legEnd: 0.5 * size,
    khY: 0.64 * size,
    khR: 0.085 * size,
    slotTopHW: 0.034 * size,
    slotBotHW: 0.058 * size,
    slotBottom: 0.86 * size,
  };
};

/** Keyhole path — a circle with a short slot that widens downward. */
const keyholePath = (
  ctx: CanvasRenderingContext2D,
  y: number,
  r: number,
  topHW: number,
  botHW: number,
  bottom: number,
) => {
  ctx.beginPath();
  ctx.arc(0, y, r, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-topHW, y);
  ctx.lineTo(topHW, y);
  ctx.lineTo(botHW, bottom);
  ctx.lineTo(-botHW, bottom);
  ctx.closePath();
  ctx.fill();
};

/** Classic padlock: rounded body, stroked shackle, keyhole punched out. */
const stampPadlock = (ctx: CanvasRenderingContext2D, size: number) => {
  const d = padlock(size);

  // Shackle — thick inverted-U, rounded ends, legs tucked under the body.
  ctx.lineWidth = d.shLW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-d.shR, d.legEnd);
  ctx.lineTo(-d.shR, d.shCy);
  ctx.arc(0, d.shCy, d.shR, Math.PI, TAU, false);
  ctx.lineTo(d.shR, d.legEnd);
  ctx.stroke();

  // Body — solid rounded rectangle, wider than tall.
  ctx.beginPath();
  ctx.roundRect(-d.bodyW / 2, d.bodyTop, d.bodyW, d.bodyH, d.bodyR);
  ctx.fill();

  // Keyhole, punched clean through the body.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  keyholePath(ctx, d.khY, d.khR, d.slotTopHW, d.slotBotHW, d.slotBottom);
  ctx.restore();
};

/**
 * Negative space that the bloom would otherwise close up. Re-cut on the
 * composited glyph so the arch and the keyhole stay legible.
 */
const stampPadlockVoids = (ctx: CanvasRenderingContext2D, size: number) => {
  const d = padlock(size);
  ctx.beginPath();
  ctx.arc(0, d.shCy, d.shRin, Math.PI, TAU, false);
  ctx.lineTo(d.shRin, d.bodyTop + d.bodyR * 0.6);
  ctx.lineTo(-d.shRin, d.bodyTop + d.bodyR * 0.6);
  ctx.closePath();
  ctx.fill();
  keyholePath(ctx, d.khY, d.khR, d.slotTopHW, d.slotBotHW, d.slotBottom);
};

const stampGlyph = (ctx: CanvasRenderingContext2D, variant: Variant, size: number) => {
  if (variant === 'navy') stampPadlock(ctx, size);
};

/** Holes to re-cut after the bloom stack is composited. */
const stampVoids = (ctx: CanvasRenderingContext2D, variant: Variant, size: number) => {
  if (variant === 'navy') stampPadlockVoids(ctx, size);
};

export const LockGlyph: React.FC<{
  variant: Variant;
  theme: Theme;
  size: number;
  bloom: number;
  aberration: number;
}> = ({variant, theme, size, bloom, aberration}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const box = glyphBox(variant, size);
  const pad = 540;
  const cw = Math.ceil(box.w + pad * 2);
  const ch = Math.ceil(box.h + pad * 2);

  // Offscreen buffers are shape-independent of the frame, so build them once.
  const buffers = useMemo(() => {
    const make = () => {
      const c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      return c;
    };
    return {mask: make(), tint: make()};
  }, [cw, ch]);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const maskCtx = buffers.mask.getContext('2d');
    const tintCtx = buffers.tint.getContext('2d');
    if (!ctx || !maskCtx || !tintCtx) return;

    // 1. Alpha mask of the glyph, drawn once.
    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.globalAlpha = 1;
    maskCtx.clearRect(0, 0, cw, ch);
    maskCtx.save();
    maskCtx.translate(cw / 2, pad);
    maskCtx.fillStyle = theme.lockWhite;
    maskCtx.strokeStyle = theme.lockWhite;
    stampGlyph(maskCtx, variant, size);
    maskCtx.restore();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, cw, ch);

    // 2. Three tinted copies composited additively — the RGB fringe.
    const passes: {colour: string; dx: number; dy: number; alpha: number}[] = [
      {colour: theme.fringeWarm, dx: -aberration, dy: aberration * 0.4, alpha: 0.85},
      {colour: theme.fringeCool, dx: aberration, dy: -aberration * 0.4, alpha: 0.85},
      {colour: theme.lockWhite, dx: 0, dy: 0, alpha: 1},
    ];

    // Bloom stack: wide + soft through to tight + solid.
    const halo = [
      {blur: 320 * bloom, alpha: 0.26},
      {blur: 190 * bloom, alpha: 0.3},
      {blur: 96 * bloom, alpha: 0.34},
      {blur: 34 * bloom, alpha: 0.36},
      {blur: 0, alpha: 1},
    ];

    ctx.globalCompositeOperation = 'lighter';
    for (const pass of passes) {
      tintCtx.setTransform(1, 0, 0, 1, 0, 0);
      tintCtx.globalCompositeOperation = 'source-over';
      tintCtx.globalAlpha = 1;
      tintCtx.clearRect(0, 0, cw, ch);
      tintCtx.drawImage(buffers.mask, 0, 0);
      tintCtx.globalCompositeOperation = 'source-in';
      tintCtx.fillStyle = pass.colour;
      tintCtx.fillRect(0, 0, cw, ch);

      for (const h of halo) {
        ctx.globalAlpha = pass.alpha * h.alpha;
        ctx.shadowColor = rgba(pass.colour, 1);
        ctx.shadowBlur = h.blur;
        ctx.drawImage(buffers.tint, pass.dx, pass.dy);
      }
    }

    // Re-cut the negative space the bloom closed up.
    ctx.globalAlpha = 0.88;
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.save();
    ctx.translate(cw / 2, pad);
    ctx.fillStyle = theme.lockWhite;
    stampVoids(ctx, variant, size);
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, [variant, theme, size, bloom, aberration, buffers, cw, ch, pad]);

  return (
    <canvas
      ref={ref}
      width={cw}
      height={ch}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: `${(cw / W) * 100}%`,
        height: `${(ch / H) * 100}%`,
        transform: 'translate(-50%, -50%)',
        mixBlendMode: 'screen',
      }}
    />
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   FINISH — vignette, scanlines, grain
   ══════════════════════════════════════════════════════════════════════════ */

const FinishLayer: React.FC<{theme: Theme; variant: Variant; frame: number}> = ({theme, variant, frame}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  const grain = useMemo(() => {
    const tiles: HTMLCanvasElement[] = [];
    for (let t = 0; t < GRAIN_TILES; t += 1) {
      const c = document.createElement('canvas');
      c.width = GRAIN_TILE_PX;
      c.height = GRAIN_TILE_PX;
      const g = c.getContext('2d');
      if (!g) continue;
      const img = g.createImageData(GRAIN_TILE_PX, GRAIN_TILE_PX);
      for (let i = 0; i < GRAIN_TILE_PX * GRAIN_TILE_PX; i += 1) {
        const v = Math.floor(random(`grain-${t}-${i}`) * 256);
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      tiles.push(c);
    }
    return tiles;
  }, []);

  const scanTile = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 4;
    return c;
  }, []);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const scanCtx = scanTile.getContext('2d');
    if (!ctx || !scanCtx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    // Vignette — darkens toward the deep background colour.
    const v = ctx.createRadialGradient(CX, CY, H * 0.28, CX, CY, Math.hypot(CX, CY));
    v.addColorStop(0, rgba(theme.bgDeep, 0));
    v.addColorStop(0.62, rgba(theme.bgDeep, GRADE[variant].vignette * 0.35));
    v.addColorStop(1, rgba(theme.bgDeep, GRADE[variant].vignette));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    // Scanlines.
    scanCtx.clearRect(0, 0, 1, 4);
    scanCtx.fillStyle = rgba(theme.bgDeep, 1);
    scanCtx.fillRect(0, 0, 1, 2);
    const scanPattern = ctx.createPattern(scanTile, 'repeat');
    if (scanPattern) {
      ctx.globalAlpha = 0.03;
      ctx.fillStyle = scanPattern;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // Grain — tile index cycles every GRAIN_TILES frames, and 960 % 8 === 0.
    const tile = grain[frame % GRAIN_TILES];
    if (tile) {
      const grainPattern = ctx.createPattern(tile, 'repeat');
      if (grainPattern) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.04;
        ctx.fillStyle = grainPattern;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }, [theme, variant, frame, grain, scanTile]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block'}}
    />
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   COMPOSITION
   ══════════════════════════════════════════════════════════════════════════ */

export type SecureLockProps = {
  variant: Variant;
};

const LOCK_HEIGHT: Record<Variant, number> = {
  navy: 0.22 * H,
};

export const SecureLock: React.FC<SecureLockProps> = ({variant}) => {
  // Wrapping here is what makes the loop exact rather than merely close:
  // every downstream value is computed from an identical number at 0 and 960,
  // so the two frames rasterise bit-for-bit the same. Without it, `spin` at
  // 960 is a whole number of symmetry periods but not the *same float*, and
  // the arcs land a fraction of a pixel off.
  const frame = useCurrentFrame() % DUR;
  const theme = THEME[variant];
  const grade = GRADE[variant];

  // Slow pulse: 4 whole cycles across the loop.
  const pulse = Math.sin((TAU * frame) / PULSE_PERIOD);
  const flare = flareEnvelope(frame);

  const bloom = (1 + 0.15 * pulse + 0.35 * flare) * grade.lock;
  const aberration = 9 * (1 + 0.15 * pulse + 0.2 * flare);

  return (
    <AbsoluteFill style={{backgroundColor: theme.bgDeep}}>
      <BackgroundLayer theme={theme} variant={variant} frame={frame} />
      <LockGlyph
        variant={variant}
        theme={theme}
        size={LOCK_HEIGHT[variant]}
        bloom={bloom}
        aberration={aberration}
      />
      <FinishLayer theme={theme} variant={variant} frame={frame} />
    </AbsoluteFill>
  );
};
