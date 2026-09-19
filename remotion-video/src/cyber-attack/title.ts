import { FONTS, scaleFor } from "./constants";
import type { MoodColor, TitleKind, TitleState } from "./director";
import { rand } from "./random";

// The two title lock-ups and the chamfered panel they sit in.
//
// Both are drawn as tracked-out runs of individual glyphs rather than one
// fillText, so each character can be nudged on its own when the signal
// breaks up — the letters come apart before the panel does.

type Lockup = {
  text: string;
  family: string;
  /** Fraction of frame width the run should occupy. */
  widthRatio: number;
  /** Letter spacing as a fraction of the font size. */
  tracking: number;
  /** Panel padding either side of the run, design-grid pixels. */
  padX: number;
};

const LOCKUPS: Record<TitleKind, Lockup> = {
  hacked: {
    text: "SYSTEM HACKED",
    family: `"${FONTS.pixel}", "DejaVu Sans Mono", monospace`,
    widthRatio: 0.615,
    tracking: 0.13,
    padX: 118,
  },
  cyber: {
    text: "Cyber Attack",
    family: `"${FONTS.round}", "DejaVu Sans", sans-serif`,
    widthRatio: 0.36,
    tracking: 0.012,
    padX: 178,
  },
};

type Measured = { fontSize: number; width: number; advances: number[] };

/** Sizes a run so it lands on `targetWidth`, and caches the glyph advances. */
const measureRun = (
  ctx: CanvasRenderingContext2D,
  lockup: Lockup,
  targetWidth: number,
): Measured => {
  const probe = 100;
  ctx.font = `700 ${probe}px ${lockup.family}`;
  const chars = [...lockup.text];
  const advances = chars.map((ch) => ctx.measureText(ch).width);
  const raw =
    advances.reduce((a, b) => a + b, 0) +
    lockup.tracking * probe * (chars.length - 1);
  const fontSize = (targetWidth / raw) * probe;
  const k = fontSize / probe;
  return {
    fontSize,
    width: targetWidth,
    advances: advances.map((a) => a * k),
  };
};

const drawRun = (
  ctx: CanvasRenderingContext2D,
  lockup: Lockup,
  m: Measured,
  cx: number,
  cy: number,
  jitter: (i: number) => { dx: number; dy: number },
): void => {
  const chars = [...lockup.text];
  const track = lockup.tracking * m.fontSize;
  ctx.font = `700 ${m.fontSize}px ${lockup.family}`;
  ctx.textBaseline = "middle";
  let x = cx - m.width / 2;
  for (let i = 0; i < chars.length; i += 1) {
    const { dx, dy } = jitter(i);
    ctx.fillText(chars[i], x + dx, cy + dy);
    x += m.advances[i] + track;
  }
};

/** Elongated hexagon with softened corners — the alert plate. */
const panelPath = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  chamfer: number,
  radius: number,
): void => {
  const l = cx - halfW;
  const r = cx + halfW;
  const t = cy - halfH;
  const b = cy + halfH;
  // Six-sided plate: flat top and bottom, angled ends.
  const pts: [number, number][] = [
    [l + chamfer, t],
    [r - chamfer, t],
    [r, cy],
    [r - chamfer, b],
    [l + chamfer, b],
    [l, cy],
  ];
  ctx.beginPath();
  ctx.moveTo((pts[5][0] + pts[0][0]) / 2, (pts[5][1] + pts[0][1]) / 2);
  for (let i = 0; i < pts.length; i += 1) {
    const cur = pts[i];
    const next = pts[(i + 1) % pts.length];
    ctx.arcTo(cur[0], cur[1], next[0], next[1], radius);
  }
  ctx.closePath();
};

export const drawTitle = (
  ctx: CanvasRenderingContext2D,
  state: TitleState,
  mood: MoodColor,
  frame: number,
  width: number,
  height: number,
): void => {
  if (!state || state.opacity <= 0.01) return;
  const s = scaleFor(width);
  const lockup = LOCKUPS[state.kind];
  const cx = width / 2;
  const cy = height * 0.482;

  const m = measureRun(ctx, lockup, width * lockup.widthRatio);

  // Panel breathes very slightly over the length of the cue.
  const breathe = 1 + Math.sin(state.progress * Math.PI) * 0.018;
  const halfW = (m.width / 2 + lockup.padX * s) * breathe;
  const halfH = m.fontSize * 1.27 * breathe;

  const glowR = Math.max(1, Math.round(mood.r * 255 * 0.6 + 120));
  const glowG = Math.max(1, Math.round(mood.g * 255 * 0.35 + 18));
  const glowB = Math.max(1, Math.round(mood.b * 255 * 0.55 + 90));
  const glow = `${glowR}, ${glowG}, ${glowB}`;

  ctx.save();
  ctx.globalAlpha = state.opacity;
  ctx.globalCompositeOperation = "lighter";

  // Soft bed of light under the plate.
  const bed = ctx.createRadialGradient(cx, cy, 0, cx, cy, halfW * 1.15);
  bed.addColorStop(0, `rgba(${glow}, 0.55)`);
  bed.addColorStop(0.45, `rgba(${glow}, 0.22)`);
  bed.addColorStop(1, `rgba(${glow}, 0)`);
  ctx.fillStyle = bed;
  ctx.fillRect(cx - halfW * 1.3, cy - halfH * 2.6, halfW * 2.6, halfH * 5.2);

  // The plate itself, brightest through the middle band.
  const plate = ctx.createLinearGradient(0, cy - halfH, 0, cy + halfH);
  plate.addColorStop(0, `rgba(${glow}, 0.06)`);
  plate.addColorStop(0.5, `rgba(${glow}, 0.34)`);
  plate.addColorStop(1, `rgba(${glow}, 0.06)`);
  panelPath(ctx, cx, cy, halfW, halfH, halfH * 0.78, 20 * s);
  ctx.fillStyle = plate;
  ctx.fill();
  ctx.lineWidth = 1.7 * s;
  ctx.strokeStyle = `rgba(${glow}, ${0.2 + mood.heat * 0.22})`;
  ctx.stroke();

  // Title: a wide bloom pass, then a tight one, then the white core.
  const wobble = (i: number) => {
    const block = Math.floor(frame / 2);
    const loose = rand(block, i, 0x44) < 0.14 ? 1 : 0;
    return {
      dx: loose ? (rand(block, i, 0x55) - 0.5) * 12 * s : 0,
      dy: loose ? (rand(block, i, 0x66) - 0.5) * 5 * s : 0,
    };
  };

  ctx.fillStyle = `rgba(${glow}, 0.5)`;
  ctx.shadowColor = `rgba(${glow}, 0.9)`;
  ctx.shadowBlur = 46 * s;
  drawRun(ctx, lockup, m, cx, cy, wobble);

  ctx.fillStyle = "rgba(190, 228, 255, 0.85)";
  ctx.shadowColor = "rgba(120, 200, 255, 0.95)";
  ctx.shadowBlur = 16 * s;
  drawRun(ctx, lockup, m, cx, cy, wobble);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  drawRun(ctx, lockup, m, cx, cy, wobble);

  ctx.restore();
};
