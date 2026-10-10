import * as THREE from "three";

// Camera-facing strips along 3D polylines: fibres, network lines, beams.
// Width is in world units (so near lines are wider) with a minimum pixel
// width so far lines stay anti-aliased instead of breaking up.
//
// Per-vertex attributes:
//   aPrev/aNext  neighbouring points (screen-space tangent)
//   aSide        -1 / +1 across the strip
//   aT           0..1 arc-length fraction along the line
//   aLen         world length of the line
//   aRand        per-line random vec4
//   aWidth       per-line half-width multiplier

export type StripLine = {
  points: THREE.Vector3[];
  rand: [number, number, number, number];
  width?: number;
};

export const buildStripGeometry = (lines: StripLine[]) => {
  let vCount = 0;
  let iCount = 0;
  for (const l of lines) {
    vCount += l.points.length * 2;
    iCount += (l.points.length - 1) * 6;
  }
  const pos = new Float32Array(vCount * 3);
  const prev = new Float32Array(vCount * 3);
  const next = new Float32Array(vCount * 3);
  const side = new Float32Array(vCount);
  const tt = new Float32Array(vCount);
  const len = new Float32Array(vCount);
  const rnd = new Float32Array(vCount * 4);
  const wid = new Float32Array(vCount);
  const index = new Uint32Array(iCount);
  let v = 0;
  let ii = 0;
  for (const l of lines) {
    const pts = l.points;
    const n = pts.length;
    const cum: number[] = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = cum[n - 1] || 1;
    const base = v;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const pp = pts[Math.max(0, i - 1)];
      const pn = pts[Math.min(n - 1, i + 1)];
      for (let s = 0; s < 2; s++) {
        pos.set([p.x, p.y, p.z], v * 3);
        prev.set([pp.x, pp.y, pp.z], v * 3);
        next.set([pn.x, pn.y, pn.z], v * 3);
        side[v] = s === 0 ? -1 : 1;
        tt[v] = cum[i] / total;
        len[v] = total;
        rnd.set(l.rand, v * 4);
        wid[v] = l.width ?? 1;
        v++;
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], ii);
      ii += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aPrev", new THREE.BufferAttribute(prev, 3));
  g.setAttribute("aNext", new THREE.BufferAttribute(next, 3));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setAttribute("aT", new THREE.BufferAttribute(tt, 1));
  g.setAttribute("aLen", new THREE.BufferAttribute(len, 1));
  g.setAttribute("aRand", new THREE.BufferAttribute(rnd, 4));
  g.setAttribute("aWidth", new THREE.BufferAttribute(wid, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
};

export const STRIP_VERT = /* glsl */ `
uniform vec2 uRes;
uniform float uHalfWidth;
uniform float uMinPx;
in vec3 aPrev;
in vec3 aNext;
in float aSide;
in float aT;
in float aLen;
in vec4 aRand;
in float aWidth;
out float vS;
out float vT;
flat out float vLen;
flat out vec4 vRand;
out float vThin;
out float vDist;
out vec3 vWorld;
vec2 toPx(vec4 c) { return c.xy / max(c.w, 1e-4) * uRes * 0.5; }
void main() {
  mat4 pmv = projectionMatrix * modelViewMatrix;
  vec4 c = pmv * vec4(position, 1.0);
  vec4 cp = pmv * vec4(aPrev, 1.0);
  vec4 cn = pmv * vec4(aNext, 1.0);
  vec2 d = toPx(cn) - toPx(cp);
  float dl = length(d);
  vec2 dir = dl > 1e-5 ? d / dl : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float hw = uHalfWidth * aWidth;
  float worldPx = hw * projectionMatrix[1][1] / max(c.w, 1e-4) * uRes.y * 0.5;
  float px = max(worldPx, uMinPx);
  vThin = clamp(worldPx / px, 0.0, 1.0);
  c.xy += nrm * aSide * px / (uRes * 0.5) * c.w;
  gl_Position = c;
  vS = aSide;
  vT = aT;
  vLen = aLen;
  vRand = aRand;
  vDist = -(modelViewMatrix * vec4(position, 1.0)).z;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
}
`;

// Depth-only pass for the strip cores so the DoF sees their real depth while
// the glow itself is drawn additively without depth test.
export const makeStripDepthMaterial = (uniforms: Record<string, THREE.IUniform>, coreFrac = 0.35) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: STRIP_VERT,
    fragmentShader: /* glsl */ `
      in float vS;
      out vec4 outColor;
      void main() {
        if (abs(vS) > ${coreFrac.toFixed(3)}) discard;
        outColor = vec4(0.0);
      }`,
    uniforms,
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
  });
