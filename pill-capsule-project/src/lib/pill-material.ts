import * as THREE from "three";
import { replaceOnce } from "./shader-patch";

/**
 * Pharmaceutical coating: glossy but not mirrored, opaque, with a hard
 * clearcoat highlight. Two deviations from stock MeshPhysicalMaterial:
 *
 *  1. Wrapped diffuse, so the terminator rolls instead of cutting. Real pills
 *     are faintly translucent at the edge and never go dead grey in shadow.
 *  2. A warm tint inside the wrap band, which is the cheap stand-in for
 *     subsurface scattering. No transmission — these are opaque.
 */
export type PillMaterialOptions = {
  color: THREE.ColorRepresentation;
  roughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  /** How far past the terminator direct light wraps. 0 = stock Lambert. */
  wrap?: number;
  /** Tint of the wrapped band. */
  subsurface?: THREE.ColorRepresentation;
};

export class PillMaterial extends THREE.MeshPhysicalMaterial {
  private readonly wrapAmount: number;
  private readonly subsurfaceTint: THREE.Color;

  constructor(opts: PillMaterialOptions) {
    super({
      color: new THREE.Color(opts.color),
      roughness: opts.roughness ?? 0.3,
      metalness: 0,
      clearcoat: opts.clearcoat ?? 0.6,
      clearcoatRoughness: opts.clearcoatRoughness ?? 0.08,
      // +-1/255 ordered dither on the shading, before the output transform.
      dithering: true,
    });
    this.wrapAmount = opts.wrap ?? 0.32;
    this.subsurfaceTint = new THREE.Color(opts.subsurface ?? "#ffd2bc");
  }

  override onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    const w = this.wrapAmount.toFixed(4);
    const t = this.subsurfaceTint;
    const tint = `vec3(${t.r.toFixed(4)}, ${t.g.toFixed(4)}, ${t.b.toFixed(4)})`;

    // Match single lines only. three ships two copies of every chunk — the
    // readable one under src/ and a build where blank lines are stripped —
    // so a multi-line needle matches in one and silently misses in the other.
    const patched = replaceOnce(
      replaceOnce(
        THREE.ShaderChunk.lights_physical_pars_fragment,
        "float dotNL = saturate( dot( geometryNormal, directLight.direction ) );",
        `float rawNL = dot( geometryNormal, directLight.direction );
	float dotNL = saturate( rawNL );
	float wrapNL = saturate( ( rawNL + ${w} ) / ( 1.0 + ${w} ) );
	vec3 wrapIrradiance = directLight.color * wrapNL * mix( ${tint}, vec3( 1.0 ), saturate( rawNL ) );`,
        "wrapped diffuse term",
      ),
      "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );",
      "reflectedLight.directDiffuse += wrapIrradiance * BRDF_Lambert( material.diffuseColor );",
      "wrapped diffuse application",
    );

    shader.fragmentShader = replaceOnce(
      shader.fragmentShader,
      "#include <lights_physical_pars_fragment>",
      patched,
      "physical lighting chunk",
    );
  };

  override customProgramCacheKey = () =>
    `pill-wrap-${this.wrapAmount}-${this.subsurfaceTint.getHexString()}`;
}

/** Flat white silhouette material for look 2's luma matte pass. */
export const matteMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  toneMapped: false,
  fog: false,
});
