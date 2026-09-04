import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Layer } from '../components/Layer';
import { Starfield } from '../components/Starfield';
import { NebulaField } from '../components/NebulaField';
import { RadialGlow } from '../components/RadialGlow';
import { MeditationFigure, figureBox } from '../components/MeditationFigure';
import { Bloom } from '../components/Bloom';
import { Grain } from '../components/Grain';
import { Vignette } from '../components/Vignette';
import { CENTRELINE, useFigure } from '../lib/figure';
import { clamp, gauss, wrapDist } from '../lib/rng';
import { hex, PALETTE, RGB, rgba, Stop } from '../lib/palette';

const SEED = 3311;

const FIGURE_HEIGHT = 0.72;
const FIGURE_BOTTOM = 0.955;
const FIGURE_TOP = FIGURE_BOTTOM - FIGURE_HEIGHT;

/**
 * One activation travels base-to-crown every 120 frames. 720 / 120 = 6 whole
 * cycles, so the loop closes exactly.
 */
const CYCLE = 120;

/** Base of the seat up to the crown, in the conventional order and colours. */
const POINTS: { at: number; colour: RGB; idleCycles: number; idlePhase: number }[] = [
  { at: CENTRELINE.root, colour: PALETTE.chakra.root, idleCycles: 3, idlePhase: 0.11 },
  { at: CENTRELINE.sacral, colour: PALETTE.chakra.sacral, idleCycles: 4, idlePhase: 0.62 },
  { at: CENTRELINE.solar, colour: PALETTE.chakra.solar, idleCycles: 2, idlePhase: 0.35 },
  { at: CENTRELINE.heart, colour: PALETTE.chakra.heart, idleCycles: 5, idlePhase: 0.87 },
  { at: CENTRELINE.throat, colour: PALETTE.chakra.throat, idleCycles: 3, idlePhase: 0.44 },
  { at: CENTRELINE.brow, colour: PALETTE.chakra.brow, idleCycles: 4, idlePhase: 0.19 },
  { at: CENTRELINE.crown, colour: PALETTE.chakra.crown, idleCycles: 2, idlePhase: 0.73 },
];

/** Where in the 120-frame cycle each point fires, base first. */
const FIRE_AT = POINTS.map((_, i) => i * 0.108);
const FIRE_WIDTH = 0.042;

const NEBULA: Stop[] = [
  { t: 0.0, c: [0, 0, 0] },
  { t: 0.2, c: [8, 14, 44] },
  { t: 0.46, c: [20, 42, 108] },
  { t: 0.7, c: hex('#2f5fd0') },
  { t: 0.88, c: hex('#5fa8ff') },
  { t: 1.0, c: hex('#dbeaff') },
];

const brightness = (i: number, cyclePos: number, t: number) => {
  const idle = 0.42 + 0.11 * Math.sin(Math.PI * 2 * (t * POINTS[i].idleCycles + POINTS[i].idlePhase));
  const fire = gauss(wrapDist(cyclePos, FIRE_AT[i]), FIRE_WIDTH);
  return clamp(idle + 0.85 * fire);
};

export const Chakra: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const cyclePos = (frame % CYCLE) / CYCLE;
  const figure = useFigure();

  const crownFire = gauss(wrapDist(cyclePos, FIRE_AT[6]), FIRE_WIDTH * 1.5);
  const plume = 0.42 + 0.58 * crownFire;

  /** Draws all seven points; shared by the on-figure layer and the bloom pass. */
  const drawPoints = (ctx: CanvasRenderingContext2D, w: number, h: number, coresOnly: boolean) => {
    if (!figure) return;
    const b = figureBox(figure, w, h, FIGURE_HEIGHT, 0.5, FIGURE_BOTTOM);
    for (let i = 0; i < POINTS.length; i++) {
      const p = POINTS[i];
      const x = b.x + b.w / 2;
      const y = b.y + p.at * b.h;
      const v = brightness(i, cyclePos, t);

      if (!coresOnly) {
        // Soft halo — this is what bleeds the chakra colour onto the silhouette
        // immediately around each point.
        const hr = h * (0.038 + 0.032 * v);
        const halo = ctx.createRadialGradient(x, y, 0, x, y, hr);
        halo.addColorStop(0, rgba(p.colour, 0.85 * v));
        halo.addColorStop(0.32, rgba(p.colour, 0.42 * v));
        halo.addColorStop(1, rgba(p.colour, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(x - hr, y - hr, hr * 2, hr * 2);
      }

      const cr = h * (0.011 + 0.007 * v);
      const core = ctx.createRadialGradient(x, y, 0, x, y, cr);
      core.addColorStop(0, `rgba(255,255,255,${0.55 + 0.45 * v})`);
      core.addColorStop(0.35, rgba(p.colour, 0.95 * v));
      core.addColorStop(1, rgba(p.colour, 0));
      ctx.fillStyle = core;
      ctx.fillRect(x - cr, y - cr, cr * 2, cr * 2);
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#02050f' }}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 85% 85% at 50% 46%, #0a1436 0%, #060d26 48%, #010208 100%)',
        }}
      />

      <Starfield seed={SEED} count={3400} twinkle={0.07} brightness={0.95} />

      <NebulaField
        seed={SEED + 5}
        t={t}
        stops={NEBULA}
        scale={2.8}
        warp={0.85}
        drift={0.12}
        gain={1.0}
        contrast={1.6}
        lanes={0.5}
        opacity={0.62}
      />

      {/* Soft blue glow behind the shoulders. */}
      <RadialGlow
        cx={0.5}
        cy={FIGURE_TOP + 0.3 * FIGURE_HEIGHT}
        radius={0.46}
        aspect={1.25}
        stops={[
          { at: 0, colour: hex('#8fc0ff'), alpha: 0.52 },
          { at: 0.3, colour: hex('#4a86ea'), alpha: 0.3 },
          { at: 0.65, colour: hex('#2b3fa8'), alpha: 0.12 },
          { at: 1, colour: hex('#2b3fa8'), alpha: 0 },
        ]}
      />

      {/*
        Energy column above the crown. It sits *below* the figure layer, so the
        plume rises from behind the head and never lies over the body.
      */}
      <Layer
        res={1 / 4}
        blend="screen"
        draw={(ctx, w, h) => {
          if (!figure) return;
          const b = figureBox(figure, w, h, FIGURE_HEIGHT, 0.5, FIGURE_BOTTOM);
          const x = b.x + b.w / 2;
          const baseY = b.y + CENTRELINE.crown * b.h;
          const slices = 280;

          for (let i = 0; i < slices; i++) {
            const f = i / slices; // 0 at the crown, 1 at the top of frame
            const y = baseY - f * baseY;
            const sliceH = baseY / slices + 1;

            // Widens and fades as it dissipates upward.
            const halfW = h * (0.015 + f * 0.06);
            // Faint striations travelling up the column. Two beating harmonics
            // rather than one, or the plume reads as a stack of plates.
            const striate =
              0.88 +
              0.12 *
                Math.sin(Math.PI * 2 * (f * 6 - t * 4)) *
                (0.55 + 0.45 * Math.sin(Math.PI * 2 * (f * 2.5 - t * 2)));
            const a = plume * striate * Math.pow(1 - f, 1.15) * 0.85;
            if (a <= 0.002) continue;

            const g = ctx.createLinearGradient(x - halfW, 0, x + halfW, 0);
            g.addColorStop(0, rgba(hex('#b98cff'), 0));
            g.addColorStop(0.5, rgba(hex('#e6dcff'), a));
            g.addColorStop(1, rgba(hex('#b98cff'), 0));
            ctx.fillStyle = g;
            ctx.fillRect(x - halfW, y - sliceH, halfW * 2, sliceH);
          }
        }}
      />

      <Bloom
        radius={0.03}
        strength={0.55}
        draw={(ctx, w, h) => drawPoints(ctx, w, h, true)}
      />

      <MeditationFigure figure={figure} height={FIGURE_HEIGHT} cx={0.5} bottom={FIGURE_BOTTOM} />

      {/*
        The one place light is allowed in front of the silhouette: the seven
        points sit on the body, so their halos bleed onto it by design.
      */}
      <Layer res={1 / 2} blend="screen" draw={(ctx, w, h) => drawPoints(ctx, w, h, false)} />

      <Grain amount={0.022} />
      <Vignette strength={0.6} inner={0.36} />
    </AbsoluteFill>
  );
};
