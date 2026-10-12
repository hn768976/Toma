import * as THREE from "three";
import { defaultPost } from "../engine/Pipeline";
import { ScreenCanvas } from "../engine/ScreenCanvas";
import { ScreenMaterial } from "../engine/materials";
import { PeriodicSeries } from "../engine/series";
import { hash, TAU, loopPhase, ticker } from "../engine/rng";
import {
  dataDashes,
  dataTable,
  font,
  glint,
  glowStroke,
  grid,
  hBar,
  label,
  lineChart,
  mixHex,
  numberColumn,
  panelFrame,
  rgba,
  vBar,
  worldMap,
  hudScatter,
  type Ctx,
} from "../kit/draw";
import type { LookFactory } from "./types";

// Look 2 — Curved Chart Wall. A cylindrical section (radius 6, 120 deg of
// arc, height 2.4) wraps round the camera. Its content texture repeats every
// 40 deg; the camera turns exactly 40 deg about the axis per 600 frames, so
// the loop is exact. Focus sits on the centre band.

export type WallPalette = {
  bg: string;
  panel: string;
  line: string; // main line (white)
  curve: string; // smooth curve
  curve2: string; // faint second curve
  text: string;
  accents: string[]; // donut / small chart colours
};

const R = 6;
const ARC = (120 * Math.PI) / 180;
const PERIOD = (40 * Math.PI) / 180;
const HEIGHT = 2.4;
const DW = 4096;
const DH = Math.round((DW * HEIGHT) / (R * PERIOD)); // ~2347

// rows (fractions of DH)
const ROWS: [number, number][] = [
  [0.015, 0.285],
  [0.315, 0.735],
  [0.765, 0.985],
];

export const curvedWall: LookFactory<WallPalette> = (lc, pal) => {
  const tex = new ScreenCanvas(DW, DH, lc.q * 1.8, lc.maxAniso, lc.maxTex);
  const series = new PeriodicSeries(40, 2201, { momentum: 0.25, spikes: 0.15 });
  const mini = new PeriodicSeries(64, 2202, { momentum: 0.5 });
  const mini2 = new PeriodicSeries(48, 2203, { momentum: 0.6 });
  const scene = new THREE.Scene();

  // Cylinder spanning 120 deg, centred on the middle of what the camera sees
  // (angle A_MID, measured from -z toward +x). The camera rig turns +-20 deg,
  // and its view spans ~57 deg (checked numerically), so the arc ends never
  // enter the frame.
  const A_MID = (-28.7 * Math.PI) / 180;
  const geo = new THREE.CylinderGeometry(R, R, HEIGHT, 160, 1, true, Math.PI - A_MID - ARC / 2, ARC);
  const mat = new ScreenMaterial(tex.texture);
  // u runs with theta; from inside it reads mirrored, so flip it.
  mat.uniforms.uRepeat.value.set(-ARC / PERIOD, 1);
  mat.uniforms.uEdgeFade.value = 0.0;
  const wall = new THREE.Mesh(geo, mat);
  scene.add(wall);
  // Dim reflection of the wall below it (reads as the glossy lower rows).
  const refl = new THREE.Mesh(geo, new ScreenMaterial(tex.texture));
  const rm = refl.material as ScreenMaterial;
  rm.uniforms.uRepeat.value.set(-ARC / PERIOD, 1);
  rm.uniforms.uGain.value = 0.22;
  refl.scale.y = -1;
  refl.position.y = -HEIGHT - 0.03;
  scene.add(refl);
  // A dimmer second tier above the wall, so the space over it reads as more
  // (heavily defocused) panels rather than a black void.
  const upper = new THREE.Mesh(geo, new ScreenMaterial(tex.texture));
  const um = upper.material as ScreenMaterial;
  um.uniforms.uRepeat.value.set(-ARC / PERIOD, 1);
  um.uniforms.uOffset.value.set(0.37, 0);
  um.uniforms.uGain.value = 0.35;
  upper.scale.set(1.04, 1, 1.04);
  upper.position.y = HEIGHT + 0.1;
  scene.add(upper);

  const camera = new THREE.PerspectiveCamera(50, lc.W / lc.H, 0.05, 100);
  const post = defaultPost();
  post.background.set(pal.bg);
  post.backgroundCoc = 1;
  post.cocMaxFrac = 0.032;
  post.bloomStrength = 1.1;
  post.bloomThreshold = 0.38;
  post.bloomRadius = 0.7;
  post.vignette = 0.55;
  post.grain = 0.015;

  const row = (i: number) => ({ y: ROWS[i][0] * DH, h: (ROWS[i][1] - ROWS[i][0]) * DH });

  const glassPanels = (ctx: Ctx, y: number, h: number, seed: number) => {
    // panels tile across the texture period exactly
    const n = 7;
    let x = 0;
    for (let i = 0; i < n; i++) {
      const w = DW / n;
      panelFrame(ctx, x + 10, y, w - 20, h, pal.panel, 0.04 + 0.05 * hash(seed, i), 0.35, 0.85, 2.5);
      x += w;
    }
  };

  const draw = (frame: number) => {
    const t = loopPhase(frame);
    const ctx = tex.begin(pal.bg);
    // wall base tint
    const bg = ctx.createLinearGradient(0, 0, 0, DH);
    bg.addColorStop(0, rgba(pal.panel, 0.05));
    bg.addColorStop(0.5, rgba(pal.panel, 0.09));
    bg.addColorStop(1, rgba(pal.panel, 0.04));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, DW, DH);
    // top and bottom light strips
    for (const y of [0, DH - 8]) {
      ctx.fillStyle = rgba(mixHex(pal.panel, "#ffffff", 0.5), 0.9);
      ctx.fillRect(0, y, DW, 8);
    }
    for (let r = 0; r < 3; r++) {
      const { y, h } = row(r);
      glassPanels(ctx, y, h, r + 1);
      grid(ctx, 0, y, DW, h, 32, 4, pal.panel, 0.08, 0.16, 0, 0, 1.2);
    }

    // ---- top row: small panels with bars, tables, mini charts
    {
      const { y, h } = row(0);
      for (let i = 0; i < 7; i++) {
        const px = i * (DW / 7) + 40;
        const pw = DW / 7 - 80;
        const kind = i % 4;
        if (kind === 0) {
          for (let b = 0; b < 8; b++) {
            const v = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(TAU * (t * (1 + (b % 3)) + hash(i, b))));
            vBar(ctx, px + b * (pw / 8), y + h - 30, pw / 8 - 12, v * h * 0.55, pal.panel, mixHex(pal.panel, "#ffffff", 0.45), 0.85);
          }
        } else if (kind === 1) {
          dataTable(ctx, px, y + 60, 7, [120, 110, 110], 34, 24, pal.text, 0.7, 30 + i, frame);
        } else if (kind === 2) {
          lineChart(ctx, {
            x: px,
            y: y + 50,
            w: pw,
            h: h * 0.55,
            series: mini,
            start: mini.length * t,
            count: 40,
            color: pal.accents[i % pal.accents.length],
            width: 3,
            fill: pal.accents[i % pal.accents.length],
            fillAlpha: 0.3,
          });
        } else {
          ctx.fillStyle = rgba(mixHex(pal.panel, "#7af0ff", 0.4), 0.55);
          ctx.fillRect(px, y + 40, pw * 0.5, h * 0.35);
          numberColumn(ctx, px + pw * 0.58, y + 70, 6, 34, 24, pal.text, 0.7, 50 + i, frame);
        }
      }
    }

    // ---- middle row: map, globe, bars, white line, smooth curve
    {
      const { y, h } = row(1);
      const mapW = DW * 0.62;
      const mx = DW * 0.34;
      const my = y + h * 0.03;
      worldMap(ctx, lc.assets.world, mx, my, mapW, "#E6F0FF", 0.75, frame, {
        dot: 0.62,
        sub: 3,
        twinkle: 0,
        highlight: "#ffffff",
      });
      // small dotted globe at the left
      const gx = DW * 0.045;
      const gy = y + h * 0.62;
      const gr = h * 0.17;
      ctx.fillStyle = rgba(pal.text, 0.45);
      for (let a = -80; a <= 80; a += 10) {
        const yy = gy + Math.sin((a * Math.PI) / 180) * gr;
        const rr = Math.cos((a * Math.PI) / 180) * gr;
        for (let b = 0; b < 360; b += 12) {
          const lon = (b * Math.PI) / 180 + TAU * t;
          if (Math.cos(lon) < 0) continue;
          ctx.fillRect(gx + Math.sin(lon) * rr - 2, yy - 2, 4, 4);
        }
      }
      ctx.strokeStyle = rgba(pal.text, 0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, gr, 0, TAU);
      ctx.stroke();
      // horizontal bar list (left)
      for (let b = 0; b < 9; b++) {
        const v = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(TAU * (t * 2 + b * 0.13)));
        hBar(ctx, DW * 0.1, y + h * 0.36 + b * 26, v * DW * 0.13, 14, pal.panel, mixHex(pal.panel, "#ffffff", 0.5), 0.8, false);
      }
      label(ctx, "A08m31.7 JWNB KSwG z p", DW * 0.1, y + h * 0.3, 36, pal.text, 0.75, 400, true, 8);
      hudScatter(ctx, 0, y + 10, DW, h - 20, 420, pal.text, 0.7, 2290, frame, 1.3);
      // vertical bar cluster (right)
      for (let b = 0; b < 7; b++) {
        const v = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(TAU * (t * (1 + (b % 2)) + hash(b, 71))));
        vBar(ctx, DW * 0.86 + b * 44, y + h * 0.55, 30, v * h * 0.35, pal.panel, "#BFE6FF", 0.85);
      }
      // small donut
      // smooth curve (whole cycles across the period; phase turns 1 cycle per loop)
      const curve = (u: number, ph: number, amp: number) =>
        y + h * (0.6 - amp * Math.sin(TAU * (u + ph)) - 0.08 * Math.sin(TAU * (2 * u + ph * 2 + 0.3)));
      const cp = new Path2D();
      const cp2 = new Path2D();
      for (let k = 0; k <= 200; k++) {
        const u = k / 200;
        const x = u * DW;
        k ? cp.lineTo(x, curve(u, -t, 0.22)) : cp.moveTo(x, curve(u, -t, 0.22));
        k ? cp2.lineTo(x, curve(u, -t + 0.3, 0.12) + h * 0.15) : cp2.moveTo(x, curve(u, -t + 0.3, 0.12) + h * 0.15);
      }
      glowStroke(ctx, cp2, pal.curve2, 3, [[3, 0.15]], undefined, 0.35);
      glowStroke(ctx, cp, pal.curve, 4.5, [[2.5, 0.3], [5, 0.1]]);
      for (let k = 0; k < 4; k++) {
        const u = (k + 0.25) / 4;
        const dx = u * DW;
        const dy = curve(u, -t, 0.22);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(dx, dy - 11);
        ctx.lineTo(dx + 11, dy);
        ctx.lineTo(dx, dy + 11);
        ctx.lineTo(dx - 11, dy);
        ctx.fill();
        font(ctx, 28, 400, true);
        ctx.fillStyle = rgba(pal.text, 0.8);
        ctx.fillText(`${(10000 + hash(k, 81) * 89999).toFixed(0)}  ${(10000 + hash(k, 82) * 89999).toFixed(0)}`, u * DW + 20, curve(u, -t, 0.22) - 16);
      }
      // white price line with nodes + labels; one series length per loop
      lineChart(ctx, {
        x: 0,
        y: y + h * 0.18,
        w: DW,
        h: h * 0.62,
        series,
        start: series.length * t,
        count: series.length + 1,
        color: pal.line,
        width: 3.6,
        glow: [
          [2.5, 0.22],
          [5, 0.07],
        ],
        nodes: 1,
        nodeR: 10,
        labels: true,
        labelColor: pal.text,
        labelSize: 28,
        clip: false,
      });
    }

    // ---- bottom row: tables, bars, dashes
    {
      const { y, h } = row(2);
      for (let i = 0; i < 7; i++) {
        const px = i * (DW / 7) + 40;
        const pw = DW / 7 - 80;
        if (i % 2 === 0) {
          for (let b = 0; b < 10; b++) {
            const v = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(TAU * (t * 2 + hash(i, b))));
            vBar(ctx, px + b * (pw / 10), y + h - 30, pw / 10 - 10, v * h * 0.6, pal.panel, mixHex(pal.panel, "#ffffff", 0.35), 0.9);
          }
        } else {
          dataDashes(ctx, px, y + 40, pw, 8, 28, 9, pal.text, 0.4, 90 + i);
          lineChart(ctx, {
            x: px,
            y: y + h * 0.35,
            w: pw,
            h: h * 0.5,
            series: mini2,
            start: -mini2.length * t,
            count: 30,
            color: pal.accents[(i + 1) % pal.accents.length],
            width: 3,
          });
        }
      }
      font(ctx, 20, 400, true);
      void ticker;
    }
    // a soft horizontal glint along the top of the middle row
    glint(ctx, DW * 0.5, row(1).y + 6, DW * 1.2, 0, 3, "#ffffff", 0.35);
    tex.commit();
  };

  return {
    scene,
    camera,
    post,
    update(frame) {
      const t = loopPhase(frame);
      draw(frame);
      // camera: inside the curve, off-axis to the right, turned toward the
      // left part of the wall. The whole rig rotates exactly 40 deg per loop.
      const phi = -PERIOD / 2 + PERIOD * t;
      const local = new THREE.Vector3(0.6 + 0.05 * Math.cos(TAU * t), 0.1 + 0.04 * Math.sin(TAU * t), -4.5);
      const target = new THREE.Vector3(R * Math.sin(-0.3), 0, -R * Math.cos(-0.3));
      const rot = new THREE.Matrix4().makeRotationY(-phi);
      camera.position.copy(local.applyMatrix4(rot));
      camera.lookAt(target.applyMatrix4(rot));
      camera.rotateZ(-0.12);
      camera.updateMatrixWorld();
      const focus = camera.position.distanceTo(target);
      const c = { focus, aperture: 0.75, band: 0.05, extraK: 0.45, extraP: new THREE.Vector3(0, 0.03, 0), extraN: new THREE.Vector3(0, 1, 0), extraBand: 0.45 };
      mat.setCoc(c);
      rm.setCoc({ ...c, extraBand: 0, bias: 0.3 });
      um.setCoc({ ...c, extraBand: 0, bias: 0.45 });
    },
  };
};
