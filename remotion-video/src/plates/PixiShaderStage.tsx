import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Application,
  Geometry,
  GlProgram,
  Mesh,
  Shader,
  type UniformGroup,
} from "pixi.js";
import { VERTEX_SRC } from "./shaders/vertex";

export type PlateUniformValues = {
  /** Overall particle/detail population multiplier. */
  density: number;
  /** Output gain. The plates are deliberately dark; this scales the top end. */
  brightness: number;
  /** Decorrelates every hash in the shader - change it for a new variant. */
  seed: number;
  /** Multiplier on how far the loop travels. 1 = tuned-to-reference speed. */
  speed: number;
};

type Props = {
  fragment: string;
  uniforms: PlateUniformValues;
};

/**
 * Mounts a PixiJS v8 WebGL renderer and drives a single full-frame fragment
 * shader from Remotion's frame counter.
 *
 * Three things make this safe for a deterministic offline render:
 *
 *  1. Pixi's ticker is never started. Nothing in the shader integrates a
 *     delta-time, so a frame's output depends *only* on `useCurrentFrame()`.
 *     Remotion may render frames out of order across workers; this is immune.
 *  2. Drawing happens in `useLayoutEffect`, i.e. synchronously before the
 *     browser paints, so the canvas always holds the right frame when Remotion
 *     takes its screenshot.
 *  3. `preserveDrawingBuffer` keeps the WebGL backbuffer readable for that
 *     screenshot instead of being discarded after compositing.
 */
export const PixiShaderStage: React.FC<Props> = ({ fragment, uniforms }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const shaderRef = useRef<Shader | null>(null);
  const continuedRef = useRef(false);

  const { width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Initialising PixiJS WebGL stage"));

  useEffect(() => {
    let disposed = false;
    const app = new Application();

    app
      .init({
        canvas: canvasRef.current as HTMLCanvasElement,
        width,
        height,
        backgroundColor: 0x000000,
        backgroundAlpha: 1,
        antialias: false,
        autoStart: false,
        autoDensity: false,
        resolution: 1,
        preference: "webgl",
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
        clearBeforeRender: true,
      })
      .then(() => {
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        app.ticker.stop();

        const geometry = new Geometry({
          attributes: {
            aPosition: new Float32Array([
              0, 0, width, 0, width, height, 0, height,
            ]),
            aUV: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
          },
          indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
        });

        const shader = new Shader({
          glProgram: GlProgram.from({ vertex: VERTEX_SRC, fragment }),
          resources: {
            // NOTE: avoid the names Pixi reserves on its own global/local
            // uniform groups (uResolution, uColor, u*Matrix).
            plate: {
              uT: { value: 0, type: "f32" },
              uRes: {
                value: new Float32Array([width, height]),
                type: "vec2<f32>",
              },
              uSeed: { value: uniforms.seed, type: "f32" },
              uDensity: { value: uniforms.density, type: "f32" },
              uBright: { value: uniforms.brightness, type: "f32" },
              uSpeed: { value: uniforms.speed, type: "f32" },
            },
          },
        });

        app.stage.addChild(new Mesh({ geometry, shader }));

        appRef.current = app;
        shaderRef.current = shader;
        setReady(true);
      })
      .catch((err: Error) => {
        cancelRender(err);
      });

    return () => {
      disposed = true;
      appRef.current = null;
      shaderRef.current = null;
      try {
        app.destroy(true, { children: true });
      } catch {
        // Pixi throws if init never completed; nothing to clean up in that case.
      }
    };
    // Size is fixed per composition, and `fragment` is a module constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const app = appRef.current;
    const shader = shaderRef.current;
    if (!app || !shader) {
      return;
    }

    const group = shader.resources.plate as UniformGroup;
    const u = group.uniforms as Record<string, number>;

    // Phase 0 at frame 0, and frame `durationInFrames` would land back on 0 -
    // the loop closes exactly on the composition boundary.
    u.uT = (frame % durationInFrames) / durationInFrames;
    u.uSeed = uniforms.seed;
    u.uDensity = uniforms.density;
    u.uBright = uniforms.brightness;
    u.uSpeed = uniforms.speed;
    group.update();

    app.renderer.render(app.stage);

    if (!continuedRef.current) {
      continuedRef.current = true;
      continueRender(handle);
    }
  }, [
    frame,
    ready,
    durationInFrames,
    handle,
    uniforms.seed,
    uniforms.density,
    uniforms.brightness,
    uniforms.speed,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
