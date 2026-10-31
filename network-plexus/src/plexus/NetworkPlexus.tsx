import React, { useLayoutEffect, useRef } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

// Colours are authored directly in display (sRGB) space for the custom
// shaders, so disable three.js colour management conversions.
THREE.ColorManagement.enabled = false;
import {
  BillboardBatch,
  LineBatch,
  SPRITE_GLOW,
  SpriteBatch,
  createBackground,
  createSharedUniforms,
  createVignette,
} from "../engine/batches";
import { smoothstep } from "../engine/spline";
import { CameraRig, computeStates, flyThroughRig, orbitRig } from "./camera";
import { buildScene, createLayout } from "./network";
import { REFERENCE_PALETTE } from "./palette";

export type PlexusVariant = "v1-reference" | "v2-orbit";

export type NetworkPlexusProps = {
  variant: PlexusVariant;
};

const LAYOUT_SEED = 1182137;
const SCENE_SEED = 367;

type Engine = {
  render: (frame: number) => void;
  dispose: () => void;
};

const createEngine = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  fps: number,
  frames: number,
  variant: PlexusVariant,
): Engine => {
  const palette = REFERENCE_PALETTE;
  const layout = createLayout(LAYOUT_SEED);
  const duration = frames / fps;
  const rig: CameraRig =
    variant === "v1-reference"
      ? flyThroughRig(layout, duration)
      : orbitRig(layout, duration);
  const states = computeStates(rig, layout, fps, frames);
  // Scene elements (panels, foreground streaks) are always placed along the
  // reference fly-through so both versions share one identical network.
  const v1States =
    variant === "v1-reference"
      ? states
      : computeStates(flyThroughRig(layout, duration), layout, fps, frames);
  const data = buildScene(layout, rig, v1States, fps, palette, SCENE_SEED);
  if (variant !== "v1-reference") {
    // Hub "switch-on" timing must follow the camera that is actually used.
    const scheduled = buildScene(layout, rig, states, fps, palette, SCENE_SEED);
    data.sprites = scheduled.sprites;
    data.lines = scheduled.lines;
    data.billboards = scheduled.billboards;
    data.pulses = scheduled.pulses;
  }

  // Never render more pixels than the composition (4K). In the Studio the
  // preview is scaled down anyway, so render at a lighter internal size.
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
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 1);

  const uniforms = createSharedUniforms();
  const buf = new THREE.Vector2();
  renderer.getDrawingBufferSize(buf);
  uniforms.uRes.value.copy(buf);
  uniforms.uAperture.value = rig.aperture;
  uniforms.uFog.value = rig.fog;
  uniforms.uMaxCoc.value = 260;

  const scene = new THREE.Scene();
  scene.add(createBackground(palette.bgInner, palette.bgOuter, uniforms));
  const lineBatch = new LineBatch(data.lines, uniforms);
  const bbBatch = new BillboardBatch(data.billboards, uniforms);
  const spriteBatch = new SpriteBatch(data.sprites, uniforms);
  const pulseBatch = new SpriteBatch(
    data.pulses.map((p) => ({
      pos: p.a.clone(),
      color: palette.pulse,
      alpha: 0,
      size: 0.14,
      minPx: 3,
      kind: SPRITE_GLOW,
    })),
    uniforms,
  );
  // Soft, wide lens vignette + exposure, rendered in WebGL with dither.
  const vignette = createVignette({ inner: 0.35, outer: 1.45, strength: 0.6 }, uniforms);
  const vignetteMat = vignette.material as THREE.ShaderMaterial;
  scene.add(lineBatch.mesh, bbBatch.mesh, spriteBatch.mesh, pulseBatch.mesh, vignette);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  const tmp = new THREE.Vector3();

  return {
    render: (frame: number) => {
      const t = frame / fps;
      const s = states[Math.min(states.length - 1, Math.max(0, frame))];
      camera.fov = s.fov;
      camera.position.copy(s.pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(s.target);
      // Apply roll around the viewing axis.
      camera.rotateZ(s.roll);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      uniforms.uTime.value = t;
      uniforms.uFocus.value = s.focus;
      vignetteMat.uniforms.uExposure.value = s.exposure;

      data.pulses.forEach((p, i) => {
        const u = (p.phase + t * p.speed) % 1;
        tmp.copy(p.a).lerp(p.b, u);
        const a =
          smoothstep(p.birth, p.birth + 0.5, t) *
          smoothstep(0, 0.12, u) *
          (1 - smoothstep(0.85, 1, u));
        pulseBatch.setInstance(i, tmp, a * 0.9);
      });
      pulseBatch.commit();

      renderer.render(scene, camera);
    },
    dispose: () => {
      renderer.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    },
  };
};

export const NetworkPlexus: React.FC<NetworkPlexusProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [handle] = React.useState(() => delayRender("Building WebGL scene"));

  useLayoutEffect(() => {
    try {
      engineRef.current = createEngine(
        canvasRef.current!,
        width,
        height,
        fps,
        durationInFrames,
        variant,
      );
    } catch (e) {
      cancelRender(e);
    }
    continueRender(handle);
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [width, height, fps, durationInFrames, variant, handle]);

  useLayoutEffect(() => {
    engineRef.current?.render(frame);
  }, [frame, variant, width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#03070b" }}>
      <canvas ref={canvasRef} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
