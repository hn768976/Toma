import React, { useLayoutEffect } from "react";
import { random } from "remotion";
import { CONFIG } from "./config";
import { createBuffer } from "./draw";
import type { PassProps } from "./passes";

/**
 * Final finish: a soft vignette, then fine grain.
 *
 * The grain is generated once into a tile and repeated. A per-pixel pass over
 * a 4K frame would be ~8.3M draws for something that is only 3% visible. The
 * tile is seeded from the `seed` prop, so it reproduces with everything else.
 */
export const GrainPass: React.FC<PassProps> = ({ canvasRef, scene }) => {
  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const { width, height } = scene;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";

    const centreX = width / 2;
    const centreY = height / 2;
    const outer = Math.hypot(centreX, centreY);
    const vignette = ctx.createRadialGradient(centreX, centreY, 0, centreX, centreY, outer);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(CONFIG.finish.vignetteStart, "rgba(0,0,0,0)");
    vignette.addColorStop(
      (1 + CONFIG.finish.vignetteStart) / 2,
      `rgba(0,0,0,${(CONFIG.finish.vignette * 0.3).toFixed(4)})`,
    );
    vignette.addColorStop(1, `rgba(0,0,0,${CONFIG.finish.vignette.toFixed(4)})`);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    const tileSize = CONFIG.finish.grain.tile;
    const tile = createBuffer(tileSize, tileSize);
    const tileCtx = tile.getContext("2d");
    if (!tileCtx) return;

    const image = tileCtx.createImageData(tileSize, tileSize);
    const data = image.data;
    const spread = CONFIG.finish.grain.spread;
    // Mid grey is the identity for 'overlay', so deviations from 128 lighten
    // and darken symmetrically.
    for (let i = 0; i < data.length; i += 4) {
      const value = 128 + (random(scene.grainSeed + i) - 0.5) * 2 * spread;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    tileCtx.putImageData(image, 0, 0);

    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = CONFIG.finish.grain.alpha;
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        ctx.drawImage(tile, x, y);
      }
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }, [canvasRef, scene]);

  return null;
};
