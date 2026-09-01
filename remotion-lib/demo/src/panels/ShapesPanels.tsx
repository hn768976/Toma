import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Panel } from "../Panel";
import { THEME } from "../theme";
import {
  blobPath,
  brokenArcRing,
  roundedPill,
  tickRing,
  tornEdge,
} from "../../../src/shapes";

export const BlobPathPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const blobs = [1, 2, 3].map((seed, i) => ({
    seed,
    d: blobPath({
      center: { x: 520 + i * 440, y: 600 },
      // Breathe the radius so the shape reads as alive.
      radius: 150 + Math.sin(frame / 18 + i) * 10,
      seed,
      points: 9,
      irregularity: 0.3,
    }),
  }));

  return (
    <Panel
      title="blobPath"
      importPath="remotion-lib/src/shapes"
      note="Nine control points at varied radii, joined with closed Catmull-Rom beziers. Straight segments would make a legible nonagon; smoothing leaves only the irregularity."
    >
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          {blobs.map((b, i) => (
            <path
              key={b.seed}
              d={b.d}
              fill={[THEME.accent, THEME.cool, THEME.magenta][i]}
              fillOpacity={0.75}
              stroke={THEME.hot}
              strokeWidth={2}
              strokeOpacity={0.5}
            />
          ))}
        </svg>
      </AbsoluteFill>
    </Panel>
  );
};

export const TornEdgePanel: React.FC = () => {
  const tear = React.useMemo(
    () =>
      tornEdge({
        from: { x: 0, y: 620 },
        to: { x: 1920, y: 560 },
        seed: 9,
        coarseAmplitude: 26,
        fineAmplitude: 6,
        fibreCount: 90,
        fibreLength: 12,
      }),
    [],
  );

  return (
    <Panel
      title="tornEdge"
      importPath="remotion-lib/src/shapes"
      note="Two noise scales at once — the slow bend where the sheet gave way, plus fibre-scale grain — with a fringe of strands. One scale alone reads as a lazy wave or a sanded cut."
    >
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          <path d={tear.closed} fill={THEME.panel} />
          <path d={tear.path} fill="none" stroke={THEME.accentSoft} strokeWidth={2} />
          {tear.fibres.map((d, i) => (
            <path
              key={i}
              d={d}
              stroke={THEME.accentSoft}
              strokeWidth={1.4}
              strokeOpacity={0.7}
              strokeLinecap="round"
            />
          ))}
        </svg>
      </AbsoluteFill>
    </Panel>
  );
};

export const RingsPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const center = { x: 960, y: 590 };
  const arcs = brokenArcRing({ center, radius: 250, segments: 5, seed: 4 });
  const evenArcs = brokenArcRing({
    center,
    radius: 300,
    segments: 5,
    jitter: 0,
  });
  const ticks = tickRing({ center, radius: 180, count: 60, majorEvery: 5 });

  return (
    <Panel
      title="brokenArcRing / tickRing / roundedPill"
      importPath="remotion-lib/src/shapes"
      note="Outer ring: jitter 0 — even segments, a dashed circle. Inner ring: the 0.35 default, which reads as instrumentation. Ticks carry index and major flags so a sweep is just a function of index."
    >
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          <g transform={`rotate(${frame * 0.6} ${center.x} ${center.y})`}>
            {evenArcs.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={THEME.inkDim} strokeWidth={6} strokeLinecap="round" />
            ))}
          </g>
          <g transform={`rotate(${-frame * 0.9} ${center.x} ${center.y})`}>
            {arcs.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={THEME.accent} strokeWidth={8} strokeLinecap="round" />
            ))}
          </g>
          {ticks.map((t) => {
            const lit = Math.abs(((frame * 1.4) % 60) - t.index) < 4;
            return (
              <path
                key={t.index}
                d={t.path}
                stroke={lit ? THEME.hot : t.major ? THEME.accentSoft : THEME.inkDim}
                strokeWidth={t.major ? 3.5 : 2}
                strokeOpacity={lit ? 1 : 0.7}
              />
            );
          })}
          <path
            d={roundedPill({ x: 760, y: 900, width: 400, height: 64 })}
            fill={THEME.accent}
            fillOpacity={0.22}
            stroke={THEME.accent}
            strokeWidth={2}
          />
          <text x={960} y={941} fill={THEME.accentSoft} fontSize={26} textAnchor="middle">
            roundedPill
          </text>
        </svg>
      </AbsoluteFill>
    </Panel>
  );
};
