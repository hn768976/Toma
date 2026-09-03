import React, { useLayoutEffect, useMemo } from "react";
import { HEIGHT, WIDTH } from "./constants";
import { parseHex } from "../lib";
import { makeBuffer } from "../lib";
import { clamp, TAU } from "../lib";
import type { Scene } from "./scene";

/** The treatment is computed at 1/8 resolution and upscaled. */
const DOWN = 8;
const SW = WIDTH / DOWN;
const SH = HEIGHT / DOWN;

/** Integer cycles per loop, so the drift tiles exactly at 375 frames. */
const BAND_DRIFT = 2;
const HAZE_DRIFT = 1;

/**
 * The plane treatment. Which plane it lies on is derived from the variant's
 * signed bend direction, never assumed:
 *
 *  · "sheen" — broad, heavily blurred bands running toward the horizon along
 *    the same perspective as the strands, brighter beneath dense clusters.
 *  · "haze"  — no bands at all; diffuse volumetric light filling the region
 *    opposite the strands' plane, drifting slowly.
 *  · "none"  — nothing. A tube has no floor.
 */
export const FloorSheen: React.FC<{ scene: Scene }> = ({ scene }) => {
  const buf = useMemo(() => makeBuffer(SW, SH), []);

  useLayoutEffect(() => {
    const { variant, main, vpx, vpy, nearEdgeY, spread, camX, camY, p, density } =
      scene;
    const tint = variant.palette.sheen;
    if (variant.floorTreatment === "none" || tint === null) return;

    const bctx = buf.getContext("2d");
    if (!bctx) return;
    const img = bctx.createImageData(SW, SH);
    const data = img.data;
    const col = parseHex(tint);
    const bins = density.length;

    if (variant.floorTreatment === "sheen") {
      const planeSpan = nearEdgeY - vpy;
      for (let py = 0; py < SH; py++) {
        const Y = (py + 0.5) * DOWN;
        const d = (Y - vpy) / planeSpan;
        if (d <= 0.015 || d > 1.02) continue;
        // Bright pools sliding toward the horizon; brightest mid-distance.
        // Brightest in the mid distance, beneath the bends, falling away
        // toward the camera so the near floor stays dark.
        const depthFall =
          Math.exp(-Math.pow((d - 0.42) / 0.40, 2)) * (1 - 0.35 * d);
        for (let px = 0; px < SW; px++) {
          const X = (px + 0.5) * DOWN;
          const lane = (X - vpx) / (spread * d * d);
          const al = Math.abs(lane);
          if (al > 1.35) continue;
          const laneFall = 1 - Math.pow(al / 1.35, 2.2);
          // Broad lateral banding: wide, soft, no hard edges.
          const band =
            0.52 +
            0.48 * Math.sin(TAU * (lane * 3.1)) * 0.6 +
            0.28 * Math.sin(TAU * (lane * 1.35 + 0.2));
          // Slow travel of brightness along the depth axis.
          const travel =
            0.6 +
            0.4 *
              Math.sin(
                TAU * (1.6 * Math.pow(1 - d, 0.65) - BAND_DRIFT * p),
              );
          const bin = clamp(Math.floor((X / WIDTH) * bins), 0, bins - 1);
          const v =
            clamp(band, 0, 1.6) *
            travel *
            depthFall *
            laneFall *
            (0.45 + 0.55 * density[bin]);
          const a = clamp(v, 0, 1) * 210;
          const o = (py * SW + px) * 4;
          data[o] = col.r;
          data[o + 1] = col.g;
          data[o + 2] = col.b;
          data[o + 3] = a;
        }
      }
    } else {
      // Haze fills the region opposite the plane the strands run along.
      const hazeEdgeY = nearEdgeY > vpy ? 0 : HEIGHT;
      const span = hazeEdgeY - vpy;
      for (let py = 0; py < SH; py++) {
        const Y = (py + 0.5) * DOWN;
        const q = (Y - vpy) / span;
        if (q <= 0 || q > 1.05) continue;
        const band = Math.exp(-Math.pow((q - 0.46) / 0.66, 2));
        for (let px = 0; px < SW; px++) {
          const xn = (px + 0.5) / SW;
          const n =
            0.34 * Math.sin(TAU * (1.3 * xn + HAZE_DRIFT * p)) +
            0.30 * Math.sin(TAU * (0.7 * xn - 2 * q + HAZE_DRIFT * p + 0.7)) +
            0.24 * Math.sin(TAU * (2.1 * xn + 1.2 * q - HAZE_DRIFT * p + 1.9));
          const v = band * (0.62 + 0.5 * n);
          const a = clamp(v, 0, 1) * 200;
          const o = (py * SW + px) * 4;
          data[o] = col.r;
          data[o + 1] = col.g;
          data[o + 2] = col.b;
          data[o + 3] = a;
        }
      }
    }

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = "source-over";
    bctx.clearRect(0, 0, SW, SH);
    bctx.putImageData(img, 0, 0);

    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalCompositeOperation = "lighter";
    main.globalAlpha = variant.floorTreatment === "sheen" ? 0.26 : 0.30;
    main.imageSmoothingEnabled = true;
    main.imageSmoothingQuality = "high";
    main.filter = "blur(11px)";
    main.drawImage(buf, camX * 0.5, camY * 0.5, WIDTH, HEIGHT);
    main.filter = "none";
    main.globalAlpha = 1;
    main.globalCompositeOperation = "source-over";
  });

  return null;
};
