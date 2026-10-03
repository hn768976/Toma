import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/** Depth-only override material: writes linear view-space depth (instancing aware). */
export const createLinearDepthMaterial = () =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying float vZ;
      void main() {
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        vec4 mv = modelViewMatrix * p;
        vZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vZ;
      void main() { gl_FragColor = vec4(vZ, 0.0, 0.0, 1.0); }
    `,
    side: THREE.DoubleSide,
  });

/**
 * Gather depth of field: 64 golden-angle taps; a tap contributes when its own
 * circle of confusion reaches the centre pixel (background taps are capped
 * by the centre's CoC so sharp objects don't smear onto blurred ones).
 * Purely spatial — no temporal accumulation.
 */
export const createDofPass = () =>
  new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uFocus: { value: 10 },
        uAperture: { value: 20 },
        uMaxR: { value: 14 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform vec2 uRes;
        uniform float uFocus;
        uniform float uAperture;
        uniform float uMaxR;
        varying vec2 vUv;
        float coc(float z) {
          return clamp(abs(z - uFocus) / max(z, 0.001) * uAperture, 0.0, uMaxR);
        }
        void main() {
          float cz = texture2D(tDepth, vUv).r;
          float cc = coc(cz);
          vec3 acc = texture2D(tDiffuse, vUv).rgb;
          float wsum = 1.0;
          const int N = 64;
          const float GA = 2.39996323;
          for (int i = 0; i < N; i++) {
            float fi = float(i);
            float r = sqrt((fi + 0.5) / float(N)) * uMaxR;
            float a = fi * GA;
            vec2 o = vec2(cos(a), sin(a)) * r / uRes;
            vec2 uv = vUv + o;
            float sz = texture2D(tDepth, uv).r;
            float sc = coc(sz);
            float reach = sz < cz ? sc : min(sc, cc);
            float w = smoothstep(r - 1.0, r + 1.0, reach);
            acc += texture2D(tDiffuse, uv).rgb * w;
            wsum += w;
          }
          gl_FragColor = vec4(acc / wsum, 1.0);
        }
      `,
    }),
    "tDiffuse",
  );
