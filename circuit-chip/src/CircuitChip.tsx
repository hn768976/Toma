import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Board } from "./Board";
import { Defs } from "./Defs";
import { CX, CY, DH, DW, RING_R, getNetwork } from "./network";
import { Pulses } from "./Pulses";
import { Ring } from "./Ring";
import { AMBER, BLUE, type Theme } from "./theme";

export type ChipProps = {
  variant: "blue" | "amber";
  seed: number;
};

const THEMES: Record<ChipProps["variant"], Theme> = { blue: BLUE, amber: AMBER };

export const CircuitChip: React.FC<ChipProps> = ({ variant, seed }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const theme = THEMES[variant];
  const net = getNetwork(seed);
  const id = `cc-${variant}`;

  // Every animated quantity is a pure function of this normalised loop
  // position, and every multiplier below is an integer, so frame 0 and frame
  // `durationInFrames` are identical.
  const t = (frame % durationInFrames) / durationInFrames;
  const tau = t * Math.PI * 2;

  const breathe = 0.9 + 0.1 * Math.sin(tau * 4);
  const scale = 1 + 0.01 * Math.sin(tau * 2); // synchronised to the ring rotation
  const glow = 0.82 + 0.18 * Math.sin(tau * 2);
  const grainSeed = frame % 5; // 600 % 5 === 0

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bgOuter }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${DW} ${DH}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block" }}
      >
        <Defs theme={theme} id={id} grainSeed={grainSeed} />

        <rect x={0} y={0} width={DW} height={DH} fill={`url(#${id}-bg)`} />
        <rect x={0} y={0} width={DW} height={DH} fill={`url(#${id}-scan)`} opacity={0.04} />

        <g clipPath={`url(#${id}-frame)`}>
          <g transform={`translate(${CX} ${CY}) scale(${scale}) translate(${-CX} ${-CY})`}>
            {/* Soft glow behind the ring. */}
            <circle cx={CX} cy={CY} r={RING_R * 5.2} fill={`url(#${id}-core)`} opacity={0.5 * glow} />

            <g mask={`url(#${id}-ringmask)`}>
              <Board net={net} theme={theme} breathe={breathe} dustPhase={t * 3} />
              <Pulses net={net} theme={theme} t={t} filterId={`${id}-bloom`} />
            </g>

            <circle cx={CX} cy={CY} r={RING_R * 0.95} fill={`url(#${id}-hole)`} />

            <g filter={`url(#${id}-bloom-wide)`} opacity={0.62 * glow}>
              <circle
                cx={CX}
                cy={CY}
                r={RING_R}
                fill="none"
                stroke={theme.ring}
                strokeWidth={14}
                opacity={0.9}
              />
            </g>
            <Ring theme={theme} t={t} ids={id} />
          </g>
        </g>

        <rect x={0} y={0} width={DW} height={DH} fill={`url(#${id}-vig)`} />
        <rect
          x={0}
          y={0}
          width={DW}
          height={DH}
          filter={`url(#${id}-grain)`}
          opacity={0.05}
          style={{ mixBlendMode: "overlay" }}
        />
      </svg>
    </AbsoluteFill>
  );
};
