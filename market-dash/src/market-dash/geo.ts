import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { geoEquirectangular, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { HEIGHT, WIDTH } from "./layout";

/** Natural Earth 110m land as a single MultiPolygon, Antarctica removed. */
export type LandGeometry = GeoJSON.MultiPolygon;

/**
 * Anything whose northernmost point is below this parallel is Antarctica or
 * one of its fringing shelf islands, and is dropped.
 */
const ANTARCTIC_LIMIT = -55;

const withoutAntarctica = (geometry: LandGeometry): LandGeometry => ({
  type: "MultiPolygon",
  coordinates: geometry.coordinates.filter((polygon) => {
    let maxLat = -90;
    for (const [, lat] of polygon[0]) {
      if (lat > maxLat) maxLat = lat;
    }
    return maxLat > ANTARCTIC_LIMIT;
  }),
});

/**
 * Plain equirectangular, centred on the frame. The scale is set by hand
 * rather than with fitExtent so the graticule stays a regular 15° lattice in
 * screen space and the map keeps the same footprint in all three variants.
 */
const SCALE_FACTOR = 1.12;

export const projection: GeoProjection = geoEquirectangular()
  .scale(((WIDTH / (2 * Math.PI)) * SCALE_FACTOR))
  .translate([WIDTH / 2, HEIGHT / 2])
  .precision(0.4);

/** Screen pixels per degree of latitude/longitude under `projection`. */
export const PIXELS_PER_DEGREE =
  ((WIDTH / (2 * Math.PI)) * SCALE_FACTOR * Math.PI) / 180;

/** Loads the land geometry from public/ once, holding the render until ready. */
export const useLandGeometry = (): LandGeometry | null => {
  const [land, setLand] = useState<LandGeometry | null>(null);

  useEffect(() => {
    const handle = delayRender("Loading Natural Earth 110m land");
    let cancelled = false;

    fetch(staticFile("land-110m.json"))
      .then((res) => res.json() as Promise<Topology>)
      .then((topology) => {
        if (cancelled) return;
        const collection = feature(topology, topology.objects.land);
        const geometry =
          collection.type === "FeatureCollection"
            ? (collection.features[0].geometry as LandGeometry)
            : (collection.geometry as LandGeometry);
        setLand(withoutAntarctica(geometry));
        continueRender(handle);
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error("Failed to load land-110m.json", err);
        continueRender(handle);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return land;
};

export const createOffscreen = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

/** Traces the land into `ctx` as a path. Stroking or filling is the caller's. */
export const traceLand = (
  ctx: CanvasRenderingContext2D,
  land: LandGeometry,
): void => {
  const path = geoPath(projection, ctx);
  ctx.beginPath();
  path(land);
};

export type DotMatrix = {
  pitch: number;
  cols: number;
  rows: number;
  /** true where the sample point falls on land. */
  land: Uint8Array;
  /** true where a land sample has fewer than 6 land neighbours. */
  coastal: Uint8Array;
};

/**
 * Builds the v2 dot matrix by rasterising the land once and reading it back,
 * rather than running a point-in-polygon test 32,000 times against a 10,000
 * vertex MultiPolygon.
 */
export const buildDotMatrix = (
  land: LandGeometry,
  pitch: number,
): DotMatrix => {
  const mask = createOffscreen(WIDTH, HEIGHT);
  const maskCtx = mask.getContext("2d");
  const cols = Math.ceil(WIDTH / pitch);
  const rows = Math.ceil(HEIGHT / pitch);
  const onLand = new Uint8Array(cols * rows);
  const coastal = new Uint8Array(cols * rows);
  if (!maskCtx) return { pitch, cols, rows, land: onLand, coastal };

  // An offscreen stencil, never composited into the frame, so this colour is
  // not part of any palette.
  maskCtx.fillStyle = "white";
  traceLand(maskCtx, land);
  maskCtx.fill("evenodd");
  const pixels = maskCtx.getImageData(0, 0, WIDTH, HEIGHT).data;

  for (let row = 0; row < rows; row++) {
    const y = Math.min(HEIGHT - 1, Math.round(row * pitch + pitch / 2));
    for (let col = 0; col < cols; col++) {
      const x = Math.min(WIDTH - 1, Math.round(col * pitch + pitch / 2));
      if (pixels[(y * WIDTH + x) * 4 + 3] > 127) onLand[row * cols + col] = 1;
    }
  }

  // A land dot with fewer than six land neighbours is on a coast; those are
  // drawn brighter, which is what makes the continents legible without a fill.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (!onLand[index]) continue;
      let neighbours = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = col + dx;
          const ny = row + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if (onLand[ny * cols + nx]) neighbours++;
        }
      }
      if (neighbours < 6) coastal[index] = 1;
    }
  }

  return { pitch, cols, rows, land: onLand, coastal };
};
