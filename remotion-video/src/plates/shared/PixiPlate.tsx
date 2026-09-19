import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  autoDetectRenderer,
  BlurFilter,
  Container,
  Filter,
  GlProgram,
  Sprite,
  Texture,
  UniformGroup,
  type Renderer,
} from "pixi.js";
import { FILTER_VERT } from "./glsl/lib";

/**
 * Uniform values a plate hands to its shader. Scalars and small vectors
 * only - each plate keeps its tunables flat so they can be exposed as
 * Remotion props and scrubbed in the Studio.
 */
export type PlateUniforms = Record<string, number | number[]>;

const uniformDescriptor = (value: number | number[]) => {
  if (typeof value === "number") return { value, type: "f32" as const };
  if (value.length === 2) return { value: [...value], type: "vec2<f32>" as const };
  if (value.length === 3) return { value: [...value], type: "vec3<f32>" as const };
  if (value.length === 4) return { value: [...value], type: "vec4<f32>" as const };
  throw new Error(`Unsupported uniform arity: ${value.length}`);
};

export type PixiPlateProps = {
  /** Plate fragment shader, already including PLATE_FRAG_HEADER. */
  fragment: string;
  /** Name used in shader compile errors. */
  name: string;
  /** Plate-specific uniforms, merged over the shared set. */
  uniforms: PlateUniforms;
  /** Film-grain strength, 0 disables. */
  grainAmount?: number;
  /** Overall exposure multiplier applied inside the shader. */
  exposure?: number;
  /** Reshuffles every hashed field without changing the motion design. */
  seed?: number;
  /** Depth of the per-element blink, 0 steady - 1 hard blink. */
  shimmer?: number;
  /**
   * Global multiplier on every blink rate in the plate. 1 is the rate the
   * shaders are authored at; lower values slow the whole field down
   * without flattening the spread between its fastest and slowest
   * elements.
   */
  shimmerRate?: number;
  /**
   * Optical defocus applied over the whole plate, in 1080p-referred px.
   * 0 skips the pass entirely.
   */
  blur?: number;
};

/**
 * Renders a full-frame procedural plate with PixiJS v8 + a custom WebGL
 * fragment shader, driven deterministically by Remotion's frame counter.
 *
 * Determinism is the whole design constraint. Remotion renders frames out
 * of order and across several browser tabs at once, so nothing may depend
 * on elapsed wall-clock time or on state accumulated from previous
 * frames. Every plate is therefore a pure function of `uT` - the loop
 * position - which is recomputed from `useCurrentFrame()` each time.
 */
export const PixiPlate: React.FC<PixiPlateProps> = ({
  fragment,
  name,
  uniforms,
  grainAmount = 0.03,
  exposure = 1,
  seed = 1,
  shimmer = 0.5,
  shimmerRate = 1,
  blur = 0,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const stageRef = useRef<Container | null>(null);
  const filterRef = useRef<Filter | null>(null);

  const [initHandle] = useState(() => delayRender(`Initialising PixiJS for ${name}`));
  const [ready, setReady] = useState(false);

  // Plate geometry is authored against a 1920x1080 frame; uScale lets the
  // same shader fill a 4K frame with identically-proportioned bokeh
  // instead of the same pixel sizes at half the apparent scale.
  const scale = width / 1920;

  const uniformSpec = useMemo(() => {
    const base: PlateUniforms = {
      uT: 0,
      uResolution: [width, height],
      uScale: scale,
      uLoopFrames: durationInFrames,
      uSeed: seed,
      uGrainAmount: grainAmount,
      uExposure: exposure,
      // Blink rates are authored in Hz; the shader converts them to whole
      // cycles per loop, which needs the loop length in seconds.
      uLoopSeconds: durationInFrames / fps,
      uShimmer: shimmer,
      uShimmerRate: shimmerRate,
    };
    const merged = { ...base, ...uniforms };
    return Object.fromEntries(
      Object.entries(merged).map(([key, value]) => [key, uniformDescriptor(value)]),
    );
  }, [width, height, scale, durationInFrames, fps, seed, grainAmount, exposure, shimmer, shimmerRate, uniforms]);

  // Keep the spec in a ref so the per-frame draw can read the latest
  // values without re-running the (expensive) renderer setup.
  const uniformSpecRef = useRef(uniformSpec);
  uniformSpecRef.current = uniformSpec;

  const draw = useCallback(
    (currentFrame: number) => {
      const renderer = rendererRef.current;
      const stage = stageRef.current;
      const filter = filterRef.current;
      if (!renderer || !stage || !filter) return;

      const group = filter.resources.plate as UniformGroup;
      const values = group.uniforms as Record<string, unknown>;

      for (const [key, descriptor] of Object.entries(uniformSpecRef.current)) {
        values[key] = descriptor.value;
      }
      // Loop position. Frame 0 and frame `durationInFrames` map to the
      // same phase, which is what makes the plates cut back to the head
      // without a seam.
      values.uT = (currentFrame % durationInFrames) / durationInFrames;
      group.update();

      renderer.render(stage);
    },
    [durationInFrames],
  );

  useLayoutEffect(() => {
    let disposed = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setup = async () => {
      try {
        const renderer = await autoDetectRenderer({
          preference: "webgl",
          canvas,
          width,
          height,
          resolution: 1,
          autoDensity: false,
          antialias: false,
          // Required: Remotion captures the frame by screenshotting the
          // page, which happens after the GL context would normally have
          // discarded its back buffer.
          preserveDrawingBuffer: true,
          clearBeforeRender: true,
          backgroundAlpha: 1,
          backgroundColor: 0x000000,
          powerPreference: "high-performance",
        });
        if (disposed) {
          // Unmounted mid-init. The handle must still be released or the
          // render waits on it forever.
          renderer.destroy();
          continueRender(initHandle);
          return;
        }

        const filter = new Filter({
          glProgram: GlProgram.from({ vertex: FILTER_VERT, fragment, name }),
          resources: { plate: new UniformGroup(uniformSpecRef.current) },
          padding: 0,
          resolution: 1,
          antialias: "off",
        });

        // The shader generates the whole image and ignores its input, so
        // the sprite is just a full-frame surface for the filter to run
        // over. Texture.WHITE is a 1px texture stretched to fit.
        const surface = new Sprite(Texture.WHITE);
        surface.width = width;
        surface.height = height;

        // Optical defocus over the finished plate. repeatEdgePixels makes
        // the blur clamp at the frame boundary instead of pulling in
        // transparent pixels, which would darken all four edges.
        const chain: Filter[] = [filter];
        if (blur > 0) {
          const defocus = new BlurFilter({
            strength: blur * scale,
            quality: 4,
          });
          defocus.repeatEdgePixels = true;
          chain.push(defocus);
        }
        surface.filters = chain;

        const stage = new Container();
        stage.addChild(surface);

        rendererRef.current = renderer;
        stageRef.current = stage;
        filterRef.current = filter;

        setReady(true);
        continueRender(initHandle);
      } catch (err) {
        cancelRender(err as Error);
      }
    };

    setup();

    return () => {
      disposed = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
      stageRef.current = null;
      filterRef.current = null;
    };
    // The renderer is built once per composition; size and shader are
    // fixed for the lifetime of a render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragment, name, width, height, blur, scale]);

  // Drawing in a layout effect puts the GL draw inside React's commit
  // phase, so the back buffer is populated before the browser paints and
  // before Remotion grabs the frame.
  useLayoutEffect(() => {
    if (!ready) return;
    draw(frame);
  }, [ready, frame, draw, uniformSpec]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
