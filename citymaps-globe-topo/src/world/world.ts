// Natural Earth 1:110m land (public domain), pre-rasterised by
// scripts/prepare-world.mjs into an equirectangular bit mask + coastlines.
import world from "../data/world.json";

const W = world.w;
const H = world.h;
let bits: Uint8Array | null = null;
const getBits = () => {
  if (!bits) {
    const bin = atob(world.mask);
    bits = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bits[i] = bin.charCodeAt(i);
  }
  return bits;
};

export const isLand = (lon: number, lat: number) => {
  const c = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)));
  const r = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
  const idx = r * W + c;
  return (getBits()[idx >> 3] & (1 << (idx & 7))) !== 0;
};

export const coastlines = (): number[][] => world.coasts;

// Approximate coordinates of major cities (lat, lon). No names are shown.
export const CITIES: [number, number][] = [
  [40.7, -74.0],
  [34.0, -118.2],
  [41.9, -87.6],
  [43.7, -79.4],
  [19.4, -99.1],
  [25.8, -80.2],
  [49.3, -123.1],
  [-23.5, -46.6],
  [-22.9, -43.2],
  [-34.6, -58.4],
  [-12.0, -77.0],
  [4.7, -74.1],
  [-33.4, -70.6],
  [51.5, -0.1],
  [48.9, 2.35],
  [40.4, -3.7],
  [52.5, 13.4],
  [41.9, 12.5],
  [55.75, 37.6],
  [41.0, 29.0],
  [30.0, 31.2],
  [6.5, 3.4],
  [-26.2, 28.0],
  [-1.3, 36.8],
  [25.2, 55.3],
  [24.7, 46.7],
  [19.0, 72.8],
  [28.6, 77.2],
  [24.9, 67.0],
  [23.8, 90.4],
  [13.75, 100.5],
  [1.35, 103.8],
  [-6.2, 106.8],
  [22.3, 114.2],
  [31.2, 121.5],
  [39.9, 116.4],
  [37.6, 127.0],
  [35.7, 139.7],
  [-33.9, 151.2],
  [-37.8, 145.0],
  [-36.8, 174.8],
  [14.6, 121.0],
];

// great-circle angle between two (lat, lon) points, radians
export const gcAngle = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180;
  const [la1, lo1] = [a[0] * r, a[1] * r];
  const [la2, lo2] = [b[0] * r, b[1] * r];
  const c = Math.sin(la1) * Math.sin(la2) + Math.cos(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
  return Math.acos(Math.max(-1, Math.min(1, c)));
};
