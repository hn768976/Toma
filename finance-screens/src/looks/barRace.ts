import * as THREE from "three";
import { defaultPost } from "../engine/Pipeline";
import { ScreenCanvas } from "../engine/ScreenCanvas";
import { ScreenMaterial } from "../engine/materials";
import { hash, TAU, loopPhase, clamp, easeInOutCubic, easeOutCubic } from "../engine/rng";
import {
  arcGauge,
  boxX,
  crosshair,
  dataDashes,
  dataTable,
  font,
  glint,
  glowDot,
  grid,
  hBar,
  label,
  lightBand,
  mixHex,
  numberColumn,
  rgba,
  hudScatter,
  sparkles,
} from "../kit/draw";
import type { LookFactory } from "./types";

// Look 3 — Bar Race. A dark screen at a steep tilt, close to the lens. 11
// horizontal bars grow from the left in a staggered wave, hold, retract and
// pause: two 300-frame cycles per loop.

export type BarPalette = {
  bg: string;
  screen: string;
  bar: string;
  barTop: string; // the pale top bar
  text: string;
  grid: string;
  donuts: [string, string, string];
};

const DW = 4096;
const DH = 3300;
const NB = 11;

// Bar length (0..1 of target) at frame within a 300-frame cycle
export const barProgress = (frameInCycle: number, i: number) => {
  const f = frameInCycle;
  const start = i * 4; // stagger 4 frames per bar
  const grow = clamp((f - start) / 60); // ~2s each, wave ends ~3.3s
  if (f < 210) return easeInOutCubic(grow);
  // retract 210..255 (1.5 s), staggered slightly
  const r = clamp((f - 210 - i * 1.5) / 30);
  return 1 - easeInOutCubic(r);
};
const barAlpha = (frameInCycle: number) => {
  if (frameInCycle < 210) return 1;
  return 1 - easeOutCubic(clamp((frameInCycle - 215) / 40));
};

export const barRace: LookFactory<BarPalette> = (lc, pal) => {
  const tex = new ScreenCanvas(DW, DH, lc.q * 1.35, lc.maxAniso, lc.maxTex);
  const scene = new THREE.Scene();
  const PW = 10;
  const PH = (PW * DH) / DW;
  const mat = new ScreenMaterial(tex.texture);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
  scene.add(plane);

  const camera = new THREE.PerspectiveCamera(19, lc.W / lc.H, 0.02, 100);
  const post = defaultPost();
  post.background.set(pal.bg);
  post.backgroundCoc = 1;
  post.cocMaxFrac = 0.036;
  post.bloomStrength = 0.8;
  post.bloomThreshold = 0.42;
  post.bloomRadius = 0.65;
  post.vignette = 0.35;
  post.grain = 0.015;

  const targets = Array.from({ length: NB }, (_, i) =>
    i === 0 ? 0.42 : 0.35 + 0.6 * hash(i, 301),
  );

  const BX = DW * 0.12; // bars' left edge
  const BY = DH * 0.36; // first bar top
  const BT = 92; // bar thickness
  const BG = 58; // gap
  const BMAX = DW * 0.56;

  const draw = (frame: number) => {
    const t = loopPhase(frame);
    const fc = frame % 300;
    const ctx = tex.begin(pal.screen);
    grid(ctx, 0, 0, DW, DH, 64, 4, pal.grid, 0.1, 0.22, 0, 0, 1.4);
    // long diagonal guide lines
    ctx.strokeStyle = rgba(pal.text, 0.25);
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(DW * (0.1 + i * 0.15), 0);
      ctx.lineTo(DW * (0.25 + i * 0.15), DH);
      ctx.stroke();
    }
    // background data: text tables, dashes, numbers
    for (let i = 0; i < 9; i++) {
      const x = (i % 3) * DW * 0.33 + 40;
      const y = Math.floor(i / 3) * DH * 0.33 + 60;
      dataDashes(ctx, x, y, DW * 0.26, 6, 22, 7, pal.text, 0.32, 330 + i);
    }
    dataTable(ctx, DW * 0.74, DH * 0.4, 10, [130, 130, 130, 120], 34, 24, pal.text, 0.75, 340, frame, "#FF9A3A");
    numberColumn(ctx, DW * 0.92, DH * 0.4, 10, 34, 24, pal.text, 0.75, 341, frame);
    for (let k = 0; k < 4; k++) {
      dataTable(ctx, DW * (0.05 + k * 0.24), DH * 0.06, 6, [130, 130, 130, 130], 34, 26, pal.text, 0.5, 342 + k * 7, frame);
      dataDashes(ctx, DW * (0.05 + k * 0.24), DH * 0.18, DW * 0.2, 8, 26, 8, pal.text, 0.3, 360 + k);
    }
    label(ctx, "ACTIVE SEARCH", DW * 0.74, DH * 0.37, 34, pal.text, 0.9, 600, false, 6);
    label(ctx, "ACTIVE SEARCH", DW * 0.55, DH * 0.28, 30, pal.text, 0.4, 600, false, 6);
    label(ctx, "MARKET DATA", DW * 0.05, DH * 0.03, 30, pal.text, 0.5, 600, false, 6);
    label(ctx, "MARKET DATA", DW * 0.45, DH * 0.25, 24, pal.text, 0.6, 500, false, 3);
    numberColumn(ctx, DW * 0.45, DH * 0.29, 6, 30, 20, pal.text, 0.6, 343, frame);
    // dotted matrix block
    for (let r = 0; r < 14; r++)
      for (let c = 0; c < 8; c++) {
        const lit = hash(r, c, 351) < 0.3;
        ctx.fillStyle = rgba(lit ? "#FFC06A" : pal.text, lit ? 0.7 : 0.35);
        ctx.fillRect(DW * 0.74 + c * 22, DH * 0.6 + r * 22, 10, 10);
      }
    // crosshair marks
    for (let i = 0; i < 6; i++) {
      crosshair(ctx, DW * (0.1 + 0.15 * i), DH * (0.2 + 0.6 * hash(i, 361)), 18, pal.text, 0.7, 2);
    }
    boxX(ctx, DW * 0.7, DH * 0.17, 44, pal.text, 0.8, 2.5);
    boxX(ctx, DW * 0.7, DH * 0.55, 34, pal.text, 0.6, 2);
    // small arc gauges in the corner
    for (let i = 0; i < 3; i++) {
      arcGauge(ctx, DW * (0.45 + i * 0.05), DH * 0.43, 34, 10, 0.3 + 0.5 * hash(i, 371), "#FF9A3A", 0.8);
    }
    // three small donut charts near the front (orange, yellow, teal arcs)
    for (let i = 0; i < 4; i++) {
      const cx = DW * (0.04 + i * 0.1);
      const cy = DH * (0.86 + 0.04 * (i % 2));
      const spin = TAU * t * (i % 2 ? 1 : -1);
      ctx.lineWidth = 40;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = rgba(pal.donuts[k], 0.85);
        ctx.beginPath();
        const a0 = spin + k * 2.1 + i;
        ctx.arc(cx, cy, 150, a0, a0 + 0.8 + 0.9 * hash(i, k, 381));
        ctx.stroke();
      }
      font(ctx, 26, 500, true);
      ctx.fillStyle = rgba(pal.text, 0.8);
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(20 + 70 * hash(i, 391))}%`, cx, cy + 9);
      ctx.textAlign = "left";
    }
    // dense HUD clutter everywhere around the bars
    hudScatter(ctx, 0, 0, DW, DH, 2200, pal.text, 1, 390, frame, 1.6, "#FF9A3A");
    sparkles(ctx, 0, 0, DW, DH, 70, "#FFFFFF", 0.9, 391, frame, 4);
    for (let i = 0; i < 30; i++) {
      glowDot(ctx, DW * (0.3 + 0.65 * hash(i, 392)), DH * (0.3 + 0.4 * hash(i, 393)), 7, "#FFA040", 0.9, 4);
    }
    for (let k = 0; k < 3; k++) {
      dataTable(ctx, DW * 0.02, DH * (0.36 + k * 0.13), 8, [120, 120], 30, 22, pal.text, 0.5, 395 + k, frame);
    }
    // bars
    const a = barAlpha(fc);
    const shimmer = fc >= 90 && fc < 210 ? 1 : 0;
    for (let i = 0; i < NB; i++) {
      const p = barProgress(fc, i);
      const sh = shimmer * 0.012 * Math.sin(TAU * (fc / 30 + i * 0.37));
      const len = BMAX * targets[i] * p * (1 + sh);
      const y = BY + i * (BT + BG);
      const col = i === 0 ? pal.barTop : pal.bar;
      hBar(ctx, BX + i * 26, y, len, BT, col, mixHex(col, "#ffffff", 0.2), a * 0.62, true);
      if (i === 0 && len > 10) {
        label(ctx, "ACTIVE SEARCH", BX + 16, y - 14, 24, pal.barTop, 0.9 * a, 600, false, 4);
      }
    }
    // diagonal light glint
    const gx = DW * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(TAU * t)));
    glint(ctx, gx, DH * 0.5, DH * 1.4, -1.1, 3, "#E6F8FF", 0.7);
    for (let k = 0; k < 4; k++) {
      const x = DW * (0.15 + 0.2 * k) + 120 * Math.sin(TAU * (t + k * 0.25));
      glint(ctx, x, DH * 0.52, DH * 0.6, -1.0 - 0.1 * k, 2, "#DFF6FF", 0.55);
    }
    lightBand(ctx, gx + 200, DH * 0.5, DH * 1.6, -1.1, 260, "#9ADFFF", 0.05);
    glowDot(ctx, gx, DH * 0.45, 5, "#ffffff", 0.9, 5);
    tex.commit();
  };

  return {
    scene,
    camera,
    post,
    update(frame) {
      const t = loopPhase(frame);
      draw(frame);
      // focus point: middle of the bars, in plane coordinates
      const fx = -PW / 2 + PW * 0.32;
      const fy = PH / 2 - PH * 0.54;
      const focusPt = new THREE.Vector3(fx, fy, 0);
      // low and close: ~60 deg from facing (30 deg above the plane), with
      // ~12 deg of roll; a slow closed drift
      const yaw = (-14 * Math.PI) / 180 + 0.03 * Math.sin(TAU * t);
      const elev = (27 * Math.PI) / 180 + 0.02 * Math.sin(TAU * t + 0.7);
      const dist = 10.6 + 0.2 * Math.cos(TAU * t);
      // plane lies in XY facing +z; camera direction from the focus point:
      const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(elev), -Math.cos(yaw) * Math.cos(elev), Math.sin(elev));
      // that puts the camera below the plane's centre looking up its
      // length; screen then tilts away toward the top of the frame.
      camera.up.set(0, 0, 1);
      camera.position.copy(focusPt).addScaledVector(dir, dist);
      camera.lookAt(focusPt.clone().add(new THREE.Vector3(1.4, -0.45, 0)));
      camera.rotateZ((-3 * Math.PI) / 180 + 0.01 * Math.sin(TAU * t));
      camera.updateMatrixWorld();
      mat.setCoc({ focus: dist, aperture: 1.4, band: 0.05 });
    },
  };
};
