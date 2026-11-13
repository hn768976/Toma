// Small turning dotted globe (three.js via @remotion/three). Rotation is a pure
// function of the frame; R3F renders once per frame through ThreeCanvas.
import { ThreeCanvas } from '@remotion/three';
import { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import * as THREE from 'three';
import { globePoints } from './geo';
import { raw } from './flyover';
import { dpr } from './MapCanvas';
import { hash01 } from '../lib/rng';
import { LOOP } from '../city';

const PT_VS = `
attribute float aLand;
uniform float uSize;
uniform float uScale;
varying float vFacing;
varying float vLand;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * position);
  vFacing = n.z;
  vLand = aLand;
  gl_PointSize = uSize * uScale * (aLand > 0.5 ? 1.0 : 0.7);
  gl_Position = projectionMatrix * mv;
}`;
const PT_FS = `
uniform vec3 uLand;
uniform vec3 uSea;
varying float vFacing;
varying float vLand;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = clamp((0.5 - d) * 4.0, 0.0, 1.0);
  float face = smoothstep(-0.15, 0.35, vFacing);
  float rim = 0.55 + 0.45 * smoothstep(0.0, 0.9, vFacing);
  vec3 col = vLand > 0.5 ? uLand * rim : uSea;
  float alpha = a * face * (vLand > 0.5 ? 1.0 : 0.35);
  gl_FragColor = vec4(col * alpha, alpha);
}`;

function GlobeScene({ landColor, seaColor, lineColor, spin, tilt, size }: { landColor: string; seaColor: string; lineColor: string; spin: number; tilt: number; size: number }) {
  const frame = useCurrentFrame();
  const { geom, mat, arcs, rings } = useMemo(() => {
    const pts = globePoints();
    const n = pts.length / 4;
    const pos = new Float32Array(n * 3), land = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set([pts[i * 4], pts[i * 4 + 1], pts[i * 4 + 2]], i * 3); land[i] = pts[i * 4 + 3]; }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('aLand', new THREE.BufferAttribute(land, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uSize: { value: size }, uScale: { value: dpr() }, uLand: { value: raw(landColor) }, uSea: { value: raw(seaColor) } },
    });
    // great-circle arcs lifted off the surface
    const arcs: THREE.BufferGeometry[] = [];
    for (let a = 0; a < 7; a++) {
      const r = (i: number) => hash01(a, i);
      const p0 = new THREE.Vector3().setFromSphericalCoords(1, Math.acos(2 * r(1) - 1), r(2) * Math.PI * 2);
      const p1 = new THREE.Vector3().setFromSphericalCoords(1, Math.acos(2 * r(3) - 1), r(4) * Math.PI * 2);
      const pts3: THREE.Vector3[] = [];
      for (let k = 0; k <= 48; k++) {
        const t = k / 48;
        const v = p0.clone().lerp(p1, t).normalize().multiplyScalar(1 + 0.18 * Math.sin(Math.PI * t));
        pts3.push(v);
      }
      arcs.push(new THREE.BufferGeometry().setFromPoints(pts3));
    }
    const rings: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
      const pts3: THREE.Vector3[] = [];
      const R = 1.22 + k * 0.1;
      for (let i = 0; i <= 128; i++) { const t = (i / 128) * Math.PI * 2; pts3.push(new THREE.Vector3(Math.cos(t) * R, 0, Math.sin(t) * R)); }
      rings.push(new THREE.BufferGeometry().setFromPoints(pts3));
    }
    return { geom, mat, arcs, rings };
  }, [landColor, seaColor, size]);
  const rot = (frame / LOOP) * Math.PI * 2 * spin;
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ color: raw(lineColor), transparent: true, opacity: 0.55 }), [lineColor]);
  return (
    <>
      <group rotation={[tilt, rot, 0]}>
        <mesh>
          <sphereGeometry args={[0.985, 64, 48]} />
          <meshBasicMaterial color={raw(seaColor)} transparent opacity={0.35} />
        </mesh>
        <points geometry={geom} material={mat} />
        {arcs.map((g, i) => <primitive key={i} object={new THREE.Line(g, lineMat)} />)}
      </group>
      {rings.map((g, i) => (
        <group key={i} rotation={[0.35 + i * 0.5, rot * (i % 2 ? -0.5 : 0.3), 0.3 * i]}>
          <primitive object={new THREE.LineLoop(g, lineMat)} />
        </group>
      ))}
    </>
  );
}

export const Globe: React.FC<{ x: number; y: number; d: number; landColor: string; seaColor: string; lineColor: string; spin?: number; tilt?: number; dotSize?: number }> = ({ x, y, d, landColor, seaColor, lineColor, spin = 1, tilt = 0.4, dotSize = 3.2 }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: d, height: d }}>
    <ThreeCanvas
      width={d}
      height={d}
      dpr={dpr()}
      linear
      flat
      gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
      camera={{ position: [0, 0, 4.2], fov: 38 }}
      style={{ width: d, height: d }}
    >
      <GlobeScene landColor={landColor} seaColor={seaColor} lineColor={lineColor} spin={spin} tilt={tilt} size={dotSize} />
    </ThreeCanvas>
  </div>
);
