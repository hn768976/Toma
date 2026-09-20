/**
 * Ambient-occlusion crease where a plinth meets the ground.
 *
 * The cast shadow is real — PCSS from the key — but a key light alone
 * leaves the crease lit by the fill and the environment, which no real
 * stage does. This darkens the contact the way occlusion would, so the
 * plinth sits on the floor instead of hovering over it. A buyer matching
 * their own product's contact shadow is matching this.
 *
 * Static geometry: nothing here changes between frames, so it cannot
 * introduce a difference between two render threads.
 */
import * as THREE from "three";
import { radialFalloff } from "./textures";

export const ContactAO: React.FC<{
  /** Plinth footprint radius. */
  radius: number;
  /** How far past the footprint the crease fades out, as a multiple of radius. */
  spread?: number;
  strength?: number;
  position?: [number, number, number];
  color?: string;
}> = ({ radius, spread = 1.9, strength = 0.42, position = [0, 0, 0], color = "#000000" }) => (
  <mesh
    position={[position[0], position[1] + 0.004, position[2]]}
    rotation={[-Math.PI / 2, 0, 0]}
    renderOrder={1}
  >
    <planeGeometry args={[radius * 2 * spread, radius * 2 * spread]} />
    <meshBasicMaterial
      map={radialFalloff(2.6)}
      color={color}
      transparent
      opacity={strength}
      depthWrite={false}
      blending={THREE.NormalBlending}
      toneMapped={false}
    />
  </mesh>
);
