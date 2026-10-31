import React, { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import {
  BillboardBatch,
  Line,
  LineBatch,
  SPRITE_FLARE,
  SPRITE_GLOW,
  Sprite,
  SpriteBatch,
  createBackground,
  createSharedUniforms,
  createVignette,
} from "../engine/batches";
import { mulberry32, range } from "../engine/random";
import { createTextPlane } from "../engine/textPlane";
import { computeCrashCamera } from "./camera";
import { ARCTIC_PALETTE, CrashPalette, EMBER_PALETTE } from "./palette";
import { SparkBurst, buildCrashScene } from "./scene";
import { TICKER_FONT, createTickerTexture } from "./ticker";

// Colours are authored directly in display space for the custom shaders.
THREE.ColorManagement.enabled = false;

export type CrashVariant = "v1-reference" | "v2-arctic";

export type MarketCrashProps = {
  variant: CrashVariant;
};

const SCENE_SEED = 5245327;

type Spark = { dir: THREE.Vector3; speed: number; delay: number; burst: SparkBurst };

type Engine = { render: (frame: number) => void; dispose: () => void };

const createEngine = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  fps: number,
  frames: number,
  palette: CrashPalette,
): Engine => {
  const data = buildCrashScene(palette, SCENE_SEED);
  const states = computeCrashCamera(fps, frames);

  const isStudio = getRemotionEnvironment().isStudio;
  const dpr = isStudio
    ? 0.5
    : Math.min(1, Math.max(0.25, window.devicePixelRatio || 1));
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);

  const uniforms = createSharedUniforms();
  const buf = new THREE.Vector2();
  renderer.getDrawingBufferSize(buf);
  uniforms.uRes.value.copy(buf);
  uniforms.uAperture.value = 9;
  uniforms.uFog.value = 0.006;
  uniforms.uMaxCoc.value = 200;

  const scene = new THREE.Scene();
  scene.add(createBackground(palette.bgInner, palette.bgOuter, uniforms));

  // Ticker boards (canvas textures)
  data.tickers.forEach((t) => {
    const tex = createTickerTexture(mulberry32(t.seed * 7919), {
      width: t.texW,
      height: t.texH,
      rows: t.rows,
      groups: t.groups,
    });
    const mesh = createTextPlane({
      texture: tex,
      width: t.w,
      height: t.h,
      color: palette.text,
      alpha: t.alpha,
      glow: t.glow,
      uniforms,
    });
    mesh.position.copy(t.pos);
    mesh.rotation.set(t.rotX, t.rotY, 0);
    scene.add(mesh);
  });

  scene.add(new LineBatch(data.lines, uniforms).mesh);
  scene.add(new BillboardBatch(data.billboards, uniforms).mesh);
  scene.add(new SpriteBatch(data.sprites, uniforms).mesh);

  // Spark bursts: CPU-simulated (deterministic) sparks + trails + flash.
  const sparks: Spark[] = [];
  data.bursts.forEach((b) => {
    const rng = mulberry32(b.seed);
    for (let i = 0; i < b.count; i++) {
      const u = rng() * 2 - 1;
      const th = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const dir = new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th) * 0.5);
      sparks.push({ dir: dir.normalize(), speed: range(rng, b.speed[0], b.speed[1]), delay: rng() * 0.12, burst: b });
    }
  });
  const sparkSprites: Sprite[] = sparks.map(() => ({
    pos: new THREE.Vector3(),
    color: palette.flareCore,
    alpha: 0,
    size: 0.12,
    minPx: 3,
    kind: SPRITE_GLOW,
  }));
  data.bursts.forEach((b) => {
    sparkSprites.push({ pos: b.origin, color: palette.flare, alpha: 0, size: 26, minPx: 300, kind: SPRITE_FLARE });
    sparkSprites.push({ pos: b.origin, color: palette.flareCore, alpha: 0, size: 3, minPx: 40, kind: SPRITE_GLOW });
  });
  const sparkBatch = new SpriteBatch(sparkSprites, uniforms);
  const trailLines: Line[] = sparks.map(() => ({
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    colorA: palette.spark,
    colorB: palette.flareCore,
    alphaA: 0,
    alphaB: 0,
    width: 2,
  }));
  const trailBatch = new LineBatch(trailLines, uniforms);
  scene.add(trailBatch.mesh, sparkBatch.mesh);
  // Heavy lens vignette (as in the reference), rendered in WebGL with dither
  // so the dark falloff never bands.
  scene.add(createVignette({ inner: 0.3, outer: 1.3, strength: 0.93 }, uniforms));

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();

  return {
    render: (frame) => {
      const t = frame / fps;
      const s = states[Math.min(states.length - 1, Math.max(0, frame))];
      camera.fov = s.fov;
      camera.position.copy(s.pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(s.target);
      camera.rotateZ(s.roll);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      uniforms.uTime.value = t;
      uniforms.uFocus.value = s.focus;

      sparks.forEach((sp, i) => {
        const age = t - sp.burst.t0 - sp.delay;
        const life = sp.burst.life;
        if (age <= 0 || age > life) {
          sparkBatch.setInstance(i, sp.burst.origin, 0);
          trailBatch.setLine(i, sp.burst.origin, sp.burst.origin, 0, 0);
          return;
        }
        // decelerating radial motion: x(t) = v * (1 - e^{-kt}) / k
        const kD = 2.2;
        const dist = (sp.speed * (1 - Math.exp(-kD * age))) / kD;
        const back = (sp.speed * (1 - Math.exp(-kD * Math.max(0, age - 0.1)))) / kD;
        pa.copy(sp.dir).multiplyScalar(dist).add(sp.burst.origin);
        pa.y -= 0.6 * age * age;
        pb.copy(sp.dir).multiplyScalar(back).add(sp.burst.origin);
        pb.y -= 0.6 * Math.max(0, age - 0.1) ** 2;
        const fade = 1 - age / life;
        sparkBatch.setInstance(i, pa, fade);
        trailBatch.setLine(i, pb, pa, 0, fade * 0.9);
      });
      data.bursts.forEach((b, j) => {
        const age = t - b.t0;
        const flash = age < 0 ? 0 : Math.exp(-age * 3.2) * Math.min(1, age * 20);
        sparkBatch.setInstance(sparks.length + j * 2, b.origin, flash);
        sparkBatch.setInstance(sparks.length + j * 2 + 1, b.origin, flash);
      });
      sparkBatch.commit();
      trailBatch.commit();

      renderer.render(scene, camera);
    },
    dispose: () => {
      renderer.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.ShaderMaterial;
          (m.uniforms?.uMap?.value as THREE.Texture | undefined)?.dispose();
          m.dispose();
        }
      });
    },
  };
};

const loadFont = async () => {
  const face = new FontFace(
    TICKER_FONT,
    `url(${staticFile("fonts/oswald-latin-500-normal.woff2")}) format("woff2")`,
    { weight: "500" },
  );
  await face.load();
  document.fonts.add(face);
};

export const MarketCrash: React.FC<MarketCrashProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [handle] = useState(() => delayRender("Loading font + building WebGL scene"));
  const [ready, setReady] = useState(false);
  const continuedRef = useRef(false);
  const palette = variant === "v1-reference" ? EMBER_PALETTE : ARCTIC_PALETTE;

  useLayoutEffect(() => {
    let cancelled = false;
    loadFont()
      .then(() => {
        if (cancelled) return;
        engineRef.current = createEngine(
          canvasRef.current!,
          width,
          height,
          fps,
          durationInFrames,
          palette,
        );
        setReady(true);
      })
      .catch((e) => cancelRender(e));
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [width, height, fps, durationInFrames, palette]);

  useLayoutEffect(() => {
    if (!ready || !engineRef.current) return;
    engineRef.current.render(frame);
    if (!continuedRef.current) {
      continuedRef.current = true;
      continueRender(handle);
    }
  }, [frame, ready, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
