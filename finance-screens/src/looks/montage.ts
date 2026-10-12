import * as THREE from "three";
import { defaultPost } from "../engine/Pipeline";
import { ScreenCanvas } from "../engine/ScreenCanvas";
import { ScreenMaterial, type BlendMode } from "../engine/materials";
import { PeriodicSeries } from "../engine/series";
import { hash, TAU, loopPhase, ticker } from "../engine/rng";
import {
  candles,
  codeBlock,
  flare,
  font,
  fmtNum,
  glowDot,
  grid,
  lineChart,
  lineYAt,
  numberColumn,
  rgba,
  worldMap,
  label,
  type Ctx,
  type LineChartOpts,
} from "../kit/draw";
import type { LookFactory } from "./types";

// Look 1 — Finance Montage. 2D: flat layers under an orthographic camera,
// each sliding sideways by a whole number of its own repeat width per 600
// frames (parallax), plus a slow closed zoom/rotate of the whole stack.

export type MontagePalette = {
  bg: string;
  glow: string;
  map: string;
  grid: string;
  numbers: string;
  code: string;
  lineA: string; // cyan
  lineB: string; // pink
  flare: string;
  readout: string;
};

// Design space = the 4K frame (3840 x 2160) plus overscan for zoom/rotate.
const FW = 3840;
const FH = 2160;
const OVER = 1.12;
const DW = Math.round(FW * OVER);
const DH = Math.round(FH * OVER);
const OX = (DW - FW) / 2; // frame origin inside the layer canvas
const OY = (DH - FH) / 2;

// Draw a tile-able layer: `tile(ctx, x0)` draws one repeat starting at x0.
const tiled = (ctx: Ctx, repeatW: number, offset: number, tile: (x0: number) => void) => {
  const o = ((offset % repeatW) + repeatW) % repeatW;
  for (let x0 = -o; x0 < DW; x0 += repeatW) tile(x0);
};

export const montage: LookFactory<MontagePalette> = (lc, pal) => {
  const q = lc.q * (4096 / DW) * 1.05; // ~4.5k px wide layer textures at 4K
  const far = new ScreenCanvas(DW, DH, q, lc.maxAniso, lc.maxTex);
  const mid = new ScreenCanvas(DW, DH, q, lc.maxAniso, lc.maxTex);
  const near = new ScreenCanvas(DW, DH, q * 0.6, lc.maxAniso, lc.maxTex);

  const scene = new THREE.Scene();
  const S = 1 / 1000; // world units per design unit
  const mk = (c: ScreenCanvas, mode: BlendMode, coc: number, z: number, order: number) => {
    const m = new ScreenMaterial(c.texture, mode);
    m.uniforms.uOrthoCoc.value = coc;
    m.depthTest = false;
    m.depthWrite = false;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(DW * S, DH * S), m);
    mesh.position.z = z;
    mesh.renderOrder = order;
    scene.add(mesh);
    return m;
  };
  mk(far, "opaque", 0.12, -3, 0);
  mk(mid, "addSharp", 0.001, -2, 1);
  mk(near, "addBlur", 0.85, -1, 2);

  const camera = new THREE.OrthographicCamera(
    (-FW / 2) * S,
    (FW / 2) * S,
    (FH / 2) * S,
    (-FH / 2) * S,
    0.1,
    10,
  );
  camera.position.set(0, 0, 0);

  const post = defaultPost();
  post.background.set(pal.bg);
  post.backgroundCoc = 0.3;
  post.cocMaxFrac = 0.022;
  post.bloomStrength = 0.7;
  post.bloomThreshold = 0.45;
  post.bloomRadius = 0.75;
  post.vignette = 0.8;
  post.grain = 0.015;

  // Series: lines are ~3x the frame width per repeat
  const LINE_REPEAT = FW * 3;
  const sCyan = new PeriodicSeries(26, 1101, { momentum: 0.15, spikes: 0.35 });
  const sCyan2 = new PeriodicSeries(26, 1105, { momentum: 0.4, smooth: 1 });
  const sPink2 = new PeriodicSeries(34, 1106, { momentum: 0.2, spikes: 0.2 });
  const sPink3 = new PeriodicSeries(28, 1107, { momentum: 0.3, spikes: 0.15 });
  const sPink = new PeriodicSeries(18, 1102, { momentum: 0.5, smooth: 1 });
  const sCandle = new PeriodicSeries(120, 1104, { momentum: 0.5 });

  // Layer repeat widths and how many repeats each slides per loop
  const MAP_REPEAT = 5200;
  const GRID_REPEAT = 1600;
  const NUM_REPEAT = 4800;
  const CODE_REPEAT = 4200;
  const NEAR_REPEAT = 6400;

  const drawFar = (frame: number) => {
    const t = loopPhase(frame);
    const ctx = far.begin(pal.bg);
    // blue glow clouds drifting on closed paths
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 6; i++) {
      const cx = DW * (0.4 + 0.5 * hash(i, 1)) + 260 * Math.sin(TAU * (t + hash(i, 2)));
      const cy = DH * (0.0 + 0.3 * hash(i, 3)) + 140 * Math.cos(TAU * (t + hash(i, 4)));
      const r = 900 + 900 * hash(i, 5);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rgba(pal.glow, 0.11));
      g.addColorStop(0.5, rgba(pal.glow, 0.03));
      g.addColorStop(1, rgba(pal.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    // vertical light columns
    for (let i = 0; i < 7; i++) {
      const x = DW * hash(i, 31) + 400 * Math.sin(TAU * (t + hash(i, 32)));
      const w = 30 + 120 * hash(i, 33);
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, rgba(pal.glow, 0));
      g.addColorStop(0.5, rgba(pal.glow, 0.1));
      g.addColorStop(1, rgba(pal.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w, 0, w * 2, DH);
    }
    ctx.globalCompositeOperation = "source-over";
    // dotted world map: 1 repeat per loop
    tiled(ctx, MAP_REPEAT, MAP_REPEAT * t, (x0) => {
      worldMap(ctx, lc.assets.world, x0 + 200, OY - 160, MAP_REPEAT * 0.62, pal.map, 0.85, frame, {
        dot: 0.62,
        twinkle: 0.08,
        highlight: "#9AB0FF",
      });
    });
    // blurred candle chart in the deep background (moves with the map)
    tiled(ctx, MAP_REPEAT, MAP_REPEAT * t, (x0) => {
      candles(ctx, {
        x: x0,
        y: OY + 60,
        w: MAP_REPEAT,
        h: FH * 0.45,
        series: sCandle,
        start: 0,
        count: 120,
        up: pal.map,
        down: pal.map,
        bodyW: 0.5,
        wickW: 4,
        alpha: 0.85,
      });
    });
    far.commit();
  };

  const cyanOpts = (t: number): LineChartOpts => ({
    x: 0,
    y: OY - FH * 0.02,
    w: LINE_REPEAT,
    h: FH * 1.0,
    series: sCyan,
    start: -sCyan.length * t, // one series length (= one repeat) per loop
    count: sCyan.length + 1,
    color: pal.lineA,
    width: 15,
    glow: [
      [2.5, 0.42],
      [6, 0.18],
      [12, 0.08],
    ],
    coreColor: "#E8FFFF",
    smooth: false,
    clip: false,
  });

  const drawMid = (frame: number) => {
    const t = loopPhase(frame);
    const ctx = mid.begin("#000000");
    // fine grid: 2 repeats per loop
    tiled(ctx, GRID_REPEAT, GRID_REPEAT * 2 * t, (x0) => {
      grid(ctx, x0, 0, GRID_REPEAT, DH, 80, 4, pal.grid, 0.12, 0.3, 0, 0, 2);
    });
    // big number columns (ticking): 1 repeat per loop
    tiled(ctx, NUM_REPEAT, NUM_REPEAT * t, (x0) => {
      for (let c = 0; c < 4; c++) {
        numberColumn(ctx, x0 + 300 + c * 1200, OY + 260, 4, 200, 52, pal.numbers, 0.34, 70 + c, frame, c % 2, 0.5);
      }
      for (let c = 0; c < 6; c++) {
        numberColumn(ctx, x0 + 120 + c * 800, OY + 120 + 280 * hash(c, 9), 14, 52, 30, pal.numbers, 0.4, 90 + c, frame, -1, 0.3);
      }
    });
    // faint code text: 1 repeat per loop, opposite direction
    tiled(ctx, CODE_REPEAT, -CODE_REPEAT * t, (x0) => {
      for (let b = 0; b < 3; b++) {
        codeBlock(ctx, x0 + b * 1400 + 80, OY + 120 + b * 560, 14, 52, 38, pal.code, 0.42, 200 + b);
      }
    });
    // two big line charts, ~3x frame width per repeat, scrolling
    const cy = cyanOpts(t);
    lineChart(ctx, cy);
    const pk: LineChartOpts = {
      x: 0,
      y: OY + FH * 0.3,
      w: LINE_REPEAT,
      h: FH * 0.65,
      series: sPink,
      start: -sPink.length * t,
      count: sPink.length + 1,
      color: pal.lineB,
      width: 5,
      alpha: 0.55,
      glow: [
        [2.4, 0.32],
        [6, 0.12],
      ],
      smooth: false,
      clip: false,
    };
    lineChart(ctx, pk);
    // more criss-crossing lines: a second cyan and two thin, jagged pinks
    lineChart(ctx, { ...cy, series: sCyan2, start: -sCyan2.length * t, count: sCyan2.length + 1, y: OY - FH * 0.15, h: FH * 0.4, width: 8, smooth: false });
    for (const [ser, yy, hh] of [
      [sPink2, -0.05, 1.05],
      [sPink3, 0.45, 0.6],
    ] as const) {
      lineChart(ctx, { ...pk, series: ser, start: -ser.length * t, count: ser.length + 1, y: OY + FH * yy, h: FH * hh, width: 4, smooth: false, glow: [[2.5, 0.2]] });
    }
    // bright rectangular panel outlines in the lower middle
    ctx.strokeStyle = rgba(pal.grid, 0.55);
    ctx.lineWidth = 3;
    tiled(ctx, GRID_REPEAT * 2, GRID_REPEAT * 2 * t, (x0) => {
      ctx.strokeRect(x0 + 300, OY + FH * 0.66, 900, 420);
      ctx.strokeRect(x0 + 1700, OY + FH * 0.72, 600, 300);
    });
    // circle marker riding the cyan line at a fixed screen x
    const mx = OX + FW * 0.02;
    const my = lineYAt(cy, mx);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba("#DDF6FF", 0.45);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(mx, my, 380, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba("#DDF6FF", 0.6);
    ctx.beginPath();
    ctx.arc(mx, my, 160, 0, TAU);
    ctx.stroke();
    glowDot(ctx, mx, my, 16, pal.lineA, 1, 5);
    // triangles on the ring (up/down markers)
    for (let k = 0; k < 3; k++) {
      const ty = my - 330 + k * 330;
      ctx.fillStyle = rgba(pal.lineB, 0.8);
      ctx.beginPath();
      ctx.moveTo(mx - 430 - 26, ty - 18);
      ctx.lineTo(mx - 430 + 26, ty - 18);
      ctx.lineTo(mx - 430, ty + 22);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    font(ctx, 40, 500, true);
    ctx.fillStyle = rgba(pal.readout, 0.85);
    ctx.fillText(`IDX  ${fmtNum(ticker(frame, 15, 7), 1)}`, mx + 360, my + 120);
    mid.commit();
  };

  const drawNear = (frame: number) => {
    const t = loopPhase(frame);
    const ctx = near.begin("#000000");
    // big blurred chart line passing close: 2 repeats per loop
    tiled(ctx, NEAR_REPEAT, NEAR_REPEAT * 2 * t, (x0) => {
      // readouts passing close
      const codes = ["IDX", "SER-A", "FX 07", "AN-22"];
      for (let k = 0; k < 4; k++) {
        const x = x0 + 300 + k * 1600;
        const y = OY + FH * (0.25 + 0.6 * hash(k, 51));
        label(
          ctx,
          `${codes[k]} ${k % 2 ? "▲" : ""}${fmtNum(ticker(frame, 20, 60 + k), k % 2 ? 1 : 0)}`,
          x,
          y,
          k === 1 ? 150 : 90,
          pal.readout,
          0.3,
          500,
          true,
          k === 1 ? 30 : 12,
        );
      }
      // pink smear bars
      for (let k = 0; k < 1; k++) {
        const y = OY + FH * (0.08 + 0.75 * k);
        const g = ctx.createLinearGradient(x0 + k * 3000, 0, x0 + k * 3000 + 1700, 0);
        g.addColorStop(0, rgba(pal.lineB, 0));
        g.addColorStop(0.3, rgba(pal.lineB, 0.55));
        g.addColorStop(1, rgba(pal.lineB, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x0 + k * 3000, y, 1700, 70);
      }
    });
    // soft blue bloom low left
    {
      const bx = OX + FW * 0.18 + 120 * Math.sin(TAU * t);
      const by = OY + FH * 0.9;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, 420);
      g.addColorStop(0, rgba("#4A7AFF", 0.3));
      g.addColorStop(1, rgba("#4A7AFF", 0));
      ctx.fillStyle = g;
      ctx.fillRect(bx - 420, by - 420, 840, 840);
    }
    // lens-flare streaks drifting across: each a whole number of cycles
    for (let i = 0; i < 5; i++) {
      const cyc = 1 + (i % 2);
      const u = (((cyc * t + hash(i, 61)) % 1) + 1) % 1;
      const x = -600 + (DW + 1200) * u;
      const y = OY + FH * (0.25 + 0.6 * hash(i, 62));
      const a = 0.3 * Math.sin(Math.PI * u);
      flare(ctx, x, y, 160 + 140 * hash(i, 63), pal.flare, a * 0.7, 3);
    }
    near.commit();
  };

  return {
    scene,
    camera,
    post,
    update(frame) {
      const t = loopPhase(frame);
      drawFar(frame);
      drawMid(frame);
      drawNear(frame);
      // closed zoom (+-3%) and rotation (+-2 degrees)
      camera.zoom = 1 + 0.03 * Math.sin(TAU * t);
      camera.rotation.z = ((2 * Math.PI) / 180) * Math.sin(TAU * t + 1.1);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    },
  };
};
