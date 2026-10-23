import React, { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { buildWorld, defaultPalette, updateLeds } from "./build";
import { CameraShot, craneUp, lateralTrack } from "./cameras";

export type ServerRacksProps = {
  shot: "craneUp" | "lateralTrack";
};

const SHOTS: Record<ServerRacksProps["shot"], CameraShot> = { craneUp, lateralTrack };

type World = {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  bokeh: BokehPass;
  leds: ReturnType<typeof buildWorld>["leds"];
  dispose: () => void;
};

export const ServerRacks: React.FC<ServerRacksProps> = ({ shot }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const cam = SHOTS[shot];

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    // The composition is 3840x2160. When rendered with --scale, Remotion lowers
    // devicePixelRatio and we rasterise at the output size instead.
    renderer.setPixelRatio(Math.min(1, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cam.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const { scene, leds, env } = buildWorld(renderer, defaultPalette);
    const camera = new THREE.PerspectiveCamera(cam.fov, width / height, 1, 3000);

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const bokeh = new BokehPass(scene, camera, {
      focus: 40,
      aperture: cam.aperture,
      maxblur: cam.maxBlur,
    });
    composer.addPass(bokeh);
    const pr = renderer.getPixelRatio();
    composer.addPass(
      new UnrealBloomPass(new THREE.Vector2((width * pr) / 2, (height * pr) / 2), 0.38, 0.45, 0.92),
    );
    composer.addPass(new OutputPass());

    world.current = {
      renderer,
      composer,
      camera,
      bokeh,
      leds,
      dispose: () => {
        composer.dispose();
        env.dispose();
        renderer.dispose();
      },
    };
    return () => {
      world.current?.dispose();
      world.current = null;
    };
  }, [width, height, cam]);

  useLayoutEffect(() => {
    const w = world.current;
    if (!w) return;
    const t = frame / fps;
    const p = frame / (durationInFrames - 1);
    const { position, target, focus } = cam.pose(t, p);
    w.camera.position.copy(position);
    w.camera.lookAt(target);
    w.camera.updateMatrixWorld();
    const uniforms = w.bokeh.uniforms as Record<string, THREE.IUniform<number>>;
    // BokehPass focus is a view-space depth, so project the focus point.
    const viewDir = target.clone().sub(position).normalize();
    uniforms.focus.value = focus.clone().sub(position).dot(viewDir);
    updateLeds(w.leds, t);
    w.composer.render();
  }, [frame, fps, durationInFrames, cam]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#05070b" }}>
      <canvas ref={canvasRef} style={{ width, height }} />
    </AbsoluteFill>
  );
};
