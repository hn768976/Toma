import { useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three';
import { BLUE, BOARD, TEAL } from './layout';
import { FOG_GLSL } from './glsl';

// All traces as ONE merged ribbon geometry: thin bright core + soft glow,
// brighter near the connector chips.

const HALF_W = 0.032; // ribbon half width (glow extent), world units
const CORE = 0.0062 / HALF_W; // core half width as a fraction of the ribbon
const Y = 0.0035;

const buildGeometry = () => {
  const pos: number[] = [];
  const side: number[] = [];
  const col: number[] = [];
  const bright: number[] = [];
  const idx: number[] = [];
  const colors = [new Color(TEAL), new Color(BLUE)];
  const chips = BOARD.chips;
  const nearChip = (x: number, z: number) => {
    let d = Infinity;
    for (const c of chips) d = Math.min(d, Math.hypot(x - c.x, (z - c.z) * 0.8));
    return d;
  };
  for (const t of BOARD.traces) {
    const n = t.pts.length;
    const base = pos.length / 3;
    const c = colors[t.color];
    for (let i = 0; i < n; i++) {
      const p = t.pts[i];
      const a = t.pts[Math.max(0, i - 1)];
      const b = t.pts[Math.min(n - 1, i + 1)];
      // segment directions in / out
      let d0x = p[0] - a[0], d0z = p[1] - a[1];
      let d1x = b[0] - p[0], d1z = b[1] - p[1];
      const l0 = Math.hypot(d0x, d0z) || 1;
      const l1 = Math.hypot(d1x, d1z) || 1;
      d0x /= l0; d0z /= l0; d1x /= l1; d1z /= l1;
      if (i === 0) { d0x = d1x; d0z = d1z; }
      if (i === n - 1) { d1x = d0x; d1z = d0z; }
      // miter
      let mx = -(d0z + d1z), mz = d0x + d1x;
      const ml = Math.hypot(mx, mz) || 1;
      mx /= ml; mz /= ml;
      const dot = mx * -d1z + mz * d1x;
      const L = HALF_W / Math.max(0.5, dot);
      const dist = nearChip(p[0], p[1]);
      const br = (0.6 + 1.7 * Math.exp(-dist / 0.9)) * (t.kind === 'walk' ? 0.7 : t.kind === 'fan' ? 1.25 : 1);
      for (const s of [-1, 1]) {
        pos.push(p[0] + mx * L * s, Y, p[1] + mz * L * s);
        side.push(s);
        col.push(c.r, c.g, c.b);
        bright.push(br);
      }
      if (i < n - 1) {
        const v = base + i * 2;
        idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aSide', new BufferAttribute(new Float32Array(side), 1));
  g.setAttribute('aColor', new BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('aBright', new BufferAttribute(new Float32Array(bright), 1));
  g.setIndex(idx);
  return g;
};

export const Traces = () => {
  const geometry = useMemo(buildGeometry, []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uCore: { value: CORE } },
        vertexShader: /* glsl */ `
          attribute float aSide;
          attribute vec3 aColor;
          attribute float aBright;
          varying float vSide;
          varying vec3 vColor;
          varying float vBright;
          varying float vDist;
          void main() {
            vSide = aSide;
            vColor = aColor;
            vBright = aBright;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vDist = distance(wp.xyz, cameraPosition);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uCore;
          varying float vSide;
          varying vec3 vColor;
          varying float vBright;
          varying float vDist;
          ${FOG_GLSL}
          void main() {
            float d = abs(vSide);
            float px = max(fwidth(vSide), 1e-4);
            // anti-aliased core; thinner than a pixel → keep energy, lower peak
            float core = clamp((uCore - d) / px + 0.5, 0.0, 1.0) * min(1.0, 2.0 * uCore / px);
            float glow = exp(-d * d * 7.0) * 0.22;
            vec3 c = vColor * vBright * (core * 1.6 + glow * 1.2);
            gl_FragColor = vec4(c * distFade(vDist), 1.0);
          }`,
      }),
    [],
  );
  return <mesh geometry={geometry} material={material} renderOrder={2} />;
};
