import { spring } from "remotion";
import type { PanelSpec } from "../layout";
import { alpha, both, mono, sans, type DrawArgs } from "../paint";
import { LOOP, cycle, rInt, rPick, rRange } from "../rand";
import { panelBody } from "./PanelChrome";

/**
 * A circular arc gauge with a value in the centre. The needle springs to a new
 * target every 75 or 90 frames - both divisors of 900, and both long enough for
 * the spring to settle, so the loop closes cleanly.
 */

const GAUGE_PERIODS = [75, 90];
const START = Math.PI * 0.75;
const SWEEP = Math.PI * 1.5;

type Gauge = { cx: number; cy: number; r: number; period: number; phase: number; seed: string };

const gaugeCache = new Map<string, Gauge[]>();

const gaugesFor = (spec: PanelSpec): Gauge[] => {
  const cached = gaugeCache.get(spec.id);
  if (cached) return cached;
  const body = panelBody(spec);
  const n = spec.opts?.gauges ?? 3;
  const slot = body.w / n;
  const r = Math.min(slot * 0.38, body.h * 0.42);
  const out: Gauge[] = [];
  for (let i = 0; i < n; i++) {
    const seed = `${spec.id}/g${i}`;
    const period = rPick(`${seed}/p`, GAUGE_PERIODS);
    out.push({
      cx: body.x + slot * (i + 0.5),
      cy: body.y + body.h * 0.52,
      r,
      period,
      phase: rInt(`${seed}/ph`, 0, period),
      seed,
    });
  }
  gaugeCache.set(spec.id, out);
  return out;
};

export const drawRingGaugeStatic = (a: DrawArgs, spec: PanelSpec) => {
  const c = a.p.ctx;
  const pal = a.v.palette;
  for (const g of gaugesFor(spec)) {
    c.beginPath();
    c.arc(g.cx, g.cy, g.r, START, START + SWEEP);
    c.strokeStyle = alpha(pal.panelBorder, 0.5);
    c.lineWidth = 10;
    c.stroke();

    // Tick marks around the track.
    c.strokeStyle = alpha(pal.panelBorder, 0.8);
    c.lineWidth = 2;
    for (let t = 0; t <= 10; t++) {
      const ang = START + (SWEEP * t) / 10;
      const r0 = g.r + 9;
      const r1 = g.r + (t % 5 === 0 ? 20 : 14);
      c.beginPath();
      c.moveTo(g.cx + Math.cos(ang) * r0, g.cy + Math.sin(ang) * r0);
      c.lineTo(g.cx + Math.cos(ang) * r1, g.cy + Math.sin(ang) * r1);
      c.stroke();
    }

    c.font = sans(a.fonts, 17, 600);
    c.fillStyle = alpha(pal.textDim, 1);
    c.textAlign = "center";
    c.textBaseline = "top";
    c.fillText(`CH ${rInt(`${g.seed}/ch`, 10, 100)}`, g.cx, g.cy + g.r * 0.52);
    c.textAlign = "left";
  }
};

export const drawRingGauge = (a: DrawArgs, spec: PanelSpec) => {
  const pal = a.v.palette;
  for (const g of gaugesFor(spec)) {
    const cy = cycle(a.frame, g.period, g.phase);
    const epochs = LOOP / g.period;
    const prevEpoch = (cy.epoch + epochs - 1) % epochs;
    const from = rRange(`${g.seed}:${prevEpoch}`, 0.08, 0.98);
    const to = rRange(`${g.seed}:${cy.epoch}`, 0.08, 0.98);
    const t = spring({
      frame: cy.local,
      fps: a.fps,
      config: { damping: 14, mass: 0.7, stiffness: 110 },
    });
    const value = from + (to - from) * t;

    both(a.p, (c) => {
      c.beginPath();
      c.arc(g.cx, g.cy, g.r, START, START + SWEEP * value);
      c.strokeStyle = alpha(pal.accent, 0.95);
      c.lineWidth = 10;
      c.lineCap = "butt";
      c.stroke();
    }, 0.55);

    const c = a.p.ctx;
    c.font = mono(a.fonts, g.r * 0.62, 500);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = alpha(pal.textPale, 0.95);
    c.fillText(Math.round(value * 100).toString().padStart(2, "0"), g.cx, g.cy - g.r * 0.05);
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
  }
};
