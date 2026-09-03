import React, { useLayoutEffect, useMemo } from "react";
import { LOOP_OMEGA } from "../constants";
import { createCanvas, drawUpscaled } from "../lib/canvas";
import { rgba } from "../lib/color";
import { rndBool, rndInt, rndRange } from "../lib/rng";
import type { LayerBaseProps } from "./types";
import { layerContext } from "./types";
import type { LayerSettings, MotionSettings } from "../variants";

/**
 * Broad, heavily diffused tonal unevenness — the reason the frame never looks
 * like a flat grey wash with dust on it.
 *
 * Blotches are irregular blob paths rather than circles, and they are computed
 * at 1/8 resolution: at that size a modest ctx.filter blur is equivalent to an
 * enormous one at 4K, and the high-quality upscale back to full size removes
 * whatever edge is left. Two buffers are used because light and dark blotches
 * composite differently — light ones screen on, dark ones multiply in (or, in
 * alpha mode, erase).
 */

const LOW_RES_DIVISOR = 8;
const BLOB_POINTS = 22;

type Blob = {
  dark: boolean;
  /** Position and radius in low-resolution pixels. */
  x: number;
  y: number;
  radius: number;
  alpha: number;
  /** Radial harmonics that make the outline irregular. */
  lobes: { k: number; amp: number; phase: number }[];
  driftAx: number;
  driftAy: number;
  driftKx: number;
  driftKy: number;
  driftPx: number;
  driftPy: number;
};

const buildBlobs = (count: number, lowW: number, lowH: number, driftScale: number): Blob[] => {
  const blobs: Blob[] = [];
  for (let i = 0; i < count; i++) {
    const s = "blotch" + i;
    const lobes: { k: number; amp: number; phase: number }[] = [];
    const lobeCount = rndInt(s + "|lobes", 2, 4);
    for (let l = 0; l < lobeCount; l++) {
      lobes.push({
        k: rndInt(s + "|k" + l, 2, 5),
        amp: rndRange(s + "|a" + l, 0.08, 0.26),
        phase: rndRange(s + "|p" + l, 0, Math.PI * 2),
      });
    }
    const drift = rndRange(s + "|drift", 0.02, 0.09) * lowW * driftScale;
    blobs.push({
      dark: rndBool(s + "|dark", 0.45),
      x: rndRange(s + "|x", -0.1, 1.1) * lowW,
      y: rndRange(s + "|y", -0.1, 1.1) * lowH,
      radius: rndRange(s + "|r", 0.12, 0.34) * lowW,
      // Kept very low on purpose. These are meant to be felt as broad tonal
      // unevenness, not seen as clouds: anything stronger lifts the base off
      // black and the whole overlay hazes the editor's footage in screen blend.
      alpha: rndRange(s + "|alpha", 0.05, 0.2),
      lobes,
      driftAx: drift,
      driftAy: drift * rndRange(s + "|ay", 0.4, 1),
      driftKx: rndInt(s + "|kx", 1, 2),
      driftKy: rndInt(s + "|ky", 1, 2),
      driftPx: rndRange(s + "|px", 0, Math.PI * 2),
      driftPy: rndRange(s + "|py", 0, Math.PI * 2),
    });
  }
  return blobs;
};

const traceBlob = (ctx: CanvasRenderingContext2D, blob: Blob, cx: number, cy: number): void => {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < BLOB_POINTS; i++) {
    const theta = (i / BLOB_POINTS) * Math.PI * 2;
    let r = 1;
    for (let l = 0; l < blob.lobes.length; l++) {
      const lobe = blob.lobes[l];
      r += lobe.amp * Math.sin(lobe.k * theta + lobe.phase);
    }
    const radius = blob.radius * Math.max(0.25, r);
    points.push({ x: cx + Math.cos(theta) * radius, y: cy + Math.sin(theta) * radius });
  }

  // Midpoint-quadratic smoothing: every sampled point becomes a control
  // point, so the outline has no corners before it is even blurred.
  ctx.beginPath();
  const first = points[0];
  const last = points[points.length - 1];
  ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  ctx.closePath();
};

type BlotchLayerProps = LayerBaseProps & {
  settings: LayerSettings["blotches"];
  motion: MotionSettings;
};

export const BlotchLayer: React.FC<BlotchLayerProps> = (props) => {
  const { frame, width, height, palette, intensity, settings, motion, mode } = props;

  const lowW = Math.ceil(width / LOW_RES_DIVISOR);
  const lowH = Math.ceil(height / LOW_RES_DIVISOR);

  const lightBuffer = useMemo(() => createCanvas(lowW, lowH), [lowW, lowH]);
  const darkBuffer = useMemo(() => createCanvas(lowW, lowH), [lowW, lowH]);
  const blobs = useMemo(
    () => buildBlobs(settings.count, lowW, lowH, motion.blotchDrift),
    [settings.count, lowW, lowH, motion.blotchDrift],
  );

  useLayoutEffect(() => {
    const ctx = layerContext(props);
    if (!ctx || !lightBuffer || !darkBuffer) return;
    const lightCtx = lightBuffer.getContext("2d");
    const darkCtx = darkBuffer.getContext("2d");
    if (!lightCtx || !darkCtx) return;

    lightCtx.setTransform(1, 0, 0, 1, 0, 0);
    darkCtx.setTransform(1, 0, 0, 1, 0, 0);
    lightCtx.clearRect(0, 0, lowW, lowH);
    darkCtx.clearRect(0, 0, lowW, lowH);
    // At 1/8 scale this is the equivalent of a ~140px blur at 4K.
    lightCtx.filter = "blur(17px)";
    darkCtx.filter = "blur(17px)";
    lightCtx.globalCompositeOperation = "lighter";
    darkCtx.globalCompositeOperation = "lighter";

    const t = frame * LOOP_OMEGA;
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const target = blob.dark ? darkCtx : lightCtx;
      const cx = blob.x + blob.driftAx * Math.sin(blob.driftKx * t + blob.driftPx);
      const cy = blob.y + blob.driftAy * Math.sin(blob.driftKy * t + blob.driftPy);
      target.fillStyle = rgba(blob.dark ? palette.blotchDark : palette.blotchLight, blob.alpha);
      traceBlob(target, blob, cx, cy);
      target.fill();
    }
    lightCtx.filter = "none";
    darkCtx.filter = "none";

    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.globalCompositeOperation = "screen";
    drawUpscaled(ctx, lightBuffer, width, height);
    // Darkening: multiply the ground down in screen mode, take alpha away in
    // alpha mode. Both mean "the overlay does less here".
    ctx.globalCompositeOperation = mode === "alpha" ? "destination-out" : "multiply";
    ctx.globalAlpha = intensity * (mode === "alpha" ? 0.5 : 1);
    drawUpscaled(ctx, darkBuffer, width, height);
    ctx.restore();
  });

  return null;
};
