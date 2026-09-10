import React from "react";

import type { Layout } from "./layout";
import { SIDEBAR_BG } from "./theme";

// A suggestion of an IDE rather than a working one: the strip runs off
// the left edge of the frame so only part of each icon is ever visible,
// and everything on it is heavily dimmed. If this ever grows a file tree
// or a terminal it has stopped being this clip.
export const Sidebar: React.FC<{ layout: Layout }> = ({ layout }) => {
  const { sidebarVisible, sidebarFull, height } = layout;
  const iconSize = Math.round(sidebarFull * 0.34);
  const centerX = sidebarFull * 0.6;
  const firstTop = height * 0.1;
  const step = iconSize * 2.35;

  const icons = [0, 1, 2, 3, 4, 5];

  return (
    <div
      style={{
        position: "absolute",
        left: sidebarVisible - sidebarFull,
        top: 0,
        width: sidebarFull,
        height: "100%",
        backgroundColor: SIDEBAR_BG,
      }}
    >
      {icons.map((i) => {
        const active = i === 1;
        return (
          <svg
            key={i}
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            style={{
              position: "absolute",
              left: centerX - iconSize / 2,
              top: firstTop + i * step,
              opacity: active ? 0.26 : 0.12,
            }}
          >
            {i === 0 ? (
              <path
                d="M3 5h7l2 2h9v12H3z"
                fill="none"
                stroke="#c9d1d9"
                strokeWidth="1.6"
              />
            ) : null}
            {i === 1 ? (
              <>
                <circle cx="10" cy="10" r="6" fill="none" stroke="#c9d1d9" strokeWidth="1.8" />
                <path d="M14.5 14.5 20 20" stroke="#c9d1d9" strokeWidth="1.8" />
              </>
            ) : null}
            {i === 2 ? (
              <path
                d="M6 4v6a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v4M6 4a2 2 0 1 0 0-.001M18 20a2 2 0 1 0 0 .001"
                fill="none"
                stroke="#c9d1d9"
                strokeWidth="1.6"
              />
            ) : null}
            {i === 3 ? (
              <>
                <rect x="4" y="4" width="7" height="7" fill="none" stroke="#c9d1d9" strokeWidth="1.6" />
                <rect x="13" y="13" width="7" height="7" fill="none" stroke="#c9d1d9" strokeWidth="1.6" />
              </>
            ) : null}
            {i === 4 ? (
              <path
                d="M4 7h16M4 12h16M4 17h10"
                fill="none"
                stroke="#c9d1d9"
                strokeWidth="1.6"
              />
            ) : null}
            {i === 5 ? (
              <circle cx="12" cy="12" r="7" fill="none" stroke="#c9d1d9" strokeWidth="1.6" />
            ) : null}
          </svg>
        );
      })}
    </div>
  );
};
