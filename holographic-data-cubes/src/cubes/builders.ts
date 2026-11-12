import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { Palette } from "./palette";

/**
 * Collects materials that belong to one logical element so the whole
 * element can be faded with a single call. Every material keeps its own
 * base opacity; `set(v)` multiplies it.
 */
export class Fader {
  private items: Array<(v: number) => void> = [];
  value = -1;
  add(mat: THREE.Material, base: number) {
    if (mat instanceof THREE.ShaderMaterial && mat.uniforms.uOpacity) {
      const u = mat.uniforms.uOpacity;
      this.items.push((v) => {
        u.value = base * v;
      });
    } else {
      this.items.push((v) => {
        mat.opacity = base * v;
      });
    }
    return mat;
  }
  /** Chain another fader (child follows this one, with its own factor). */
  link(child: Fader, factor = 1) {
    this.items.push((v) => child.set(v * factor));
  }
  set(v: number) {
    if (v === this.value) {
      return;
    }
    this.value = v;
    for (const f of this.items) {
      f(v);
    }
  }
}

const FOG_PARS = /* glsl */ `
uniform vec2 uFog;
float fogFactor(float viewDist) {
  return 1.0 - smoothstep(uFog.x, uFog.y, viewDist);
}`;

const FACE_VERT = /* glsl */ `
${FOG_PARS}
centroid out vec2 vUv;
out float vFog;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFog = fogFactor(-mv.z);
  gl_Position = projectionMatrix * mv;
}`;

// Translucent panel: faint fill that brightens towards its border, the
// "glass sheet" look of the reference cube faces.
const FACE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uEdge;
centroid in vec2 vUv;
in float vFog;
out vec4 outColor;
void main() {
  vec2 q = abs(vUv - 0.5) * 2.0;
  float e = min(max(q.x, q.y), 1.0);
  float a = uOpacity * (1.0 + uEdge * pow(e, 14.0));
  outColor = vec4(uColor * a * vFog, 1.0);
}`;

const BEAM_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
centroid in vec2 vUv;
in float vFog;
out vec4 outColor;
void main() {
  float x = abs(vUv.x - 0.5) * 2.0;
  float core = exp(-x * x * 40.0) * 0.45 + exp(-x * x * 5.0) * 0.4;
  float ends = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
  outColor = vec4(uColor * core * ends * uOpacity, 1.0);
}`;

const SPARK_VERT = /* glsl */ `
${FOG_PARS}
uniform float uPixelH;
uniform float uTime;
in float aSize;
in float aPhase;
out float vGain;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = max(-mv.z, 0.001);
  // Mild perspective only: distant sparkles stay readable, like lens glints.
  float persp = clamp(24.0 / d, 0.45, 2.2);
  gl_PointSize = max(aSize * uPixelH * persp, 1.0);
  float tw = 0.62 + 0.38 * sin(uTime * (1.3 + fract(aPhase * 7.13) * 2.2) + aPhase * 40.0);
  vGain = tw * fogFactor(d) * step(0.05, d);
  gl_Position = projectionMatrix * mv;
}`;

// Four-point glint: bright core plus thin horizontal / vertical streaks.
const SPARK_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uStar;
in float vGain;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = length(p);
  float core = exp(-d * d * 55.0);
  float halo = exp(-d * d * 7.0) * 0.16;
  float sx = exp(-abs(p.y) * 26.0) * pow(max(0.0, 1.0 - abs(p.x)), 2.5);
  float sy = exp(-abs(p.x) * 26.0) * pow(max(0.0, 1.0 - abs(p.y)), 2.5);
  float a = core + halo + (sx + sy) * 0.55 * uStar;
  a *= smoothstep(1.0, 0.8, d);
  outColor = vec4(uColor * a * vGain * uOpacity, 1.0);
}`;

/** Twelve edges of an axis-aligned box as line-segment endpoints. */
export function boxEdges(sx: number, sy: number, sz: number, cx = 0, cy = 0, cz = 0) {
  const x = sx / 2;
  const y = sy / 2;
  const z = sz / 2;
  const out: number[] = [];
  const seg = (a: number[], b: number[]) =>
    out.push(a[0] + cx, a[1] + cy, a[2] + cz, b[0] + cx, b[1] + cy, b[2] + cz);
  for (const sa of [-1, 1]) {
    for (const sb of [-1, 1]) {
      seg([-x, sa * y, sb * z], [x, sa * y, sb * z]);
      seg([sa * x, -y, sb * z], [sa * x, y, sb * z]);
      seg([sa * x, sb * y, -z], [sa * x, sb * y, z]);
    }
  }
  return out;
}

/** Grid lines drawn on the six faces of a cube (`div` cells per side). */
export function faceGridLines(size: number, div: number) {
  const h = size / 2;
  const out: number[] = [];
  for (let i = 1; i < div; i++) {
    const c = -h + (size * i) / div;
    for (const s of [-h, h]) {
      // faces z = ±h
      out.push(c, -h, s, c, h, s, -h, c, s, h, c, s);
      // faces x = ±h
      out.push(s, c, -h, s, c, h, s, -h, c, s, h, c);
      // faces y = ±h
      out.push(c, s, -h, c, s, h, -h, s, c, h, s, c);
    }
  }
  return out;
}

export type LineOpts = { color?: THREE.Color; width?: number; opacity?: number };

/**
 * Factory for the handful of primitive looks the scene is made of. All of
 * them are additive and ignore depth (x-ray hologram), and all sizes are
 * expressed for a 1080-pixel-high frame and scaled to the real buffer.
 */
export class Kit {
  readonly time = { value: 0 };
  readonly fog: { value: THREE.Vector2 };
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(
    readonly pixelW: number,
    readonly pixelH: number,
    readonly pal: Palette,
    fogNear: number,
    fogFar: number,
  ) {
    this.fog = { value: new THREE.Vector2(fogNear, fogFar) };
  }

  private track<T extends { dispose: () => void }>(x: T) {
    this.disposables.push(x);
    return x;
  }

  /** Anti-aliased constant-width lines (screen-space quads via Line2). */
  lines(positions: number[], fader: Fader, o: LineOpts = {}) {
    const geo = this.track(new LineSegmentsGeometry());
    geo.setPositions(positions);
    const mat = this.track(
      new LineMaterial({
        color: (o.color ?? this.pal.line).getHex(THREE.LinearSRGBColorSpace),
        linewidth: ((o.width ?? 1.3) * this.pixelH) / 1080,
        transparent: true,
        opacity: o.opacity ?? 1,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        fog: true,
        toneMapped: false,
      }),
    );
    mat.color.copy(o.color ?? this.pal.line);
    mat.resolution.set(this.pixelW, this.pixelH);
    fader.add(mat, o.opacity ?? 1);
    const obj = new LineSegments2(geo, mat);
    obj.frustumCulled = false;
    return obj;
  }

  private shader(frag: string, vert: string, uniforms: Record<string, THREE.IUniform>) {
    return this.track(
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uFog: this.fog, ...uniforms },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
  }

  /** Translucent additive sheet(s); geometry needs 0..1 UVs per face. */
  faces(
    geo: THREE.BufferGeometry,
    fader: Fader,
    o: { color?: THREE.Color; opacity?: number; edge?: number } = {},
  ) {
    this.track(geo);
    const mat = this.shader(FACE_FRAG, FACE_VERT, {
      uColor: { value: o.color ?? this.pal.face },
      uOpacity: { value: o.opacity ?? 0.04 },
      uEdge: { value: o.edge ?? 0 },
    });
    fader.add(mat, o.opacity ?? 0.04);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Soft vertical light shaft. */
  beam(width: number, height: number, fader: Fader, opacity: number) {
    const g = new THREE.Group();
    for (const rot of [0, Math.PI / 2]) {
      const geo = this.track(new THREE.PlaneGeometry(width, height));
      const mat = this.shader(BEAM_FRAG, FACE_VERT, {
        uColor: { value: this.pal.beam },
        uOpacity: { value: opacity },
      });
      fader.add(mat, opacity);
      const m = new THREE.Mesh(geo, mat);
      m.rotation.y = rot;
      m.frustumCulled = false;
      g.add(m);
    }
    return g;
  }

  /** Twinkling glints. `points` is a flat xyz list; size is a fraction of frame height. */
  sparkles(
    points: number[],
    fader: Fader,
    o: { size?: number; sizeJitter?: number; opacity?: number; color?: THREE.Color; star?: number; seed?: number } = {},
  ) {
    const n = points.length / 3;
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const sizes = new Float32Array(n);
    const phases = new Float32Array(n);
    const seed = o.seed ?? 1;
    for (let i = 0; i < n; i++) {
      const h = Math.abs(Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
      const h2 = Math.abs(Math.sin((i + 1) * 39.3468 + seed * 11.135) * 24634.6345) % 1;
      sizes[i] = (o.size ?? 0.03) * (1 - (o.sizeJitter ?? 0.5) * h);
      phases[i] = h2;
    }
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    const mat = this.shader(SPARK_FRAG, SPARK_VERT, {
      uColor: { value: o.color ?? this.pal.sparkle },
      uOpacity: { value: o.opacity ?? 1 },
      uStar: { value: o.star ?? 1 },
      uPixelH: { value: this.pixelH },
      uTime: this.time,
    });
    fader.add(mat, o.opacity ?? 1);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  /**
   * Text read-out panel. Shows a window of a vertically tiling texture:
   * `uSpan` is the fraction of the texture width shown across the panel and
   * the vertical span follows from the panel's aspect, so glyphs are never
   * stretched. Scroll it by changing `material.map.offset.y`.
   */
  panel(
    tex: THREE.Texture,
    w: number,
    h: number,
    fader: Fader,
    o: { opacity?: number; color?: THREE.Color; uSpan?: number; vStart?: number } = {},
  ) {
    const map = tex.clone();
    map.needsUpdate = true;
    const img = tex.image as { width: number; height: number };
    const uSpan = o.uSpan ?? 1;
    map.repeat.set(uSpan, (uSpan * img.width * h) / (w * img.height));
    map.offset.set(0, o.vStart ?? 0);
    this.track(map);
    const geo = this.track(new THREE.PlaneGeometry(w, h));
    const mat = this.track(
      new THREE.MeshBasicMaterial({
        map,
        color: o.color ?? this.pal.text,
        transparent: true,
        opacity: o.opacity ?? 0.8,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
        toneMapped: false,
      }),
    );
    fader.add(mat, o.opacity ?? 0.8);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  }

  /** Wireframe glass cube: double edge frame, faint faces, face grid, glints. */
  holoCube(size: number, fader: Fader, o: { seed: number; glints?: number; grid?: number } ) {
    const g = new THREE.Group();
    g.add(this.faces(new THREE.BoxGeometry(size, size, size), fader, { opacity: 0.0045, edge: 5.0 }));
    g.add(this.lines(faceGridLines(size, o.grid ?? 4), fader, { width: 1.0, opacity: 0.065 }));
    g.add(this.lines(boxEdges(size * 0.955, size * 0.955, size * 0.955), fader, { width: 1.0, opacity: 0.3 }));
    g.add(this.lines(boxEdges(size, size, size), fader, { width: 1.7, opacity: 1.0 }));
    // Glints sit on face-grid intersections.
    const div = o.grid ?? 4;
    const pts: number[] = [];
    const count = o.glints ?? 14;
    for (let i = 0; i < count; i++) {
      const r = (k: number) => Math.abs(Math.sin((i + 1) * (k * 3.7 + 1.3) + o.seed * 9.17) * 4373.13) % 1;
      const a = -size / 2 + (size * Math.floor(r(1) * (div + 1))) / div;
      const b = -size / 2 + (size * Math.floor(r(2) * (div + 1))) / div;
      const s = r(3) < 0.5 ? -size / 2 : size / 2;
      const axis = Math.floor(r(4) * 3);
      if (axis === 0) pts.push(s, a, b);
      else if (axis === 1) pts.push(a, s, b);
      else pts.push(a, b, s);
    }
    g.add(this.sparkles(pts, fader, { size: 0.03, opacity: 0.9, seed: o.seed }));
    return g;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
