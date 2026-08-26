import {useLayoutEffect, useMemo} from 'react';
import {DURATION_IN_FRAMES} from '../config';
import {lighten, rgba, travelPhase} from '../lib/draw';
import {setMat} from '../lib/mat';
import {resetCtx, type LayersRef} from '../layers';
import {frameMatrix, type Scene, type StrandGeom} from '../scene';
import {THEMES} from '../theme';

/** Half-width of a travelling pulse, in strand samples. */
const PULSE_HALF = 3.2;

/**
 * Fills `outX`/`outY` with the strand's centreline for this frame: the geometry
 * is generated once in `buildScene`, and only the undulation offset is applied
 * per frame. Both sine terms use integer frequencies over the 372-frame loop,
 * and the envelope is zero at each end so the anchors never move.
 */
const undulate = (
  strand: StrandGeom,
  frame: number,
  outX: Float32Array,
  outY: Float32Array
): void => {
  const t = (frame / DURATION_IN_FRAMES) * Math.PI * 2;
  const a = Math.sin(t * strand.undF + strand.undP) * strand.undA;
  const b = Math.sin(t * strand.undF2 + strand.undP2) * strand.undA2;
  const total = a + b;
  for (let i = 0; i < outX.length; i++) {
    outX[i] = strand.xs[i];
    outY[i] = strand.ys[i] + strand.env[i] * total;
  }
};

const tracePath = (
  ctx: CanvasRenderingContext2D,
  xs: Float32Array,
  ys: Float32Array
): void => {
  ctx.moveTo(xs[0], ys[0]);
  for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
};

export const FibreFan: React.FC<{
  layers: LayersRef;
  scene: Scene;
  frame: number;
}> = ({layers, scene, frame}) => {
  const theme = THEMES[scene.variant];
  const samples = scene.strands[0].xs.length;

  // Scratch buffers, allocated once, so a frame does not churn 140 arrays.
  const buf = useMemo(
    () => ({x: new Float32Array(samples), y: new Float32Array(samples)}),
    [samples]
  );

  // No dependency array: the draw must run on EVERY render so that the layer
  // order described in layers.ts holds. See ChipDashboard for the full pass.
  useLayoutEffect(() => {
    const L = layers.current;
    if (!L) return;
    const ctx = L.main;
    resetCtx(ctx);
    setMat(ctx, frameMatrix(scene.base, frame));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const dir = scene.flowDirection;
    const groups = ['fibreA', 'fibreB', 'fibreC'] as const;

    /* ---- pass 1: wide, low-alpha glow -------------------------------- */
    // One accumulated path per hue rather than one per strand: the shadow is a
    // real blur and doing it 140 times a frame at 4K is not affordable, while a
    // grouped path gives the same soft bloom for three blur operations. A single
    // thick semi-transparent stroke on its own would read flat, hence the
    // separate sharp core pass below.
    ctx.globalCompositeOperation = 'lighter';
    for (const key of groups) {
      const colour = theme[key];
      ctx.beginPath();
      for (const strand of scene.strands) {
        if (strand.colorKey !== key) continue;
        undulate(strand, frame, buf.x, buf.y);
        tracePath(ctx, buf.x, buf.y);
      }
      ctx.shadowColor = rgba(colour, 1);
      ctx.shadowBlur = 20;
      ctx.strokeStyle = rgba(colour, 0.15);
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.shadowColor = rgba(theme.voidBlack, 0);

    /* ---- pass 2: sharp core ------------------------------------------ */
    // Fibres stay additive against the dark plate for the whole of passes 2-3.
    ctx.globalCompositeOperation = 'lighter';
    for (const strand of scene.strands) {
      undulate(strand, frame, buf.x, buf.y);
      const colour = theme[strand.colorKey];

      // Strands take on the chip's hue as they converge into it.
      const grad = ctx.createLinearGradient(
        buf.x[0],
        buf.y[0],
        buf.x[samples - 1],
        buf.y[samples - 1]
      );
      grad.addColorStop(0, rgba(colour, strand.alpha * 0.55));
      grad.addColorStop(0.45, rgba(colour, strand.alpha));
      grad.addColorStop(1, lighten(theme.chip, 0.25, strand.alpha));

      ctx.beginPath();
      tracePath(ctx, buf.x, buf.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = strand.coreWidth;
      ctx.stroke();

      /* ---- pass 3: travelling brightness pulse ----------------------- */
      // v1 (flowDirection +1) runs pulses along the strands INTO the chip.
      // v2 (-1) runs them out of the chip along the strands. Sample index 0 is
      // the frame edge, index n-1 is the chip, so the sign flip is the whole
      // reversal.
      const phase = travelPhase(frame, strand.period, strand.pulseOffset);
      const s = dir > 0 ? phase : 1 - phase;
      const centre = s * (samples - 1);
      const lo = Math.max(0, Math.floor(centre - PULSE_HALF));
      const hi = Math.min(samples - 1, Math.ceil(centre + PULSE_HALF));
      if (hi - lo < 2) continue;

      ctx.beginPath();
      ctx.moveTo(buf.x[lo], buf.y[lo]);
      for (let i = lo + 1; i <= hi; i++) ctx.lineTo(buf.x[i], buf.y[i]);

      ctx.strokeStyle = lighten(colour, 0.45, 0.22);
      ctx.lineWidth = strand.coreWidth * 4.5;
      ctx.stroke();
      ctx.strokeStyle = lighten(colour, 0.85, 0.95);
      ctx.lineWidth = strand.coreWidth * 1.35;
      ctx.stroke();
    }

    resetCtx(ctx);
  });

  return null;
};
