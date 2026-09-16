// Additive blending that leaves the destination alpha untouched.
//
// The background wash is composited in post using the scene pass's alpha as a
// coverage mask. Three's AdditiveBlending also adds into alpha, which would
// make the haze and the particle cloud punch holes in that wash. These
// factors keep the RGB behaviour of AdditiveBlending while pinning the alpha
// channel to whatever the opaque geometry already wrote.

import {
  AddEquation,
  CustomBlending,
  OneFactor,
  SrcAlphaFactor,
  ZeroFactor,
} from "three/webgpu";
import type { Material } from "three/webgpu";

export const applyAdditiveBlending = (material: Material): void => {
  material.blending = CustomBlending;
  material.blendEquation = AddEquation;
  material.blendSrc = SrcAlphaFactor;
  material.blendDst = OneFactor;
  material.blendEquationAlpha = AddEquation;
  material.blendSrcAlpha = ZeroFactor;
  material.blendDstAlpha = OneFactor;
};
