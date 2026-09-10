import { Composition } from "remotion";
import { ContactSheet, SHEET_SIZE } from "./ContactSheet";
import { TradingMacro } from "./TradingMacro";

/**
 * Stills, not video: durationInFrames is 1 and nothing in the project reads
 * the frame number. 3840x2560 is 3:2, the ratio the reference frames use and
 * the one that suits editorial and print use for financial imagery.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="TradingMacro"
      component={TradingMacro}
      durationInFrames={1}
      fps={30}
      width={3840}
      height={2560}
      defaultProps={{ composition: "t01", palette: "cyanNavy" }}
    />
    <Composition
      id="ContactSheet"
      component={ContactSheet}
      durationInFrames={1}
      fps={30}
      width={SHEET_SIZE.width}
      height={SHEET_SIZE.height}
    />
  </>
);
