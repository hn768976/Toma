import React from "react";
import { CursorTool } from "./model";

/**
 * The on-screen pointer, drawn in UI space so the 3D stage foreshortens
 * it exactly like the rest of the interface - the giveaway in fake
 * screen-capture shots is a cursor that stays axis-aligned while the UI
 * behind it leans away.
 */
export const Cursor: React.FC<{
  x: number;
  y: number;
  tool: CursorTool;
  click: number;
}> = ({ x, y, tool, click }) => {
  const size = 34;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
      }}
    >
      {click > 0 ? (
        <div
          style={{
            position: "absolute",
            left: -22 - click * 14,
            top: -22 - click * 14,
            width: 44 + click * 28,
            height: 44 + click * 28,
            borderRadius: "50%",
            border: "2px solid rgba(226, 246, 255, 0.75)",
            opacity: click * 0.7,
          }}
        />
      ) : null}

      {tool === "razor" ? (
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
          <path
            d="M4 3 L11 3 L11 15 L7.5 19 L4 15 Z"
            fill="#eaf6ff"
            stroke="#0a1118"
            strokeWidth={1.2}
          />
          <path d="M11 3 L18 3 L18 9 L11 9 Z" fill="#9fb6c6" stroke="#0a1118" strokeWidth={1.2} />
        </svg>
      ) : tool === "hand" ? (
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
          <path
            d="M8 13 L8 5.5 A1.4 1.4 0 0 1 10.8 5.5 L10.8 11 L10.8 4 A1.4 1.4 0 0 1 13.6 4 L13.6 11 L13.6 5 A1.4 1.4 0 0 1 16.4 5 L16.4 12 L16.4 8 A1.4 1.4 0 0 1 19 8 L19 15 A6 6 0 0 1 13 21 A5 5 0 0 1 8 16 Z"
            fill="#eaf6ff"
            stroke="#0a1118"
            strokeWidth={1.1}
          />
        </svg>
      ) : tool === "trim" ? (
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
          <path d="M5 4 L5 20 M9 7 L9 17 M19 4 L19 20 M15 7 L15 17" stroke="#ff6a55" strokeWidth={2.2} />
          <path d="M9 12 L15 12" stroke="#ff6a55" strokeWidth={1.6} />
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
          <path
            d="M5 3 L5 19.5 L9.3 15.4 L11.9 21.5 L14.6 20.3 L12.1 14.4 L18 14.2 Z"
            fill="#f4fbff"
            stroke="#080d12"
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
};
