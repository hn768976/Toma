import React, {useMemo} from 'react';
import {Color, DoubleSide, IUniform, ShaderMaterial} from 'three';

/**
 * Procedural sky — a static vertical gradient, deeper blue at the top and pale
 * toward the horizon. No photographic plates, and deliberately no clouds: the
 * flag is the only thing in frame that moves.
 *
 * Because nothing here depends on time, this costs a single gradient evaluation
 * per pixel. The earlier cloud field was six octaves of periodic noise plus a
 * second four-octave pass over the whole frame, and was the dominant per-frame
 * cost of the V1 render.
 */
export const Sky: React.FC<{
  readonly width: number;
  readonly height: number;
  readonly distance: number;
}> = ({width, height, distance}) => {
  const material = useMemo(() => {
    const uni: Record<string, IUniform> = {
      uTop: {value: new Color('#0b4fa2')},
      uHorizon: {value: new Color('#dce9f4')},
    };
    return new ShaderMaterial({
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
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        varying vec2 vUv;

        void main() {
          float h = clamp(vUv.y, 0.0, 1.0);
          // A steeper ramp keeps the horizon pale while the zenith goes deep,
          // so there is real separation between the two rather than a wash.
          vec3 col = mix(uHorizon, uTop, pow(h, 0.62));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
  }, []);

  return (
    <mesh material={material} position={[0, 0, -distance]} frustumCulled={false}>
      <planeGeometry args={[width, height, 1, 1]} />
    </mesh>
  );
};
