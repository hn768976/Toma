import React, { useCallback } from "react";
import { CanvasStage } from "../../lib/CanvasStage";
import { MONO, SANS } from "../../lib/fonts";
import { LOOP_FRAMES, loopFrame } from "../../lib/loop";
import { HEX, hash01, hexString, int, mulberry32, pick } from "../../lib/random";

export interface HUDFrameProps {
  ink: string; // lines and text
  accent: string; // highlight bar
  background: string; // must stay pure black for Screen / Add
}

// ---------------------------------------------------------------------------
// Static content, generated once from a fixed seed. All text is invented.
// ---------------------------------------------------------------------------
const rng = mulberry32(0x5f3a91);

const IDENT = ["scan", "node", "trace", "link", "buf", "lvl", "grid", "seg", "chk", "idx", "rate", "sig", "gate", "pkt"];
const OPS = [">", "<", ">=", "!=", "=="];
const codeLine = (): string => {
  const a = pick(rng, IDENT);
  const b = pick(rng, IDENT);
  const n = int(rng, 0, 999);
  switch (int(rng, 0, 9)) {
    case 0:
      return `if (${a}_${int(rng, 1, 9)} ${pick(rng, OPS)} ${n}) {`;
    case 1:
      return `  ${a}.${b}(${int(rng, 0, 64)}, 0x${hexString(rng, 4)});`;
    case 2:
      return `}`;
    case 3:
      return `${a}_${b} = ${b}[${int(rng, 0, 31)}] + ${n};`;
    case 4:
      return `// ${a} ${b} ${hexString(rng, 6)}`;
    case 5:
      return `loop ${a} in 0..${int(rng, 8, 128)} {`;
    case 6:
      return `  emit(${a}, "${b.toUpperCase()}_${int(rng, 10, 99)}");`;
    case 7:
      return `${a}.set(${(rng() * 9).toFixed(2)}f);`;
    case 8:
      return `  wait(${int(rng, 1, 40)}ms); ${b}++;`;
    default:
      return `ret ${a} | ${b} << ${int(rng, 1, 8)};`;
  }
};
// 40 lines typed over exactly one loop -> 15 frames per line, seamless.
const CODE: string[] = Array.from({ length: 40 }, codeLine);
const CODE_FRAMES_PER_LINE = LOOP_FRAMES / CODE.length;

const HEXBLOCK: string[] = Array.from({ length: 15 }, () => hexString(rng, 38));

const LIST_ROWS = [
  "PASS_LOGIN",
  "KW = KPD-CT8902",
  "PH = GPR-CT9751",
  "PR = SPF-KU8379",
  "PK = PTR-CT6874",
  "RT = FNC-CT4430",
];

const STATUS = ["#0001 <pas> 0", "#0002 <pas> 1", "#0003 <qso> 0", "Accolum <tmq>"];

const TINY_ROWS = 22;

// ---------------------------------------------------------------------------
// Drawing helpers in 1280x720 design units. Coordinates on .5 keep 1-unit lines
// crisp at any integer scale (720p, 1440p, 2160p).
// ---------------------------------------------------------------------------
type Ctx = CanvasRenderingContext2D;

const line = (c: Ctx, x1: number, y1: number, x2: number, y2: number) => {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
};

const rect = (c: Ctx, x: number, y: number, w: number, h: number) => c.strokeRect(x + 0.5, y + 0.5, w, h);

const roundRect = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.roundRect(x + 0.5, y + 0.5, w, h, r);
  c.stroke();
};

const circle = (c: Ctx, x: number, y: number, r: number, fill = false) => {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  if (fill) c.fill();
  else c.stroke();
};

const text = (c: Ctx, s: string, x: number, y: number, size: number, family = MONO, weight = 400, align: CanvasTextAlign = "left") => {
  c.font = `${weight} ${size}px "${family}"`;
  c.textAlign = align;
  c.fillText(s, x, y);
};

// a few generic pictogram icons
const icon = (c: Ctx, kind: number, x: number, y: number, s: number) => {
  const h = s / 2;
  switch (kind % 6) {
    case 0:
      circle(c, x, y, h);
      circle(c, x, y, h * 0.35, true);
      break;
    case 1:
      rect(c, x - h, y - h, s, s);
      break;
    case 2:
      rect(c, x - h, y - h, s * 0.6, s * 0.6);
      rect(c, x - h + s * 0.4, y - h + s * 0.4, s * 0.6, s * 0.6);
      break;
    case 3:
      for (let i = 0; i < 3; i++) line(c, x - h, y - h + 1.5 + i * (s / 3), x + h, y - h + 1.5 + i * (s / 3));
      break;
    case 4:
      circle(c, x, y, h);
      line(c, x - h * 0.6, y, x + h * 0.6, y);
      line(c, x, y - h * 0.6, x, y + h * 0.6);
      break;
    default:
      c.beginPath();
      c.moveTo(x, y - h);
      c.lineTo(x + h, y + h);
      c.lineTo(x - h, y + h);
      c.closePath();
      c.stroke();
  }
};

const ticksH = (c: Ctx, x1: number, x2: number, y: number, step: number, len: number, majorEvery = 5) => {
  line(c, x1, y, x2, y);
  let i = 0;
  for (let x = x1; x <= x2 + 0.01; x += step, i++) {
    const l = i % majorEvery === 0 ? len * 2 : len;
    line(c, x, y, x, y - l);
  }
};

const ticksV = (c: Ctx, x: number, y1: number, y2: number, step: number, len: number, majorEvery = 5) => {
  line(c, x, y1, x, y2);
  let i = 0;
  for (let y = y1; y <= y2 + 0.01; y += step, i++) {
    const l = i % majorEvery === 0 ? len * 2 : len;
    line(c, x, y, x + l, y);
  }
};

const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

// ---------------------------------------------------------------------------

export const drawHUDFrame = (c: Ctx, frameIn: number, W: number, H: number, p: HUDFrameProps) => {
  const f = loopFrame(frameIn);
  const t = f / LOOP_FRAMES;
  const u = H / 720;

  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.fillStyle = p.background;
  c.fillRect(0, 0, W, H);
  c.setTransform(u, 0, 0, u, 0, 0);
  c.lineWidth = 1;
  c.strokeStyle = p.ink;
  c.fillStyle = p.ink;
  // the reference HUD is quiet: thin grey-white rather than full white
  c.globalAlpha = 0.84;
  c.textBaseline = "alphabetic";
  c.lineCap = "butt";

  // ======================= TOP-LEFT BAR =======================
  {
    // long double bar with a slider notch
    rect(c, 25, 40, 120, 6);
    line(c, 25.5, 49.5, 145.5, 49.5);
    c.fillRect(26 + 100 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t)), 41.5, 14, 4);
    line(c, 78.5, 49.5, 78.5, 58.5);
    rect(c, 150, 42, 16, 8);
    line(c, 158.5, 50.5, 158.5, 62.5);
    // striped boxes
    for (let i = 0; i < 2; i++) {
      rect(c, 172 + i * 14, 42 + i * 4, 10, 6);
      line(c, 177.5 + i * 14, 52.5, 177.5 + i * 14, 70.5);
    }
    rect(c, 208, 38, 36, 16);
    for (let k = 0; k < 8; k++) line(c, 212.5 + k * 4, 41.5, 212.5 + k * 4, 51.5);
    c.fillRect(250, 39, 23, 8); // filled label boxes
    c.fillRect(280, 39, 29, 8);
    line(c, 261.5, 46.5, 261.5, 76.5);
    rect(c, 278, 40, 30, 6);
    circle(c, 330.5, 47.5, 10);
    circle(c, 330.5, 47.5, 5);
    for (let k = 0; k < 3; k++) rect(c, 348, 40 + k * 6, 14, 3);
    rect(c, 366, 40, 10, 18);
    rect(c, 380, 40, 14, 10);
    line(c, 382.5, 53.5, 394.5, 53.5);
  }
  // marker + label
  c.beginPath();
  c.moveTo(29, 74);
  c.lineTo(33, 67);
  c.lineTo(37, 74);
  c.closePath();
  c.fill();
  text(c, String(26280 + Math.floor(f / 30) * 7), 41, 74, 7, MONO, 500);

  // ======================= LEFT EDGE =======================
  // icon rail
  {
    const ys = [100, 128, 160, 196, 232, 262, 300, 336, 370, 404, 440, 476, 512];
    ys.forEach((y, i) => {
      if (i % 4 === 0) {
        rect(c, 25, y - 6, 18, 12);
        for (let k = 0; k < 3; k++) line(c, 28.5 + k * 5, y - 3.5, 28.5 + k * 5, y + 3.5);
      } else if (i % 4 === 1) {
        circle(c, 34.5, y + 0.5, 8);
        circle(c, 34.5, y + 0.5, 3.5);
      } else if (i % 4 === 2) {
        for (let k = 0; k < 4; k++) rect(c, 26, y - 8 + k * 5, 16, 3);
      } else {
        rect(c, 27, y - 8, 6, 16);
        rect(c, 36, y - 8, 6, 16);
        const lv = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t * 3) + i));
        c.fillRect(37.5, y + 8 - 15 * lv, 4, 15 * lv);
      }
    });
    for (let i = 0; i < 3; i++) {
      circle(c, 34.5, 580.5 + i * 26, 10);
      circle(c, 34.5, 580.5 + i * 26, 5);
    }
    // long rounded bar outlines
    roundRect(c, 46, 345, 6, 176, 3);
    roundRect(c, 46, 120, 6, 90, 3);
    // tall scrollbar pill with a thumb that travels once per loop
    roundRect(c, 62, 86, 5, 454, 2.5);
    const sy = 90 + 380 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t));
    c.beginPath();
    c.roundRect(63, sy, 3.5, 64, 1.75);
    c.fill();
    // vertical rail with bracket ticks
    line(c, 56.5, 92.5, 56.5, 545.5);
    for (let y = 100; y < 540; y += 36) line(c, 53.5, y + 0.5, 56.5, y + 0.5);
  }

  // pseudo-code block: one line every 15 frames, 40 lines per loop, scrolls
  {
    const x = 74;
    const y0 = 96;
    const lh = 10.2;
    const visible = 26;
    const pos = f / CODE_FRAMES_PER_LINE;
    const cur = Math.floor(pos);
    const frac = pos - cur;
    for (let k = 0; k < visible; k++) {
      const li = cur - (visible - 1) + k;
      const s = CODE[((li % CODE.length) + CODE.length) % CODE.length];
      const shown = k === visible - 1 ? s.slice(0, Math.floor(s.length * Math.min(1, frac * 1.6))) : s;
      text(c, shown, x, y0 + k * lh, 6.8);
      if (k === visible - 1 && Math.floor(f / 8) % 2 === 0) {
        c.font = `400 6.8px "${MONO}"`;
        const wpx = c.measureText(shown).width;
        c.fillRect(x + wpx + 1, y0 + k * lh - 6, 3.5, 7);
      }
    }
  }
  // small label list + rule
  for (let i = 0; i < 4; i++) text(c, `NODE 0${i + 4}   ${LIST_ROWS[i + 1].slice(5)}`, 74, 372 + i * 7.5, 5.2, MONO, 500);
  line(c, 74.5, 404.5, 200.5, 404.5);
  line(c, 200.5, 404.5, 206.5, 398.5);

  // dense hex block, characters rolling every 6 frames
  {
    const step = Math.floor(f / 6);
    for (let r = 0; r < HEXBLOCK.length; r++) {
      let s = HEXBLOCK[r];
      const j = Math.floor(hash01(r, step, 11) * s.length);
      const j2 = Math.floor(hash01(r, step, 23) * s.length);
      s = s.slice(0, j) + HEX[Math.floor(hash01(r, step, 3) * 16)] + s.slice(j + 1);
      s = s.slice(0, j2) + HEX[Math.floor(hash01(r, step, 5) * 16)] + s.slice(j2 + 1);
      text(c, s, 74, 424 + r * 7.6, 5.2, MONO, 400);
    }
  }

  // counter box: 289 -> 114 over the first half, back up over the second
  {
    const k = t < 0.5 ? ease(t * 2) : 1 - ease((t - 0.5) * 2);
    const value = Math.round(289 - (289 - 114) * k);
    // chamfered box
    c.beginPath();
    c.moveTo(80.5, 548.5);
    c.lineTo(142.5, 548.5);
    c.lineTo(150.5, 556.5);
    c.lineTo(150.5, 576.5);
    c.lineTo(142.5, 584.5);
    c.lineTo(80.5, 584.5);
    c.closePath();
    c.stroke();
    text(c, "TOTAL", 84, 546, 5.5, SANS, 500);
    text(c, String(value), 115, 575, 19, SANS, 400, "center");
    line(c, 82.5, 590.5, 82.5, 652.5);
    for (let i = 0; i < 4; i++) {
      const y = 600.5 + i * 13;
      line(c, 82.5, y, 92.5 + 40 * hash01(i, 3), y);
    }
    text(c, `${Math.round(value * 0.86)}°`, 140, 604, 6, SANS, 500);
    text(c, `${Math.round(value * 0.43)}°`, 140, 626, 6, SANS, 500);
    const pct = Math.round((value / 289) * 100);
    rect(c, 100, 634, 36, 16);
    text(c, `${pct}%`, 118, 646, 9, SANS, 500, "center");
  }

  // ======================= RIGHT EDGE =======================
  // outer icon rail
  {
    for (let i = 0; i < 3; i++) {
      circle(c, 1243.5, 86.5 + i * 30, 11);
      circle(c, 1243.5, 86.5 + i * 30, 6);
    }
    const ys = [190, 222, 254, 290, 330, 370, 410, 452, 494, 536, 580];
    ys.forEach((y, i) => {
      if (i % 3 === 0) {
        rect(c, 1234, y - 7, 18, 14);
        for (let k = 0; k < 3; k++) line(c, 1237.5 + k * 5, y - 4.5, 1237.5 + k * 5, y + 4.5);
      } else if (i % 3 === 1) {
        rect(c, 1236, y - 6, 14, 12);
        const on = Math.floor(f / 25 + i) % 3 !== 0;
        if (on) c.fillRect(1238.5, y - 3.5, 9, 7);
      } else {
        for (let k = 0; k < 3; k++) rect(c, 1235, y - 7 + k * 5, 16, 3);
      }
    });
    rect(c, 1232, 620, 20, 14);
    for (let k = 0; k < 3; k++) line(c, 1236.5 + k * 5, 623.5, 1236.5 + k * 5, 630.5);
    rect(c, 1232, 650, 20, 12);
  }
  // inner rail with node ticks
  {
    line(c, 1132.5, 80.5, 1132.5, 640.5);
    for (let i = 0; i < 16; i++) {
      const y = 92.5 + i * 34;
      line(c, 1112.5, y, 1132.5, y);
      c.fillRect(1110, y - 2.5, 5, 5);
      // pins on both sides of the rail
      line(c, 1220.5, y, 1228.5, y);
      c.fillRect(1218, y - 2, 4, 4);
      if (i % 3 === 0) rect(c, 1118, y + 6, 8, 12);
    }
    const gy = 92 + 520 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t * 2));
    c.fillRect(1130, gy, 6, 14);
  }
  // header + list with stepping highlight (12 steps per loop, 6 rows)
  {
    const x = 1146;
    text(c, "Accolum <tmq>", x + 8, 90, 7.5, MONO, 500);
    rect(c, 1120, 64, 18, 8);
    line(c, 1120.5, 38.5, 1228.5, 38.5);
    line(c, 1120.5, 50.5, 1228.5, 50.5);
    const y0 = 122;
    const lh = 12;
    const hi = Math.floor(f / 50) % LIST_ROWS.length;
    for (let i = 0; i < LIST_ROWS.length; i++) {
      const y = y0 + i * lh;
      if (i === hi) {
        c.fillStyle = p.accent;
        c.globalAlpha = 0.62;
        c.fillRect(x - 2, y - 8.5, 84, 11);
        c.globalAlpha = 0.84;
        c.fillStyle = p.background;
        text(c, LIST_ROWS[i], x, y, 7.4, MONO, 500);
        c.fillStyle = p.ink;
      } else {
        text(c, LIST_ROWS[i], x, y, 7.4, MONO, 400);
      }
    }
  }
  // status lines
  for (let i = 0; i < 3; i++) {
    const y = 210 + i * 13;
    text(c, STATUS[i], 1150, y, 7.5, MONO);
    c.beginPath();
    c.arc(1144, y - 2.5, 2, 0, Math.PI * 2);
    c.fill();
    text(c, Math.floor(f / 20 + i * 3) % 4 !== 0 ? "D" : "", 1218, y, 7, MONO, 700);
  }
  // percentage readouts in dashed boxes
  {
    const vals = [
      Math.round(42 + 4 * Math.sin(2 * Math.PI * t * 2)),
      Math.round(36 + 3 * Math.sin(2 * Math.PI * t * 3 + 1)),
      Math.round(30 + 5 * Math.sin(2 * Math.PI * t + 2)),
    ];
    c.setLineDash([2, 2]);
    c.globalAlpha = 0.4;
    for (let i = 0; i < 3; i++) {
      const y = 262 + i * 36;
      rect(c, 1166, y, 32, 18);
      line(c, 1182.5, y + 18.5, 1182.5, y + 30.5);
    }
    c.setLineDash([]);
    c.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) text(c, `${vals[i]}%`, 1182, 274 + i * 36, 8, SANS, 500, "center");
  }
  c.globalAlpha = 0.84;
  // narrow tall panel of tiny text
  {
    const x = 1146;
    const y = 384;
    rect(c, x, y, 68, 218);
    line(c, x + 0.5, y + 14.5, x + 68.5, y + 14.5);
    text(c, "SEQ  7A", x + 4, y + 10, 6, SANS, 500);
    const step = Math.floor(f / 10);
    for (let r = 0; r < TINY_ROWS; r++) {
      const n = 6 + Math.floor(hash01(r, 99) * 9);
      let s = "";
      for (let k = 0; k < n; k++) s += HEX[Math.floor(hash01(r, k, step % 60, 5) * 16)];
      text(c, s, x + 4, y + 23 + r * 8.6, 5.4);
    }
    rect(c, x + 54, y + 196, 10, 16);
  }
  // tall box on the far right + bar ruler under the tiny-text panel
  rect(c, 1256, 60, 14, 320);
  for (let i = 0; i < 9; i++) c.fillRect(1259, 70 + i * 34, 8, 12 + 10 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t + i)));
  for (let i = 0; i < 7; i++) c.fillRect(1150 + i * 8, 596 - 4 - i * 1.5, 5, 4 + i * 1.5);
  circle(c, 1243.5, 572.5, 11);
  circle(c, 1243.5, 572.5, 6);
  // bottom-right percentage
  roundRect(c, 1162, 616, 34, 16, 3);
  text(c, `${Math.round(15 + 3 * Math.sin(2 * Math.PI * t))}%`, 1179, 627, 7.5, SANS, 500, "center");

  // ======================= BOTTOM-RIGHT BAR =======================
  for (let i = 0; i < 3; i++) {
    circle(c, 952.5 + i * 24, 664.5, 10);
    icon(c, i, 952.5 + i * 24, 664.5, 7);
  }
  line(c, 935.5, 680.5, 1255.5, 680.5);
  line(c, 935.5, 683.5, 1100.5, 683.5);
  rect(c, 1012, 674, 22, 12);
  rect(c, 1080, 676, 40, 6);
  c.fillRect(1082, 677.5, 36 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t)), 3);
  for (let i = 0; i < 8; i++) line(c, 1140.5 + i * 12, 680.5, 1140.5 + i * 12, 674.5);
  rect(c, 1238, 672, 16, 12);
  text(c, `T+${String(Math.floor(f / 30)).padStart(2, "0")}:${String(f % 30).padStart(2, "0")}`, 1040, 694, 7, MONO, 500);

  // ======================= CENTRE BRACKETS =======================
  {
    const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * t); // 0 -> 1 -> 0 over the loop
    const hw = 330 + 40 * k;
    const hh = 195 + 20 * k;
    const cx = 640;
    const cy = 360;
    const armX = 100;
    const armY = 100;
    const r = 10;
    const corners: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    for (const [sx, sy] of corners) {
      const x = Math.round(cx + sx * hw) + 0.5;
      const y = Math.round(cy + sy * hh) + 0.5;
      c.beginPath();
      c.moveTo(x - sx * armX, y);
      c.lineTo(x - sx * r, y);
      c.quadraticCurveTo(x, y, x, y - sy * r);
      c.lineTo(x, y - sy * armY);
      c.stroke();
      // bevel: a fainter parallel stroke just inside
      const ga = c.globalAlpha;
      c.globalAlpha = ga * 0.45;
      const ix = x - sx * 3;
      const iy = y - sy * 3;
      c.beginPath();
      c.moveTo(ix - sx * (armX - 3), iy);
      c.lineTo(ix - sx * r, iy);
      c.quadraticCurveTo(ix, iy, ix, iy - sy * r);
      c.lineTo(ix, iy - sy * (armY - 3));
      c.stroke();
      c.globalAlpha = ga;
    }
  }
};

export const HUDFrame: React.FC<HUDFrameProps> = (props) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: number, w: number, h: number) => drawHUDFrame(ctx, frame, w, h, props),
    // props come from a static data row
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.ink, props.accent, props.background],
  );
  return <CanvasStage draw={draw} background={props.background} />;
};
