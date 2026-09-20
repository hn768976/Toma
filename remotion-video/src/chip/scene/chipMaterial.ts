import * as THREE from "three";

/**
 * Materials for the package itself.
 *
 * Both the body and the lid are real MeshPhysicalMaterials — so refraction,
 * clearcoat and iridescence come from three's PBR model rather than being
 * faked — with two extra terms injected:
 *
 *  - a Fresnel rim, which is what makes the chip edges read as a bright
 *    metallic lip against a dark board (the "white glow along its edges"), and
 *  - a hologram term that dissolves the surface into a pixel lattice, used for
 *    V3's descent before it resolves into a solid black processor.
 */
export type ChipUniforms = {
  uTime: { value: number };
  uRim: { value: number };
  uRimColor: { value: THREE.Color };
  uRimPower: { value: number };
  uHolo: { value: number };
  uHoloColor: { value: THREE.Color };
  uHoloScale: { value: number };
  uScan: { value: number };
};

export type LidUniforms = ChipUniforms & {
  uLid: { value: THREE.Texture | null };
  uLabel: { value: number };
  uLabelColor: { value: THREE.Color };
  uDie: { value: number };
  uDieColor: { value: THREE.Color };
  uCircuit: { value: number };
  uSheen: { value: number };
  uSheenA: { value: THREE.Color };
  uSheenB: { value: THREE.Color };
};

const RIM_PARS = /* glsl */ `
uniform float uTime, uRim, uRimPower, uHolo, uHoloScale, uScan;
uniform vec3 uRimColor, uHoloColor;
`;

const LID_PARS = /* glsl */ `
uniform sampler2D uLid;
uniform float uLabel, uDie, uCircuit, uSheen;
uniform vec3 uLabelColor, uDieColor, uSheenA, uSheenB;
`;

/** Fresnel + hologram lattice, shared by body and lid. */
const rimBlock = (extra: string) => /* glsl */ `
#include <emissivemap_fragment>
{
  vec3 V = normalize( vViewPosition );
  float fres = pow( 1.0 - clamp( dot( normalize( normal ), V ), 0.0, 1.0 ), uRimPower );
  totalEmissiveRadiance += uRimColor * fres * uRim;

  if ( uHolo > 0.001 ) {
    // Pixel lattice: the chip is built out of fine voxels while it is still
    // a projection, and the lattice fades as it becomes solid.
    vec3 p = vHoloPos * uHoloScale;
    vec3 gcell = abs( fract( p ) - 0.5 );
    float lattice = 1.0 - smoothstep( 0.30, 0.46, min( min( gcell.x, gcell.y ), gcell.z ) );
    float scan = 0.5 + 0.5 * sin( vHoloPos.y * 42.0 - uTime * 6.0 );
    totalEmissiveRadiance += uHoloColor * uHolo * ( lattice * 1.5 + fres * 1.2 + scan * uScan * 0.35 );
  }
  ${extra}
}
`;

const injectRim = (
  mat: THREE.MeshPhysicalMaterial,
  uniforms: Record<string, { value: unknown }>,
  pars: string,
  extra: string,
  cacheKey: string,
) => {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHoloPos;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvHoloPos = position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vHoloPos;\n" + RIM_PARS + pars,
      )
      .replace("#include <emissivemap_fragment>", rimBlock(extra));
  };
  mat.customProgramCacheKey = () => cacheKey;
};

export const makeChipBodyMaterial = (opts: {
  color: number;
  rimColor: number;
  holoColor: number;
  transmission: number;
  roughness: number;
  metalness: number;
  iridescence: number;
}) => {
  const mat = new THREE.MeshPhysicalMaterial({
    color: opts.color,
    roughness: opts.roughness,
    metalness: opts.metalness,
    transmission: opts.transmission,
    thickness: 1.2,
    ior: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    iridescence: opts.iridescence,
    iridescenceIOR: 1.8,
    iridescenceThicknessRange: [120, 520],
    transparent: opts.transmission > 0,
  });
  const uniforms: ChipUniforms = {
    uTime: { value: 0 },
    uRim: { value: 0.6 },
    uRimColor: { value: new THREE.Color(opts.rimColor) },
    uRimPower: { value: 2.6 },
    uHolo: { value: 0 },
    uHoloColor: { value: new THREE.Color(opts.holoColor) },
    uHoloScale: { value: 26 },
    uScan: { value: 1 },
  };
  mat.userData.uniforms = uniforms;
  injectRim(mat, uniforms as unknown as Record<string, { value: unknown }>, "", "", "chip-body-v1");
  return mat as THREE.MeshPhysicalMaterial & { userData: { uniforms: ChipUniforms } };
};

export const makeChipLidMaterial = (opts: {
  map: THREE.Texture;
  color: number;
  rimColor: number;
  holoColor: number;
  labelColor: number;
  dieColor: number;
  sheenA: number;
  sheenB: number;
  roughness: number;
  metalness: number;
  iridescence: number;
}) => {
  const mat = new THREE.MeshPhysicalMaterial({
    color: opts.color,
    roughness: opts.roughness,
    metalness: opts.metalness,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    iridescence: opts.iridescence,
    iridescenceIOR: 1.9,
    iridescenceThicknessRange: [180, 680],
  });

  const uniforms: LidUniforms = {
    uTime: { value: 0 },
    uRim: { value: 0.5 },
    uRimColor: { value: new THREE.Color(opts.rimColor) },
    uRimPower: { value: 3.0 },
    uHolo: { value: 0 },
    uHoloColor: { value: new THREE.Color(opts.holoColor) },
    uHoloScale: { value: 26 },
    uScan: { value: 1 },
    uLid: { value: opts.map },
    uLabel: { value: 0 },
    uLabelColor: { value: new THREE.Color(opts.labelColor) },
    uDie: { value: 0.25 },
    uDieColor: { value: new THREE.Color(opts.dieColor) },
    uCircuit: { value: 0.4 },
    uSheen: { value: 0 },
    uSheenA: { value: new THREE.Color(opts.sheenA) },
    uSheenB: { value: new THREE.Color(opts.sheenB) },
  };
  mat.userData.uniforms = uniforms;

  const extra = /* glsl */ `
  vec4 lid = texture2D( uLid, vUv );
  float die     = lid.r;
  float label   = smoothstep( 0.35, 0.75, lid.g );
  float circuit = lid.b;

  // Frosted pixel-matrix grain across the lid.
  totalEmissiveRadiance += uDieColor * die * uDie;
  totalEmissiveRadiance += uDieColor * circuit * uCircuit;

  // Anodised / holographic sheen sweeping across the package face.
  if ( uSheen > 0.001 ) {
    float g = clamp( vUv.x * 0.65 + vUv.y * 0.35 + sin( uTime * 0.7 ) * 0.08, 0.0, 1.0 );
    vec3 sheen = mix( uSheenA, uSheenB, g );
    diffuseColor.rgb = mix( diffuseColor.rgb, sheen, uSheen );
    totalEmissiveRadiance += sheen * uSheen * 0.22;
  }

  // The marking sits proud of everything else.
  diffuseColor.rgb = mix( diffuseColor.rgb, uLabelColor, label * min( 1.0, uLabel ) );
  totalEmissiveRadiance += uLabelColor * label * uLabel;
  `;

  mat.defines = { ...(mat.defines ?? {}), USE_UV: "" };
  injectRim(
    mat,
    uniforms as unknown as Record<string, { value: unknown }>,
    LID_PARS,
    extra,
    "chip-lid-v1",
  );
  return mat as THREE.MeshPhysicalMaterial & { userData: { uniforms: LidUniforms } };
};
