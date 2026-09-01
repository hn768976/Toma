import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Panel } from "../Panel";
import { THEME } from "../theme";
import {
  fadeInOut,
  irregularDashes,
  loopPhase,
  radialPlaces,
  seededRandom,
} from "../../../src/random";

const CENTER = { x: 960, y: 600 };

/** seededRandom — the same index always yields the same bar height. */
export const SeededRandomPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const bars = 48;
  return (
    <Panel
      title="seededRandom"
      importPath="remotion-lib/src/random"
      note="Every bar height is seededRandom(i, salt). Identical on every frame and in every render worker — the field never boils. The sweep is the only thing moving."
    >
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          {Array.from({ length: bars }, (_, i) => {
            const h = 60 + seededRandom(i, 20) * 320;
            const lit = Math.abs(((frame * 1.2) % bars) - i) < 3;
            return (
              <rect
                key={i}
                x={300 + i * 27}
                y={620 - h}
                width={16}
                height={h}
                rx={4}
                fill={lit ? THEME.hot : THEME.accent}
                opacity={lit ? 1 : 0.45}
              />
            );
          })}
        </svg>
      </AbsoluteFill>
    </Panel>
  );
};

/** loopPhase — the one helper genuinely duplicated in existing projects. */
export const LoopPhasePanel: React.FC = () => {
  const frame = useCurrentFrame();
  const count = 7;
  const period = 50;
  return (
    <Panel
      title="loopPhase"
      importPath="remotion-lib/src/random"
      note="Found duplicated three times across two builds. Seven dots share one 50-frame cycle at staggered phases; fadeInOut hides each wrap. Negative frames stay in range."
    >
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          <line
            x1={300}
            y1={600}
            x2={1620}
            y2={600}
            stroke={THEME.grid}
            strokeWidth={2}
          />
          {Array.from({ length: count }, (_, i) => {
            const t = loopPhase(frame, period, i / count);
            return (
              <circle
                key={i}
                cx={300 + t * 1320}
                cy={600}
                r={18}
                fill={THEME.accent}
                opacity={fadeInOut(t)}
              />
            );
          })}
        </svg>
      </AbsoluteFill>
    </Panel>
  );
};

/** radialPlaces — regular spacing vs jittered, side by side. */
export const RadialPlacesPanel: React.FC = () => {
  const rosette = radialPlaces({
    count: 22,
    center: { x: 640, y: 590 },
    radius: 190,
    seed: 1,
    angleJitter: 0,
    radiusJitter: 0,
  });
  const scattered = radialPlaces({
    count: 22,
    center: { x: 1320, y: 590 },
    radius: 190,
    seed: 1,
  });
  return (
    <Panel
      title="radialPlaces"
      importPath="remotion-lib/src/random"
      note="Left: angleJitter 0, radiusJitter 0 — a rosette that reads as a flower or a wheel. Right: the defaults (0.6 / 0.12). Same count, same radius, same seed."
    >
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          {rosette.map((p) => (
            <circle key={p.index} cx={p.x} cy={p.y} r={13} fill={THEME.inkDim} />
          ))}
          {scattered.map((p) => (
            <circle key={p.index} cx={p.x} cy={p.y} r={13} fill={THEME.accent} />
          ))}
          <text x={640} y={880} fill={THEME.inkDim} fontSize={26} textAnchor="middle">
            angleJitter: 0  (avoid)
          </text>
          <text x={1320} y={880} fill={THEME.accent} fontSize={26} textAnchor="middle">
            default
          </text>
        </svg>
      </AbsoluteFill>
    </Panel>
  );
};

/** irregularDashes — even ladder vs varied dashes. */
export const IrregularDashesPanel: React.FC = () => {
  const dashes = irregularDashes({ seed: 5, dash: 22, gap: 16 });
  return (
    <Panel
      title="irregularDashes"
      importPath="remotion-lib/src/random"
      note="Top: strokeDasharray '22 16' — an even ladder. Bottom: varied length and gap from one seed. Always returns an even-length array so the pattern does not silently double."
    >
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          <path
            d="M 300 480 L 1620 480"
            stroke={THEME.inkDim}
            strokeWidth={10}
            strokeDasharray="22 16"
            strokeLinecap="round"
          />
          <text x={300} y={440} fill={THEME.inkDim} fontSize={24}>
            even
          </text>
          <path
            d="M 300 700 L 1620 700"
            stroke={THEME.accent}
            strokeWidth={10}
            strokeDasharray={dashes.join(" ")}
            strokeLinecap="round"
          />
          <text x={300} y={660} fill={THEME.accent} fontSize={24}>
            irregularDashes({"{ seed: 5 }"})
          </text>
        </svg>
      </AbsoluteFill>
    </Panel>
  );
};
