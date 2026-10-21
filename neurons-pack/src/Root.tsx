import { Composition } from "remotion";
import { DataServer_City, DataServer_Dark } from "./scenes/city/DataServer";
import { PROXIMITY_FRAMES, ProximityApp_City, ProximityApp_GreenScreen } from "./scenes/city/ProximityApp";
import { FlightTrails_FlatNavy } from "./scenes/flights/FlightTrails";
import { InkCloth_White } from "./scenes/ink/InkCloth";
import { ANATOMY_FRAMES, NeuronAnatomy_Clean, NeuronAnatomy_Labelled } from "./scenes/neuron/NeuronAnatomy";
import { NeuronNetwork_Silver } from "./scenes/neuron/NeuronNetwork";
import { TangledThreads_Ink, TangledThreads_White } from "./scenes/threads/TangledThreads";

const FPS = 30;
const W = 3840;
const H = 2160;
const LOOP = 600;

// Remotion ids allow only a-z, 0-9 and "-": `NeuronNetwork-Silver` renders
// to NeuronNetwork_Silver.mp4 (see README).

type LoopProps = { loopCheck: boolean };
/** Loops are 600 frames; with {"loopCheck": true} they get frame 600 too. */
const loopMeta = ({ props }: { props: LoopProps }) => ({ durationInFrames: props.loopCheck ? LOOP + 1 : LOOP });

const loops: [string, React.FC][] = [
  ["NeuronNetwork-Silver", NeuronNetwork_Silver],
  ["FlightTrails-FlatNavy", FlightTrails_FlatNavy],
  ["DataServer-City", DataServer_City],
  ["DataServer-Dark", DataServer_Dark],
  ["InkCloth-White", InkCloth_White],
];

export const RemotionRoot: React.FC = () => (
  <>
    {loops.map(([id, C]) => (
      <Composition
        key={id}
        id={id}
        component={C as React.FC<LoopProps>}
        durationInFrames={LOOP}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ loopCheck: false }}
        calculateMetadata={loopMeta}
      />
    ))}
    <Composition id="NeuronAnatomy-Labelled" component={NeuronAnatomy_Labelled} durationInFrames={ANATOMY_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="NeuronAnatomy-Clean" component={NeuronAnatomy_Clean} durationInFrames={ANATOMY_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="ProximityApp-City" component={ProximityApp_City} durationInFrames={PROXIMITY_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="ProximityApp-GreenScreen" component={ProximityApp_GreenScreen} durationInFrames={PROXIMITY_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="TangledThreads-White" component={TangledThreads_White} durationInFrames={510} fps={FPS} width={W} height={H} />
    <Composition id="TangledThreads-Ink" component={TangledThreads_Ink} durationInFrames={510} fps={FPS} width={W} height={H} />
  </>
);
