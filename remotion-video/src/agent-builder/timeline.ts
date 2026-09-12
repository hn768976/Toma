// Every beat in the 450-frame piece, in one place.
//
// Both layouts read from these helpers, so the two cuts stay frame-locked to
// each other and to the reference clip.

import { interpolate } from "remotion";
import { NODES, PROMPT } from "./content";

export const T = {
  chromeIn: 0,
  panelsIn: 6,
  typeStart: 30,
  typeEnd: 146,
  buildPress: 150,
  firstNode: 155,
  nodeStagger: 28,
  buildDone: 320,
  execStart: 330,
  execStagger: 18,
  ready: 440,
} as const;

export const lastNodeIn = T.firstNode + (NODES.length - 1) * T.nodeStagger;
export const execEnd = T.execStart + NODES.length * T.execStagger;

/** How many characters of PROMPT are visible on a given frame. */
export const typedChars = (frame: number) =>
  Math.round(
    interpolate(frame, [T.typeStart, T.typeEnd], [0, PROMPT.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

export const typedText = (frame: number) => PROMPT.slice(0, typedChars(frame));

/** Frame a node card drops onto the canvas. */
export const nodeInFrame = (i: number) => T.firstNode + i * T.nodeStagger;

/** Frame a node starts executing. */
export const nodeExecFrame = (i: number) => T.execStart + i * T.execStagger;

export type NodeState = "pending" | "placed" | "running" | "done";

export const nodeState = (i: number, frame: number): NodeState => {
  if (frame < nodeInFrame(i)) return "pending";
  const exec = nodeExecFrame(i);
  if (frame < exec) return "placed";
  if (frame < exec + T.execStagger) return "running";
  return "done";
};

export const placedNodeCount = (frame: number) =>
  NODES.filter((_, i) => frame >= nodeInFrame(i)).length;

/** Build-progress percentage shown in the status bar, 0-100. */
export const buildProgress = (frame: number) =>
  interpolate(
    frame,
    [0, T.typeStart, T.typeEnd, 195, 285, 375, T.ready],
    [0, 2, 35, 61, 75, 94, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

export const statusLabel = (frame: number) => {
  if (frame >= T.ready) return "WORKFLOW READY";
  if (frame >= T.execStart) return "EXECUTING RUN #001";
  if (frame >= T.buildPress) return "GENERATING WORKFLOW";
  if (frame >= T.typeStart) return "PARSING INSTRUCTION";
  return "AWAITING INPUT";
};

export const agentStatus = (frame: number) => {
  if (frame >= T.ready) return "Workflow Ready";
  if (frame >= T.execStart) return "Executing";
  if (frame >= T.buildPress) return "Building";
  return "";
};

export const buildButtonLabel = (frame: number) => {
  if (frame >= T.buildDone) return "AGENT BUILT";
  if (frame >= T.buildPress) {
    const dots = Math.floor((frame - T.buildPress) / 8) % 4;
    return `BUILDING${".".repeat(dots)}`;
  }
  return "BUILD AGENT";
};

/** "T 00:07.4 / 00:15.0" */
export const timecode = (frame: number, fps: number, total: number) => {
  const fmt = (f: number) => {
    const s = f / fps;
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${s
      .toFixed(1)
      .padStart(4, "0")}`;
  };
  return `T ${fmt(frame)} / ${fmt(total)}`;
};
