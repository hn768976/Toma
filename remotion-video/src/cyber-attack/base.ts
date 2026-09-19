import { HUD_MESSAGES } from "./code-text";
import { FONTS, PALETTE, scaleFor } from "./constants";
import type { DirectorState } from "./director";
import { getStrip, LAYERS } from "./layers";
import { pick, rand } from "./random";
import { drawTitle } from "./title";

// The clean frame, before anything is broken. Everything the glitch pass
// later tears apart is composed here: the parallax code wall, the bloom
// that sits on top of it, the centre alert, the HUD readouts and the title.

const drawCodeWall = (
  ctx: CanvasRenderingContext2D,
  state: DirectorState,
  width: number,
  height: number,
): void => {
  const s = scaleFor(width);
  const block = Math.floor(state.time * 10);

  LAYERS.forEach((spec, index) => {
    const strip = getStrip(index, width, height);
    // Steady upward drift, plus a shove whenever the signal is rough —
    // the log looks like it is being scrolled by the crash, not by us.
    const drift = state.time * spec.speed * s;
    const shove =
      state.intensity > 0.5
        ? (rand(block, index, 0x31) - 0.5) * 70 * s * state.intensity
        : 0;
    const offset =
      (((drift + shove) % strip.height) + strip.height) % strip.height;

    ctx.globalAlpha = spec.alpha;
    ctx.drawImage(strip.canvas, 0, -offset, width, strip.height);
    ctx.drawImage(strip.canvas, 0, -offset + strip.height, width, strip.height);
  });
  ctx.globalAlpha = 1;
};

const drawBloom = (
  ctx: CanvasRenderingContext2D,
  state: DirectorState,
  width: number,
  height: number,
): void => {
  const s = scaleFor(width);
  const strip = getStrip(2, width, height);
  const drift = state.time * 14 * s;
  const offset = ((drift % strip.height) + strip.height) % strip.height;
  const zoom = 1.75;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.24;
  ctx.filter = `blur(${7 * s}px)`;
  const w = width * zoom;
  const x = (width - w) / 2;
  ctx.drawImage(strip.canvas, x, -offset, w, strip.height * zoom);
  ctx.drawImage(
    strip.canvas,
    x,
    -offset + strip.height * zoom,
    w,
    strip.height * zoom,
  );
  ctx.restore();
};

const skullCache = new Map<number, HTMLCanvasElement>();

/**
 * Faint skull behind the centre glow. Never quite resolves.
 *
 * Built on its own canvas because the eye sockets are punched with
 * destination-out — done straight onto the frame that would erase the
 * code wall behind it instead of the skull.
 */
const skullCanvas = (r: number): HTMLCanvasElement => {
  const key = Math.round(r);
  const hit = skullCache.get(key);
  if (hit) return hit;

  const size = Math.ceil(r * 3);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = "rgb(120, 170, 255)";
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.12, r * 0.74, r * 0.82, 0, Math.PI, 0);
  ctx.rect(cx - r * 0.74, cy - r * 0.12, r * 1.48, r * 0.6);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - r * 0.44, cy + r * 0.46, r * 0.88, r * 0.42, r * 0.16);
  ctx.fill();

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.34, cy, r * 0.24, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.34, cy, r * 0.24, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.16);
  ctx.lineTo(cx - r * 0.11, cy + r * 0.44);
  ctx.lineTo(cx + r * 0.11, cy + r * 0.44);
  ctx.closePath();
  ctx.fill();
  // Teeth.
  for (let i = -2; i <= 2; i += 1) {
    ctx.fillRect(
      cx + i * r * 0.17 - r * 0.02,
      cy + r * 0.46,
      r * 0.045,
      r * 0.42,
    );
  }

  skullCache.set(key, c);
  return c;
};

const drawSkull = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  alpha: number,
): void => {
  if (alpha <= 0.002) return;
  const c = skullCanvas(r);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.filter = `blur(${Math.max(1, r * 0.035)}px)`;
  ctx.drawImage(c, cx - c.width / 2, cy - c.height / 2);
  ctx.restore();
};

const drawCentreAlert = (
  ctx: CanvasRenderingContext2D,
  state: DirectorState,
  width: number,
  height: number,
): void => {
  const s = scaleFor(width);
  const cx = width / 2;
  const cy = height * 0.482;
  // Recedes while a title is up; the two never compete for the same space.
  const exposure = 1 - (state.title?.opacity ?? 0) * 0.85;
  if (exposure <= 0.02) return;

  const pulse = 0.72 + Math.sin(state.time * 2.4) * 0.28;
  const { mood } = state;
  const col = `${Math.round(mood.r * 190)}, ${Math.round(mood.g * 190)}, ${Math.round(mood.b * 255)}`;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const r = height * 0.34;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(${col}, ${0.3 * pulse * exposure})`);
  g.addColorStop(0.5, `rgba(${col}, ${0.1 * pulse * exposure})`);
  g.addColorStop(1, `rgba(${col}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  drawSkull(
    ctx,
    cx,
    cy - height * 0.01,
    height * 0.15,
    0.05 * pulse * exposure,
  );

  // "WARNING", tracked wide, sitting just above centre.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.34 * pulse * exposure;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${46 * s}px "${FONTS.code}", monospace`;
  ctx.letterSpacing = `${16 * s}px`;
  ctx.shadowColor = `rgba(${col}, 0.9)`;
  ctx.shadowBlur = 34 * s;
  ctx.fillStyle = "rgba(210, 232, 255, 0.9)";
  ctx.fillText("WARNING", cx, cy);
  ctx.letterSpacing = "0px";
  ctx.restore();
};

const drawHud = (
  ctx: CanvasRenderingContext2D,
  state: DirectorState,
  width: number,
  height: number,
): void => {
  const s = scaleFor(width);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.textBaseline = "middle";

  // Breach progress, only while the signal is holding together.
  const calm = state.intensity < 0.45 ? 1 : 0;
  if (calm) {
    const cycle = (state.time * 0.13) % 1;
    const pct = Math.min(99, Math.floor(cycle * 122));
    const barW = width * 0.44;
    const barH = 13 * s;
    const x = (width - barW) / 2;
    const y = height * 0.605;
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "rgba(120, 180, 255, 0.55)";
    ctx.lineWidth = 1.6 * s;
    ctx.strokeRect(x, y, barW, barH);
    ctx.fillStyle = "rgba(150, 215, 255, 0.85)";
    ctx.fillRect(
      x + 2 * s,
      y + 2 * s,
      (barW - 4 * s) * (pct / 100),
      barH - 4 * s,
    );
    ctx.font = `400 ${17 * s}px "${FONTS.code}", monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`${pct}%`, x + barW + 14 * s, y + barH / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(120, 180, 255, 0.7)";
    ctx.fillText("UPLOADING", x - 14 * s, y + barH / 2);
  }

  // A status line that flips over on the glitch cadence.
  const block = Math.floor(state.time * 10);
  if (state.intensity > 0.3 && rand(block, 0x88) < 0.4) {
    const msg = pick(HUD_MESSAGES, Math.floor(block / 4), 0x99);
    ctx.globalAlpha = 0.55;
    ctx.textAlign = "left";
    ctx.font = `700 ${19 * s}px "${FONTS.code}", monospace`;
    ctx.fillStyle = PALETTE.alertRed;
    ctx.fillText(`> ${msg}`, width * 0.055, height * 0.9);
  }

  // Sweeping read head.
  const sweep = ((state.time * 0.42) % 1) * height;
  ctx.globalAlpha = 0.16;
  const sg = ctx.createLinearGradient(0, sweep - 70 * s, 0, sweep + 70 * s);
  sg.addColorStop(0, "rgba(120, 190, 255, 0)");
  sg.addColorStop(0.5, "rgba(170, 220, 255, 1)");
  sg.addColorStop(1, "rgba(120, 190, 255, 0)");
  ctx.fillStyle = sg;
  ctx.fillRect(0, sweep - 70 * s, width, 140 * s);
  ctx.restore();
};

const drawVignette = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const g = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.28,
    width / 2,
    height / 2,
    height * 0.86,
  );
  g.addColorStop(0, "rgba(0, 0, 0, 0)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.58)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
};

/** Composes the undamaged frame into `ctx`. */
export const drawBase = (
  ctx: CanvasRenderingContext2D,
  state: DirectorState,
  frame: number,
  width: number,
  height: number,
): void => {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, PALETTE.backdrop);
  bg.addColorStop(0.5, PALETTE.navy);
  bg.addColorStop(1, PALETTE.backdrop);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  drawCodeWall(ctx, state, width, height);
  drawBloom(ctx, state, width, height);
  drawCentreAlert(ctx, state, width, height);
  drawHud(ctx, state, width, height);
  drawTitle(ctx, state.title, state.mood, frame, width, height);
  drawVignette(ctx, width, height);
};
