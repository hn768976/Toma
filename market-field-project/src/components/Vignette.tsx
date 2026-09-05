import { AbsoluteFill } from "remotion";

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 78% 74% at 50% 50%, rgba(0, 0, 0, 0) 42%, rgba(0, 0, 0, 0.38) 76%, rgba(0, 0, 0, 0.72) 100%)",
    }}
  />
);
