import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { FPS, LOOP } from "./lib/loop";
import { SecurityDashboard } from "./looks/dashboard/Dashboard";
import { DASH_DARK, DASH_LIGHT } from "./looks/dashboard/theme";
import { HUD_AMBER, HUD_WHITE, MinimalHud } from "./looks/hud/Hud";
import { AiInterfaceAssistant, AiInterfaceCode } from "./looks/ai/AiInterfaces";
import { AI_BLUE, AI_MONO } from "./looks/ai/theme";
import { PAD_BREACH, PAD_SECURE, PadlockGrid } from "./looks/padlock/PadlockGrid";

// Compositions are defined at 3840x2160. Everything inside is drawn on a
// 1920x1080 SVG viewBox scaled to the composition, so any --scale works.
const WIDTH = 3840;
const HEIGHT = 2160;

type LoopProps = {
  /** Loop check: true makes the composition 601 frames so frame 600 can be rendered and compared with frame 0. */
  loopCheck: boolean;
};

const calc: CalculateMetadataFunction<LoopProps> = ({ props }) => ({
  durationInFrames: props.loopCheck ? LOOP + 1 : LOOP,
});

const COMPS: { id: string; render: () => React.ReactElement }[] = [
  { id: "SecurityDashboard-Dark", render: () => <SecurityDashboard th={DASH_DARK} /> },
  { id: "SecurityDashboard-Light", render: () => <SecurityDashboard th={DASH_LIGHT} /> },
  { id: "MinimalHUD-White", render: () => <MinimalHud th={HUD_WHITE} /> },
  { id: "MinimalHUD-Amber", render: () => <MinimalHud th={HUD_AMBER} /> },
  { id: "AIInterfaceCode-Mono", render: () => <AiInterfaceCode th={AI_MONO} /> },
  { id: "AIInterfaceCode-Blue", render: () => <AiInterfaceCode th={AI_BLUE} /> },
  { id: "PadlockGrid-Secure", render: () => <PadlockGrid th={PAD_SECURE} /> },
  { id: "PadlockGrid-Breach", render: () => <PadlockGrid th={PAD_BREACH} /> },
  { id: "AIInterfaceAssistant-Mono", render: () => <AiInterfaceAssistant th={AI_MONO} /> },
  { id: "AIInterfaceAssistant-Blue", render: () => <AiInterfaceAssistant th={AI_BLUE} /> },
];

export const RemotionRoot: React.FC = () => (
  <>
    {COMPS.map((c) => {
      const C: React.FC<LoopProps> = () => c.render();
      return (
        <Composition
          key={c.id}
          id={c.id}
          component={C}
          durationInFrames={LOOP}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ loopCheck: false }}
          calculateMetadata={calc}
        />
      );
    })}
  </>
);
