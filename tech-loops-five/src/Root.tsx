import React from "react";
import { Composition } from "remotion";
import "./lib/fonts";
import { FPS, HEIGHT, LOOP, WIDTH } from "./lib/loop";
import { BinaryWord } from "./looks/binary/BinaryWord";
import { SecurityDashboard } from "./looks/dashboard/SecurityDashboard";
import { SoftSpinner } from "./looks/spinner/SoftSpinner";
import { ModelTraining } from "./looks/training/ModelTraining";
import { AICoreTunnel } from "./looks/tunnel/AICoreTunnel";
import { BINARY_VERSIONS, DASHBOARD_VERSIONS, SPINNER_VERSIONS, TRAINING_VERSIONS, TUNNEL_VERSIONS } from "./versions";

/**
 * Every looping composition is 600 frames. Passing --props='{"loopCheck":true}'
 * makes it 601 frames so frame 600 can be rendered and compared with frame 0.
 */
type LoopProps = { loopCheck: boolean };
const loopMeta = ({ props }: { props: LoopProps }) => ({
  durationInFrames: props.loopCheck ? LOOP + 1 : LOOP,
});

const common = { fps: FPS, width: WIDTH, height: HEIGHT, durationInFrames: LOOP } as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {BINARY_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={() => <BinaryWord v={v} />}
          defaultProps={{ loopCheck: false }}
          calculateMetadata={loopMeta}
          {...common}
        />
      ))}
      {SPINNER_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={() => <SoftSpinner v={v} />}
          defaultProps={{ loopCheck: false }}
          calculateMetadata={loopMeta}
          {...common}
        />
      ))}
      {DASHBOARD_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={() => <SecurityDashboard v={v} />}
          defaultProps={{ loopCheck: false }}
          calculateMetadata={loopMeta}
          {...common}
        />
      ))}
      {/* Look 4 is a 600-frame piece, not a loop */}
      {TRAINING_VERSIONS.map((v) => (
        <Composition key={v.id} id={v.id} component={() => <ModelTraining v={v} />} {...common} />
      ))}
      {TUNNEL_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={() => <AICoreTunnel v={v} />}
          defaultProps={{ loopCheck: false }}
          calculateMetadata={loopMeta}
          {...common}
        />
      ))}
    </>
  );
};
