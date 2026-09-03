import React from "react";
import {useCurrentFrame} from "remotion";
import {CONFIG, HEIGHT, WIDTH} from "../config";
import type {Callout, Node} from "../scene/geometry";
import type {Theme} from "../theme";
import {CalloutLabel} from "./CalloutLabel";
import {NodeMarker} from "./NodeMarker";

/**
 * The vector overlay: node markers, their callout labels, and a blurred copy of
 * the node cores that supplies their bloom.
 *
 * Kept in one SVG so the whole overlay sits at a single point in the stacking
 * order and inherits the push-in transform along with the canvas layers.
 */
export const OverlayLayer: React.FC<{
  theme: Theme;
  nodes: Node[];
  callouts: Callout[];
}> = ({theme, nodes, callouts}) => {
  const frame = useCurrentFrame();

  return (
    <>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{position: "absolute", inset: 0, width: "100%", height: "100%"}}
      >
        {callouts.map((c, i) => (
          <CalloutLabel
            key={i}
            callout={c}
            index={i}
            node={nodes[c.nodeIndex]}
            theme={theme}
            frame={frame}
          />
        ))}
        {nodes.map((n, i) => (
          <NodeMarker key={i} node={n} index={i} theme={theme} frame={frame} />
        ))}
      </svg>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          filter: `blur(${CONFIG.finish.nodeBloomBlur}px)`,
          mixBlendMode: "screen",
          opacity: CONFIG.finish.nodeBloomOpacity,
          pointerEvents: "none",
        }}
      >
        {nodes.map((n, i) => (
          <NodeMarker key={i} node={n} index={i} theme={theme} frame={frame} coreOnly />
        ))}
      </svg>
    </>
  );
};
