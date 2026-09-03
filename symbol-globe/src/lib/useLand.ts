/**
 * Loads the Natural Earth land polygons out of public/ exactly once per page.
 *
 * Remotion screenshots a frame as soon as React has settled, so an async load
 * has to hold the frame open with delayRender() or the first frames render an
 * empty globe. The promise is cached at module scope: a render worker fetches
 * and parses the topology once, then every subsequent frame in that worker
 * resolves immediately.
 */
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { GeoPermissibleObjects } from "d3-geo";

export const LAND_FILE = "land-110m.json";

let cached: Promise<GeoPermissibleObjects> | null = null;

const loadLand = (): Promise<GeoPermissibleObjects> => {
  if (!cached) {
    cached = fetch(staticFile(LAND_FILE))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load ${LAND_FILE}: ${response.status}`);
        }
        return response.json() as Promise<Topology>;
      })
      .then(
        (topology) =>
          feature(
            topology,
            topology.objects.land,
          ) as unknown as GeoPermissibleObjects,
      );
  }
  return cached;
};

export const useLand = (): GeoPermissibleObjects | null => {
  const [land, setLand] = useState<GeoPermissibleObjects | null>(null);
  const [handle] = useState(() => delayRender("Loading land polygons"));

  useEffect(() => {
    let live = true;
    loadLand()
      .then((data) => {
        if (!live) return;
        setLand(data);
        continueRender(handle);
      })
      .catch((error) => cancelRender(error));
    return () => {
      live = false;
    };
  }, [handle]);

  return land;
};
