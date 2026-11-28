import * as THREE from "three";

/**
 * Final "lens + film" pass. It is the only thing React Three Fiber draws to
 * the screen: a full-screen triangle that reads the linear HDR image made by
 * the pipeline and applies, in this order,
 *   lens fringe (radial chromatic aberration + edge smear) -> flash ->
 *   vignette -> exposure -> tone mapping -> grade -> sRGB ->
 *   film grain (hash of pixel and frame) -> +-1/255 dither.
 * Everything is a pure function of the uniforms, so a frame always renders
 * the same way.
 */
export type ToneMap = "aces" | "agx" | "none";

export const makeOutputMaterial = () =>
  new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      tHdr: { value: null },
      tBloomCore: { value: null },
      tBloomHalo: { value: null },
      uBloomCore: { value: 0 },
      uBloomHalo: { value: 0 },
      uRes: { value: new THREE.Vector2(1920, 1080) },
      uFrame: { value: 0 },
      uExposure: { value: 1 },
      uToneMap: { value: 0 },
      uFringe: { value: 0 }, // radial colour fringe at the corner (fraction)
      uFringePow: { value: 1.5 },
      uFlash: { value: 0 },
      uVigStrength: { value: 0 },
      uVigInner: { value: 0.3 },
      uVigOuter: { value: 1.0 },
      uVigCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uVigAspect: { value: 1.0 },
      uContrast: { value: 1 },
      uSaturation: { value: 1 },
      uLift: { value: new THREE.Vector3(0, 0, 0) },
      uGain: { value: new THREE.Vector3(1, 1, 1) },
      uGamma: { value: 1 },
      uGrain: { value: 0 },
      uGrainCell: { value: 1 },
      uDither: { value: 1 },
      uHueShift: { value: 0 },
      uSharpen: { value: 0 },
      uSharpenPx: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tHdr, tBloomCore, tBloomHalo;
      uniform float uBloomCore, uBloomHalo;
      uniform vec2 uRes;
      uniform float uFrame, uExposure, uFringe, uFringePow, uFlash;
      uniform int uToneMap;
      uniform float uVigStrength, uVigInner, uVigOuter, uVigAspect;
      uniform vec2 uVigCenter;
      uniform float uContrast, uSaturation, uGamma, uGrain, uGrainCell, uDither;
      uniform float uHueShift, uSharpen, uSharpenPx;
      uniform vec3 uLift, uGain;

      float hash13(vec3 p3) {
        p3 = fract(p3 * 0.1031);
        p3 += dot(p3, p3.zyx + 31.32);
        return fract((p3.x + p3.y) * p3.z);
      }

      // --- ACES filmic (fit by Stephen Hill, as used by three.js) ---------
      vec3 RRTAndODTFit(vec3 v) {
        vec3 a = v * (v + 0.0245786) - 0.000090537;
        vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
        return a / b;
      }
      vec3 acesFilmic(vec3 color) {
        const mat3 ACESInputMat = mat3(
          vec3(0.59719, 0.07600, 0.02840),
          vec3(0.35458, 0.90834, 0.13383),
          vec3(0.04823, 0.01566, 0.83777));
        const mat3 ACESOutputMat = mat3(
          vec3( 1.60475, -0.10208, -0.00327),
          vec3(-0.53108,  1.10813, -0.07276),
          vec3(-0.07367, -0.00605,  1.07602));
        color *= 1.0 / 0.6;
        color = ACESInputMat * color;
        color = RRTAndODTFit(color);
        color = ACESOutputMat * color;
        return clamp(color, 0.0, 1.0);
      }
      // --- AgX (Troy Sobotka; three.js port) ------------------------------
      vec3 agxDefaultContrastApprox(vec3 x) {
        vec3 x2 = x * x;
        vec3 x4 = x2 * x2;
        return + 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4
               - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
      }
      vec3 agx(vec3 color) {
        const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
          vec3(1.6605, -0.1246, -0.0182),
          vec3(-0.5876, 1.1329, -0.1006),
          vec3(-0.0728, -0.0083, 1.1187));
        const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
          vec3(0.6274, 0.0691, 0.0164),
          vec3(0.3293, 0.9195, 0.0880),
          vec3(0.0433, 0.0113, 0.8956));
        const mat3 AgXInsetMatrix = mat3(
          vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
          vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
          vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
        const mat3 AgXOutsetMatrix = mat3(
          vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
          vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
          vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
        const float AgxMinEv = -12.47393;
        const float AgxMaxEv = 4.026069;
        color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
        color = AgXInsetMatrix * color;
        color = max(color, 1e-10);
        color = log2(color);
        color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);
        color = clamp(color, 0.0, 1.0);
        color = agxDefaultContrastApprox(color);
        color = AgXOutsetMatrix * color;
        color = pow(max(vec3(0.0), color), vec3(2.2));
        color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
        return clamp(color, 0.0, 1.0);
      }
      vec3 toSRGB(vec3 c) {
        return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055,
                   step(0.0031308, c));
      }
      vec3 hueRotate(vec3 c, float a) {
        const vec3 k = vec3(0.57735);
        float ca = cos(a), sa = sin(a);
        return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
      }

      // spectral weights for the fringe taps: t=0 red ... t=1 blue
      vec3 spectrum(float t) {
        return max(vec3(0.0), vec3(1.0 - 2.0 * t,
                                   1.0 - abs(2.0 * t - 1.0),
                                   2.0 * t - 1.0)) + 0.02;
      }

      void main() {
        vec2 uv = vUv;
        vec2 d = uv - 0.5;
        float aspect = uRes.x / uRes.y;
        float r2 = dot(d * vec2(aspect, 1.0), d * vec2(aspect, 1.0))
                 / (0.25 * (aspect * aspect + 1.0));   // 1.0 in the corner

        // ---- lens fringe: radial spectral smear, zero in the centre -------
        vec3 col;
        if (uFringe > 0.0) {
          float amt = uFringe * pow(r2, uFringePow);
          vec3 acc = vec3(0.0);
          vec3 wsum = vec3(0.0);
          for (int i = 0; i < 9; i++) {
            float t = (float(i) + 0.5) / 9.0;
            float s = 1.0 + amt * (t - 0.5) * 2.0;
            vec3 w = spectrum(t);
            acc += texture2D(tHdr, 0.5 + d * s).rgb * w;
            wsum += w;
          }
          col = acc / wsum;
        } else {
          col = texture2D(tHdr, uv).rgb;
        }
        col = max(col, 0.0);

        // ---- unsharp mask (linear light, clamped so highlights do not ring) --
        if (uSharpen > 0.0) {
          vec2 px = uSharpenPx / uRes;
          vec3 c0 = texture2D(tHdr, uv).rgb;
          vec3 nb = texture2D(tHdr, uv + vec2(px.x, 0.0)).rgb
                  + texture2D(tHdr, uv - vec2(px.x, 0.0)).rgb
                  + texture2D(tHdr, uv + vec2(0.0, px.y)).rgb
                  + texture2D(tHdr, uv - vec2(0.0, px.y)).rgb;
          col = max(col + uSharpen * clamp(c0 - 0.25 * nb, -0.6, 0.6), 0.0);
        }

        // ---- bloom: tight core + wide halo ----------------------------------
        col += texture2D(tBloomCore, uv).rgb * uBloomCore
             + texture2D(tBloomHalo, uv).rgb * uBloomHalo;

        // ---- flash (linear light) -----------------------------------------
        col += uFlash;

        // ---- vignette (linear light) --------------------------------------
        vec2 vd = (uv - uVigCenter) * vec2(aspect * uVigAspect, 1.0);
        float vr = length(vd) / (0.5 * sqrt(aspect * aspect + 1.0));
        float vig = 1.0 - smoothstep(uVigInner, uVigOuter, vr);
        col *= mix(1.0, vig, uVigStrength);

        // ---- exposure + tone mapping --------------------------------------
        col *= uExposure;
        if (uToneMap == 0) col = acesFilmic(col);
        else if (uToneMap == 1) col = agx(col);
        else col = clamp(col, 0.0, 1.0);

        // ---- grade (display linear) ---------------------------------------
        if (uHueShift != 0.0) col = max(hueRotate(col, uHueShift), 0.0);
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, uSaturation);
        col = col * uGain + uLift * (1.0 - col);
        col = clamp(col, 0.0, 1.0);
        col = toSRGB(col);
        col = pow(col, vec3(uGamma));
        col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);

        // ---- film grain: hash of (pixel cell, frame), gone in pure black ---
        vec2 cell = floor(gl_FragCoord.xy / uGrainCell);
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        if (uGrain > 0.0) {
          float g = hash13(vec3(cell, uFrame * 1.618 + 3.0))
                  + hash13(vec3(cell + 71.3, uFrame * 2.414 + 11.0)) - 1.0;
          float amt = uGrain * smoothstep(0.0, 0.06, lum) * (1.0 - 0.55 * lum);
          col += g * amt;
        }

        // ---- +-1/255 triangular dither, never on pure black or white -------
        if (uDither > 0.0) {
          vec3 n = vec3(
            hash13(vec3(gl_FragCoord.xy, uFrame + 0.37)) + hash13(vec3(gl_FragCoord.yx + 13.7, uFrame + 5.11)),
            hash13(vec3(gl_FragCoord.xy + 3.1, uFrame + 1.93)) + hash13(vec3(gl_FragCoord.yx + 47.9, uFrame + 7.77)),
            hash13(vec3(gl_FragCoord.xy + 9.7, uFrame + 2.71)) + hash13(vec3(gl_FragCoord.yx + 91.3, uFrame + 9.19))
          ) - 1.0;
          vec3 inside = step(0.5 / 255.0, col) * step(col, vec3(1.0 - 0.5 / 255.0));
          col += n * (uDither / 255.0) * inside;
        }
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `,
  });

/** One big triangle covering the screen (no diagonal seam). */
export const makeFullscreenTriangle = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
      3,
    ),
  );
  g.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2),
  );
  return g;
};
