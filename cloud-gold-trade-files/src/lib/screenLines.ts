import * as THREE from "three";

/**
 * Batched 3D line segments drawn as screen-space quads. Width is a fraction of
 * the frame height, so lines keep the same look at 720p and 4K. Lines under
 * ~1 px are widened and dimmed instead of aliasing.
 */
export function screenLines(
  segs: { a: THREE.Vector3; b: THREE.Vector3; i: number }[],
  color: THREE.Color,
  widthFrac: number,
  viewH: number,
  opts: { depthWrite?: boolean; fadeNear?: number; fadeFar?: number } = {},
): THREE.Mesh {
  const n = segs.length;
  const A = new Float32Array(n * 4 * 3);
  const B = new Float32Array(n * 4 * 3);
  const C = new Float32Array(n * 4 * 2); // (end 0/1, side -1/1)
  const I = new Float32Array(n * 4);
  const idx: number[] = [];
  segs.forEach((s, k) => {
    for (let v = 0; v < 4; v++) {
      const o = k * 4 + v;
      A.set([s.a.x, s.a.y, s.a.z], o * 3);
      B.set([s.b.x, s.b.y, s.b.z], o * 3);
      C.set([v < 2 ? 0 : 1, v % 2 === 0 ? -1 : 1], o * 2);
      I[o] = s.i;
    }
    const q = k * 4;
    idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(A, 3));
  g.setAttribute("aB", new THREE.BufferAttribute(B, 3));
  g.setAttribute("aC", new THREE.BufferAttribute(C, 2));
  g.setAttribute("aI", new THREE.BufferAttribute(I, 1));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uW: { value: widthFrac },
      uMinW: { value: 1.0 / 720 },
      uViewH: { value: viewH },
      uAspect: { value: 16 / 9 },
      uFadeNear: { value: opts.fadeNear ?? 0 },
      uFadeFar: { value: opts.fadeFar ?? 1e6 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aB; attribute vec2 aC; attribute float aI;
      uniform float uW; uniform float uMinW; uniform float uAspect; uniform float uFadeNear; uniform float uFadeFar;
      varying float vI; varying float vSide; varying float vFade;
      void main() {
        vec4 pa = projectionMatrix * viewMatrix * vec4(position, 1.0);
        vec4 pb = projectionMatrix * viewMatrix * vec4(aB, 1.0);
        // keep both ends in front of the camera
        if (pa.w < 0.05) pa = mix(pa, pb, (0.05 - pa.w) / (pb.w - pa.w));
        if (pb.w < 0.05) pb = mix(pb, pa, (0.05 - pb.w) / (pa.w - pb.w));
        vec2 sa = pa.xy / pa.w, sb = pb.xy / pb.w;
        vec2 d = (sb - sa) * vec2(uAspect, 1.0);
        vec2 nrm = normalize(vec2(-d.y, d.x) + 1e-6) / vec2(uAspect, 1.0);
        float w = max(uW, uMinW);
        vFade = uW / w;
        vec4 p = aC.x < 0.5 ? pa : pb;
        p.xy += nrm * aC.y * w * p.w;   // width in NDC units of height (NDC height = 2)
        vSide = aC.y; vI = aI;
        float z = p.w;
        vFade *= (uFadeNear > 0.0 ? smoothstep(uFadeNear * 0.5, uFadeNear, z) : 1.0) * (1.0 - smoothstep(uFadeFar * 0.6, uFadeFar, z));
        gl_Position = p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vI; varying float vSide; varying float vFade;
      void main() {
        float a = 1.0 - smoothstep(0.3, 1.0, abs(vSide));
        gl_FragColor = vec4(uColor * vI * a * vFade, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: opts.depthWrite ?? false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  return m;
}
