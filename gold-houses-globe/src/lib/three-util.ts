import * as THREE from "three";

/** Pixel-scale factor: 1 at 720p, 3 at 2160p, so sizes in px@720p stay put. */
export const pxScale = (height: number) => height / 720;

export const hdrColor = (hex: string, intensity = 1) =>
  new THREE.Color(hex).multiplyScalar(intensity); // Color() converts sRGB hex -> linear

export const makeEnv = (gl: THREE.WebGLRenderer, hdri: THREE.Texture) => {
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromEquirectangular(hdri);
  pm.dispose();
  return rt;
};

/**
 * Additive soft round sprites. Per-point attributes: position, size (px @720p),
 * pcolor (linear, may exceed 1), and the shader takes `sharp` (0 = gaussian
 * glow, 1 = hard disc) as a uniform.
 */
export const glowPointsMaterial = (height: number, opts: { sharp?: number; square?: boolean; depthTest?: boolean } = {}) =>
  new THREE.ShaderMaterial({
    uniforms: { uPx: { value: pxScale(height) }, uSharp: { value: opts.sharp ?? 0 } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute vec3 pcolor;
      varying vec3 vColor;
      uniform float uPx;
      void main() {
        // never rasterise sprites below 4px@720p (tiny MSAA'd sprites alias
        // into odd shapes); keep the energy of the requested size instead.
        float s = size * uPx;
        float S = max(s, 4.0 * uPx);
        vColor = pcolor * (s * s) / (S * S);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = S;
        if (size <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      uniform float uSharp;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        ${opts.square
          ? "float r = max(abs(q.x), abs(q.y)); float a = 1.0 - smoothstep(0.7, 1.0, r);"
          : "float r2 = dot(q, q); float a = mix(exp(-r2 * 5.0), 1.0 - smoothstep(0.6, 1.0, r2), uSharp) * step(r2, 1.0);"}
        gl_FragColor = vec4(vColor * a, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: opts.depthTest ?? true,
    transparent: true,
  });

/** Ease helpers */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

/**
 * Static camera-facing ribbons along polylines. Adds attributes:
 *  - `uv`   : x = arc-length fraction 0..1 along the path, y = -1..1 across
 *  - `pid`  : path index
 *  - `plen` : total path length (world units)
 */
export const ribbonGeometry = (
  paths: THREE.Vector3[][],
  width: (pathIndex: number, s: number) => number,
  camPos: THREE.Vector3,
) => {
  const pos: number[] = [], uv: number[] = [], pid: number[] = [], plen: number[] = [], idx: number[] = [];
  const T = new THREE.Vector3(), V = new THREE.Vector3(), S = new THREE.Vector3();
  let base = 0;
  paths.forEach((pts, p) => {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const L = cum[cum.length - 1];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      T.subVectors(b, a).normalize();
      V.subVectors(camPos, pts[i]).normalize();
      S.crossVectors(T, V).normalize();
      const s = cum[i] / L;
      const w = width(p, s) * 0.5;
      for (const side of [-1, 1]) {
        pos.push(pts[i].x + S.x * w * side, pts[i].y + S.y * w * side, pts[i].z + S.z * w * side);
        uv.push(s, side);
        pid.push(p);
        plen.push(L);
      }
      if (i > 0) {
        const k = base + i * 2;
        idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
    }
    base += pts.length * 2;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("pid", new THREE.Float32BufferAttribute(pid, 1));
  g.setAttribute("plen", new THREE.Float32BufferAttribute(plen, 1));
  g.setIndex(idx);
  return g;
};

/**
 * Points sized in world units (perspective-correct), solid (writes depth so
 * DOF treats them as real objects). Attributes: position, wsize, pcolor.
 */
export const worldPointsMaterial = (height: number, fovDeg: number, square: boolean) =>
  new THREE.ShaderMaterial({
    uniforms: { uProj: { value: height / (2 * Math.tan((fovDeg * Math.PI) / 360)) } },
    vertexShader: /* glsl */ `
      attribute float wsize; attribute vec3 pcolor;
      uniform float uProj; varying vec3 vColor;
      void main() {
        vColor = pcolor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(2.0, wsize * uProj / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 q = abs(gl_PointCoord * 2.0 - 1.0);
        float r = ${square ? "max(q.x, q.y)" : "length(q)"};
        if (r > 1.0) discard;
        float edge = ${square ? "0.75 + 0.25 * smoothstep(0.6, 1.0, r)" : "1.0"};
        gl_FragColor = vec4(vColor * edge, 1.0);
      }`,
    // additive but depth-writing: always brighter than what's behind, and DOF
    // still sees them as solid objects
    blending: THREE.AdditiveBlending,
    transparent: false,
  });

/**
 * Same look as glowPointsMaterial, but drawn as camera-facing instanced quads
 * instead of GL point sprites. Returns a mesh plus the per-instance arrays
 * (position xyz, pcolor rgb, size px@720p) to fill each frame.
 */
export const glowSprites = (count: number, height: number, sharp = 0) => {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
  geo.setAttribute("iPos", new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute("iCol", new THREE.InstancedBufferAttribute(col, 3));
  geo.setAttribute("iSize", new THREE.InstancedBufferAttribute(size, 1));
  geo.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: pxScale(height) }, uSharp: { value: sharp }, uRes: { value: new THREE.Vector2(height * 16 / 9, height) } },
    vertexShader: /* glsl */ `
      attribute vec3 iPos; attribute vec3 iCol; attribute float iSize;
      uniform float uPx; uniform vec2 uRes;
      varying vec3 vColor; varying vec2 vQ;
      void main() {
        float s = iSize * uPx;
        float S = max(s, 4.0 * uPx);
        vColor = iCol * (s * s) / (S * S);
        vQ = position.xy;
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(iPos, 1.0);
        clip.xy += position.xy * S / uRes * clip.w; // S px wide quad
        gl_Position = iSize <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : clip;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying vec2 vQ; uniform float uSharp;
      void main() {
        float r2 = dot(vQ, vQ);
        float a = mix(exp(-r2 * 5.0), 1.0 - smoothstep(0.6, 1.0, r2), uSharp) * step(r2, 1.0);
        gl_FragColor = vec4(vColor * a, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const update = () => {
    (geo.attributes.iPos as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.iCol as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.iSize as THREE.BufferAttribute).needsUpdate = true;
  };
  return { mesh, pos, col, size, update };
};
