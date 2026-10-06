import * as THREE from "three";

// A textured plane whose opacity / brightness / slide are uniforms, so build-ins
// never need a canvas redraw. Texture alpha is straight (not premultiplied).
export const layerMaterial = (tex: THREE.Texture, opts: { additive?: boolean; depthWrite?: boolean } = {}) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: opts.depthWrite ?? false,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    uniforms: {
      map: { value: tex },
      opacity: { value: 1 },
      gain: { value: 1 },
      /** uv-space reveal: x < reveal is visible (soft edge) */
      reveal: { value: 2 },
      revealSoft: { value: 0.01 },
    },
    vertexShader: /* glsl */ `out vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `precision highp float; in vec2 vUv; out vec4 o;
      uniform sampler2D map; uniform float opacity, gain, reveal, revealSoft;
      void main(){
        vec4 c = texture(map, vUv);
        float a = c.a * opacity * (1.0 - smoothstep(reveal - revealSoft, reveal, vUv.x));
        if (a < 0.004) discard;
        o = vec4(c.rgb * gain, a);
      }`,
  });
