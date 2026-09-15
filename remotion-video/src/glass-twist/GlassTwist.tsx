import { useEffect, useRef } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { TwistScene } from "./scene";
import { VARIANTS, type VariantName } from "./variants";

// Art-direction overrides. Everything here defaults to the value in
// constants.ts; the schema exists so framing and twist can be swept from
// the CLI (`--props`) or the Studio without a rebuild. Production renders
// leave these unset.
export const glassTwistTuningSchema = z.object({
  cameraFov: z.number().optional(),
  cameraDistance: z.number().optional(),
  axisYawDeg: z.number().optional(),
  axisPitchDeg: z.number().optional(),
  twistPerPlate: z.number().optional(),
  plateSpacing: z.number().optional(),
  plateOuterSize: z.number().optional(),
  plateTubeRadius: z.number().optional(),
  plateCount: z.number().optional(),
});

export const glassTwistSchema = z.object({
  variant: z.enum(["emerald", "azure"]),
  tuning: glassTwistTuningSchema.optional(),
});

export type GlassTwistProps = z.infer<typeof glassTwistSchema>;

export const glassTwistDefaults: GlassTwistProps = {
  variant: "emerald",
};

export const GlassTwist: React.FC<GlassTwistProps> = ({ variant, tuning }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // Tuning arrives as a fresh object each render; key off its contents so
  // the frame effect does not re-run on every render.
  const tuningKey = JSON.stringify(tuning ?? null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Promise<TwistScene> | null>(null);

  // The three.js scene is expensive to build, so it is created once per
  // page and reused for every frame Remotion asks for. Storing the
  // promise (not the instance) means concurrent frame effects all await
  // the same initialisation instead of racing to build their own.
  const getScene = (): Promise<TwistScene> => {
    if (!sceneRef.current) {
      const variantConfig = VARIANTS[variant as VariantName];
      const scene = new TwistScene({
        width,
        height,
        variant: variantConfig,
        tuning,
      });
      sceneRef.current = scene.init().then(() => scene);
    }
    return sceneRef.current;
  };

  useEffect(() => {
    return () => {
      const pending = sceneRef.current;
      sceneRef.current = null;
      pending?.then((scene) => scene.dispose()).catch(() => undefined);
    };
    // Disposal is tied to the lifetime of the component only.
  }, []);

  useEffect(() => {
    const handle = delayRender(`glass-twist: rendering frame ${frame}`, {
      timeoutInMilliseconds: 120_000,
    });
    let cancelled = false;

    (async () => {
      try {
        const scene = await getScene();
        if (cancelled) return;
        const image = await scene.renderFrame(frame);

        // The scene renders offscreen and hands back pixels; painting
        // them onto a plain 2D canvas is what Remotion screenshots. See
        // TwistScene.renderFrame for why the GPU canvas is not used
        // directly.
        const target = canvasRef.current;
        if (!target || cancelled) return;
        const ctx = target.getContext("2d");
        if (!ctx) throw new Error("could not get a 2D context for the output canvas");
        ctx.putImageData(image, 0, 0);
      } catch (error) {
        cancelRender(error as Error);
        return;
      } finally {
        if (!cancelled) continueRender(handle);
      }
    })();

    return () => {
      cancelled = true;
      continueRender(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, width, height, variant, tuningKey]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
