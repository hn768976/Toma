import { staticFile } from "remotion";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import type { MapRegion } from "./regions";

// Natural Earth (public domain), prepared by scripts/prepare-data.mjs.

export type Props = Record<string, string | number>;
export type F = Feature<Geometry, Props>;

export type Place = { name: string; lon: number; lat: number; pop: number; cap: 0 | 1 | 2; rank: number; a3: string };

export type MapData = {
  countries: F[];
  borders: F[];
  claims: F[];
  disputed: F[];
  lakes: F[];
  marine: F[];
  coast: F[];
  states: F[];
  stateLines: F[];
  places: Place[];
};

const cache = new Map<string, Promise<MapData>>();

const getJson = async <T,>(file: string): Promise<T> => {
  const res = await fetch(staticFile(`data/${file}`));
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return (await res.json()) as T;
};

const fc = (topo: Topology, name: string): F[] => {
  const obj = topo.objects[name];
  if (!obj) return [];
  return (feature(topo, obj) as unknown as FeatureCollection<Geometry, Props>).features;
};

export const loadMapData = (region: MapRegion): Promise<MapData> => {
  const key = `${region.dataset}:${region.admin1.join(",")}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const [topo, places, admin1] = await Promise.all([
        getJson<Topology>(region.dataset === "world" ? "ne_50m_world.json" : "ne_10m_regional.json"),
        getJson<Place[]>("ne_10m_places.json"),
        region.admin1.length ? getJson<Topology>("ne_50m_admin1_na.json") : Promise.resolve(null),
      ]);
      const inAdmin1 = (f: F) => region.admin1.includes(String(f.properties.adm0_a3));
      return {
        countries: fc(topo, "countries"),
        borders: fc(topo, "borders"),
        claims: fc(topo, "claims"),
        disputed: fc(topo, "disputed"),
        lakes: fc(topo, "lakes"),
        marine: fc(topo, "marine"),
        coast: fc(topo, "coast"),
        states: admin1 ? fc(admin1, "states").filter(inAdmin1) : [],
        stateLines: admin1 ? fc(admin1, "lines").filter(inAdmin1) : [],
        places,
      };
    })();
    cache.set(key, p);
  }
  return p;
};
