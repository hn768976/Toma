import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { WellRow } from "../config";
import type { Dip } from "../lib/well";
import { WELL } from "./glsl";
import type { SharedUniforms } from "./shared";

/**
 * Spacetime grid: a polar (rings + spokes) or square grid of lines laid out
 * flat in x/z and displaced
 * down into the well in the vertex shader. Each segment is an instanced
 * screen-space quad of constant pixel width with analytic anti-aliasing, so
 * the lines keep an even width at any distance and never alias.
 *
 * Shimmer control: each vertex measures the on-screen gap to the
 * neighbouring parallel line and fades the line out before that gap gets
 * small enough to moire.
 */

/** Spokes start on the first ring, so they meet in a rounded throat, not a point. */
const spacing0 = (w: WellRow) => (w.pit > 0 ? w.pit : w.spacing * 0.5);

type Segments = { starts: number[]; ends: number[]; across: number[] };

/** Step length grows with distance from the well centre. */
const stepAt = (r: number) => 0.03 + 0.03 * r;

const buildSquare = (extent: number, spacing: number): Segments => {
  const n = Math.floor(extent / spacing);
  const out: Segments = { starts: [], ends: [], across: [] };
  for (let i = -n; i <= n; i++) {
    const c = i * spacing;
    for (const axis of [0, 1]) {
      let t = -extent;
      while (t < extent) {
        const nt = Math.min(extent, t + stepAt(Math.hypot(c, t)));
        if (axis === 0) {
          out.starts.push(c, t);
          out.ends.push(c, nt);
          out.across.push(spacing, 0);
        } else {
          out.starts.push(t, c);
          out.ends.push(nt, c);
          out.across.push(0, spacing);
        }
        t = nt;
      }
    }
  }
  return out;
};

/** Concentric rings every `spacing`, plus `spokes` radial lines. */
const buildPolar = (
  extent: number,
  spacing: number,
  spokes: number,
  spokeStart: number,
): Segments => {
  const out: Segments = { starts: [], ends: [], across: [] };
  for (let r = spacing; r <= extent + 1e-6; r += spacing) {
    const n = Math.max(48, Math.ceil((2 * Math.PI * r) / stepAt(r)));
    for (let k = 0; k < n; k++) {
      const a0 = (2 * Math.PI * k) / n;
      const a1 = (2 * Math.PI * (k + 1)) / n;
      out.starts.push(r * Math.cos(a0), r * Math.sin(a0));
      out.ends.push(r * Math.cos(a1), r * Math.sin(a1));
      const am = 0.5 * (a0 + a1);
      out.across.push(spacing * Math.cos(am), spacing * Math.sin(am));
    }
  }
  const dTheta = (2 * Math.PI) / spokes;
  for (let k = 0; k < spokes; k++) {
    // Half-step offset: no spoke lines up with a camera at azimuth 0.
    const a = (k + 0.5) * dTheta;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    let r = spokeStart;
    while (r < extent) {
      const nr = Math.min(extent, r + stepAt(r));
      out.starts.push(r * ca, r * sa);
      out.ends.push(nr * ca, nr * sa);
      const rm = 0.5 * (r + nr);
      out.across.push(-sa * rm * dTheta, ca * rm * dTheta);
      r = nr;
    }
  }
  return out;
};

const vertexShader = /* glsl */ `
${WELL}
uniform vec2 uResolution;
uniform float uPxScale;
uniform float uWidth;
uniform vec2 uFade;
uniform vec2 uDark;
attribute vec2 aStart;
attribute vec2 aEnd;
attribute vec2 aAcross;
varying float vSide;
varying float vHalf;
varying float vFade;
varying float vFar;

vec3 surf(vec2 p) { return vec3(p.x, wellHeight(p), p.y); }

vec4 toView(vec3 p) { return viewMatrix * vec4(p, 1.0); }

void main() {
  vec4 s = toView(surf(aStart));
  vec4 e = toView(surf(aEnd));
  float nearZ = -0.05;
  // Clip the segment against a plane just in front of the camera.
  if (s.z > nearZ && e.z > nearZ) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (s.z > nearZ) s = mix(s, e, (nearZ - s.z) / (e.z - s.z));
  if (e.z > nearZ) e = mix(e, s, (nearZ - e.z) / (s.z - e.z));

  vec4 cs = projectionMatrix * s;
  vec4 ce = projectionMatrix * e;
  vec2 ps = (cs.xy / cs.w * 0.5 + 0.5) * uResolution;
  vec2 pe = (ce.xy / ce.w * 0.5 + 0.5) * uResolution;
  vec2 dir = pe - ps;
  float len = length(dir);
  dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  bool atEnd = position.y > 0.5;
  vec2 mine = atEnd ? aEnd : aStart;
  vec4 clip = atEnd ? ce : cs;
  vec2 pm = atEnd ? pe : ps;

  // On-screen gap to the neighbouring parallel line (in 720p pixels).
  vec4 cn = projectionMatrix * toView(surf(mine + aAcross));
  vec2 pn = (cn.xy / cn.w * 0.5 + 0.5) * uResolution;
  float gap = abs(dot(pn - pm, nrm)) / uPxScale;
  float gapFade = smoothstep(2.5, 7.0, gap);

  vec3 world = surf(mine);
  float dist = distance(world, cameraPosition);
  float distFade = 1.0 - smoothstep(uFade.x, uFade.y, dist);
  float r = length(mine);
  float dark = uDark.y > 0.0 ? smoothstep(uDark.x, uDark.y, r) : 1.0;
  vFade = gapFade * distFade * dark;
  vFar = smoothstep(uFade.x * 0.35, uFade.y, dist);

  float w = max(uWidth * uPxScale, 1.0);
  vHalf = 0.5 * w;
  float side = position.x;
  float h = vHalf + 1.0;
  vSide = side * h;
  vec2 off = nrm * side * h;
  clip.xy += off / uResolution * 2.0 * clip.w;
  gl_Position = clip;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColorNear;
uniform vec3 uColorFar;
uniform float uOpacity;
uniform float uWidth;
uniform float uPxScale;
varying float vSide;
varying float vHalf;
varying float vFade;
varying float vFar;
void main() {
  float cov = clamp(vHalf + 0.5 - abs(vSide), 0.0, 1.0);
  // Lines thinner than a pixel are drawn 1px wide and dimmed instead.
  float thin = min(uWidth * uPxScale, 1.0);
  float a = cov * thin * uOpacity * vFade;
  if (a <= 0.0) discard;
  vec3 col = mix(uColorNear, uColorFar, vFar);
  gl_FragColor = vec4(col * a, 1.0);
}
`;

export const Grid: React.FC<{
  well: WellRow;
  dip: Dip;
  shared: SharedUniforms;
}> = ({ well, dip, shared }) => {
  const geometry = useMemo(() => {
    const seg =
      well.spokes > 0
        ? buildPolar(well.extent, well.spacing, well.spokes, Math.max(spacing0(well), 0.02))
        : buildSquare(well.extent, well.spacing);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0],
        3,
      ),
    );
    g.setIndex([0, 1, 2, 2, 1, 3]);
    const attr = (a: number[]) => new THREE.InstancedBufferAttribute(new Float32Array(a), 2);
    g.setAttribute("aStart", attr(seg.starts));
    g.setAttribute("aEnd", attr(seg.ends));
    g.setAttribute("aAcross", attr(seg.across));
    g.instanceCount = seg.starts.length / 2;
    return g;
  }, [well.extent, well.spacing, well.spokes]);

  const material = useMemo(() => {
    const toLinear = (hex: string) =>
      new THREE.Color(hex); // THREE.Color converts sRGB hex to linear working space
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uResolution: shared.uResolution,
        uPxScale: shared.uPxScale,
        uWellA: { value: well.depth },
        uWellC: { value: well.width },
        uDip: { value: new THREE.Vector3() },
        uDipC: { value: 1 },
        uWidth: { value: well.lineWidth },
        uFade: { value: new THREE.Vector2(...well.fade) },
        uDark: { value: new THREE.Vector2(...well.darkCentre) },
        uColorNear: { value: toLinear(well.colorNear) },
        uColorFar: { value: toLinear(well.colorFar) },
        uOpacity: { value: well.opacity },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      side: THREE.DoubleSide,
    });
  }, [well, shared]);

  useLayoutEffect(() => {
    (material.uniforms.uDip.value as THREE.Vector3).set(dip.x, dip.z, dip.depth);
    material.uniforms.uDipC.value = dip.width;
  }, [material, dip.x, dip.z, dip.depth, dip.width]);

  return (
    <>
      <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />
      {well.pit > 0 ? <Pit well={well} /> : null}
    </>
  );
};

/**
 * Dark pit at the bottom of the well: an opaque black cap that follows the
 * funnel surface up to radius `pit`, hiding the lines behind it.
 */
const Pit: React.FC<{ well: WellRow }> = ({ well }) => {
  const geometry = useMemo(() => {
    const g = new THREE.CircleGeometry(well.pit, 96, 0, Math.PI * 2);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, -well.depth / Math.sqrt(x * x + z * z + well.width * well.width) - 0.002);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [well.pit, well.depth, well.width]);
  return (
    <mesh geometry={geometry} renderOrder={0}>
      <meshBasicMaterial color="#000000" side={THREE.DoubleSide} />
    </mesh>
  );
};
