import React, { useCallback } from "react";
import { CanvasStage, DrawInfo, LH, LW } from "../../lib/CanvasStage";
import { INTER, MONO } from "../../lib/fonts";
import { addGlow, getLayer } from "../../lib/layers";
import { TAU } from "../../lib/random";
import { gearAngle, PlacedGear } from "./gear";
import { FAR, GAUGE, HEXES, LABELS, MAP_DOT, MAP_DOTS, NEAR, SOFT_NEAR, SPECKS } from "./layout";
import { GearVersion } from "./versions";

const LOOP = 600;
const NEAR_TEETH = 6; // teeth advanced per loop (integer => exact loop)
const FAR_TEETH = 4;
const GAUGE_TEETH = 5;

const drawGear = (c: CanvasRenderingContext2D, g: PlacedGear, angle: number, fill: string, edge: string, alpha: number) => {
  c.save();
  c.translate(g.x, g.y);
  c.rotate(angle);
  c.globalAlpha = alpha * 0.72;
  c.fillStyle = fill;
  c.fill(g.shape.path, "evenodd");
  c.globalAlpha = alpha * 0.45;
  c.strokeStyle = edge;
  c.lineWidth = 1.2;
  c.stroke(g.shape.path);
  c.restore();
};

const hexPath = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
};

export const GearWorld: React.FC<{ v: GearVersion; loopCheck?: boolean }> = ({ v }) => {
  const draw = useCallback(
    (main: CanvasRenderingContext2D, { frame, bw, bh, k }: DrawInfo) => {
      const t = (frame % LOOP) / LOOP;
      main.fillStyle = v.background;
      main.fillRect(0, 0, LW, LH);

      // blue haze
      const haze = (x: number, y: number, r: number, a: number) => {
        const g = main.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(30,140,220,${a})`);
        g.addColorStop(0.5, `rgba(16,90,160,${a * 0.35})`);
        g.addColorStop(1, "rgba(8,50,100,0)");
        main.fillStyle = g;
        main.fillRect(x - r, y - r, 2 * r, 2 * r);
      };
      haze(640, 330, 900, 0.1);
      haze(1030, 320, 300, 0.28);

      // hexagons + HUD lines
      main.strokeStyle = v.edge;
      main.lineWidth = 1.4;
      for (const h of HEXES) {
        hexPath(main, h.x, h.y, 66);
        if (h.dark) {
          main.globalAlpha = h.a;
          main.fillStyle = "#01060F";
          main.fill();
        } else {
          main.globalAlpha = h.a * 0.3;
          main.fillStyle = "#0A2A50";
          main.fill();
          main.globalAlpha = h.a * 0.45;
          main.stroke();
        }
      }
      main.globalAlpha = 0.12;
      main.beginPath();
      main.moveTo(0, 262);
      main.lineTo(LW, 262);
      main.moveTo(250, 40);
      main.lineTo(250, 690);
      main.moveTo(0, 580);
      main.lineTo(560, 580);
      main.stroke();
      main.globalAlpha = 1;

      // map dots
      const mp = getLayer("gw-map", bw, bh);
      mp.setTransform(k, 0, 0, k, 0, 0);
      mp.fillStyle = v.map;
      const ds = MAP_DOT * 0.55;
      for (const d of MAP_DOTS) {
        let a = Math.min(1, 0.12 + 1.3 * d.b);
        if (d.tw) a *= 0.6 + 0.4 * Math.sin(TAU * (d.tw * 3 * t + d.ph));
        mp.globalAlpha = a;
        mp.fillRect(d.x - ds / 2, d.y - ds / 2, ds, ds);
      }
      mp.globalAlpha = 1;
      addGlow(main, mp.canvas, 6 * k, 0.6, "gw-glow1");
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.drawImage(mp.canvas, 0, 0);
      main.globalCompositeOperation = "lighter";
      main.globalAlpha = 0.6;
      main.drawImage(mp.canvas, 0, 0);
      main.restore();

      // left light bloom + horizontal streak
      haze(150, 320, 300, 0.55);
      haze(120, 310, 160, 0.35);
      const st = main.createLinearGradient(0, 0, 300, 0);
      st.addColorStop(0, "rgba(90,200,255,0.55)");
      st.addColorStop(1, "rgba(90,200,255,0)");
      main.fillStyle = st;
      main.globalCompositeOperation = "lighter";
      for (const [hh, a] of [[30, 0.12], [8, 0.18]] as const) {
        main.globalAlpha = a;
        main.fillRect(0, 305 - hh / 2, 300, hh);
      }
      main.globalAlpha = 1;
      main.globalCompositeOperation = "source-over";

      // far gears, blurred
      const far = getLayer("gw-far", bw, bh);
      far.setTransform(k, 0, 0, k, 0, 0);
      for (const g of FAR) drawGear(far, g, gearAngle(g, t, FAR_TEETH), v.gear, v.edge, 0.5);
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.filter = `blur(${2.2 * k}px)`;
      main.drawImage(far.canvas, 0, 0);
      main.filter = "none";
      main.restore();

      // labels
      main.font = `400 8.5px ${MONO}`;
      main.fillStyle = v.hot;
      main.globalAlpha = 0.7;
      main.textBaseline = "middle";
      for (const l of LABELS) main.fillText(l.s, l.x, l.y);
      main.globalAlpha = 1;

      // near gears + gauge on a glowing layer
      const fg = getLayer("gw-fg", bw, bh);
      fg.setTransform(k, 0, 0, k, 0, 0);
      NEAR.forEach((g, i) => {
        if (!SOFT_NEAR.has(i)) drawGear(fg, g, gearAngle(g, t, NEAR_TEETH), v.gear, v.edge, 0.95);
      });
      // out-of-focus members of the same train (they still mesh)
      const soft = getLayer("gw-soft", bw, bh);
      soft.setTransform(k, 0, 0, k, 0, 0);
      NEAR.forEach((g, i) => {
        if (SOFT_NEAR.has(i)) drawGear(soft, g, gearAngle(g, t, NEAR_TEETH), v.gear, v.edge, 0.8);
      });
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.filter = `blur(${1.6 * k}px)`;
      main.drawImage(soft.canvas, 0, 0);
      main.filter = "none";
      main.restore();
      // bright floating specks
      fg.fillStyle = v.hot;
      for (const sp of SPECKS) {
        fg.globalAlpha = 0.2 + 0.2 * Math.sin(TAU * (sp.k * t + sp.ph));
        fg.beginPath();
        fg.arc(sp.x, sp.y, sp.r, 0, TAU);
        fg.fill();
      }
      fg.globalAlpha = 1;
      // the gears get only a faint glow: draw them to main now, HUD glows separately
      addGlow(main, fg.canvas, 8 * k, 0.3, "gw-glow3");
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.filter = `blur(${0.5 * k}px)`;
      main.drawImage(fg.canvas, 0, 0);
      main.filter = "none";
      main.restore();
      fg.setTransform(1, 0, 0, 1, 0, 0);
      fg.clearRect(0, 0, bw, bh);
      fg.setTransform(k, 0, 0, k, 0, 0);

      // ---- gauge ----
      const { x: gx, y: gy, gear } = GAUGE;
      // dark backing disc
      fg.fillStyle = "rgba(4,24,50,0.55)";
      fg.beginPath();
      fg.arc(gx, gy, gear.ra + 2, 0, TAU);
      fg.fill();
      const gAngle = (GAUGE_TEETH * TAU * t) / 40;
      fg.save();
      fg.translate(gx, gy);
      fg.rotate(gAngle);
      const gg = fg.createRadialGradient(0, 0, gear.rd * 0.7, 0, 0, gear.ra);
      gg.addColorStop(0, "rgba(20,90,150,0.55)");
      gg.addColorStop(1, "rgba(40,140,200,0.7)");
      fg.fillStyle = gg;
      fg.fill(gear.path, "evenodd");
      fg.strokeStyle = v.hot;
      fg.lineWidth = 1.4;
      fg.stroke(gear.path);
      fg.restore();
      const rIn = gear.rd - 16;
      // inner face
      const face = fg.createRadialGradient(gx, gy, 0, gx, gy, rIn);
      face.addColorStop(0, "rgba(30,120,180,0.45)");
      face.addColorStop(0.6, "rgba(12,60,110,0.55)");
      face.addColorStop(1, "rgba(6,30,70,0.75)");
      fg.fillStyle = face;
      fg.beginPath();
      fg.arc(gx, gy, rIn, 0, TAU);
      fg.fill();
      fg.strokeStyle = v.edge;
      fg.lineWidth = 1;
      for (const [rr, a] of [[rIn, 0.9], [rIn * 0.78, 0.5], [rIn * 0.42, 0.6], [rIn * 0.15, 0.8]] as const) {
        fg.globalAlpha = a;
        fg.beginPath();
        fg.arc(gx, gy, rr, 0, TAU);
        fg.stroke();
      }
      // ticks
      fg.globalAlpha = 0.7;
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU;
        const L = i % 6 === 0 ? 8 : 4;
        fg.beginPath();
        fg.moveTo(gx + Math.cos(a) * (rIn - 2), gy + Math.sin(a) * (rIn - 2));
        fg.lineTo(gx + Math.cos(a) * (rIn - 2 - L), gy + Math.sin(a) * (rIn - 2 - L));
        fg.stroke();
      }
      // radar sweep, once per loop
      const sweep = TAU * t - Math.PI / 2;
      fg.save();
      fg.beginPath();
      fg.arc(gx, gy, rIn * 0.98, 0, TAU);
      fg.clip();
      const cg = fg.createConicGradient(sweep - 1.2, gx, gy);
      cg.addColorStop(0, "rgba(90,180,255,0)");
      cg.addColorStop(1.2 / TAU, "rgba(120,210,255,0.4)");
      cg.addColorStop(1.2 / TAU + 0.001, "rgba(120,210,255,0)");
      cg.addColorStop(1, "rgba(90,180,255,0)");
      fg.globalAlpha = 1;
      fg.fillStyle = cg;
      fg.fillRect(gx - rIn, gy - rIn, 2 * rIn, 2 * rIn);
      fg.restore();
      fg.globalAlpha = 0.95;
      fg.strokeStyle = v.hot;
      fg.lineWidth = 1.4;
      fg.beginPath();
      fg.moveTo(gx, gy);
      fg.lineTo(gx + Math.cos(sweep) * rIn * 0.97, gy + Math.sin(sweep) * rIn * 0.97);
      fg.stroke();
      // blip
      fg.fillStyle = v.hot;
      const bA = sweep - 0.9;
      fg.beginPath();
      fg.arc(gx + Math.cos(bA) * rIn * 0.6, gy + Math.sin(bA) * rIn * 0.6, 5, 0, TAU);
      fg.fill();
      // crosshair
      fg.globalAlpha = 0.5;
      fg.lineWidth = 1;
      fg.beginPath();
      fg.moveTo(gx - rIn - 60, gy);
      fg.lineTo(gx + rIn + 60, gy);
      fg.stroke();
      // arc gauge segments inside
      fg.lineWidth = 3;
      fg.globalAlpha = 0.6;
      for (const [a0, a1, rr] of [[-2.6, -1.1, rIn * 0.86], [0.3, 1.4, rIn * 0.86], [2.0, 2.9, rIn * 0.6]] as const) {
        fg.beginPath();
        fg.arc(gx, gy, rr, a0, a1);
        fg.stroke();
      }
      fg.lineWidth = 1;
      // chevron, small square, circle markers
      fg.globalAlpha = 0.8;
      fg.strokeStyle = v.hot;
      fg.lineWidth = 1.3;
      fg.beginPath();
      fg.moveTo(gx - 72, gy - 52);
      fg.lineTo(gx - 22, gy - 52);
      fg.lineTo(gx - 47, gy - 6);
      fg.closePath();
      fg.stroke();
      fg.globalAlpha = 0.15;
      fg.fillStyle = v.hot;
      fg.fill();
      fg.globalAlpha = 0.85;
      fg.strokeRect(gx + 48, gy + 110, 9, 9);
      fg.beginPath();
      fg.arc(gx + 58, gy - 14, 11, 0, TAU);
      fg.stroke();
      fg.beginPath();
      fg.arc(gx - 30, gy + 96, 5, 0, TAU);
      fg.stroke();
      fg.lineWidth = 1;
      // long horizontal line to the left
      fg.globalAlpha = 0.7;
      fg.strokeStyle = v.edge;
      fg.beginPath();
      fg.moveTo(775, gy);
      fg.lineTo(gx - rIn, gy);
      fg.moveTo(gx + rIn, gy);
      fg.lineTo(1270, gy);
      fg.stroke();
      // outer HUD rings + frame
      fg.strokeStyle = v.edge;
      fg.globalAlpha = 0.8;
      const R1 = gear.ra + 8;
      const R2 = gear.ra + 16;
      fg.beginPath();
      fg.arc(gx, gy, R1, 0, TAU);
      fg.stroke();
      fg.globalAlpha = 0.55;
      const rot2 = -TAU * t;
      for (let i = 0; i < 4; i++) {
        fg.beginPath();
        fg.arc(gx, gy, R2, rot2 + (i * TAU) / 4, rot2 + (i * TAU) / 4 + 1.1);
        fg.stroke();
      }
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * TAU;
        const L = i % 10 === 0 ? 6 : 3;
        fg.beginPath();
        fg.moveTo(gx + Math.cos(a) * R1, gy + Math.sin(a) * R1);
        fg.lineTo(gx + Math.cos(a) * (R1 + L), gy + Math.sin(a) * (R1 + L));
        fg.stroke();
      }
      // angular frame
      fg.globalAlpha = 0.85;
      fg.strokeStyle = v.edge;
      fg.lineWidth = 1.3;
      const frameP = [
        [gx - 92, gy - 228], [gx + 108, gy - 228], [gx + 178, gy - 118], [gx + 198, gy + 2],
        [gx + 178, gy + 112], [gx + 108, gy + 197], [gx - 92, gy + 197], [gx - 178, gy + 112],
        [gx - 198, gy + 2], [gx - 178, gy - 118],
      ];
      fg.beginPath();
      frameP.forEach(([px, py], i) => (i ? fg.lineTo(px, py) : fg.moveTo(px, py)));
      fg.closePath();
      fg.stroke();
      fg.globalAlpha = 0.4;
      fg.beginPath();
      fg.arc(gx, gy, 226, 0, TAU);
      fg.stroke();
      fg.lineWidth = 1;
      fg.globalAlpha = 1;
      fg.fillStyle = v.hot;
      for (const [px, py] of [[gx + 55, gy - 240], [gx + 183, gy - 116], [gx + 33, gy + 197], [gx - 198, gy + 2]]) {
        fg.beginPath();
        fg.arc(px, py, 4.5, 0, TAU);
        fg.fill();
      }
      const FR = 210;
      // readout
      const pct = Math.round(21 + 57 * (0.5 - 0.5 * Math.cos(TAU * t)));
      fg.globalAlpha = 1;
      fg.fillStyle = v.hot;
      fg.textAlign = "right";
      fg.textBaseline = "alphabetic";
      fg.font = `500 40px ${INTER}`;
      fg.fillText(`${pct}`, gx + 40, gy - 106);
      fg.font = `500 24px ${INTER}`;
      fg.textAlign = "left";
      fg.fillText("%", gx + 42, gy - 107);
      fg.font = `500 9px ${MONO}`;
      fg.fillText("LOAD", gx + 74, gy - 108);
      fg.globalAlpha = 0.7;
      fg.font = `400 7px ${MONO}`;
      for (let i = 0; i < 3; i++) fg.fillText(["vector.load_avg", "sync: 0x3F_ok", "system initialized"][i], gx - 10, gy - 84 + i * 10);
      // scale bar under the gauge
      fg.globalAlpha = 0.6;
      fg.strokeStyle = v.edge;
      fg.beginPath();
      fg.moveTo(gx - 130, gy + FR + 24);
      fg.lineTo(gx + 130, gy + FR + 24);
      for (let i = 0; i <= 10; i++) {
        fg.moveTo(gx - 130 + i * 26, gy + FR + 24);
        fg.lineTo(gx - 130 + i * 26, gy + FR + (i % 5 === 0 ? 16 : 20));
      }
      fg.moveTo(gx - 60, gy + FR + 54);
      fg.lineTo(gx + 80, gy + FR + 54);
      fg.stroke();
      fg.beginPath();
      fg.moveTo(gx + 4, gy + FR + 46);
      fg.lineTo(gx + 14, gy + FR + 46);
      fg.lineTo(gx + 9, gy + FR + 52);
      fg.closePath();
      fg.fillStyle = v.hot;
      fg.fill();
      fg.globalAlpha = 1;

      addGlow(main, fg.canvas, 10 * k, 0.8, "gw-glow2");
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.drawImage(fg.canvas, 0, 0);
      main.restore();
    },
    [v],
  );
  return <CanvasStage draw={draw} post={{ grain: v.grain }} loopFrames={LOOP} />;
};
