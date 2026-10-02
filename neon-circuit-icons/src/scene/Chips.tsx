import { useMemo } from 'react';
import { AdditiveBlending, Color, PlaneGeometry, ShaderMaterial } from 'three';
import { BOARD, TEAL } from './layout';
import { FOG_GLSL } from './glsl';

// Connector chips: elongated rounded capsules with rows of small pins,
// outlined in glowing teal. Drawn as an SDF on one flat quad each.

const MARGIN = 0.35;

const material = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uSize: { value: [1, 1] },
      uLen: { value: 1 },
      uRad: { value: 0.1 },
      uPins: { value: 9 },
      uPitch: { value: 0.14 },
      uCol: { value: new Color(TEAL) },
    },
    vertexShader: /* glsl */ `
      uniform vec2 uSize;
      varying vec2 vP;
      varying float vDist;
      void main() {
        vP = vec2(position.x * uSize.x, -position.y * uSize.y); // x across, y along the chip (board z)
        vec4 wp = modelMatrix * vec4(position.x * uSize.x, 0.0, -position.y * uSize.y, 1.0);
        vDist = distance(wp.xyz, cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLen;
      uniform float uRad;
      uniform float uPins;
      uniform float uPitch;
      uniform vec3 uCol;
      varying vec2 vP;
      varying float vDist;
      ${FOG_GLSL}
      float sdStadium(vec2 p, float h, float r) {
        return length(vec2(p.x, max(abs(p.y) - h, 0.0))) - r;
      }
      void main() {
        float lw = 0.0055;
        float h = uLen * 0.5 - uRad;
        float s = sdStadium(vP, h, uRad);
        float d = abs(s) - lw;
        d = min(d, abs(s + 0.05) - lw * 0.8);
        // pins on both long sides
        float mid = (uPins - 1.0) * 0.5;
        float iy = clamp(floor(vP.y / uPitch + mid + 0.5), 0.0, uPins - 1.0);
        float py = (iy - mid) * uPitch;
        vec2 q = vec2(abs(vP.x) - (uRad + 0.04), vP.y - py);
        float box = max(abs(q.x) - 0.026, abs(q.y) - 0.022);
        d = min(d, abs(box) - lw * 0.8);
        float aa = max(fwidth(d), 1e-4);
        float core = clamp(-d / aa + 0.5, 0.0, 1.0) * min(1.0, 2.0 * lw / aa);
        float glow = exp(-max(d, 0.0) / 0.02) * 0.28;
        gl_FragColor = vec4(uCol * (core * 1.5 + glow * 0.85) * distFade(vDist), 1.0);
      }`,
  });

export const Chips = () => {
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const items = useMemo(
    () =>
      BOARD.chips.map((c) => {
        const m = material();
        m.uniforms.uSize.value = [c.width + MARGIN * 2, c.length + MARGIN * 2];
        m.uniforms.uLen.value = c.length;
        m.uniforms.uRad.value = c.width / 2;
        m.uniforms.uPins.value = c.pins;
        m.uniforms.uPitch.value = c.pitch;
        return { c, m };
      }),
    [],
  );
  return (
    <group>
      {items.map(({ c, m }, i) => (
        <mesh key={i} geometry={geometry} material={m} position={[c.x, 0.005, c.z]} renderOrder={3} />
      ))}
    </group>
  );
};
