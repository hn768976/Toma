import * as THREE from "three";
import { defaultPost } from "../engine/Pipeline";
import { ScreenCanvas } from "../engine/ScreenCanvas";
import { ScreenMaterial } from "../engine/materials";
import { PeriodicSeries } from "../engine/series";
import { hash, TAU, loopPhase, ticker } from "../engine/rng";
import {
  candles,
  dataDashes,
  dataTable,
  dottedLine,
  fmtNum,
  font,
  glowDot,
  grid,
  label,
  lineChart,
  numberColumn,
  rgba,
  sparkCard,
  CODES,
  crosshair,
  hudScatter,
} from "../kit/draw";
import type { LookFactory } from "./types";

// Look 6 — Trading Dashboard. A dark navy-purple dashboard seen at an angle:
// four sparkline cards, a big white-violet candle chart and tables.

export type DashPalette = {
  bg: string;
  screen: string;
  candle: string;
  glow: string;
  cards: [string, string, string, string];
  text: string;
  accent: string; // orange numbers
  grid: string;
  rows: string; // purple table rows
};

const DW = 5200;
const DH = 3000;

export const dashboard: LookFactory<DashPalette> = (lc, pal) => {
  const tex = new ScreenCanvas(DW, DH, lc.q * 1.2, lc.maxAniso, lc.maxTex);
  const big = new PeriodicSeries(160, 6111, { momentum: 0.45, spikes: 0.12 });
  const sp = [6102, 6103, 6104, 6105].map((s) => new PeriodicSeries(60, s, { momentum: 0.5, smooth: 1 }));
  const scene = new THREE.Scene();
  const PW = 10.4;
  const PH = (PW * DH) / DW;
  const mat = new ScreenMaterial(tex.texture);
  mat.uniforms.uEdgeFade.value = 0.04; // panel edges dissolve into the dark
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
  scene.add(plane);

  const camera = new THREE.PerspectiveCamera(34, lc.W / lc.H, 0.05, 100);
  const post = defaultPost();
  post.background.set(pal.bg);
  post.backgroundCoc = 1;
  post.cocMaxFrac = 0.03;
  post.bloomStrength = 1.2;
  post.bloomThreshold = 0.3;
  post.bloomRadius = 0.7;
  post.vignette = 0.6;
  post.grain = 0.015;

  const chart = { x: DW * 0.03, y: DH * 0.4, w: DW * 0.56, h: DH * 0.52 };

  const draw = (frame: number) => {
    const t = loopPhase(frame);
    const ctx = tex.begin(pal.screen);
    grid(ctx, 0, 0, DW, DH, 50, 6, pal.grid, 0.05, 0.1, 0, 0, 1.3);

    // top-left purple table
    const tx = DW * 0.03;
    const ty = DH * 0.06;
    for (let r = 0; r < 8; r++) {
      ctx.fillStyle = rgba(pal.rows, r % 2 ? 0.3 : 0.45);
      ctx.fillRect(tx, ty + r * 58, DW * 0.17, 50);
    }
    ctx.fillStyle = rgba(pal.rows, 0.85);
    ctx.fillRect(tx, ty - 50, DW * 0.17, 36);
    dataTable(ctx, tx + 14, ty + 34, 8, [190, 190, 160, 140], 58, 26, pal.text, 0.85, 610, frame, pal.cards[0]);

    // four sparkline cards
    const cx0 = DW * 0.22;
    const cw = DW * 0.095;
    const titles = ["INDEX", "VOLUME", "ANALYTICS", "MARKET DATA"];
    for (let i = 0; i < 4; i++) {
      sparkCard(ctx, cx0 + i * (cw + 24), ty - 50, cw, 300, sp[i], sp[i].length * t * (i % 2 ? 1 : 2), pal.cards[i], pal.text, frame, 620 + i, titles[i]);
    }
    // widget row under the cards: small white boxes and numbers
    for (let i = 0; i < 4; i++) {
      const x = cx0 + i * (cw + 24);
      const y = ty + 280;
      ctx.fillStyle = rgba("#E8E8FF", 0.82);
      ctx.fillRect(x + 10, y + 30 + (i % 2) * 90, cw * 0.55, 46);
      dataTable(ctx, x + 10, y + 150, 4, [120, 120], 38, 22, pal.text, 0.7, 630 + i, frame, pal.accent);
      font(ctx, 26, 500, true);
      ctx.fillStyle = rgba("#1A1030", 0.95);
      ctx.fillText(fmtNum(ticker(frame, 20, 640 + i), 3), x + 22, y + 64 + (i % 2) * 90);
    }

    // big price chart: frame + dotted grid + candles + violet glow line
    ctx.strokeStyle = rgba(pal.text, 0.35);
    ctx.lineWidth = 2;
    ctx.strokeRect(chart.x, chart.y, chart.w, chart.h);
    for (let r = 1; r < 10; r++) dottedLine(ctx, chart.x, chart.y + (chart.h * r) / 10, chart.x + chart.w, chart.y + (chart.h * r) / 10, 22, 2, pal.text, 0.35);
    for (let c = 1; c < 16; c++) dottedLine(ctx, chart.x + (chart.w * c) / 16, chart.y, chart.x + (chart.w * c) / 16, chart.y + chart.h, 22, 2, pal.text, 0.3);
    // chart scrolls one series length per loop
    const start = big.length * t;
    // violet glow underlay on the left part (fades toward the right)
    lineChart(ctx, {
      x: chart.x,
      y: chart.y + chart.h * 0.08,
      w: chart.w,
      h: chart.h * 0.86,
      series: big,
      start,
      count: 110,
      color: pal.glow,
      width: 10,
      glow: [
        [3, 0.25],
        [7, 0.1],
      ],
      alpha: 0.55,
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(chart.x, chart.y - 40, chart.w, chart.h + 80);
    ctx.clip();
    candles(ctx, {
      x: chart.x,
      y: chart.y + chart.h * 0.08,
      w: chart.w,
      h: chart.h * 0.86,
      series: big,
      start,
      count: 110,
      up: pal.candle,
      down: pal.candle,
      bodyW: 0.34,
      wickW: 3.5,
      wickMul: 0.14,
      glow: [
        [2.5, 0.22],
        [6, 0.08],
      ],
      minBody: 6,
    });
    ctx.restore();
    // dot grid inside the chart panel
    for (let r = 0; r < 14; r++)
      for (let c = 0; c < 40; c++) {
        if (hash(r, c, 655) < 0.55) continue;
        ctx.fillStyle = rgba(pal.text, 0.7);
        ctx.fillRect(chart.x + chart.w * 0.3 + c * 22, chart.y + 40 + r * 22, 4, 4);
      }
    // secondary lilac line + cyan-white trace on the far left
    lineChart(ctx, {
      x: chart.x,
      y: chart.y + chart.h * 0.35,
      w: chart.w * 0.28,
      h: chart.h * 0.5,
      series: sp[1],
      start: sp[1].length * t,
      count: 30,
      color: "#B89AFF",
      width: 9,
      glow: [[3, 0.4], [7, 0.15]],
    });
    lineChart(ctx, {
      x: chart.x + chart.w * 0.05,
      y: chart.y + chart.h * 0.2,
      w: chart.w * 0.25,
      h: chart.h * 0.45,
      series: sp[2],
      start: -sp[2].length * t,
      count: 26,
      color: "#BFF0FF",
      width: 3,
      glow: [[3, 0.25]],
    });
    // crosshair markers + labels on a few peaks
    for (let k = 0; k < 4; k++) {
      const idx = Math.floor(start) + 15 + k * 25;
      const px = chart.x + ((idx - start + 0.5) / 110) * chart.w;
      const py = chart.y + chart.h * 0.08 + chart.h * 0.86 * (1 - big.get(idx)) - 60;
      crosshair(ctx, px, py, 18, "#FFFFFF", 0.85, 2.5);
      glowDot(ctx, px, py, 6, "#FFFFFF", 1, 6);
      font(ctx, 20, 400, true);
      ctx.fillStyle = rgba(pal.text, 0.85);
      ctx.fillText(fmtNum(hash(idx, 657), 3), px + 22, py - 8);
    }
    hudScatter(ctx, DW * 0.22, DH * 0.27, DW * 0.42, DH * 0.1, 260, pal.text, 0.8, 658, frame, 1.2, pal.accent);
    hudScatter(ctx, DW * 0.62, DH * 0.05, DW * 0.36, DH * 0.9, 900, pal.text, 0.8, 659, frame, 1.3, pal.accent);
    // left tint (purple fade on the oldest data)
    const lg = ctx.createLinearGradient(chart.x, 0, chart.x + chart.w * 0.25, 0);
    lg.addColorStop(0, rgba(pal.glow, 0.35));
    lg.addColorStop(1, rgba(pal.glow, 0));
    ctx.globalCompositeOperation = "multiply";
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = lg;
    ctx.fillRect(chart.x, chart.y, chart.w * 0.25, chart.h);
    // chart labels
    label(ctx, "INDEX", chart.x + 20, chart.y - 30, 34, pal.text, 0.8, 600, false, 4);
    font(ctx, 30, 500, true);
    ctx.fillStyle = rgba(pal.text, 0.9);
    ctx.fillText(`${CODES[0]}   ${fmtNum(ticker(frame, 15, 650), 3)}   ${fmtNum(ticker(frame, 15, 651), 2)}`, chart.x + 200, chart.y - 30);
    numberColumn(ctx, chart.x + chart.w + 20, chart.y + 30, 10, chart.h / 10, 24, pal.text, 0.6, 652, frame, 1, 0.3);
    // a floating price tag at the last candle
    const lastY = chart.y + chart.h * 0.08 + chart.h * 0.86 * (1 - big.at(start + 110));
    glowDot(ctx, chart.x + chart.w, lastY, 8, "#ffffff", 0.95, 4);

    // right side: tables and small panels
    const rx = DW * 0.66;
    for (let k = 0; k < 3; k++) {
      label(ctx, `DATA ANALYSIS 0${k + 1}`, rx + 900, DH * (0.08 + k * 0.05), 26, pal.text, 0.8, 500, true);
      numberColumn(ctx, rx + 1250, DH * (0.08 + k * 0.05), 1, 30, 26, pal.text, 0.8, 690 + k, frame, 4);
    }
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 16; c++) {
        ctx.fillStyle = rgba(pal.accent, hash(r, c, 691) < 0.35 ? 0.9 : 0.25);
        ctx.fillRect(rx + 1100 + c * 22, DH * 0.86 + r * 22, 12, 12);
      }
    label(ctx, "MARKET DATA", rx, DH * 0.08, 30, pal.text, 0.75, 600, false, 5);
    dataTable(ctx, rx, DH * 0.12, 6, [200, 170, 170, 170, 140], 40, 26, pal.text, 0.75, 660, frame, pal.accent);
    for (let b = 0; b < 4; b++) {
      const y = DH * (0.3 + b * 0.16);
      ctx.fillStyle = rgba("#E8E8FF", 0.75);
      ctx.fillRect(rx, y, 110, 34);
      label(ctx, `SER-${"ABCD"[b]}`, rx + 130, y + 26, 24, pal.text, 0.7, 500, true);
      numberColumn(ctx, rx + 300, y + 26, 4, 36, 24, pal.text, 0.7, 670 + b, frame);
      font(ctx, 40, 500, true);
      ctx.fillStyle = rgba(pal.accent, 0.95);
      ctx.fillText(fmtNum(ticker(frame, 30, 680 + b), 3), rx + 560, y + 90);
      dataDashes(ctx, rx + 760, y, 520, 5, 28, 8, pal.text, 0.35, 690 + b);
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 12; c++) {
          ctx.fillStyle = rgba(pal.text, hash(b, r, c) < 0.2 ? 0.8 : 0.3);
          ctx.fillRect(rx + 760 + c * 26, y + 160 + r * 22, 12, 12);
        }
    }
    numberColumn(ctx, DW * 0.95, DH * 0.1, 30, 90, 26, pal.text, 0.5, 700, frame, -1, 0.4, "right");
    tex.commit();
  };

  return {
    scene,
    camera,
    post,
    update(frame) {
      const t = loopPhase(frame);
      draw(frame);
      // focus on the big chart
      const fpx = -PW / 2 + PW * 0.32;
      const fpy = PH / 2 - PH * 0.6;
      const focusPt = new THREE.Vector3(fpx, fpy, 0);
      const yaw = (-35 * Math.PI) / 180 + 0.035 * Math.sin(TAU * t);
      const tilt = (38 * Math.PI) / 180 + 0.02 * Math.sin(TAU * t + 1.3);
      const dist = 9.2 - 0.4 * (0.5 - 0.5 * Math.cos(TAU * t)); // slow push in/out
      camera.position.set(
        focusPt.x + Math.sin(yaw) * Math.cos(tilt) * dist,
        focusPt.y + Math.sin(tilt) * dist,
        Math.cos(yaw) * Math.cos(tilt) * dist,
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(focusPt.clone().add(new THREE.Vector3(1.7, 0.9, 0)));
      camera.rotateZ(0.09);
      camera.updateMatrixWorld();
      mat.setCoc({ focus: dist, aperture: 0.7, band: 0.06 });
    },
  };
};
