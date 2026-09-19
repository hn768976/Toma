import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Application,
  Geometry,
  GlProgram,
  Mesh,
  Shader,
  type WebGLRenderer,
} from "pixi.js";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { weaveVertexShader } from "./shader/weave.vert";
import { weaveFragmentShader } from "./shader/weave.frag";
import { getBoilState } from "./boil";
import { REFERENCE_WIDTH } from "./constants";
import type { WeaveVariant } from "./presets";

/**
 * Drives the weave shader through PixiJS v8 on a canvas Remotion screenshots.
 *
 * Two things make this render deterministically rather than as a live loop:
 * the Pixi application is created with `autoStart: false` so nothing ticks on
 * its own, and each frame is drawn synchronously from a layout effect keyed to
 * `useCurrentFrame()`. `preserveDrawingBuffer` is required -- without it Chrome
 * is free to discard the drawing buffer before the capture reads it back, which
 * shows up as intermittently black frames.
 */

type Uniforms = Record<string, unknown>;

/**
 * Verify the shader actually built. Pixi logs GLSL errors and carries on, so
 * without this a typo in the shader reads as a perfectly successful render of
 * an entirely black frame.
 */
const assertProgramCompiled = (renderer: WebGLRenderer, shader: Shader) => {
  const gl = renderer.gl;
  const glProgram = shader.glProgram;
  // Pixi caches the linked program per GlProgram on its shader system.
  const compiled = (
    renderer.shader as unknown as {
      _programDataHash?: Record<string, { program: WebGLProgram } | undefined>;
    }
  )._programDataHash?.[glProgram._key];

  if (!compiled?.program) {
    throw new Error(
      "The weave shader program was never linked. This usually means WebGL is " +
        "unavailable in this browser -- check that Remotion is launching Chromium " +
        "with a working OpenGL renderer (see setChromiumOpenGlRenderer in remotion.config.ts).",
    );
  }

  if (!gl.getProgramParameter(compiled.program, gl.LINK_STATUS)) {
    throw new Error(`Weave shader failed to link: ${gl.getProgramInfoLog(compiled.program)}`);
  }
};

const buildUniformDefs = (variant: WeaveVariant, width: number, height: number) => {
  const resolutionScale = width / REFERENCE_WIDTH;
  return {
    uAspect: { value: new Float32Array([1, height / width]), type: "vec2<f32>" },
    uThreads: { value: variant.threads, type: "f32" },
    uPixelScale: { value: variant.threads / width, type: "f32" },

    uJitter: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
    uSeed: { value: 0, type: "f32" },
    uStateExposure: { value: 1, type: "f32" },

    uThreadWidth: { value: variant.threadWidth, type: "f32" },
    uWeftWidth: { value: variant.weftWidth, type: "f32" },
    uTwistAmp: { value: variant.twistAmp, type: "f32" },
    uTwistFreq: { value: variant.twistFreq, type: "f32" },
    uTwistJitter: { value: variant.twistJitter, type: "f32" },
    uSlub: { value: variant.slub, type: "f32" },
    uWander: { value: variant.wander, type: "f32" },
    uWanderScale: { value: variant.wanderScale, type: "f32" },
    uThreadShade: { value: variant.threadShade, type: "f32" },
    uFuzz: { value: variant.fuzz, type: "f32" },
    uFuzzScale: { value: variant.fuzzScale, type: "f32" },
    uParityBias: { value: variant.parityBias, type: "f32" },

    uWarpColor: { value: new Float32Array(variant.warpColor), type: "vec3<f32>" },
    uWeftColor: { value: new Float32Array(variant.weftColor), type: "vec3<f32>" },
    uGroundColor: { value: new Float32Array(variant.groundColor), type: "vec3<f32>" },

    uLightDir: {
      value: new Float32Array([Math.cos(variant.lightAngle), Math.sin(variant.lightAngle)]),
      type: "vec2<f32>",
    },
    uLightHeight: { value: variant.lightHeight, type: "f32" },
    uAmbient: { value: variant.ambient, type: "f32" },
    uAmbientRamp: { value: variant.ambientRamp, type: "f32" },
    uDiffuse: { value: variant.diffuse, type: "f32" },
    uSpecular: { value: variant.specular, type: "f32" },
    uShininess: { value: variant.shininess, type: "f32" },
    uOcclusion: { value: variant.occlusion, type: "f32" },
    uAxisContrast: { value: variant.axisContrast, type: "f32" },
    uRelief: { value: variant.relief, type: "f32" },
    uExposure: { value: variant.exposure, type: "f32" },
    uContrast: { value: variant.contrast, type: "f32" },
    uLift: { value: variant.lift, type: "f32" },
    uHighlightKnee: { value: variant.highlightKnee, type: "f32" },
    uShoulder: { value: variant.shoulder, type: "f32" },

    uBloomCenter: { value: new Float32Array(variant.bloomCenter), type: "vec2<f32>" },
    uBloomRadius: { value: variant.bloomRadius, type: "f32" },
    uBloomStrength: { value: variant.bloomStrength, type: "f32" },
    uVignette: { value: variant.vignette, type: "f32" },
    uStreakStrength: { value: variant.streakStrength, type: "f32" },
    uStreakScale: { value: variant.streakScale, type: "f32" },
    uMottle: { value: variant.mottle, type: "f32" },
    uMottleScale: { value: variant.mottleScale, type: "f32" },
    // Grain is a per-pixel effect, so hold its apparent size steady as the
    // output resolution changes rather than letting 4K look finer-grained.
    uGrain: { value: variant.grain, type: "f32" },
    uSupersample: {
      value: variant.supersample * (resolutionScale >= 2 ? 1 : 1),
      type: "f32",
    },
  } satisfies Record<string, { value: unknown; type: string }>;
};

export const PixiWeave: React.FC<{ variant: WeaveVariant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const uniformsRef = useRef<Uniforms | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One delayRender handle covers asynchronous Pixi/WebGL startup. Remotion will
  // not capture frame 0 until it is released.
  const [initHandle] = useState(() => delayRender("Initialising PixiJS WebGL weave renderer"));

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const app = new Application();

    (async () => {
      try {
        await app.init({
          canvas,
          width,
          height,
          // Software WebGL in headless Chrome, so keep the pipeline plain.
          preference: "webgl",
          antialias: false,
          // Required: Remotion reads the canvas back after the frame is drawn.
          preserveDrawingBuffer: true,
          autoStart: false,
          autoDensity: false,
          resolution: 1,
          clearBeforeRender: true,
          powerPreference: "high-performance",
          backgroundAlpha: 1,
        });
        if (cancelled) {
          app.destroy(true);
          return;
        }

        const renderer = app.renderer as WebGLRenderer;
        if (!renderer.gl) throw new Error("PixiJS did not obtain a WebGL context");

        const defs = buildUniformDefs(variant, width, height);

        const shader = new Shader({
          glProgram: new GlProgram({
            name: "procedural-weave",
            vertex: weaveVertexShader,
            fragment: weaveFragmentShader,
          }),
          resources: {
            weaveUniforms: defs,
          },
        });

        // Unit quad; the mesh scale carries it out to the full frame, so vUv
        // arrives in the fragment shader already normalised to 0..1.
        const geometry = new Geometry({
          attributes: { aPosition: [0, 0, 1, 0, 1, 1, 0, 1] },
          indexBuffer: [0, 1, 2, 0, 2, 3],
        });

        const mesh = new Mesh({ geometry, shader });
        mesh.scale.set(width, height);
        app.stage.addChild(mesh);

        // Pixi compiles the program lazily on first draw and only warns if it
        // fails, which would leave every frame silently black. Draw once here
        // and check the program for real, so a GLSL mistake fails the render
        // instead of shipping ten seconds of black.
        app.render();
        assertProgramCompiled(renderer, shader);

        appRef.current = app;
        uniformsRef.current = shader.resources.weaveUniforms.uniforms as Uniforms;
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err));
      } finally {
        continueRender(initHandle);
      }
    })();

    return () => {
      cancelled = true;
      appRef.current = null;
      uniformsRef.current = null;
      try {
        app.destroy(true, { children: true });
      } catch {
        // Pixi can throw if init never completed; nothing useful to do here.
      }
    };
    // Size and variant are fixed for the lifetime of a composition render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = useCallback(() => {
    const app = appRef.current;
    const uniforms = uniformsRef.current;
    if (!app || !uniforms) return;

    const boil = getBoilState(frame, variant);
    (uniforms.uJitter as Float32Array)[0] = boil.jitter[0];
    (uniforms.uJitter as Float32Array)[1] = boil.jitter[1];
    uniforms.uSeed = boil.seed;
    uniforms.uStateExposure = boil.stateExposure;

    app.render();
  }, [frame, variant]);

  // Draw synchronously before the browser paints, so the canvas is correct by
  // the time Remotion screenshots it.
  useLayoutEffect(() => {
    if (!ready) return;
    draw();
  }, [ready, draw]);

  if (error) {
    // Fail loudly rather than shipping black frames.
    throw new Error(`PixiJS weave renderer failed: ${error}`);
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: "block" }}
    />
  );
};
