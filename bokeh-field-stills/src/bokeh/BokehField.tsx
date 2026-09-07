import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useVideoConfig } from "remotion";
import { DensityName } from "./config";
import { PaletteName, PALETTES } from "./palettes";
import { buildScene } from "./elements";
import { BackgroundWash } from "./BackgroundWash";
import { ElementField } from "./ElementField";
import { FocusPass } from "./FocusPass";
import { GrainPass } from "./GrainPass";

/**
 * `orientation` is reserved for a future portrait variant. The composition is
 * registered 16:9, so "landscape" is the only accepted value today.
 */
export type Orientation = "landscape";

export type BokehFieldProps = {
  /** Drives every random value. The same seed always reproduces the same image. */
  seed: string;
  palette: PaletteName;
  density: DensityName;
  /** Where the sharp band sits in depth, 0 (far) to 1 (near). */
  focusBand: number;
  orientation: Orientation;
};

export const bokehFieldDefaultProps: BokehFieldProps = {
  seed: "a01",
  palette: "cyan",
  density: "medium",
  focusBand: 0.5,
  orientation: "landscape",
};

/**
 * A field of small bright marks scattered through a depth range, read through
 * a shallow lens: a circuit board or data display defocused into bokeh.
 *
 * This is a still. The composition is one frame long, nothing animates, and
 * the whole frame is drawn to a single canvas exactly once.
 */
export const BokehField: React.FC<BokehFieldProps> = ({
  seed,
  palette,
  density,
  focusBand,
  orientation,
}) => {
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender("Drawing the bokeh field", { timeoutInMilliseconds: 180000 }));

  const resolvedPalette: PaletteName = palette in PALETTES ? palette : "cyan";

  const scene = useMemo(
    () =>
      buildScene({
        seed,
        palette: resolvedPalette,
        density,
        focusBand,
        width,
        height,
      }),
    [seed, resolvedPalette, density, focusBand, width, height],
  );

  // React runs child layout effects before the parent's, so by the time this
  // fires all four passes have drawn and the frame is complete.
  useLayoutEffect(() => {
    continueRender(handle);
  }, [handle, scene, orientation]);

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTES[resolvedPalette].background }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <BackgroundWash canvasRef={canvasRef} scene={scene} />
      <ElementField canvasRef={canvasRef} scene={scene} />
      <FocusPass canvasRef={canvasRef} scene={scene} />
      <GrainPass canvasRef={canvasRef} scene={scene} />
    </AbsoluteFill>
  );
};

export type { PaletteName, DensityName };
