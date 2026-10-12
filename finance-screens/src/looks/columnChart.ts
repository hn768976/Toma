import * as THREE from "three";
import { defaultPost } from "../engine/Pipeline";
import { ScreenCanvas } from "../engine/ScreenCanvas";
import { ScreenMaterial } from "../engine/materials";
import { hash, TAU, loopPhase, clamp, easeOutCubic, smoothstep } from "../engine/rng";
import {
  arcGauge,
  crosshair,
  dataDashes,
  dataTable,
  donut,
  dottedLine,
  font,
  glint,
  glowDot,
  grid,
  label,
  lightBand,
  numberColumn,
  rgba,
  vBar,
  hudScatter,
  sparkles,
} from "../kit/draw";
import type { LookFactory } from "./types";

// Look 5 — Column Chart. A tilted screen with ~40 columns rising and falling
// like an equaliser (sums of whole-cycle sines plus a seeded shape) and a
// multicolour donut that fills in segment by segment, twice per loop.

export type ColumnPalette = {
  bg: string;
  screen: string;
  col0: string;
  col1: string;
  donut: string[]; // 5 segment colours
  text: string;
  grid: string;
  ring: string; // small ring gauges
};

const DW = 4800;
const DH = 2700;
const NC = 40;

// Column height (0..1) at loop phase t: whole-cycle sines => periodic.
const colHeight = (i: number, t: number) => {
  const shape = 0.35 + 0.35 * Math.sin((i / NC) * TAU * 1.3 + 0.6) + 0.2 * hash(i, 501);
  const w =
    0.16 * Math.sin(TAU * (2 * t + hash(i, 502))) +
    0.1 * Math.sin(TAU * (3 * t + hash(i, 503))) +
    0.06 * Math.sin(TAU * (5 * t + hash(i, 504)));
  return clamp(shape + w, 0.08, 1);
};

// Donut fill: two 300-frame cycles; fill 0-105 segment by segment, hold,
// fade out over the last 24 frames.
export const donutState = (frame: number) => {
  const f = frame % 300;
  const progress = easeOutCubic(clamp(f / 105));
  const alpha = 1 - smoothstep(276, 299, f);
  return { progress, alpha };
};

export const columnChart: LookFactory<ColumnPalette> = (lc, pal) => {
  const tex = new ScreenCanvas(DW, DH, lc.q * 1.2, lc.maxAniso, lc.maxTex);
  const scene = new THREE.Scene();
  const PW = 12;
  const PH = (PW * DH) / DW;
  const mat = new ScreenMaterial(tex.texture);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
  plane.rotation.x = -Math.PI / 2; // lies in XZ, canvas top = far (-z)
  scene.add(plane);

  // The columns stand on their own upright panel (cutout: only the columns
  // are drawn), along a line across the floor screen.
  const CW = 4800;
  const CH = 540;
  const colTex = new ScreenCanvas(CW, CH, lc.q * 1.0, lc.maxAniso, lc.maxTex);
  const colMat = new ScreenMaterial(colTex.texture, "cutout");
  const CPW = PW * 0.86;
  const CPH = (CPW * CH) / CW;
  const colPanel = new THREE.Mesh(new THREE.PlaneGeometry(CPW, CPH), colMat);
  colPanel.position.set(-0.2, CPH / 2, -0.9);
  scene.add(colPanel);
  // a second, farther column group (back row, defocused)
  const colPanel2 = new THREE.Mesh(new THREE.PlaneGeometry(CPW * 0.7, CPH * 0.8), colMat);
  colPanel2.position.set(-2.4, (CPH * 0.8) / 2, -2.4);
  scene.add(colPanel2);

  // vertical light shafts rising from the screen (additive, blurred)
  const shaftTex = new ScreenCanvas(256, 512, 1, lc.maxAniso, lc.maxTex);
  {
    const ctx = shaftTex.begin("#000000");
    for (let i = 0; i < 9; i++) {
      const x = 20 + hash(i, 511) * 216;
      const w = 4 + hash(i, 512) * 22;
      const g = ctx.createLinearGradient(0, 512, 0, 0);
      g.addColorStop(0, rgba("#9AC8FF", 0.5 * hash(i, 513) + 0.1));
      g.addColorStop(1, rgba("#9AC8FF", 0));
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, 512);
    }
    shaftTex.commit();
  }
  const shafts: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const m = new ScreenMaterial(shaftTex.texture, "addBlur");
    m.uniforms.uGain.value = 0.6;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), m);
    scene.add(s);
    shafts.push(s);
  }

  const camera = new THREE.PerspectiveCamera(32, lc.W / lc.H, 0.05, 100);
  const post = defaultPost();
  post.background.set(pal.bg);
  post.backgroundCoc = 1;
  post.cocMaxFrac = 0.032;
  post.bloomStrength = 0.55;
  post.bloomThreshold = 0.55;
  post.bloomRadius = 0.65;
  post.vignette = 0.65;
  post.grain = 0.015;

  const baseY = DH * 0.5 - (0.9 / PH) * DH; // floor line under the panel
  const colX0 = DW * 0.5 - (CPW / PW) * DW * 0.5 - (0.2 / PW) * DW;
  const colW = ((CPW / PW) * DW) / NC;

  const drawColumns = (frame: number) => {
    const t = loopPhase(frame);
    const ctx = colTex.begin("#000000");
    const w = CW / NC;
    for (let i = 0; i < NC; i++) {
      const h = colHeight(i, t) * CH * 0.95;
      vBar(ctx, i * w + 7, CH, w - 14, h, pal.col0, pal.col1, 1);
    }
    colTex.commit();
  };

  const draw = (frame: number) => {
    const t = loopPhase(frame);
    const ctx = tex.begin(pal.screen);
    grid(ctx, 0, 0, DW, DH, 60, 5, pal.grid, 0.07, 0.15, 0, 0, 1.4);
    // dim data texture: rows of text and dashes
    for (let i = 0; i < 6; i++) {
      dataDashes(ctx, DW * 0.02 + i * DW * 0.165, DH * 0.55, DW * 0.14, 14, 24, 7, pal.text, 0.2, 520 + i);
      dataTable(ctx, DW * 0.02 + i * DW * 0.165, DH * 0.82, 5, [120, 120, 120], 30, 22, pal.text, 0.4, 530 + i, frame);
    }
    for (let i = 0; i < 5; i++) {
      numberColumn(ctx, DW * (0.1 + i * 0.2), DH * 0.06, 5, 30, 22, pal.text, 0.35, 540 + i, frame);
    }
    label(ctx, "ANALYTICS", DW * 0.55, DH * 0.6, 30, pal.text, 0.55, 600, false, 6);
    label(ctx, "MARKET DATA", DW * 0.3, DH * 0.62, 26, pal.text, 0.5, 600, false, 5);
    label(ctx, "VOLUME", DW * 0.06, DH * 0.5, 24, pal.text, 0.6, 500, false, 4);
    // small ring gauges in rows at the front
    for (let i = 0; i < 6; i++) {
      arcGauge(ctx, DW * (0.22 + i * 0.07), DH * (0.74 + 0.035 * i), 80, 18, 0.35 + 0.5 * hash(i, 551), pal.ring, 0.85, TAU * (t * (i % 2 ? 1 : -1)));
    }
    for (let i = 0; i < 4; i++) {
      arcGauge(ctx, DW * (0.86 + (i % 2) * 0.06), DH * (0.12 + Math.floor(i / 2) * 0.07), 30, 8, 0.6, pal.ring, 0.6);
    }
    hudScatter(ctx, 0, 0, DW, DH, 1700, pal.text, 0.7, 560, frame, 1.3, "#FF7A4A");
    sparkles(ctx, DW * 0.1, DH * 0.45, DW * 0.8, DH * 0.4, 50, "#FFFFFF", 0.9, 561, frame, 4);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = rgba(pal.text, 0.35);
      ctx.fillRect(0, DH * (0.53 + i * 0.07), DW, 2);
    }
    // crosshairs + dotted guides
    for (let i = 0; i < 8; i++) {
      crosshair(ctx, DW * (0.05 + i * 0.12), DH * 0.52, 14, pal.text, 0.5, 2);
    }
    dottedLine(ctx, colX0, baseY + 14, colX0 + NC * colW, baseY + 14, 14, 2, pal.text, 0.45);
    // reflection glow of each column on the floor
    for (let i = 0; i < NC; i++) {
      const h = colHeight(i, t);
      const g = ctx.createLinearGradient(0, baseY, 0, baseY + 260 * h);
      g.addColorStop(0, rgba(pal.col1, 0.22));
      g.addColorStop(1, rgba(pal.col0, 0));
      ctx.fillStyle = g;
      ctx.fillRect(colX0 + i * colW + 6, baseY, colW - 12, 260 * h);
    }
    // the donut
    const { progress, alpha } = donutState(frame);
    const dcx = DW * 0.56;
    const dcy = DH * 0.7;
    ctx.globalCompositeOperation = "source-over";
    donut(ctx, dcx, dcy, 230, 95, [
      { v: 22, color: pal.donut[0] },
      { v: 30, color: pal.donut[1] },
      { v: 20, color: pal.donut[2] },
      { v: 12, color: pal.donut[3] },
      { v: 16, color: pal.donut[4] },
    ], progress, 0.025, alpha * 0.78, -Math.PI * 0.62);
    if (alpha > 0.01) {
      font(ctx, 40, 500, true);
      ctx.fillStyle = rgba(pal.text, 0.9 * alpha * progress);
      ctx.textAlign = "center";
      ctx.textAlign = "left";
    }
    glowDot(ctx, dcx + 270, dcy - 120, 6, "#ffffff", 0.8, 5);
    // diagonal light glints sweeping (two per loop, whole cycles)
    for (let k = 0; k < 2; k++) {
      const u = (((2 * t + k * 0.5) % 1) + 1) % 1;
      const gx = -DW * 0.3 + DW * 1.6 * u;
      const a = Math.sin(Math.PI * u);
      lightBand(ctx, gx, DH * 0.5, DH * 1.8, -0.9, 380, "#7AB8FF", 0.08 * a);
      glint(ctx, gx, DH * 0.5, DH * 1.6, -0.9, 2.5, "#CFE6FF", 0.6 * a);
    }
    tex.commit();
  };

  return {
    scene,
    camera,
    post,
    update(frame) {
      const t = loopPhase(frame);
      draw(frame);
      drawColumns(frame);
      // focus on the near columns / donut
      const focusPt = new THREE.Vector3(1.0, 0, 0.2);
      const yaw = (-32 * Math.PI) / 180 + 0.05 * Math.sin(TAU * t);
      const elev = (33 * Math.PI) / 180;
      const dist = 6.6 + 0.15 * Math.cos(TAU * t);
      const side = 0.6 * Math.sin(TAU * t);
      const target = focusPt.clone().add(new THREE.Vector3(side, 0, 0));
      camera.position.set(
        target.x + Math.sin(yaw) * Math.cos(elev) * dist * -1,
        Math.sin(elev) * dist,
        target.z + Math.cos(yaw) * Math.cos(elev) * dist,
      );
      camera.lookAt(target.clone().add(new THREE.Vector3(-0.8, 0.35, -0.6)));
      camera.rotateZ(-0.22);
      camera.updateMatrixWorld();
      mat.setCoc({ focus: dist * 1.02, aperture: 0.85, band: 0.06 });
      colMat.setCoc({ focus: dist * 1.02, aperture: 0.85, band: 0.06 });
      shafts.forEach((s, i) => {
        const u = (((t + i * 0.5) % 1) + 1) % 1;
        s.position.set(-4 + 8 * u, 1.1, -0.4 - i * 0.8);
        s.lookAt(camera.position.x, 1.1, camera.position.z);
        (s.material as ScreenMaterial).uniforms.uGain.value = 0.6 * Math.sin(Math.PI * u);
        (s.material as ScreenMaterial).setCoc({ focus: dist, aperture: 2.0, band: 0.03, bias: 0.3 });
      });
    },
  };
};
