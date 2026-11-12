import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/** Final grade: exposure, vignette, linear -> sRGB and a static 1/255 dither
 *  (prevents banding in the dark gradients after H.264 encoding). */
export const createGradePass = (opts: { exposure: number; vignette: number; vignetteColor?: THREE.Color }) =>
  new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uExposure: { value: opts.exposure },
      uVignette: { value: opts.vignette },
      uVigColor: { value: opts.vignetteColor ?? new THREE.Color(0, 0, 0) },
      uAspect: { value: 16 / 9 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uExposure;
      uniform float uVignette;
      uniform vec3 uVigColor;
      uniform float uAspect;
      varying vec2 vUv;
      vec3 toSRGB(vec3 c){
        c = max(c, 0.0);
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
      }
      float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
        vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
        float v = smoothstep(0.35, 1.25, length(q));
        c = mix(c, uVigColor, v * uVignette);
        vec3 s = toSRGB(c);
        s += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
      }
    `,
  });
