import { useMemo } from 'react';
import {
  AdditiveBlending, Color, InstancedBufferAttribute, InstancedBufferGeometry, PlaneGeometry, ShaderMaterial,
} from 'three';
import { BLUE, BOARD, PINK, TEAL } from './layout';
import { FOG_GLSL } from './glsl';

// Pads, vias and the LED dot field. Instanced; blinking is computed in the
// shader from uT = frame/600 with whole-number cycle counts per loop.

export const Pads = ({ t }: { t: number }) => {
  const geometry = useMemo(() => {
    const base = new PlaneGeometry(1, 1);
    const g = new InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.getAttribute('position'));
    g.setAttribute('uv', base.getAttribute('uv'));
    const n = BOARD.pads.length;
    const a = new Float32Array(n * 4);
    const b = new Float32Array(n * 4);
    BOARD.pads.forEach((p, i) => {
      a.set([p.x, p.z, p.r, p.base], i * 4);
      b.set([p.color, p.square ? 1 : 0, p.blinkK, p.phase], i * 4);
    });
    g.setAttribute('aA', new InstancedBufferAttribute(a, 4));
    g.setAttribute('aB', new InstancedBufferAttribute(b, 4));
    g.instanceCount = n;
    return g;
  }, []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uT: { value: 0 },
          uColors: { value: [new Color(TEAL), new Color(BLUE), new Color(PINK)] },
        },
        vertexShader: /* glsl */ `
          attribute vec4 aA;
          attribute vec4 aB;
          uniform float uT;
          uniform vec3 uColors[3];
          varying vec2 vQ;
          varying vec3 vCol;
          varying float vSquare;
          varying float vDist;
          void main() {
            float r = aA.z;
            float ext = r * 5.0;
            vec3 wp = vec3(aA.x + position.x * 2.0 * ext, 0.004, aA.y - position.y * 2.0 * ext);
            vQ = position.xy * 2.0 * 5.0; // in units of r
            float k = aB.z;
            float pulse = 0.5 + 0.5 * sin(6.283185307 * (k * uT + aB.w));
            float blink = k > 0.5 ? mix(0.12, 1.7, pulse * pulse * pulse) : 1.0;
            int ci = int(aB.x + 0.5);
            vCol = uColors[ci] * aA.w * blink;
            vSquare = aB.y;
            vDist = distance(wp, cameraPosition);
            gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec2 vQ;
          varying vec3 vCol;
          varying float vSquare;
          varying float vDist;
          ${FOG_GLSL}
          void main() {
            float d = mix(length(vQ), max(abs(vQ.x), abs(vQ.y)) * 1.1, vSquare);
            float aa = max(fwidth(d), 1e-3);
            float core = clamp((1.0 - d) / aa + 0.5, 0.0, 1.0) * min(1.0, 1.5 / aa);
            float glow = exp(-d * d * 0.45) * 0.35;
            gl_FragColor = vec4(vCol * (core * 1.6 + glow) * distFade(vDist), 1.0);
          }`,
      }),
    [],
  );
  material.uniforms.uT.value = t;
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
};
