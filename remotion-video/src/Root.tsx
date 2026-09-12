import "./index.css";
import "./load-fonts";
import { Composition } from "remotion";
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
import {
  ColorGradeDashboard,
  colorGradeSchema,
  colorGradeDefaults,
} from "./color-grade/ColorGradeDashboard";
import {
  BASE_WIDTH as GRADE_WIDTH,
  BASE_HEIGHT as GRADE_HEIGHT,
  DURATION_IN_FRAMES as GRADE_DURATION,
  FPS as GRADE_FPS,
} from "./color-grade/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
      {/* Colour-grading dashboard. Two framings of the same suite; each
          is registered at 1080p for delivery and at 4K as the master.
          The 4K entries differ only by resolutionScale, so the two can
          never drift apart. */}
      {(["a", "b"] as const).map((variant) =>
        [1, 2].map((scale) => (
          <Composition
            key={`${variant}-${scale}`}
            id={`ColorGrade${variant.toUpperCase()}${scale === 2 ? "4K" : "1080p"}`}
            component={ColorGradeDashboard}
            durationInFrames={GRADE_DURATION}
            fps={GRADE_FPS}
            width={GRADE_WIDTH * scale}
            height={GRADE_HEIGHT * scale}
            schema={colorGradeSchema}
            defaultProps={{ ...colorGradeDefaults, variant, resolutionScale: scale }}
          />
        )),
      )}
    </>
  );
};
