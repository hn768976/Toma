import React, { useLayoutEffect, useMemo } from "react";
import { createCanvas, drawUpscaled } from "../lib/canvas";
import { rgba } from "../lib/color";
import { rndRange } from "../lib/rng";
import type { LayerBaseProps } from "./types";
import { layerContext } from "./types";

/**
 * Darkening towards the corners and edges of the frame.
 *
 * In screen blend this is not really "a vignette" — it is the statement that
 * the overlay should affect the middle of the editor's shot more than its
 * edges, which is almost always what they want.
 *
 * A clean radial falloff gives that away as computer-generated, so the dark
 * area is built by punching a cluster of soft ellipses of different sizes out
 * of a solid field. Their union is an irregular hole, biased off-centre so one
 * side of the frame carries more shadow than the other. It is static: there is
 * nothing to animate here, and static means it cannot break the loop.
 */

const LOW_RES_DIVISOR = 16;
const HOLE_COUNT = 7;

type Hole = { x: number; y: number; rx: number; ry: number; strength: number };

const buildHoles = (lowW: number, lowH: number): Hole[] => {
  const holes: Hole[] = [];
  // The main opening, pushed up and to the left of centre so the shadow sits
  // heavier on the right and bottom of the frame than on the top and left.
  holes.push({
    x: lowW * 0.43,
    y: lowH * 0.45,
    rx: lowW * 0.5,
    ry: lowH * 0.56,
    strength: 1,
  });
  for (let i = 1; i < HOLE_COUNT; i++) {
    const s = "vignette|hole" + i;
    holes.push({
      // Biased towards the same side, which is what breaks up the falloff
      // into something lopsided rather than a clean ellipse.
      x: rndRange(s + "|x", 0.18, 0.62) * lowW,
      y: rndRange(s + "|y", 0.2, 0.7) * lowH,
      rx: rndRange(s + "|rx", 0.2, 0.44) * lowW,
      ry: rndRange(s + "|ry", 0.24, 0.52) * lowH,
      strength: rndRange(s + "|s", 0.45, 0.95),
    });
  }
  return holes;
};

export const EdgeVignette: React.FC<LayerBaseProps> = (props) => {
  const { width, height, palette, intensity, mode } = props;

  const lowW = Math.ceil(width / LOW_RES_DIVISOR);
  const lowH = Math.ceil(height / LOW_RES_DIVISOR);
  const buffer = useMemo(() => createCanvas(lowW, lowH), [lowW, lowH]);
  const holes = useMemo(() => buildHoles(lowW, lowH), [lowW, lowH]);
  const shadow = palette.blotchDark;

  // The mask never changes, so build it once rather than every frame.
  const built = useMemo(() => {
    if (!buffer) return false;
    const ctx = buffer.getContext("2d");
    if (!ctx) return false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, lowW, lowH);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = rgba(shadow, 1);
    ctx.fillRect(0, 0, lowW, lowH);

    ctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < holes.length; i++) {
      const hole = holes[i];
      ctx.save();
      ctx.translate(hole.x, hole.y);
      ctx.scale(1, hole.ry / hole.rx);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, hole.rx);
      gradient.addColorStop(0, "rgba(0, 0, 0, " + hole.strength + ")");
      gradient.addColorStop(0.55, "rgba(0, 0, 0, " + hole.strength * 0.82 + ")");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, hole.rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return true;
  }, [buffer, holes, lowW, lowH, shadow]);

  useLayoutEffect(() => {
    const ctx = layerContext(props);
    if (!ctx || !buffer || !built) return;
    ctx.save();
    ctx.globalAlpha = intensity;
    // Multiply the ground down in screen mode; remove alpha in alpha mode.
    ctx.globalCompositeOperation = mode === "alpha" ? "destination-out" : "multiply";
    drawUpscaled(ctx, buffer, width, height);
    ctx.restore();
  });

  return null;
};
