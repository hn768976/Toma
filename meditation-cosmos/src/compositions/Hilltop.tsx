import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Layer } from '../components/Layer';
import { Starfield } from '../components/Starfield';
import { NebulaField } from '../components/NebulaField';
import { RadialGlow } from '../components/RadialGlow';
import { MeditationFigure } from '../components/MeditationFigure';
import { Bloom } from '../components/Bloom';
import { Grain } from '../components/Grain';
import { Vignette } from '../components/Vignette';
import { useFigure } from '../lib/figure';
import { fbm } from '../lib/noise';
import { gauss, mulberry32, smoothstep } from '../lib/rng';
import { hex, PALETTE, rgba, Stop } from '../lib/palette';

const SEED = 1107;

/** Silhouette placement, as fractions of the frame. */
const FIGURE_HEIGHT = 0.215;
const FIGURE_BOTTOM = 0.706;
const CREST = 0.686;
/** The burst sits just above the crown. */
const BURST_Y = FIGURE_BOTTOM - FIGURE_HEIGHT - 0.02;

const NEBULA: Stop[] = [
  { t: 0.0, c: [0, 0, 0] },
  { t: 0.14, c: [14, 5, 34] },
  { t: 0.32, c: [46, 20, 96] },
  { t: 0.5, c: [96, 56, 190] },
  { t: 0.62, c: PALETTE.violet },
  { t: 0.74, c: PALETTE.magenta },
  { t: 0.86, c: hex('#ffb765') },
  { t: 1.0, c: hex('#e8f2ff') },
];

/** Height of the hilltop at a given x, in composition pixels. */
const hillY = (x: number, w: number, h: number) => {
  const u = x / w;
  const arc = CREST + 0.5 * (1 - gauss(u - 0.5, 0.44));
  // A little low-frequency wobble so the ridge is not a clean parabola.
  const wobble = (fbm(u * 3.4, 0, SEED + 5, 3) - 0.5) * 0.02;
  return (arc + wobble * gauss(u - 0.5, 0.5)) * h;
};

const RAYS = (() => {
  const rnd = mulberry32(SEED + 91);
  // Five rays fanning down and outward, at varied angles, avoiding straight down.
  const base = [148, 121, 94, 63, 33];
  return base.map((deg, i) => ({
    angle: ((deg + (rnd() - 0.5) * 12) * Math.PI) / 180,
    halfWidth: (0.024 + rnd() * 0.016) * Math.PI,
    length: 1.05 + rnd() * 0.35,
    alpha: 0.17 + rnd() * 0.07,
    cycles: 1 + Math.floor(rnd() * 3),
    phase: rnd(),
    warm: i % 2 === 0,
  }));
})();

const RAY_RES = 1 / 6;

export const Hilltop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const figure = useFigure();

  // The burst pulses gently; everything else in frame is dead still.
  const pulse = 0.5 + 0.5 * Math.sin(Math.PI * 2 * t);
  const burstScale = 1 + 0.045 * pulse;
  const burstAlpha = 0.86 + 0.14 * pulse;

  return (
    <AbsoluteFill style={{ backgroundColor: '#04030c' }}>
      {/* Deep blue-black sky, lifting very slightly toward the horizon. */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, #05030f 0%, #080519 38%, #0c0722 62%, #060410 100%)',
        }}
      />

      <Starfield seed={SEED} count={3200} twinkle={0.07} brightness={0.9} />

      {/* Violet-magenta nebula fanning up from the burst and filling the top half. */}
      <NebulaField
        seed={SEED + 3}
        t={t}
        stops={NEBULA}
        scale={2.4}
        warp={1.05}
        drift={0.16}
        gain={1.28}
        contrast={1.35}
        lanes={0.5}
        opacity={0.95}
        mask={(u, v) => {
          const vertical = smoothstep(0.8, 0.24, v);
          // Widens as it rises, so the cloud reads as fanning out of the burst.
          const spread = 0.26 + Math.max(0, BURST_Y - v) * 1.35;
          const fan = 0.32 + 0.68 * gauss(u - 0.5, spread);
          return vertical * fan;
        }}
      />

      {/* The burst itself: blown out to white at the core. */}
      <RadialGlow
        cx={0.5}
        cy={BURST_Y}
        radius={0.52 * burstScale}
        opacity={burstAlpha}
        stops={[
          { at: 0, colour: [255, 255, 255], alpha: 1 },
          { at: 0.05, colour: [255, 255, 255], alpha: 0.98 },
          { at: 0.12, colour: hex('#dceaff'), alpha: 0.74 },
          { at: 0.26, colour: hex('#9b7bf0'), alpha: 0.34 },
          { at: 0.52, colour: PALETTE.magenta, alpha: 0.13 },
          { at: 1, colour: PALETTE.magenta, alpha: 0 },
        ]}
      />

      <Bloom
        radius={0.05}
        strength={0.7}
        draw={(ctx, w, h) => {
          const r = 0.16 * h * burstScale;
          const g = ctx.createRadialGradient(0.5 * w, BURST_Y * h, 0, 0.5 * w, BURST_Y * h, r);
          g.addColorStop(0, `rgba(255,255,255,${burstAlpha})`);
          g.addColorStop(0.45, rgba(hex('#cfe0ff'), 0.4 * burstAlpha));
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }}
      />

      {/* Pure black hill, filling the bottom third. */}
      <Layer
        res={1}
        draw={(ctx, w, h) => {
          ctx.beginPath();
          ctx.moveTo(0, h);
          const steps = 220;
          for (let i = 0; i <= steps; i++) {
            const x = (i / steps) * w;
            ctx.lineTo(x, hillY(x, w, h));
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fillStyle = '#000000';
          ctx.fill();
        }}
      />

      {/* Rays fan down the slope, over the hill but never over the figure. */}
      <Layer
        res={RAY_RES}
        blend="screen"
        draw={(ctx, w, h) => {
          const ox = 0.5 * w;
          const oy = (FIGURE_BOTTOM - FIGURE_HEIGHT * 0.45) * h;
          const reach = Math.hypot(w, h);
          // Heavy blur: these have to read as haze lying over the slope, not as
          // wedges with edges. The wedge is only a way of aiming the light.
          ctx.filter = `blur(${(0.022 * h * RAY_RES).toFixed(1)}px)`;
          for (const ray of RAYS) {
            const breathe = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (t * ray.cycles + ray.phase));
            const a = ray.alpha * (0.45 + 0.55 * breathe);
            const len = reach * ray.length;
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(ray.angle);
            const g = ctx.createLinearGradient(0, 0, len, 0);
            const tint = ray.warm ? hex('#ffeada') : hex('#ded2ff');
            // Brightest right behind the figure, trailing off down the slope.
            g.addColorStop(0, rgba(tint, a));
            g.addColorStop(0.2, rgba(tint, a * 0.72));
            g.addColorStop(0.55, rgba(tint, a * 0.28));
            g.addColorStop(1, rgba(tint, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(len, Math.tan(ray.halfWidth) * len);
            ctx.lineTo(len, -Math.tan(ray.halfWidth) * len);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          ctx.filter = 'none';
        }}
      />

      <MeditationFigure figure={figure} height={FIGURE_HEIGHT} cx={0.5} bottom={FIGURE_BOTTOM} />

      <Grain amount={0.024} />
      <Vignette strength={0.6} inner={0.38} />
    </AbsoluteFill>
  );
};
