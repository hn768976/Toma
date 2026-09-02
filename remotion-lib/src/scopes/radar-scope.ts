import { angleForward, rndRange } from "../random/seeded";

export type RadarContact = { angle: number; radius: number };

export type RadarColors = {
  grid: string;
  gridFaint: string;
  sweep: string;
  trail: string;
  contact: string;
  contactHot: string;
};

export type RadarScopeOpts = {
  cx: number;
  cy: number;
  radius: number;
  /** Frame, already wrapped into the loop. */
  frame: number;
  /** Frames for one full turn. Must divide the loop length. */
  period: number;
  rings: number;
  /** Degrees between radial spokes. */
  spokeStep: number;
  /** Wedge angular width, radians. */
  wedgeSpan: number;
  colors: RadarColors;
  contacts: RadarContact[];
  /** Frames for a contact to fade back to ~nothing after the sweep hits it. */
  contactDecay: number;
  contactRadius: number;
  /** Peak alpha of the sweep wedge and of the long persistence trail. */
  wedgeAlpha?: number;
  trailAlpha?: number;
  lineWidth?: number;
  /** Adds half-spacing rings and spokes inside [from, to] only. */
  denseSector?: { from: number; to: number } | null;
};

/** Where the sweep's leading edge is at this frame. Increasing = clockwise. */
export const sweepAngle = (frame: number, period: number) =>
  ((frame % period) / period) * Math.PI * 2 - Math.PI / 2;

/**
 * The static half of a radar scope: range rings, radial spokes, and an
 * optional denser sub-grid over one sector. Rasterise this once.
 */
export const drawRadarGrid = (
  ctx: CanvasRenderingContext2D,
  o: Pick<
    RadarScopeOpts,
    "cx" | "cy" | "radius" | "rings" | "spokeStep" | "colors" | "lineWidth" | "denseSector"
  >,
) => {
  const { cx, cy, radius, rings, spokeStep, colors, lineWidth = 2, denseSector } = o;

  ctx.lineWidth = lineWidth;

  // Range rings.
  for (let i = 1; i <= rings; i++) {
    ctx.beginPath();
    ctx.strokeStyle = i === rings ? colors.grid : colors.gridFaint;
    ctx.arc(cx, cy, (radius * i) / rings, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Radial spokes.
  ctx.strokeStyle = colors.gridFaint;
  for (let deg = 0; deg < 360; deg += spokeStep) {
    const a = (deg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.stroke();
  }

  // The asymmetric denser sub-grid: extra rings and spokes at half spacing,
  // clipped to one sector. This is what stops a polar grid reading as a
  // generic template.
  if (denseSector) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, denseSector.from, denseSector.to);
    ctx.closePath();
    ctx.clip();

    ctx.lineWidth = Math.max(1, lineWidth * 0.6);
    ctx.strokeStyle = colors.gridFaint;
    for (let i = 1; i < rings * 2; i += 2) {
      ctx.beginPath();
      ctx.arc(cx, cy, (radius * i) / (rings * 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let deg = spokeStep / 2; deg < 360; deg += spokeStep) {
      const a = (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.stroke();
    }
    ctx.restore();
  }
};

/**
 * The moving half: the sweep wedge and its persistence trail.
 *
 * PERSISTENCE, AND WHY IT IS NOT ACCUMULATED. The obvious way to build a
 * phosphor trail is to composite a low-alpha background rect over the last
 * frame instead of clearing, so the sweep's light piles up and decays. That is
 * stateful: the frame depends on every frame before it. Remotion renders
 * frames out of order and across parallel workers, so an accumulating scope
 * renders differently every time — and differently per worker within one
 * render.
 *
 * The trail is therefore computed analytically instead. The sweep turns at a
 * constant rate, so for any bearing the time since the sweep last crossed it
 * is exactly ((A - theta) mod 2pi) / omega, and the phosphor brightness is
 * exp(-age / tau). Sampling that decay into a conic gradient gives the same
 * picture as accumulation while staying a pure function of the frame number.
 */
export const drawRadarSweep = (ctx: CanvasRenderingContext2D, o: RadarScopeOpts) => {
  const {
    cx,
    cy,
    radius,
    frame,
    period,
    wedgeSpan,
    colors,
    wedgeAlpha = 0.85,
    trailAlpha = 0.17,
  } = o;

  const a = sweepAngle(frame, period);
  const tau = period / 6; // phosphor time constant, in frames

  const grad = ctx.createConicGradient(a, cx, cy);
  const STOPS = 64;
  for (let i = 0; i <= STOPS; i++) {
    const t = i / STOPS;
    // Bearing at this stop is a + t*2pi, so it was swept (1 - t)*2pi ago.
    const ageAngle = (1 - t) * Math.PI * 2;
    const ageFrames = (ageAngle / (Math.PI * 2)) * period;
    const inWedge = ageAngle <= wedgeSpan ? 1 - ageAngle / wedgeSpan : 0;
    const alpha =
      wedgeAlpha * Math.pow(inWedge, 1.4) + trailAlpha * Math.exp(-ageFrames / tau);
    grad.addColorStop(t, withA(colors.sweep, Math.min(1, alpha)));
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();

  // Hard bright leading edge. Without this the wedge's direction of travel is
  // readable but soft; with it there is no ambiguity at all.
  ctx.save();
  ctx.strokeStyle = colors.sweep;
  ctx.lineWidth = Math.max(2, radius * 0.008);
  ctx.shadowColor = colors.sweep;
  ctx.shadowBlur = radius * 0.05;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
  ctx.stroke();
  ctx.restore();
};

/**
 * Contacts. Each sits at a fixed bearing and range and lights only as the
 * sweep crosses it, then decays. Brightness comes from the angular distance
 * between the contact's bearing and the sweep — a pure function of the frame.
 */
export const drawRadarContacts = (ctx: CanvasRenderingContext2D, o: RadarScopeOpts) => {
  const { cx, cy, frame, period, colors, contacts, contactDecay, contactRadius } = o;
  const a = sweepAngle(frame, period);
  const tau = contactDecay / 2.5;

  for (const c of contacts) {
    const ageFrames = (angleForward(c.angle, a) / (Math.PI * 2)) * period;
    const b = Math.exp(-ageFrames / tau);
    if (b < 0.02) continue;
    const x = cx + Math.cos(c.angle) * c.radius;
    const y = cy + Math.sin(c.angle) * c.radius;

    ctx.save();
    ctx.globalAlpha = b;
    ctx.fillStyle = b > 0.75 ? colors.contactHot : colors.contact;
    ctx.shadowColor = colors.contactHot;
    ctx.shadowBlur = contactRadius * 3 * b;
    ctx.beginPath();
    ctx.arc(x, y, contactRadius * (0.72 + 0.45 * b), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

/** Deterministic contact placements for a scope. */
export const makeContacts = (
  seed: string,
  count: number,
  rMin: number,
  rMax: number,
): RadarContact[] =>
  Array.from({ length: count }, (_, i) => ({
    angle: rndRange(`${seed}-ang-${i}`, 0, Math.PI * 2),
    radius: rndRange(`${seed}-rad-${i}`, rMin, rMax),
  }));

// Local helper: apply an alpha to a hex colour without importing the palette
// module, so this file stays palette-agnostic.
const withA = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
