import React, { useLayoutEffect } from "react";
import { HEIGHT, WIDTH } from "./constants";
import { parseHex, rgba } from "../lib";
import type { Scene } from "./scene";

/**
 * The ground the whole piece sits on: a deep field that lifts toward a wash
 * pooled around the horizon. Also the frame's clear, which is what makes the
 * whole draw pass idempotent.
 */
export const BackgroundWash: React.FC<{ scene: Scene }> = ({ scene }) => {
  useLayoutEffect(() => {
    const { main: ctx, variant, vpy, camY } = scene;
    const deep = parseHex(variant.palette.bgDeep);
    const wash = parseHex(variant.palette.bgWash);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = rgba(deep, 1);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // A soft pool of the wash colour around the vanishing point.
    const cy = vpy + camY;
    const g = ctx.createRadialGradient(
      WIDTH / 2 + scene.camX,
      cy,
      0,
      WIDTH / 2 + scene.camX,
      cy,
      WIDTH * 0.62,
    );
    g.addColorStop(0, rgba(wash, 0.55));
    g.addColorStop(0.35, rgba(wash, 0.2));
    g.addColorStop(1, rgba(wash, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // A gentle vertical lift so the frame is not a flat field.
    const v = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    v.addColorStop(0, rgba(deep, 0.55));
    v.addColorStop(Math.max(0.02, Math.min(0.98, cy / HEIGHT)), rgba(deep, 0));
    v.addColorStop(1, rgba(deep, 0.55));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  });

  return null;
};
