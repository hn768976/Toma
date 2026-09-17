import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { BACKGROUND, VARIANTS, type Variant } from "./constants";
import { createScratch, renderFrame, type Scratch } from "./render";

export const cyberAlertSchema = z.object({
  variant: z.enum(["cyberAttack", "securityBreach"]),
});

export type CyberAlertProps = z.infer<typeof cyberAlertSchema>;

export const cyberAlertDefaults: CyberAlertProps = {
  variant: "cyberAttack",
};

export const CyberAlert: React.FC<CyberAlertProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<Scratch | null>(null);

  const config: Variant = useMemo(() => VARIANTS[variant], [variant]);

  // useLayoutEffect, not useEffect: it runs synchronously at commit,
  // before the browser paints, so the canvas is guaranteed to hold this
  // frame's pixels by the time Remotion captures it.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let scratch = scratchRef.current;
    if (!scratch || scratch.width !== width || scratch.height !== height) {
      scratch = createScratch(width, height);
      scratchRef.current = scratch;
    }

    renderFrame(ctx, scratch, frame, config);
  }, [frame, width, height, config]);

  return (
    <div style={{ width, height, backgroundColor: BACKGROUND }}>
      <canvas ref={canvasRef} width={width} height={height} />
    </div>
  );
};
