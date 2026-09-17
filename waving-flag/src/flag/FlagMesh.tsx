import React, {useMemo} from 'react';
import {
  DoubleSide,
  IUniform,
  Color,
  MeshPhysicalMaterial,
  PlaneGeometry,
  Texture,
  Vector2,
} from 'three';
import {NOISE_GLSL} from './glsl/noise.glsl';
import {WAVE_GLSL} from './glsl/wave.glsl';
import {Framing, REFERENCE_ASPECT, SEGMENTS, WAVE} from './constants';

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
    // Keep fold wavelength constant in world units across every aspect ratio.
    const kScale = aspect / REFERENCE_ASPECT;
    const uni: Record<string, IUniform> = {
      uTime: {value: 0},
      uFlagSize: {value: new Vector2(width, worldHeight)},
      uEnvPow: {value: params.envPow},
      uAmp1: {value: params.amp1}, uK1: {value: params.k1 * kScale}, uN1: {value: params.n1},
      uAmp2: {value: params.amp2}, uK2: {value: params.k2 * kScale}, uN2: {value: params.n2},
      uTheta: {value: params.theta},
      uAmp3: {value: params.amp3}, uK3: {value: params.k3 * kScale}, uN3: {value: params.n3},
      uTheta3: {value: params.theta3},
      uAmpN: {value: params.ampN},
      uNoiseFreq: {value: new Vector2(params.noiseFreq[0] * kScale, params.noiseFreq[1])},
      uNoiseRadius: {value: params.noiseRadius},
      uAmpFlutter: {value: params.ampFlutter}, uKFlutter: {value: params.kFlutter * kScale},
      uNFlutter: {value: params.nFlutter}, uFlutterStart: {value: params.flutterStart},
      uAmpCurl: {value: params.ampCurl}, uKCurl: {value: params.kCurl},
      uNCurl: {value: params.nCurl}, uCurlStart: {value: params.curlStart},
      uSharpen: {value: params.sharpen},
      uGustDepth: {value: params.gustDepth},
      uDrapeAmp: {value: params.drapeAmp}, uDrapeSigma: {value: params.drapeSigma},
      uDrapeCycles: {value: params.drapeCycles},
      uEdgeAmp: {value: params.edgeAmp}, uKEdge: {value: params.kEdge * kScale},
      uNEdge: {value: params.nEdge},
      uPoleSag: {value: params.poleSag}, uPoleSagWidth: {value: params.poleSagWidth},
      uSag: {value: params.sag},
      // Fold self-shading. This is what separates fabric from a decal.
      uAoStrength: {value: 0.7},
      // Weave: ~620 threads across the flag. Low enough to resolve at 4K
      // without aliasing, high enough to read as cloth rather than corduroy.
      uWeaveFreq: {value: new Vector2(620 * aspect, 620)},
      uWeaveAmp: {value: 0.1},
    };

    const mat = new MeshPhysicalMaterial({
      map: texture,
      // Fabric, not plastic: rough, no sharp specular hotspot, and a sheen
      // lobe that brightens at grazing angles.
      roughness: 0.84,
      metalness: 0.0,
      // Sheen is the grazing-angle lobe that makes cloth catch light along the
      // crest of a fold without ever forming a hard specular hotspot.
      sheen: 0.5,
      sheenRoughness: 0.8,
      sheenColor: new Color('#fff3e2'),
      specularIntensity: 0.2,
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
  float wfFade = 1.0 - smoothstep(0.45, 1.20, max(wv.x, wv.y));
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
reflectedLight.directDiffuse *= mix(1.0, wfAo, 0.5);
reflectedLight.indirectSpecular *= wfAo;
reflectedLight.directSpecular *= mix(1.0, wfAo, 0.6);`,
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
