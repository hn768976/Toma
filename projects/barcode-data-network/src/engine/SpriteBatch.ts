import * as THREE from "three";

/** Camera-facing soft sprites: glows, sparks and floating dust. */
export type Sprite = {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  size: number; // world diameter
  color: THREE.Color;
  a: number;
  sharp?: number; // gaussian falloff (higher = tighter core)
  tIn?: number;
  inDur?: number;
  tOut?: number;
  outDur?: number;
  twAmp?: number;
  twFreq?: number;
  twPhase?: number;
};

const vert = /* glsl */ `
  attribute vec3 aPos;
  attribute vec3 aVel;
  attribute vec2 aSizeSharp;
  attribute vec4 aColor;
  attribute vec4 aTime;
  attribute vec3 aTw;
  uniform float uTime;
  uniform float uPxScale;
  uniform float uMinPx;
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vSharp;
  void main(){
    vec3 p = aPos + aVel * uTime;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float ppu = uPxScale / max(-mv.z, 1e-3);
    float sPx = aSizeSharp.x * ppu;
    float s = max(aSizeSharp.x, uMinPx / ppu);
    float cover = min(1.0, sPx / uMinPx);
    cover *= cover;
    mv.xy += position.xy * s;
    float tin = clamp((uTime - aTime.x) / max(aTime.y, 1e-4), 0.0, 1.0);
    float tout = 1.0 - clamp((uTime - aTime.z) / max(aTime.w, 1e-4), 0.0, 1.0);
    float tw = 1.0 - aTw.x * (0.5 + 0.5 * sin(uTime * aTw.y + aTw.z));
    vColor = vec4(aColor.rgb, aColor.a * tin * tout * tw * cover);
    vUv = position.xy * 2.0;
    vSharp = aSizeSharp.y;
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vSharp;
  void main(){
    float r2 = dot(vUv, vUv);
    if (r2 > 1.0) discard;
    float f = exp(-r2 * vSharp) * (1.0 - r2);
    float a = vColor.a * f * uIntensity;
    if (a <= 0.0005) discard;
    gl_FragColor = vec4(vColor.rgb * a, a);
  }
`;

export class SpriteBatch {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  constructor(sprites: Sprite[], opts: { additive: boolean; renderOrder?: number; minPx?: number }) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    const n = sprites.length;
    const Pp = new Float32Array(n * 3);
    const Vv = new Float32Array(n * 3);
    const SS = new Float32Array(n * 2);
    const C = new Float32Array(n * 4);
    const T = new Float32Array(n * 4);
    const TW = new Float32Array(n * 3);
    sprites.forEach((s, i) => {
      Pp.set([s.x, s.y, s.z], i * 3);
      Vv.set([s.vx ?? 0, s.vy ?? 0, s.vz ?? 0], i * 3);
      SS.set([s.size, s.sharp ?? 4], i * 2);
      C.set([s.color.r, s.color.g, s.color.b, s.a], i * 4);
      T.set([s.tIn ?? -1, s.inDur ?? 0.001, s.tOut ?? 1e6, s.outDur ?? 0.001], i * 4);
      TW.set([s.twAmp ?? 0, s.twFreq ?? 0, s.twPhase ?? 0], i * 3);
    });
    geo.setAttribute("aPos", new THREE.InstancedBufferAttribute(Pp, 3));
    geo.setAttribute("aVel", new THREE.InstancedBufferAttribute(Vv, 3));
    geo.setAttribute("aSizeSharp", new THREE.InstancedBufferAttribute(SS, 2));
    geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(C, 4));
    geo.setAttribute("aTime", new THREE.InstancedBufferAttribute(T, 4));
    geo.setAttribute("aTw", new THREE.InstancedBufferAttribute(TW, 3));
    geo.instanceCount = n;
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 },
        uPxScale: { value: 1000 },
        uMinPx: { value: opts.minPx ?? 1.5 },
        uIntensity: { value: 1 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: opts.additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.renderOrder ?? 0;
  }
  update(time: number, pxScale: number) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uPxScale.value = pxScale;
  }
}
