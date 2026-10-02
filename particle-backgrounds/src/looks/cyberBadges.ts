import { MONO } from "../lib/font";
import { hash01 } from "../lib/random";
import { LOOP_FRAMES } from "../lib/timing";

/**
 * Data badges for the Cyber Network look, drawn into small canvases.
 * Icons are self-drawn SVG (no icon libraries); text uses JetBrains Mono.
 * Every value is a function of (badge seed, frame) only; values change on
 * whole-number cycles of the 600-frame loop.
 */

export const BADGE_W = 512;
export const BADGE_H = 256;
export type BadgeKind = "lock" | "bars" | "percent" | "text";

/** Padlock tile: rounded square with a fine dot texture and a padlock glyph. */
export const PADLOCK_SVG = (color: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <pattern id="dots" width="7" height="7" patternUnits="userSpaceOnUse">
      <circle cx="3.5" cy="3.5" r="1.25" fill="${color}" fill-opacity="0.55"/>
    </pattern>
    <radialGradient id="tileGlow" cx="0.5" cy="0.5" r="0.6">
      <stop offset="0" stop-color="${color}" stop-opacity="0.38"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0.08"/>
    </radialGradient>
  </defs>
  <rect x="14" y="14" width="172" height="172" rx="16" fill="url(#tileGlow)"/>
  <rect x="14" y="14" width="172" height="172" rx="16" fill="url(#dots)"/>
  <rect x="14" y="14" width="172" height="172" rx="16" fill="none" stroke="${color}" stroke-width="5" stroke-opacity="0.9"/>
  <path d="M72 92 V72 a28 28 0 0 1 56 0 V92" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>
  <rect x="58" y="90" width="84" height="66" rx="10" fill="${color}"/>
  <circle cx="100" cy="117" r="9" fill="#000"/>
  <rect x="96" y="120" width="8" height="20" rx="3" fill="#000"/>
</svg>`;

const TEXT_LINES = [
  ["NODE 0x3FA9", "SYNC  OK", "HOPS  07"],
  ["PKT 22914", "LAT 12ms", "ENC AES"],
  ["ID 7C-41-E0", "AUTH PASS", "PORT 8443"],
  ["BLK #40917", "HASH 9e1f", "CONF 06"],
  ["SEG 04/12", "RX 1.24GB", "TX 0.87GB"],
  ["KEY ROTATE", "T-07:41", "STATE IDLE"],
];

/** Percentage that changes every 6 frames (100 states per loop). */
export const percentAt = (seed: number, frame: number) => {
  const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  const step = Math.floor(f / 6);
  const base = 10 + hash01(seed, 1) * 80;
  const v = base + (hash01(seed, step + 11) - 0.5) * 6;
  return `${v.toFixed(3)}%`;
};

/** Bar heights: new targets every 15 frames (40 per loop), eased between, wrapping at the loop. */
export const barsAt = (seed: number, frame: number, count: number) => {
  const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  const STEP = 15;
  const STATES = LOOP_FRAMES / STEP;
  const i = Math.floor(f / STEP);
  const t = (f % STEP) / STEP;
  const e = t * t * (3 - 2 * t);
  const out: number[] = [];
  for (let b = 0; b < count; b++) {
    const a = hash01(seed, i % STATES, b + 50);
    const c = hash01(seed, (i + 1) % STATES, b + 50);
    out.push(0.18 + 0.82 * (a + (c - a) * e));
  }
  return out;
};

export const drawBadge = (
  ctx: CanvasRenderingContext2D,
  kind: BadgeKind,
  seed: number,
  frame: number,
  color: string,
  padlock: HTMLImageElement,
) => {
  ctx.clearRect(0, 0, BADGE_W, BADGE_H);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  // Left square (the node itself sits at its centre, x=64,y=128).
  if (kind === "lock") {
    ctx.drawImage(padlock, 8, 72, 112, 112);
    ctx.font = `500 46px "${MONO}"`;
    ctx.textBaseline = "middle";
    ctx.fillText(percentAt(seed, frame), 140, 128);
  } else if (kind === "bars") {
    ctx.fillRect(48, 112, 32, 32);
    const bars = barsAt(seed, frame, 7);
    for (let b = 0; b < bars.length; b++) {
      const h = bars[b] * 120;
      ctx.fillRect(130 + b * 30, 190 - h, 18, h);
    }
    ctx.fillRect(126, 194, 214, 4);
  } else if (kind === "percent") {
    ctx.fillRect(50, 114, 28, 28);
    ctx.font = `500 50px "${MONO}"`;
    ctx.textBaseline = "middle";
    ctx.fillText(percentAt(seed, frame), 112, 120);
    ctx.globalAlpha = 0.6;
    ctx.fillRect(112, 158, 250, 3);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillRect(50, 114, 28, 28);
    const lines = TEXT_LINES[Math.floor(hash01(seed, 9) * TEXT_LINES.length)];
    ctx.font = `500 30px "${MONO}"`;
    ctx.textBaseline = "middle";
    lines.forEach((l, k) => {
      ctx.globalAlpha = k === 0 ? 1 : 0.7;
      ctx.fillText(l, 112, 82 + k * 42);
    });
    // cursor blinks on a whole-cycle schedule (every 15 frames)
    const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
    if (Math.floor(f / 15) % 2 === 0) ctx.fillRect(112 + ctx.measureText(lines[2]).width + 8, 166, 16, 30);
    ctx.globalAlpha = 1;
  }
};
