import { AdditiveBlending, Color, ShaderMaterial } from "three";

/** Flat HDR emitter -- bright enough to cross the bloom threshold. */
export const makeEmissiveMaterial = (hex: string, intensity: number) =>
  new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(hex).convertSRGBToLinear() },
      uIntensity: { value: intensity },
    },
    // three injects the instanceMatrix attribute for a ShaderMaterial on an
    // InstancedMesh, but not the code that applies it -- without this every
    // instance collapses onto the origin.
    vertexShader: /* glsl */ `
      void main() {
        vec4 mvPosition = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      void main() { gl_FragColor = vec4(uColor * uIntensity, 1.0); }
    `,
  });

/**
 * Bokeh discs for 1A. Soft-edged with a brighter rim, which is what a real
 * defocused highlight looks like. They drift on closed Lissajous paths with
 * integer frequencies, so they return exactly to their start at frame 600.
 */
export const makeBokehMaterial = () =>
  new ShaderMaterial({
    uniforms: { uProgress: { value: 0 } },
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: true,
    vertexShader: /* glsl */ `
      attribute vec3 iOffset;
      attribute float iRadius;
      attribute vec3 iColor;
      attribute vec4 iLissa;
      attribute float iPhase;
      uniform float uProgress;
      varying vec2 vLocal;
      varying vec3 vColor;

      void main() {
        vLocal = position.xy * 2.0;
        vColor = iColor;
        float tau = 6.28318530718 * uProgress;
        vec3 world = iOffset + vec3(
          iLissa.x * sin(tau * iLissa.z + iPhase),
          iLissa.y * sin(tau * iLissa.w + iPhase * 1.7),
          0.0
        );
        vec4 mv = viewMatrix * vec4(world, 1.0);
        mv.xy += position.xy * iRadius * 2.0;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vLocal;
      varying vec3 vColor;
      void main() {
        float d = length(vLocal);
        if (d > 1.0) discard;
        float body = smoothstep(1.0, 0.1, d);
        float rim  = smoothstep(0.45, 0.92, d) * smoothstep(1.0, 0.72, d);
        gl_FragColor = vec4(vColor * (body * 0.55 + rim * 0.18), 1.0);
      }
    `,
  });
