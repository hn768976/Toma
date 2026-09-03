/**
 * <MinutiaeMarkers> — a point-plus-connector overlay.
 *
 * Subject-agnostic: seeded points biased toward a mid-radius band of the frame,
 * each snapped onto the nearest opaque pixel of the supplied mask so they land
 * on structure rather than in gaps. Points arrive progressively as a sweep
 * crosses them, then an irregular connector web is drawn between near
 * neighbours.
 *
 * The web is built from a thinned k-nearest-neighbour graph plus a couple of
 * long chords, never a hull or a ring — a neat convex outline would read as a
 * decorative frame rather than as a match analysis.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { PRINT_HEIGHT, PRINT_WIDTH, PRINT_X, PRINT_Y } from "../layout";
import type { PrintMask as Mask } from "../lib/mask";
import { withAlpha } from "../lib/draw";
import { chance, rand } from "../lib/rng";
import { passProgress } from "../lib/scan";
import type { MinutiaeConfig, ScanConfig } from "../variants";

const W = PRINT_WIDTH;
const H = PRINT_HEIGHT;

type Marker = { x: number; y: number; angle: number; appearAt: number };

/** Walks outward from (x,y) for the nearest well-covered mask pixel. */
const snapToRidge = (mask: Mask, x: number, y: number) => {
  for (let r = 0; r < 46; r += 2) {
    for (let a = 0; a < 12; a++) {
      const th = (a / 12) * Math.PI * 2 + r;
      const px = Math.round(x + Math.cos(th) * r);
      const py = Math.round(y + Math.sin(th) * r);
      if (px < 0 || py < 0 || px >= mask.width || py >= mask.height) continue;
      if (mask.coverage[py * mask.width + px] > 150) return { x: px, y: py };
    }
  }
  return { x, y };
};

const buildMarkers = (mask: Mask, cfg: MinutiaeConfig, scan: ScanConfig): Marker[] => {
  const pass = scan.mode === "verify" ? scan.passes[cfg.appearPass] : null;
  const out: Marker[] = [];
  let i = 0;
  let guard = 0;

  while (out.length < cfg.count && guard++ < 400) {
    const seed = `minutia-${i++}`;
    const angle = rand(`${seed}-a`, 0, Math.PI * 2);
    // Biased to the mid-radius band: away from the core and away from the edge.
    const rr = 0.36 + rand(`${seed}-r`, 0, 1) ** 0.8 * 0.34;
    const raw = {
      x: W / 2 + Math.cos(angle) * rr * (W / 2) * 0.94,
      y: H / 2 + Math.sin(angle) * rr * (H / 2) * 0.94,
    };
    const p = snapToRidge(mask, raw.x, raw.y);
    // Keep them apart so the web has room to be irregular.
    if (out.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < H * 0.11)) continue;

    const yFrac = p.y / H;
    // Pass 1 travels upward, so a marker is reached when the line rises past it.
    const appearAt = pass ? pass.start + (1 - yFrac) * (pass.end - pass.start) : 0;
    out.push({ x: p.x, y: p.y, angle, appearAt });
  }
  return out;
};

/** Thinned kNN graph plus a few long chords: connected, but visibly irregular. */
const buildLinks = (markers: Marker[], cfg: MinutiaeConfig): [number, number][] => {
  const maxD = cfg.maxLinkDistance * H;
  const links = new Set<string>();

  markers.forEach((m, i) => {
    const near = markers
      .map((o, j) => ({ j, d: Math.hypot(o.x - m.x, o.y - m.y) }))
      .filter((o) => o.j !== i && o.d < maxD)
      .sort((a, b) => a.d - b.d)
      .slice(0, cfg.linksPerMarker);
    near.forEach((o, k) => {
      // Drop some links so the web never closes into a tidy ring.
      if (k > 0 && chance(`link-drop-${i}-${o.j}`, 0.42)) return;
      links.add([Math.min(i, o.j), Math.max(i, o.j)].join("-"));
    });
  });

  for (let k = 0; k < 3; k++) {
    const a = Math.floor(rand(`chord-a-${k}`, 0, markers.length)) % markers.length;
    const b = Math.floor(rand(`chord-b-${k}`, 0, markers.length)) % markers.length;
    if (a !== b) links.add([Math.min(a, b), Math.max(a, b)].join("-"));
  }

  return [...links].map((s) => s.split("-").map(Number) as [number, number]);
};

export const MinutiaeMarkers: React.FC<{
  mask: Mask;
  config: MinutiaeConfig;
  scan: ScanConfig;
  frame: number;
  /** 0..1 — every marker flashes together with the outcome stamp. */
  flash: number;
}> = ({ mask, config, scan, frame, flash }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const markers = useMemo(() => buildMarkers(mask, config, scan), [mask, config, scan]);
  const links = useMemo(() => buildLinks(markers, config), [markers, config]);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // ---- connectors, drawn across the second pass
    const webP = passProgress(scan, config.connectPass, frame);
    if (webP > 0) {
      ctx.lineWidth = 2.6;
      links.forEach(([a, b], i) => {
        const at = i / links.length;
        const t = Math.min(1, Math.max(0, (webP - at * 0.65) / 0.35));
        if (t <= 0) return;
        const m = markers[a];
        const o = markers[b];
        // Thin and low-alpha: the web must not obscure the ridges beneath it.
        ctx.strokeStyle = withAlpha(config.color, (0.34 + flash * 0.5) * t);
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x + (o.x - m.x) * t, m.y + (o.y - m.y) * t);
        ctx.stroke();
      });
    }

    // ---- markers, arriving as the first pass crosses them
    markers.forEach((m) => {
      const age = frame - m.appearAt;
      if (age < 0) return;
      const arrive = Math.min(1, age / 4);
      const burst = Math.max(0, 1 - age / 9);
      const alpha = Math.min(1, 0.72 + burst * 0.28 + flash * 0.5);
      const r = config.radius * (1 + burst * 0.55) * arrive;

      ctx.strokeStyle = withAlpha(config.color, alpha);
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Short radial tick, pointing away from the print's centre.
      const t0 = r + 5;
      const t1 = t0 + config.tickLength * arrive;
      const ca = Math.cos(m.angle);
      const sa = Math.sin(m.angle);
      ctx.beginPath();
      ctx.moveTo(m.x + ca * t0, m.y + sa * t0);
      ctx.lineTo(m.x + ca * t1, m.y + sa * t1);
      ctx.stroke();

      if (burst > 0 || flash > 0) {
        ctx.fillStyle = withAlpha(config.color, Math.max(burst, flash) * 0.85);
        ctx.beginPath();
        ctx.arc(m.x, m.y, r * 0.44, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{ position: "absolute", left: PRINT_X, top: PRINT_Y, width: W, height: H }}
    />
  );
};
