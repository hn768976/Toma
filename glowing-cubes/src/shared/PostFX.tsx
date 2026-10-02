import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { DepthOfFieldEffect, EffectPass, ToneMappingMode } from "postprocessing";
import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { HalfFloatType, type PerspectiveCamera } from "three";
import { useThree } from "@react-three/fiber";
import { GrainEffect } from "./GrainEffect";
import { useReadyCheck } from "./Stage";
import { PERF } from "./perf";

type Props = {
  /** Frame index that drives the grain (pass frame % 600 for loops). */
  grainFrame: number;
  bloomIntensity?: number;
  bloomRadius?: number;
  vignette?: number;
  /** optional depth of field: focus distance & range in world units */
  dof?: { distance: number; range: number; bokeh: number };
};

type ComposerHandle = { passes?: unknown[] } | null;

/**
 * HDR pipeline: scene (linear, half-float) → bloom (threshold 1.0: only
 * emissive cubes and bright edges exceed it) → ACES filmic tone mapping →
 * vignette → grain/dither → sRGB.
 */
export const PostFX: React.FC<Props> = ({ grainFrame, bloomIntensity = 1.1, bloomRadius = 0.72, vignette = 0.45, dof }) => {
  const grain = useMemo(() => new GrainEffect({ grain: 0.0175, dither: 1 / 255 }), []);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  // Output height relative to 1080p. Pixel-based kernels (bloom mip chain,
  // depth-of-field bokeh) are scaled by it so 4K and 6000-px stills keep the
  // 1080p look. (k = 1 for the 1080p previews.)
  const outH = useThree((s) => s.size.height * s.viewport.dpr);
  const k = outH / 1080;
  const bloomLevels = 7 + Math.max(0, Math.round(Math.log2(k)));
  // The mip chain always starts at full resolution, so extra (finer) levels
  // would attenuate the coarse halo by radius^extra. Compensate so the halo
  // keeps its 1080p strength (identity at 1080p).
  const bloomRadiusScaled = Math.pow(bloomRadius, 7 / bloomLevels);
  const hasDof = dof !== undefined;
  const dofEffect = useMemo(
    () => (hasDof ? new DepthOfFieldEffect(camera, { worldFocusDistance: 18, worldFocusRange: 6, bokehScale: 4, resolutionY: 540 }) : null),
    [camera, hasDof],
  );
  useLayoutEffect(() => {
    if (!dofEffect || !dof) return;
    // set every frame from frame-derived values (no autofocus, no smoothing)
    dofEffect.cocMaterial.worldFocusDistance = dof.distance;
    dofEffect.cocMaterial.worldFocusRange = dof.range;
    dofEffect.bokehScale = dof.bokeh * k;
  }, [dofEffect, dof, k]);
  useLayoutEffect(() => {
    grain.setFrame(grainFrame);
  }, [grain, grainFrame]);

  // The composer and its passes are built asynchronously after mount; the
  // frame gate waits until the effect pass carrying the grain is in place.
  const composerRef = useRef<ComposerHandle>(null);
  const ready = useCallback(() => {
    const passes = composerRef.current?.passes ?? [];
    return passes.some((p) => p instanceof EffectPass && (p as unknown as { effects: unknown[] }).effects.includes(grain));
  }, [grain]);
  useReadyCheck(ready);

  return (
    <EffectComposer
      // @ts-expect-error the ref is the postprocessing EffectComposer; we only read .passes
      ref={composerRef}
      multisampling={0}
      frameBufferType={HalfFloatType}
    >
      {dofEffect && !PERF("nodof") ? <primitive object={dofEffect} /> : null}
      {PERF("nobloom") ? null : <Bloom
        mipmapBlur
        luminanceThreshold={1.0}
        luminanceSmoothing={0.15}
        intensity={bloomIntensity}
        radius={bloomRadiusScaled}
        levels={bloomLevels}
      />}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {PERF("nosmaa") ? null : <SMAA />}
      <Vignette offset={0.32} darkness={vignette} />
      <primitive object={grain} />
    </EffectComposer>
  );
};
