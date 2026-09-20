import "./index.css";
import "./load-fonts";
import { Composition } from "remotion";
import {
  CodeCity,
  codeCitySchema,
} from "./ai-code/CodeCity";
import {
  CodeWall,
  codeWallSchema,
  codeWallDefaults,
} from "./ai-code/CodeWall";
import {
  AiNetwork,
  aiNetworkSchema,
  aiNetworkDefaults,
} from "./ai-code/AiNetwork";
import {
  FPS as AI_FPS,
  DURATION_IN_FRAMES as AI_DURATION,
  BASE_WIDTH as AI_WIDTH,
  BASE_HEIGHT as AI_HEIGHT,
} from "./ai-code/constants";
import {
  BluetoothExplainer,
  bluetoothExplainerSchema,
  bluetoothExplainerDefaultProps,
} from "./BluetoothExplainer";
import { DURATION_IN_FRAMES, FPS, WIDTH, HEIGHT } from "./constants";
import {
  ParticleRingHalo,
  particleRingHaloSchema,
  particleRingHaloDefaults,
} from "./particle-ring/ParticleRingHalo";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
} from "./particle-ring/constants";

// V1, V4 and V5 are the same composition with different props. V4 and
// V5 are both code-only: V4 keeps the blue syntax and sits on a deeper
// grade, V5 keeps V1's grade and turns the syntax green.
const CODE_PLATES = [
  { id: "AiCodeCity", showCards: true, codeTheme: "vivid", grade: "blue" },
  { id: "AiCodeDark", showCards: false, codeTheme: "vivid", grade: "deepBlue" },
  { id: "AiCodeGreen", showCards: false, codeTheme: "green", grade: "green" },
] as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {CODE_PLATES.flatMap(({ id, ...variant }) =>
        ([1, 2] as const).map((resolutionScale) => (
          <Composition
            key={`${id}-${resolutionScale}`}
            id={resolutionScale === 1 ? id : `${id}4K`}
            component={CodeCity}
            durationInFrames={AI_DURATION}
            fps={AI_FPS}
            width={AI_WIDTH * resolutionScale}
            height={AI_HEIGHT * resolutionScale}
            schema={codeCitySchema}
            defaultProps={{ ...variant, resolutionScale }}
          />
        )),
      )}
      <Composition
        id="BluetoothExplainer"
        component={BluetoothExplainer}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={bluetoothExplainerSchema}
        defaultProps={bluetoothExplainerDefaultProps}
      />
      <Composition
        id="ParticleRingHalo"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={particleRingHaloSchema}
        defaultProps={particleRingHaloDefaults}
      />
      <Composition
        id="ParticleRingHalo4K"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={BASE_WIDTH * 2}
        height={BASE_HEIGHT * 2}
        schema={particleRingHaloSchema}
        defaultProps={{ ...particleRingHaloDefaults, resolutionScale: 2 }}
      />
      <Composition
        id="AiCodeWall"
        component={CodeWall}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH}
        height={AI_HEIGHT}
        schema={codeWallSchema}
        defaultProps={codeWallDefaults}
      />
      <Composition
        id="AiCodeWall4K"
        component={CodeWall}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH * 2}
        height={AI_HEIGHT * 2}
        schema={codeWallSchema}
        defaultProps={{ resolutionScale: 2 as const }}
      />
      <Composition
        id="AiNetwork"
        component={AiNetwork}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH}
        height={AI_HEIGHT}
        schema={aiNetworkSchema}
        defaultProps={aiNetworkDefaults}
      />
      <Composition
        id="AiNetwork4K"
        component={AiNetwork}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH * 2}
        height={AI_HEIGHT * 2}
        schema={aiNetworkSchema}
        defaultProps={{ resolutionScale: 2 as const }}
      />
    </>
  );
};
