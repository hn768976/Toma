import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { z } from "zod";

import {
  CAMERA_DISTANCE,
  CAMERA_FOV,
  CORE_RADIUS,
  PLANE_SEGMENTS,
  PLANE_SIZE,
  PULSE_AMOUNT,
  PULSE_RADIAL_LAG,
  RIDGE_AMPLITUDE,
  RIDGE_FREQUENCY,
  RIDGE_TIGHTEN,
  RIDGE_TIGHTEN_FALLOFF,
  RIPPLE_CENTER,
  RIPPLE_CYCLES_PER_LOOP,
  ROTATIONS_PER_LOOP,
  SHADOW_START,
  SHADOW_STEP,
  SPIRAL_ARMS,
} from "./constants";
import { fragmentShader, vertexShader } from "./shader";
import {
  FIBRE_SCALE,
  FILL_AZIMUTH_DEG,
  FILL_ELEVATION_DEG,
  KEY_AZIMUTH_DEG,
  KEY_ELEVATION_DEG,
  VARIANT_PRESETS,
  type PaperRippleVariant,
} from "./variants";

export const paperRippleReliefSchema = z.object({
  variant: z.enum(["white", "graphite"]),
});

export const paperRippleReliefDefaults: z.infer<
  typeof paperRippleReliefSchema
> = {
  variant: "white",
};

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const srgbToLinearChannel = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/**
 * sRGB hex -> linear-light RGB. All shading happens in linear and the shader
 * encodes to sRGB itself at the very end.
 *
 * Done by hand rather than via THREE.Color so it cannot be affected by
 * three's colour-management state: `setStyle(hex, SRGBColorSpace)` already
 * decodes to the linear working space, and decoding a second time silently
 * crushes every mid-tone.
 */
const linearColor = (hex: string): THREE.Vector3 => {
  const n = parseInt(hex.replace("#", ""), 16);
  return new THREE.Vector3(
    srgbToLinearChannel(((n >> 16) & 255) / 255),
    srgbToLinearChannel(((n >> 8) & 255) / 255),
    srgbToLinearChannel((n & 255) / 255),
  );
};

const directionFrom = (azimuthDeg: number, elevationDeg: number) => {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return new THREE.Vector3(
    Math.cos(el) * Math.cos(az),
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
  ).normalize();
};

const Surface: React.FC<{
  variant: PaperRippleVariant;
  aspect: number;
}> = ({ variant, aspect }) => {
  const preset = VARIANT_PRESETS[variant];

  // The frame is read HERE, inside the canvas, rather than being computed by
  // the parent and handed down as props.
  //
  // <ThreeCanvas> hands its `children` element to react-three-fiber's own
  // reconciler. Components inside that tree re-render from their own hooks
  // every frame, but the `children` element the parent captured does not
  // reliably follow the parent's re-render — so frame-dependent *props* go
  // stale while the canvas keeps redrawing. That renders a video in which
  // every frame is frame 0, while `remotion still` still looks correct
  // because each still is a fresh page whose first render is always right.
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Remotion renders frames out of order across threads, so every animated
  // value below is a pure function of the frame number. No clock, no deltas.
  const t = frame / durationInFrames;

  // One full turn across the loop: the vortex seam sweeps around once. A
  // single-arm spiral only maps back onto itself after 360 deg, so nothing
  // shorter would loop.
  const rotation = TAU * ROTATIONS_PER_LOOP * t;
  // The ripples themselves travelling outward. A whole number of ridge
  // periods across the loop, so this lands back on frame 0 too.
  const ripplePhase = TAU * RIPPLE_CYCLES_PER_LOOP * t;
  // One breath in, one breath out, landing exactly where it started.
  const pulsePhase = TAU * t;
  const grainSeed = frame * 17.13;

  // Built once per variant and then mutated in place: the uniform object
  // identity has to stay stable or three rebuilds the program every frame.
  const uniforms = useMemo(
    () => ({
      uCenter: { value: new THREE.Vector2(...RIPPLE_CENTER) },
      uAmplitude: { value: RIDGE_AMPLITUDE },
      uCoreRadius: { value: CORE_RADIUS },
      uFrequency: { value: RIDGE_FREQUENCY },
      uTighten: { value: RIDGE_TIGHTEN },
      uTightenFalloff: { value: RIDGE_TIGHTEN_FALLOFF },
      uSpiral: { value: SPIRAL_ARMS },
      uRotation: { value: 0 },
      uRipplePhase: { value: 0 },
      uPulseAmount: { value: PULSE_AMOUNT },
      uPulseLag: { value: PULSE_RADIAL_LAG },
      uPulsePhase: { value: 0 },

      uKeyDir: { value: directionFrom(KEY_AZIMUTH_DEG, KEY_ELEVATION_DEG) },
      uFillDir: { value: directionFrom(FILL_AZIMUTH_DEG, FILL_ELEVATION_DEG) },
      uKeyColor: { value: linearColor(preset.keyColor) },
      uFillColor: { value: linearColor(preset.fillColor) },
      uAmbientColor: { value: linearColor(preset.ambientColor) },
      uKeyIntensity: { value: preset.keyIntensity },
      uFillIntensity: { value: preset.fillIntensity },
      uAmbientIntensity: { value: preset.ambientIntensity },

      uAlbedo: { value: linearColor(preset.albedo) },
      uWrap: { value: preset.wrap },
      uSubsurfaceColor: { value: linearColor(preset.subsurfaceColor) },
      uSubsurfaceIntensity: { value: preset.subsurfaceIntensity },

      uSheenColor: { value: linearColor(preset.sheenColor) },
      uSheenIntensity: { value: preset.sheenIntensity },
      uSheenPower: { value: preset.sheenPower },

      uOcclusion: { value: preset.occlusion },
      uShadowSoftness: { value: preset.shadowSoftness },
      uShadowStart: { value: SHADOW_START },
      uShadowStep: { value: SHADOW_STEP },

      uExposure: { value: preset.exposure },
      uVignette: { value: preset.vignette },
      uGrain: { value: preset.grain },
      uGrainSeed: { value: 0 },
      uAspect: { value: aspect },
      uFibreScale: { value: FIBRE_SCALE },
      uFibreAmount: { value: preset.fibreAmount },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variant],
  );

  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Per-frame values are written onto the MATERIAL, not onto the `uniforms`
  // object above.
  //
  // react-three-fiber copies that object into the material when the material
  // is first created. From then on the material owns a different object, and
  // because the prop's identity never changes R3F never re-applies it — so
  // mutating our own copy silently stops reaching the GPU after frame 0. The
  // draw call still happens every frame, it just draws the same values, which
  // renders a video where every frame is frame 0. `remotion still` hides the
  // bug completely, because a still only ever performs that first draw.
  //
  // This has to be a LAYOUT effect. <ThreeCanvas> issues its manual draw from
  // a passive effect, and React runs all layout effects before any passive
  // effect, so writing here lands before the draw for the same frame. In a
  // passive effect it would race with the draw and land a frame late.
  useLayoutEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uRotation.value = rotation;
    material.uniforms.uRipplePhase.value = ripplePhase;
    material.uniforms.uPulsePhase.value = pulsePhase;
    material.uniforms.uGrainSeed.value = grainSeed;
    material.uniforms.uAspect.value = aspect;
  });

  return (
    <mesh>
      <planeGeometry
        args={[PLANE_SIZE, PLANE_SIZE, PLANE_SEGMENTS, PLANE_SEGMENTS]}
      />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
};

export const PaperRippleRelief: React.FC<
  z.infer<typeof paperRippleReliefSchema>
> = ({ variant }) => {
  const { width, height } = useVideoConfig();
  const preset = VARIANT_PRESETS[variant];

  // The drawing buffer must follow Remotion's --scale, otherwise react-three-
  // fiber clamps devicePixelRatio to >= 1 and the preview quietly renders the
  // full 4K buffer.
  const [dpr] = useState(() =>
    typeof window === "undefined" ? 1 : window.devicePixelRatio,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: preset.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        gl={{ antialias: false }}
        // No geometric edges are ever in frame — the plane overfills it — so
        // MSAA would cost fill rate and buy nothing.
        onCreated={({ gl }) => {
          // The shader writes display-referred sRGB itself, so three must not
          // convert a second time on the way out.
          gl.outputColorSpace = THREE.LinearSRGBColorSpace;
          gl.setClearColor(new THREE.Color(preset.background));
        }}
        camera={{
          fov: CAMERA_FOV,
          position: [0, 0, CAMERA_DISTANCE],
          near: 0.1,
          far: 100,
        }}
      >
        <Surface variant={variant} aspect={width / height} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
