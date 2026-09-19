import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
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
  RenderTexture,
  Shader,
  UniformGroup,
} from "pixi.js";
import {
  COMPOSITE_FRAGMENT,
  FIELD_FRAGMENT,
  QUAD_VERTEX,
} from "./shaders/gradient";
import type { GradientProps } from "./variants";

/** sRGB hex -> linear-light RGB, so palette stops mix without going muddy. */
const hexToLinear = (hex: string): [number, number, number] => {
  const int = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [
    channel((int >> 16) & 0xff),
    channel((int >> 8) & 0xff),
    channel(int & 0xff),
  ];
};

const vec3 = (v: readonly number[]) => ({
  value: new Float32Array(v),
  type: "vec3<f32>" as const,
});

const f32 = (value: number) => ({ value, type: "f32" as const });

const fullScreenTriangle = () =>
  new Geometry({ attributes: { aPosition: [-1, -1, 3, -1, -1, 3] } });

/**
 * Renders one frame of the gradient with PixiJS v8 driving custom WebGL2
 * shaders.
 *
 * Two passes. The noise field is expensive -- eleven 4D simplex lookups per
 * pixel -- but it is also extremely smooth, so it is evaluated into a small
 * offscreen texture and resampled up. The finishing pass then runs per output
 * pixel, which is where grain and dither have to happen to be worth anything.
 * The field size is absolute rather than a fraction of the output, so the 4K
 * and 1080p compositions resolve to the same picture.
 *
 * Nothing here is time-driven: Pixi's ticker is off and every draw is a
 * synchronous function of Remotion's current frame, which keeps the output
 * deterministic across a parallel render.
 */
export const GradientCanvas: React.FC<GradientProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const fieldMeshRef = useRef<Mesh<Geometry, Shader> | null>(null);
  const compositeMeshRef = useRef<Mesh<Geometry, Shader> | null>(null);
  const fieldTextureRef = useRef<RenderTexture | null>(null);
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() => delayRender("Initialising PixiJS"));

  const fieldHeight = Math.max(90, Math.round(props.fieldHeight));
  const fieldWidth = Math.round((fieldHeight * width) / height);

  const fieldUniformDefs = useMemo(() => {
    const [c0, c1, c2, c3, c4, c5] = props.palette.map(hexToLinear);
    return {
      uAspect: f32(width / height),
      uPhase: f32(0),

      uScale: f32(props.scale),
      uWarpA: f32(props.warpA),
      uWarpB: f32(props.warpB),
      uLoopRadius: f32(props.loopRadius),
      uDrift: f32(props.drift),
      uDetail: f32(props.detail),
      uSeed: f32(props.seed),

      uBiasX: f32(props.biasX),
      uBiasY: f32(props.biasY),
      uSwirl: f32(props.swirl),
      uFieldAmount: f32(props.fieldAmount),
      uOffset: f32(props.offset),
      uContrast: f32(props.contrast),

      uGlow1Pos: {
        value: new Float32Array(props.glow1.pos),
        type: "vec2<f32>" as const,
      },
      uGlow1Radius: f32(props.glow1.radius),
      uGlow1Amount: f32(props.glow1.amount),
      uGlow2Pos: {
        value: new Float32Array(props.glow2.pos),
        type: "vec2<f32>" as const,
      },
      uGlow2Radius: f32(props.glow2.radius),
      uGlow2Amount: f32(props.glow2.amount),
      uGlowWarp: f32(props.glowWarp),
      uGamma: f32(props.gamma),
      uExposure: f32(props.exposure),

      uC0: vec3(c0),
      uC1: vec3(c1),
      uC2: vec3(c2),
      uC3: vec3(c3),
      uC4: vec3(c4),
      uC5: vec3(c5),

      uIridescence: f32(props.iridescence),
      uIrFreq: f32(props.iridescenceFreq),
      uIrA: vec3(props.iridescenceA),
      uIrB: vec3(props.iridescenceB),
      uIrC: vec3(props.iridescenceC),
      uIrD: vec3(props.iridescenceD),
    };
  }, [props, width, height]);

  const compositeUniformDefs = useMemo(
    () => ({
      uFieldSize: {
        value: new Float32Array([fieldWidth, fieldHeight]),
        type: "vec2<f32>" as const,
      },
      uResolution: {
        value: new Float32Array([width, height]),
        type: "vec2<f32>" as const,
      },
      uAspect: f32(width / height),
      uFrame: f32(0),
      uVignette: f32(props.vignette),
      uVignetteSoft: f32(props.vignetteSoft),
      uSaturation: f32(props.saturation),
      uGrain: f32(props.grain),
      uGrainSize: f32(props.grainSize),
    }),
    [props, width, height, fieldWidth, fieldHeight],
  );

  useEffect(() => {
    let disposed = false;
    const app = new Application();

    app
      .init({
        canvas: canvasRef.current as HTMLCanvasElement,
        width,
        height,
        antialias: false,
        autoStart: false,
        autoDensity: false,
        resolution: 1,
        preference: "webgl",
        powerPreference: "high-performance",
        backgroundAlpha: 1,
        clearBeforeRender: true,
      })
      .then(() => {
        if (disposed) {
          app.destroy();
          return;
        }

        // Half float keeps the field smooth enough that the upscale has real
        // gradient to interpolate rather than eight-bit stair steps.
        const fieldTexture = RenderTexture.create({
          width: fieldWidth,
          height: fieldHeight,
          format: "rgba16float",
          antialias: false,
        });
        fieldTexture.source.style.scaleMode = "linear";
        fieldTexture.source.style.addressMode = "clamp-to-edge";

        const fieldMesh = new Mesh({
          geometry: fullScreenTriangle(),
          shader: new Shader({
            glProgram: GlProgram.from({
              vertex: QUAD_VERTEX,
              fragment: FIELD_FRAGMENT,
              name: "gradient-field",
            }),
            resources: { fieldUniforms: new UniformGroup(fieldUniformDefs) },
          }),
        });

        const compositeMesh = new Mesh({
          geometry: fullScreenTriangle(),
          shader: new Shader({
            glProgram: GlProgram.from({
              vertex: QUAD_VERTEX,
              fragment: COMPOSITE_FRAGMENT,
              name: "gradient-composite",
            }),
            resources: {
              uFieldTexture: fieldTexture.source,
              compositeUniforms: new UniformGroup(compositeUniformDefs),
            },
          }),
        });

        app.stage.addChild(compositeMesh);

        appRef.current = app;
        fieldMeshRef.current = fieldMesh;
        compositeMeshRef.current = compositeMesh;
        fieldTextureRef.current = fieldTexture;
        setReady(true);
        continueRender(initHandle);
      })
      .catch((err) => {
        // Surface the real reason instead of a silent black frame.
        console.error("PixiJS failed to initialise", err);
        continueRender(initHandle);
      });

    return () => {
      disposed = true;
      fieldMeshRef.current?.destroy();
      fieldTextureRef.current?.destroy(true);
      appRef.current?.destroy(false, { children: true });
      appRef.current = null;
      fieldMeshRef.current = null;
      compositeMeshRef.current = null;
      fieldTextureRef.current = null;
    };
    // Intentionally mount-only: the app is reused for every frame of the
    // render and uniforms are updated in place below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = useCallback(() => {
    const app = appRef.current;
    const fieldMesh = fieldMeshRef.current;
    const compositeMesh = compositeMeshRef.current;
    const fieldTexture = fieldTextureRef.current;
    if (!app || !fieldMesh || !compositeMesh || !fieldTexture) {
      return;
    }

    // Copy the prop-derived values across every frame so the Studio sliders
    // take effect live.
    const apply = (target: Record<string, unknown>, defs: object) => {
      for (const [key, def] of Object.entries(defs)) {
        const next = (def as { value: unknown }).value;
        if (next instanceof Float32Array) {
          (target[key] as Float32Array).set(next);
        } else {
          target[key] = next;
        }
      }
    };

    const fieldUniforms = fieldMesh.shader?.resources.fieldUniforms
      .uniforms as Record<string, unknown>;
    const compositeUniforms = compositeMesh.shader?.resources.compositeUniforms
      .uniforms as Record<string, unknown>;

    apply(fieldUniforms, fieldUniformDefs);
    apply(compositeUniforms, compositeUniformDefs);

    // Phase wraps to exactly 1.0 at durationInFrames, so frame 0 and frame
    // durationInFrames land on the same point of the 4D circle.
    const wrapped = frame % durationInFrames;
    fieldUniforms.uPhase = frame / durationInFrames;
    compositeUniforms.uFrame = wrapped;

    app.renderer.render({
      container: fieldMesh,
      target: fieldTexture,
      clear: true,
    });
    app.renderer.render({ container: app.stage });
  }, [
    frame,
    durationInFrames,
    fieldUniformDefs,
    compositeUniformDefs,
  ]);

  // Layout effect, not effect: the draw must land before the browser paints
  // the frame Remotion is about to capture.
  useLayoutEffect(() => {
    if (ready) {
      draw();
    }
  }, [ready, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: "block" }}
    />
  );
};
