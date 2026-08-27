import React, {useEffect, useMemo, useRef} from 'react';
import type {ConnectionPath, CurvePts, Scene, Vec} from '../geometry';
import {cubicAt} from '../geometry';
import type {VariantConfig} from '../variants';
import {DUR, fract, lsin} from '../motion';
import {mix, rgba} from '../color';

const HALF_SAMPLES = 22;

/**
 * Per-frame geometry of one connection. The junction drifts and its shared
 * tangent wobbles, but c2 of the first half and c1 of the second half stay
 * colinear through the junction, so the joined filaments read as ONE
 * continuous path, never two curves stopping at the same spot.
 */
const connectionHalves = (
  conn: ConnectionPath,
  t01: number,
  driftAmp: number
): {h1: CurvePts; h2: CurvePts; J: Vec} => {
  const jo = driftAmp * 0.8 * lsin(t01, conn.driftFreq[0], conn.driftPhase[0]);
  const J = {x: conn.junction.x + conn.perp.x * jo, y: conn.junction.y + conn.perp.y * jo};
  const tanA = conn.tanAngle + 0.09 * lsin(t01, conn.driftFreq[1], conn.driftPhase[1]);
  const tx = Math.cos(tanA);
  const ty = Math.sin(tanA);
  const co = driftAmp * 0.4 * lsin(t01, conn.driftFreq[1], conn.driftPhase[0] + 0.31);
  const h1: CurvePts = {
    p0: conn.aStart,
    c1: {x: conn.aC1.x + conn.perp.x * co, y: conn.aC1.y + conn.perp.y * co},
    c2: {x: J.x - tx * conn.dIn, y: J.y - ty * conn.dIn},
    p3: J,
  };
  const h2: CurvePts = {
    p0: J,
    c1: {x: J.x + tx * conn.dOut, y: J.y + ty * conn.dOut},
    c2: {x: conn.bC2.x - conn.perp.x * co, y: conn.bC2.y - conn.perp.y * co},
    p3: conn.bEnd,
  };
  return {h1, h2, J};
};

const pathPoint = (h1: CurvePts, h2: CurvePts, u: number): Vec =>
  u < 0.5 ? cubicAt(h1, u * 2) : cubicAt(h2, (u - 0.5) * 2);

const makeGlowSprite = (
  size: number,
  inner: string,
  mid: string,
  midStop: number
): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const h = size / 2;
    const g = ctx.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, inner);
    g.addColorStop(midStop, mid);
    g.addColorStop(1, mid.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return c;
};

/**
 * The wiring of the network: connected filament paths, synapse flares at
 * their junctions, and signal pulses travelling node -> junction -> node.
 * Renders nothing in "isolated" connection mode.
 */
export const SynapseLayer: React.FC<{
  scene: Scene;
  cfg: VariantConfig;
  frame: number;
  width: number;
  height: number;
}> = ({scene, cfg, frame, width, height}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const {palette} = cfg;
  const active = cfg.connectionMode === 'synaptic' && scene.connections.length > 0;

  const sprites = useMemo(
    () => ({
      junction: makeGlowSprite(256, rgba(palette.nodeWhite, 0.95), rgba(palette.nodeHue, 0.55), 0.1),
      pulse: makeGlowSprite(96, rgba(palette.nodeWhite, 1), rgba(palette.filamentPale, 0.55), 0.22),
    }),
    [palette]
  );

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, width, height);
    if (!active) {
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const t01 = frame / DUR;
    const amp = cfg.filament.driftAmp;

    const flares = scene.junctions.map(() => 0);
    const halves = scene.connections.map((conn) => connectionHalves(conn, t01, amp));

    // Connected filament paths
    scene.connections.forEach((conn, ci) => {
      const {h1, h2} = halves[ci];
      const total = HALF_SAMPLES * 2;
      let prev = pathPoint(h1, h2, 0);
      for (let i = 1; i <= total; i++) {
        const u = i / total;
        const pt = pathPoint(h1, h2, u);
        const um = (u + (i - 1) / total) / 2;
        // Thick and bright near the nodes, slimmer through the junction
        const endness = Math.pow(Math.abs(1 - 2 * um), 0.85);
        const w = conn.width * (0.35 + 0.65 * endness) + 0.3;
        const a = conn.alpha * cfg.filamentAlphaScale * (0.4 + 0.6 * endness);
        const colorT = 1 - Math.abs(1 - 2 * um);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = mix(palette.filamentPale, palette.filament, colorT, a * 0.13);
        ctx.lineWidth = w * 2.8;
        ctx.stroke();
        ctx.strokeStyle = mix(palette.filamentPale, palette.filament, colorT, a);
        ctx.lineWidth = w;
        ctx.stroke();
        prev = pt;
      }

      // Pulse arrivals feed the junction flare (junction sits at u = 0.5)
      for (const pulse of conn.pulses) {
        const u = fract((pulse.dir * frame) / pulse.period + pulse.phase);
        const framesFromJunction = (u - 0.5) * pulse.period;
        flares[conn.junctionIndex] += Math.exp(-((framesFromJunction / 2.4) ** 2));
      }
    });

    // Synapse flares: small node-like glows, pulsing on their own sines
    scene.junctions.forEach((j, ji) => {
      const flare = Math.min(1.4, flares[ji]);
      const base = 0.42 + 0.18 * lsin(t01, j.pulseFreq, j.pulsePhase);
      const alpha = Math.min(1, base + 0.75 * flare);
      const size = 132 * (1 + 0.35 * Math.min(1, flare));
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprites.junction, j.pos.x - size / 2, j.pos.y - size / 2, size, size);
      ctx.globalAlpha = 1;
    });

    // Signal pulses travelling along the connected paths
    scene.connections.forEach((conn, ci) => {
      const {h1, h2} = halves[ci];
      for (const pulse of conn.pulses) {
        const u = fract((pulse.dir * frame) / pulse.period + pulse.phase);
        const steps = pulse.tail ? 3 : 1;
        for (let k = 0; k < steps; k++) {
          // Comet tail: sample the curve slightly behind the head
          const uk = u - pulse.dir * 0.011 * k;
          if (uk < 0 || uk > 1) {
            continue;
          }
          const pos = pathPoint(h1, h2, uk);
          const size = pulse.size * 3.2 * Math.pow(0.72, k);
          ctx.globalAlpha = 0.9 * Math.pow(0.5, k);
          ctx.drawImage(sprites.pulse, pos.x - size / 2, pos.y - size / 2, size, size);
        }
      }
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, [scene, cfg, frame, width, height, sprites, palette, active]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}
    />
  );
};
