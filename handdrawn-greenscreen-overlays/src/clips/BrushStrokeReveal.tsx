// p5.brush (standalone build) ink brush band. The library has no clock of its
// own here: every frame we re-seed it, clear the canvas, redraw the whole
// stroke from scratch for this frame, and flush with brush.render().
import * as brush from 'p5.brush/standalone';
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, continueRender, delayRender, Easing, useCurrentFrame } from 'remotion';
import { GREEN, H, INK, W } from '../lib/config';
import { clamp01, lerp } from '../lib/geom';
import { handEase } from '../lib/pen';
import { boilStep, hashKeys, onTwos, range, rngFor, signed } from '../lib/random';

const ID = 'GS_BrushStrokeReveal';
export const BRUSH_STROKE_FRAMES = 120;

const INK_RGB = [1, 3, 5].map((i) => parseInt(INK.main.slice(i, i + 2), 16) / 255);
const BAND = H * 0.35; // band height
const CY = H / 2 + 20;
const X0 = 170; // left end of the band
const X1 = 3680; // right end
const SWEEP_END = 45; // 1.5 s
const WIPE_FROM = 105; // 3.5 s
const WIPE_TO = 114;
/** Below 4K the canvas is supersampled 1.5x so brush grain edges come out antialiased (4K draws 1:1). */
const SUPERSAMPLE = 1.5;

interface Bristle {
  y: number; // offset from centre line
  x0: number; // where it touches down
  x1: number; // where it lifts off
  w: number; // weight (px at 4K)
  breaks: [number, number][]; // dry gaps, as fractions along it
  wander: number[]; // vertical wander control values
  lag: number; // how far behind the head it is (px)
  tone: string;
}

/** Centre line of the stroke: a gentle arc, rising a touch to the right. */
const centreY = (x: number) => {
  const u = (x - X0) / (X1 - X0);
  return CY + 46 * Math.sin(Math.PI * u) - 70 * (u - 0.5);
};
/** Half-height along the stroke: pressed hard at the start, lifting at the end. */
const halfH = (x: number) => {
  const u = clamp01((x - X0) / (X1 - X0));
  return (BAND / 2) * (1.02 + 0.05 * Math.sin(Math.PI * u * 1.3) - 0.1 * Math.pow(u, 3));
};

const buildBristles = (): Bristle[] => {
  const r = rngFor(ID, 'bristles');
  const out: Bristle[] = [];
  const n = 96;
  for (let i = 0; i < n; i++) {
    const v = (i + 0.5) / n; // 0..1 across the band
    const edge = Math.abs(v - 0.5) * 2; // 0 centre, 1 edge
    const y = (v - 0.5) * 2 * 1.04; // in half-heights
    const dryness = Math.pow(edge, 1.8);
    const x0 = X0 + range(r, 0, 70) + dryness * range(r, 30, 300) + Math.pow(r(), 3) * 160;
    const x1 = X1 - range(r, 0, 90) - dryness * range(r, 60, 520) - Math.pow(r(), 2) * 260;
    const breaks: [number, number][] = [];
    const nb = edge > 0.8 ? Math.floor(range(r, 2, 7)) : edge > 0.6 ? Math.floor(range(r, 0, 3.5)) : r() < 0.25 ? 1 : 0;
    for (let b = 0; b < nb; b++) {
      const at = r() < 0.5 ? range(r, 0.55, 0.98) : range(r, 0.03, 0.97); // drier towards the lift-off
      breaks.push([at, at + range(r, 0.008, edge > 0.8 ? 0.09 : 0.035)]);
    }
    out.push({
      y,
      x0,
      x1,
      w: edge > 0.85 ? range(r, 9, 18) : range(r, 18, 38),
      breaks,
      wander: Array.from({ length: 7 }, () => signed(r, 6 + edge * 12)),
      lag: range(r, 0, 60) + dryness * 140,
      tone: edge < 0.8 && r() < 0.3 ? '#3a3a3a' : INK.main,
    });
  }
  return out;
};

const ragged = (seed: string, n: number, amp: number) => {
  const r = rngFor(ID, seed);
  return Array.from({ length: n }, () => signed(r, amp));
};

export const BrushStrokeReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ready = useRef(false);
  const bristles = useMemo(buildBristles, []);
  const topEdge = useMemo(() => ragged('top', 80, 16), []);
  const botEdge = useMemo(() => ragged('bot', 80, 16), []);
  const leftEdge = useMemo(() => ragged('left', 24, 110), []);
  const rightEdge = useMemo(() => ragged('right', 24, 75), []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const handle = delayRender('p5.brush frame');
    const deviceRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const dpr = deviceRatio < 1 ? deviceRatio * SUPERSAMPLE : deviceRatio;
    const cw = Math.round(W * dpr);
    const ch = Math.round(H * dpr);
    if (!ready.current || canvas.width !== cw) {
      canvas.width = cw;
      canvas.height = ch;
      brush.load(canvas);
      ready.current = true;
    }
    const k = cw / W; // 4K units -> canvas px
    const f = onTwos(frame);
    const step = boilStep(frame);

    // head (sweep) and tail (wipe-off) positions
    const sweep = handEase(clamp01(f / SWEEP_END));
    const head = lerp(X0 - 200, X1 + 420, sweep);
    const wipe = Easing.in(Easing.quad)(clamp01((f - WIPE_FROM) / (WIPE_TO - WIPE_FROM)));
    const tail = f >= WIPE_FROM ? lerp(X0 - 450, X1 + 450, wipe) : -Infinity;

    brush.seed(hashKeys(ID, step));
    brush.noiseSeed(hashKeys(ID, 'noise', step));
    brush.clear();
    // brush.clear() leaves transparent *white* (1,1,1,0), which is invalid in a
    // premultiplied-alpha canvas and composites as white: clear to (0,0,0,0).
    const gl = canvas.getContext('webgl2');
    if (gl) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    brush.push();
    brush.translate(-cw / 2, -ch / 2);

    // boil: tiny seeded offset, new every 3 frames
    const br = rngFor(ID, 'boil', step);
    const bx = signed(br, 2.5);
    const by = signed(br, 2.5);
    const P = (x: number, y: number) => [(x + bx) * k, (y + by) * k];

    // solid core: a flat wash, narrower than the bristles so the edges stay dry
    const coreL = Math.max(X0 + 260, tail + 160);
    const coreR = Math.min(X1 - 420, head - 220);
    if (coreR > coreL + 20) {
      const pts: number[][] = [];
      const n = 60;
      const ch2 = (x: number) => halfH(x) * 0.8;
      for (let i = 0; i <= n; i++) {
        const x = lerp(coreL, coreR, i / n);
        pts.push(P(x, centreY(x) - ch2(x) + topEdge[Math.floor((x / W) * 79)]));
      }
      for (let j = 0; j <= 12; j++) {
        const y = lerp(centreY(coreR) - ch2(coreR), centreY(coreR) + ch2(coreR), j / 12);
        pts.push(P(coreR + Math.abs(rightEdge[j]), y));
      }
      for (let i = n; i >= 0; i--) {
        const x = lerp(coreL, coreR, i / n);
        pts.push(P(x, centreY(x) + ch2(x) + botEdge[Math.floor((x / W) * 79)]));
      }
      for (let j = 12; j >= 0; j--) {
        const y = lerp(centreY(coreL) - ch2(coreL), centreY(coreL) + ch2(coreL), j / 12);
        pts.push(P(coreL - Math.abs(leftEdge[j]), y));
      }
      brush.noStroke();
      brush.noHatch();
      brush.wash(INK.main, 255);
      brush.polygon(pts);
      brush.noWash();
    }

    // bristles: dry-brush streaks, ragged starts and lift-offs
    bristles.forEach((b, i) => {
      const a = Math.max(b.x0, tail);
      const e = Math.min(b.x1, head - b.lag);
      if (e - a < 30) return;
      // pieces between dry gaps
      const cuts: [number, number][] = [];
      let s = 0;
      for (const [g0, g1] of [...b.breaks].sort((p, q) => p[0] - q[0])) {
        cuts.push([s, g0]);
        s = g1;
      }
      cuts.push([s, 1]);
      // a plain bristle inside the solid core can't be seen: only draw it where it
      // pokes out (the ragged ends). Edge bristles and lighter streaks draw in full.
      const hidden = Math.abs(b.y) < 0.72 && b.tone === INK.main && coreR > coreL + 200 ? [coreL + 90, coreR - 90] : null;
      const pieces: [number, number, string][] = [];
      cuts.forEach(([c0, c1], ci) => {
        const xa = Math.max(a, lerp(b.x0, b.x1, c0));
        const xb = Math.min(e, lerp(b.x0, b.x1, c1));
        if (!hidden) pieces.push([xa, xb, `${ci}`]);
        else {
          pieces.push([xa, Math.min(xb, hidden[0]), `${ci}L`]);
          pieces.push([Math.max(xa, hidden[1]), xb, `${ci}R`]);
        }
      });
      pieces.forEach(([xa, xb, ci]) => {
        if (xb - xa < 24) return;
        brush.seed(hashKeys(ID, 'bristle', i, ci, step));
        const pts: number[][] = [];
        const m = 6;
        for (let j = 0; j <= m; j++) {
          const x = lerp(xa, xb, j / m);
          const u = (x - b.x0) / (b.x1 - b.x0);
          const wv = b.wander[Math.min(6, Math.floor(u * 6))];
          const p = P(x, centreY(x) + b.y * halfH(x) + wv);
          // pressure: firm in the middle, light at touch-down and lift-off
          p.push(0.55 + 0.6 * Math.sin(Math.PI * clamp01(u)));
          pts.push(p);
        }
        brush.set('charcoal', b.tone, (b.w * k) / 2.2);
        brush.spline(pts, 0.6);
      });
    });

    brush.pop();
    brush.render();
    continueRender(handle);
  }, [frame, bristles, topEdge, botEdge, leftEdge, rightEdge]);

  return (
    <AbsoluteFill style={{ backgroundColor: GREEN }}>
      {/* p5.brush mixes its grains as if on white paper; for a clean key use the
          canvas as coverage only: exact ink colour, alpha steepened so faint grains
          are either ink or nothing (no blur, nothing reaches the green). */}
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id="inkify" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="matrix" values={`0.04 0 0 0 ${INK_RGB[0]}  0.04 0 0 0 ${INK_RGB[1]}  0.04 0 0 0 ${INK_RGB[2]}  0 0 0 1 0`} />
          <feComponentTransfer>
            <feFuncA type="linear" slope={2.4} intercept={-0.6} />
          </feComponentTransfer>
          {/* morphological close: seals single-pixel pinholes in the grain (no blur) */}
          <feMorphology operator="dilate" radius={2} />
          <feMorphology operator="erode" radius={2} />
        </filter>
      </svg>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'url(#inkify)' }} />
    </AbsoluteFill>
  );
};
