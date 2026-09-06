import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BACKGROUND } from "./constants";
import { drawPlexus, makeRenderState, type RenderState } from "./draw";
import { buildField, loopPhase } from "./field";
import { drawGrain, makeGrainTiles } from "./grain";

export type PlexusWhiteProps = {
  /** V2: roughly a fifth of the nodes pick up corporate blue. Lines stay grey
   *  in both versions — only the nodes ever carry colour. */
  accent: boolean;
  /** Changes the field layout without changing anything else. */
  seed: number;
};

export const PlexusWhite: React.FC<PlexusWhiteProps> = ({ accent, seed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<RenderState | null>(null);
  const grainRef = useRef<HTMLCanvasElement[] | null>(null);

  const field = useMemo(() => buildField(seed), [seed]);

  // useLayoutEffect, not useEffect: the frame must be fully painted before
  // Remotion captures it.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    if (!stateRef.current) stateRef.current = makeRenderState(width, height);
    if (!grainRef.current) grainRef.current = makeGrainTiles();

    drawPlexus({
      ctx,
      state: stateRef.current,
      field,
      t: loopPhase(frame),
      width,
      height,
      accentEnabled: accent,
    });

    drawGrain(ctx, grainRef.current, frame, width, height);
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
