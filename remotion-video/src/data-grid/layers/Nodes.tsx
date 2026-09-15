import { NODES } from "../field";
import { loopSin } from "../loop";
import { type Camera, hazeAt, project } from "../projection";
import type { Theme } from "../theme";

const TIER_ALPHA = [0.75, 0.92, 1];

/** Glowing dots: the bulk of the field's sparkle. */
export const Nodes: React.FC<{
  theme: Theme;
  camera: Camera;
  frame: number;
  s: number;
}> = ({ theme, camera, frame, s }) => {
  const colors = [theme.nodeDim, theme.nodeMid, theme.nodeHot];

  return (
    <>
      {NODES.map((node, i) => {
        const p = project(node.bx, node.by, node.seed, camera);
        if (!p.onScreen || p.fade <= 0.01) return null;

        const twinkle = 1 + node.twinkle * loopSin(frame, 3, node.phase);
        const opacity = p.fade * TIER_ALPHA[node.tier] * hazeAt(p.e) * twinkle;
        if (opacity <= 0.02) return null;

        const size = node.size * p.zoom * s;
        const halo = node.tier === 2 ? 2.4 : node.tier === 1 ? 1.5 : 0.8;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x * s,
              top: p.y * s,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: "50%",
              background: colors[node.tier],
              opacity: Math.min(1, opacity),
              boxShadow: `0 0 ${size * halo}px ${theme.glow}`,
            }}
          />
        );
      })}
    </>
  );
};
