/**
 * One canvas, many layer components.
 *
 * Stacking half a dozen absolutely-positioned 4K canvases would cost ~33MB of
 * backing store each and force the compositor to blend them every frame. So the
 * stage owns a single canvas and each layer draws into it.
 *
 * Ordering is the delicate part. React flushes layout effects depth-first —
 * children before parents — so every layer's `useStageLayer` effect has already
 * re-registered this render's draw closure by the time the stage's own layout
 * effect runs and composites. Layers are then sorted by an explicit `z` rather
 * than relying on mount order, and drawn in that sequence.
 *
 * There is no requestAnimationFrame and no component state driving motion: the
 * canvas is redrawn exactly once per React render, and a React render happens
 * once per frame, so output is a pure function of the frame number.
 */
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

export type LayerDraw = (ctx: CanvasRenderingContext2D) => void;

export type LayerRegistration = {
  z: number;
  /** Whether the stage's ambient camera drift applies to this layer. */
  drift: boolean;
  draw: LayerDraw;
};

type StageApi = {
  register: (id: string, registration: LayerRegistration) => void;
};

const StageContext = createContext<StageApi | null>(null);

export type StageLayerOptions = {
  /** Stable identity; layers with the same id replace one another. */
  id: string;
  /** Draw order, low to high. */
  z: number;
  /** Defaults to true. Post-processing passes opt out. */
  drift?: boolean;
  draw: LayerDraw;
};

/** Registers a layer's draw call with the enclosing stage for this render. */
export const useStageLayer = ({
  id,
  z,
  drift = true,
  draw,
}: StageLayerOptions): void => {
  const stage = useContext(StageContext);
  if (!stage) {
    throw new Error("useStageLayer must be used inside a <CanvasStage>");
  }
  // Deliberately no dependency array: this must re-register the closure over
  // the current frame's props on every render.
  useLayoutEffect(() => {
    stage.register(id, { z, drift, draw });
  });
};

export type CanvasStageProps = {
  width: number;
  height: number;
  /** Painted across the whole frame before any layer draws. */
  backgroundColor: string;
  /** Ambient camera offset applied to drifting layers, in pixels. */
  drift?: { x: number; y: number };
  children: React.ReactNode;
};

export const CanvasStage: React.FC<CanvasStageProps> = ({
  width,
  height,
  backgroundColor,
  drift = { x: 0, y: 0 },
  children,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef(new Map<string, LayerRegistration>());

  const api = useMemo<StageApi>(
    () => ({
      register: (id, registration) => {
        layersRef.current.set(id, registration);
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowBlur = 0;
    // The base fill is laid down without the camera drift, so the drift can
    // never expose an unpainted edge.
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const layers = [...layersRef.current.values()].sort((a, b) => a.z - b.z);
    for (const layer of layers) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      if (layer.drift) ctx.translate(drift.x, drift.y);
      layer.draw(ctx);
      ctx.restore();
    }
  });

  return (
    <StageContext.Provider value={api}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {/* Layers render nothing; they exist to register their draw calls. */}
      {children}
    </StageContext.Provider>
  );
};
