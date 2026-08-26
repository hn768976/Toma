import "./index.css";
import { Composition } from "remotion";
import { ChatBubbles } from "./chat-bubbles/ChatBubbles";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./chat-bubbles/constants";
import { ChatBubblesV2 } from "./chat-bubbles-v2/ChatBubblesV2";
import {
  DURATION_IN_FRAMES as V2_DURATION_IN_FRAMES,
  FPS as V2_FPS,
  HEIGHT as V2_HEIGHT,
  WIDTH as V2_WIDTH,
} from "./chat-bubbles-v2/constants";

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
      <Composition
        id="ChatBubblesV2"
        component={ChatBubblesV2}
        durationInFrames={V2_DURATION_IN_FRAMES}
        fps={V2_FPS}
        width={V2_WIDTH}
        height={V2_HEIGHT}
      />
    </>
  );
};
