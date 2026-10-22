// Seeded city points and great-circle routes, weighted to the busy
// regions (Europe, North America, East Asia, the Gulf).
import counts from "../../../data/counts.json";
import { mulberry32, gauss, weighted, pick } from "../../lib/random";
import { isLand, landPolygons, project } from "./worldMap";

type Region = { lat: number; lon: number; sLat: number; sLon: number; w: number };
const REGIONS: Region[] = [
  { lat: 49, lon: 8, sLat: 5, sLon: 9, w: 22 }, // Europe
  { lat: 52, lon: -1, sLat: 2, sLon: 2, w: 5 }, // UK
  { lat: 41, lon: -77, sLat: 4, sLon: 6, w: 14 }, // NE North America
  { lat: 32, lon: -88, sLat: 4, sLon: 8, w: 6 }, // SE US
  { lat: 37, lon: -120, sLat: 5, sLon: 3, w: 6 }, // West coast
  { lat: 46, lon: -100, sLat: 6, sLon: 14, w: 3 }, // Interior
  { lat: 19, lon: -99, sLat: 4, sLon: 5, w: 4 }, // Mexico
  { lat: 18, lon: -72, sLat: 2, sLon: 6, w: 1.5 }, // Caribbean
  { lat: -21, lon: -46, sLat: 6, sLon: 5, w: 7 }, // Brazil
  { lat: -34, lon: -60, sLat: 4, sLon: 5, w: 3 }, // Buenos Aires / Chile
  { lat: -33.9, lon: 18.5, sLat: 1, sLon: 1, w: 2 }, // Cape Town
  { lat: -15, lon: -70, sLat: 12, sLon: 4, w: 2 }, // Andes
  { lat: 31, lon: 116, sLat: 6, sLon: 6, w: 14 }, // China
  { lat: 35.5, lon: 138, sLat: 2, sLon: 3, w: 6 }, // Japan
  { lat: 37, lon: 127, sLat: 1, sLon: 1, w: 3 }, // Korea
  { lat: 8, lon: 105, sLat: 6, sLon: 8, w: 6 }, // SE Asia
  { lat: 21, lon: 78, sLat: 6, sLon: 5, w: 7 }, // India
  { lat: 25, lon: 53, sLat: 3, sLon: 4, w: 7 }, // Gulf
  { lat: 38, lon: 35, sLat: 3, sLon: 6, w: 3 }, // Turkey / Levant
  { lat: 30, lon: 31, sLat: 2, sLon: 2, w: 1.5 }, // Cairo
  { lat: 6, lon: 3, sLat: 3, sLon: 6, w: 1.5 }, // West Africa
  { lat: -1, lon: 37, sLat: 4, sLon: 3, w: 1.2 }, // East Africa
  { lat: -27, lon: 27, sLat: 3, sLon: 4, w: 1.2 }, // Southern Africa
  { lat: 33, lon: -7, sLat: 2, sLon: 3, w: 1 }, // Maghreb
  { lat: 55.7, lon: 37.6, sLat: 2, sLon: 5, w: 3 }, // Moscow
  { lat: 55, lon: 85, sLat: 3, sLon: 25, w: 1.2 }, // Siberia
  { lat: -31, lon: 146, sLat: 4, sLon: 7, w: 6 }, // Australia
  { lat: -32, lon: 116, sLat: 1, sLon: 1, w: 1.5 }, // Perth
  { lat: -39, lon: 175, sLat: 2, sLon: 2, w: 0.8 }, // New Zealand
  { lat: 61, lon: -150, sLat: 2, sLon: 4, w: 0.5 }, // Alaska
];

export type Route = {
  pts: number[];
  len: number;
  phase: number;
  period: number;
  dur: number;
  tail: number;
  opacity: number;
  width: number;
};

const slerpPath = (lon1: number, lat1: number, lon2: number, lat2: number, n: number) => {
  const toV = (lon: number, lat: number) => {
    const a = (lon * Math.PI) / 180;
    const b = (lat * Math.PI) / 180;
    return [Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)];
  };
  const p = toV(lon1, lat1);
  const q = toV(lon2, lat2);
  const dot = Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]));
  const om = Math.acos(dot);
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = Math.sin(om) < 1e-6 ? [1 - t, t] : [Math.sin((1 - t) * om) / Math.sin(om), Math.sin(t * om) / Math.sin(om)];
    const v = [0, 1, 2].map((k) => s[0] * p[k] + s[1] * q[k]);
    out.push([(Math.atan2(v[1], v[0]) * 180) / Math.PI, (Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI]);
  }
  return { pts: out, angle: om };
};

export const buildRoutes = (W: number, H: number): Route[] => {
  const rng = mulberry32(0x5eed_f117);
  const polys = landPolygons();
  const cities: { lon: number; lat: number; w: number }[] = [];
  const regionWeights = REGIONS.map((r) => r.w);
  for (let i = 0; i < counts.flights.cities; i++) {
    const r = REGIONS[weighted(rng, regionWeights)];
    let lon = r.lon;
    let lat = r.lat;
    for (let tries = 0; tries < 25; tries++) {
      lat = r.lat + gauss(rng) * r.sLat * 0.6;
      lon = r.lon + gauss(rng) * r.sLon * 0.6;
      if (isLand(lon, lat, polys)) break;
    }
    // Hubs: a few cities carry most of the traffic.
    cities.push({ lon, lat, w: Math.pow(rng(), 3) * 8 + 0.3 });
  }
  const cw = cities.map((c) => c.w);
  const routes: Route[] = [];
  const periods = [600, 300, 200];
  for (let i = 0; i < counts.flights.routes; i++) {
    const a = cities[weighted(rng, cw)];
    let b = a;
    if (rng() < 0.2) {
      // Regional: a nearby city.
      const near = cities.filter((c) => c !== a && Math.hypot(c.lon - a.lon, c.lat - a.lat) < 28);
      b = near.length ? pick(rng, near) : cities[weighted(rng, cw)];
    } else {
      while (b === a) b = cities[weighted(rng, cw)];
    }
    const { pts: ll, angle } = slerpPath(a.lon, a.lat, b.lon, b.lat, Math.max(16, Math.ceil(angle0(a, b) * 40)));
    void angle;
    // Bow the great circle a little, like a drawn flight arc.
    const bend = (rng() - 0.5) * (rng() < 0.25 ? 1.8 : 0.8);
    const xy: number[] = [];
    let shift = 0;
    let prevX = 0;
    let len = 0;
    for (let k = 0; k < ll.length; k++) {
      const [x0, y] = project(ll[k][0], ll[k][1], W, H);
      let x = x0 + shift;
      if (k > 0) {
        if (x - prevX > W / 2) { shift -= W; x -= W; }
        else if (prevX - x > W / 2) { shift += W; x += W; }
        len += Math.hypot(x - prevX, y - xy[xy.length - 1]);
      }
      xy.push(x, y);
      prevX = x;
    }
    {
      const n = xy.length / 2;
      const dx = xy[xy.length - 2] - xy[0];
      const dy = xy[xy.length - 1] - xy[1];
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const b = Math.sin(Math.PI * t) * bend;
        xy[2 * k] += -dy * b;
        xy[2 * k + 1] += dx * b;
      }
      len = 0;
      for (let k = 1; k < n; k++) len += Math.hypot(xy[2 * k] - xy[2 * k - 2], xy[2 * k + 1] - xy[2 * k - 1]);
    }
    const k = weighted(rng, [0.55, 0.3, 0.15]);
    routes.push({
      pts: xy,
      len,
      phase: Math.floor(rng() * 600),
      period: periods[k],
      dur: 0,
      tail: 0.15 + 0.15 * rng(),
      opacity: 0.15 + 0.35 * rng(),
      width: 1.6 + 1.0 * rng(),
    });
  }
  // Durations: proportional to length, scaled so that ~600 streaks are
  // visible on average (sum of dur / period over all routes).
  let scale = 1;
  for (let it = 0; it < 6; it++) {
    let vis = 0;
    for (const r of routes) {
      r.dur = Math.min(r.period * 0.95, Math.max(36, (r.len / 14) * scale));
      vis += r.dur / r.period;
    }
    scale *= counts.flights.visibleTarget / vis;
  }
  return routes;
};

const angle0 = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) =>
  Math.hypot(a.lon - b.lon, a.lat - b.lat) / 180;
