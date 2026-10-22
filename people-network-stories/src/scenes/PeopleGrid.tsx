import { CanvasSource, Container, Sprite, Texture } from "pixi.js";
import React from "react";
import { COLORS, COUNTS, FPS } from "../lib/colors";
import { clamp01, easeIn, keyframes, remap, smooth } from "../lib/ease";
import { PixiInfo, PixiSetup, PixiStage } from "../lib/pixi/PixiStage";
import { makeIconTextures } from "../lib/pixi/icons";
import { gauss, mulberry32, shuffle } from "../lib/random";

const COLS = COUNTS.peopleGridColumns;
const ROWS = COUNTS.peopleGridRows;
const N = COLS * ROWS;
const DURATION = 25;

// Grid in 3840x2160 units, filling about 85% of the frame.
const GX0 = 3840 * 0.075;
const GX1 = 3840 * 0.925;
const GY0 = 2160 * 0.075;
const GY1 = 2160 * 0.925;
const DX = (GX1 - GX0) / (COLS - 1);
const DY = (GY1 - GY0) / (ROWS - 1);

// ----- Who lights up when -------------------------------------------------------
// 0-5s a few, slowly; 5-14s more; 14-19s faster; the rest appear under the flash
// (19-19.6s) so that from 20s every grid point is a person.
const litCount = (t: number) => {
  if (t < 0.6) return 0;
  if (t < 5) return Math.round(1 + 5 * remap(t, 0.6, 5));
  if (t < 14) return Math.round(6 + 0.2 * N * easeIn(remap(t, 5, 14), 1.8));
  if (t < 19) return Math.round(6 + 0.2 * N + (0.88 * N - 6 - 0.2 * N) * easeIn(remap(t, 14, 19), 1.4));
  return Math.round(0.88 * N + 0.12 * N * remap(t, 19, 19.6));
};

const rngOrder = mulberry32(2606141);
const ORDER = shuffle(rngOrder, Array.from({ length: N }, (_, i) => i));
const LIT_FRAME = new Float32Array(N).fill(1e9);
{
  let k = 0;
  for (let f = 0; f <= DURATION * FPS && k < N; f++) {
    const n = Math.min(N, litCount(f / FPS));
    while (k < n) LIT_FRAME[ORDER[k++]] = f;
  }
}

// ----- Light streaks ---------------------------------------------------------------
// Spawn rate (per second): a trickle from 5s, rising to a dense criss-cross at 19s.
const streakRate = (t: number) => {
  if (t < 4.5 || t > 19.2) return 0;
  if (t < 14) return 0.6 + 90 * easeIn(remap(t, 4.5, 14), 1.9);
  return 90.6 * Math.exp(2.0 * remap(t, 14, 19));
};

type Streak = { t0: number; life: number; x: number; y: number; ang: number; speed: number; len: number; bright: number };
const STREAKS: Streak[] = (() => {
  const rng = mulberry32(61410);
  const out: Streak[] = [];
  let acc = rng();
  const dt = 1 / (FPS * 4);
  for (let t = 0; t < DURATION; t += dt) {
    acc += streakRate(t) * dt;
    while (acc >= 1) {
      acc -= 1;
      // Late streaks gather towards the centre, where the flash blooms.
      const focus = 0.7 * clamp01(remap(t, 16.5, 19.2));
      const ux = rng();
      const uy = rng();
      const cx = Math.min(GX1, Math.max(GX0, (1 - focus) * (GX0 + ux * (GX1 - GX0)) + focus * (1920 + gauss(rng) * 900)));
      const cy = Math.min(GY1, Math.max(GY0, (1 - focus) * (GY0 + uy * (GY1 - GY0)) + focus * (1080 + gauss(rng) * 520)));
      out.push({
        t0: t,
        life: 0.7 + rng() * 0.9 - focus * 0.25,
        x: cx,
        y: cy,
        // Mostly shallow angles, as in the reference.
        ang: (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * (rng() < 0.7 ? 1.0 : 3.0),
        speed: 120 + rng() * 280 + focus * 200,
        len: 380 + rng() * 420,
        bright: 0.16 + rng() * 0.2,
      });
    }
  }
  return out;
})();

// Soft white line with tapered ends, used for every streak.
const streakTexture = () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(256, 32);
  for (let y = 0; y < 32; y++) {
    const dy = (y + 0.5 - 16) / 16;
    const core = Math.exp(-dy * dy * 14);
    const halo = Math.exp(-dy * dy * 2.5) * 0.6;
    for (let x = 0; x < 256; x++) {
      const u = (x + 0.5) / 256;
      const taper = Math.min(1, u / 0.35) * Math.min(1, (1 - u) / 0.12);
      const a = Math.min(1, (core + halo) * taper);
      const o = (y * 256 + x) * 4;
      img.data[o] = 255;
      img.data[o + 1] = 255;
      img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return new Texture({ source: new CanvasSource({ resource: c, autoGenerateMipmaps: true }) });
};

// Radial glow for the central bloom.
const bloomTexture = () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(235,252,255,1)");
  g.addColorStop(0.35, "rgba(200,245,255,0.55)");
  g.addColorStop(0.7, "rgba(160,235,255,0.12)");
  g.addColorStop(1, "rgba(160,235,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new Texture({ source: new CanvasSource({ resource: c }) });
};

const dotTexture = () => {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(16, 16, 12, 0, Math.PI * 2);
  ctx.fill();
  return new Texture({ source: new CanvasSource({ resource: c, autoGenerateMipmaps: true }) });
};

const MAX_STREAKS = 2400;

const setup: PixiSetup = (world: Container, info: PixiInfo) => {
  const k = info.width / 3840;
  const iconPx = DY * 0.78 * k;
  const icons = makeIconTextures(iconPx, COLORS.cyan, { glow: 0.1 });
  const dotTex = dotTexture();
  const sTex = streakTexture();
  const bTex = bloomTexture();
  const dotLayer = new Container();
  const peopleLayer = new Container();
  const streakLayer = new Container();
  world.addChild(dotLayer, peopleLayer, streakLayer);
  const people: Sprite[] = [];
  const rngF = mulberry32(7);
  for (let i = 0; i < N; i++) {
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    const x = (GX0 + c * DX) * k;
    const y = (GY0 + r * DY) * k;
    const d = new Sprite(dotTex);
    d.anchor.set(0.5);
    d.width = d.height = 4.2 * k * 1.0;
    d.tint = COLORS.cyan;
    d.alpha = 0.15 * 3;
    d.x = x;
    d.y = y + iconPx * 0.08;
    dotLayer.addChild(d);
    const p = new Sprite(rngF() < 0.4 ? icons.female : icons.male);
    p.anchor.set(0.5, 1 - icons.padY);
    p.scale.set(icons.scale);
    p.x = x;
    p.y = y + iconPx * 0.5;
    p.visible = false;
    peopleLayer.addChild(p);
    people.push(p);
  }
  const streaks: Sprite[] = [];
  for (let i = 0; i < MAX_STREAKS; i++) {
    const s = new Sprite(sTex);
    s.anchor.set(0.5);
    s.blendMode = "add";
    s.visible = false;
    streakLayer.addChild(s);
    streaks.push(s);
  }
  const bloom = new Sprite(bTex);
  bloom.anchor.set(0.5);
  bloom.blendMode = "add";
  bloom.x = 1920 * k;
  bloom.y = 1080 * k;
  streakLayer.addChild(bloom);

  return (frame) => {
    const t = frame / FPS;
    for (let i = 0; i < N; i++) {
      const age = frame - LIT_FRAME[i];
      const p = people[i];
      p.visible = age >= 0;
      if (age >= 0) p.alpha = Math.min(1, (age + 1) / 3);
    }
    // Streaks: everything fades out quickly as the flash clears (19-20s).
    const clear = 1 - smooth(remap(t, 19.15, 19.9));
    let n = 0;
    for (const st of STREAKS) {
      if (n >= MAX_STREAKS) break;
      const a = t - st.t0;
      if (a < 0 || a > st.life) continue;
      const u = a / st.life;
      const env = Math.sin(Math.PI * u);
      const s = streaks[n++];
      s.visible = true;
      const dist = st.speed * a;
      s.x = (st.x + Math.cos(st.ang) * dist) * k;
      s.y = (st.y + Math.sin(st.ang) * dist) * k;
      s.rotation = st.ang;
      s.width = st.len * k;
      s.height = 72 * k;
      // Streaks stay inside the grid: they fade out as they cross its edge.
      const inside = Math.min(1, Math.max(0, Math.min(s.x / k - GX0, GX1 - s.x / k, s.y / k - GY0, GY1 - s.y / k) / 90));
      s.alpha = st.bright * env * clear * inside;
    }
    for (let i = n; i < MAX_STREAKS; i++) streaks[i].visible = false;
    // Central bloom to near-white at 19s, gone by 20s.
    const b = keyframes(t, [
      [17.2, 0],
      [19.0, 1],
      [19.25, 1],
      [19.95, 0],
    ]);
    bloom.visible = b > 0;
    bloom.alpha = b * 0.6;
    bloom.width = (3000 + 1200 * b) * k;
    bloom.height = (1700 + 600 * b) * k;
  };
};

export const PeopleGridCyan: React.FC = () => <PixiStage setup={setup} background={COLORS.darkBackground} />;
