import * as THREE from "three";
import { defaultPost } from "../engine/Pipeline";
import { ScreenCanvas } from "../engine/ScreenCanvas";
import { ScreenMaterial } from "../engine/materials";
import { PeriodicSeries } from "../engine/series";
import { hash, TAU, loopPhase } from "../engine/rng";
import {
  candles,
  crosshair,
  dataDashes,
  dataTable,
  dottedLine,
  font,
  glowDot,
  grid,
  lineChart,
  numberColumn,
  rgba,
  GLOW_SOFT,
  label,
  hudScatter,
  sparkles,
} from "../kit/draw";
import type { LookFactory } from "./types";

// Look 4 — Ticker Line. A tilted blue-grey screen with a bright line of tiny
// candles (white-blue, thin red down-ticks) over a fine grid; a fainter
// second line hangs above, out of focus. The camera glides sideways exactly
// one texture period (= one series length on screen) per 600 frames.

export type TickerPalette = {
  bg: string;
  screen: string;
  grid: string;
  line: string;
  down: string;
  text: string;
  glow: string; // screen tint band
  glow2: string; // cyan glow under the candles
};

const SERIES_LEN = 660; // candles per series period (= one texture period)

export const tickerLine: LookFactory<TickerPalette> = (lc, pal) => {
  // The screen texture holds exactly one series period horizontally, and
  // repeats (RepeatWrapping) along a long plane.
  const DW = 6000;
  const DH = 1700;
  const tex = new ScreenCanvas(DW, DH, lc.q * 2.0, lc.maxAniso, lc.maxTex);
  const series = new PeriodicSeries(SERIES_LEN, 4101, { momentum: 0.3, spikes: 0.12 });
  const upper = new PeriodicSeries(SERIES_LEN / 2, 4102, { momentum: 0.7, smooth: 1 });

  const scene = new THREE.Scene();
  // world: plane in XZ (y up). One texture period = PERIOD world units.
  const PERIOD = 18;
  const DEPTH = PERIOD * (DH / DW);
  const REPS = 4;
  const mat = new ScreenMaterial(tex.texture);
  mat.uniforms.uRepeat.value.set(REPS, 1);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(PERIOD * REPS, DEPTH), mat);
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);

  // Faint upper line: a vertical strip behind the screen's far edge.
  const UW = 3000;
  const UH = 500;
  const upTex = new ScreenCanvas(UW, UH, lc.q * 0.8, lc.maxAniso, lc.maxTex);
  const upMat = new ScreenMaterial(upTex.texture, true);
  upMat.uniforms.uRepeat.value.set(REPS, 1);
  upMat.uniforms.uGain.value = 0.7;
  const upPlane = new THREE.Mesh(new THREE.PlaneGeometry(PERIOD * REPS, 1.1), upMat);
  upPlane.position.set(0, 0.2, -DEPTH * 0.5 - 1.5);
  scene.add(upPlane);

  const camera = new THREE.PerspectiveCamera(36, lc.W / lc.H, 0.05, 100);
  const post = defaultPost();
  post.background.set(pal.bg);
  post.backgroundCoc = 0.9;
  post.cocMaxFrac = 0.028;
  post.bloomStrength = 0.55;
  post.bloomThreshold = 0.5;
  post.bloomRadius = 0.7;
  post.vignette = 0.8;
  post.grain = 0.015;

  const lineY = DH * 0.46; // line band centre in design units
  const lineH = DH * 0.55;

  const drawScreen = (frame: number) => {
    const ctx = tex.begin(pal.screen);
    // soft vertical gradient: brighter around the line band
    const g = ctx.createLinearGradient(0, 0, 0, DH);
    g.addColorStop(0, rgba(pal.glow, 0.05));
    g.addColorStop(0.45, rgba(pal.glow, 0.4));
    g.addColorStop(1, rgba(pal.glow, 0.04));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, DW, DH);
    // fine grid; 6000/40 = 150 cells -> integer, so it tiles
    grid(ctx, 0, 0, DW, DH, 40, 5, pal.grid, 0.1, 0.3, 0, 0, 1.2);
    // bright horizontal scan rules and HUD panel frames
    for (let i = 0; i < 5; i++) {
      const y = DH * (0.12 + 0.19 * i);
      ctx.fillStyle = rgba(pal.grid, 0.12);
      ctx.fillRect(0, y - 4, DW, 8);
      ctx.fillStyle = rgba("#9ACBFF", 0.5);
      ctx.fillRect(0, y - 1, DW, 2);
    }
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = rgba("#7AB8FF", 0.55);
      ctx.lineWidth = 2.5;
      ctx.strokeRect(i * 1000 + 80 + 200 * hash(i, 47), DH * (0.1 + 0.15 * hash(i, 48)), 500 + 300 * hash(i, 49), DH * (0.4 + 0.3 * hash(i, 50)));
      // hatched vertical clusters
      ctx.fillStyle = rgba("#7AB8FF", 0.4);
      const hx = i * 1000 + 500 * hash(i, 51);
      for (let k = 0; k < 18; k++) ctx.fillRect(hx + k * 9, DH * 0.3, 2, DH * (0.08 + 0.12 * hash(i, k, 52)));
    }
    hudScatter(ctx, 0, DH * 0.05, DW, DH * 0.9, 900, "#8ABCF0", 0.55, 4110, frame, 1.1);
    // dense horizontal streak mesh through the line band
    dataDashes(ctx, 0, DH * 0.22, DW, 26, DH * 0.022, 3, "#7AB8FF", 0.45, 4112);
    sparkles(ctx, 0, DH * 0.1, DW, DH * 0.8, 140, "#DDF0FF", 0.95, 4111, frame, 3.5);
    // dotted crosshair lines + small labels
    for (let i = 0; i < 30; i++) {
      const x = (i + 0.5) * (DW / 30);
      if (i % 2 === 0) dottedLine(ctx, x, DH * 0.08, x, DH * 0.92, 9, 1.4, pal.text, 0.3);
      // bright thin rulers
      ctx.fillStyle = rgba(pal.text, 0.35);
      ctx.fillRect(x, DH * (0.15 + 0.5 * hash(i, 44)), 2, DH * 0.25);
      crosshair(ctx, x, DH * (0.2 + 0.6 * hash(i, 41)), 14, pal.text, 0.7, 2);
      glowDot(ctx, x + 60 * hash(i, 42), DH * (0.12 + 0.76 * hash(i, 43)), 4, "#DDEEFF", 1, 4);
      glowDot(ctx, x + 90 * hash(i, 45), DH * (0.12 + 0.76 * hash(i, 46)), 3, "#DDEEFF", 0.8, 3);
    }
    for (let i = 0; i < 6; i++) {
      const y = DH * (0.18 + i * 0.13);
      dottedLine(ctx, 0, y, DW, y, 11, 1.2, pal.text, 0.18);
    }
    // number labels and tables scattered on the screen
    for (let i = 0; i < 12; i++) {
      const x = (i + 0.2) * (DW / 12);
      numberColumn(ctx, x, DH * 0.08, 4, 26, 20, pal.text, 0.55, 300 + i, frame, -1, 0.5);
      dataTable(ctx, x + 40, DH * 0.74, 5, [110, 110, 110], 28, 19, pal.text, 0.45, 400 + i, frame);
      dataDashes(ctx, x, DH * 0.9, 380, 3, 18, 5, pal.grid, 0.35, 500 + i);
    }
    for (let i = 0; i < 6; i++) {
      label(ctx, ["INDEX", "MARKET DATA", "VOLUME", "OPEN", "CLOSE", "ANALYTICS"][i], i * 1000 + 120, DH * 0.66, 24, pal.text, 0.55, 500, false, 3);
    }
    // the ticker line: one full series period across the texture width
    // cyan under-glow pass, then the white-blue core candles
    candles(ctx, {
      x: 0,
      y: lineY - lineH / 2,
      w: DW,
      h: lineH,
      series,
      start: 0,
      count: SERIES_LEN,
      up: pal.glow2,
      down: pal.glow2,
      bodyW: 0.6,
      wickW: 6,
      alpha: 0.5,
      amp: 0.9,
      minBody: 3,
      wickMul: 0.05,
    });
    candles(ctx, {
      x: 0,
      y: lineY - lineH / 2,
      w: DW,
      h: lineH,
      series,
      start: 0,
      count: SERIES_LEN,
      up: pal.line,
      down: pal.down,
      bodyW: 0.26,
      wickW: 1.6,
      alpha: 0.6,
      glow: [
        [2.5, 0.22],
        [6, 0.07],
      ],
      amp: 0.9,
      minBody: 3,
      wickMul: 0.05,
    });
    // thin connecting line through closes
    lineChart(ctx, {
      x: (DW / SERIES_LEN) * 0.5,
      y: lineY - lineH / 2,
      w: DW,
      h: lineH,
      series,
      start: 0,
      count: SERIES_LEN + 1,
      color: pal.line,
      width: 1.0,
      glow: GLOW_SOFT,
      alpha: 0.25,
      amp: 0.9,
      clip: false,
    });
    font(ctx, 20, 400, true);
    tex.commit();
  };

  const drawUpper = () => {
    const ctx = upTex.begin("#000000");
    lineChart(ctx, {
      x: 0,
      y: UH * 0.2,
      w: UW,
      h: UH * 0.6,
      series: upper,
      start: 0,
      count: SERIES_LEN / 2 + 1,
      color: pal.line,
      width: 3,
      glow: GLOW_SOFT,
      clip: false,
    });
    upTex.commit();
  };
  drawUpper();

  return {
    scene,
    camera,
    post,
    update(frame) {
      const t = loopPhase(frame);
      drawScreen(frame);
      upMat.uniforms.uOffset.value.set(0, 0);
      // glide sideways exactly one texture period per loop, with a closed bob
      const x = -PERIOD * 0.5 + PERIOD * t;
      const camH = 1.55 + 0.08 * Math.sin(TAU * t);
      const back = DEPTH * 0.5 + 1.2;
      camera.position.set(x, camH, back);
      // ~30 degrees above the screen plane
      const look = new THREE.Vector3(x + 0.6 + 0.25 * Math.sin(TAU * t + 1), 0, back - camH / Math.tan((26 * Math.PI) / 180));
      camera.lookAt(look);
      camera.rotateZ(-0.03 + 0.015 * Math.sin(TAU * t));
      camera.updateMatrixWorld();
      const focus = camera.position.distanceTo(new THREE.Vector3(x, 0, 0)) ;
      mat.setCoc({ focus, aperture: 1.35, band: 0.05 });
      upMat.setCoc({ focus, aperture: 1.9, band: 0.0, bias: 0.25 });
    },
  };
};
