import React, {useMemo} from 'react';
import {
  DoubleSide,
  IUniform,
  MeshPhysicalMaterial,
  PlaneGeometry,
  Texture,
  Vector2,
} from 'three';
import {NOISE_GLSL} from './glsl/noise.glsl';
import {WAVE_GLSL} from './glsl/wave.glsl';
import {Framing, SEGMENTS, WAVE} from './constants';

type Props = {
  readonly texture: Texture;
  readonly envMap: Texture;
  /** width / height of this country's flag */
  readonly aspect: number;
  readonly worldHeight: number;
  readonly framing: Framing;
  /** loop phase, 0..1 */
  readonly t: number;
  readonly position?: [number, number, number];
  readonly rotation?: [number, number, number];
};

export const FlagMesh: React.FC<Props> = ({
  texture,
  envMap,
  aspect,
  worldHeight,
  framing,
  t,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) => {
  const params = WAVE[framing];
  const width = worldHeight * aspect;

  const geometry = useMemo(() => {
    const segW = SEGMENTS[framing];
    const segH = Math.max(32, Math.round(segW / aspect));
    // Positions come entirely from the shader; the geometry supplies the uv
    // grid and the subdivision density.
    return new PlaneGeometry(1, 1, segW, segH);
  }, [framing, aspect]);

  const {material, uniforms} = useMemo(() => {
    const uni: Record<string, IUniform> = {
      uTime: {value: 0},
      uFlagSize: {value: new Vector2(width, worldHeight)},
      uEnvPow: {value: params.envPow},
      uAmp1: {value: params.amp1},
      uK1: {value: params.k1},
      uN1: {value: params.n1},
      uAmp2: {value: params.amp2},
      uK2: {value: params.k2},
      uN2: {value: params.n2},
      uTheta: {value: params.theta},
      uAmp3: {value: params.amp3},
      uNoiseFreq: {value: new Vector2(...params.noiseFreq)},
      uNoiseRadius: {value: params.noiseRadius},
      uDrapeAmp: {value: params.drapeAmp},
      uDrapeSigma: {value: params.drapeSigma},
      uDrapeCycles: {value: params.drapeCycles},
      uSag: {value: params.sag},
      uAoStrength: {value: framing === 'closeup' ? 0.9 : 0.85},
      uWeaveFreq: {value: new Vector2(900 * aspect, 900)},
      uWeaveAmp: {value: 0.05},
    };

    const mat = new MeshPhysicalMaterial({
      map: texture,
      // Fabric, not plastic: rough, no sharp specular hotspot, and a sheen
      // lobe that brightens at grazing angles.
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.45,
      sheenRoughness: 0.9,
      specularIntensity: 0.22,
      side: DoubleSide,
      envMap,
      envMapIntensity: 0.32,
    });

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uni);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
${NOISE_GLSL}
${WAVE_GLSL}
varying vec2 vFlagUv;
varying float vCavity;
varying vec3 vTu;
varying vec3 vTv;
`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `vec3 wfPos; vec3 wfTu; vec3 wfTv; float wfCavity;
wf_wave(uv, wfPos, wfTu, wfTv, wfCavity);
// Normal straight from the closed-form tangents — no sampling, no texture.
vec3 objectNormal = normalize(cross(wfTu, wfTv));
vFlagUv = uv;
vCavity = wfCavity;
vTu = normalize(normalMatrix * wfTu);
vTv = normalize(normalMatrix * wfTv);
`,
        )
        .replace('#include <begin_vertex>', 'vec3 transformed = wfPos;');

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec2 vFlagUv;
varying float vCavity;
varying vec3 vTu;
varying vec3 vTv;
uniform float uAoStrength;
uniform vec2 uWeaveFreq;
uniform float uWeaveAmp;
const float WF_TAU2 = 6.283185307179586;
`,
        )
        // NEVER mirror the artwork. The reverse face is sampled with u flipped,
        // which is how a two-layer flag is actually made: the design reads
        // correctly from behind instead of showing a mirrored image. A mirrored
        // shahada would be a serious error, not a cosmetic one.
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
  vec2 wfUv = gl_FrontFacing ? vMapUv : vec2(1.0 - vMapUv.x, vMapUv.y);
  diffuseColor *= texture2D( map, wfUv );
#endif`,
        )
        // Fine weave, faded out where it would alias — barely visible at
        // 1080p, present at 4K.
        .replace(
          '#include <normal_fragment_begin>',
          `#include <normal_fragment_begin>
{
  vec2 wv = fwidth(vFlagUv) * uWeaveFreq;
  float wfFade = 1.0 - smoothstep(0.30, 0.95, max(wv.x, wv.y));
  if (wfFade > 0.001) {
    float wdu = cos(vFlagUv.x * uWeaveFreq.x * WF_TAU2) * uWeaveAmp * wfFade;
    float wdv = cos(vFlagUv.y * uWeaveFreq.y * WF_TAU2) * uWeaveAmp * wfFade;
    normal = normalize(normal + vTu * wdu + vTv * wdv);
  }
}`,
        )
        // Self-shading in the folds. Troughs are occluded by the neighbouring
        // crests; without this the cloth reads as a printed image on a curved
        // surface rather than as fabric.
        .replace(
          '#include <aomap_fragment>',
          `float wfAo = 1.0 - uAoStrength * vCavity;
reflectedLight.indirectDiffuse *= wfAo;
reflectedLight.directDiffuse *= mix(1.0, wfAo, 0.55);
reflectedLight.indirectSpecular *= wfAo;
reflectedLight.directSpecular *= mix(1.0, wfAo, 0.7);`,
        );
    };

    return {material: mat, uniforms: uni};
  }, [texture, envMap, width, worldHeight, params, aspect, framing]);

  // Pure function of the current frame — no clock, no delta accumulation.
  uniforms.uTime.value = t;

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
      frustumCulled={false}
    />
  );
};
