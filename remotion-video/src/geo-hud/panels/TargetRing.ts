import { alpha, both, type DrawArgs } from "../paint";
import { cycle, envelope, rInt } from "../rand";
import type { MarkerMode } from "../variants";

/**
 * Map markers. In "sonar" mode (v1) each is a bright ring with a smaller inner
 * ring and a centre dot, and an outer ring expands and fades on a 150-frame
 * cycle - a divisor of 900. In "blink" mode (v2) the markers are smaller, more
 * numerous, and simply blink.
 */

export const PULSE_PERIOD = 150;

export const drawTargetRing = (
  a: DrawArgs,
  x: number,
  y: number,
  radius: number,
  mode: MarkerMode,
  seed: string,
) => {
  const pal = a.v.palette;

  if (mode === "sonar") {
    const phase = rInt(`${seed}/ph`, 0, PULSE_PERIOD);
    const cy = cycle(a.frame, PULSE_PERIOD, phase);
    // Expanding ping.
    const ping = cy.t;
    both(a.p, (c) => {
      c.beginPath();
      c.arc(x, y, radius * (1 + ping * 1.9), 0, Math.PI * 2);
      c.strokeStyle = alpha(pal.accent, 0.75 * (1 - ping) ** 1.4);
      c.lineWidth = 4 * (1 - ping) + 1;
      c.stroke();

      c.beginPath();
      c.arc(x, y, radius, 0, Math.PI * 2);
      c.strokeStyle = alpha(pal.accent, 0.95);
      c.lineWidth = 5;
      c.stroke();

      c.beginPath();
      c.arc(x, y, radius * 0.45, 0, Math.PI * 2);
      c.strokeStyle = alpha(pal.accent, 0.8);
      c.lineWidth = 3;
      c.stroke();

      c.beginPath();
      c.arc(x, y, radius * 0.14, 0, Math.PI * 2);
      c.fillStyle = alpha(pal.accent, 1);
      c.fill();
    });
    return;
  }

  // Blink mode.
  const period = 60 + rInt(`${seed}/p`, 0, 4) * 30;
  const phase = rInt(`${seed}/ph`, 0, period);
  const cy = cycle(a.frame, period, phase);
  const on = envelope(cy.local, period * 0.5, 6, 10);
  both(a.p, (c) => {
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.strokeStyle = alpha(pal.accent, 0.35 + 0.6 * on);
    c.lineWidth = 3.5;
    c.stroke();

    c.beginPath();
    c.arc(x, y, radius * 0.34, 0, Math.PI * 2);
    c.fillStyle = alpha(pal.accent, 0.4 + 0.6 * on);
    c.fill();

    // Small cross ticks.
    c.strokeStyle = alpha(pal.accent, 0.3 + 0.5 * on);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x - radius * 1.7, y);
    c.lineTo(x - radius * 1.15, y);
    c.moveTo(x + radius * 1.15, y);
    c.lineTo(x + radius * 1.7, y);
    c.stroke();
  });
};
