import { Application, Container, Geometry, Mesh, RenderTexture, Shader, UniformGroup } from "pixi.js";
import { glShader } from "./shader";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { DITHER, SRGB } from "../glsl";

export type PixiContext = {
  app: Application;
  /** Composition size (logical units: 3840 x 2160). */
  width: number;
  height: number;
  /** Device pixels per logical pixel (1 at 4K, 1/3 at 720p). */
  px: number;
};

export type PixiScene = {
  /** Content drawn into the half-float target each frame. */
  root: Container;
  /** Update uniforms / geometry for `frame` before the content is rendered. */
  update: (frame: number) => void;
  /** Final composite (linear RGB, content = target texture rgba). */
  composite: string;
  /** Extra uniforms for the composite shader. */
  compositeUniforms?: Record<string, { value: number | Float32Array; type: string }>;
  /** Extra textures for the composite shader. */
  compositeTextures?: Record<string, RenderTexture>;
};

const VERT = /* glsl */ `
in vec2 aPosition;
out vec2 vUv;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec2 uSize;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUv = aPosition / uSize;
}
`;

/** A logical-space quad covering the composition. */
export const quadGeometry = (w: number, h: number) =>
  new Geometry({
    attributes: { aPosition: new Float32Array([0, 0, w, 0, w, h, 0, h]) },
    indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });

/** Half-float render texture at device resolution. */
export const floatTarget = (w: number, h: number, px: number) =>
  RenderTexture.create({ width: w, height: h, resolution: px, format: "rgba16float", antialias: false });

/**
 * Hosts a PixiJS 8 (WebGL2) scene. Init is async and held behind
 * delayRender(); each frame the scene's content is drawn into a half-float
 * target, then composited to the canvas by the scene's own GLSL, converted
 * to sRGB and dithered.
 */
export const PixiStage: React.FC<{ build: (ctx: PixiContext) => PixiScene; background: string }> = ({
  build,
  background,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState<null | {
    app: Application;
    scene: PixiScene;
    target: RenderTexture;
    final: Mesh<Geometry, Shader>;
    uniforms: UniformGroup;
  }>(null);
  const [initHandle] = useState(() => delayRender("PixiJS init"));

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    const px = window.devicePixelRatio || 1;
    // Exact device size: 3840 x 1/3 must land on 1280.
    const devW = Math.round(width * px);
    const resolution = devW / width;
    app
      .init({
        canvas: canvasRef.current!,
        width,
        height,
        resolution,
        autoDensity: false,
        preference: "webgl",
        antialias: false,
        autoStart: false,
        sharedTicker: false,
        backgroundAlpha: 1,
        background: 0x000000,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
        hello: false,
      })
      .then(() => {
        if (cancelled) return;
        app.ticker.stop();
        const scene = build({ app, width, height, px: resolution });
        const target = floatTarget(width, height, resolution);
        const uniforms = new UniformGroup({
          uSize: { value: new Float32Array([width, height]), type: "vec2<f32>" },
          ...(scene.compositeUniforms ?? {}),
        } as never);
        const textures: Record<string, unknown> = { uContent: target.source };
        for (const [k, v] of Object.entries(scene.compositeTextures ?? {})) textures[k] = v.source;
        const shader = glShader(
          "final",
          VERT,
          /* glsl */ `
in vec2 vUv;
out vec4 finalColor;
uniform sampler2D uContent;
uniform vec2 uSize;
${SRGB}
${DITHER}
${scene.composite}
void main() {
  // Pixi render textures are stored top-down; vUv is top-down too.
  vec4 content = texture(uContent, vUv);
  bool allow;
  vec3 lin = composite(content, vUv, allow);
  finalColor = vec4(ditherOut(toSrgb(lin), gl_FragCoord.xy, allow), 1.0);
}`,
          { u: uniforms, ...textures },
        );
        const final = new Mesh({ geometry: quadGeometry(width, height), shader });
        setReady({ app, scene, target, final, uniforms });
        continueRender(initHandle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handle = useRef<number | null>(null);
  useLayoutEffect(() => {
    handle.current = delayRender(`Pixi frame ${frame}`);
    return () => {
      if (handle.current !== null) continueRender(handle.current);
      handle.current = null;
    };
  }, [frame, delayRender, continueRender]);

  useEffect(() => {
    if (!ready) return;
    const { app, scene, target, final } = ready;
    scene.update(frame);
    app.renderer.render({ container: scene.root, target, clear: true, clearColor: [0, 0, 0, 0] });
    app.renderer.render({ container: final, clear: true });
    if (handle.current !== null) {
      continueRender(handle.current);
      handle.current = null;
    }
  }, [frame, ready, continueRender]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas ref={canvasRef} style={{ width, height }} />
    </AbsoluteFill>
  );
};
