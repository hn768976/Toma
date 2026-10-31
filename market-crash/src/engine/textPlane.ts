import * as THREE from "three";
import type { SharedUniforms } from "./batches";

/**
 * A flat, glowing, textured plane (used for the ticker boards). Depth of
 * field is approximated per fragment by biasing the mip level by the circle
 * of confusion; a second, heavily-biased lookup adds bloom. Blended
 * additively like everything else.
 */
export const createTextPlane = (opts: {
  texture: THREE.Texture;
  width: number;
  height: number;
  color: [number, number, number];
  alpha: number;
  glow: number;
  uniforms: SharedUniforms;
  /** time at which the board fades in */
  birth?: number;
}) => {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...opts.uniforms,
      uMap: { value: opts.texture },
      uColor: { value: new THREE.Vector3(...opts.color) },
      uAlpha: { value: opts.alpha },
      uGlow: { value: opts.glow },
      uBirth: { value: opts.birth ?? -10 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vDepth;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uRes;
      uniform float uFocus;
      uniform float uAperture;
      uniform float uFog;
      uniform float uMaxCoc;
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uAlpha;
      uniform float uGlow;
      uniform float uBirth;
      varying vec2 vUv;
      varying float vDepth;
      void main() {
        float k = uRes.y / 1080.0;
        float coc = min(uAperture * k * abs(1.0 - uFocus / max(vDepth, 0.001)), uMaxCoc * k);
        float bias = log2(max(coc, 1.0));
        float s = texture2D(uMap, vUv, bias).a;
        float glow = texture2D(uMap, vUv, bias + 3.5).a;
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x)
                   * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
        float born = smoothstep(uBirth, uBirth + 0.8, uTime);
        float a = (s + glow * uGlow) * uAlpha * edge * born * exp(-vDepth * uFog);
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(opts.width, opts.height),
    mat,
  );
  mesh.frustumCulled = false;
  return mesh;
};
