import React from "react";
import type { Layout } from "../layout";
import type { Theme } from "../theme";
import { FONT_STACK } from "../fonts";
import { reveal } from "../reveal";
import { TIMING } from "../timing";

/**
 * Title and subtitle. The title is set at regular weight on purpose — the
 * restraint is what makes the frame read as a report rather than an advert.
 */
export const Heading: React.FC<{
  title: string;
  subtitle: string;
  theme: Theme;
  layout: Layout;
  frame: number;
}> = ({ title, subtitle, theme, layout, frame }) => {
  const { u } = layout;

  const tp = reveal(frame, TIMING.title.from, TIMING.title.to);
  const sp = reveal(
    frame,
    TIMING.title.from + TIMING.subtitleDelay,
    TIMING.title.to + TIMING.subtitleDelay,
  );

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: u(layout.title.centreY),
          left: 0,
          width: "100%",
          textAlign: "center",
          color: theme.title,
          fontFamily: FONT_STACK,
          fontSize: u(layout.title.fontSize),
          fontWeight: 400,
          letterSpacing: "-0.015em",
          lineHeight: 1,
          opacity: tp,
          transform: `translateY(calc(-50% + ${u((1 - tp) * layout.title.rise)}px))`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          top: u(layout.subtitle.centreY),
          left: 0,
          width: "100%",
          textAlign: "center",
          color: theme.body,
          fontFamily: FONT_STACK,
          fontSize: u(layout.subtitle.fontSize),
          fontWeight: 400,
          lineHeight: 1,
          opacity: sp,
          transform: `translateY(calc(-50% + ${u((1 - sp) * layout.subtitle.rise)}px))`,
        }}
      >
        {subtitle}
      </div>
    </>
  );
};
