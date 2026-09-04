import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Layer } from '../components/Layer';
import { NebulaField } from '../components/NebulaField';
import { MeditationFigure, figureBox } from '../components/MeditationFigure';
import { Bloom } from '../components/Bloom';
import { Grain } from '../components/Grain';
import { Vignette } from '../components/Vignette';
import { CENTRELINE, KeyedFigure, useFigure } from '../lib/figure';
import { mulberry32 } from '../lib/rng';
import { hex, RGB, rgba, Stop } from '../lib/palette';

const SEED = 4419;

const FIGURE_HEIGHT = 0.56;
const FIGURE_BOTTOM = 0.715;
const FIGURE_TOP = FIGURE_BOTTOM - FIGURE_HEIGHT;

/** The vortex core sits off-centre, behind the figure's chest. */
const CORE_X = 0.542;
const CORE_Y = FIGURE_TOP + CENTRELINE.heart * FIGURE_HEIGHT;

/** Exactly two whole turns over the 600-frame loop. */
const TURNS_PER_LOOP = 2;

const FILAMENT_COLOURS: RGB[] = [
  hex('#c026d3'),
  hex('#7a4ae8'),
  hex('#22d3ee'),
  hex('#ff5fc4'),
  hex('#9b5cff'),
  hex('#5fe0ff'),
];

const NEBULA: Stop[] = [
  { t: 0.0, c: [0, 0, 0] },
  { t: 0.16, c: [22, 8, 52] },
  { t: 0.4, c: [72, 22, 140] },
  { t: 0.62, c: hex('#7a4ae8') },
  { t: 0.82, c: hex('#c026d3') },
  { t: 1.0, c: hex('#ffd9f5') },
];

type Filament = {
  theta0: number;
  rStart: number;
  turns: number;
  decay: number;
  span: number;
  width: number;
  alpha: number;
  colour: RGB;
  phase: number;
};

const FILAMENTS: Filament[] = (() => {
  const rnd = mulberry32(SEED);
  const out: Filament[] = [];
  for (let i = 0; i < 240; i++) {
    out.push({
      theta0: rnd() * Math.PI * 2,
      rStart: 0.2 + Math.pow(rnd(), 0.72) * 1.05,
      turns: 0.8 + rnd() * 1.1,
      decay: 0.5 + rnd() * 0.4,
      span: 0.75 + rnd() * 0.5,
      width: 0.0012 + Math.pow(rnd(), 2) * 0.0055,
      alpha: 0.18 + rnd() * 0.4,
      colour: FILAMENT_COLOURS[i % FILAMENT_COLOURS.length],
      phase: rnd(),
    });
  }
  return out;
})();

const drawVortex = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  scale: number,
) => {
  const cx = CORE_X * w;
  const cy = CORE_Y * h;
  const rot = Math.PI * 2 * TURNS_PER_LOOP * t;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  for (const f of FILAMENTS) {
    // Each filament slides inward along its own spiral. The envelope takes the
    // alpha to zero at both ends of the drift, so the reset is never visible.
    const p = (t + f.phase) % 1;
    const envelope = Math.pow(Math.sin(Math.PI * p), 0.7);
    const a = f.alpha * envelope * scale;
    if (a <= 0.004) continue;

    ctx.beginPath();
    // Enough segments for the filament's actual angular sweep, or the long
    // outer arcs render as visible polygons.
    const steps = Math.ceil(20 + f.turns * f.span * 70);
    for (let k = 0; k <= steps; k++) {
      const s = (k / steps) * f.span + p * 0.5;
      const ang = f.theta0 + s * Math.PI * 2 * f.turns + rot;
      const r = f.rStart * Math.exp(-f.decay * s * Math.PI * 2 * f.turns * 0.42) * h;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r * 0.92;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(f.colour, a);
    ctx.lineWidth = f.width * h;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
};

/**
 * A mirrored, dimmer, vertically compressed copy of the figure, as if it were
 * seated on a dark reflective surface. Drawn in horizontal slices so a gentle
 * ripple can be applied down its length.
 */
const Reflection: React.FC<{ figure: KeyedFigure | null; t: number }> = ({ figure, t }) => (
  <Layer
    res={1 / 2}
    opacity={0.72}
    filter="blur(9px)"
    draw={(ctx, w, h) => {
      if (!figure) return;
      const b = figureBox(figure, w, h, FIGURE_HEIGHT, 0.5, FIGURE_BOTTOM);
      const waterline = b.y + b.h;
      const compress = 0.45;
      const slices = 130;

      ctx.save();
      ctx.translate(0, waterline);
      ctx.scale(1, -compress);

      for (let i = 0; i < slices; i++) {
        const f0 = i / slices;
        const f1 = (i + 1) / slices;
        // The flip means f0 = 0 is the top of the figure, which lands deepest.
        const depth = 1 - f0;
        const alpha = Math.pow(1 - depth, 1.15);
        if (alpha <= 0.004) continue;

        const dx = 0.009 * w * depth * Math.sin(Math.PI * 2 * (depth * 3 - t));
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          figure.canvas,
          0,
          f0 * figure.height,
          figure.width,
          (f1 - f0) * figure.height,
          b.x + dx,
          -b.h + f0 * b.h,
          b.w,
          (f1 - f0) * b.h + 1,
        );
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }}
  />
);

export const Vortex: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const figure = useFigure();

  const heartPulse = 0.78 + 0.22 * Math.sin(Math.PI * 2 * t * 2);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0d0327' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 95% 95% at ${CORE_X * 100}% ${
            CORE_Y * 100
          }%, #2a0b63 0%, #170541 40%, #08021a 100%)`,
        }}
      />

      <NebulaField
        seed={SEED + 2}
        t={t}
        stops={NEBULA}
        scale={3.4}
        warp={1.25}
        drift={0.13}
        gain={1.1}
        contrast={1.65}
        lanes={0.55}
        opacity={0.68}
      />

      {/* Curved filaments spiralling into the core — the only real rotation. */}
      <Layer res={1 / 2} blend="screen" draw={(ctx, w, h) => drawVortex(ctx, w, h, t, 1)} />

      {/* The white-hot centre. */}
      <Layer
        res={1 / 4}
        blend="screen"
        draw={(ctx, w, h) => {
          const r = 0.3 * h;
          const g = ctx.createRadialGradient(CORE_X * w, CORE_Y * h, 0, CORE_X * w, CORE_Y * h, r);
          g.addColorStop(0, 'rgba(255,255,255,0.95)');
          g.addColorStop(0.08, rgba(hex('#ffe6fb'), 0.7));
          g.addColorStop(0.24, rgba(hex('#c026d3'), 0.32));
          g.addColorStop(0.55, rgba(hex('#7a4ae8'), 0.12));
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }}
      />

      <Bloom
        radius={0.04}
        strength={0.55}
        draw={(ctx, w, h) => {
          drawVortex(ctx, w, h, t, 0.85);
          const r = 0.14 * h;
          const g = ctx.createRadialGradient(CORE_X * w, CORE_Y * h, 0, CORE_X * w, CORE_Y * h, r);
          g.addColorStop(0, 'rgba(255,255,255,0.9)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }}
      />

      <Reflection figure={figure} t={t} />

      <MeditationFigure figure={figure} height={FIGURE_HEIGHT} cx={0.5} bottom={FIGURE_BOTTOM} />

      {/* A bright point at the heart — on the body, so drawn over the figure. */}
      <Layer
        res={1 / 2}
        blend="screen"
        draw={(ctx, w, h) => {
          if (!figure) return;
          const b = figureBox(figure, w, h, FIGURE_HEIGHT, 0.5, FIGURE_BOTTOM);
          const x = b.x + b.w / 2;
          const y = b.y + CENTRELINE.heart * b.h;
          const r = 0.055 * h * heartPulse;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(255,255,255,${0.95 * heartPulse})`);
          g.addColorStop(0.16, rgba(hex('#ffd9fb'), 0.7 * heartPulse));
          g.addColorStop(0.45, rgba(hex('#e879f9'), 0.26 * heartPulse));
          g.addColorStop(1, rgba(hex('#c026d3'), 0));
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }}
      />

      <Grain amount={0.022} />
      <Vignette strength={0.62} inner={0.34} />
    </AbsoluteFill>
  );
};
