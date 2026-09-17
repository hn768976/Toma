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
      uTop: {value: new Color('#17558f')},
      uHorizon: {value: new Color('#cfe2f0')},
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
          vec3 sky = mix(uHorizon, uTop, pow(h, 0.78));

          // One period of drift over the loop, in both x and the shape axis.
          // Sampled at a lower frequency across x than y, which stretches the
          // clouds into horizontal wisps rather than round blobs.
          vec3 period = vec3(9.0, 9.0, 9.0);
          vec3 p = vec3(vUv.x * 2.6 + uTime * 9.0, vUv.y * 7.0, uTime * 9.0);
          float f = wf_pfbm(p, period, 5);

          // Thin, soft, sparse: a high threshold keeps only the crests.
          float c = smoothstep(0.13, 0.34, f);
          c *= smoothstep(0.12, 0.62, h);          // keep the horizon clear
          c *= 0.62;

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
