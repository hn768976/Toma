/**
 * <MinutiaeMarkers> — a point-plus-connector overlay for a masked bitmap.
 *
 * Subject-agnostic and palette-agnostic. Seeded points are biased into a
 * mid-radius annulus of the frame and each is snapped onto the nearest opaque
 * pixel of the supplied mask, so they land on structure rather than in the gaps
 * between it. Points arrive progressively as a sweep crosses them, each with a
 * brief flash, and then a connector web is drawn between near neighbours.
 *
 * The web is a thinned k-nearest-neighbour graph plus a few long chords, and is
 * deliberately NOT a convex hull and NOT an evenly spaced ring: either of those
 * reads as a decorative frame rather than as analysis.
 *
 * Everything is a pure function of the props — deterministic for Remotion.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { withAlpha } from "./draw";
import { chance, rand } from "./rng";

export type MarkerMask = {
  coverage: Uint8ClampedArray;
  width: number;
  height: number;
};

export type Marker = { x: number; y: number; angle: number; appearAt: number };

export type MinutiaeMarkersProps = {
  mask: MarkerMask;
  count: number;
  color: string;
  frame: number;
  /** Frame at which a marker sitting at this vertical fraction (0..1) arrives. */
  appearAt: (yFraction: number) => number;
  /** 0..1 across which the connector web draws. */
  webProgress: number;
  seed?: string;
  radius?: number;
  tickLength?: number;
  /** Annulus the points are biased into, as fractions of the half-extent. */
  radialBand?: [number, number];
  /** Longest connector, as a fraction of mask height. */
  maxLinkDistance?: number;
  /** Candidate links per point before seeded thinning. */
  linksPerMarker?: number;
  /** Minimum separation between points, as a fraction of mask height. */
  minSeparation?: number;
  /** Long chords added on top of the kNN graph, to break up its regularity. */
  chords?: number;
  /** 0..1 — every marker flashes together, e.g. with an outcome stamp. */
  flash?: number;
  style?: React.CSSProperties;
};

/** Walks outward from (x,y) for the nearest well-covered mask pixel. */
const snapToMask = (mask: MarkerMask, x: number, y: number, maxR = 46) => {
  for (let r = 0; r < maxR; r += 2) {
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

export const buildMarkers = (
  mask: MarkerMask,
  opts: Required<Pick<MinutiaeMarkersProps, "count" | "appearAt">> & {
    seed: string;
    radialBand: [number, number];
    minSeparation: number;
  },
): Marker[] => {
  const { width: W, height: H } = mask;
  const [r0, r1] = opts.radialBand;
  const out: Marker[] = [];
  let i = 0;
  let guard = 0;

  while (out.length < opts.count && guard++ < 400) {
    const seed = `${opts.seed}-${i++}`;
    const angle = rand(`${seed}-a`, 0, Math.PI * 2);
    // ^0.8 leans the distribution outward within the band without ever
    // reaching the very edge.
    const rr = r0 + rand(`${seed}-r`, 0, 1) ** 0.8 * (r1 - r0);
    const p = snapToMask(
      mask,
      W / 2 + Math.cos(angle) * rr * (W / 2) * 0.94,
      H / 2 + Math.sin(angle) * rr * (H / 2) * 0.94,
    );
    // Keep them apart so the web has room to be irregular.
    if (out.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < H * opts.minSeparation)) {
      continue;
    }
    out.push({ x: p.x, y: p.y, angle, appearAt: opts.appearAt(p.y / H) });
  }
  return out;
};

export const buildLinks = (
  markers: Marker[],
  height: number,
  opts: { maxLinkDistance: number; linksPerMarker: number; chords: number; seed: string },
): [number, number][] => {
  const maxD = opts.maxLinkDistance * height;
  const links = new Set<string>();

  markers.forEach((m, i) => {
    const near = markers
      .map((o, j) => ({ j, d: Math.hypot(o.x - m.x, o.y - m.y) }))
      .filter((o) => o.j !== i && o.d < maxD)
      .sort((a, b) => a.d - b.d)
      .slice(0, opts.linksPerMarker);
    near.forEach((o, k) => {
      // Drop some links so the web never closes into a tidy ring.
      if (k > 0 && chance(`${opts.seed}-drop-${i}-${o.j}`, 0.42)) return;
      links.add([Math.min(i, o.j), Math.max(i, o.j)].join("-"));
    });
  });

  for (let k = 0; k < opts.chords; k++) {
    const a = Math.floor(rand(`${opts.seed}-chord-a-${k}`, 0, markers.length)) % markers.length;
    const b = Math.floor(rand(`${opts.seed}-chord-b-${k}`, 0, markers.length)) % markers.length;
    if (a !== b) links.add([Math.min(a, b), Math.max(a, b)].join("-"));
  }

  return [...links].map((s) => s.split("-").map(Number) as [number, number]);
};

export const MinutiaeMarkers: React.FC<MinutiaeMarkersProps> = ({
  mask,
  count,
  color,
  frame,
  appearAt,
  webProgress,
  seed = "minutia",
  radius = 21,
  tickLength = 30,
  radialBand = [0.36, 0.7],
  maxLinkDistance = 0.34,
  linksPerMarker = 2,
  minSeparation = 0.11,
  chords = 3,
  flash = 0,
  style,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = mask.width;
  const H = mask.height;

  const markers = useMemo(
    () => buildMarkers(mask, { count, appearAt, seed, radialBand, minSeparation }),
    [mask, count, appearAt, seed, radialBand, minSeparation],
  );
  const links = useMemo(
    () => buildLinks(markers, H, { maxLinkDistance, linksPerMarker, chords, seed }),
    [markers, H, maxLinkDistance, linksPerMarker, chords, seed],
  );

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // ---- connectors
    if (webProgress > 0) {
      ctx.lineWidth = 2.6;
      links.forEach(([a, b], i) => {
        const at = i / Math.max(1, links.length);
        const t = Math.min(1, Math.max(0, (webProgress - at * 0.65) / 0.35));
        if (t <= 0) return;
        const m = markers[a];
        const o = markers[b];
        // Thin and low-alpha: the web must not obscure what lies beneath it.
        ctx.strokeStyle = withAlpha(color, (0.48 + flash * 0.42) * t);
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x + (o.x - m.x) * t, m.y + (o.y - m.y) * t);
        ctx.stroke();
      });
    }

    // ---- markers
    markers.forEach((m) => {
      const age = frame - m.appearAt;
      if (age < 0) return;
      const arrive = Math.min(1, age / 4);
      const burst = Math.max(0, 1 - age / 9);
      const alpha = Math.min(1, 0.72 + burst * 0.28 + flash * 0.5);
      const r = radius * (1 + burst * 0.55) * arrive;

      ctx.strokeStyle = withAlpha(color, alpha);
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Short radial tick, pointing away from the centre.
      const t0 = r + 5;
      const t1 = t0 + tickLength * arrive;
      const ca = Math.cos(m.angle);
      const sa = Math.sin(m.angle);
      ctx.beginPath();
      ctx.moveTo(m.x + ca * t0, m.y + sa * t0);
      ctx.lineTo(m.x + ca * t1, m.y + sa * t1);
      ctx.stroke();

      if (burst > 0 || flash > 0) {
        ctx.fillStyle = withAlpha(color, Math.max(burst, flash) * 0.85);
        ctx.beginPath();
        ctx.arc(m.x, m.y, r * 0.44, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });

  return <canvas ref={ref} width={W} height={H} style={style} />;
};
