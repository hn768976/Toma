import React from "react";
import { interpolate } from "remotion";
import { CircuitBackdrop as LibCircuitBackdrop } from "../lib/CircuitBackdrop";
import { CIRCUIT, HEIGHT, TIMING, WIDTH } from "../config";
import { layerStyle } from "../lib/canvas";
import type { Theme } from "../theme";

/**
 * Binds the shared <CircuitBackdrop> to this project's palette and config.
 * The field is held well down — it should sit barely above the background.
 */
export const CircuitBackdrop: React.FC<{ frame: number; theme: Theme }> = ({
  frame,
  theme,
}) => {
  const opacity = interpolate(frame, [0, 12], [0, CIRCUIT.fieldOpacity], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <LibCircuitBackdrop
      frame={frame}
      width={WIDTH}
      height={HEIGHT}
      dimColor={theme.circuitDim}
      brightColor={theme.circuitBright}
      seed="cloud-icon/circuit"
      count={CIRCUIT.traceCount}
      gridSize={CIRCUIT.gridSize}
      minTurns={CIRCUIT.minTurns}
      maxTurns={CIRCUIT.maxTurns}
      lineWidth={CIRCUIT.lineWidth}
      padSize={CIRCUIT.padSize}
      padChance={CIRCUIT.padChance}
      stubChance={CIRCUIT.stubChance}
      drawOnStart={TIMING.backdropFadeStart}
      drawOnEnd={TIMING.backdropFadeEnd}
      padBlinkPeriodMin={CIRCUIT.padBlinkPeriodMin}
      padBlinkPeriodMax={CIRCUIT.padBlinkPeriodMax}
      style={layerStyle(2, opacity)}
    />
  );
};
