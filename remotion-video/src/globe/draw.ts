import {
  DURATION_IN_FRAMES,
  FIELD_X,
  FIELD_Y,
  FIELD_Z_FAR,
  FIELD_Z_NEAR,
  FOCAL,
  GLOBE_CENTER_X,
  GLOBE_CENTER_Y,
  GLOBE_CENTER_Z,
  GLOBE_RADIUS,
  MASTER_WIDTH,
} from "./constants";
import type { SpherePoint } from "./sphere";
import type { Stream, Ticker } from "./tickers";
import { rgba, type Rgb, type Theme } from "./theme";

const TAU = Math.PI * 2;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Blur tiers, in master pixels. Index 0 is drawn sharp, direct to canvas. */
const BLUR_TIERS = [0, 4, 11, 26, 52];

const tierForZ = (z: number) => {
  if (z > 2650) return 0;
  if (z > 2000) return 1;
  if (z > 1550) return 2;
  if (z > 1180) return 3;
  return 4;
};

export type SceneGeometry = {
  readonly mesh: SpherePoint[];
  readonly rings: SpherePoint[];
  readonly land: SpherePoint[];
  readonly tickers: Ticker[];
  readonly streams: Stream[];
};

export type DrawArgs = {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly frame: number;
  readonly theme: Theme;
  readonly geo: SceneGeometry;
  /** One scratch canvas per non-zero blur tier, sized to the composition. */
  readonly tierCanvases: HTMLCanvasElement[];
  readonly grainPattern: CanvasPattern | null;
};

/** Buckets points by (colour, quantised alpha) so fillStyle changes stay cheap. */
class DotBatch {
  private readonly bins = new Map<number, number[]>();
  private readonly colors: Rgb[];

  constructor(colors: Rgb[]) {
    this.colors = colors;
  }

  add(colorIndex: number, alpha: number, x: number, y: number, size: number) {
    if (alpha <= 0.012) return;
    const step = Math.min(23, Math.max(0, Math.round(alpha * 23)));
    const key = colorIndex * 32 + step;
    let bin = this.bins.get(key);
    if (!bin) {
      bin = [];
      this.bins.set(key, bin);
    }
    bin.push(x, y, size);
  }

  flush(ctx: CanvasRenderingContext2D) {
    for (const [key, bin] of this.bins) {
      const color = this.colors[Math.floor(key / 32)];
      const alpha = (key % 32) / 23;
      ctx.fillStyle = rgba(color, alpha);
      for (let i = 0; i < bin.length; i += 3) {
        const s = bin[i + 2];
        ctx.fillRect(bin[i] - s * 0.5, bin[i + 1] - s * 0.5, s, s);
      }
    }
    this.bins.clear();
  }
}

export const drawScene = ({
  ctx,
  width,
  height,
  frame,
  theme,
  geo,
  tierCanvases,
  grainPattern,
}: DrawArgs) => {
  const k = width / MASTER_WIDTH;
  const p = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
  const cx = width / 2;
  const cy = height / 2;
  const mx = theme.mirror ? -1 : 1;

  // Slow periodic camera drift — every term completes whole cycles over the
  // loop so frame 750 lands exactly back on frame 0.
  const camX = 64 * Math.sin(TAU * p);
  const camY = 34 * Math.sin(TAU * p * 2 + 1.1);
  const camZ = 95 * Math.sin(TAU * p + 0.6);

  const sxOf = (X: number, s: number) => cx + mx * (X - camX) * s * k;
  const syOf = (Y: number, s: number) => cy + (Y - camY) * s * k;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";

  // ---------------------------------------------------------------- background
  const bgFocusX = theme.mirror ? width * 0.24 : width * 0.76;
  const bg = ctx.createRadialGradient(
    bgFocusX,
    height * 0.46,
    0,
    bgFocusX,
    height * 0.46,
    width * 0.92,
  );
  bg.addColorStop(0, rgba(theme.bgInner, 1));
  bg.addColorStop(0.55, rgba(theme.bgInner, 0.45));
  bg.addColorStop(1, rgba(theme.bgOuter, 1));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // ------------------------------------------------------------- data streams
  ctx.globalCompositeOperation = "lighter";
  const streamBatch = new DotBatch([theme.stream]);
  for (const st of geo.streams) {
    const z = st.z + camZ;
    const s = FOCAL / z;
    const y = syOf(st.y, s);
    if (y < -40 || y > height + 40) continue;
    const depthFade = smoothstep(FIELD_Z_FAR, FIELD_Z_FAR - 1400, z);
    const gap = st.dotGap;
    const scroll = p * st.speed * gap * 6;
    const size = Math.max(1, 3.4 * s * k);
    for (let X = -FIELD_X * 1.5; X <= FIELD_X * 1.5; X += gap) {
      const x = sxOf(X + scroll, s);
      if (x < -20 || x > width + 20) continue;
      streamBatch.add(0, st.alpha * depthFade * 1.5, x, y, size);
    }
  }
  streamBatch.flush(ctx);

  // --------------------------------------------------------------- far tickers
  drawTickers({
    ctx, width, height, theme, geo, p, camX, camY, camZ, k, cx, cy, mx,
    tierCanvases, minTier: 0, maxTier: 0, zMin: GLOBE_CENTER_Z, zMax: Infinity,
  });

  // --------------------------------------------------------------------- globe
  drawGlobe({ ctx, width, height, theme, geo, p, camX, camY, camZ, k, cx, cy, mx });

  // -------------------------------------------------------------- near tickers
  drawTickers({
    ctx, width, height, theme, geo, p, camX, camY, camZ, k, cx, cy, mx,
    tierCanvases, minTier: 0, maxTier: 4, zMin: -Infinity, zMax: GLOBE_CENTER_Z,
  });

  // --------------------------------------------------------------------- flare
  drawFlare({ ctx, width, height, theme, p });

  // ------------------------------------------------------------ vignette/grain
  ctx.globalCompositeOperation = "source-over";
  const vig = ctx.createRadialGradient(
    cx, cy, Math.min(width, height) * 0.18,
    cx, cy, Math.max(width, height) * 0.78,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.62, "rgba(0,0,0,0.18)");
  vig.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  if (grainPattern) {
    const shift = Math.floor(p * 1024) % 256;
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(-shift, -((shift * 7) % 256));
    ctx.fillStyle = grainPattern;
    ctx.fillRect(0, 0, width + 256, height + 256);
    ctx.restore();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
};

// ---------------------------------------------------------------------- globe

type GlobeArgs = {
  ctx: CanvasRenderingContext2D; width: number; height: number; theme: Theme;
  geo: SceneGeometry; p: number; camX: number; camY: number; camZ: number;
  k: number; cx: number; cy: number; mx: number;
};

const drawGlobe = ({ ctx, theme, geo, p, camX, camY, camZ, k, cx, cy, mx }: GlobeArgs) => {
  // Exactly one revolution per loop keeps the rotation seamless. The offset
  // puts ~20°E (Africa / Europe) at frame 0, matching the reference's opening.
  const rotY = (160 * Math.PI) / 180 + TAU * p;
  const cosR = Math.cos(rotY);
  const sinR = Math.sin(rotY);
  // Fixed axial tilt plus a slow periodic nod.
  const tilt = (-17 * Math.PI) / 180 + 0.035 * Math.sin(TAU * p);
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);

  const gz = GLOBE_CENTER_Z + camZ;
  const centerScale = FOCAL / gz;
  const screenR = GLOBE_RADIUS * centerScale * k;
  const gcx = cx + mx * (GLOBE_CENTER_X - camX) * centerScale * k;
  const gcy = cy + (GLOBE_CENTER_Y - camY) * centerScale * k;

  ctx.globalCompositeOperation = "lighter";

  // Atmosphere: a soft bloom hugging the sphere, brightest at the limb.
  const halo = ctx.createRadialGradient(gcx, gcy, screenR * 0.55, gcx, gcy, screenR * 1.28);
  halo.addColorStop(0, rgba(theme.limb, 0));
  halo.addColorStop(0.78, rgba(theme.limb, 0.012));
  halo.addColorStop(0.93, rgba(theme.limb, 0.055));
  halo.addColorStop(1, rgba(theme.limb, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(gcx, gcy, screenR * 1.3, 0, TAU);
  ctx.fill();

  // Faint interior fill so the sphere reads as a solid volume of light.
  const core = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, screenR);
  core.addColorStop(0, rgba(theme.meshBack, 0.03));
  core.addColorStop(0.86, rgba(theme.meshBack, 0.04));
  core.addColorStop(1, rgba(theme.limb, 0.055));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(gcx, gcy, screenR, 0, TAU);
  ctx.fill();

  const batch = new DotBatch([
    theme.meshFront, theme.meshBack,
    theme.landFront, theme.landBack,
    theme.ring, theme.limb,
  ]);

  const plot = (
    pts: SpherePoint[],
    frontColor: number,
    backColor: number,
    frontAlpha: number,
    backAlpha: number,
    sizeMul: number,
  ) => {
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      // spin about the polar axis…
      const rx = pt.x * cosR + pt.z * sinR;
      const rz = -pt.x * sinR + pt.z * cosR;
      // …then tilt the axis toward the camera.
      const ry2 = pt.y * cosT - rz * sinT;
      const rz2 = pt.y * sinT + rz * cosT;

      const Z = gz + rz2 * GLOBE_RADIUS;
      const s = FOCAL / Z;
      // The mirror flips where the globe SITS, not the globe itself — a
      // mirror-image Earth would read as an error rather than a layout.
      const x =
        cx +
        (mx * (GLOBE_CENTER_X - camX) + rx * GLOBE_RADIUS) * s * k;
      const y = cy + (GLOBE_CENTER_Y + ry2 * GLOBE_RADIUS - camY) * s * k;

      const front = rz2 < 0;
      // Dots foreshorten (and so pile up) toward the silhouette, so damp by
      // the view-angle cosine and add back only a razor-thin fresnel rim.
      const facing = Math.abs(rz2);
      const rim = 1 - facing;
      const rim8 = rim * rim * rim * rim * rim * rim * rim * rim;
      const boost = 0.5 + 0.55 * facing + 0.75 * rim8;
      const alpha = (front ? frontAlpha : backAlpha) * boost;
      const colorIndex = front ? frontColor : backColor;
      batch.add(colorIndex, alpha, x, y, Math.max(0.85, pt.size * sizeMul * s * k));
    }
  };

  plot(geo.mesh, 0, 1, 0.2, 0.08, 1.5);
  plot(geo.rings, 4, 1, 0.3, 0.1, 1.7);
  plot(geo.land, 2, 3, 1, 0.34, 2.8);
  batch.flush(ctx);

  // Crisp limb highlight.
  ctx.strokeStyle = rgba(theme.limb, 0.14);
  ctx.lineWidth = Math.max(1, 2.2 * k);
  ctx.beginPath();
  ctx.arc(gcx, gcy, screenR, 0, TAU);
  ctx.stroke();
};

// -------------------------------------------------------------------- tickers

type TickerArgs = GlobeArgs & {
  tierCanvases: HTMLCanvasElement[];
  minTier: number;
  maxTier: number;
  zMin: number;
  zMax: number;
};

const CONDENSED = "GlobeCondensed, Arial Narrow, sans-serif";
const MONO = "GlobeMono, monospace";

const drawTickers = (args: TickerArgs) => {
  const { ctx, width, height, theme, geo, p, camX, camY, camZ, k, cx, cy, mx,
    tierCanvases, minTier, maxTier, zMin, zMax } = args;

  const travel = FIELD_Z_FAR - FIELD_Z_NEAR;
  // One bucket of render jobs per blur tier.
  const byTier: (() => void)[][] = [[], [], [], [], []];

  for (const t of geo.tickers) {
    let z = t.z0 - travel * p;
    while (z < FIELD_Z_NEAR) z += travel;
    z += camZ;
    if (z < zMin || z >= zMax) continue;

    const tier = tierForZ(z);
    if (tier < minTier || tier > maxTier) continue;

    const s = FOCAL / z;
    const X = t.x + t.swayX * Math.sin(TAU * p + t.phase);
    const Y = t.y + t.swayY * Math.sin(TAU * p * 2 + t.phase);
    const x = cx + mx * (X - camX) * s * k;
    const y = cy + (Y - camY) * s * k;

    const fontPx = 22 * t.fontScale * s * k;
    if (fontPx < 1.2) continue;
    // Generous margin so heavily blurred chips still bleed in from off-frame.
    const margin = fontPx * 14 + 120;
    if (x < -margin || x > width + margin || y < -margin || y > height + margin) continue;

    const fade =
      smoothstep(FIELD_Z_NEAR, FIELD_Z_NEAR + 240, z) *
      (1 - smoothstep(FIELD_Z_FAR - 1100, FIELD_Z_FAR, z));
    const alpha = t.dim * fade * (tier === 0 ? 0.92 : 0.85);
    if (alpha <= 0.02) continue;

    byTier[tier].push(() => paintTicker(tier === 0 ? ctx : tierCanvases[tier - 1].getContext("2d")!, t, x, y, fontPx, alpha, theme, k));
  }

  // Sharp tier paints straight onto the frame…
  if (byTier[0].length) {
    ctx.globalCompositeOperation = "lighter";
    for (const job of byTier[0]) job();
  }

  // …blurred tiers go to scratch canvases, then composite near-last so the
  // shallow depth of field layers correctly.
  for (let tier = 1; tier <= 4; tier++) {
    if (!byTier[tier].length) continue;
    const scratch = tierCanvases[tier - 1];
    const sctx = scratch.getContext("2d")!;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, width, height);
    sctx.globalCompositeOperation = "source-over";
    for (const job of byTier[tier]) job();

    ctx.globalCompositeOperation = "lighter";
    ctx.filter = `blur(${(BLUR_TIERS[tier] * k).toFixed(2)}px)`;
    ctx.drawImage(scratch, 0, 0);
    ctx.filter = "none";
  }
};

const paintTicker = (
  ctx: CanvasRenderingContext2D,
  t: Ticker,
  x: number,
  y: number,
  fontPx: number,
  alpha: number,
  theme: Theme,
  k: number,
) => {
  const color = t.up ? theme.up : theme.down;
  const padX = fontPx * 0.34;
  const padY = fontPx * 0.24;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  if (t.kind === "number") {
    ctx.font = `700 ${fontPx.toFixed(2)}px ${MONO}`;
    ctx.fillStyle = rgba(color, alpha);
    ctx.fillText(t.value, x, y);
    return;
  }

  if (t.kind === "arrow") {
    const h = fontPx * 0.82;
    ctx.fillStyle = rgba(color, alpha);
    ctx.beginPath();
    if (t.up) {
      ctx.moveTo(x, y - h * 0.5);
      ctx.lineTo(x + h * 0.58, y + h * 0.5);
      ctx.lineTo(x - h * 0.58, y + h * 0.5);
    } else {
      ctx.moveTo(x, y + h * 0.5);
      ctx.lineTo(x + h * 0.58, y - h * 0.5);
      ctx.lineTo(x - h * 0.58, y - h * 0.5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.font = `400 ${(fontPx * 0.86).toFixed(2)}px ${MONO}`;
    ctx.fillStyle = rgba(color, alpha * 0.85);
    ctx.fillText(t.value, x + h * 0.85, y);
    return;
  }

  ctx.font = `700 ${fontPx.toFixed(2)}px ${CONDENSED}`;
  const labelW = ctx.measureText(t.label).width;
  ctx.font = `400 ${fontPx.toFixed(2)}px ${MONO}`;
  const valueW = ctx.measureText(t.value).width;
  const gap = fontPx * 0.42;
  const totalW = labelW + gap + valueW;

  if (t.kind === "chip" || t.kind === "solid") {
    const bx = x - padX;
    const by = y - fontPx * 0.5 - padY;
    const bw = totalW + padX * 2;
    const bh = fontPx + padY * 2;
    if (t.kind === "solid") {
      ctx.fillStyle = rgba(color, alpha * 0.92);
      ctx.fillRect(bx, by, bw, bh);
    } else {
      ctx.fillStyle = rgba(theme.bgOuter, alpha * 0.55);
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = rgba(color, alpha * 0.85);
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.strokeRect(bx, by, bw, bh);
    }
  }

  // On a solid chip the text is knocked back so the block stays dominant.
  const textAlpha = t.kind === "solid" ? alpha * 0.5 : alpha;
  const textColor = t.kind === "solid" ? theme.bgOuter : color;
  ctx.font = `700 ${fontPx.toFixed(2)}px ${CONDENSED}`;
  ctx.fillStyle = t.kind === "solid" ? rgba(textColor, textAlpha) : rgba(theme.neutralText, alpha * 0.9);
  ctx.fillText(t.label, x, y);
  ctx.font = `400 ${fontPx.toFixed(2)}px ${MONO}`;
  ctx.fillStyle = rgba(textColor, textAlpha);
  ctx.fillText(t.value, x + labelW + gap, y);
};

// ---------------------------------------------------------------------- flare

const drawFlare = ({
  ctx, width, height, theme, p,
}: { ctx: CanvasRenderingContext2D; width: number; height: number; theme: Theme; p: number }) => {
  const fx = theme.mirror ? width * 0.095 : width * 0.905;
  const fy = height * 0.44;
  const pulse = 1 + 0.06 * Math.sin(TAU * p) + 0.03 * Math.sin(TAU * p * 3 + 2);

  ctx.globalCompositeOperation = "lighter";

  const bloom = ctx.createRadialGradient(fx, fy, 0, fx, fy, width * 0.66 * pulse);
  bloom.addColorStop(0, rgba(theme.flareBloom, 0.62));
  bloom.addColorStop(0.14, rgba(theme.flareBloom, 0.3));
  bloom.addColorStop(0.42, rgba(theme.flareBloom, 0.1));
  bloom.addColorStop(0.75, rgba(theme.flareBloom, 0.02));
  bloom.addColorStop(1, rgba(theme.flareBloom, 0));
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, width, height);

  // Anamorphic streak.
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(1, 0.045);
  const streak = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.46 * pulse);
  streak.addColorStop(0, rgba(theme.flareCore, 0.55));
  streak.addColorStop(0.35, rgba(theme.flareBloom, 0.18));
  streak.addColorStop(1, rgba(theme.flareBloom, 0));
  ctx.fillStyle = streak;
  ctx.beginPath();
  ctx.arc(0, 0, width * 0.46 * pulse, 0, TAU);
  ctx.fill();
  ctx.restore();

  const core = ctx.createRadialGradient(fx, fy, 0, fx, fy, width * 0.055 * pulse);
  core.addColorStop(0, rgba(theme.flareCore, 0.95));
  core.addColorStop(0.25, rgba(theme.flareCore, 0.4));
  core.addColorStop(1, rgba(theme.flareCore, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, width, height);
};

export { FIELD_Y, FIELD_X };
