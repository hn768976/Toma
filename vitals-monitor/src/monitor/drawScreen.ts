// Canvas 2D painter for the patient-monitor screen. The result is uploaded as a
// texture and projected through the WebGL2 camera (see renderer.ts).

import { fbm1, hash1, noise1 } from "./random";
import {
  ALARM_BOTTOM,
  ALARM_MID,
  ALARM_TOP,
  BOTTOM_READOUT,
  MID_READOUT,
  TOP_READOUT,
  Readout,
  readoutAt,
} from "./timeline";

export const SCREEN_W = 5120;
export const SCREEN_H = 2880;

// Waveform area and right-hand numeric panel.
const WAVE_X0 = 60;
const WAVE_X1 = 3880;
const PANEL_X = 3960;

export const COLORS = {
  bg: "#061a1d",
  grid: "rgba(110, 170, 165, 0.075)",
  gridMajor: "rgba(110, 170, 165, 0.13)",
  divider: "rgba(90, 150, 145, 0.35)",
  green: "#5fcf9a",
  cyan: "#a8f2ee",
  sand: "#e3d394",
  red: "#ff3b22",
  label: "rgba(150, 200, 195, 0.75)",
  dim: "rgba(110, 165, 160, 0.45)",
};

type Channel = {
  y: number;
  amp: number;
  color: string;
  width: number;
  seed: number;
  period: number; // sweep period in seconds
  phase: number; // sweep start offset (0..1)
  readout: Readout[];
  alarmAt: number;
  numColor: string;
  label: string;
  unit: string;
};

const CHANNELS: Channel[] = [
  {
    y: 470,
    amp: 13,
    color: COLORS.green,
    width: 5,
    seed: 1,
    period: 5.6,
    phase: 0.42,
    readout: TOP_READOUT,
    alarmAt: ALARM_TOP,
    numColor: COLORS.green,
    label: "PR",
    unit: "bpm",
  },
  {
    y: 1330,
    amp: 17,
    color: COLORS.cyan,
    width: 5.5,
    seed: 2,
    period: 5.2,
    phase: 0.25,
    readout: MID_READOUT,
    alarmAt: ALARM_MID,
    numColor: COLORS.cyan,
    label: "Mean",
    unit: "mmHg",
  },
  {
    y: 2190,
    amp: 11,
    color: COLORS.sand,
    width: 4.5,
    seed: 3,
    period: 6.1,
    phase: 0.86,
    readout: BOTTOM_READOUT,
    alarmAt: ALARM_BOTTOM,
    numColor: COLORS.sand,
    label: "SpO₂",
    unit: "%",
  },
];

const DOT_ROWS = [905, 1765, 2610];

export const FONT_NUM = "MonitorNum";
export const FONT_MONO = "MonitorMono";

let staticLayer: HTMLCanvasElement | null = null;

const drawStatic = (): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = SCREEN_W;
  c.height = SCREEN_H;
  const g = c.getContext("2d")!;
  g.fillStyle = COLORS.bg;
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Subtle panel glow so the screen is not perfectly flat.
  const rg = g.createRadialGradient(
    SCREEN_W * 0.55,
    SCREEN_H * 0.45,
    100,
    SCREEN_W * 0.55,
    SCREEN_H * 0.45,
    SCREEN_W * 0.75,
  );
  rg.addColorStop(0, "rgba(40, 90, 90, 0.18)");
  rg.addColorStop(1, "rgba(0, 0, 0, 0.25)");
  g.fillStyle = rg;
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Fine LCD grid + major grid.
  g.lineWidth = 2;
  g.strokeStyle = COLORS.grid;
  g.beginPath();
  for (let x = 0; x < WAVE_X1; x += 40) {
    g.moveTo(x, 0);
    g.lineTo(x, SCREEN_H);
  }
  for (let y = 0; y < SCREEN_H; y += 40) {
    g.moveTo(0, y);
    g.lineTo(WAVE_X1, y);
  }
  g.stroke();
  g.strokeStyle = COLORS.gridMajor;
  g.lineWidth = 3;
  g.beginPath();
  for (let x = 0; x < WAVE_X1; x += 200) {
    g.moveTo(x, 0);
    g.lineTo(x, SCREEN_H);
  }
  g.stroke();

  // Panel divider + panel background.
  g.fillStyle = COLORS.divider;
  g.fillRect(PANEL_X - 4, 0, 6, SCREEN_H);
  for (const y of [880, 1740, 2600]) {
    g.fillStyle = "rgba(90, 150, 145, 0.18)";
    g.fillRect(PANEL_X, y, SCREEN_W - PANEL_X, 4);
  }

  // Thin baselines under the dotted rows.
  for (const y of DOT_ROWS) {
    g.strokeStyle = "rgba(120, 190, 185, 0.22)";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(WAVE_X0, y + 70);
    g.lineTo(WAVE_X1 - 40, y + 70);
    g.stroke();
  }
  return c;
};

const traceValue = (ch: Channel, tw: number) => {
  // Low amplitude, jittery waveform with a slow wandering baseline.
  const fast =
    noise1(tw * 60, ch.seed) * 0.5 + noise1(tw * 140, ch.seed + 5) * 0.4;
  const beat = Math.pow(Math.max(0, Math.sin(tw * 7.4 + ch.seed)), 18) * 0.9;
  const slow = fbm1(tw * 0.6, ch.seed + 11) * 2.2;
  return (fast + beat) * ch.amp + slow * ch.amp * 0.6;
};

const drawTrace = (g: CanvasRenderingContext2D, ch: Channel, t: number) => {
  const span = WAVE_X1 - 140 - WAVE_X0;
  const n = 2600;
  const gap = 0.055;
  const cursor = (t / ch.period + ch.phase) % 1;

  const pts: Array<[number, number] | null> = [];
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    let d = cursor - p;
    d -= Math.floor(d);
    if (d > 1 - gap) {
      pts.push(null);
      continue;
    }
    // Time at which the sweep last wrote position p (constant until rewritten).
    const tw = t - d * ch.period;
    const x = WAVE_X0 + p * span;
    pts.push([x, ch.y - traceValue(ch, tw)]);
  }

  const stroke = (width: number, alpha: number, color: string) => {
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineJoin = "round";
    g.lineCap = "round";
    g.beginPath();
    let pen = false;
    for (const pt of pts) {
      if (!pt) {
        pen = false;
        continue;
      }
      if (!pen) g.moveTo(pt[0], pt[1]);
      else g.lineTo(pt[0], pt[1]);
      pen = true;
    }
    g.stroke();
  };
  stroke(ch.width * 3, 0.08, ch.color);
  stroke(ch.width * 1.7, 0.25, ch.color);
  stroke(ch.width, 0.95, ch.color);
  stroke(ch.width * 0.45, 0.8, "#ffffff");
  g.globalAlpha = 1;
};

const drawDotRow = (
  g: CanvasRenderingContext2D,
  y: number,
  idx: number,
  t: number,
) => {
  const alarm = t > ALARM_TOP + idx * 1.2;
  for (let x = WAVE_X0 + 30, i = 0; x < WAVE_X1 - 120; x += 46, i++) {
    const h = hash1(i * 3.1 + idx * 17);
    const red = alarm && h > 0.86;
    g.fillStyle = red ? "rgba(255, 70, 50, 0.7)" : "rgba(130, 200, 195, 0.62)";
    g.fillRect(x, y - 18, 7, 36);
  }
};

const drawPanel = (g: CanvasRenderingContext2D, t: number) => {
  CHANNELS.forEach((ch, idx) => {
    const r = readoutAt(ch.readout, t);
    const alarm = t >= ch.alarmAt;
    const nx = PANEL_X + 120;
    // Small channel label + unit stack, left of the big number.
    g.font = `500 64px ${FONT_NUM}`;
    g.textBaseline = "alphabetic";
    g.fillStyle = alarm ? "rgba(255, 90, 70, 0.85)" : COLORS.label;
    g.fillText(ch.label, nx, ch.y - 170);
    g.font = `40px ${FONT_MONO}`;
    g.fillStyle = COLORS.dim;
    g.fillText(ch.unit, nx, ch.y - 120);
    for (let i = 0; i < 3; i++) {
      g.fillRect(nx + 6, ch.y - 60 + i * 34, 10 + i * 14, 8);
    }

    if (r.value !== null) {
      const color = r.alarm ? COLORS.red : ch.numColor;
      g.font = `600 520px ${FONT_NUM}`;
      g.textAlign = "right";
      g.textBaseline = "middle";
      g.shadowColor = color;
      g.shadowBlur = 70;
      g.fillStyle = color;
      g.fillText(r.value, PANEL_X + 640, ch.y + 30);
      g.shadowBlur = 0;
      g.textAlign = "left";
    }

    // Secondary parameter block to the right of the number.
    const bx = PANEL_X + 720;
    g.font = `44px ${FONT_MONO}`;
    g.textBaseline = "alphabetic";
    const lines = [
      ["ST-II", (0.1 + idx * 0.1).toFixed(1)],
      ["PVC", "0"],
      ["SYS", `${118 - idx * 9}`],
      ["DIA", `${76 - idx * 4}`],
    ];
    lines.forEach(([a, b], li) => {
      const y = ch.y - 200 + li * 92;
      g.fillStyle = COLORS.dim;
      g.fillText(a, bx, y);
      g.fillStyle = alarm && li === 0 ? "rgba(255, 80, 60, 0.8)" : COLORS.label;
      g.fillText(b, bx + 200, y);
    });
    // Mini bar graph; turns into red dashes once the alarm latches.
    for (let i = 0; i < 6; i++) {
      const h = 18 + noise1(i * 0.9 + t * 0.4, idx) * 10 + 14;
      g.fillStyle = alarm
        ? "rgba(255, 70, 50, 0.65)"
        : "rgba(110, 200, 190, 0.5)";
      g.fillRect(bx + i * 46, ch.y + 230 - h, 30, h);
    }
    g.fillStyle = "rgba(120, 190, 185, 0.45)";
    g.font = `140px ${FONT_NUM}`;
    g.fillText(idx === 2 ? "A" : "↕", bx + 300, ch.y + 230);
  });
};

const drawLabels = (g: CanvasRenderingContext2D, t: number) => {
  g.font = `500 78px ${FONT_NUM}`;
  g.textBaseline = "middle";
  const roomAlarm = t >= ALARM_MID;
  g.fillStyle = roomAlarm ? "rgba(255, 70, 50, 0.9)" : COLORS.label;
  g.fillText("Room 4", WAVE_X0, 1060);
  g.fillStyle = COLORS.label;
  g.fillText("II", WAVE_X0 + 40, 300);
  g.font = `52px ${FONT_MONO}`;
  g.fillStyle = COLORS.dim;
  g.fillText("x1  25mm/s", WAVE_X0 + 40, 2030);
  // Top status strip.
  g.fillStyle = "rgba(120, 190, 185, 0.4)";
  g.font = `46px ${FONT_MONO}`;
  g.fillText("ADULT   BED 04   ICU-2", WAVE_X0 + 40, 70);
};

export const drawScreen = (g: CanvasRenderingContext2D, t: number) => {
  if (!staticLayer) staticLayer = drawStatic();
  g.globalAlpha = 1;
  g.drawImage(staticLayer, 0, 0);
  DOT_ROWS.forEach((y, i) => drawDotRow(g, y, i, t));
  drawLabels(g, t);
  for (const ch of CHANNELS) drawTrace(g, ch, t);
  drawPanel(g, t);
};
