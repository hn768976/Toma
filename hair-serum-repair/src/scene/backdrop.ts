import * as THREE from "three";
import { Palette } from "./palette";
import { Timeline } from "./timeline";
import { NOISE } from "./glsl";

/**
 * Full-screen backdrop: soft, defocused strands sweeping in concentric arcs
 * (same curvature direction as the hero strand), drifting with the push-in.
 */
export const createBackdrop = (palette: Palette, aspect: number) => {
  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uDark: { value: new THREE.Color(palette.bgDark) },
      uLight: { value: new THREE.Color(palette.bgLight) },
      uAspect: { value: aspect },
      uZoom: { value: 1 },
      uTime: { value: 0 },
      uExposure: { value: 1 },
      uSaturation: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform vec3 uDark;
      uniform vec3 uLight;
      uniform float uAspect;
      uniform float uZoom;
      uniform float uTime;
      uniform float uExposure;
      uniform float uSaturation;
      varying vec2 vUv;

      // smooth 1D band profile
      float bands(float x) {
        float i = floor(x);
        float f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash13(vec3(i, 3.7, 1.1));
        float b = hash13(vec3(i + 1.0, 3.7, 1.1));
        return mix(a, b, f);
      }

      void main() {
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        // push-in: zoom around a point near the strand
        vec2 pivot = vec2(0.12, -0.05);
        p = (p - pivot) / uZoom + pivot;

        // concentric arcs around a centre far to the lower right
        vec2 c = vec2(2.25, -1.3);
        vec2 d = p - c;
        float rho = length(d);
        float ang = atan(d.y, d.x);
        rho += 0.05 * sin(ang * 5.0 + 1.3) + 0.025 * sin(ang * 11.0 - uTime * 0.05);
        rho += uTime * 0.0035; // slow parallax drift

        float b = 0.6 * bands(rho * 7.0) + 0.4 * bands(rho * 15.0 + 4.0);
        b = smoothstep(0.3, 0.72, b);
        // broad light pool, like the key light falling across the strands
        float pool = 1.0 - smoothstep(0.0, 1.5, length(p - vec2(-0.25, 0.2)));
        vec3 col = mix(uDark, uLight, b * (0.3 + 0.7 * pool));
        col *= 0.5 + 0.55 * pool;

        float grey = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(grey), col, uSaturation) * uExposure;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  return {
    mesh,
    update: (frame: number, tl: Timeline) => {
      material.uniforms.uTime.value = frame;
      material.uniforms.uZoom.value = tl.backgroundZoom;
      material.uniforms.uExposure.value = tl.exposure;
      material.uniforms.uSaturation.value = 0.35 + 0.65 * ((tl.exposure - 0.72) / 0.28);
    },
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
};
