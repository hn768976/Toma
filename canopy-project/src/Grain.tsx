import React, { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender } from "remotion";
import { mulberry32 } from "./random";

/**
 * Film grain.
 *
 * A short cycle of pre-generated noise tiles rather than per-frame noise: the
 * tiles are built once per browser context and swapped by frame index, so the
 * cost is paid at startup instead of 600 times. TILE_COUNT divides the loop
 * length exactly, so the grain repeats seamlessly along with everything else.
 *
 * It doubles as dithering. Long, near-flat fog gradients across 4K are the most
 * likely thing in this piece to band once encoded, and a little noise on top is
 * what breaks the contours up.
 *
 * Grain is defined in composition pixels, with a cell size chosen so the 1080p
 * preview and the 4K master carry the same grain strength.
 */
const TILE_COUNT = 8;
const TILE_SIZE = 768;
/**
 * Grain cell size in composition pixels. Real grain is clumped rather than
 * per-pixel, and giving it a cell buys three things at once: it looks like film
 * instead of like sensor noise; it survives the 2:1 downscale to the 1080p
 * preview at full strength rather than averaging away; and it costs a fraction
 * of the bitrate, since per-pixel white noise is the worst case there is for an
 * encoder.
 */
const CELL = 2;
/**
 * Grain is composited linearly (normal blend at low opacity), not with
 * `overlay`. Overlay looks right in the midtones but its response collapses
 * toward both ends of the range — against this piece's bright foggy sky it
 * lands near zero, which leaves the long sky gradients undithered and banding.
 * A plain alpha blend applies the same amplitude everywhere.
 *
 * With full-range uniform noise the standard deviation works out to
 * STRENGTH / sqrt(12), tuned here to the ~2.5% the brief asks for (verified on
 * a 4K still by tools/qc.mjs). The cost is a slight pull toward mid-grey —
 * about 3.5% off the extremes, which is also roughly what a real grain plate
 * does to contrast.
 */
const STRENGTH = 0.078;

let tilesPromise: Promise<string[]> | null = null;

const buildTiles = async (): Promise<string[]> => {
  const rng = mulberry32(0x11e5ed);
  const out: string[] = [];

  for (let i = 0; i < TILE_COUNT; i++) {
    const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire a 2D context for grain");

    const image = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    const px = image.data;
    for (let cy = 0; cy < TILE_SIZE; cy += CELL) {
      for (let cx = 0; cx < TILE_SIZE; cx += CELL) {
        // Neutral by construction: one value written to all three channels, so
        // the grain can never introduce a colour cast.
        const v = rng() * 255;
        for (let dy = 0; dy < CELL; dy++) {
          for (let dx = 0; dx < CELL; dx++) {
            const p = ((cy + dy) * TILE_SIZE + (cx + dx)) * 4;
            px[p] = v;
            px[p + 1] = v;
            px[p + 2] = v;
            px[p + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(image, 0, 0);
    out.push(URL.createObjectURL(await canvas.convertToBlob({ type: "image/png" })));
  }
  return out;
};

const getTiles = () => {
  tilesPromise ??= buildTiles();
  return tilesPromise;
};

export const Grain: React.FC<{ frame: number }> = ({ frame }) => {
  const [tiles, setTiles] = useState<string[] | null>(null);
  const [handle] = useState(() => delayRender("Building film grain tiles"));

  useEffect(() => {
    let live = true;
    getTiles()
      .then((t) => {
        if (live) setTiles(t);
        continueRender(handle);
      })
      // Surface the real cause rather than letting the frame time out with a
      // generic delayRender message.
      .catch((err) => cancelRender(err));
    return () => {
      live = false;
    };
  }, [handle]);

  if (!tiles) return null;

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${tiles[frame % TILE_COUNT]})`,
        backgroundRepeat: "repeat",
        backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
        opacity: STRENGTH,
        pointerEvents: "none",
      }}
    />
  );
};
