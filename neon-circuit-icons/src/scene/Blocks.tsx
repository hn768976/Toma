import { useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, ShaderMaterial } from 'three';
import { BOARD } from './layout';
import { FOG_GLSL } from './glsl';
import { BEAM_POS } from './Beam';

// Dark extruded blocks farther from the icon, very dark with faint edge
// highlights. Instanced, static.

export const Blocks = () => {
  const ref = useRef<InstancedMesh>(null);
  const n = BOARD.blocks.length;
  const geometry = useMemo(() => {
    const g = new BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const size = new Float32Array(n * 3);
    BOARD.blocks.forEach((b, i) => size.set([b.w, b.h, b.d], i * 3));
    g.setAttribute('aSize', new InstancedBufferAttribute(size, 3));
    return g;
  }, [n]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uBeam: { value: BEAM_POS } },
        vertexShader: /* glsl */ `
          attribute vec3 aSize;
          varying vec3 vLocal;
          varying vec3 vNormal2;
          varying vec3 vSize;
          varying vec3 vWorld;
          void main() {
            vLocal = (position - vec3(0.0, 0.5, 0.0)) * aSize;
            vNormal2 = normal;
            vSize = aSize;
            vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uBeam;
          varying vec3 vLocal;
          varying vec3 vNormal2;
          varying vec3 vSize;
          varying vec3 vWorld;
          ${FOG_GLSL}
          void main() {
            vec3 e = vSize * 0.5 - abs(vLocal) + abs(vNormal2) * 1e3;
            float dEdge = min(e.x, min(e.y, e.z));
            float px = max(fwidth(dEdge), 1e-4);
            float edge = exp(-dEdge / max(0.008, px * 1.2));
            vec3 base = vec3(0.0026, 0.0042, 0.009);
            float top = step(0.5, vNormal2.y);
            base *= mix(0.7, 1.5, top);
            float bd = length(vWorld.xz - uBeam.xz);
            vec3 beam = vec3(0.02, 0.035, 0.16) * top / (1.0 + bd * bd * 0.12);
            vec3 hi = vec3(0.05, 0.09, 0.2) * edge * mix(0.35, 0.8, top);
            vec3 c = base + beam * 0.12 + hi * 0.55;
            gl_FragColor = vec4(c * distFade(distance(vWorld, cameraPosition)), 1.0);
          }`,
      }),
    [],
  );
  useLayoutEffect(() => {
    const m = new Matrix4();
    BOARD.blocks.forEach((b, i) => {
      m.makeScale(b.w, b.h, b.d).setPosition(b.x, 0, b.z);
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, []);
  return <instancedMesh ref={ref} args={[geometry, material, n]} frustumCulled={false} />;
};
