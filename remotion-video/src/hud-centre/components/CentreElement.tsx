import { toRgb, withAlpha } from "../palette";
import {
  CENTRE_RADAR_CONTACT_DECAY,
  CENTRE_RADAR_PERIOD,
  CRYPTO_BREATH_PERIOD,
  WIFI_PULSE_PERIOD,
  WIFI_PULSE_STAGE_GAP,
  WIFI_PULSE_WIDTH,
} from "../timing";
import { pulseEnvelope } from "@lib/motion/stepped";
import { type RadarColors, type RadarContact, drawRadarContacts, drawRadarSweep } from "@lib/scopes/radar-scope";

// ---------------------------------------------------------------------------
// v1 — "wifi"
// ---------------------------------------------------------------------------

const WIFI_ARC_HALF_SPAN = (55 * Math.PI) / 180; // ~110 degrees total
const WIFI_DOT_OFFSET = 165;
const WIFI_DOT_RADIUS = 50;
// Thickness increases slightly with radius. Sized so the outermost arc's
// corners clear the segment ring's inner circle (327px) with a little air.
const WIFI_ARCS = [
  { radius: 145, thickness: 36 },
  { radius: 245, thickness: 46 },
  { radius: 345, thickness: 56 },
];

/**
 * Three concentric arcs above a filled dot, all sharing a centre at the dot.
 *
 * The pulse is the whole point: dot, then inner arc, then middle, then outer,
 * each brightening for six frames as the pulse passes. Read as a sequence it
 * is unmistakably a broadcast rather than a static glyph.
 */
export const drawWifi = (
  ctx: CanvasRenderingContext2D,
  o: { cx: number; cy: number; accent: string; frame: number; pale: string },
) => {
  const { cx, cy, accent, frame, pale } = o;
  const dotY = cy + WIFI_DOT_OFFSET;
  const up = -Math.PI / 2;

  const stage = (i: number) =>
    pulseEnvelope(frame, WIFI_PULSE_PERIOD, i * WIFI_PULSE_STAGE_GAP, WIFI_PULSE_WIDTH);

  ctx.save();
  ctx.lineCap = "round";

  WIFI_ARCS.forEach((arc, i) => {
    const p = stage(i + 1);
    ctx.beginPath();
    ctx.strokeStyle = p > 0.35 ? pale : accent;
    ctx.globalAlpha = 0.62 + 0.38 * p;
    ctx.lineWidth = arc.thickness;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 26 + 74 * p;
    ctx.arc(cx, dotY, arc.radius, up - WIFI_ARC_HALF_SPAN, up + WIFI_ARC_HALF_SPAN);
    ctx.stroke();
  });

  const pd = stage(0);
  ctx.beginPath();
  ctx.fillStyle = pd > 0.35 ? pale : accent;
  ctx.globalAlpha = 0.7 + 0.3 * pd;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 30 + 80 * pd;
  ctx.arc(cx, dotY, WIFI_DOT_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

// ---------------------------------------------------------------------------
// v2 — "crypto"
// ---------------------------------------------------------------------------

/** A rounded-on-the-right rectangle, wound in the requested direction. */
const rightRoundedRect = (
  p: Path2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ccw: boolean,
) => {
  const r = Math.min(h / 2, w);
  if (!ccw) {
    p.moveTo(x, y);
    p.lineTo(x + w - r, y);
    p.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2, false);
    p.lineTo(x, y + h);
  } else {
    p.moveTo(x, y);
    p.lineTo(x, y + h);
    p.lineTo(x + w - r, y + h);
    p.arc(x + w - r, y + r, r, Math.PI / 2, -Math.PI / 2, true);
  }
  p.closePath();
};

/**
 * The Bitcoin mark as ONE Path2D, filled with the nonzero winding rule.
 *
 * The two counters are wound anticlockwise so nonzero punches them out, while
 * the two vertical strokes are wound clockwise so they stay solid where they
 * cross those counters. Even-odd would look right until a stroke crossed a
 * solid part of a bowl, where it would punch a hole instead.
 *
 * Being a real path rather than a rasterised mask is what makes the rest of
 * the treatment cheap: the same object gets filled for the body, clipped
 * against for the internal scan bands, and stroked for the rim.
 *
 * The Bitcoin symbol is a community mark in general commercial use, not a
 * corporate trademark.
 */
export const bitcoinPath = (W: number, H: number, pad: number): Path2D => {
  const p = new Path2D();
  const stem = 0.21 * W; // left vertical
  const wall = 0.15 * W; // right wall of each bowl
  const barTop = 0.115 * H; // top and bottom horizontals
  const barMid = 0.13 * H; // the horizontal where the two bowls meet
  const h1 = 0.47 * H; // upper bowl, smaller than the lower one
  const h2 = H - h1;
  const w1 = 0.86 * W; // upper bowl is narrower than the lower one
  const w2 = W;

  // Outer forms, wound clockwise.
  p.rect(0, pad, stem, H);
  rightRoundedRect(p, 0, pad, w1, h1, false);
  rightRoundedRect(p, 0, pad + h1, w2, h2, false);

  // Counters, wound anticlockwise so nonzero punches them out. Sized from the
  // bar weights directly rather than by insetting the bowl, which is what
  // keeps them open at bold weights.
  rightRoundedRect(
    p,
    stem,
    pad + barTop,
    w1 - stem - wall,
    h1 - barTop - barMid / 2,
    true,
  );
  rightRoundedRect(
    p,
    stem,
    pad + h1 + barMid / 2,
    w2 - stem - wall,
    h2 - barMid / 2 - barTop,
    true,
  );

  // The two vertical strokes, extending above and below the letterform and
  // wound clockwise so they stay solid where they cross the counters.
  const sw = 0.12 * W;
  p.rect(0.31 * W, 0, sw, H + 2 * pad);
  p.rect(0.55 * W, 0, sw, H + 2 * pad);
  return p;
};

export const CRYPTO_HEIGHT = 460;
export const CRYPTO_PAD_RATIO = 0.16;
export const CRYPTO_WIDTH_RATIO = 0.62;

export const drawCrypto = (
  ctx: CanvasRenderingContext2D,
  o: {
    cx: number;
    cy: number;
    accent: string;
    frame: number;
    pale: string;
    path: Path2D;
  },
) => {
  const { cx, cy, accent, frame, pale, path } = o;
  const H = CRYPTO_HEIGHT;
  const W = H * CRYPTO_WIDTH_RATIO;
  const pad = H * CRYPTO_PAD_RATIO;
  const totalH = H + 2 * pad;

  // One breathing pulse, +/-12% of glow, on a 75-frame sine (6 clean cycles
  // across the loop). Deliberately unlike v1's sequential arc pulse.
  const breath = 1 + 0.12 * Math.sin((Math.PI * 2 * frame) / CRYPTO_BREATH_PERIOD);
  const [r, g, b] = toRgb(accent);

  ctx.save();
  ctx.translate(cx - W / 2, cy - totalH / 2);

  // Chromatic fringe: the same form three times, one channel offset each way,
  // added together. Where they coincide they sum back to the accent colour;
  // only the edges separate.
  const off = 5;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [dx, dy, col] of [
    [-off, -off * 0.4, `rgb(${r}, 0, 0)`],
    [off * 0.7, -off * 0.7, `rgb(0, ${g}, 0)`],
    [off * 0.3, off, `rgb(0, 0, ${b})`],
  ] as const) {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.fillStyle = col;
    ctx.fill(path);
    ctx.restore();
  }
  ctx.restore();

  // Bright rim. Stroked BEFORE the fill and then covered by it, so only the
  // outer half of the stroke survives: the rim traces the true silhouette and
  // the counter openings, instead of outlining every internal sub-path where
  // the vertical strokes cross solid parts of the bowls.
  ctx.save();
  ctx.strokeStyle = pale;
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.6 + 0.3 * breath;
  ctx.shadowColor = pale;
  ctx.shadowBlur = 18 * breath;
  ctx.stroke(path);
  ctx.restore();

  // Core, on top of the fringe and the inner half of the rim.
  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.95;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 52 * breath;
  ctx.fill(path);
  ctx.restore();

  // Internal scan bands: low contrast, drifting slowly, clipped to the form.
  // This is what stops it reading as a flat logo.
  ctx.save();
  ctx.clip(path);
  const spacing = 20;
  const drift = ((frame % 150) / 150) * spacing * 3;
  ctx.fillStyle = "rgba(0, 0, 0, 0.075)";
  for (let y = -spacing + (drift % spacing); y < totalH; y += spacing) {
    ctx.fillRect(0, y, W, 4);
  }
  ctx.fillStyle = withAlpha(pale, 0.035);
  for (let y = -spacing + (drift % spacing) + 8; y < totalH; y += spacing) {
    ctx.fillRect(0, y, W, 2);
  }
  ctx.restore();

  ctx.restore();
};

// ---------------------------------------------------------------------------
// v3 — "radar"
// ---------------------------------------------------------------------------

export const drawCentreRadar = (
  ctx: CanvasRenderingContext2D,
  o: {
    cx: number;
    cy: number;
    radius: number;
    accent: string;
    frame: number;
    contacts: RadarContact[];
    colors: RadarColors;
  },
) => {
  const { cx, cy, radius, frame, contacts, colors } = o;
  const opts = {
    cx,
    cy,
    radius,
    frame,
    period: CENTRE_RADAR_PERIOD,
    rings: 5,
    spokeStep: 30,
    wedgeSpan: (28 * Math.PI) / 180,
    colors,
    contacts,
    contactDecay: CENTRE_RADAR_CONTACT_DECAY,
    contactRadius: 11,
    wedgeAlpha: 0.8,
    trailAlpha: 0.2,
  };
  drawRadarSweep(ctx, opts);
  drawRadarContacts(ctx, opts);
};
