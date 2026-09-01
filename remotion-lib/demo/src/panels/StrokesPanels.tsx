import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Panel } from "../Panel";
import { THEME } from "../theme";
import {
  NeonStroke,
  drawOn,
  quadraticLength,
  strokeFor,
  taperedStrokeOutline,
  taperedStrokeSegments,
} from "../../../src/strokes";

const ARC = { from: { x: 300, y: 640 }, control: { x: 960, y: 300 }, to: { x: 1620, y: 640 } };
const ARC_D = `M ${ARC.from.x} ${ARC.from.y} Q ${ARC.control.x} ${ARC.control.y} ${ARC.to.x} ${ARC.to.y}`;

export const NeonStrokePanel: React.FC = () => (
  <Panel
    title="NeonStroke"
    importPath="remotion-lib/src/strokes"
    note="Top: one 12px stroke at 0.5 alpha. Bottom: the four-pass construction — atmospheric, outer, mid, hot core — blended additively. Same path, same hue."
  >
    <AbsoluteFill>
      <svg width={1920} height={1080}>
        <path
          d="M 300 460 Q 960 220 1620 460"
          fill="none"
          stroke={THEME.accent}
          strokeWidth={12}
          strokeOpacity={0.5}
          strokeLinecap="round"
        />
        <text x={300} y={540} fill={THEME.inkDim} fontSize={24}>
          single thick semi-transparent stroke
        </text>
        <g transform="translate(0 260)">
          <NeonStroke
            d="M 300 460 Q 960 220 1620 460"
            coreColor={THEME.hot}
            glowColor={THEME.accent}
            coreWidth={3}
          />
        </g>
        <text x={300} y={800} fill={THEME.accent} fontSize={24}>
          NeonStroke — four passes
        </text>
      </svg>
    </AbsoluteFill>
  </Panel>
);

export const TaperedStrokePanel: React.FC = () => {
  // Sample the arc into a polyline; the taper helpers take points.
  const points = React.useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const t = i / 47;
        const mt = 1 - t;
        return {
          x: mt * mt * ARC.from.x + 2 * mt * t * ARC.control.x + t * t * ARC.to.x,
          y: mt * mt * ARC.from.y + 2 * mt * t * ARC.control.y + t * t * ARC.to.y,
        };
      }),
    [],
  );
  const segments = taperedStrokeSegments(points, {
    startWidth: 1,
    endWidth: 26,
    startAlpha: 0.05,
    endAlpha: 1,
  });

  return (
    <Panel
      title="taperedStroke"
      importPath="remotion-lib/src/strokes"
      note="Top: taperedStrokeOutline — one filled path, true continuous taper, single fill so alpha cannot vary. Bottom: taperedStrokeSegments — per-segment width AND alpha, at the cost of one node each."
    >
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          <g transform="translate(0 -120)">
            <path
              d={taperedStrokeOutline(points, { startWidth: 0, endWidth: 26, profile: "ease" })}
              fill={THEME.cool}
            />
          </g>
          <g transform="translate(0 190)">
            {segments.map((s) => (
              <line
                key={s.index}
                x1={s.from.x}
                y1={s.from.y}
                x2={s.to.x}
                y2={s.to.y}
                stroke={THEME.warm}
                strokeWidth={s.width}
                strokeOpacity={s.alpha}
                strokeLinecap="round"
              />
            ))}
          </g>
        </svg>
      </AbsoluteFill>
    </Panel>
  );
};

export const DrawOnPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [6, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Length computed from geometry — never measured from the DOM, so
  // there is no frame-0 flash of the fully-drawn path.
  const length = quadraticLength(ARC.from, ARC.control, ARC.to);

  return (
    <Panel
      title="drawOn"
      importPath="remotion-lib/src/strokes"
      note="A pure function of (progress, pathLength). Length comes from quadraticLength, not getTotalLength in an effect — which would show the path fully drawn for one frame, on whichever frames a worker happened to mount."
    >
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          <path d={ARC_D} fill="none" stroke={THEME.grid} strokeWidth={10} />
          <path
            d={ARC_D}
            fill="none"
            stroke={THEME.accent}
            strokeWidth={10}
            strokeLinecap="round"
            {...drawOn(progress, length)}
          />
          <text x={300} y={790} fill={THEME.inkDim} fontSize={24}>
            progress {progress.toFixed(2)} · length {Math.round(length)}px
          </text>
        </svg>
      </AbsoluteFill>
    </Panel>
  );
};

/** A small icon drawn in a 60px box, placed at several scales. */
const Icon: React.FC<{ scale: number; corrected: boolean; x: number; y: number }> = ({
  scale,
  corrected,
  x,
  y,
}) => (
  <g
    transform={`translate(${x} ${y}) scale(${scale})`}
    fill="none"
    stroke={corrected ? THEME.accent : THEME.inkDim}
    strokeWidth={corrected ? strokeFor(scale, 4) : 4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x={-26} y={-20} width={52} height={40} rx={7} />
    <path d="M -14 -4 L -4 6 L 16 -12" />
  </g>
);

export const StrokeForPanel: React.FC = () => (
  <Panel
    title="strokeFor"
    importPath="remotion-lib/src/strokes"
    note="One icon at scale 1, 2 and 3.4. Top row: strokeWidth 4, scaled with everything else — the outline thickens into a blob. Bottom row: strokeFor(scale, 4) counter-scales it, so the set still looks like a set."
  >
    <AbsoluteFill>
      <svg width={1920} height={1080}>
        <Icon scale={1} corrected={false} x={480} y={430} />
        <Icon scale={2} corrected={false} x={840} y={430} />
        <Icon scale={3.4} corrected={false} x={1340} y={430} />
        <Icon scale={1} corrected x={480} y={740} />
        <Icon scale={2} corrected x={840} y={740} />
        <Icon scale={3.4} corrected x={1340} y={740} />
      </svg>
    </AbsoluteFill>
  </Panel>
);
