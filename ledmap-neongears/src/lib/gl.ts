import * as THREE from "three";

export const HEADER = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
`;

const FS_VERT = /* glsl */ `${HEADER}
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Shared hash helpers (integer PCG-style; identical on every run, no Math.random()).
export const HASH_GLSL = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash1(uvec3 v) {
  return float(pcg(v.x + pcg(v.y + pcg(v.z)))) / 4294967295.0;
}
float hash1(uvec2 v) {
  return float(pcg(v.x + pcg(v.y))) / 4294967295.0;
}
`;

export const fullscreenMaterial = (
  frag: string,
  uniforms: Record<string, THREE.IUniform>,
  blending: THREE.Blending = THREE.NoBlending,
) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader: `${HEADER}\n${frag}`,
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending,
    transparent: blending !== THREE.NoBlending,
  });

export class FullscreenPass {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mesh: THREE.Mesh;

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.mesh = new THREE.Mesh(g);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  render(
    gl: THREE.WebGLRenderer,
    material: THREE.Material,
    target: THREE.WebGLRenderTarget | null,
    clear = true,
  ) {
    this.mesh.material = material;
    gl.setRenderTarget(target);
    if (clear) gl.clear(true, true, false);
    gl.render(this.scene, this.camera);
  }
}

export const hdrTarget = (w: number, h: number, mip = false) =>
  new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: mip,
    depthBuffer: true,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
