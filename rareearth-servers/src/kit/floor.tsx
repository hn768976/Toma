import React, { useMemo } from "react";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

// Soft planar reflection, layered additively just above a lit PBR floor.
// The mirror pass is rendered by three's Reflector inside the main pass;
// it is blurred with a fixed 24-tap disc, so it is fully deterministic.
const REFLECT_SHADER = {
  name: "SoftReflect",
  uniforms: {
    color: { value: new THREE.Color(1, 1, 1) },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    strength: { value: 0.3 },
    blur: { value: 0.01 },
    fadeDist: { value: 8 },
  },
  vertexShader: /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vUv;
varying float vDist;
void main() {
  vUv = textureMatrix * vec4(position, 1.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`,
  fragmentShader: /* glsl */ `
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform float strength;
uniform float blur;
uniform float fadeDist;
varying vec4 vUv;
varying float vDist;
void main() {
  vec2 uv = vUv.xy / vUv.w;
  vec3 acc = texture2D(tDiffuse, uv).rgb;
  float w = 1.0;
  for (int i = 0; i < 24; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / 24.0);
    float a = fi * 2.39996323;
    vec2 o = vec2(cos(a), sin(a) * 1.6) * r * blur;
    float ww = 1.0 - r * 0.6;
    acc += texture2D(tDiffuse, uv + o).rgb * ww;
    w += ww;
  }
  acc /= w;
  float fade = exp(-vDist / fadeDist);
  gl_FragColor = vec4(acc * color * strength * fade, 1.0);
}`,
};

export const SoftReflection: React.FC<{
  size: number;
  strength: number;
  blur: number;
  resolution: number;
  fadeDist?: number;
  y?: number;
}> = ({ size, strength, blur, resolution, fadeDist = 8, y = 0.0006 }) => {
  const refl = useMemo(() => {
    const r = new Reflector(new THREE.PlaneGeometry(size, size), {
      textureWidth: resolution,
      textureHeight: Math.round(resolution * 0.5625),
      clipBias: 0.001,
      shader: REFLECT_SHADER,
      multisample: 0,
    });
    const m = r.material as THREE.ShaderMaterial;
    m.transparent = true;
    m.blending = THREE.AdditiveBlending;
    m.depthWrite = false;
    r.rotation.x = -Math.PI / 2;
    r.renderOrder = 1;
    return r;
  }, [size, resolution]);
  const m = refl.material as THREE.ShaderMaterial;
  m.uniforms.strength.value = strength;
  m.uniforms.blur.value = blur;
  m.uniforms.fadeDist.value = fadeDist;
  return <primitive object={refl} position={[0, y, 0]} />;
};
