import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Layer } from '../components/Layer';
import { Starfield } from '../components/Starfield';
import { NebulaField } from '../components/NebulaField';
import { MeditationFigure } from '../components/MeditationFigure';
import { Bloom } from '../components/Bloom';
import { Grain } from '../components/Grain';
import { Vignette } from '../components/Vignette';
import { useFigure } from '../lib/figure';
import { fbm } from '../lib/noise';
import { clamp, gauss } from '../lib/rng';
import { hex, ramp, rgba, Stop } from '../lib/palette';

const SEED = 2204;

const FIGURE_HEIGHT = 0.66;
const FIGURE_BOTTOM = 0.96;
/** Roughly 0.55 x frame height across, so 0.275 of the height as a radius. */
const ORB_R = 0.29;
const ORB_CX = 0.5;
const ORB_CY = 0.44;
const ORB_RES = 1 / 6;

/** White-hot core, cyan mid-falloff, fading out into violet. */
const ORB: Stop[] = [
  { t: 0.0, c: [0, 0, 0] },
  { t: 0.07, c: hex('#2a0a63') },
  { t: 0.24, c: hex('#4c2ad0') },
  { t: 0.44, c: hex('#5b7ff0') },
  { t: 0.62, c: hex('#22d3ee') },
  { t: 0.8, c: hex('#bdf1ff') },
  { t: 1.0, c: [255, 255, 255] },
];

const NEBULA: Stop[] = [
  { t: 0.0, c: [0, 0, 0] },
  { t: 0.13, c: [15, 6, 38] },
  { t: 0.32, c: [54, 20, 114] },
  { t: 0.54, c: hex('#5b21b6') },
  { t: 0.7, c: hex('#8b3ce0') },
  { t: 0.85, c: hex('#c026d3') },
  { t: 1.0, c: hex('#f2dcff') },
];

export const Orb: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const figure = useFigure();

  // Breathes by +/-3%, and turns its internal structure exactly once per loop.
  const breathe = 1 + 0.03 * Math.sin(Math.PI * 2 * t);
  const rot = Math.PI * 2 * t;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0424' }}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 90% 90% at 50% 42%, #150737 0%, #0d0429 46%, #050115 100%)',
        }}
      />

      <Starfield seed={SEED} count={2400} twinkle={0.06} brightness={0.65} />

      {/* Dense purple nebula filling the whole frame. */}
      <NebulaField
        seed={SEED + 7}
        t={t}
        stops={NEBULA}
        scale={3.1}
        warp={1.15}
        drift={0.14}
        gain={1.12}
        contrast={1.7}
        lanes={0.62}
        opacity={0.72}
        // Held back a little right behind the orb so the orb stays the brightest
        // thing in frame.
        mask={(u, v) => 1 - 0.6 * gauss(Math.hypot((u - ORB_CX) * (16 / 9), v - ORB_CY), 0.24)}
      />

      {/* The orb: a luminous cloud with a noise-perturbed edge, not a drawn disc. */}
      <Layer
        res={ORB_RES}
        blend="screen"
        draw={(ctx, w, h) => {
          const bw = Math.round(w * ORB_RES);
          const bh = Math.round(h * ORB_RES);
          const image = ctx.createImageData(bw, bh);
          const px = image.data;
          const aspect = w / h;
          const R = ORB_R * breathe;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);

          for (let y = 0; y < bh; y++) {
            const dy = y / bh - ORB_CY;
            for (let x = 0; x < bw; x++) {
              const dx = (x / bw - ORB_CX) * aspect;
              const i = (y * bw + x) * 4;
              const r = Math.hypot(dx, dy);

              if (r > R * 1.55) {
                px[i] = 0;
                px[i + 1] = 0;
                px[i + 2] = 0;
                px[i + 3] = 255;
                continue;
              }

              // Rotating the sample point turns the internal structure. A whole
              // turn over the loop lands back on exactly the same field.
              const rx = dx * cos - dy * sin;
              const ry = dx * sin + dy * cos;
              const n = fbm(rx * 7.5 + 3.1, ry * 7.5 + 7.7, SEED + 13, 4);
              // A separate, much finer field perturbs the boundary. Using the
              // coarse structure noise for this scalloped the edge into regular
              // lobes and read as a cartoon cloud.
              const edge = fbm(rx * 26 + 11.3, ry * 26 + 4.9, SEED + 41, 3);

              const d = r / (R * (1 + 0.055 * (n - 0.5) * 2 + 0.05 * (edge - 0.5) * 2));
              let v = Math.pow(clamp(1 - d), 0.82);

              // Let the internal structure modulate the body of the orb but
              // leave the hot centre alone, so the core stays put.
              const centre = Math.pow(clamp(1 - d / 0.5), 2);
              const structure = 0.66 + 0.7 * n;
              v *= structure * (1 - centre) + centre;

              v = clamp(v + 0.9 * Math.pow(clamp(1 - d / 0.55), 2.2));
              // A soft outer haze so the orb dissolves into the nebula rather
              // than ending on a defined rim.
              v += 0.15 * Math.exp(-Math.pow(Math.max(0, d - 0.82) / 0.4, 2));

              const c = ramp(ORB, clamp(v));
              px[i] = c[0];
              px[i + 1] = c[1];
              px[i + 2] = c[2];
              px[i + 3] = 255;
            }
          }
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.putImageData(image, 0, 0);
          ctx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
        }}
      />

      <Bloom
        radius={0.045}
        strength={0.6}
        draw={(ctx, w, h) => {
          const r = ORB_R * breathe * h * 0.78;
          const g = ctx.createRadialGradient(ORB_CX * w, ORB_CY * h, 0, ORB_CX * w, ORB_CY * h, r);
          g.addColorStop(0, 'rgba(255,255,255,0.85)');
          g.addColorStop(0.35, rgba(hex('#7fe8ff'), 0.42));
          g.addColorStop(0.72, rgba(hex('#8b5cf6'), 0.14));
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }}
      />

      <MeditationFigure figure={figure} height={FIGURE_HEIGHT} cx={0.5} bottom={FIGURE_BOTTOM} />

      <Grain amount={0.022} />
      <Vignette strength={0.58} inner={0.4} />
    </AbsoluteFill>
  );
};
