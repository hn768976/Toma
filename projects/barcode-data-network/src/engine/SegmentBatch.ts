import * as THREE from "three";

/**
 * A segment is a flat, anti-aliased rectangle lying on the ground plane
 * (world XZ), defined by two end points and a width. Bars, ticks, lines,
 * chips and dots are all segments, drawn in one instanced draw call.
 * Animation (reveal, growth, fade-out, sliding, twinkle) runs on the GPU
 * from a single uTime uniform, so each frame is a pure function of time.
 */
export type Seg = {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  w: number; // width across the segment (world units)
  color: THREE.Color; // linear colour
  a: number; // alpha / intensity
  y?: number; // height above plane
  v0?: number; // x-velocity of end 0 (units / s)
  v1?: number; // x-velocity of end 1
  tIn?: number; // reveal start (s)
  inDur?: number; // reveal duration (s)
  tOut?: number; // fade-out start (s)
  outDur?: number;
  anchor?: number; // 0 grows from p0, 0.5 from centre, 1 from p1
  grow?: number; // 1 = length grows during reveal, 0 = fade only
  twAmp?: number;
  twFreq?: number;
  twPhase?: number;
};

const vert = /* glsl */ `
  attribute vec4 aP;      // x0 z0 x1 z1
  attribute vec2 aV;      // v0 v1
  attribute vec2 aWY;     // width, y
  attribute vec4 aColor;  // rgb, alpha
  attribute vec4 aTime;   // tIn, inDur, tOut, outDur
  attribute vec2 aAG;     // anchor, grow
  attribute vec3 aTw;     // amp, freq, phase
  uniform float uTime;
  uniform float uPxScale; // pixels per world unit at view depth 1
  uniform float uMinPx;
  varying vec2 vUv;
  varying vec2 vPx;
  varying vec4 vColor;

  float easeOut(float t){ return 1.0 - pow(1.0 - t, 3.0); }

  void main(){
    float tin = clamp((uTime - aTime.x) / max(aTime.y, 1e-4), 0.0, 1.0);
    float tout = 1.0 - clamp((uTime - aTime.z) / max(aTime.w, 1e-4), 0.0, 1.0);
    float g = mix(1.0, easeOut(tin), aAG.y);
    vec2 p0 = aP.xy + vec2(aV.x * uTime, 0.0);
    vec2 p1 = aP.zw + vec2(aV.y * uTime, 0.0);
    vec2 anc = mix(p0, p1, aAG.x);
    vec2 a = mix(anc, p0, g);
    vec2 b = mix(anc, p1, g);
    vec2 d = b - a;
    float len = length(d);
    vec2 dir = len > 1e-6 ? d / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    vec2 c = 0.5 * (a + b);
    vec4 vc = modelViewMatrix * vec4(c.x, aWY.y, c.y, 1.0);
    float ppu = uPxScale / max(-vc.z, 1e-3);
    float wPx = aWY.x * ppu;
    float lPx = len * ppu;
    float w = max(aWY.x, uMinPx / ppu);
    float l = max(len, uMinPx / ppu);
    float cover = min(1.0, wPx / uMinPx) * min(1.0, lPx / uMinPx);
    vec2 p = c + dir * position.x * l + nrm * position.y * w;
    vUv = position.xy * 2.0;
    vPx = vec2(l, w) * ppu;
    float tw = 1.0 - aTw.x * (0.5 + 0.5 * sin(uTime * aTw.y + aTw.z));
    float alpha = aColor.a * tin * tout * cover * tw;
    if (g * len < 1e-5) alpha = 0.0;
    vColor = vec4(aColor.rgb, alpha);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, aWY.y, p.y, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec2 vPx;
  varying vec4 vColor;
  void main(){
    // analytic edge coverage (one pixel soft edge) along both axes
    vec2 dpx = (1.0 - abs(vUv)) * 0.5 * vPx;
    float cov = clamp(dpx.x + 0.5, 0.0, 1.0) * clamp(dpx.y + 0.5, 0.0, 1.0);
    float a = vColor.a * cov * uIntensity;
    if (a <= 0.0005) discard;
    gl_FragColor = vec4(vColor.rgb * a, a);
  }
`;

export class SegmentBatch {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;

  constructor(
    segs: Seg[],
    opts: { additive: boolean; renderOrder?: number; minPx?: number },
  ) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    const n = segs.length;
    const P = new Float32Array(n * 4);
    const V = new Float32Array(n * 2);
    const WY = new Float32Array(n * 2);
    const C = new Float32Array(n * 4);
    const T = new Float32Array(n * 4);
    const AG = new Float32Array(n * 2);
    const TW = new Float32Array(n * 3);
    segs.forEach((s, i) => {
      P.set([s.x0, s.z0, s.x1, s.z1], i * 4);
      V.set([s.v0 ?? 0, s.v1 ?? s.v0 ?? 0], i * 2);
      WY.set([s.w, s.y ?? 0], i * 2);
      C.set([s.color.r, s.color.g, s.color.b, s.a], i * 4);
      T.set([s.tIn ?? -1, s.inDur ?? 0.001, s.tOut ?? 1e6, s.outDur ?? 0.001], i * 4);
      AG.set([s.anchor ?? 0.5, s.grow ?? 0], i * 2);
      TW.set([s.twAmp ?? 0, s.twFreq ?? 0, s.twPhase ?? 0], i * 3);
    });
    geo.setAttribute("aP", new THREE.InstancedBufferAttribute(P, 4));
    geo.setAttribute("aV", new THREE.InstancedBufferAttribute(V, 2));
    geo.setAttribute("aWY", new THREE.InstancedBufferAttribute(WY, 2));
    geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(C, 4));
    geo.setAttribute("aTime", new THREE.InstancedBufferAttribute(T, 4));
    geo.setAttribute("aAG", new THREE.InstancedBufferAttribute(AG, 2));
    geo.setAttribute("aTw", new THREE.InstancedBufferAttribute(TW, 3));
    geo.instanceCount = n;

    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 },
        uPxScale: { value: 1000 },
        uMinPx: { value: opts.minPx ?? 1.0 },
        uIntensity: { value: 1 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      // colours are premultiplied in the shader
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
