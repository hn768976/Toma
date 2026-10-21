import { Application, Container, Geometry, Mesh, RenderTexture, Shader } from "pixi.js";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { hexToRgb } from "../ease";

export type PixiInfo = {
  width: number; // device pixels
  height: number;
  px: number; // device pixels per 720p pixel
};

// A scene builds its display tree once into `world` and returns a per-frame update.
export type PixiSetup = (world: Container, info: PixiInfo, app: Application) => (frame: number) => void;

const VERT = /* glsl */ `
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// Final pass: half-float scene -> screen, with +-1/255 dither only where the image is
// more than 2% away from the background (black stays 0, light backgrounds stay flat).
const FRAG = /* glsl */ `
uniform sampler2D uScene;
uniform vec3 uBg;
uniform float uFrame;
uniform vec2 uRes;
out vec4 finalColor;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;
  vec3 c = clamp(texture(uScene, uv).rgb, 0.0, 1.0);
  vec3 d = abs(c - uBg);
  float m = step(0.02, max(d.r, max(d.g, d.b)));
  float n = hash(gl_FragCoord.xy + vec2(uFrame * 17.0, uFrame * 31.0)) - 0.5;
  c += m * n * (2.0 / 255.0);
  finalColor = vec4(c, 1.0);
}`;

type Runtime = {
  app: Application;
  world: Container;
  rt: RenderTexture;
  final: Container;
  shader: Shader;
  update: (frame: number) => void;
};

export const PixiStage: React.FC<{
  setup: PixiSetup;
  background: string;
  // Optional async data the scene needs (land polygons, fonts...), loaded before setup.
  ready?: boolean;
}> = ({ setup, background, ready = true }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rt, setRt] = useState<Runtime | null>(null);
  const [initHandle] = useState(() => delayRender("PixiJS init"));
  const released = useRef(false);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const W = Math.round(width * dpr);
  const H = Math.round(height * dpr);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const app = new Application();
    app
      .init({
        canvas: canvasRef.current!,
        width: W,
        height: H,
        resolution: 1,
        autoDensity: false,
        preference: "webgl",
        antialias: false,
        preserveDrawingBuffer: true,
        background,
        autoStart: false,
        sharedTicker: false,
      })
      .then(() => {
        if (cancelled) return;
        app.ticker.stop();
        const info: PixiInfo = { width: W, height: H, px: H / 720 };
        const world = new Container();
        const sceneRT = RenderTexture.create({ width: W, height: H, format: "rgba16float", resolution: 1 });
        const geometry = new Geometry({
          attributes: { aPosition: [-1, -1, 1, -1, 1, 1, -1, 1] },
          indexBuffer: [0, 1, 2, 0, 2, 3],
        });
        const shader = Shader.from({
          gl: { vertex: VERT, fragment: FRAG },
          resources: {
            uScene: sceneRT.source,
            frameUniforms: {
              uBg: { value: hexToRgb(background), type: "vec3<f32>" },
              uFrame: { value: 0, type: "f32" },
              uRes: { value: [W, H], type: "vec2<f32>" },
            },
          },
        });
        const final = new Container();
        final.addChild(new Mesh({ geometry, shader }));
        const update = setup(world, info, app);
        setRt({ app, world, rt: sceneRT, final, shader, update });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useLayoutEffect(() => {
    if (!rt) return;
    rt.update(frame);
    const r = rt.app.renderer;
    r.render({ container: rt.world, target: rt.rt, clearColor: background });
    (rt.shader.resources.frameUniforms as { uniforms: { uFrame: number } }).uniforms.uFrame = frame;
    r.render({ container: rt.final });
    if (!released.current) {
      released.current = true;
      continueRender(initHandle);
    }
  }, [frame, rt, background, initHandle]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width, height, position: "absolute", left: 0, top: 0, backgroundColor: background }}
    />
  );
};
