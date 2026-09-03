import {useEffect, useState} from "react";
import type {Feature, FeatureCollection, MultiPolygon, Polygon, Position} from "geojson";
import {continueRender, delayRender, staticFile} from "remotion";
import {feature} from "topojson-client";
import type {Topology} from "topojson-specification";

/**
 * Loads Natural Earth land polygons (public domain, no attribution required)
 * from a TopoJSON file in `public/` and returns them as a single GeoJSON
 * MultiPolygon.
 *
 * The fetch is memoised at module scope so that a composition with several
 * layers, or a studio session scrubbing back and forth, only ever pays for it
 * once. Frame capture is gated behind `delayRender()` so no frame is ever shot
 * against an empty map.
 */
export type LandFeature = Feature<MultiPolygon>;

let cached: LandFeature | null = null;
let inflight: Promise<LandFeature> | null = null;

/**
 * Drops polygons that lie entirely south of `southLimit`. At 110m resolution
 * Antarctica is the only landmass fully below -55, so this removes it (and a
 * handful of sub-antarctic specks) without touching anything else.
 */
const dropFarSouth = (mp: MultiPolygon, southLimit: number): MultiPolygon => ({
  type: "MultiPolygon",
  coordinates: mp.coordinates.filter((polygon: Position[][]) => {
    let maxLat = -90;
    for (const ring of polygon) {
      for (const [, lat] of ring) if (lat > maxLat) maxLat = lat;
    }
    return maxLat > southLimit;
  }),
});

export const loadLand = (
  file = "land-110m.json",
  southLimit = -55,
): Promise<LandFeature> => {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetch(staticFile(file))
    .then((r) => r.json() as Promise<Topology>)
    .then((topology) => {
      // `feature()` yields a FeatureCollection for a TopoJSON GeometryCollection
      // and a bare Feature otherwise; world-atlas ships the former. Flatten
      // whichever shape comes back into one MultiPolygon.
      const geo = feature(topology, topology.objects.land) as
        | Feature<MultiPolygon | Polygon>
        | FeatureCollection<MultiPolygon | Polygon>;

      const parts: Position[][][] = [];
      const collect = (g: MultiPolygon | Polygon | null) => {
        if (!g) return;
        if (g.type === "Polygon") parts.push(g.coordinates);
        else for (const poly of g.coordinates) parts.push(poly);
      };
      if (geo.type === "FeatureCollection") {
        for (const f of geo.features) collect(f.geometry);
      } else {
        collect(geo.geometry);
      }

      const merged: MultiPolygon = {type: "MultiPolygon", coordinates: parts};
      const out: LandFeature = {
        type: "Feature",
        properties: {},
        geometry: dropFarSouth(merged, southLimit),
      };
      cached = out;
      return out;
    });
  return inflight;
};

/** Hook form: returns `null` until the land is ready, and holds the render. */
export const useLand = (file?: string, southLimit?: number): LandFeature | null => {
  const [land, setLand] = useState<LandFeature | null>(cached);
  const [handle] = useState(() => (cached ? null : delayRender("Loading land geometry")));

  useEffect(() => {
    let live = true;
    loadLand(file, southLimit)
      .then((l) => {
        if (live) setLand(l);
        if (handle !== null) continueRender(handle);
      })
      .catch((err) => {
        console.error("Failed to load land geometry", err);
        if (handle !== null) continueRender(handle);
      });
    return () => {
      live = false;
    };
  }, [file, southLimit, handle]);

  return land;
};
