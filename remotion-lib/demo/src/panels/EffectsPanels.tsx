import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FrameCanvas, Panel } from "../Panel";
import { THEME } from "../theme";
import {
  bloomPass,
  bucketByDepth,
  grainPass,
  lowResUpscale,
  threeBufferDOF,
  vignettePass,
} from "../../../src/effects";
import { loopPhase } from "../../../src/random";
import { seededRandom } from "../../../src/random/seededRandom";

const WIDTH = 1920;
const HEIGHT = 1080;
const FULL: React.CSSProperties = { position: "absolute", inset: 0 };

type Mote = { x: number; y: number; r: number; depth: number };

/** A fixed field of motes, bucketed by depth. Generated once. */
const MOTES: Mote[] = Array.from({ length: 260 }, (_, i) => ({
  x: 200 + seededRandom(i, 10) * 1520,
  y: 260 + seededRandom(i, 20) * 620,
  r: 4 + seededRandom(i, 30) * 16,
  depth: seededRandom(i, 40),
}));

export const ThreeBufferDOFPanel: React.FC = () => {
  const draw = React.useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      const buckets = bucketByDepth(MOTES, (m) => m.depth);
      const drift = (m: Mote, amount: number) =>
        m.x + Math.sin(frame / 40 + m.y) * amount;

      const paint = (list: Mote[], color: string, amount: number) =>
        (c: CanvasRenderingContext2D) => {
          c.fillStyle = color;
          for (const m of list) {
            c.beginPath();
            c.arc(drift(m, amount), m.y, m.r, 0, Math.PI * 2);
            c.fill();
          }
        };

      threeBufferDOF({
        ctx,
        width: WIDTH,
        height: HEIGHT,
        farBlur: 14,
        midBlur: 5,
        nearBlur: 0,
        far: paint(buckets.far, THEME.accent, 26),
        mid: paint(buckets.mid, THEME.accentSoft, 14),
        near: paint(buckets.near, THEME.hot, 6),
      });
    },
    [],
  );

  return (
    <Panel
      title="threeBufferDOF"
      importPath="remotion-lib/src/effects"
      note="260 motes bucketed far/mid/near. Three whole-buffer blurs, not 260 per-element ones — the difference between a frame that renders and one that does not, at 4K."
    >
      <FrameCanvas width={WIDTH} height={HEIGHT} draw={draw} style={FULL} />
    </Panel>
  );
};

export const BloomPassPanel: React.FC = () => {
  const draw = React.useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      const t = loopPhase(frame, 60);
      bloomPass({
        ctx,
        width: WIDTH,
        height: HEIGHT,
        blurPx: 26,
        strength: 0.9,
        draw: (c) => {
          c.strokeStyle = THEME.cool;
          c.lineWidth = 6;
          c.beginPath();
          for (let i = 0; i <= 200; i++) {
            const x = 260 + (i / 200) * 1400;
            const y =
              600 + Math.sin(i / 12 + t * Math.PI * 2) * 130 * Math.sin((i / 200) * Math.PI);
            if (i === 0) c.moveTo(x, y);
            else c.lineTo(x, y);
          }
          c.stroke();

          c.fillStyle = THEME.hot;
          for (let i = 0; i < 9; i++) {
            const p = loopPhase(frame, 60, i / 9);
            c.beginPath();
            c.arc(260 + p * 1400, 600, 9, 0, Math.PI * 2);
            c.fill();
          }
        },
      });
    },
    [],
  );

  return (
    <Panel
      title="bloomPass"
      importPath="remotion-lib/src/effects"
      note="A blurred copy composited additively under the sharp one. Where glows overlap they SUM toward white — which is what light does, and what a semi-transparent copy cannot do."
    >
      <FrameCanvas width={WIDTH} height={HEIGHT} draw={draw} style={FULL} />
    </Panel>
  );
};

export const VignettePanel: React.FC = () => {
  const draw = React.useCallback((ctx: CanvasRenderingContext2D) => {
    // A flat field, so the vignette itself is the only thing visible.
    ctx.fillStyle = THEME.accent;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    vignettePass({
      ctx,
      width: WIDTH,
      height: HEIGHT,
      color: THEME.vignette,
      innerStop: 0.3,
    });
  }, []);

  return (
    <Panel
      title="vignettePass"
      importPath="remotion-lib/src/effects"
      note="Colour is a required parameter, with its own alpha as the strength control — no black is baked in. Ellipse shape follows the 16:9 frame; a circle would leave the sides lighter."
    >
      <FrameCanvas width={WIDTH} height={HEIGHT} draw={draw} style={FULL} />
    </Panel>
  );
};

export const GrainPanel: React.FC = () => {
  const draw = React.useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    // A gradient is exactly what bands under h264 — and what grain fixes.
    const g = ctx.createLinearGradient(0, 200, 0, 900);
    g.addColorStop(0, THEME.panel);
    g.addColorStop(1, THEME.accent);
    ctx.fillStyle = g;
    ctx.fillRect(200, 200, 1520, 700);

    grainPass({
      ctx,
      width: WIDTH,
      height: HEIGHT,
      frame,
      seed: 3,
      intensity: 0.12,
    });
  }, []);

  return (
    <Panel
      title="grainPass"
      importPath="remotion-lib/src/effects"
      note="One 256px seeded tile, blitted with a per-frame offset — not 8.3M fresh noise writes per 4K frame. Applied last, at output resolution, over a gradient that would otherwise band."
    >
      <FrameCanvas width={WIDTH} height={HEIGHT} draw={draw} style={FULL} />
    </Panel>
  );
};

export const LowResUpscalePanel: React.FC = () => {
  const draw = React.useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    const t = loopPhase(frame, 80);
    lowResUpscale({
      ctx,
      width: WIDTH,
      height: HEIGHT,
      divisor: 8,
      draw: (c) => {
        // Drawn in FULL composition coordinates: the context is pre-scaled.
        const cx = 760 + Math.sin(t * Math.PI * 2) * 220;
        const g = c.createRadialGradient(cx, 560, 0, cx, 560, 460);
        g.addColorStop(0, THEME.warm);
        g.addColorStop(1, "transparent");
        c.fillStyle = g;
        c.fillRect(0, 0, WIDTH, HEIGHT);

        const g2 = c.createRadialGradient(1240, 520, 0, 1240, 520, 380);
        g2.addColorStop(0, THEME.magenta);
        g2.addColorStop(1, "transparent");
        c.fillStyle = g2;
        c.fillRect(0, 0, WIDTH, HEIGHT);
      },
    });
  }, []);

  return (
    <Panel
      title="lowResUpscale"
      importPath="remotion-lib/src/effects"
      note="Both glows computed in a 240x135 buffer — 1/64 the fill rate — then upscaled. Free for gradients like these. Wrong for particles: a 1px dot in an /8 buffer either becomes a blob or vanishes, and flickers between the two."
    >
      <FrameCanvas width={WIDTH} height={HEIGHT} draw={draw} style={FULL} />
    </Panel>
  );
};
