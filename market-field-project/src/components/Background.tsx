import { AbsoluteFill } from "remotion";
import { BACKGROUND } from "../palettes";

/**
 * Near-black field with a very slight lift toward the centre, so the map has
 * something to sit against without ever reading as a light source.
 */
export const Background: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 58% 48% at 50% 44%, rgba(40, 29, 64, 0.36) 0%, rgba(20, 13, 34, 0.16) 48%, rgba(5, 2, 8, 0) 80%)",
      }}
    />
  </AbsoluteFill>
);
