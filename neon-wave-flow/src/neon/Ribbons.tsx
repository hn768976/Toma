import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { LineDef } from "./lines";
import { createRibbonMaterial } from "./ribbonMaterial";

type Props = {
  lines: LineDef[];
  t: number;
  camX: number;
  focus: number;
  aperture: number;
};

// All filaments share one geometry and one draw call. Each segment is a
// separate quad (4 vertices); positions are regenerated on the CPU for every
// frame.
export const Ribbons: React.FC<Props> = ({ lines, t, camX, focus, aperture }) => {
  const size = useThree((s) => s.size);

  const { geometry, material, points, starts } = useMemo(() => {
    const starts: number[] = [];
    let total = 0;
    let segments = 0;
    for (const l of lines) {
      starts.push(total);
      total += l.n;
      segments += l.n - 1;
    }
    const vcount = segments * 4;
    const g = new THREE.BufferGeometry();
    const end = new Float32Array(vcount);
    const side = new Float32Array(vcount);
    const width = new Float32Array(vcount);
    const intensity = new Float32Array(vcount);
    const color = new Float32Array(vcount * 3);
    const along = new Float32Array(vcount);
    const index = new Uint32Array(segments * 6);
    let seg = 0;
    for (const l of lines) {
      for (let i = 0; i < l.n - 1; i++) {
        for (let k = 0; k < 4; k++) {
          const v = seg * 4 + k;
          end[v] = k < 2 ? 0 : 1;
          side[v] = k % 2 === 0 ? -1 : 1;
          width[v] = l.width;
          intensity[v] = l.intensity;
          color.set(l.color, v * 3);
          along[v] = (i + (k < 2 ? 0 : 1)) / (l.n - 1);
        }
        const a = seg * 4;
        index.set([a, a + 1, a + 2, a + 2, a + 1, a + 3], seg * 6);
        seg++;
      }
    }
    const dyn = (arr: Float32Array, n: number) =>
      new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", dyn(new Float32Array(vcount * 3), 3));
    g.setAttribute("aOther", dyn(new Float32Array(vcount * 3), 3));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    g.setAttribute("aWidth", new THREE.BufferAttribute(width, 1));
    g.setAttribute("aIntensity", new THREE.BufferAttribute(intensity, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    g.setAttribute("aU", new THREE.BufferAttribute(along, 1));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    return {
      geometry: g,
      material: createRibbonMaterial(),
      points: new Float32Array(total * 3),
      starts,
    };
  }, [lines]);

  // Regenerate geometry for this frame (synchronously, before the render).
  lines.forEach((l, li) => l.fill(points, starts[li], t, camX));
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const other = geometry.getAttribute("aOther") as THREE.BufferAttribute;
  const P = pos.array as Float32Array;
  const O = other.array as Float32Array;
  let seg = 0;
  lines.forEach((l, li) => {
    for (let i = 0; i < l.n - 1; i++) {
      const a = (starts[li] + i) * 3;
      const b = a + 3;
      for (let k = 0; k < 4; k++) {
        const v = (seg * 4 + k) * 3;
        const self = k < 2 ? a : b;
        const oth = k < 2 ? b : a;
        P[v] = points[self];
        P[v + 1] = points[self + 1];
        P[v + 2] = points[self + 2];
        O[v] = points[oth];
        O[v + 1] = points[oth + 1];
        O[v + 2] = points[oth + 2];
      }
      seg++;
    }
  });
  pos.needsUpdate = true;
  other.needsUpdate = true;

  material.uniforms.uAspect.value = size.width / size.height;
  material.uniforms.uFocus.value = focus;
  material.uniforms.uAperture.value = aperture;

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
};
