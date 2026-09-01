import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FrameCanvas, Panel } from "../Panel";
import { THEME } from "../theme";
import {
  maskFromDraw,
  midpointDisplacement,
  noiseField,
  particleFromMask,
  polyPath,
  seriesPath,
  trendingWalk,
} from "../../../src/generators";
import { seededRandom } from "../../../src/random/seededRandom";

const WIDTH = 1920;
const HEIGHT = 1080;
const FULL: React.CSSProperties = { position: "absolute", inset: 0 };

export const MidpointDisplacementPanel: React.FC = () => {
  const frame = useCurrentFrame();
  // Re-strike every 12 frames by deriving the seed from the frame — NOT
  // by interpolating between two figures, which looks like rubber.
  const strike = Math.floor(frame / 12);
  const branches = React.useMemo(
    () =>
      midpointDisplacement({
        from: { x: 900, y: 170 },
        to: { x: 1010, y: 900 },
        seed: 40 + strike,
        depth: 6,
        branchProbability: 0.16,
        maxBranchDepth: 3,
      }),
    [strike],
  );

  return (
    <Panel
      title="midpointDisplacement"
      importPath="remotion-lib/src/generators"
      note="Lightning: high displacement, fast decay, low branch probability. The same function with different parameters gives roots, cracks and bronchial trees. Re-seeded every 12 frames to re-strike."
    >
      <AbsoluteFill>
        <svg width={WIDTH} height={HEIGHT}>
          {branches.map((b, i) => (
            <path
              key={i}
              d={polyPath(b.points)}
              fill="none"
              stroke={b.generation === 0 ? THEME.hot : THEME.accent}
              strokeWidth={Math.max(1, 4 - b.generation * 1.2)}
              strokeOpacity={1 / (1 + b.generation * 0.8)}
              strokeLinecap="round"
            />
          ))}
        </svg>
      </AbsoluteFill>
    </Panel>
  );
};

export const TrendingWalkPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const trending = React.useMemo(
    () => trendingWalk({ length: 200, seed: 11, bias: 0.2 }),
    [],
  );
  // A memoryless walk, for contrast — same length, same step size, but
  // every step independent, so there are no runs.
  const flat = React.useMemo(() => {
    let v = 100;
    return Array.from({ length: 200 }, (_, i) => {
      v += (seededRandom(i, 99) - 0.5) * 2.4;
      return v;
    });
  }, []);

  const shown = Math.max(2, Math.round((frame / 50) * 200));
  return (
    <Panel
      title="trendingWalk"
      importPath="remotion-lib/src/generators"
      note="Bottom: a memoryless walk — every step independent, so it jitters and reverses constantly; any drift is accidental. Top: committed runs, giving sustained moves the eye reads as rallies and sell-offs."
    >
      <AbsoluteFill>
        <svg width={WIDTH} height={HEIGHT}>
          <g transform="translate(300 260)">
            <path
              d={seriesPath(trending.slice(0, shown), { width: 1320, height: 260 })}
              fill="none"
              stroke={THEME.cool}
              strokeWidth={5}
              strokeLinejoin="round"
            />
          </g>
          <g transform="translate(300 620)">
            <path
              d={seriesPath(flat.slice(0, shown), { width: 1320, height: 260 })}
              fill="none"
              stroke={THEME.inkDim}
              strokeWidth={5}
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </AbsoluteFill>
    </Panel>
  );
};

export const NoiseFieldPanel: React.FC = () => {
  const sampler = React.useMemo(
    () => noiseField({ seed: 7, octaves: 3, frequency: 0.006 }),
    [],
  );
  const draw = React.useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      // t as a 0..1 fraction of the loop — integer frequencies then close it.
      const t = frame / 50;
      const cell = 16;
      for (let y = 200; y < 920; y += cell) {
        for (let x = 260; x < 1660; x += cell) {
          const v = (sampler(x, y, t) + 1) / 2;
          ctx.globalAlpha = 0.15 + v * 0.85;
          ctx.fillStyle = v > 0.5 ? THEME.cool : THEME.accent;
          ctx.fillRect(x, y, cell - 2, cell - 2);
        }
      }
      ctx.globalAlpha = 1;
    },
    [sampler],
  );

  return (
    <Panel
      title="noiseField"
      importPath="remotion-lib/src/generators"
      note="Layered value noise sampled on a grid. integerFrequency rounds every temporal frequency to a whole number of cycles, so frame 0 and frame 50 are identical by construction — the loop closes with no crossfade."
    >
      <FrameCanvas width={WIDTH} height={HEIGHT} draw={draw} style={FULL} />
    </Panel>
  );
};

export const ParticleFromMaskPanel: React.FC = () => {
  const bounds = { x: 560, y: 250, width: 800, height: 620 };

  const particles = React.useMemo(() => {
    // The silhouette: a simple bulb/flask shape, drawn once into a mask.
    const mask = maskFromDraw(
      (c) => {
        c.fillStyle = "#fff";
        c.beginPath();
        c.arc(960, 640, 210, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(890, 470);
        c.lineTo(1030, 470);
        c.lineTo(1010, 300);
        c.lineTo(910, 300);
        c.closePath();
        c.fill();
      },
      bounds,
      { resolution: 0.5 },
    );
    if (!mask) return [];
    return particleFromMask({
      count: 2600,
      mask,
      bounds,
      seed: 12,
      edgeWeight: 0.55,
      edgeRadius: 26,
    });
  }, []);

  const draw = React.useCallback(
    (ctx: CanvasRenderingContext2D, frame: number) => {
      for (const p of particles) {
        // Animate by MOVING the sampled set, never by re-sampling.
        const wobble = Math.sin(frame / 9 + p.index) * (1 + p.edgeDistance * 2);
        ctx.globalAlpha = 1 - p.edgeDistance * 0.65;
        ctx.fillStyle = p.edgeDistance < 0.35 ? THEME.hot : THEME.magenta;
        ctx.beginPath();
        ctx.arc(p.x + wobble, p.y + wobble * 0.4, p.edgeDistance < 0.35 ? 2.4 : 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    [particles],
  );

  return (
    <Panel
      title="particleFromMask"
      importPath="remotion-lib/src/generators"
      note="2600 points rejection-sampled inside a silhouette, density biased to the edge. Uniform density would read as a flat blob — the rim is what makes the shape legible while it dissolves."
    >
      <FrameCanvas width={WIDTH} height={HEIGHT} draw={draw} style={FULL} />
    </Panel>
  );
};
