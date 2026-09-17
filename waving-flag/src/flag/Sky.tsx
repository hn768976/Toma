import React, {useMemo} from 'react';
import {Color, DoubleSide, IUniform, ShaderMaterial} from 'three';
import {PERIODIC_NOISE_GLSL} from './glsl/noise.glsl';

/**
 * Procedural sky — no photographic plates. A vertical gradient from deeper
 * blue at the top to pale near the horizon, with a few soft, thin clouds.
 *
 * The clouds loop exactly: the noise is periodic, and over the 300 frames the
 * cloud field drifts by exactly one period in x (the apparent drift) and one
 * in z (the slow change of shape), so frame 300 matches frame 0.
 */
export const Sky: React.FC<{
  readonly t: number;
  readonly width: number;
  readonly height: number;
  readonly distance: number;
}> = ({t, width, height, distance}) => {
  const {material, uniforms} = useMemo(() => {
    const uni: Record<string, IUniform> = {
      uTime: {value: 0},
      uTop: {value: new Color('#0c4791')},
      uHorizon: {value: new Color('#dcebf6')},
    };
    const mat = new ShaderMaterial({
      uniforms: uni,
      depthWrite: false,
      side: DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${PERIODIC_NOISE_GLSL}
        uniform float uTime;
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        varying vec2 vUv;

        void main() {
          float h = clamp(vUv.y, 0.0, 1.0);
          // A steeper ramp keeps the horizon pale while the zenith goes deep,
          // so there is real separation between the two rather than a wash.
          vec3 sky = mix(uHorizon, uTop, pow(h, 0.62));

          // One period of drift over the loop, in both x and the shape axis.
          // Sampled far more finely across y than x, which draws the field out
          // into long horizontal streaks instead of round blobs.
          vec3 period = vec3(9.0, 9.0, 9.0);
          vec3 p = vec3(vUv.x * 1.7 + uTime * 9.0, vUv.y * 12.0, uTime * 9.0);
          float f = wf_pfbm(p, period, 6);

          // A narrow threshold band keeps only the crests, so the clouds come
          // out thin and wispy with visible internal structure rather than as
          // soft blobs.
          float c = smoothstep(0.15, 0.27, f);

          // A second, finer pass breaks the streaks up along their length.
          float f2 = wf_pfbm(p * 2.3 + vec3(11.0, 3.0, 5.0), period * 2.3, 4);
          c *= 0.55 + 0.45 * smoothstep(-0.10, 0.22, f2);

          c *= smoothstep(0.10, 0.58, h);          // keep the horizon clear
          c *= 0.72;

          vec3 cloud = mix(vec3(0.96, 0.97, 0.99), vec3(1.0), h);
          vec3 col = mix(sky, cloud, c);

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    return {material: mat, uniforms: uni};
  }, []);

  uniforms.uTime.value = t;

  return (
    <mesh material={material} position={[0, 0, -distance]} frustumCulled={false}>
      <planeGeometry args={[width, height, 1, 1]} />
    </mesh>
  );
};
