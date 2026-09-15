// Pins the renderer's colour pipeline to pass-through.
//
// @react-three/fiber configures the renderer with ACESFilmic tone mapping and
// an sRGB output colour space by default. A plain ShaderMaterial bypasses both
// (neither chunk is included in its source), but anything routed through
// EffectComposer does not - so the same colour rendered directly and rendered
// through the bloom composer came out differently: a pure #00ff00 backdrop
// became #93e459 once it went through the composer.
//
// Every surface in this project is emissive and authored in final display
// values, so there is nothing for a filmic curve to do except pull the palette
// off-hue. Forcing NoToneMapping + LinearSRGB makes "what the shader writes is
// what lands in the frame" true on both paths, which is what makes the palettes
// in palette.ts trustworthy.

import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export const ColorPipeline: React.FC = () => {
  const { gl } = useThree();
  gl.toneMapping = THREE.NoToneMapping;
  gl.outputColorSpace = THREE.LinearSRGBColorSpace;
  return null;
};
