/**
 * The post chain, assembled from the look's PostSpec.
 *
 * Fixed order, and the order matters: defocus first so bloom blooms the
 * defocused image rather than the other way round, then vignette, then grain
 * and dither last so the dither lands on the final 8-bit values.
 *
 * Bloom only exists on the two neon looks. Looks 1 and 4 are photographic;
 * bloom on them would read as a glow filter rather than as light.
 */

import React from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Bloom, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { CAMERA } from "../looks/data";
import type { PostSpec } from "../looks/types";
import { GrainDither } from "./GrainDither";

export const Post: React.FC<{
  spec: PostSpec;
  frame: number;
  /** World-space point the focus plane sits on: always the podium top. */
  focusTarget: [number, number, number];
  cameraPosition: [number, number, number];
}> = ({ spec, frame, focusTarget, cameraPosition }) => {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  const distance = Math.hypot(
    focusTarget[0] - cameraPosition[0],
    focusTarget[1] - cameraPosition[1],
    focusTarget[2] - cameraPosition[2],
  );

  // Normalised linear depth, computed here rather than handed to the effect's
  // worldFocusDistance setter. That setter converts using the circle-of-
  // confusion material's own near/far, which are only populated once the
  // camera is attached - setting it from a prop on mount converts against
  // placeholder values and silently puts the focus plane in the wrong place.
  // The camera's near and far are ours and fixed, so the conversion is exact.
  const depthSpan = CAMERA.far - CAMERA.near;
  const focusDistance = (distance - CAMERA.near) / depthSpan;
  const focusRange = spec.dof.focusRange / depthSpan;

  // bokehScale is a radius in texels of the effect's internal buffer, which
  // tracks the output resolution - so a fixed value blurs half as much,
  // relatively, at 4K as it does in a 1080p preview. Scaling it by the actual
  // buffer height keeps the previews an honest proxy for the masters. Values
  // on the look rows are calibrated at 1080p.
  const bufferHeight = size.height * dpr;
  const bokehScale = (spec.dof.bokehScale * bufferHeight) / 1080;

  return (
    <EffectComposer
      // MSAA. A clean plinth silhouette against a plain backdrop shows
      // stair-stepping immediately, and it is the first thing that reads as
      // amateur at 4K.
      multisampling={8}
      // Half-float buffers: bloom needs headroom above 1.0 to pick highlights
      // out properly, and the smooth gradients need more than 8 bits through
      // the chain or the dither pass has banding to fix that it should not.
      frameBufferType={THREE.HalfFloatType}
    >
      <DepthOfField
        focusDistance={focusDistance}
        focusRange={focusRange}
        bokehScale={bokehScale}
      />
      {spec.bloom ? (
        <Bloom
          intensity={spec.bloom.intensity}
          luminanceThreshold={spec.bloom.threshold}
          luminanceSmoothing={spec.bloom.smoothing}
          mipmapBlur
        />
      ) : (
        <></>
      )}
      {spec.vignette > 0 ? (
        <Vignette
          offset={0.3}
          darkness={spec.vignette}
          blendFunction={BlendFunction.NORMAL}
        />
      ) : (
        <></>
      )}
      <GrainDither frame={frame} grain={spec.grain} dither={spec.dither} />
    </EffectComposer>
  );
};
