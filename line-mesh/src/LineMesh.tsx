import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  NoToneMapping,
  PlaneGeometry,
  Vector2,
} from "three";
import { buildLineRibbons, buildParameterGrid } from "./geometry";
import { LINE_FRAGMENT, LINE_VERTEX } from "./shaders/lines";
import { SOLID_FRAGMENT, SOLID_VERTEX } from "./shaders/solid";
import {
  BACKGROUND_FRAGMENT,
  FULLSCREEN_VERTEX,
  GRAIN_FRAGMENT,
} from "./shaders/overlay";
import type { Palette } from "./palettes";
import * as C from "./constants";
import * as S from "./scene-config";

const srgb = (hex: string) => new Color().setStyle(hex);

/** Shared, frame-independent uniforms. Rebuilt only when the palette changes. */
const buildUniforms = (palette: Palette) => ({
  uPhase: { value: 0 },
  uPlaneD: { value: S.PLANE_D },
  uPlaneN: { value: S.PLANE_N },
  uDepthNear: { value: S.DEPTH_NEAR },
  uDepthFar: { value: S.DEPTH_FAR },
  uSpanNear: { value: S.SPAN_NEAR },
  uSpanFar: { value: S.SPAN_FAR },
  uAmp: { value: S.AMPLITUDE },
  uAniso: { value: S.ANISOTROPY },
  uOctFreq: { value: S.OCT_FREQ },
  uOctAmp: { value: S.OCT_AMP },
  uOctDrift: { value: S.OCT_DRIFT },
  uOctTime: { value: S.OCT_TIME },

  uHalfRes: { value: new Vector2(1, 1) },
  uPixelScale: { value: 1 },
  uDeltaU: { value: 1 / (C.SAMPLES - 1) },
  uDeltaV: { value: 1 / (C.LINES - 1) },

  uWidthPx: { value: S.WIDTH_PX },
  uMinPx: { value: S.MIN_PX },
  uRefDist: { value: S.REF_DIST },
  uWidthBoost: { value: 1 },
  uAlphaScale: { value: 1 },

  uFocusDist: { value: S.FOCUS_DIST },
  uNearDist: { value: S.NEAR_DIST },
  uNearBlurPx: { value: S.NEAR_BLUR_PX },

  uLightDir: { value: S.LIGHT_DIR },
  uAmbient: { value: S.AMBIENT },
  uDiffuse: { value: S.DIFFUSE },
  uDiffusePow: { value: S.DIFFUSE_POW },
  uSpecAmount: { value: palette.specAmount },
  uSpecPow: { value: palette.specPow },
  uRimAmount: { value: palette.rimAmount },
  uRimPow: { value: S.RIM_POW },
  uTroughDarken: { value: S.TROUGH_DARKEN },
  uSafePx: { value: S.SAFE_PX },
  uMergeK: { value: S.MERGE_K },

  uFadeStart: { value: S.FADE_START },
  uFadeEnd: { value: S.FADE_END },

  uShadow: { value: srgb(palette.shadow) },
  uMid: { value: srgb(palette.mid) },
  uHot: { value: srgb(palette.hot) },
  uSpecColor: { value: srgb(palette.spec) },
  uBackground: { value: srgb(palette.background) },
  uGlowPass: { value: 0 },
  uBackOffset: { value: S.BACK_OFFSET },
  uFillStrength: { value: S.FILL_STRENGTH },
  uGridU: { value: 1 / (C.FILL_COLS - 1) },
  uGridV: { value: 1 / (C.FILL_ROWS - 1) },
  uGlowThreshold: { value: palette.glowThreshold },
});

/**
 * Locked camera with a sub-1% float that returns exactly to its start.
 *
 * The camera is written during render rather than in an effect: @remotion/three
 * advances the r3f frame from an effect of its own, and effects for a sibling
 * placed before the scene run first, so an effect here could land after the
 * draw. Render-phase writes always precede it.
 */
const CameraRig: React.FC<{ phase: number }> = ({ phase }) => {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const drift = 0.16;
  camera.position.set(
    S.CAMERA_POSITION.x + Math.sin(phase) * drift,
    S.CAMERA_POSITION.y + Math.sin(phase + 1.7) * drift * 0.5,
    S.CAMERA_POSITION.z + Math.cos(phase) * drift * 0.6,
  );
  camera.lookAt(S.CAMERA_TARGET);
  if ("fov" in camera) {
    const perspective = camera as typeof camera & { fov: number; aspect: number };
    perspective.fov = S.CAMERA_FOV;
    perspective.aspect = size.width / size.height;
  }
  camera.near = 0.5;
  camera.far = 500;
  camera.updateProjectionMatrix();
  return null;
};

const Cloth: React.FC<{ palette: Palette; phase: number; frame: number }> = ({
  palette,
  phase,
  frame,
}) => {
  const gl = useThree((s) => s.gl);

  const geometry = useMemo(() => buildLineRibbons(C.LINES, C.SAMPLES), []);
  const glowGeometry = useMemo(
    () => buildLineRibbons(C.GLOW_LINES, C.GLOW_SAMPLES),
    [],
  );
  const fillGeometry = useMemo(
    () => buildParameterGrid(C.FILL_COLS, C.FILL_ROWS),
    [],
  );
  const fullscreen = useMemo(() => new PlaneGeometry(2, 2), []);

  const lineUniforms = useMemo(() => buildUniforms(palette), [palette]);
  const glowUniforms = useMemo(() => {
    const u = buildUniforms(palette);
    u.uDeltaU.value = 1 / (C.GLOW_SAMPLES - 1);
    u.uDeltaV.value = 1 / (C.GLOW_LINES - 1);
    u.uWidthBoost.value = S.GLOW_WIDTH_BOOST;
    u.uAlphaScale.value = palette.glowStrength;
    u.uGlowPass.value = 1;
    return u;
  }, [palette]);

  const fillUniforms = useMemo(() => {
    const u = buildUniforms(palette);
    u.uGridU.value = 1 / (C.FILL_COLS - 1);
    u.uGridV.value = 1 / (C.FILL_ROWS - 1);
    return u;
  }, [palette]);

  const backgroundUniforms = useMemo(
    () => ({
      uBackground: { value: srgb(palette.background) },
      uHorizon: { value: srgb(palette.horizon) },
      uHorizonY: { value: 0.1 },
      uHorizonSpread: { value: 1.1 },
    }),
    [palette],
  );
  const grainUniforms = useMemo(
    () => ({ uSeed: { value: 0 }, uAmount: { value: S.GRAIN_AMOUNT } }),
    [],
  );

  const buffer = gl.getDrawingBufferSize(new Vector2());
  const halfRes = useMemo(
    () => new Vector2(buffer.x / 2, buffer.y / 2),
    [buffer.x, buffer.y],
  );
  const pixelScale = buffer.x / C.COMPOSITION_WIDTH;

  // Draw order matters and is not all renderOrder: three empties the opaque
  // list before the transparent one. The background wash and the opaque backing
  // are therefore left opaque so they land first (and in that order), the
  // backing writes depth, and the lines, glow and grain composite over them.
  return (
    <>
      <CameraRig phase={phase} />

      <mesh geometry={fullscreen} frustumCulled={false} renderOrder={-10}>
        <shaderMaterial
          vertexShader={FULLSCREEN_VERTEX}
          fragmentShader={BACKGROUND_FRAGMENT}
          uniforms={backgroundUniforms}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      <mesh geometry={fillGeometry} frustumCulled={false} renderOrder={-5}>
        <shaderMaterial
          vertexShader={SOLID_VERTEX}
          fragmentShader={SOLID_FRAGMENT}
          uniforms={fillUniforms}
          uniforms-uPhase-value={phase}
          depthTest
          depthWrite
        />
      </mesh>

      <mesh geometry={geometry} frustumCulled={false} renderOrder={0}>
        <shaderMaterial
          vertexShader={LINE_VERTEX}
          fragmentShader={LINE_FRAGMENT}
          uniforms={lineUniforms}
          uniforms-uPhase-value={phase}
          uniforms-uHalfRes-value={halfRes}
          uniforms-uPixelScale-value={pixelScale}
          transparent
          depthTest
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      <mesh geometry={glowGeometry} frustumCulled={false} renderOrder={1}>
        <shaderMaterial
          vertexShader={LINE_VERTEX}
          fragmentShader={LINE_FRAGMENT}
          uniforms={glowUniforms}
          uniforms-uPhase-value={phase}
          uniforms-uHalfRes-value={halfRes}
          uniforms-uPixelScale-value={pixelScale}
          transparent
          depthTest
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </mesh>

      <mesh geometry={fullscreen} frustumCulled={false} renderOrder={10}>
        <shaderMaterial
          vertexShader={FULLSCREEN_VERTEX}
          fragmentShader={GRAIN_FRAGMENT}
          uniforms={grainUniforms}
          uniforms-uSeed-value={frame}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
};

export const LineMesh: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Everything animated is a pure function of this, and it is 2*PI-periodic.
  const phase = (2 * Math.PI * frame) / durationInFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        flat
        gl={{ antialias: true, toneMapping: NoToneMapping }}
        camera={{ fov: S.CAMERA_FOV, near: 0.5, far: 500 }}
      >
        <Cloth palette={palette} phase={phase} frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
