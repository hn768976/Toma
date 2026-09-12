// The link graph drawn over the halftone map: real city coordinates projected
// with the same equirectangular window that public/world-dots.png was baked
// with, so nodes land on actual coastlines.

import {
  MAP_H,
  MAP_LAT_MAX,
  MAP_LAT_MIN,
  MAP_LON_MAX,
  MAP_LON_MIN,
  MAP_W,
} from "./constants";
import { hashSeed, mulberry32 } from "./rng";

export type GeoPoint = { name: string; lon: number; lat: number };

/** Map-local pixel position (origin at the map's top-left corner). */
export const project = (point: GeoPoint) => ({
  x: ((point.lon - MAP_LON_MIN) / (MAP_LON_MAX - MAP_LON_MIN)) * MAP_W,
  y: ((MAP_LAT_MAX - point.lat) / (MAP_LAT_MAX - MAP_LAT_MIN)) * MAP_H,
});

export const CITIES: readonly GeoPoint[] = [
  { name: "SEA", lon: -122.3, lat: 47.6 },
  { name: "SFO", lon: -122.4, lat: 37.8 },
  { name: "LAX", lon: -118.2, lat: 34.1 },
  { name: "DEN", lon: -105.0, lat: 39.7 },
  { name: "CHI", lon: -87.6, lat: 41.9 },
  { name: "NYC", lon: -74.0, lat: 40.7 },
  { name: "MEX", lon: -99.1, lat: 19.4 },
  { name: "BOG", lon: -74.1, lat: 4.7 },
  { name: "LIM", lon: -77.0, lat: -12.0 },
  { name: "GRU", lon: -46.6, lat: -23.5 },
  { name: "EZE", lon: -58.4, lat: -34.6 },
  { name: "REK", lon: -21.9, lat: 64.1 },
  { name: "LON", lon: -0.1, lat: 51.5 },
  { name: "PAR", lon: 2.3, lat: 48.9 },
  { name: "MAD", lon: -3.7, lat: 40.4 },
  { name: "OSL", lon: 10.7, lat: 59.9 },
  { name: "BER", lon: 13.4, lat: 52.5 },
  { name: "ROM", lon: 12.5, lat: 41.9 },
  { name: "MOW", lon: 37.6, lat: 55.8 },
  { name: "IST", lon: 29.0, lat: 41.0 },
  { name: "CAI", lon: 31.2, lat: 30.0 },
  { name: "LOS", lon: 3.4, lat: 6.5 },
  { name: "NBO", lon: 36.8, lat: -1.3 },
  { name: "JNB", lon: 28.0, lat: -26.2 },
  { name: "DXB", lon: 55.3, lat: 25.2 },
  { name: "KHI", lon: 67.0, lat: 24.9 },
  { name: "DEL", lon: 77.2, lat: 28.6 },
  { name: "BOM", lon: 72.9, lat: 19.1 },
  { name: "NSK", lon: 82.9, lat: 55.0 },
  { name: "BKK", lon: 100.5, lat: 13.8 },
  { name: "SIN", lon: 103.8, lat: 1.4 },
  { name: "HKG", lon: 114.2, lat: 22.3 },
  { name: "PEK", lon: 116.4, lat: 39.9 },
  { name: "ICN", lon: 127.0, lat: 37.6 },
  { name: "TYO", lon: 139.7, lat: 35.7 },
  { name: "CGK", lon: 106.8, lat: -6.2 },
  { name: "PER", lon: 115.9, lat: -32.0 },
  { name: "SYD", lon: 151.2, lat: -33.9 },
  { name: "AKL", lon: 174.8, lat: -36.9 },
];

export type NetworkNode = {
  name: string;
  x: number;
  y: number;
  /** Bigger hubs get a ring and a label. */
  hub: boolean;
  phase: number;
};

export type NetworkLink = {
  from: NetworkNode;
  to: NetworkNode;
  /** Signed bow of the quadratic arc, in map pixels. */
  bow: number;
  /** Seconds a pulse takes to travel the link. */
  speed: number;
  phase: number;
  /** Links without traffic stay as faint static lines. */
  active: boolean;
};

export type NetworkGraph = {
  nodes: NetworkNode[];
  links: NetworkLink[];
};

/**
 * Connects every node to its nearest neighbours, plus a few deliberate
 * long-haul trunks so the graph reads as intercontinental rather than local.
 */
export const buildNetwork = (): NetworkGraph => {
  const rng = mulberry32(hashSeed("data-network/graph/v1"));

  const nodes: NetworkNode[] = CITIES.map((city) => {
    const { x, y } = project(city);
    return {
      name: city.name,
      x,
      y,
      hub: rng() < 0.34,
      phase: rng(),
    };
  });

  const seen = new Set<string>();
  const links: NetworkLink[] = [];

  const addLink = (a: NetworkNode, b: NetworkNode) => {
    const key =
      a.name < b.name ? `${a.name}-${b.name}` : `${b.name}-${a.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    links.push({
      from: a,
      to: b,
      bow: (rng() < 0.5 ? -1 : 1) * span * (0.05 + rng() * 0.13),
      speed: 2.6 + rng() * 3.4,
      phase: rng(),
      active: rng() < 0.45,
    });
  };

  for (const node of nodes) {
    const neighbours = nodes
      .filter((other) => other !== node)
      .map((other) => ({
        other,
        dist: Math.hypot(other.x - node.x, other.y - node.y),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, node.hub ? 4 : 2);
    for (const { other } of neighbours) addLink(node, other);
  }

  const byName = new Map(nodes.map((node) => [node.name, node]));
  const trunks: [string, string][] = [
    ["NYC", "LON"],
    ["NYC", "PAR"],
    ["SFO", "TYO"],
    ["SEA", "ICN"],
    ["LAX", "SYD"],
    ["LON", "DXB"],
    ["LON", "JNB"],
    ["PAR", "GRU"],
    ["MAD", "BOG"],
    ["DXB", "SIN"],
    ["SIN", "SYD"],
    ["HKG", "SFO"],
    ["MOW", "PEK"],
    ["IST", "DEL"],
    ["CAI", "BOM"],
    ["JNB", "PER"],
    ["GRU", "LOS"],
    ["EZE", "JNB"],
    ["CHI", "REK"],
    ["TYO", "SYD"],
    ["NSK", "TYO"],
    ["AKL", "LIM"],
  ];
  for (const [a, b] of trunks) {
    const from = byName.get(a);
    const to = byName.get(b);
    if (from && to) addLink(from, to);
  }

  return { nodes, links };
};

/** Quadratic bezier control point for a bowed link. */
export const linkControlPoint = (link: NetworkLink) => {
  const mx = (link.from.x + link.to.x) / 2;
  const my = (link.from.y + link.to.y) / 2;
  const dx = link.to.x - link.from.x;
  const dy = link.to.y - link.from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: mx + (-dy / len) * link.bow, y: my + (dx / len) * link.bow };
};

/** Point at t along the link's quadratic bezier. */
export const pointOnLink = (link: NetworkLink, t: number) => {
  const c = linkControlPoint(link);
  const inv = 1 - t;
  return {
    x: inv * inv * link.from.x + 2 * inv * t * c.x + t * t * link.to.x,
    y: inv * inv * link.from.y + 2 * inv * t * c.y + t * t * link.to.y,
  };
};
