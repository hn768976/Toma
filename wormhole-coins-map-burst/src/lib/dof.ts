// Depth of field for scenes built on a ground plane (y = 0).
// Additive, depth-less particles have no usable depth buffer, so the circle of
// confusion is computed analytically: each pixel's view ray is intersected
// with the plane and the hit distance drives a 64-tap golden-angle disc blur.
// Deterministic, single frame, no history.
import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

export const makePlaneDOF = () =>
  new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uInvViewProj: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uFocus: { value: 20 },
      uStrength: { value: 0.02 },
      uMaxR: { value: 0.012 },
      uAspect: { value: 16 / 9 },
      uPlaneY: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform mat4 uInvViewProj;
      uniform vec3 uCamPos;
      uniform float uFocus, uStrength, uMaxR, uAspect, uPlaneY;
      varying vec2 vUv;
      float cocAt(vec2 uv) {
        vec4 w = uInvViewProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
        vec3 dir = normalize(w.xyz / w.w - uCamPos);
        float dist = dir.y < -1e-4 ? (uPlaneY - uCamPos.y) / dir.y : 1e4;
        return clamp(abs(1.0 - uFocus / dist) * uStrength, 0.0, uMaxR);
      }
      void main() {
        float r = cocAt(vUv);
        vec3 acc = vec3(0.0);
        float wsum = 0.0;
        const int N = 64;
        for (int i = 0; i < N; i++) {
          float fi = float(i) + 0.5;
          float rr = sqrt(fi / float(N));
          float a = fi * 2.39996323;
          vec2 o = vec2(cos(a), sin(a)) * rr * r;
          vec3 s = texture2D(tDiffuse, vUv + vec2(o.x / uAspect, o.y)).rgb;
          float w = 1.0 + dot(s, vec3(0.3, 0.6, 0.1)) * 0.8; // slight bokeh highlight bias
          acc += s * w;
          wsum += w;
        }
        gl_FragColor = vec4(acc / wsum, 1.0);
      }
    `,
  });
