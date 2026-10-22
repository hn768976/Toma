import { Composition } from "remotion";
import {
  FinanceDashboard,
  financeDashboardSchema,
} from "./dashboard/FinanceDashboard";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./dashboard/constants";

// Both compositions are authored at 4K UHD (3840x2160, 30 fps, 12 s).
// Render the 1080p deliverables with `--scale=0.5`.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FinanceDashboard"
        component={FinanceDashboard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={financeDashboardSchema}
        defaultProps={{ palette: "ocean" as const, camera: "reference" as const }}
      />
      <Composition
        id="FinanceDashboardEmber"
        component={FinanceDashboard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={financeDashboardSchema}
        defaultProps={{ palette: "ember" as const, camera: "reference" as const }}
      />
    </>
  );
};
