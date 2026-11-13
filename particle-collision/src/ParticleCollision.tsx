import { AbsoluteFill } from "remotion";
import { HudOverlay } from "./hud/HudOverlay";
import { loadHudFont } from "./lib/font";
import { Variant } from "./scene/camera";
import { ParticleField } from "./scene/ParticleField";

loadHudFont();

export type ParticleCollisionProps = { variant: Variant };

export const ParticleCollision: React.FC<ParticleCollisionProps> = ({ variant }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ParticleField variant={variant} />
      <HudOverlay />
      
    </AbsoluteFill>
  );
};
