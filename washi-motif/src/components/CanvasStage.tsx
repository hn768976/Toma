import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { continueRender, delayRender } from "remotion";

/**
 * A single 2D canvas, drawn once.
 *
 * Children do not draw themselves — they register a draw callback with an
 * order, and the stage runs the whole stack in one pass after every child has
 * registered. That keeps <PaperGround>, <MotifLayout>, <MotifShape> and
 * <FillTreatment> as real components while the output stays one deterministic
 * canvas pass with no compositing between layers.
 */
export type StageLayer = {
  id: string;
  order: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
};

type StageApi = {
  register: (layer: StageLayer) => void;
  unregister: (id: string) => void;
};

const StageContext = createContext<StageApi | null>(null);

const useStage = (): StageApi => {
  const stage = useContext(StageContext);
  if (!stage) throw new Error("This component must be rendered inside <CanvasStage>");
  return stage;
};

/**
 * Register a draw callback. Registration happens during render (idempotent by
 * id) so it is always complete before the stage's layout effect runs.
 */
export const useStageLayer = (
  id: string,
  order: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void => {
  const stage = useStage();
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useMemo(() => {
    stage.register({ id, order, draw: (ctx) => drawRef.current(ctx) });
  }, [stage, id, order]);

  useEffect(() => () => stage.unregister(id), [stage, id]);
};

export const CanvasStage: React.FC<{
  width: number;
  height: number;
  background: string;
  children: React.ReactNode;
}> = ({ width, height, background, children }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layers = useRef(new Map<string, StageLayer>());
  const drawn = useRef(false);
  const [handle] = useState(() => delayRender("Drawing the washi still"));

  const api = useMemo<StageApi>(
    () => ({
      register: (layer) => {
        layers.current.set(layer.id, layer);
      },
      unregister: (id) => {
        layers.current.delete(id);
      },
    }),
    [],
  );

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2d context unavailable");

    ctx.clearRect(0, 0, width, height);
    const ordered = [...layers.current.values()].sort((a, b) => a.order - b.order);
    for (const layer of ordered) {
      ctx.save();
      layer.draw(ctx);
      ctx.restore();
    }
  }, [width, height]);

  useLayoutEffect(() => {
    paint();
    if (!drawn.current) {
      drawn.current = true;
      continueRender(handle);
    }
  }, [paint, handle]);

  return (
    <StageContext.Provider value={api}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          backgroundColor: background,
        }}
      />
      {children}
    </StageContext.Provider>
  );
};
