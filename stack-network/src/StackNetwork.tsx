import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "./components/Background";
import { Connector } from "./components/Connector";
import { Grain } from "./components/Grain";
import { Node } from "./components/Node";
import { Vignette } from "./components/Vignette";
import { BOARD_HEIGHT, BOARD_WIDTH } from "./lib/constants";
import { loopRange } from "./lib/loop";
import { useBoardScale } from "./lib/scale";
import { VARIANTS, type VariantId } from "./variants";
import "./load-fonts";

/**
 * The whole clip: one network of nodes and dashed connectors on a tilted
 * plane, over a defocused field.
 *
 * Both versions are this component with a different theme, node list and
 * routing style. Everything is a pure function of the current frame --
 * no state, no Math.random() at render time -- because Remotion renders
 * frames out of order across several threads and anything else would
 * produce a different picture depending on which worker got the frame.
 */
export const StackNetwork: React.FC<{ variant: VariantId }> = ({ variant }) => {
  const { theme, scene } = VARIANTS[variant];
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const board = useBoardScale();

  // 0 at the first frame, 1 one frame past the last: frame 0 and frame
  // `durationInFrames` are the same picture, so the clip loops cleanly.
  const progress = frame / durationInFrames;

  // Interleave nodes and connectors into a single back-to-front list, so
  // a defocused shape can sit in front of the network as easily as behind
  // it. Sorted once per scene, not per frame.
  const drawables = useMemo(() => {
    const items: { key: string; layer: number; kind: "node" | "edge"; index: number }[] = [];
    scene.connectors.forEach((c, i) =>
      items.push({
        key: `edge-${c.spec.from}-${c.spec.to}-${i}`,
        layer: c.spec.layer ?? -c.spec.tier - 0.5,
        kind: "edge",
        index: i,
      }),
    );
    scene.nodes.forEach((n, i) =>
      items.push({ key: `node-${n.id}`, layer: n.layer ?? -n.tier, kind: "node", index: i }),
    );
    return items.sort((a, b) => a.layer - b.layer);
  }, [scene]);

  // A slow breath on the plane itself, so the whole picture drifts rather
  // than sitting still behind moving parts. Whole cycles, so it loops.
  const t = theme.board;
  const rotateY = t.rotateY + loopRange(progress, 1, 0, -0.85, 0.85);
  const rotateX = t.rotateX + loopRange(progress, 1, 0.31, -0.6, 0.6);
  const zoom = t.zoom * loopRange(progress, 1, 0.12, 0.994, 1.012);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.base, overflow: "hidden" }}>
      <Background theme={theme} progress={progress} />

      <AbsoluteFill style={{ perspective: t.perspective, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            marginLeft: -BOARD_WIDTH / 2,
            marginTop: -BOARD_HEIGHT / 2,
            // One scale() here is what makes the board resolution
            // independent: children use raw board units for position,
            // stroke width and blur radius, and all of it scales together.
            transform: [
              `translate(${t.translateX}px, ${t.translateY}px)`,
              `scale(${board.fit * zoom})`,
              `rotateZ(${t.rotateZ}deg)`,
              `rotateX(${rotateX}deg)`,
              `rotateY(${rotateY}deg)`,
            ].join(" "),
            transformStyle: "flat",
          }}
        >
          {/* Faint screen hatch, catching the light on the plane itself. */}
          <div
            style={{
              position: "absolute",
              // Overhangs the board so its own edge never crosses the
              // frame once the plane is rotated.
              inset: "-25%",
              opacity: 0.5,
              backgroundImage: `repeating-linear-gradient(118deg, ${theme.dashSoft}0f 0px, ${theme.dashSoft}0f 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 16px)`,
            }}
          />

          {drawables.map((item) =>
            item.kind === "edge" ? (
              <Connector
                key={item.key}
                connector={scene.connectors[item.index]}
                theme={theme}
                progress={progress}
              />
            ) : (
              <Node
                key={item.key}
                node={scene.nodes[item.index]}
                theme={theme}
                progress={progress}
                arrivals={scene.arrivals.get(scene.nodes[item.index].id)}
              />
            ),
          )}
        </div>
      </AbsoluteFill>

      <Grain frame={frame} opacity={theme.grainOpacity} />
      <Vignette gradient={theme.vignette} />
    </AbsoluteFill>
  );
};
