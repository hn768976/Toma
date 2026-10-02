import * as THREE from "three";

// Full-frame shader layer drawn in screen space (sky gradients, light
// columns, atmosphere). `vec3 backdrop(vec2 uv, vec2 p)` gets uv in 0..1 and
// p = aspect-corrected centred coords (y in -0.5..0.5). Camera-ray helpers
// are available for analytic effects.
export const makeBackdrop = (
  body: string,
  uniforms: Record<string, THREE.IUniform> = {},
  opts: { additive?: boolean; renderOrder?: number } = {},
) => {
  const m = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.99999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uRes;
      uniform mat4 uInvProj;
      uniform mat4 uCamWorld;
      in vec2 vUv;
      vec3 camRayDir(vec2 uv) {
        vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
        v /= v.w;
        return normalize((uCamWorld * vec4(normalize(v.xyz), 0.0)).xyz);
      }
      ${body}
      void main() {
        vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        gl_FragColor = vec4(backdrop(vUv, p), 1.0);
      }
    `,
    uniforms: {
      uRes: { value: new THREE.Vector2(1920, 1080) },
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      ...uniforms,
    },
    depthTest: false,
    depthWrite: false,
    transparent: !!opts.additive,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NoBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = opts.renderOrder ?? -1000;
  mesh.onBeforeRender = (renderer, _s, camera) => {
    const t = renderer.getRenderTarget();
    const v = t ? new THREE.Vector2(t.width, t.height) : renderer.getDrawingBufferSize(new THREE.Vector2());
    m.uniforms.uRes.value.copy(v);
    m.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    m.uniforms.uCamWorld.value.copy(camera.matrixWorld);
  };
  return mesh;
};
