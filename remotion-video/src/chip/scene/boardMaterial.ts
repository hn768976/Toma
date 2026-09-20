import * as THREE from "three";

/**
 * The PCB surface material.
 *
 * Rather than draw the glowing traces as a 2D overlay (which would break
 * perspective the moment the camera tilts), the copper artwork baked by Pixi is
 * sampled in the fragment shader of a real PBR material. The traces are
 * therefore lit, occluded and foreshortened like the surface they sit on.
 *
 * The energy wave is expressed as a moving threshold over the baked "distance
 * from chip" channel, so a trace lights up when the wavefront reaches *that
 * point along the run* rather than when it reaches a straight-line radius.
 */
export type BoardUniforms = {
  uMap: { value: THREE.Texture | null };
  uTime: { value: number };
  uWave: { value: number };
  uWaveWidth: { value: number };
  uEnergy: { value: number };
  uTraceDark: { value: THREE.Color };
  uTraceHot: { value: THREE.Color };
  uTraceEdge: { value: THREE.Color };
  uPacketDensity: { value: number };
  uPacketSpeed: { value: number };
  uPacketAmount: { value: number };
  uUvRepeat: { value: number };
  uWorldDist: { value: number };
  uWorldNorm: { value: number };
  uRipple: { value: number };
  uRippleRadius: { value: number };
  uRippleWidth: { value: number };
  uDotScale: { value: number };
  uGlowGain: { value: number };
  /** Baseline trace glow before the board is energised. */
  uIdle: { value: number };
  uFadeRadius: { value: number };
};

export type BoardMaterial = THREE.MeshStandardMaterial & {
  userData: { uniforms: BoardUniforms };
};

const PARS = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime, uWave, uWaveWidth, uEnergy;
uniform vec3 uTraceDark, uTraceHot, uTraceEdge;
uniform float uPacketDensity, uPacketSpeed, uPacketAmount;
uniform float uUvRepeat, uWorldDist, uWorldNorm;
uniform float uRipple, uRippleRadius, uRippleWidth, uDotScale;
uniform float uGlowGain, uFadeRadius, uIdle;
varying vec3 vBoardWorld;
`;

const VERT_HOOK = /* glsl */ `
#include <worldpos_vertex>
vBoardWorld = (modelMatrix * vec4( transformed, 1.0 )).xyz;
`;

export const makeBoardMaterial = (opts: {
  map: THREE.Texture;
  color: number;
  roughness: number;
  metalness: number;
  traceDark: number;
  traceHot: number;
  traceEdge: number;
  uvRepeat: number;
  /** 1 = derive wave distance from world radius (tiling field layer). */
  worldDist: number;
  worldNorm: number;
  /** Fades the layer out past this world radius; 0 disables. */
  fadeRadius?: number;
}): BoardMaterial => {
  const mat = new THREE.MeshStandardMaterial({
    color: opts.color,
    roughness: opts.roughness,
    metalness: opts.metalness,
  }) as BoardMaterial;

  // Force the UV varying: we sample a map by hand rather than assigning
  // material.map, so three would otherwise compile the varying away.
  mat.defines = { ...(mat.defines ?? {}), USE_UV: "" };

  const uniforms: BoardUniforms = {
    uMap: { value: opts.map },
    uTime: { value: 0 },
    uWave: { value: -1 },
    uWaveWidth: { value: 0.16 },
    uEnergy: { value: 0 },
    uTraceDark: { value: new THREE.Color(opts.traceDark) },
    uTraceHot: { value: new THREE.Color(opts.traceHot) },
    uTraceEdge: { value: new THREE.Color(opts.traceEdge) },
    uPacketDensity: { value: 18 },
    uPacketSpeed: { value: 0.55 },
    uPacketAmount: { value: 1 },
    uUvRepeat: { value: opts.uvRepeat },
    uWorldDist: { value: opts.worldDist },
    uWorldNorm: { value: opts.worldNorm },
    uRipple: { value: 0 },
    uRippleRadius: { value: 0 },
    uRippleWidth: { value: 0.12 },
    uDotScale: { value: 150 },
    uGlowGain: { value: 1 },
    uIdle: { value: 0.05 },
    uFadeRadius: { value: opts.fadeRadius ?? 0 },
  };
  mat.userData.uniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBoardWorld;")
      .replace("#include <worldpos_vertex>", VERT_HOOK);

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + PARS)
      .replace(
        "#include <map_fragment>",
        /* glsl */ `
#include <map_fragment>
vec2 bUv = vUv * uUvRepeat;
vec4 bm = texture2D( uMap, bUv );
float copper  = bm.r;
float pathD   = bm.g;
float phase   = bm.b;

float traceMask = smoothstep( 0.14, 0.50, copper );
float padMask   = smoothstep( 0.74, 0.96, copper );

// Unpowered copper reads as a darker, slightly different solder-mask tint.
diffuseColor.rgb = mix( diffuseColor.rgb, uTraceDark, traceMask * 0.9 );
`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.55, traceMask );
`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `
#include <emissivemap_fragment>
{
  float radial = length( vBoardWorld.xz ) / max( uWorldNorm, 0.0001 );
  float d = mix( pathD, radial, uWorldDist );

  // Everything behind the wavefront stays lit; the front itself is hotter.
  float lit  = 1.0 - smoothstep( uWave - uWaveWidth, uWave, d );
  float edge = exp( -pow( ( d - uWave ) / max( uWaveWidth, 1e-4 ), 2.0 ) * 3.5 );

  // Data packets: short dashes travelling outward along each run.
  float flow   = fract( d * uPacketDensity - uTime * uPacketSpeed + phase * 7.13 );
  float packet = pow( smoothstep( 0.62, 1.0, flow ), 4.0 ) * uPacketAmount;

  // A dim standby glow keeps the board legible before the pulse arrives.
  vec3 glow = uTraceHot * uIdle;
  glow += uTraceHot * lit * ( 0.62 + packet * 2.4 );
  glow += uTraceEdge * edge * 2.4;
  glow *= traceMask;
  glow += uTraceHot * padMask * lit * ( 0.45 + packet * 0.9 );

  // Halftone ripple: a dot-matrix wave across the whole substrate, not only
  // along the copper. Drives V2's tactile "wave of tiny dots".
  if ( uRipple > 0.001 ) {
    vec2 cell = fract( vUv * uDotScale ) - 0.5;
    float dot = 1.0 - smoothstep( 0.14, 0.36, length( cell ) );
    float rd = length( vBoardWorld.xz ) / max( uWorldNorm, 0.0001 );
    float ring = exp( -pow( ( rd - uRippleRadius ) / max( uRippleWidth, 1e-4 ), 2.0 ) * 3.0 );
    glow += uTraceEdge * dot * ring * uRipple * 2.0;
  }

  glow *= max( uEnergy, uIdle > 0.0 ? 0.28 : 0.0 ) * uGlowGain;

  if ( uFadeRadius > 0.001 ) {
    glow *= 1.0 - smoothstep( uFadeRadius * 0.55, uFadeRadius, length( vBoardWorld.xz ) );
  }

  totalEmissiveRadiance += glow;
}
`,
      );
  };

  // Changing defines/compile hooks requires a program rebuild key.
  mat.customProgramCacheKey = () => "chip-board-v1";
  return mat;
};
