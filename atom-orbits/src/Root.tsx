import { Composition, getInputProps } from "remotion";
import { FPS, LOOP_FRAMES } from "./lib/loop";
import { classicLook } from "./looks/classic";
import { energyLook } from "./looks/energy";
import { wispLook } from "./looks/wisp";
import { AtomScene, type SceneProps } from "./scene/AtomScene";
import { buildModel } from "./scene/model";

// Built once at module level from each look's seed — never at render time.
const classicModel = buildModel(classicLook);
const energyModel = buildModel(energyLook);
const wispModel = buildModel(wispLook);

const Classic: React.FC<SceneProps> = ({ disable }) => <AtomScene model={classicModel} disable={disable} />;
const Energy: React.FC<SceneProps> = ({ disable }) => <AtomScene model={energyModel} disable={disable} />;
const Wisp: React.FC<SceneProps> = ({ disable }) => <AtomScene model={wispModel} disable={disable} />;

// Loop check: --props='{"loopCheck":true}' makes every composition 601 frames
// so frame 600 can be rendered and compared with frame 0.
const extra = (getInputProps() as { loopCheck?: boolean }).loopCheck ? 1 : 0;

const common = {
  durationInFrames: LOOP_FRAMES + extra,
  fps: FPS,
  width: 3840,
  height: 2160,
  defaultProps: { disable: [] as string[] },
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ClassicAtom" component={Classic} {...common} />
    <Composition id="EnergyAtom" component={Energy} {...common} />
    <Composition id="WispAtom" component={Wisp} {...common} />
  </>
);
