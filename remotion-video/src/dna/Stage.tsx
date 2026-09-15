import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";

export type CameraState = {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  /** Roll around the view axis, in degrees. */
  roll?: number;
};

/**
 * Applies the Remotion-frame-derived camera state during render. The camera is
 * an imperative three object, so driving it here keeps every frame a pure
 * function of `useCurrentFrame()` with no animation loop involved.
 */
const CameraRig: React.FC<{ state: CameraState }> = ({ state }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...state.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(new THREE.Vector3(...state.lookAt));
  if (state.roll) camera.rotateZ((state.roll * Math.PI) / 180);
  if (camera.fov !== state.fov) {
    camera.fov = state.fov;
  }
  camera.near = 0.05;
  camera.far = 120;
  camera.updateProjectionMatrix();
  return null;
};

export type EnvSpec = {
  /** Colour at the top of the procedural equirect environment. */
  top: string;
  /** Colour at the horizon. */
  middle: string;
  /** Colour at the bottom. */
  bottom: string;
  intensity?: number;
};

/**
 * Builds a small procedural equirectangular environment and installs it as the
 * scene environment. Reflective and glass-like materials need an environment to
 * read as glass at all; generating it avoids shipping an HDR file.
 */
const Environment: React.FC<{ spec: EnvSpec }> = ({ spec }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  const texture = useMemo(() => {
    const w = 64;
    const h = 32;
    const data = new Uint8Array(w * h * 4);
    const top = new THREE.Color(spec.top);
    const mid = new THREE.Color(spec.middle);
    const bot = new THREE.Color(spec.bottom);
    const c = new THREE.Color();
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1);
      if (t < 0.5) c.copy(top).lerp(mid, t * 2);
      else c.copy(mid).lerp(bot, (t - 0.5) * 2);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = Math.round(c.r * 255);
        data[i + 1] = Math.round(c.g * 255);
        data[i + 2] = Math.round(c.b * 255);
        data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromEquirectangular(tex);
    pmrem.dispose();
    tex.dispose();
    return rt.texture;
  }, [gl, spec.top, spec.middle, spec.bottom]);

  scene.environment = texture;
  scene.environmentIntensity = spec.intensity ?? 1;
  return null;
};

export type FogSpec = { color: string; near: number; far: number };

const SceneFog: React.FC<{ spec?: FogSpec }> = ({ spec }) => {
  const scene = useThree((s) => s.scene);
  scene.fog = spec ? new THREE.Fog(spec.color, spec.near, spec.far) : null;
  return null;
};

export type GlowSpec = {
  /** CSS blur radius in output pixels at 1080p; scaled with the composition. */
  blur: number;
  opacity: number;
  /** Render scale of the glow pass. Low values are much cheaper and the blur
   *  hides the loss of detail. */
  scale?: number;
  saturate?: number;
  blend?: "screen" | "lighten" | "plus-lighter";
};

export type StageProps = {
  width: number;
  height: number;
  /** 1 at 1080p, 2 at 4K — used to keep pixel-based effects consistent. */
  resolutionScale: number;
  camera: CameraState;
  env?: EnvSpec;
  fog?: FogSpec;
  glow?: GlowSpec;
  /** Applied as the WebGL clear colour; use `transparent` for DOM backdrops. */
  clearColor?: string;
  clearAlpha?: number;
  toneMappingExposure?: number;
  children: React.ReactNode;
};

const fillStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

/**
 * A single Remotion-driven three.js stage.
 *
 * When `glow` is set the scene is drawn a second time into a deliberately small
 * drawing buffer, stretched back to full size and CSS-blurred under a screen
 * blend. Dark pixels contribute nothing to a screen blend, so only the bright
 * parts bloom — the same read as an UnrealBloomPass, except the blur runs in
 * the compositor rather than in SwiftShader, which matters a great deal when
 * rendering headless on CPU.
 */
export const Stage: React.FC<StageProps> = ({
  width,
  height,
  resolutionScale,
  camera,
  env,
  fog,
  glow,
  clearColor = "#000000",
  clearAlpha = 1,
  toneMappingExposure = 1,
  children,
}) => {
  const scene = (
    <>
      <CameraRig state={camera} />
      {env ? <Environment spec={env} /> : null}
      <SceneFog spec={fog} />
      {children}
    </>
  );

  const glowScale = glow?.scale ?? 0.4;

  return (
    <AbsoluteFill>
      <AbsoluteFill>
        <ThreeCanvas
          width={width}
          height={height}
          style={fillStyle}
          gl={{ antialias: true, alpha: clearAlpha < 1 }}
          dpr={1}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color(clearColor), clearAlpha);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = toneMappingExposure;
          }}
        >
          {scene}
        </ThreeCanvas>
      </AbsoluteFill>

      {glow ? (
        <AbsoluteFill
          className="dna-glow-pass"
          style={{
            filter: `blur(${glow.blur * resolutionScale}px) saturate(${
              glow.saturate ?? 1.25
            })`,
            mixBlendMode: glow.blend ?? "screen",
            opacity: glow.opacity,
          }}
        >
          <ThreeCanvas
            width={Math.max(2, Math.round(width * glowScale))}
            height={Math.max(2, Math.round(height * glowScale))}
            style={fillStyle}
            gl={{ antialias: false }}
            dpr={1}
            flat
            onCreated={({ gl }) => {
              gl.setClearColor(new THREE.Color("#000000"), 1);
              gl.toneMapping = THREE.NoToneMapping;
            }}
          >
            {scene}
          </ThreeCanvas>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
