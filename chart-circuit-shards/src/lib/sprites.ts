import * as THREE from 'three';

/**
 * Camera-facing soft light sprites (instanced). Positions / intensities are
 * written by the look every frame from the frame number alone. Sizes are in
 * world units with a minimum on-screen size whose energy is conserved, so a
 * far light gets dimmer rather than vanishing or aliasing.
 */
export class SpriteField {
  geo: THREE.InstancedBufferGeometry;
  pos: Float32Array;
  param: Float32Array; // size, intensity, tone, unused
  mat: THREE.ShaderMaterial;
  count: number;
  constructor(count: number, colA: THREE.Vector3, colB: THREE.Vector3, opts: { fogNear: number; fogFar: number; minPx: number; sharp?: number }) {
    this.count = count;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('corner', new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(count * 3);
    this.param = new Float32Array(count * 4);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iParam', new THREE.InstancedBufferAttribute(this.param, 4).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = count;
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uColA: { value: colA },
        uColB: { value: colB },
        uViewH: { value: 720 },
        uMinPx: { value: opts.minPx },
        uFogNear: { value: opts.fogNear },
        uFogFar: { value: opts.fogFar },
        uSharp: { value: opts.sharp ?? 5.0 },
      },
      vertexShader: /* glsl */ `
        in vec2 corner;
        in vec3 iPos;
        in vec4 iParam;
        uniform float uViewH, uMinPx, uFogNear, uFogFar;
        out vec2 vC;
        out float vI;
        out float vTone;
        void main() {
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          float z = max(-mv.z, 1e-3);
          float pxPerUnit = projectionMatrix[1][1] * uViewH * 0.5 / z;
          float size = max(iParam.x, 1e-5);
          float s = max(size * pxPerUnit, uMinPx) / pxPerUnit;
          vI = iParam.y * (size * size) / (s * s) * (1.0 - smoothstep(uFogNear, uFogFar, z));
          vTone = iParam.z;
          vC = corner;
          mv.xy += corner * s;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uColA, uColB;
        uniform float uSharp;
        in vec2 vC;
        in float vI;
        in float vTone;
        out vec4 outColor;
        void main() {
          float r2 = dot(vC, vC);
          if (r2 > 1.0) discard;
          float a = exp(-r2 * uSharp) * (1.0 - r2);
          outColor = vec4(mix(uColA, uColB, vTone) * vI * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
  }
  set(i: number, x: number, y: number, z: number, size: number, intensity: number, tone: number) {
    const p = i * 3;
    this.pos[p] = x;
    this.pos[p + 1] = y;
    this.pos[p + 2] = z;
    const q = i * 4;
    this.param[q] = size;
    this.param[q + 1] = intensity;
    this.param[q + 2] = tone;
  }
  commit(viewH: number) {
    (this.geo.getAttribute('iPos') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('iParam') as THREE.InstancedBufferAttribute).needsUpdate = true;
    this.mat.uniforms.uViewH.value = viewH;
  }
  mesh() {
    const m = new THREE.Mesh(this.geo, this.mat);
    m.frustumCulled = false;
    m.renderOrder = 10;
    return m;
  }
}

/** Shader for the flat trace ribbons + pads built by buildTraceGeometry. */
export const makeTraceMaterial = (opts: {
  colA: THREE.Vector3;
  colB: THREE.Vector3;
  gain: number;
  fogNear: number;
  fogFar: number;
  /** optional radial falloff around a centre (CPU look) */
  center?: THREE.Vector2;
  centerFalloff?: number;
  centerBoost?: number;
}) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uColA: { value: opts.colA },
      uColB: { value: opts.colB },
      uGain: { value: opts.gain },
      uFogNear: { value: opts.fogNear },
      uFogFar: { value: opts.fogFar },
      uCenter: { value: opts.center ?? new THREE.Vector2(0, 0) },
      uCenterFalloff: { value: opts.centerFalloff ?? 0 },
      uCenterBoost: { value: opts.centerBoost ?? 0 },
    },
    vertexShader: /* glsl */ `
      in vec2 aUv;
      in vec4 aInfo;
      out vec2 vUv;
      out vec4 vInfo;
      out float vDist;
      out vec2 vXZ;
      void main() {
        vUv = aUv;
        vInfo = aInfo;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vXZ = w.xz;
        vec4 mv = viewMatrix * w;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColA, uColB;
      uniform float uGain, uFogNear, uFogFar, uCenterFalloff, uCenterBoost;
      uniform vec2 uCenter;
      in vec2 vUv;
      in vec4 vInfo;
      in float vDist;
      in vec2 vXZ;
      out vec4 outColor;
      void main() {
        float kind = vInfo.x;
        float a;
        if (kind < 0.5) {
          float x = abs(vUv.x);
          float fw = fwidth(vUv.x);
          a = 1.0 - smoothstep(1.0 - fw, 1.0 + fw, x);
          a *= mix(1.0, 0.55, x * x);
        } else if (kind > 2.5) {
          // small square pad
          vec2 q = abs(vUv);
          vec2 fw2 = fwidth(vUv);
          a = (1.0 - smoothstep(0.8 - fw2.x, 0.8 + fw2.x, q.x)) * (1.0 - smoothstep(0.8 - fw2.y, 0.8 + fw2.y, q.y));
        } else {
          float r = length(vUv);
          float fw = fwidth(r);
          float inner = kind < 1.5 ? 0.52 : 0.42;
          a = smoothstep(inner - fw, inner + fw, r) * (1.0 - smoothstep(1.0 - fw, 1.0 + fw, r));
        }
        vec3 col = mix(uColA, uColB, vInfo.z) * vInfo.y * uGain;
        if (uCenterFalloff > 0.0) {
          float d = length(vXZ - uCenter);
          col *= 1.0 + uCenterBoost * exp(-d * d / (uCenterFalloff * uCenterFalloff));
        }
        col *= 1.0 - smoothstep(uFogNear, uFogFar, vDist);
        outColor = vec4(col * a, 1.0);
      }`,
    depthWrite: false,
    depthTest: true,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
