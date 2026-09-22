import { useLayoutEffect, useRef } from "react";
import { EffectComposer, DepthOfField, SMAA, ToneMapping } from "@react-three/postprocessing";
import { DepthOfFieldEffect, KernelSize, ToneMappingMode } from "postprocessing";
import { HalfFloatType } from "three";
import { Grain } from "./GrainEffect";
import type { DofSpec } from "../data/looks";

/**
 * Depth of field, with the near circle-of-confusion blur pulled in.
 *
 * postprocessing blurs the near CoC buffer before the near bokeh gathers from
 * the (unmasked) colour buffer. That blur spreads a foreground object's CoC a
 * fixed number of pixels past its own silhouette, so the background just
 * outside a bright pill gathers the pill's colour and every capsule picks up a
 * pale outline. The far field does not do this — it is masked by CoC first.
 *
 * The blur is there to soften the near/far transition, so it cannot simply be
 * switched off; a small kernel keeps the softening and shrinks the fringe to
 * about where a real lens would put it. There is no prop for this, hence the
 * ref.
 */
const TunedDepthOfField: React.FC<DofSpec> = (dof) => {
  const ref = useRef<DepthOfFieldEffect>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.blurPass.kernelSize = KernelSize.VERY_SMALL;
  });
  return (
    <DepthOfField
      ref={ref}
      worldFocusDistance={dof.worldFocusDistance}
      worldFocusRange={dof.worldFocusRange}
      bokehScale={dof.bokehScale}
      // The bokeh passes are the most expensive thing in the chain and their
      // output is, by definition, blurred. Half resolution is free quality.
      resolutionScale={0.5}
    />
  );
};

/**
 * The post chain: real depth-based blur, AgX, then grain and dither.
 *
 * Everything here is a pure spatial shader. Forbidden and absent: TAA,
 * temporal motion blur, temporally-denoised SSAO, adaptive tone mapping —
 * anything that accumulates across frames would break out-of-order rendering.
 *
 * Tone mapping runs as an effect rather than on the renderer, because three
 * disables renderer tone mapping when drawing into a render target, which is
 * exactly what the composer does.
 */
export const Post: React.FC<{
  dof: DofSpec;
  grain: number;
  /** Already reduced modulo the loop length. */
  frameIndex: number;
}> = ({ dof, grain, frameIndex }) => (
  // multisampling is 0 and SMAA does the anti-aliasing instead. MSAA on a
  // multisampled HDR target is the single most expensive thing in this chain
  // under software WebGL, and SMAA is both spatial (so still deterministic)
  // and enough for these silhouettes.
  <EffectComposer
    multisampling={0}
    frameBufferType={HalfFloatType}
    enableNormalPass={false}
  >
    <TunedDepthOfField {...dof} />
    <ToneMapping mode={ToneMappingMode.AGX} />
    <Grain amount={grain} frameIndex={frameIndex} />
    <SMAA />
  </EffectComposer>
);
