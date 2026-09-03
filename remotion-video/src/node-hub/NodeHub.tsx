/**
 * "Node network hub" — one composition, three variants.
 *
 * Everything that differs between the three versions comes from the
 * VariantConfig looked up here: the palette, the centre element, the satellite
 * layout MODE and count, the icon set, the label and the side-panel density.
 * The component tree below is identical for all three.
 *
 * Layer order, bottom to top:
 *   StarField      dark field, wash, stars, drifting bokeh
 *   SidePanel[]    the side chrome
 *   SatelliteLayout   connectors and travelling dots, then the icon nodes
 *   CentreHub      the ring assembly and the centre element
 *   LabelPlate     the piece's title, when the variant has one
 *   FinishPass     vignette and grain
 *
 * Motion is driven only by useCurrentFrame(). No Date.now(), no rAF, no CSS
 * animation, no component state — every frame is a pure function of its
 * number, so `npx remotion render` is deterministic and frames can be
 * rendered out of order across workers.
 *
 * The loop closes: rotations advance whole symmetry periods across the 450
 * frames and every pulse, reroll and travelling dot has a period dividing 450,
 * so frame 0 and frame 450 are pixel-identical.
 */
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import { CENTRE_X, CENTRE_Y, FRAME_H, FRAME_W, HUB_RADIUS } from "./constants";
import { buildPanels } from "./panels";
import { VARIANTS, type VariantId } from "./variants";
import { CentreHub } from "./components/CentreHub";
import { FinishPass } from "./components/FinishPass";
import { LabelPlate } from "./components/LabelPlate";
import { SatelliteLayout } from "./components/SatelliteLayout";
import { SidePanel } from "./components/SidePanel";
import { StarField } from "./components/StarField";

export type NodeHubProps = {
  variant: VariantId;
};

export const NodeHub: React.FC<NodeHubProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const config = VARIANTS[variant];

  // Geometry is authored at 4K. A composition rendered at another size scales
  // uniformly, so the layout is identical at any output resolution.
  const scale = Math.min(width / FRAME_W, height / FRAME_H);
  const centreX = CENTRE_X;
  const centreY = CENTRE_Y;

  const panels = useMemo(
    () =>
      buildPanels({
        chrome: config.chrome,
        width: FRAME_W,
        height: FRAME_H,
        seed: `${config.id}/panels`,
        // Keep the corner the label sits in clear of chrome.
        reserveBottomLeft:
          config.label?.anchor === "lower-left" ? 260 : 0,
        reserveBottomRight:
          config.label?.anchor === "lower-right" ? 300 : 0,
      }),
    [config],
  );

  // The chrome is laid out first so satellites can be kept off it.
  const panelRects = useMemo(
    () => panels.map(({ x, y, w, h }) => ({ x, y, w, h })),
    [panels],
  );

  return (
    <div
      style={{
        width,
        height,
        overflow: "hidden",
        backgroundColor: config.palette.bgDeep,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: FRAME_W,
          height: FRAME_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <StarField
          palette={config.palette}
          frame={frame}
          width={FRAME_W}
          height={FRAME_H}
          seed={`${config.id}/stars`}
        />

        {panels.map((panel) => (
          <SidePanel
            key={panel.id}
            panel={panel}
            palette={config.palette}
            frame={frame}
          />
        ))}

        <SatelliteLayout
          mode={config.layout.mode}
          count={config.layout.count}
          icons={config.icons}
          palette={config.palette}
          frame={frame}
          centreX={centreX}
          centreY={centreY}
          hubRadius={HUB_RADIUS}
          width={FRAME_W}
          height={FRAME_H}
          seed={`${config.id}/layout`}
          exclusions={panelRects}
        />

        <CentreHub
          palette={config.palette}
          centre={config.centre}
          frame={frame}
          centreX={centreX}
          centreY={centreY}
          width={FRAME_W}
          height={FRAME_H}
          seed={`${config.id}/hub`}
        />

        {config.label ? (
          <LabelPlate
            label={config.label}
            palette={config.palette}
            width={FRAME_W}
            height={FRAME_H}
          />
        ) : null}

        <FinishPass
          palette={config.palette}
          frame={frame}
          width={FRAME_W}
          height={FRAME_H}
        />
      </div>
    </div>
  );
};
