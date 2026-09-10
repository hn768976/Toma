import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
import { ColourField } from "./components/ColourField";
import { EdgeFalloff } from "./components/EdgeFalloff";
import { GrainPass } from "./components/GrainPass";
import { COMPOSITIONS, type CompositionName } from "./compositions";
import { resolvePalette, type PaletteName } from "./palettes";
import { PipelineContext, type FieldState, type Pipeline, type Stage } from "./pipeline";
import { seedFromName } from "./random";
import { HEIGHT, WIDTH } from "./constants";

export type GrainGradientProps = {
  readonly composition: CompositionName;
  readonly palette: PaletteName;
};

/**
 * The final compositing step, and the only place the field is quantised to
 * 8 bits. Everything upstream — the blob field, the edge falloff, the grain
 * and the dither — is carried in floats precisely so this rounding happens
 * once, on a signal that already has grain in it.
 */
const presentField = (state: FieldState, canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const { width, height, rgb } = state;
  const image = ctx.createImageData(width, height);
  const out = image.data;
  const pixels = width * height;
  for (let i = 0; i < pixels; i++) {
    const o = i * 3;
    const d = i * 4;
    out[d] = rgb[o];
    out[d + 1] = rgb[o + 1];
    out[d + 2] = rgb[o + 2];
    out[d + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
};

export const GrainGradient: React.FC<GrainGradientProps> = ({ composition, palette }) => {
  const config = COMPOSITIONS[composition];
  if (!config) {
    throw new Error(`Unknown composition "${composition}"`);
  }

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stagesRef = useRef<Stage[]>([]);
  const handleRef = useRef<number | null>(null);
  if (handleRef.current === null) {
    handleRef.current = delayRender(`Rendering ${composition}/${palette}`);
  }

  const register = useCallback((stage: Stage) => {
    stagesRef.current.push(stage);
  }, []);

  const pipeline = useMemo<Pipeline>(() => ({ register }), [register]);

  // Child layout effects run before the parent's, so every stage has
  // registered by the time this fires. The stages are then run in their
  // declared order rather than mount order.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state: FieldState = {
      width: canvas.width,
      height: canvas.height,
      rgb: new Float32Array(canvas.width * canvas.height * 3),
      composition: config,
      compositionName: composition,
      palette: resolvePalette(palette),
      seed: seedFromName(composition),
    };

    for (const stage of [...stagesRef.current].sort((a, b) => a.order - b.order)) {
      stage.run(state);
    }
    presentField(state, canvas);

    if (handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
    }
  }, [config, composition, palette]);

  return (
    <AbsoluteFill>
      <PipelineContext.Provider value={pipeline}>
        <ColourField />
        <EdgeFalloff />
        <GrainPass />
      </PipelineContext.Provider>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
