import { mulberry32 } from "./random";

/**
 * Shared chip layout in face units u, v ∈ [-1, 1] (package face).
 * Used as a texture (Look 3) and as a point-sampling source (Look 2).
 * No maker's marks anywhere.
 */
export const CHIP = {
  /** pad grid: N×N lattice, pads kept where RING_IN ≤ max(|u|,|v|) ≤ RING_OUT */
  N: 58,
  RING_IN: 0.44,
  RING_OUT: 0.94,
  /** raised centre die half size */
  DIE: 0.32,
  /** die frame (double square with round corner dots) */
  FRAME_IN: 0.36,
  FRAME_OUT: 0.4,
};

export type Pad = { u: number; v: number; s: number; lum: number; orange: boolean };

/** Pad centres for an N×N lattice (seeded → identical on every thread). */
export const makePads = (N: number, seed = 0xc41f): Pad[] => {
  const rng = mulberry32(seed);
  const out: Pad[] = [];
  const { RING_IN, RING_OUT } = CHIP;
  const pitch = 2 / N;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = -1 + pitch * (i + 0.5);
      const v = -1 + pitch * (j + 0.5);
      const m = Math.max(Math.abs(u), Math.abs(v));
      if (m < RING_IN || m > RING_OUT) continue;
      // a few missing pads, like a real BGA keep-out pattern
      if (rng() < 0.035) continue;
      out.push({ u, v, s: pitch * 0.56, lum: 0.55 + 0.45 * rng(), orange: rng() < 0.05 });
    }
  }
  return out;
};

/** Default pad set (module level). */
export const PADS: Pad[] = makePads(CHIP.N);

/**
 * Draw the package face (pads, rim, die frame, fine circuit grid) into a 2D
 * context of size S×S. Colours given as CSS strings.
 */
export const drawChipFace = (
  ctx: CanvasRenderingContext2D,
  S: number,
  c: { body: string; pad: string; tick: string; rim: string; die: string; grid: string },
) => {
  const X = (u: number) => ((u + 1) / 2) * S;
  const Y = (v: number) => ((1 - v) / 2) * S;
  ctx.fillStyle = c.body;
  ctx.fillRect(0, 0, S, S);
  // subtle vertical sheen
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, "rgba(120,170,255,0.10)");
  g.addColorStop(0.5, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(120,170,255,0.06)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // fine circuit grid over the whole face
  ctx.strokeStyle = c.grid;
  ctx.lineWidth = Math.max(1, S / 1400);
  const fine = 92;
  for (let i = 0; i <= fine; i++) {
    const p = (i / fine) * S;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, S);
    ctx.moveTo(0, p);
    ctx.lineTo(S, p);
    ctx.stroke();
  }
  // pads
  for (const p of PADS) {
    const s = (p.s / 2) * S;
    const edgeTick = p.orange && Math.max(Math.abs(p.u), Math.abs(p.v)) > 0.8;
    ctx.fillStyle = edgeTick ? c.tick : c.pad;
    ctx.globalAlpha = edgeTick ? 0.9 : p.lum;
    ctx.fillRect(X(p.u) - s / 2, Y(p.v) - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  // rim highlights
  ctx.strokeStyle = c.rim;
  ctx.lineWidth = S / 300;
  ctx.strokeRect(X(-0.985), Y(0.985), X(0.985) - X(-0.985), Y(-0.985) - Y(0.985));
  ctx.lineWidth = S / 700;
  ctx.globalAlpha = 0.6;
  ctx.strokeRect(X(-0.95), Y(0.95), X(0.95) - X(-0.95), Y(-0.95) - Y(0.95));
  // die frame (double square, round corner dots)
  ctx.globalAlpha = 0.9;
  for (const f of [CHIP.FRAME_IN, CHIP.FRAME_OUT]) {
    ctx.lineWidth = S / 420;
    ctx.strokeRect(X(-f), Y(f), X(f) - X(-f), Y(-f) - Y(f));
  }
  for (const [u, v] of [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    ctx.beginPath();
    ctx.arc(X(u * CHIP.FRAME_IN * 0.9), Y(v * CHIP.FRAME_IN * 0.9), S / 70, 0, Math.PI * 2);
    ctx.fillStyle = c.rim;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};
