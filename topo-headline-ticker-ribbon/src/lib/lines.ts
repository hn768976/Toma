import * as THREE from "three";

/**
 * Glowing polyline drawn as a camera-independent ribbon in a given plane.
 * Vertices are rebuilt from scratch every frame from a function of the frame.
 * Fragment: anti-aliased core (fwidth) + soft gaussian glow.
 */
const vert = /* glsl */ `
in float aSide; in float aT; in vec3 aColor;
out float vSide; out float vT; out vec3 vColor; out float vDist;
void main(){
  vSide = aSide; vT = aT; vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const frag = /* glsl */ `
precision highp float;
uniform float uCore; uniform float uGlow; uniform float uGlowAmt; uniform float uAlpha;
uniform float uFadeNear; uniform float uFadeFar;
in float vSide; in float vT; in vec3 vColor; in float vDist;
out vec4 o;
void main(){
  float d = abs(vSide);                 // 0 at centre, 1 at strip edge
  float fw = max(fwidth(vSide), 1e-5);
  float coreHalf = uCore;               // fraction of strip half-width
  // keep the core at least ~0.6px wide, and fade intensity when thinner
  float cHalfPx = coreHalf / fw;
  float cov = 1.0 - smoothstep(max(cHalfPx, 0.6) - 0.5, max(cHalfPx, 0.6) + 0.5, d / fw);
  cov *= clamp(cHalfPx / 0.6, 0.0, 1.0);
  float glow = exp(-pow(d / uGlow, 2.0)) * uGlowAmt;
  float edge = smoothstep(0.0, 0.04, vT) * smoothstep(1.0, 0.96, vT);
  float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, vDist);
  vec3 c = vColor * (cov * 1.6 + glow) * edge * fade * uAlpha;
  o = vec4(c, 1.0);
}`;

const depthFrag = /* glsl */ `
precision highp float;
uniform float uCore;
in float vSide; in float vT; in vec3 vColor; in float vDist;
out vec4 o;
void main(){
  if (abs(vSide) > max(uCore, fwidth(vSide) * 0.7)) discard;
  o = vec4(0.0);
}`;

export class GlowLine {
  mesh: THREE.Mesh;
  /** depth-only copy of the core so depth of field sees the line */
  depthMesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  private pos: Float32Array;
  private col: Float32Array;
  constructor(
    private n: number,
    opts: { core: number; glow: number; glowAmt: number; fadeNear?: number; fadeFar?: number },
  ) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    this.col = new Float32Array(n * 2 * 3);
    const side = new Float32Array(n * 2);
    const t = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      side[i * 2] = -1;
      side[i * 2 + 1] = 1;
      t[i * 2] = t[i * 2 + 1] = i / (n - 1);
    }
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    const pa = new THREE.BufferAttribute(this.pos, 3);
    pa.setUsage(THREE.DynamicDrawUsage);
    const ca = new THREE.BufferAttribute(this.col, 3);
    ca.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", pa);
    g.setAttribute("aColor", ca);
    g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uCore: { value: opts.core },
        uGlow: { value: opts.glow },
        uGlowAmt: { value: opts.glowAmt },
        uAlpha: { value: 1 },
        uFadeNear: { value: opts.fadeNear ?? 1e5 },
        uFadeFar: { value: opts.fadeFar ?? 2e5 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    const dm = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vert,
      fragmentShader: depthFrag,
      uniforms: { uCore: this.material.uniforms.uCore },
      colorWrite: false,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    this.depthMesh = new THREE.Mesh(g, dm);
    this.depthMesh.frustumCulled = false;
    this.depthMesh.renderOrder = -0.5;
    this.mesh.add(this.depthMesh);
  }
  /**
   * points: n centre points; normals: n unit offset directions; halfWidth per point
   * colors: n rgb (linear)
   */
  set(points: Float32Array, normals: Float32Array, halfWidth: number, colors: Float32Array) {
    for (let i = 0; i < this.n; i++) {
      for (let s = 0; s < 2; s++) {
        const k = (i * 2 + s) * 3;
        const sg = s === 0 ? -1 : 1;
        this.pos[k] = points[i * 3] + normals[i * 3] * halfWidth * sg;
        this.pos[k + 1] = points[i * 3 + 1] + normals[i * 3 + 1] * halfWidth * sg;
        this.pos[k + 2] = points[i * 3 + 2] + normals[i * 3 + 2] * halfWidth * sg;
        this.col[k] = colors[i * 3];
        this.col[k + 1] = colors[i * 3 + 1];
        this.col[k + 2] = colors[i * 3 + 2];
      }
    }
    const g = this.mesh.geometry;
    g.getAttribute("position").needsUpdate = true;
    g.getAttribute("aColor").needsUpdate = true;
  }
}

/** 2D normals (in the xy plane) for a polyline given as xyz points. */
export function planeNormalsXY(points: Float32Array, n: number, out: Float32Array) {
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const dx = points[b * 3] - points[a * 3];
    const dy = points[b * 3 + 1] - points[a * 3 + 1];
    const l = Math.hypot(dx, dy) || 1;
    out[i * 3] = -dy / l;
    out[i * 3 + 1] = dx / l;
    out[i * 3 + 2] = 0;
  }
}
