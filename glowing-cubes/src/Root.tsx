import React from "react";
import { Composition, Folder } from "remotion";
import { CubeAssembly } from "./assembly/CubeAssembly";
import { ASSEMBLY_FRAMES } from "./assembly/layout";
import { CubeCluster, type CubeClusterProps } from "./cluster/CubeCluster";
import { LOOP } from "./cluster/layout";
import { PALETTES } from "./palettes";

const W = 3840;
const H = 2160;
const FPS = 30;

// Look 2's reference is blue; list blue first there.
const ASSEMBLY_ORDER = ["Blue", "Violet", "Green"];
const assemblyPalettes = [
  ...ASSEMBLY_ORDER.filter((n) => PALETTES.some((p) => p.name === n)),
  ...PALETTES.map((p) => p.name).filter((n) => !ASSEMBLY_ORDER.includes(n)),
];

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Look1-CubeCluster">
      {PALETTES.map((p) => (
        <Composition
          key={p.name}
          id={`CubeCluster-${p.name}`}
          component={CubeCluster}
          durationInFrames={LOOP}
          fps={FPS}
          width={W}
          height={H}
          defaultProps={{ palette: p.name }}
          calculateMetadata={({ props }) => ({
            // debug knob for the loop check: render 601 frames so frame 600 exists
            durationInFrames: (props as CubeClusterProps).loopCheck ? LOOP + 1 : LOOP,
          })}
        />
      ))}
    </Folder>
    <Folder name="Look2-CubeAssembly">
      {assemblyPalettes.map((name) => (
        <Composition
          key={name}
          id={`CubeAssembly-${name}`}
          component={CubeAssembly}
          durationInFrames={ASSEMBLY_FRAMES}
          fps={FPS}
          width={W}
          height={H}
          defaultProps={{ palette: name }}
        />
      ))}
    </Folder>
  </>
);
