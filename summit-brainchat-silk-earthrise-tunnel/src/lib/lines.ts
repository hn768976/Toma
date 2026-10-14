// Screen-space anti-aliased line segments and soft point sprites.
// Widths/sizes are specified in pixels at 720p and scaled with the output
// height, so 720p previews and 4K renders look the same.
import * as THREE from "three";

export type ShadeOpts = {
  /** GLSL declarations (uniforms, functions) for the fragment shader. */
  decl?: string;
  /**
   * GLSL body computing `vec4 col` from `float s` (interpolated per-vertex
   * param), `vec4 P` (per-instance/point param), `vec3 base` (colour).
   */
  body?: string;
  uniforms?: Record<string, THREE.IUniform>;
};

export type LinesOpts = ShadeOpts & {
  color: THREE.ColorRepresentation;
  /** HDR multiplier for colour. */
  intensity?: number;
  opacity?: number;
  widthPx: number;
  pxScale: number;
  resolution: THREE.Vector2;
  depthTest?: boolean;
  blending?: THREE.Blending;
  /** Per-segment start/end scalar param (2 per segment). */
  sParams?: Float32Array;
  /** Per-segment vec4 param. */
  params?: Float32Array;
  /** Fade with view distance: [start, end] in world units. */
  fog?: [number, number];
};

/** segs: 6 floats per segment (x0,y0,z0,x1,y1,z1). */
export function makeScreenLines(segs: Float32Array, o: LinesOpts) {
  const n = segs.length / 6;
  const g = new THREE.InstancedBufferGeometry();
  // quad: x = along (0/1), y = side (-1/1)
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const a0 = new Float32Array(n * 3), a1 = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a0.set(segs.subarray(i * 6, i * 6 + 3), i * 3);
    a1.set(segs.subarray(i * 6 + 3, i * 6 + 6), i * 3);
  }
  g.setAttribute("aStart", new THREE.InstancedBufferAttribute(a0, 3));
  g.setAttribute("aEnd", new THREE.InstancedBufferAttribute(a1, 3));
  g.setAttribute("aS", new THREE.InstancedBufferAttribute(o.sParams ?? new Float32Array(n * 2), 2));
  g.setAttribute("aP", new THREE.InstancedBufferAttribute(o.params ?? new Float32Array(n * 4), 4));
  g.instanceCount = n;
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(o.color).multiplyScalar(o.intensity ?? 1) },
      uOpacity: { value: o.opacity ?? 1 },
      uHalfW: { value: (o.widthPx * o.pxScale) / 2 },
      uRes: { value: o.resolution },
      uFog: { value: new THREE.Vector2(...(o.fog ?? [1e9, 2e9])) },
      ...(o.uniforms ?? {}),
    },
    vertexShader: /* glsl */ `
      in vec3 aStart; in vec3 aEnd; in vec2 aS; in vec4 aP;
      uniform vec2 uRes; uniform float uHalfW;
      out float vSide; out float vS; out vec4 vP; out float vDepth;
      void main(){
        vec4 v0 = modelViewMatrix * vec4(aStart, 1.0);
        vec4 v1 = modelViewMatrix * vec4(aEnd, 1.0);
        vec4 c0 = projectionMatrix * v0;
        vec4 c1 = projectionMatrix * v1;
        vec2 s0 = c0.xy / c0.w * uRes * 0.5;
        vec2 s1 = c1.xy / c1.w * uRes * 0.5;
        vec2 dir = s1 - s0;
        float len = length(dir);
        dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
        vec2 nrm = vec2(-dir.y, dir.x);
        float hw = uHalfW + 1.0; // 1px AA skirt
        vec4 c = mix(c0, c1, position.x);
        // extend ends slightly so joints overlap
        c.xy += dir * (position.x * 2.0 - 1.0) * (uHalfW * 0.5) / (uRes * 0.5) * c.w;
        c.xy += nrm * position.y * hw / (uRes * 0.5) * c.w;
        gl_Position = c;
        vSide = position.y * hw;
        vS = mix(aS.x, aS.y, position.x);
        vP = aP;
        vDepth = -mix(v0.z, v1.z, position.x);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uHalfW; uniform vec2 uFog;
      in float vSide; in float vS; in vec4 vP; in float vDepth;
      ${o.decl ?? ""}
      void main(){
        float cov = clamp(uHalfW + 0.5 - abs(vSide), 0.0, 1.0);
        // thin lines (<1px) fade out instead of aliasing
        cov *= clamp(uHalfW * 2.0, 0.0, 1.0);
        float s = vS; vec4 P = vP; vec3 base = uColor;
        vec4 col = vec4(base, 1.0);
        ${o.body ?? ""}
        float fog = 1.0 - smoothstep(uFog.x, uFog.y, vDepth);
        gl_FragColor = vec4(col.rgb * col.a * cov * uOpacity * fog, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    blending: o.blending ?? THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

export type PointsOpts = ShadeOpts & {
  color: THREE.ColorRepresentation;
  intensity?: number;
  sizePx: number;
  pxScale: number;
  /** Per point size multiplier (1 per point). */
  sizes?: Float32Array;
  params?: Float32Array;
  depthTest?: boolean;
  /** Gaussian softness: 0 = hard disc, 1 = very soft. */
  softness?: number;
};

export function makeScreenPoints(positions: Float32Array, o: PointsOpts) {
  const n = positions.length / 3;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(o.sizes ?? new Float32Array(n).fill(1), 1));
  g.setAttribute("aP", new THREE.BufferAttribute(o.params ?? new Float32Array(n * 4), 4));
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(o.color).multiplyScalar(o.intensity ?? 1) },
      uSize: { value: o.sizePx * o.pxScale },
      uSoft: { value: o.softness ?? 0.5 },
      ...(o.uniforms ?? {}),
    },
    vertexShader: /* glsl */ `
      in float aSize; in vec4 aP;
      uniform float uSize;
      out vec4 vP; out float vPx;
      void main(){
        vP = aP;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // +2px so the soft edge is never clipped; sub-pixel points fade instead of popping
        float px = uSize * aSize;
        vPx = px;
        gl_PointSize = max(px, 1.0) + 2.0;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uSoft;
      in vec4 vP; in float vPx;
      ${o.decl ?? ""}
      void main(){
        float full = max(vPx, 1.0) + 2.0;
        float r = length(gl_PointCoord - 0.5) * full; // px from centre
        float rad = max(vPx, 1.0) * 0.5;
        float hard = clamp(rad + 0.5 - r, 0.0, 1.0);
        float soft = exp(-r * r / max(rad * rad * 0.5, 0.25));
        float a = mix(hard, soft, uSoft) * min(vPx, 1.0);
        vec4 P = vP; vec3 base = uColor; float s = 0.0;
        vec4 col = vec4(base, 1.0);
        ${o.body ?? ""}
        gl_FragColor = vec4(col.rgb * col.a * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

/** Full-screen background gradient drawn at the far plane. */
export function makeBackground(frag: string, uniforms: Record<string, THREE.IUniform>) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: frag,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
