import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";

const TAPS = 12;

/**
 * Depth-of-field as a two-pass, variable-radius gaussian. The circle of
 * confusion is derived per pixel from the scene depth buffer, which gives the
 * smooth focus falloff of a tilted plane shot with a long lens.
 * Requires the read buffer to carry a DepthTexture.
 */
export class DofPass extends Pass {
  focus = 10;
  aperture = 3.5; // CoC pixels per world unit of defocus
  maxCoc = 40; // pixels
  private camera: THREE.PerspectiveCamera;
  private temp: THREE.WebGLRenderTarget;
  private material: THREE.ShaderMaterial;
  private quad: FullScreenQuad;

  constructor(camera: THREE.PerspectiveCamera, width: number, height: number) {
    super();
    this.camera = camera;
    this.temp = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        dir: { value: new THREE.Vector2(1, 0) },
        texel: { value: new THREE.Vector2(1 / width, 1 / height) },
        nearClip: { value: camera.near },
        farClip: { value: camera.far },
        focus: { value: this.focus },
        aperture: { value: this.aperture },
        maxCoc: { value: this.maxCoc },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        #include <packing>
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform vec2 dir;
        uniform vec2 texel;
        uniform float nearClip, farClip, focus, aperture, maxCoc;
        varying vec2 vUv;
        float coc(vec2 uv) {
          float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, nearClip, farClip);
          return clamp(abs(z - focus) * aperture, 0.0, maxCoc);
        }
        void main() {
          float r = coc(vUv);
          if (r < 0.5) { gl_FragColor = texture2D(tColor, vUv); return; }
          float sigma = max(r * 0.5, 0.001);
          vec4 sum = vec4(0.0);
          float wsum = 0.0;
          for (int i = -${TAPS}; i <= ${TAPS}; i++) {
            float o = float(i) / float(${TAPS}) * r;
            float w = exp(-0.5 * (o * o) / (sigma * sigma));
            sum += texture2D(tColor, vUv + dir * texel * o) * w;
            wsum += w;
          }
          gl_FragColor = sum / wsum;
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ) {
    const u = this.material.uniforms;
    u.focus.value = this.focus;
    u.aperture.value = this.aperture;
    u.maxCoc.value = this.maxCoc;
    u.nearClip.value = this.camera.near;
    u.farClip.value = this.camera.far;
    u.tDepth.value = readBuffer.depthTexture;

    u.tColor.value = readBuffer.texture;
    u.dir.value.set(1, 0);
    renderer.setRenderTarget(this.temp);
    this.quad.render(renderer);

    u.tColor.value = this.temp.texture;
    u.dir.value.set(0, 1);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  setSize(width: number, height: number) {
    this.temp.setSize(width, height);
    this.material.uniforms.texel.value.set(1 / width, 1 / height);
  }

  dispose() {
    this.temp.dispose();
    this.material.dispose();
    this.quad.dispose();
  }
}
