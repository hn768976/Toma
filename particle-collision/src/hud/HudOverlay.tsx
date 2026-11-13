import { useLayoutEffect, useMemo, useRef } from "react";
import {
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { HUD_FONT } from "../lib/font";
import { hash, mulberry32 } from "../lib/random";

// Screen-space "data scan" HUD drawn with Canvas 2D. All coordinates are in
// 1920x1080 design units and scaled by k = height / 1080 (k = 2 at 4K).

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:/.-_=+<>[]  ";

type Row = {
  x: number;
  y: number;
  len: number; // characters
  size: number; // font px (design units)
  alpha: number;
  blur: boolean;
  drift: number; // px per second
  seed: number;
  rate: number; // character refresh interval (frames)
  dashes: boolean; // render as dash/blocks instead of glyphs
};

const makeRows = () => {
  const r = mulberry32(1234);
  const rows: Row[] = [];
  const zone = (
    n: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    blurChance: number,
  ) => {
    for (let i = 0; i < n; i++) {
      rows.push({
        x: x0 + r() * (x1 - x0),
        y: y0 + r() * (y1 - y0),
        len: Math.floor(8 + r() * 46),
        size: 8 + r() * 4,
        alpha: 0.25 + r() * 0.55,
        blur: r() < blurChance + 0.15,
        drift: (r() - 0.5) * 14,
        seed: Math.floor(r() * 1e6),
        rate: Math.floor(3 + r() * 9),
        dashes: r() < 0.62,
      });
    }
  };
  // grouped like the reference: a dense left-middle field and a top-right
  // field, with sparse rows elsewhere; many are defocused/smeared
  zone(44, 0, 640, 260, 860, 0.5); // left-middle field
  zone(34, 1100, 1880, 30, 430, 0.45); // top-right field
  zone(8, 300, 1100, 20, 240, 0.5); // top band
  zone(10, 0, 1500, 880, 1060, 0.5); // bottom band
  zone(8, 1200, 1880, 560, 880, 0.5); // right-lower
  return rows;
};

const rowText = (row: Row, frame: number) => {
  const step = Math.floor(frame / row.rate);
  let s = "";
  for (let i = 0; i < row.len; i++) {
    // only some characters update each step -> "live data" shimmer
    const changing = hash(row.seed, i) < 0.35;
    const h = hash(row.seed, i, changing ? step : 0);
    s += CHARS[Math.floor(h * CHARS.length)];
  }
  return s;
};

// [x, y, radius, start s, end s, warm] in 1920x1080 design units
const ORBS: [number, number, number, number, number, boolean][] = [
  [1880, 640, 34, 5.5, 11, true],
  [1820, 420, 22, 6.5, 12.5, false],
  [1560, 760, 18, 8, 14, true],
  [1250, 690, 26, 0, 6, true],
  [240, 980, 30, 12, 20, true],
  [980, 110, 16, 3, 9, false],
  [1700, 200, 20, 14, 20, true],
];

export const HudOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const k = height / 1080;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blurRef = useRef<HTMLCanvasElement | null>(null);
  const rows = useMemo(makeRows, []);

  useLayoutEffect(() => {
    const handle = delayRender(`HUD frame ${frame}`);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    if (!blurRef.current) {
      blurRef.current = document.createElement("canvas");
    }
    // low-res buffer: rows drawn here and upscaled read as defocused
    const BL = 6;
    const bc = blurRef.current;
    bc.width = Math.ceil(width / BL);
    bc.height = Math.ceil(height / BL);
    const bctx = bc.getContext("2d")!;

    const t = frame / fps;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, bc.width, bc.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    bctx.setTransform(k / BL, 0, 0, k / BL, 0, 0);
    ctx.textBaseline = "middle";
    bctx.textBaseline = "middle";

    // ---------- translucent panel sliding down from the top ----------
    const panelH = interpolate(frame, [0, 22], [0, 905], {
      extrapolateRight: "clamp",
      easing: (x) => 1 - Math.pow(1 - x, 3),
    });
    ctx.fillStyle = "rgba(150,150,150,0.13)";
    ctx.fillRect(1138, 0, 536, panelH);
    ctx.fillStyle = "rgba(220,220,220,0.18)";
    ctx.fillRect(1138, panelH - 2, 536, 2);

    // ---------- data rows ----------
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // each row lives in ~2s slots, some slots it is hidden
      const slot = Math.floor((t + (row.seed % 97) / 40) / 2.2);
      const visible = hash(row.seed, slot, 7) < 0.78;
      if (!visible) continue;
      const blink = hash(row.seed, Math.floor(frame / 2)) < 0.04 ? 0.35 : 1;
      const x = row.x + row.drift * t;
      const target = row.blur ? bctx : ctx;
      const a = row.alpha * blink * (row.blur ? 1.6 : 1);
      if (row.dashes) {
        // block / dash rows (look like compressed data glyphs)
        target.fillStyle = `rgba(235,232,225,${a})`;
        let cx = x;
        for (let c = 0; c < row.len; c++) {
          const h = hash(row.seed, c, Math.floor(frame / row.rate) * (hash(row.seed, c) < 0.3 ? 1 : 0));
          const w = 2 + h * row.size * 0.9;
          if (h > 0.18) target.fillRect(cx, row.y - row.size * 0.18, w, row.size * 0.36);
          cx += w + 2 + hash(row.seed, c, 3) * 4;
        }
      } else {
        target.font = `${row.size}px ${HUD_FONT}`;
        target.fillStyle = `rgba(235,232,225,${a})`;
        const txt = rowText(row, frame);
        target.fillText(txt, x, row.y);
        if (!row.blur) {
          // glow halo for the sharp rows
          bctx.font = `${row.size}px ${HUD_FONT}`;
          bctx.fillStyle = `rgba(255,236,210,${a * 0.5})`;
          bctx.fillText(txt, x, row.y);
        }
      }
    }

    // ---------- main scan line with ticks and travelling rings ----------
    const ly = 535;
    const g = ctx.createLinearGradient(0, ly - 14, 0, ly + 14);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,250,240,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, ly - 14, 1920, 28);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(0, ly - 1, 1920, 2);
    const ticks = [12, 118, 300, 615, 760, 1035, 1510, 1655, 1912];
    for (const tx of ticks) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(tx - 1.5, ly - 10, 3, 20);
    }
    for (let i = 0; i < 26; i++) {
      const tx = 40 + i * 73 + Math.sin(i * 3.1) * 20;
      const pulse = 0.4 + 0.6 * hash(i, Math.floor(frame / 5));
      ctx.fillStyle = `rgba(255,255,255,${0.5 * pulse})`;
      ctx.fillRect(tx, ly - 2.5, 5, 5);
    }
    // inline text riding on the line
    ctx.font = `10px ${HUD_FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(rowText({ x: 0, y: 0, len: 58, size: 10, alpha: 1, blur: false, drift: 0, seed: 991, rate: 4, dashes: false }, frame), 1250, ly - 13);
    ctx.fillText(rowText({ x: 0, y: 0, len: 22, size: 10, alpha: 1, blur: false, drift: 0, seed: 517, rate: 6, dashes: false }, frame), 630, ly + 13);

    const ring = (cx: number, alpha: number) => {
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, ly, 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.35 * alpha})`;
      ctx.beginPath();
      ctx.arc(cx, ly, 52, -0.6 + t * 0.8, 0.9 + t * 0.8);
      ctx.stroke();
    };
    const smooth = { easing: (x: number) => x * x * (3 - 2 * x), extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
    ring(interpolate(t, [0, 9, 20], [1305, 440, 750], smooth), 1);
    ring(
      interpolate(t, [2.5, 10, 20], [1560, 1000, 1135], smooth),
      interpolate(t, [2.5, 3.5], [0, 1], smooth),
    );

    // ---------- small fixed HUD furniture ----------
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let gx = 0; gx < 6; gx++) {
      for (let gy = 0; gy < 6; gy++) {
        if (hash(gx, gy, Math.floor(frame / 8)) < 0.85) ctx.fillRect(850 + gx * 30, 170 + gy * 26, 3, 3);
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(978, 912, 108, 102);
    ctx.strokeRect(1140, 990, 150, 24);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(80, 1040, 670, 2);
    for (let i = 0; i < 5; i++) ctx.fillRect(785 + i * 22, 1039, 6, 4);
    ctx.fillRect(1180, 90, 2, 75);
    ctx.fillRect(1840, 300, 2, 120);
    ctx.fillRect(1826, 359, 30, 2);
    ctx.fillRect(960, 0, 1.5, 60);

    // composite defocused layer
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // horizontal smear: several offset copies read as a lens streak
    const offs = [-28, -14, 0, 14, 28];
    const wts = [0.12, 0.24, 0.38, 0.24, 0.12];
    for (let i = 0; i < offs.length; i++) {
      ctx.globalAlpha = wts[i];
      ctx.drawImage(bc, offs[i] * k, 0, width, height);
    }
    ctx.globalAlpha = 1;

    // out-of-focus bokeh orbs drifting in the foreground
    for (let i = 0; i < ORBS.length; i++) {
      const [ox, oy, r, s0, s1, warm] = ORBS[i];
      const vis = interpolate(t, [s0, s0 + 1, s1 - 1, s1], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      if (vis <= 0) continue;
      const cx = (ox + Math.sin(t * 0.3 + i) * 25 - t * 6) * k;
      const cy = (oy + Math.cos(t * 0.25 + i * 2) * 15) * k;
      const rr = r * k;
      const col = warm ? "255,150,60" : "90,220,220";
      const a = (warm ? 0.32 : 0.22) * vis * (0.85 + 0.15 * Math.sin(t * 1.3 + i));
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      grad.addColorStop(0, `rgba(${col},${a})`);
      grad.addColorStop(0.75, `rgba(${col},${a * 0.8})`);
      grad.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    continueRender(handle);
  }, [frame, fps, width, height, k, rows]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width, height, mixBlendMode: "screen" }}
    />
  );
};
