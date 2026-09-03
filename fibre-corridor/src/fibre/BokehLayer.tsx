import React, { useLayoutEffect, useMemo } from "react";
import { random } from "remotion";
import { HEIGHT, WIDTH } from "./constants";
import { mixHex, parseHex } from "./color";
import { radialBlob } from "./draw";
import { TAU } from "./geometry";
import type { Scene } from "./scene";

const COUNT = 35;

type Disc = {
  x: number;
  y: number;
  r: number;
  alpha: number;
  ax: number;
  ay: number;
  kx: number;
  ky: number;
  px: number;
  py: number;
  tint: number;
  front: boolean;
};

const build = (name: string): Disc[] => {
  const out: Disc[] = [];
  for (let i = 0; i < COUNT; i++) {
    const k = `${name}-bok-${i}`;
    out.push({
      x: random(`${k}-x`) * WIDTH,
      y: random(`${k}-y`) * HEIGHT,
      r: HEIGHT * (0.018 + 0.085 * Math.pow(random(`${k}-r`), 1.6)),
      alpha: 0.035 + 0.075 * random(`${k}-a`),
      ax: 20 + random(`${k}-ax`) * 90,
      ay: 16 + random(`${k}-ay`) * 70,
      // Integer cycle counts: every disc returns to its start at frame 375.
      kx: 1 + Math.floor(random(`${k}-kx`) * 3),
      ky: 1 + Math.floor(random(`${k}-ky`) * 3),
      px: random(`${k}-px`) * TAU,
      py: random(`${k}-py`) * TAU,
      tint: random(`${k}-t`),
      // A little over a third of them pass in front of the strand field.
      front: random(`${k}-f`) < 0.38,
    });
  }
  return out;
};

/**
 * Out-of-focus discs drifting near the camera on closed paths. Rendered in
 * two calls per frame — the ones behind the strand field and the ones in
 * front of it.
 */
export const BokehLayer: React.FC<{ scene: Scene; front: boolean }> = ({
  scene,
  front,
}) => {
  const discs = useMemo(() => build(scene.variant.name), [scene.variant.name]);

  useLayoutEffect(() => {
    const { main: ctx, variant, p, camX, camY } = scene;
    const base = parseHex(variant.palette.bokeh);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";

    for (const disc of discs) {
      if (disc.front !== front) continue;
      const x =
        disc.x + disc.ax * Math.sin(TAU * disc.kx * p + disc.px) + camX * 1.6;
      const y =
        disc.y + disc.ay * Math.cos(TAU * disc.ky * p + disc.py) + camY * 1.6;
      const inner = mixHex(
        variant.palette.bokeh,
        variant.palette.strandPale,
        disc.tint * 0.8,
      );
      radialBlob(ctx, x, y, disc.r, inner, base, disc.alpha, 0.55);
      // A faint rim, the way a defocused highlight reads.
      ctx.globalAlpha = disc.alpha * 0.55;
      ctx.strokeStyle = `rgba(${Math.round(inner.r)},${Math.round(
        inner.g,
      )},${Math.round(inner.b)},1)`;
      ctx.lineWidth = disc.r * 0.06;
      ctx.beginPath();
      ctx.arc(x, y, disc.r * 0.88, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = "source-over";
  });

  return null;
};
