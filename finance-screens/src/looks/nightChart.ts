import * as THREE from "three";
import { defaultPost } from "../engine/Pipeline";
import { ScreenCanvas } from "../engine/ScreenCanvas";
import { ScreenMaterial } from "../engine/materials";
import { PeriodicSeries } from "../engine/series";
import { hash, TAU, loopPhase, LOOP } from "../engine/rng";
import { candles, dataDashes, dataTable, glint, hudScatter, label, lineChart, mixHex, rgba, lightBand, sparkles } from "../kit/draw";
import type { LookFactory } from "./types";

// Look 7 — Night Chart. A very dark, very low view across a vast screen.
// A gold line zigzags near the horizon; below it, receding rows of dim data
// cells, ~8% lit violet on a seeded hold schedule. The camera glides forward
// exactly one cell-grid period per 600 frames.

export type NightPalette = {
  bg: string;
  screen: string;
  cell: string;
  lit: string;
  line0: string; // yellow
  line1: string; // orange
  line2: string; // lime accent layer
  text: string;
};

// one cell-grid period (texture) in design units
const DW = 3600;
const DH = 1800;
const COLS = 110;
const ROWS = 48;

// Lit-cell schedule: each cell has a hold period from a set dividing 600
const HOLDS = [30, 40, 50, 60, 75, 100, 120, 150];
const isLit = (r: number, c: number, frame: number) => {
  const hold = HOLDS[Math.floor(hash(r, c, 701) * HOLDS.length)];
  const steps = LOOP / hold;
  const offset = Math.floor(hash(r, c, 703) * hold); // stagger the switches
  const step = ((Math.floor((frame + offset) / hold) % steps) + steps) % steps;
  return hash(r * 131 + c, step, 702) < 0.018;
};

export const nightChart: LookFactory<NightPalette> = (lc, pal) => {
  const tex = new ScreenCanvas(DW, DH, lc.q * 1.3, lc.maxAniso, lc.maxTex);
  const scene = new THREE.Scene();
  // world: screen in XZ; one texture period = P x PD world units
  const P = 6;
  const PD = (P * DH) / DW; // 3
  const REPX = 3;
  const REPZ = 12;
  const mat = new ScreenMaterial(tex.texture);
  tex.texture.wrapT = THREE.RepeatWrapping;
  mat.uniforms.uRepeat.value.set(REPX, REPZ);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(P * REPX, PD * REPZ), mat);
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);

  // The gold line lives on its own strip of screen near the horizon; it
  // travels with the camera so it stays on the horizon while it scrolls.
  const LW = 6000;
  const LH = 640;
  const lineTex = new ScreenCanvas(LW, LH, lc.q * 1.1, lc.maxAniso, lc.maxTex);
  const lineMat = new ScreenMaterial(lineTex.texture, "addSharp");
  const LPW = 19;
  const lineStrip = new THREE.Mesh(new THREE.PlaneGeometry(LPW, (LPW * LH) / LW), lineMat);
  scene.add(lineStrip);
  const series = new PeriodicSeries(150, 7101, { momentum: 0.45, spikes: 0.08 });

  // A large translucent glass panel standing on the screen, lighter top edge.
  const glassTex = new ScreenCanvas(512, 256, 1, lc.maxAniso, lc.maxTex);
  {
    const g = glassTex.begin("#000000");
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "rgba(150,165,190,0.55)");
    gr.addColorStop(0.06, "rgba(90,100,120,0.32)");
    gr.addColorStop(1, "rgba(40,48,60,0.12)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = "rgba(220,230,255,0.9)";
    g.fillRect(0, 0, 512, 3);
    glassTex.commit();
  }
  const glassMat = new ScreenMaterial(glassTex.texture, "addBlur");
  glassMat.uniforms.uGain.value = 0.5;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.3), glassMat);
  scene.add(glass);

  const camera = new THREE.PerspectiveCamera(36, lc.W / lc.H, 0.02, 200);
  const post = defaultPost();
  post.background.set(pal.bg);
  post.backgroundCoc = 0.6;
  post.cocMaxFrac = 0.022;
  post.bloomStrength = 0.9;
  post.bloomThreshold = 0.3;
  post.bloomRadius = 0.7;
  post.vignette = 0.7;
  post.grain = 0.015;
  post.grainDarkFade = 0.03; // no grain in the near-black areas

  const cw = DW / COLS;
  const ch = DH / ROWS;

  const drawCells = (frame: number) => {
    const ctx = tex.begin(pal.screen);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const h = hash(r, c, 711);
        if (h < 0.25) continue; // gaps
        const lit = isLit(r, c, frame);
        const wFrac = 0.35 + 0.55 * hash(r, c, 712);
        const x = c * cw + 4;
        const y = r * ch + ch * 0.3;
        if (lit) {
          // lit blocks span 1-4 cells (never past the tile edge, so it wraps cleanly)
          const span = Math.min(3 + Math.floor(hash(r, c, 714) * 4), COLS - c); // ~1.8% of cells start a 3-6 cell block: ~8% of the grid lit
          ctx.fillStyle = rgba(pal.lit, 0.85);
          ctx.fillRect(x, y, cw * span - 6, ch * 1.1);
          ctx.fillStyle = rgba("#B8B0FF", 0.6);
          ctx.fillRect(x, y, cw * span - 6, 3);
        } else {
          if ((r % 8) > 5 || (c % 22) > 18) continue; // panel gutters
          ctx.fillStyle = rgba(pal.cell, 0.35 + 0.55 * hash(r, c, 713));
          ctx.fillRect(x, y, (cw - 8) * wFrac, ch * 0.42);
        }
      }
    }
    // a few rows of tiny text-like dashes and teal/orange marks
    for (let r = 0; r < 6; r++) {
      dataDashes(ctx, 0, r * (DH / 6) + 8, DW, 1, 10, 5, mixHex(pal.cell, "#6AA8D8", 0.4), 0.5, 720 + r);
    }
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = rgba(i % 3 ? "#3AB0A0" : "#FF9A3A", 0.5);
      ctx.fillRect(hash(i, 731) * DW, hash(i, 732) * DH, 30, 8);
    }
    // fine neutral HUD detail and thin construction lines
    hudScatter(ctx, 0, 0, DW, DH, 700, "#9AA8B8", 0.5, 750, frame, 0.9, "#3AC8A0");
    ctx.strokeStyle = rgba("#C8D0E0", 0.55);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(DW * hash(i, 761), 0);
      ctx.lineTo(DW * hash(i, 762), DH);
      ctx.stroke();
    }
    sparkles(ctx, 0, 0, DW, DH, 30, "#E8F0FF", 0.9, 763, frame, 2.5);
    for (let k = 0; k < 8; k++) {
      dataTable(ctx, DW * hash(k, 771) * 0.85, DH * hash(k, 772) * 0.9 + 30, 5, [90, 90, 90], 26, 20, "#B8C4D4", 0.6, 773 + k, frame);
      label(ctx, ["ANALYTICS", "MARKET DATA", "VOLUME", "INDEX"][k % 4], DW * hash(k, 774) * 0.9, DH * hash(k, 775), 22, "#C8D0E0", 0.7, 500, false, 3);
    }
    for (let k = 0; k < 10; k++) {
      ctx.fillStyle = rgba(["#FF7AC8", "#4AE08A", "#FF5A4A", "#FF9A3A"][k % 4], 0.7);
      ctx.fillRect(DW * hash(k, 776), DH * hash(k, 777), 50 + 60 * hash(k, 778), 14);
    }
    label(ctx, "MARKET DATA", DW * 0.2, DH * 0.5, 30, pal.text, 0.35, 500, false, 4);
    label(ctx, "ANALYTICS", DW * 0.7, DH * 0.2, 26, pal.text, 0.3, 500, false, 4);
    tex.commit();
  };

  const drawLine = (frame: number) => {
    const t = loopPhase(frame);
    const ctx = lineTex.begin("#000000");
    // faint data strip under the line
    dataDashes(ctx, 0, LH * 0.82, LW, 3, 14, 6, pal.text, 0.25, 740);
    const o = {
      x: 0,
      y: LH * 0.04,
      w: LW,
      h: LH * 0.78,
      series,
      start: series.length * t,
      count: 255,
    };
    candles(ctx, {
      ...o,
      start: o.start + 37,
      y: o.y + LH * 0.08,
      up: pal.line2,
      down: pal.line2,
      bodyW: 0.3,
      wickW: 1.6,
      alpha: 0.22,
      minBody: 3,
      wickMul: 0.06,
    });
    candles(ctx, {
      ...o,
      up: pal.line0,
      down: pal.line1,
      bodyW: 0.5,
      wickW: 2.2,
      glow: [[2.5, 0.14]],
      minBody: 10,
      wickMul: 0.2,
    });
    lineChart(ctx, {
      ...o,
      x: o.x + LW / 255 / 2,
      color: mixHex(pal.line0, pal.line1, 0.3),
      width: 1.6,
      glow: [
        [3, 0.22],
        [7, 0.07],
      ],
      alpha: 0.0,
      clip: false,
    });
    // fade both ends
    ctx.globalCompositeOperation = "destination-out";
    for (const [x0, x1] of [
      [0, LW * 0.2],
      [LW, LW * 0.8],
    ]) {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), LH);
    }
    ctx.globalCompositeOperation = "source-over";
    // thin diagonal glints
    for (let k = 0; k < 2; k++) {
      const u = (((t + k * 0.5) % 1) + 1) % 1;
      glint(ctx, LW * (0.1 + 0.8 * u), LH * 0.5, LH * 1.4, -1.0 - k * 0.3, 2.5, "#FFF2C0", 0.55 * Math.sin(Math.PI * u));
    }
    lightBand(ctx, LW * 0.55, LH * 0.6, LH * 2, -0.8, 160, "#B8C8FF", 0.06);
    lineTex.commit();
  };

  return {
    scene,
    camera,
    post,
    update(frame) {
      const t = loopPhase(frame);
      drawCells(frame);
      drawLine(frame);
      // forward glide of exactly one cell-grid period per loop. The screen is
      // vast (it repeats), so gliding over it is the same as scrolling its
      // texture toward the camera by one period: the plane and camera stay
      // put and the plane's far edge never shifts, so frame 600 == frame 0.
      mat.uniforms.uOffset.value.set(0, -t * 1);
      const z = PD * 2;
      const camH = 0.8;
      const x = 0;
      camera.position.set(x - 0.3, camH, z);
      // ~10 deg above the screen plane
      const pitch = (-13.5 * Math.PI) / 180;
      camera.rotation.set(pitch, -0.42 + 0.012 * Math.sin(TAU * t), -0.2, "YXZ");
      camera.updateMatrixWorld();
      // gold line strip: flat on the screen ~7 units ahead, rides with camera
      // stands at 1.15 rad from flat with its lower edge on the screen, so no
      // part of it dips under the (opaque) screen plane
      const tilt = 0.9;
      const halfH = (LPW * LH) / LW / 2;
      const yaw = -0.42;
      const back = halfH * Math.cos(tilt);
      lineStrip.position.set(x + 2.6 + Math.sin(yaw) * back, halfH * Math.sin(tilt), z - 10.5 - Math.cos(yaw) * back);
      lineStrip.rotation.set(-Math.PI / 2 + tilt, yaw, 0.0, "YXZ");
      glass.position.set(2.4, 0.35, z - 5.0);
      glass.rotation.set(-1.0, -0.42, 0, "YXZ");
      glassMat.setCoc({ focus: 5.0, aperture: 0.6, band: 0.06 });
      const focus = 5.0; // near the line; near cells blur strongly
      mat.setCoc({ focus, aperture: 0.45, band: 0.06 });
      lineMat.setCoc({ focus, aperture: 0.45, band: 0.06 });
    },
  };
};
