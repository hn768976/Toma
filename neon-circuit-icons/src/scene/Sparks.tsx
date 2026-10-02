import { useMemo } from 'react';
import {
  AdditiveBlending, Color, InstancedBufferAttribute, InstancedBufferGeometry, PlaneGeometry, ShaderMaterial,
} from 'three';
import { BLUE, BOARD, TEAL, sampleTrace } from './layout';
import { wrap1, smoothstep } from '../lib/loop';
import { FOG_GLSL } from './glsl';

// Sparks travelling along traces toward the icon:
// u = wrap(u0 + k·t, 1), k a whole number → exact loop. Fade in/out at ends.

const LEN = 0.3;
const WID = 0.075;

export const Sparks = ({ t }: { t: number }) => {
  const n = BOARD.sparks.length;
  const { geometry, posAttr, dirAttr } = useMemo(() => {
    const base = new PlaneGeometry(1, 1);
    const g = new InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.getAttribute('position'));
    g.setAttribute('uv', base.getAttribute('uv'));
    const posAttr = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
    const dirAttr = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
    g.setAttribute('aPos', posAttr);
    g.setAttribute('aDir', dirAttr);
    g.instanceCount = n;
    return { geometry: g, posAttr, dirAttr };
  }, [n]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {},
        vertexShader: /* glsl */ `
          attribute vec4 aPos; // x, z, alpha, size
          attribute vec4 aDir; // dx, dz, r/g/b packed below
          varying vec2 vUv2;
          varying float vAlpha;
          varying float vTeal;
          varying float vDist;
          void main() {
            vec2 dir = aDir.xy;
            vec2 perp = vec2(-dir.y, dir.x);
            float len = ${LEN.toFixed(3)} * aPos.w;
            float wid = ${WID.toFixed(3)} * aPos.w;
            // head at the sample point, tail behind it
            vec2 c = aPos.xy - dir * len * 0.5;
            vec2 p = c + dir * position.x * len + perp * position.y * wid;
            vec3 wp = vec3(p.x, 0.006, p.y);
            vUv2 = vec2(position.x + 0.5, position.y * 2.0);
            vAlpha = aPos.z;
            vTeal = aDir.z;
            vDist = distance(wp, cameraPosition);
            gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv2;
          varying float vAlpha;
          varying float vTeal;
          varying float vDist;
          ${FOG_GLSL}
          void main() {
            float x = vUv2.x;
            float y = vUv2.y;
            float tail = pow(x, 2.2) * exp(-y * y * 9.0);
            float head = exp(-((x - 0.86) * (x - 0.86) * 90.0 + y * y * 14.0));
            vec3 teal = vec3(${new Color(TEAL).toArray().map((v) => v.toFixed(4)).join(',')});
            vec3 blue = vec3(${new Color(BLUE).toArray().map((v) => v.toFixed(4)).join(',')});
            vec3 col = mix(blue, teal, vTeal);
            vec3 c = col * tail * 6.0 + mix(col, vec3(1.0), 0.45) * head * 30.0;
            gl_FragColor = vec4(c * vAlpha * distFade(vDist), 1.0);
          }`,
      }),
    [],
  );

  // Positions are a pure function of t — written into the instance buffers.
  const pa = posAttr.array as Float32Array;
  const da = dirAttr.array as Float32Array;
  BOARD.sparks.forEach((s, i) => {
    const tr = BOARD.traces[s.trace];
    const u = wrap1(s.u0 + s.k * t);
    const p = sampleTrace(tr, u);
    const fade = smoothstep(0.0, 0.08, u) * (1 - smoothstep(0.86, 1.0, u));
    pa[i * 4] = p.x;
    pa[i * 4 + 1] = p.z;
    pa[i * 4 + 2] = fade;
    pa[i * 4 + 3] = s.size;
    da[i * 4] = p.dx;
    da[i * 4 + 1] = p.dz;
    da[i * 4 + 2] = s.color === 0 ? 1 : 0;
    da[i * 4 + 3] = 0;
  });
  posAttr.needsUpdate = true;
  dirAttr.needsUpdate = true;

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={4} />;
};
