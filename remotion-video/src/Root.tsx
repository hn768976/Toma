import "./index.css";
import { Composition } from "remotion";
import { ChatBubbles } from "./chat-bubbles/ChatBubbles";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./chat-bubbles/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ChatBubbles"
        component={ChatBubbles}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
