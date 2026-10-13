import * as THREE from "three";

const FRAG_PREFIX = "layout(location = 0) out highp vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor\n";

/** A GLSL 3 ShaderMaterial whose fragment shader may write gl_FragColor. */
export const shaderMat = (p: THREE.ShaderMaterialParameters & { fragmentShader: string }) =>
  new THREE.ShaderMaterial({
    ...p,
    glslVersion: THREE.GLSL3,
    fragmentShader: FRAG_PREFIX + p.fragmentShader,
  });
