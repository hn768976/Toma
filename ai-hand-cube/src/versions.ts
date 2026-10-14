// One data row per version: colours, framing, timeline.
// To add a colourway, copy a row, give it a new id and change the colours.

export type Palette = {
  background: string; // deep base colour
  glow: string; // soft glow behind the cube
  circuit: string; // circuit traces + cube edges
  text: string; // "AI" letters
  hud: string; // HUD panel lines
  handBase: string; // satin shell colour of the hand
  handJoint: string; // graphite joints
  rim: string; // rim light on the hand
  key: string; // key light tint
};

export type Version = {
  id: string;
  durationInFrames: number;
  timeline: "story" | "loop";
  palette: Palette;
  framing: {
    // horizontal screen position of the cube centre (0 = left, 1 = right)
    cubeScreenX: number;
    // keep the left part of the frame clear for copy (panels/particles)
    clearLeft: boolean;
  };
  cubeText: string;
};

const BLUE: Palette = {
  background: "#020A1E",
  glow: "#0A3A8A",
  circuit: "#5AD8FF",
  text: "#DFF8FF",
  hud: "#5A9AE8",
  handBase: "#E8ECF2",
  handJoint: "#3A3E46",
  rim: "#4FA8FF",
  key: "#DCE8FF",
};

const GOLD: Palette = {
  background: "#120804",
  glow: "#6A3A0E",
  circuit: "#FFC870",
  text: "#FFF4E2",
  hud: "#E8A04A",
  handBase: "#F1E8DA",
  handJoint: "#3E3830",
  rim: "#FFB860",
  key: "#FFF0DC",
};

export const VERSIONS: Version[] = [
  {
    id: "AIHandCube_Story",
    durationInFrames: 450,
    timeline: "story",
    palette: BLUE,
    framing: { cubeScreenX: 0.5, clearLeft: false },
    cubeText: "AI",
  },
  {
    id: "AIHandCube_HoldLoop",
    durationInFrames: 600,
    timeline: "loop",
    palette: BLUE,
    framing: { cubeScreenX: 0.5, clearLeft: false },
    cubeText: "AI",
  },
  {
    id: "AIHandCube_Gold",
    durationInFrames: 450,
    timeline: "story",
    palette: GOLD,
    framing: { cubeScreenX: 0.5, clearLeft: false },
    cubeText: "AI",
  },
  {
    id: "AIHandCube_Mirrored",
    durationInFrames: 600,
    timeline: "loop",
    palette: BLUE,
    framing: { cubeScreenX: 0.68, clearLeft: true },
    cubeText: "AI",
  },
];
