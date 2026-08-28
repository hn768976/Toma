import { Composition } from "remotion";
import { IconField } from "./icon-field/IconField";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="LockFieldBreach"
      component={IconField}
      durationInFrames={450}
      fps={30}
      width={3840}
      height={2160}
    />
  );
};
