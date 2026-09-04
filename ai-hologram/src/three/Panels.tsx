import { useMemo } from "react";
import * as THREE from "three";
import { getPanelTextures, PANEL_SPECS } from "../lib/uiTextures";
import { hexToRgb } from "../lib/color";
import { PANELS } from "./layout";
import type { Palette } from "../palettes";

/**
 * Floating UI panels: abstract interface texture only — no readable words, no
 * numbers that imply real data, no marks. Everything reads at a scale where it
 * is clearly chrome rather than content.
 *
 * Each panel arrives on a horizontal wipe with a hot leading edge, then breathes
 * in and out on its own slow cycle for the rest of the run.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uFill;
uniform vec3 uInk;
uniform float uWipe;
uniform float uAlpha;
varying vec2 vUv;

void main() {
  vec4 s = texture2D(uMap, vUv);
  float x = vUv.x;
  float on = 1.0 - smoothstep(uWipe - 0.09, uWipe, x);
  float k = (uWipe - x) / 0.03;
  float edge = exp(-k * k) * step(x, uWipe + 0.001);
  if (uWipe >= 0.999) { on = 1.0; edge = 0.0; }

  float mask = clamp(s.r * 3.0 + s.g, 0.0, 1.0);
  vec3 col = uFill * s.r * 0.8 + uInk * s.g;
  col = col * on + uInk * edge * mask * 1.5;
  gl_FragColor = vec4(col * uAlpha, 1.0);
}
`;

export type PanelFrameState = {
  wipe: number;
  alpha: number;
  offsetY: number;
  offsetR: number;
};

export const Panels: React.FC<{ palette: Palette; states: readonly PanelFrameState[] }> = ({
  palette,
  states,
}) => {
  const textures = getPanelTextures();

  const materials = useMemo(() => {
    const fill = hexToRgb(palette.panel);
    const ink = hexToRgb(palette.panel);
    return textures.map(
      (tex) =>
        new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          uniforms: {
            uMap: { value: tex },
            uFill: { value: new THREE.Vector3(fill.r * 0.38, fill.g * 0.42, fill.b * 0.55) },
            uInk: { value: new THREE.Vector3(ink.r * 1.25, ink.g * 1.25, ink.b * 1.25) },
            uWipe: { value: 0 },
            uAlpha: { value: 0 },
          },
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.CustomBlending,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
          blendEquation: THREE.AddEquation,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
    );
  }, [palette, textures]);

  return (
    <>
      {PANELS.map((p, i) => {
        const state = states[i];
        if (state.alpha <= 0.002) return null;
        const mat = materials[i];
        mat.uniforms.uWipe.value = state.wipe;
        mat.uniforms.uAlpha.value = state.alpha;

        const radius = p.radius + state.offsetR;
        const x = Math.cos(p.angle) * radius;
        const z = Math.sin(p.angle) * radius;
        const h = p.width / PANEL_SPECS[i].aspect;
        // Face the platform, then add the panel's own slight yaw and tilt.
        const facing = Math.atan2(x, z);

        return (
          <mesh
            key={p.index}
            material={mat}
            position={[x, p.y + state.offsetY, z]}
            rotation={[p.tilt, facing + p.yaw, 0]}
            renderOrder={25}
            frustumCulled={false}
          >
            <planeGeometry args={[p.width, h, 1, 1]} />
          </mesh>
        );
      })}
    </>
  );
};
