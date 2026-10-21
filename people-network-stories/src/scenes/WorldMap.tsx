import { Container, Sprite } from "pixi.js";
import React, { useMemo } from "react";
import { COLORS, COUNTS, FPS } from "../lib/colors";
import { easeIn, easeOut, remap } from "../lib/ease";
import { PixiInfo, PixiSetup, PixiStage } from "../lib/pixi/PixiStage";
import { makeIconTextures } from "../lib/pixi/icons";
import { mulberry32, shuffle } from "../lib/random";
import { useStaticJson } from "../lib/useStaticData";

type Ring = [number, number][];
type Land = Ring[][];

// Equirectangular projection (standard parallel 25deg) filling 95% of the frame width;
// the land spans 83.6N (Greenland) to 55.6S (Cape Horn). Antarctica is left out.
const LAT_TOP = 84;
const LAT_BOTTOM = -56.5;
const project = (lon: number, lat: number, W: number, H: number): [number, number] => {
  const mapW = W * 0.95;
  const x = (W - mapW) / 2 + ((lon + 180) / 360) * mapW;
  const pxPerDegY = ((mapW / 360) / Math.cos((25 * Math.PI) / 180));
  const mapH = (LAT_TOP - LAT_BOTTOM) * pxPerDegY;
  const top = (H - mapH) / 2;
  const y = top + (LAT_TOP - lat) * pxPerDegY;
  return [x, y];
};

type Person = { x: number; y: number; female: boolean };

// Rasterises the land (Antarctica excluded) once into a 1920x1080 mask, in the
// 3840x2160 frame space at half resolution. Rings crossing the 180deg meridian
// (Fiji, Chukotka) are unwrapped and drawn at +-360deg so nothing smears across the map.
const MASK_W = 1920;
const MASK_H = 1080;
const landMask = (land: Land) => {
  const c = document.createElement("canvas");
  c.width = MASK_W;
  c.height = MASK_H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  const k = MASK_W / 3840;
  for (const poly of land) {
    if (!poly[0].some(([, lat]) => lat > -60)) continue;
    for (const shift of [-360, 0, 360]) {
      ctx.beginPath();
      for (const ring of poly) {
        let prev = ring[0][0];
        let off = 0;
        ring.forEach(([lon, lat], i) => {
          if (i > 0 && Math.abs(lon - prev) > 180) off += lon < prev ? 360 : -360;
          prev = lon;
          const [x, y] = project(lon + off + shift, lat, 3840, 2160);
          if (i === 0) ctx.moveTo(x * k, y * k);
          else ctx.lineTo(x * k, y * k);
        });
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }
  }
  const data = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
  // Clip to the map's own longitude range.
  const [x0] = project(-180, 0, 3840, 2160);
  const [x1] = project(180, 0, 3840, 2160);
  return (x: number, y: number) => {
    if (x < x0 || x >= x1) return false;
    const mx = Math.floor(x * k);
    const my = Math.floor(y * k);
    if (mx < 0 || my < 0 || mx >= MASK_W || my >= MASK_H) return false;
    return data[(my * MASK_W + mx) * 4] > 127;
  };
};

// Samples `count` people on a jittered grid inside the land (in 3840x2160 units).
// The returned order is the arrival order (shuffled: scattered first, then dense).
const samplePeople = (land: Land, count: number): Person[] => {
  const isLand = landMask(land);
  const grid = (s: number) => {
    const rng = mulberry32(2602088);
    const pts: [number, number][] = [];
    const sy = s * 1.15;
    for (let y = sy / 2; y < 2160; y += sy) {
      for (let x = s / 2; x < 3840; x += s) {
        const jx = x + (rng() - 0.5) * s * 0.8;
        const jy = y + (rng() - 0.5) * sy * 0.7;
        if (isLand(jx, jy)) pts.push([jx, jy]);
      }
    }
    return pts;
  };
  let lo = 4;
  let hi = 80;
  for (let k = 0; k < 16; k++) {
    const mid = (lo + hi) / 2;
    if (grid(mid).length > count) lo = mid;
    else hi = mid;
  }
  const rng = mulberry32(88);
  const pts = shuffle(rng, grid(lo)).slice(0, count);
  return pts.map(([x, y]) => ({ x, y, female: rng() < 0.4 }));
};

// How many people have arrived at time t (seconds):
// 0-2 empty; 2-5 a few dozen; 5-12 faster and faster; 12-13 last gaps; 13-15 hold.
const arrivedAt = (t: number, total: number) => {
  if (t < 2) return 0;
  if (t < 5) return Math.round(2 + 38 * Math.pow(remap(t, 2, 5), 1.4));
  const n12 = Math.round(total * 0.965);
  if (t < 12) return Math.round(40 + (n12 - 40) * easeIn(remap(t, 5, 12), 2.4));
  return Math.round(n12 + (total - n12) * easeOut(remap(t, 12, 13), 2));
};

// The 3-frame drop: appears 4 px (1080p) high, then settles.
const DROP = [1, 0.45, 0.12, 0];

const makeSetup = (land: Land, dark: boolean): PixiSetup => (world: Container, info: PixiInfo) => {
  const people = samplePeople(land, COUNTS.worldMapPeople);
  const k = info.width / 3840;
  const iconPx = info.height * COUNTS.worldMapIconHeight;
  const tex = dark
    ? makeIconTextures(iconPx, COLORS.cyan, { glow: 0.12 })
    : makeIconTextures(iconPx, COLORS.red, { shade: COLORS.redSide });
  // Arrival frame for each person.
  const total = people.length;
  const arrivalFrame = new Float32Array(total);
  let idx = 0;
  for (let f = 0; f < 15 * FPS && idx < total; f++) {
    const n = arrivedAt(f / FPS, total);
    while (idx < n && idx < total) arrivalFrame[idx++] = f;
  }
  for (; idx < total; idx++) arrivalFrame[idx] = 13 * FPS;
  // Draw in y order so lower icons overlap the ones behind them.
  const order = people.map((_, i) => i).sort((a, b) => people[a].y - people[b].y);
  const sprites: Sprite[] = [];
  for (const i of order) {
    const p = people[i];
    const s = new Sprite(p.female ? tex.female : tex.male);
    s.anchor.set(0.5, 1 - tex.padY);
    s.scale.set(tex.scale);
    s.x = p.x * k;
    s.y = p.y * k;
    s.visible = false;
    world.addChild(s);
    sprites[i] = s;
  }
  const drop = (info.height / 1080) * 4;
  return (frame) => {
    for (let i = 0; i < total; i++) {
      const s = sprites[i];
      const age = frame - arrivalFrame[i];
      if (age < 0) {
        s.visible = false;
        continue;
      }
      s.visible = true;
      s.y = people[i].y * k - drop * DROP[Math.min(age, 3)];
    }
  };
};

const WorldMap: React.FC<{ dark: boolean }> = ({ dark }) => {
  const land = useStaticJson<Land>("land-110m.json");
  const setup = useMemo(() => (land ? makeSetup(land, dark) : null), [land, dark]);
  const bg = dark ? COLORS.darkBackground : COLORS.lightBackground;
  if (!setup) return null;
  return <PixiStage setup={setup} background={bg} />;
};

export const PeopleWorldMapRed: React.FC = () => <WorldMap dark={false} />;
export const PeopleWorldMapCyan: React.FC = () => <WorldMap dark />;
