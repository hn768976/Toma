import * as THREE from "three";

/** Procedural full-screen backdrop: diagonal two-tone gradient + soft glow. */
export type BackgroundParams = {
  colA: THREE.Color; // top-left
  colB: THREE.Color; // bottom-right
  glowColor: THREE.Color;
  glowPos: [number, number]; // uv
  glowRadius: number;
  glowStrength: number;
};

export const createBackground = (p: BackgroundParams) => {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: p.colA },
      uB: { value: p.colB },
      uG: { value: p.glowColor },
      uGP: { value: new THREE.Vector2(...p.glowPos) },
      uGR: { value: p.glowRadius },
      uGS: { value: p.glowStrength },
      uAspect: { value: 16 / 9 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uG; uniform vec2 uGP;
      uniform float uGR; uniform float uGS; uniform float uAspect;
      varying vec2 vUv;
      void main(){
        float d = clamp(dot(vUv - vec2(0.0, 1.0), normalize(vec2(1.0, -0.6))) / 1.15, 0.0, 1.0);
        vec3 c = mix(uA, uB, smoothstep(0.0, 1.0, d));
        vec2 q = (vUv - uGP) * vec2(uAspect, 1.0);
        c += uG * uGS * exp(-dot(q, q) / (uGR * uGR));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return { mesh, material: mat };
};
