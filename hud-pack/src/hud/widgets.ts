import { MONO, SANS } from "../lib/assets";
import { Rng, TAU } from "../lib/random";

// HUD widget atlas. Channels are masks so a colourway only changes uniforms:
//   R = main line art (widget colour), G = accent (accent colour), B = dim fill.
export const CELL = 1024;
export const GRID = 4; // 4x4 cells
export const MAIN = "rgb(255,0,0)";
export const ACC = "rgb(0,255,0)";
export const FILL = "rgb(0,0,255)";

export const WIDGETS = [
  "reticle", "percent", "radar", "lineChart",
  "hex", "dataPanel", "timeline", "coin",
  "bars", "codeDoc", "ringDots", "ghostText",
  "network", "sliders", "arcGauge", "brackets",
] as const;
export type WidgetKind = (typeof WIDGETS)[number];

type C = CanvasRenderingContext2D;

const circle = (c: C, x: number, y: number, r: number, a0 = 0, a1 = TAU) => {
  c.beginPath();
  c.arc(x, y, r, a0, a1);
  c.stroke();
};
const dot = (c: C, x: number, y: number, r: number) => {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
};

export const drawWidget = (c: C, kind: WidgetKind, rng: Rng) => {
  const S = CELL;
  const m = S / 2;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = MAIN;
  c.fillStyle = MAIN;
  switch (kind) {
    case "reticle": {
      c.lineWidth = 6;
      circle(c, m, m, 300);
      c.lineWidth = 3;
      for (let i = 0; i < 6; i++) circle(c, m, m, 360, i * TAU / 6 + 0.1, i * TAU / 6 + 0.7);
      c.lineWidth = 14;
      c.strokeStyle = ACC;
      circle(c, m, m, 250, 0.3, 1.6);
      c.strokeStyle = MAIN;
      c.lineWidth = 3;
      circle(c, m, m, 120);
      c.fillStyle = MAIN;
      dot(c, m, m, 40);
      // small molecule-like node graph inside
      const pts = Array.from({ length: 5 }, () => [m + (rng() - 0.5) * 180, m + (rng() - 0.5) * 180]);
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
      break;
    }
    case "percent": {
      c.lineWidth = 8;
      circle(c, m, m, 330);
      c.lineWidth = 3;
      circle(c, m, m, 370, -0.4, 2.2);
      c.fillStyle = FILL;
      c.beginPath();
      c.arc(m, m, 326, 0, TAU);
      c.fill();
      break; // the number itself is a live readout on top
    }
    case "radar": {
      c.lineWidth = 3;
      circle(c, m, m + 40, 400);
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(m, m - 300);
      c.lineTo(m + 330, m + 260);
      c.lineTo(m - 330, m + 260);
      c.closePath();
      c.stroke();
      // hatching inside a smaller triangle
      c.save();
      c.beginPath();
      c.moveTo(m, m - 140);
      c.lineTo(m + 190, m + 200);
      c.lineTo(m - 190, m + 200);
      c.closePath();
      c.clip();
      c.lineWidth = 6;
      c.strokeStyle = MAIN;
      for (let i = -12; i < 12; i++) {
        c.beginPath();
        c.moveTo(m + i * 40, m + 260);
        c.lineTo(m + i * 40 + 300, m - 200);
        c.stroke();
      }
      c.restore();
      c.fillStyle = MAIN;
      [[m, m - 300], [m + 330, m + 260], [m - 330, m + 260]].forEach(([x, y]) => dot(c, x, y, 14));
      break;
    }
    case "lineChart": {
      c.lineWidth = 2;
      c.strokeStyle = MAIN;
      c.beginPath();
      c.moveTo(60, 760);
      c.lineTo(S - 60, 760);
      c.stroke();
      const ys: number[] = [];
      for (let i = 0; i <= 40; i++) ys.push(700 - Math.pow(rng(), 2) * 260 - (i === 14 ? 300 : 0) - Math.sin(i * 0.3) * 60);
      c.beginPath();
      c.moveTo(60, 760);
      ys.forEach((y, i) => c.lineTo(60 + i * ((S - 120) / 40), y));
      c.lineTo(S - 60, 760);
      c.closePath();
      c.fillStyle = FILL;
      c.fill();
      c.lineWidth = 5;
      c.beginPath();
      ys.forEach((y, i) => (i ? c.lineTo(60 + i * ((S - 120) / 40), y) : c.moveTo(60, y)));
      c.stroke();
      c.fillStyle = ACC;
      dot(c, 60 + 14 * ((S - 120) / 40), ys[14], 12);
      break;
    }
    case "hex": {
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(20, 20);
      c.lineTo(S - 20, 20);
      c.moveTo(20, S - 40);
      c.lineTo(S - 160, S - 40);
      c.lineTo(S - 60, S - 120);
      c.stroke();
      // dense rows of slanted digits
      c.save();
      c.transform(1, 0, -0.18, 1, 60, 0);
      c.font = `400 34px "${MONO}"`;
      c.fillStyle = MAIN;
      for (let r = 0; r < 18; r++) {
        let s = "";
        for (let k = 0; k < 44; k++) s += "0123456789"[Math.floor(rng() * 10)];
        c.globalAlpha = 0.6 + rng() * 0.4;
        c.fillText(s, 30, 80 + r * 50);
      }
      c.restore();
      c.globalAlpha = 1;
      break;
    }
    case "dataPanel": {
      c.font = `600 64px "${SANS}"`;
      c.fillStyle = MAIN;
      c.fillText("DATA", 70, 230);
      c.lineWidth = 4;
      c.strokeRect(70, 290, 880, 120);
      c.strokeRect(70, 450, 880, 120);
      c.fillStyle = FILL;
      c.fillRect(72, 452, 876, 116);
      c.strokeStyle = MAIN;
      c.strokeRect(70, 610, 880, 120);
      c.font = `600 48px "${SANS}"`;
      c.fillStyle = MAIN;
      c.fillText("OK", 470, 690);
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(70, 170);
      c.lineTo(950, 170);
      c.stroke();
      break;
    }
    case "timeline": {
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(20, m);
      c.lineTo(S - 20, m);
      c.stroke();
      c.font = `500 34px "${MONO}"`;
      for (let i = 0; i < 4; i++) {
        const x = 90 + i * 270;
        c.fillStyle = i === 1 ? ACC : MAIN;
        dot(c, x, m, 26);
        c.lineWidth = 3;
        c.strokeStyle = MAIN;
        circle(c, x, m, 46);
        c.fillStyle = MAIN;
        c.fillText(`0${i + 1} DOC 0${i + 1}`, x - 40, m + 110);
      }
      // a rounded bracket bar under the nodes
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(30, m + 170);
      c.lineTo(S - 120, m + 170);
      c.lineTo(S - 60, m + 230);
      c.lineTo(S - 60, m + 300);
      c.stroke();
      break;
    }
    case "coin": {
      // generic coin: a circle with a plain "$" (no currency or crypto brand marks)
      c.lineWidth = 10;
      circle(c, m, m, 260);
      c.lineWidth = 4;
      circle(c, m, m, 220);
      c.lineWidth = 3;
      circle(c, m, m, 330, 0.2, 2.6);
      circle(c, m, m, 330, 3.3, 5.9);
      c.font = `700 300px "${SANS}"`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = MAIN;
      c.fillText("$", m, m + 12);
      c.textAlign = "left";
      c.textBaseline = "alphabetic";
      break;
    }
    case "bars": {
      for (let i = 0; i < 18; i++) {
        const h = 60 + Math.pow(rng(), 1.5) * 480;
        c.fillStyle = i % 7 === 3 ? ACC : MAIN;
        c.fillRect(80 + i * 48, 760 - h, 22, h);
      }
      c.lineWidth = 3;
      c.strokeStyle = MAIN;
      c.beginPath();
      c.moveTo(60, 790);
      c.lineTo(S - 60, 790);
      c.stroke();
      break;
    }
    case "codeDoc": {
      c.lineWidth = 6;
      c.strokeRect(220, 300, 580, 420);
      c.beginPath();
      c.moveTo(220, 380);
      c.lineTo(800, 380);
      c.stroke();
      c.font = `700 150px "${MONO}"`;
      c.fillText("</>", 330, 620);
      c.fillStyle = FILL;
      c.fillRect(222, 302, 576, 76);
      break;
    }
    case "ringDots": {
      c.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const x = 220 + i * 290;
        circle(c, x, m, 110);
        c.fillStyle = i === 2 ? ACC : MAIN;
        dot(c, x, m, 34);
      }
      c.beginPath();
      c.moveTo(330, m);
      c.lineTo(400, m);
      c.moveTo(620, m);
      c.lineTo(690, m);
      c.stroke();
      break;
    }
    case "ghostText": {
      // a big translucent outline word (generic), as on large HUD backdrops
      c.font = `700 250px "${SANS}"`;
      c.lineWidth = 5;
      c.strokeStyle = FILL;
      c.textBaseline = "middle";
      c.strokeText("NET", 60, m - 150);
      c.strokeText("WORK", 60, m + 150);
      c.textBaseline = "alphabetic";
      break;
    }
    case "network": {
      const pts = Array.from({ length: 9 }, () => [120 + rng() * 780, 120 + rng() * 780]);
      c.lineWidth = 2;
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++)
          if (rng() < 0.3) {
            c.beginPath();
            c.moveTo(pts[i][0], pts[i][1]);
            c.lineTo(pts[j][0], pts[j][1]);
            c.stroke();
          }
      pts.forEach(([x, y], i) => {
        c.fillStyle = i % 4 === 0 ? ACC : MAIN;
        dot(c, x, y, 14);
      });
      break;
    }
    case "sliders": {
      for (let r = 0; r < 4; r++) {
        const y = 250 + r * 160;
        c.lineWidth = 4;
        c.strokeStyle = MAIN;
        c.beginPath();
        c.moveTo(100, y);
        c.lineTo(920, y);
        c.stroke();
        const x = 140 + rng() * 740;
        c.lineWidth = 12;
        c.strokeStyle = r === 1 ? ACC : MAIN;
        c.beginPath();
        c.moveTo(100, y);
        c.lineTo(x, y);
        c.stroke();
        c.fillStyle = MAIN;
        dot(c, x, y, 18);
      }
      break;
    }
    case "arcGauge": {
      c.lineWidth = 26;
      circle(c, m, m, 300, Math.PI * 0.8, Math.PI * 1.9);
      c.strokeStyle = ACC;
      circle(c, m, m, 300, Math.PI * 1.95, Math.PI * 2.2);
      c.strokeStyle = MAIN;
      c.lineWidth = 3;
      for (let i = 0; i <= 30; i++) {
        const a = Math.PI * 0.8 + (i / 30) * Math.PI * 1.4;
        c.beginPath();
        c.moveTo(m + Math.cos(a) * 340, m + Math.sin(a) * 340);
        c.lineTo(m + Math.cos(a) * (i % 5 ? 360 : 390), m + Math.sin(a) * (i % 5 ? 360 : 390));
        c.stroke();
      }
      break;
    }
    case "brackets": {
      c.lineWidth = 5;
      const k = 120;
      c.beginPath();
      c.moveTo(80, 80 + k);
      c.lineTo(80, 80);
      c.lineTo(80 + k, 80);
      c.moveTo(S - 80 - k, 80);
      c.lineTo(S - 80, 80);
      c.lineTo(S - 80, 80 + k);
      c.moveTo(S - 80, S - 80 - k);
      c.lineTo(S - 80, S - 80);
      c.lineTo(S - 80 - k, S - 80);
      c.moveTo(80 + k, S - 80);
      c.lineTo(80, S - 80);
      c.lineTo(80, S - 80 - k);
      c.stroke();
      c.font = `500 40px "${MONO}"`;
      c.fillText("SYS.ELEMENT 4F", 140, 200);
      c.lineWidth = 2;
      c.strokeRect(140, 260, 740, 500);
      c.fillStyle = FILL;
      c.fillRect(142, 262, 736, 496);
      break;
    }
  }
};
