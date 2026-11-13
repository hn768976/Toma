import * as THREE from "three";

/**
 * Anti-aliased glowing polyline drawn as a triangle strip, with arc-length
 * based progressive reveal (setProgress). Fully deterministic: every call
 * restores the original head vertices before moving the new head, so frames
 * can be rendered in any order.
 */
export class Ribbon {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  private geometry: THREE.BufferGeometry;
  private pos: Float32Array;
  private orig: Float32Array;
  private cum: number[];
  private pts: Array<[number, number]>;
  private normals: Array<[number, number, number]>;
  private halfWidth: number;
  private lastHead = -1;

  constructor(
    pts: Array<[number, number]>,
    opts: {
      halfWidth: number; // total half width including glow (local units)
      core: number; // core half width as a fraction of halfWidth
      glow: number; // glow intensity
      color: THREE.Color; // may be HDR (>1)
      whiteCore?: number; // 0..1 how much the core turns white-hot
      z?: number;
    },
  ) {
    this.pts = pts;
    this.halfWidth = opts.halfWidth;
    const n = pts.length;
    this.cum = [0];
    for (let i = 1; i < n; i++) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      this.cum.push(this.cum[i - 1] + Math.hypot(dx, dy));
    }
    const total = this.cum[n - 1] || 1;
    this.normals = pts.map((_, i) => {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[Math.min(n - 1, i + 1)];
      let t0x = p1[0] - p0[0];
      let t0y = p1[1] - p0[1];
      let t1x = p2[0] - p1[0];
      let t1y = p2[1] - p1[1];
      const l0 = Math.hypot(t0x, t0y) || 1;
      const l1 = Math.hypot(t1x, t1y) || 1;
      t0x /= l0;
      t0y /= l0;
      t1x /= l1;
      t1y /= l1;
      if (i === 0) {
        t0x = t1x;
        t0y = t1y;
      }
      if (i === n - 1) {
        t1x = t0x;
        t1y = t0y;
      }
      let nx = -(t0y + t1y);
      let ny = t0x + t1x;
      const ln = Math.hypot(nx, ny) || 1;
      nx /= ln;
      ny /= ln;
      const miter = 1 / Math.max(0.45, nx * -t0y + ny * t0x);
      return [nx, ny, miter];
    });
    const z = opts.z ?? 0;
    this.pos = new Float32Array(n * 2 * 3);
    const uv = new Float32Array(n * 2 * 2);
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[i];
      const [nx, ny, m] = this.normals[i];
      const w = this.halfWidth * m;
      this.pos.set([x + nx * w, y + ny * w, z, x - nx * w, y - ny * w, z], i * 6);
      uv.set([this.cum[i] / total, 1, this.cum[i] / total, 0], i * 4);
    }
    this.orig = this.pos.slice();
    const index: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    this.geometry.setIndex(index);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: opts.color.clone() },
        core: { value: opts.core },
        glow: { value: opts.glow },
        whiteCore: { value: opts.whiteCore ?? 0.35 },
        opacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform vec3 color;
        uniform float core;
        uniform float glow;
        uniform float whiteCore;
        uniform float opacity;
        void main() {
          float d = abs(vUv.y - 0.5) * 2.0;
          float aa = max(fwidth(d) * 1.2, 1e-4);
          float c = 1.0 - smoothstep(core - aa, core + aa, d);
          float g = exp(-d * d * 7.0) * glow * (1.0 - c);
          vec3 hot = mix(color, vec3(max(color.r, max(color.g, color.b))), whiteCore);
          vec3 col = hot * c + color * g;
          gl_FragColor = vec4(col * opacity, 1.0);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.setProgress(1);
  }

  /**
   * Reveal the line up to fractional point index p*(n-1) (p in [0,1]).
   * Points are revealed at a constant rate per point, which matches how the
   * chart series are animated (one data point per time step).
   */
  setProgress(p: number) {
    const n = this.pts.length;
    if (this.lastHead >= 0) {
      this.pos.set(this.orig.subarray(this.lastHead * 6, this.lastHead * 6 + 6), this.lastHead * 6);
      this.lastHead = -1;
    }
    const fi = Math.min(Math.max(p, 0), 1) * (n - 1);
    if (fi <= 1e-6) {
      this.mesh.visible = false;
      (this.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      return;
    }
    this.mesh.visible = true;
    const k = Math.min(n - 2, Math.floor(fi));
    const f = fi - k;
    if (f < 1) {
      const head = k + 1;
      const x = this.pts[k][0] + (this.pts[head][0] - this.pts[k][0]) * f;
      const y = this.pts[k][1] + (this.pts[head][1] - this.pts[k][1]) * f;
      const [nx, ny] = this.normals[k];
      const w = this.halfWidth;
      const z = this.orig[head * 6 + 2];
      this.pos.set([x + nx * w, y + ny * w, z, x - nx * w, y - ny * w, z], head * 6);
      this.lastHead = head;
    }
    this.geometry.setDrawRange(0, (k + 1) * 6);
    (this.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Soft round dot / diamond sprite on a plane (local units). */
export const makeDot = (
  size: number,
  color: THREE.Color,
  shape: "circle" | "diamond" = "circle",
) => {
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: color.clone() }, opacity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 color;
      uniform float opacity;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float d = ${shape === "diamond" ? "abs(p.x) + abs(p.y)" : "length(p)"};
        float aa = max(fwidth(d) * 1.2, 1e-4);
        float core = 1.0 - smoothstep(0.55 - aa, 0.55 + aa, d);
        float halo = exp(-d * d * 5.0) * 0.35 * (1.0 - core);
        gl_FragColor = vec4(color * (core + halo) * opacity, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, material, geometry };
};
