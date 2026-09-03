/**
 * neonStroke — a multi-pass glowing line whose brightness varies along its
 * length.
 *
 * Each segment is stroked several times: wide and faint for the glow, then
 * progressively narrower and brighter for the line itself. Every pass uses a
 * gradient that runs end colour -> body colour -> end colour, so the stroke is
 * brightest where it meets its endpoints and dimmest at its midpoint. Give the
 * endpoints the colours of whatever sits there (light sources, nodes, joints)
 * and the light reads as travelling inward along the line.
 *
 * Fully palette-agnostic: every colour is a parameter.
 */
import { mixRgba, rgba } from "./canvas";

export type Point = { x: number; y: number };

export type NeonSegment = {
  from: Point;
  to: Point;
  /** Hex colour at the `from` end. */
  startColor: string;
  /** Hex colour at the `to` end. */
  endColor: string;
};

export type NeonStrokePass = {
  /** Multiplier on the base width for this pass. */
  widthScale: number;
  /** Alpha at the segment endpoints. */
  endAlpha: number;
  /** Alpha at the segment midpoint. */
  midAlpha: number;
  /**
   * Overrides both the endpoint colours and the body colour for this pass.
   * Use it for the hot inner core, which should not pick up the end hues.
   */
  color?: string;
};

export type NeonStrokeOptions = {
  /** Base line width; each pass scales it. */
  baseWidth: number;
  /** Hex colour of the line between its endpoints. */
  bodyColor: string;
  passes: NeonStrokePass[];
  /** How far in from each end the hue has fully blended to the body colour. */
  blendStop?: number;
};

/**
 * Strokes every segment once per pass. Expects the caller to have set the
 * composite operation (`lighter` gives the usual additive neon look).
 */
export const neonStroke = (
  ctx: CanvasRenderingContext2D,
  segments: NeonSegment[],
  options: NeonStrokeOptions,
) => {
  const { baseWidth, bodyColor, passes, blendStop = 0.16 } = options;

  for (const pass of passes) {
    ctx.lineWidth = baseWidth * pass.widthScale;
    for (const segment of segments) {
      const start = pass.color ?? segment.startColor;
      const end = pass.color ?? segment.endColor;
      const body = pass.color ?? bodyColor;
      const blended = (pass.endAlpha + pass.midAlpha) / 2;

      const gradient = ctx.createLinearGradient(
        segment.from.x,
        segment.from.y,
        segment.to.x,
        segment.to.y,
      );
      gradient.addColorStop(0, rgba(start, pass.endAlpha));
      gradient.addColorStop(blendStop, mixRgba(start, body, 0.75, blended));
      gradient.addColorStop(0.5, rgba(body, pass.midAlpha));
      gradient.addColorStop(1 - blendStop, mixRgba(end, body, 0.75, blended));
      gradient.addColorStop(1, rgba(end, pass.endAlpha));

      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(segment.from.x, segment.from.y);
      ctx.lineTo(segment.to.x, segment.to.y);
      ctx.stroke();
    }
  }
};
