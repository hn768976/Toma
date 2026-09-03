/**
 * A single <canvas> that a tree of layer components draws into, in order.
 *
 * Remotion renders every frame as a pure function of the frame number, so the
 * canvas is redrawn exactly once per React render: no requestAnimationFrame,
 * no state, no timers. Layers register a draw callback during render and
 * `CanvasStage` runs them, sorted by `order`, in a layout effect — which React
 * guarantees runs after all children have rendered and before the browser
 * paints, so Remotion always screenshots a finished frame.
 */
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

export interface LayerRegistration {
  /** Stable id. Re-registering under the same id replaces, never duplicates. */
  id: string;
  /** Lower draws first. */
  order: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

type Registry = Map<string, LayerRegistration>;

const LayerContext = createContext<Registry | null>(null);

/** Register a draw callback with the enclosing <CanvasStage>. */
export const useCanvasLayer = (reg: LayerRegistration): void => {
  const registry = useContext(LayerContext);
  if (registry) registry.set(reg.id, reg);
};

export interface CanvasStageProps {
  /** Backing-store size, independent of how the canvas is displayed. */
  width: number;
  height: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  width,
  height,
  style,
  children,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const registry = useMemo<Registry>(() => new Map(), []);
  // Cleared during the parent's render pass, i.e. before any child renders and
  // re-registers. Keying by id keeps this idempotent under a double render.
  registry.clear();

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const layers = [...registry.values()].sort((a, b) => a.order - b.order);
    for (const layer of layers) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
      layer.draw(ctx);
      ctx.restore();
    }
  });

  return (
    <LayerContext.Provider value={registry}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block", ...style }}
      />
      {children}
    </LayerContext.Provider>
  );
};
