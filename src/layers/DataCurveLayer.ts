import { Easing, interpolate } from 'remotion';
import { CONFIG } from '../config';
import { alpha } from '../plane';
import { drawTabular, groupDigits } from '../text';
import type { CurveGeometry, Scene } from '../scene';

/**
 * DataCurve — the subject.
 *
 * A fitted exponential trend, revealed with a stroke-dash sweep, with hollow
 * node markers that pop in as the line reaches them and value labels that
 * follow four frames later.
 */
export const drawDataCurve = (
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  geo: CurveGeometry,
  fontFamily: string
) => {
  const p = scene.v.palette;
  const shown = scene.progress;
  if (shown <= 0) return;

  const path = new Path2D();
  path.moveTo(geo.pts[0][0], geo.pts[0][1]);
  for (let i = 1; i < geo.pts.length; i++) path.lineTo(geo.pts[i][0], geo.pts[i][1]);

  const L = geo.length;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([L, L]);
  ctx.lineDashOffset = (1 - shown) * L;

  // Wide, dim underlay first — cheap volumetric glow that survives the bloom pass.
  ctx.strokeStyle = alpha(p.curveCyan, 0.1);
  ctx.lineWidth = CONFIG.curveWidth * 5;
  ctx.stroke(path);
  ctx.strokeStyle = alpha(p.curveCyan, 0.22);
  ctx.lineWidth = CONFIG.curveWidth * 2.4;
  ctx.stroke(path);

  ctx.shadowColor = alpha(p.curveCyan, 0.9);
  ctx.shadowBlur = CONFIG.curveGlow;
  ctx.strokeStyle = p.curveCyan;
  ctx.lineWidth = CONFIG.curveWidth;
  ctx.stroke(path);
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);

  /* ── nodes ──────────────────────────────────────────────────────── */
  const r = CONFIG.nodeDiameter / 2;
  for (let i = 0; i < geo.nodes.length; i++) {
    const n = geo.nodes[i];
    if (shown < n.at) continue;

    // Frame at which the sweep passed this node. The reveal is eased with
    // out-cubic, so invert that to get back from arc length to frame number.
    const landed =
      CONFIG.curveDrawStart +
      (CONFIG.curveDrawEnd - CONFIG.curveDrawStart) *
        (1 - Math.pow(1 - n.at, 1 / 3));
    const age = scene.frame - landed;
    const pop = interpolate(age, [0, CONFIG.nodePopFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.back(2.2)),
    });
    const flash = interpolate(age, [0, CONFIG.nodeFlashFrames], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.quad),
    });
    const rr = r * Math.max(0.001, pop);

    ctx.beginPath();
    ctx.arc(n.x, n.y, rr, 0, Math.PI * 2);
    ctx.fillStyle = alpha(p.backgroundDeep, 0.92);
    ctx.fill();

    ctx.shadowColor = alpha(p.nodeRing, 0.95);
    ctx.shadowBlur = CONFIG.curveGlow * (0.5 + flash * 1.6);
    ctx.strokeStyle = p.nodeRing;
    ctx.lineWidth = CONFIG.nodeRingWidth;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (flash > 0) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, rr * (1 + (1 - flash) * 1.9), 0, Math.PI * 2);
      ctx.strokeStyle = alpha(p.labelWhite, flash * 0.5);
      ctx.lineWidth = CONFIG.nodeRingWidth * 0.8;
      ctx.stroke();
    }

    if (!n.labelled) continue;
    const labelOp = interpolate(
      age,
      [CONFIG.labelDelayFrames, CONFIG.labelDelayFrames + CONFIG.labelFadeFrames],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    if (labelOp <= 0) continue;

    // Value grows along the curve and keeps climbing after the node lands.
    const live = Math.round(
      n.value * interpolate(scene.progress, [n.at, 1], [0.72, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    );
    ctx.font = `500 ${CONFIG.valueLabelSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = alpha(p.labelWhite, labelOp * 0.94);
    ctx.shadowColor = alpha(p.backgroundDeep, 0.9);
    ctx.shadowBlur = 18;
    drawTabular(ctx, groupDigits(live), n.x + r + 26, n.y - r - 14);
    ctx.shadowBlur = 0;
  }
};
