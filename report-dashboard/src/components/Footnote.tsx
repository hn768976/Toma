import React from "react";
import type { Layout } from "../layout";
import type { Theme } from "../theme";
import { FONT_STACK } from "../fonts";
import { reveal } from "../reveal";

/**
 * The data disclaimer. Dim, but never hidden: it has to survive the encode and
 * stay readable at 1080p, so it is set at a size that clears the type floor
 * rather than at whatever looks smallest.
 */
export const Footnote: React.FC<{
  text: string;
  theme: Theme;
  layout: Layout;
  frame: number;
}> = ({ text, theme, layout, frame }) => {
  const { u, footnote } = layout;
  const p = reveal(frame, 250, 290);

  return (
    <div
      style={{
        position: "absolute",
        top: u(footnote.centreY),
        left: 0,
        width: "100%",
        textAlign: "center",
        transform: "translateY(-50%)",
        color: theme.footnote,
        fontFamily: FONT_STACK,
        fontSize: u(footnote.fontSize),
        fontWeight: 400,
        letterSpacing: `${footnote.tracking}em`,
        lineHeight: 1,
        opacity: p,
      }}
    >
      {text}
    </div>
  );
};
