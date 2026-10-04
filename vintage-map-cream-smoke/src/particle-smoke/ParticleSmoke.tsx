import {
  Application,
  Filter,
  Geometry,
  GlProgram,
  Mesh,
  RenderTexture,
  Shader,
  Sprite,
  Texture,
  UniformGroup,
} from "pixi.js";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { hexToRgb01 } from "../lib/color";
import { loopFrame, loopPhase } from "../lib/timing";
import { useRenderDpr } from "../vintage-map/VintageMap";
import { particleData, particlePositions } from "./particles";
import { compositeFragment, compositeVertex, particleFragment, particleVertex } from "./shaders";
import { SMOKE_VERSIONS, type SmokeVersion } from "./versions";

export type ParticleSmokeProps = { version: string; loopCheck?: boolean };

export const SMOKE_LOOK = {
  camDistance: 5.3,
  fovDeg: 44,
  orbitYawDeg: 12.5, // +-, so 25 degrees there and back
  orbitPitchDeg: 4,
  pointSizePx: 2.0,
  alpha: 1.0, // per-particle weight at 4K; scaled for other resolutions
  gain: 0.9,
  glowStrength: 0.32,
  grain: 0.02,
  dof: 0.004, // blur diameter, fraction of width per unit of |1 - focus/z|
  maxPoint: 0.004, // largest blurred point, fraction of width
};

type Ctx = {
  app: Application;
  render: (frame: number) => void;
};

const createSmoke = async (canvas: HTMLCanvasElement, width: number, height: number, dpr: number, v: SmokeVersion): Promise<Ctx> => {
  const app = new Application();
  await app.init({
    canvas,
    width,
    height,
    resolution: dpr,
    autoDensity: false,
    preference: "webgl",
    antialias: true,
    autoStart: false,
    sharedTicker: false,
    preserveDrawingBuffer: true,
    background: "#000000",
  });
  app.ticker.stop();
  const renderer = app.renderer;
  const pw = Math.round(width * dpr);
  const ph = Math.round(height * dpr);

  // Particles: one vertex each, point-list topology, custom GLSL.
  const geometry = new Geometry({
    attributes: {
      aPosition: { buffer: particlePositions, format: "float32x2" },
      aData: { buffer: particleData, format: "float32x2" },
    },
    topology: "point-list",
  });
  const particleUniforms = new UniformGroup({
    uPhase: { value: 0, type: "f32" },
    uCamPos: { value: new Float32Array(3), type: "vec3<f32>" },
    uCamRight: { value: new Float32Array(3), type: "vec3<f32>" },
    uCamUp: { value: new Float32Array(3), type: "vec3<f32>" },
    uCamFwd: { value: new Float32Array(3), type: "vec3<f32>" },
    uTanHalf: { value: Math.tan((SMOKE_LOOK.fovDeg * Math.PI) / 360), type: "f32" },
    uAspect: { value: width / height, type: "f32" },
    uPointSize: { value: SMOKE_LOOK.pointSizePx, type: "f32" },
    // Points keep a fixed pixel size, so their weight scales with pixel area
    // to keep the same brightness at every render resolution.
    uAlpha: { value: SMOKE_LOOK.alpha * ((pw * ph) / (3840 * 2160)), type: "f32" },
    uFocusDist: { value: SMOKE_LOOK.camDistance, type: "f32" },
    uDofPx: { value: SMOKE_LOOK.dof * pw, type: "f32" },
    uMaxPointPx: { value: Math.max(SMOKE_LOOK.pointSizePx, SMOKE_LOOK.maxPoint * pw), type: "f32" },
  });
  const shader = new Shader({
    glProgram: new GlProgram({ vertex: particleVertex, fragment: particleFragment, name: "smoke-particles" }),
    resources: { particleUniforms },
  });
  const mesh = new Mesh({ geometry, shader });
  mesh.blendMode = "add";

  // Float accumulation target (no 8-bit quantisation of the density), and a
  // downsampled chain for the glow.
  const rt = (w: number, h: number) =>
    RenderTexture.create({ width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)), resolution: 1, format: "rgba16float", antialias: false });
  const density = rt(pw, ph);
  const chain = [rt(pw / 2, ph / 2), rt(pw / 4, ph / 4), rt(pw / 8, ph / 8)];
  const chainSprites = [density, chain[0], chain[1]].map((src, i) => {
    const s = new Sprite(src);
    s.width = chain[i].width;
    s.height = chain[i].height;
    return s;
  });

  const col = (hex: string) => new Float32Array(hexToRgb01(hex));
  const compositeUniforms = new UniformGroup({
    uRes: { value: new Float32Array([pw, ph]), type: "vec2<f32>" },
    uGlowTexel: { value: new Float32Array([1 / chain[2].width, 1 / chain[2].height]), type: "vec2<f32>" },
    uColLow: { value: col(v.particle), type: "vec3<f32>" },
    uColHigh: { value: col(v.dense), type: "vec3<f32>" },
    uBgCenter: { value: col(v.bgCenter), type: "vec3<f32>" },
    uBgEdge: { value: col(v.bgEdge), type: "vec3<f32>" },
    uGain: { value: SMOKE_LOOK.gain, type: "f32" },
    uGlowStrength: { value: SMOKE_LOOK.glowStrength, type: "f32" },
    uGrainFrame: { value: 0, type: "f32" },
    uGrainAmount: { value: SMOKE_LOOK.grain, type: "f32" },
  });
  const composite = new Filter({
    glProgram: new GlProgram({ vertex: compositeVertex, fragment: compositeFragment, name: "smoke-composite" }),
    resources: { compositeUniforms, uDensity: density.source, uGlowTex: chain[2].source },
    resolution: dpr,
    antialias: "off",
  });
  const screen = new Sprite(Texture.WHITE);
  screen.width = width;
  screen.height = height;
  screen.filters = [composite];
  app.stage.addChild(screen);

  const render = (frame: number) => {
    const phase = loopPhase(frame);
    const yaw = (SMOKE_LOOK.orbitYawDeg * Math.PI) / 180 * Math.sin(phase);
    const pitch = (SMOKE_LOOK.orbitPitchDeg * Math.PI) / 180 * Math.cos(phase);
    const d = SMOKE_LOOK.camDistance;
    const pos = [Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, -Math.cos(yaw) * Math.cos(pitch) * d];
    const fwd = pos.map((x) => -x / d);
    // right = up x fwd, up = fwd x right (world up = +y)
    const right = [fwd[2], 0, -fwd[0]];
    const rl = Math.hypot(right[0], right[2]);
    right[0] /= rl;
    right[2] /= rl;
    const up = [fwd[1] * right[2] - fwd[2] * right[1], fwd[2] * right[0] - fwd[0] * right[2], fwd[0] * right[1] - fwd[1] * right[0]];
    const u = particleUniforms.uniforms;
    u.uPhase = phase;
    (u.uCamPos as Float32Array).set(pos);
    (u.uCamRight as Float32Array).set(right);
    (u.uCamUp as Float32Array).set(up);
    (u.uCamFwd as Float32Array).set(fwd);
    particleUniforms.update();
    compositeUniforms.uniforms.uGrainFrame = loopFrame(frame);
    compositeUniforms.update();

    renderer.render({ container: mesh, target: density, clear: true, clearColor: [0, 0, 0, 0] });
    chainSprites.forEach((s, i) => renderer.render({ container: s, target: chain[i], clear: true, clearColor: [0, 0, 0, 0] }));
    // one app.render() per Remotion frame
    app.render();
  };
  return { app, render };
};

export const ParticleSmoke: React.FC<ParticleSmokeProps> = ({ version }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const dpr = useRenderDpr();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const { delayRender, continueRender } = useDelayRender();
  const v = SMOKE_VERSIONS[version];

  const initHandle = useRef<number | null>(null);
  useEffect(() => {
    const handle = delayRender("Initialising PixiJS", { timeoutInMilliseconds: 300000 });
    initHandle.current = handle;
    let alive = true;
    let created: Ctx | null = null;
    createSmoke(canvasRef.current!, width, height, dpr, v)
      .then((c) => {
        created = c;
        if (alive) setCtx(c);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
      if (initHandle.current !== null) {
        continueRender(initHandle.current);
        initHandle.current = null;
      }
      created?.app.destroy({ removeView: false }, { children: true });
    };
  }, [width, height, dpr, v, delayRender, continueRender]);

  // Render synchronously as soon as the frame changes; release the initial
  // delayRender only after the first frame is on the canvas.
  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.render(frame);
    if (initHandle.current !== null) {
      continueRender(initHandle.current);
      initHandle.current = null;
    }
  }, [ctx, frame, continueRender]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} style={{ width, height }} />
    </AbsoluteFill>
  );
};
