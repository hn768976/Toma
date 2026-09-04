import { useMemo } from "react";
import * as THREE from "three";
import { getCardTexture, CARD_ASPECT } from "../lib/uiTextures";
import { AI_CHIP_PINS } from "../lib/aiChipPins";
import { hexToRgb } from "../lib/color";
import { allocSprites, InstancedSprites, SpriteWriter } from "./InstancedSprites";
import { cellUv } from "../lib/atlas";
import type { Palette } from "../palettes";

/**
 * The holographic card standing above the platform.
 *
 * It is a real object in the scene: its yaw is fixed to the middle of the
 * camera's arc, so it reads as facing the viewer while still turning with the
 * world as the camera swings past — the parallax is the point.
 *
 * The card enters by rising out of the platform behind a vertical wipe with a
 * hot leading edge, and the chip icon draws on radially from the centre as it
 * arrives, the legs reaching outward the way the artwork is built.
 */
const CARD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CARD_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uFill;
uniform vec3 uEdge;
uniform float uRise;
uniform float uAlpha;
varying vec2 vUv;

void main() {
  vec4 s = texture2D(uMap, vUv);
  float y = vUv.y;
  float on = 1.0 - smoothstep(uRise - 0.07, uRise, y);
  float k = (uRise - y) / 0.026;
  float edge = exp(-k * k) * step(y, uRise + 0.001);
  if (uRise >= 0.999) { on = 1.0; edge = 0.0; }

  float mask = clamp(s.r * 2.6 + s.g, 0.0, 1.0);
  vec3 col = uFill * s.r * 0.85 + uEdge * s.g * 1.6;
  col = col * on + uEdge * edge * mask * 1.7;
  gl_FragColor = vec4(col * uAlpha, 1.0);
}
`;

const ICON_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uReveal;
uniform float uAlpha;
varying vec2 vUv;

void main() {
  float a = texture2D(uMap, vUv).a;
  float d = length(vUv - 0.5) * 1.41421356;
  float on = 1.0 - smoothstep(uReveal - 0.14, uReveal, d);
  float k = (uReveal - d) / 0.045;
  float edge = exp(-k * k) * step(d, uReveal + 0.001);
  if (uReveal >= 0.999) { on = 1.0; edge = 0.0; }
  float amount = a * (on * 1.0 + edge * 2.2) * uAlpha;
  gl_FragColor = vec4(uColor * amount, 1.0);
}
`;

/** Icon side as a fraction of card width — ~53% of the card's area, legs clear of the border. */
const ICON_FRACTION = 0.78;

export const HoloCard: React.FC<{
  palette: Palette;
  width: number;
  y: number;
  yaw: number;
  alpha: number;
  /** 0..1 vertical wipe as the card rises. */
  rise: number;
  /** 0..1 radial draw-on of the chip icon. */
  iconReveal: number;
  /** Drives the pin lights travelling around the chip. */
  pinT: number;
  /** The keyed chip artwork, rasterised once outside the canvas. */
  iconTexture: THREE.Texture;
}> = ({ palette, width, y, yaw, alpha, rise, iconReveal, pinT, iconTexture }) => {
  const height = width / CARD_ASPECT;
  const iconSide = width * ICON_FRACTION;

  const cardMaterial = useMemo(() => {
    const fill = hexToRgb(palette.ring);
    const edge = hexToRgb(palette.ring);
    return new THREE.ShaderMaterial({
      vertexShader: CARD_VERT,
      fragmentShader: CARD_FRAG,
      uniforms: {
        uMap: { value: getCardTexture() },
        uFill: { value: new THREE.Vector3(fill.r * 0.55, fill.g * 0.62, fill.b * 0.8) },
        uEdge: { value: new THREE.Vector3(edge.r, edge.g, edge.b) },
        uRise: { value: 0 },
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
    });
  }, [palette]);

  const iconMaterial = useMemo(() => {
    const c = hexToRgb(palette.core);
    return new THREE.ShaderMaterial({
      vertexShader: CARD_VERT,
      fragmentShader: ICON_FRAG,
      uniforms: {
        uMap: { value: null },
        uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
        uReveal: { value: 0 },
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
    });
  }, [palette]);

  const pinBuffers = useMemo(() => allocSprites(AI_CHIP_PINS.length), []);

  cardMaterial.uniforms.uRise.value = rise;
  cardMaterial.uniforms.uAlpha.value = alpha;
  iconMaterial.uniforms.uMap.value = iconTexture;
  iconMaterial.uniforms.uReveal.value = iconReveal;
  iconMaterial.uniforms.uAlpha.value = alpha;

  // Pin lights: a signal running around the chip's terminals in sequence, tying
  // the card to the circuit plane underneath it.
  const glowUv = cellUv("glow");
  const core = hexToRgb(palette.core);
  const writer = new SpriteWriter(pinBuffers);
  const n = AI_CHIP_PINS.length;
  AI_CHIP_PINS.forEach(([u, v], i) => {
    const lx = (u - 0.5) * iconSide;
    const ly = (0.5 - v) * iconSide;
    const w = (((pinT - i / n) % 1) + 1) % 1;
    const b = Math.exp(-w * 11) * iconReveal * alpha;
    writer.push(lx, ly, 0.02, iconSide * 0.13, glowUv, [core.r, core.g, core.b], b * 0.85);
  });
  writer.done();

  return (
    <group position={[0, y, 0]} rotation={[0, yaw, 0]}>
      <mesh material={cardMaterial} renderOrder={20} frustumCulled={false}>
        <planeGeometry args={[width, height, 1, 1]} />
      </mesh>
      <mesh material={iconMaterial} position={[0, 0, 0.01]} renderOrder={21} frustumCulled={false}>
        <planeGeometry args={[iconSide, iconSide, 1, 1]} />
      </mesh>
      <InstancedSprites buffers={pinBuffers} capacity={AI_CHIP_PINS.length} renderOrder={22} />
    </group>
  );
};
