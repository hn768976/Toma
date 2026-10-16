import { MeshStandardMaterial, MeshStandardMaterialParameters, Texture, Vector3 } from "three";

/**
 * MeshStandardMaterial whose emissive map is modulated per pixel by a
 * "blink mask": R, G and B mark membership of three blink groups, anything
 * unmarked glows steadily. `uBlink` holds the three group levels for the
 * current frame (computed from the frame number on the CPU).
 */
export const makeLedMaterial = (params: MeshStandardMaterialParameters & { blinkMap: Texture }) => {
  const { blinkMap, ...rest } = params;
  const mat = new MeshStandardMaterial(rest);
  const uBlink = { value: new Vector3(1, 1, 1) };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBlinkMap = { value: blinkMap };
    shader.uniforms.uBlink = uBlink;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D uBlinkMap;\nuniform vec3 uBlink;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
{
  vec3 bm = texture2D(uBlinkMap, vEmissiveMapUv).rgb;
  float steady = clamp(1.0 - bm.r - bm.g - bm.b, 0.0, 1.0);
  totalEmissiveRadiance *= steady + bm.r * uBlink.x + bm.g * uBlink.y + bm.b * uBlink.z;
}`,
      );
  };
  mat.customProgramCacheKey = () => "led-material-v1";
  return { material: mat, uBlink };
};
