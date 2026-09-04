import React from "react";
import { Composition } from "remotion";
import "./load-fonts";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./constants";
import { PHISHING_ROWS, SPAM_ROWS } from "./data";
import { InboxList, type InboxListProps } from "./InboxList";

const compositions: { id: string; props: InboxListProps }[] = [
  {
    id: "V1-SpamInboxLight",
    props: { rows: SPAM_ROWS, badge: "none", theme: "light", skew: false },
  },
  {
    id: "V2-PhishingInboxLight",
    props: { rows: PHISHING_ROWS, badge: "alert", theme: "light", skew: true },
  },
  {
    id: "V3-SpamInboxDark",
    props: { rows: SPAM_ROWS, badge: "none", theme: "dark", skew: false },
  },
  {
    id: "V4-PhishingInboxDark",
    props: { rows: PHISHING_ROWS, badge: "alert", theme: "dark", skew: true },
  },
];

export const RemotionRoot: React.FC = () => (
  <>
    {compositions.map(({ id, props }) => (
      <Composition
        key={id}
        id={id}
        component={InboxList}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={props}
      />
    ))}
  </>
);
