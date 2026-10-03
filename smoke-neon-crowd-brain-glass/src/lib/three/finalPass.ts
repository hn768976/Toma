import * as THREE from "three";

/**
 * Final full-screen pass for every three.js look:
 *  exposure → ACES filmic tonemap → linear→sRGB → vignette →
 *  grain (fixed hash of pixel + frame) → ±1/255 triangular dither.
 * Runs AFTER bloom, so the dither is the very last thing before 8-bit output.
 * Uses integer hashing (WebGL2 uints) — no Math.random(), no time.
 */
export const createFinalMaterial = () =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      tDiffuse: { value: null },
      uFrame: { value: 0 },
      uExposure: { value: 1 },
      uGrain: { value: 0.02 },
      uVignette: { value: 0.0 },
      uAspect: { value: 16 / 9 },
    },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      precision highp int;
      uniform sampler2D tDiffuse;
      uniform float uFrame;
      uniform float uExposure;
      uniform float uGrain;
      uniform float uVignette;
      uniform float uAspect;
      in vec2 vUv;
      out vec4 outColor;

      // ACES fit (Stephen Hill), same as three.js ACESFilmicToneMapping.
      vec3 RRTAndODTFit(vec3 v) {
        vec3 a = v * (v + 0.0245786) - 0.000090537;
        vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
        return a / b;
      }
      vec3 aces(vec3 color) {
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
      vec3 toSRGB(vec3 c) {
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      // PCG-style integer hash → [0,1)
      uint pcg(uint v) {
        uint state = v * 747796405u + 2891336453u;
        uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
        return (word >> 22u) ^ word;
      }
      float h3(uvec3 p) {
        return float(pcg(p.x + pcg(p.y + pcg(p.z)))) / 4294967296.0;
      }
      void main() {
        vec3 c = texture(tDiffuse, vUv).rgb * uExposure;
        c = aces(max(c, 0.0));
        c = toSRGB(c);
        vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
        c *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(q));
        uvec3 p = uvec3(uvec2(gl_FragCoord.xy), uint(uFrame));
        // grain: zero-mean, triangular, ~uGrain amplitude, slightly stronger in mids
        float g = h3(p) + h3(p + uvec3(0u, 0u, 7919u)) - 1.0;
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c += g * uGrain * (0.35 + 0.65 * sqrt(clamp(lum, 0.0, 1.0)));
        // dither ±1/255 (triangular PDF)
        float d = h3(p + uvec3(13u, 29u, 104729u)) + h3(p + uvec3(71u, 3u, 1299709u)) - 1.0;
        c += d / 255.0;
        outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

/** Full-screen triangle helper for custom passes. */
export class FullScreenQuad {
  private mesh: THREE.Mesh;
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  constructor(material: THREE.Material) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
  }
  set material(m: THREE.Material) {
    this.mesh.material = m;
  }
  render(renderer: THREE.WebGLRenderer) {
    renderer.render(this.mesh, this.camera);
  }
  dispose() {
    this.mesh.geometry.dispose();
  }
}
