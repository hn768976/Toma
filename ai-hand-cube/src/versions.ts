// One data row per version: colours, framing, timeline.
// To add a colourway, copy a row, give it a new id and change the colours.

export type Palette = {
  background: string; // deep base colour
  glow: string; // soft glow behind the cube
  circuit: string; // circuit traces + cube edges
  text: string; // "AI" letters
  hud: string; // HUD panel lines
  hudAccent: string; // small accent boxes in the HUD
  handBase: string; // satin shell colour of the hand
  handJoint: string; // graphite joints
  rim: string; // rim light on the hand
  key: string; // key light tint
  emissive: number; // overall brightness of cube/edges/glow (warm hues bloom harder)
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
  hudAccent: "#FF7A3A",
  circuit: "#5AD8FF",
  text: "#DFF8FF",
  hud: "#5A9AE8",
  handBase: "#C6CCD5", // light silver-grey (between the brief's #E8ECF2 and the reference's grey metal)
  handJoint: "#3A3E46",
  rim: "#4FA8FF",
  key: "#DCE8FF",
  emissive: 1,
};

const GOLD: Palette = {
  background: "#120804",
  glow: "#3E2108",
  hudAccent: "#FFF0C0",
  circuit: "#FFC870",
  text: "#FFF4E2",
  hud: "#E8A04A",
  handBase: "#D6CBB8", // silver-champagne
  handJoint: "#3E3830",
  rim: "#FFB860",
  key: "#FFF0DC",
  emissive: 0.62,
};

// Dark violet: near-black plum background, violet glow, lavender circuit,
// magenta HUD accents; the hand stays silver with a violet rim light.
const VIOLET: Palette = {
  background: "#0B0416",
  glow: "#34115E",
  hudAccent: "#FF6FD8",
  circuit: "#B98CFF",
  text: "#F3EAFF",
  hud: "#9C6CF0",
  handBase: "#C8C6D8", // silver with a faint cool-violet cast
  handJoint: "#38343F",
  rim: "#A774FF",
  key: "#EEE6FF",
  emissive: 0.85,
};

export const VERSIONS: Version[] = [
  {
    id: "AIHandCube-Story",
    durationInFrames: 450,
    timeline: "story",
    palette: BLUE,
    framing: { cubeScreenX: 0.525, clearLeft: false },
    cubeText: "AI",
  },
  {
    id: "AIHandCube-HoldLoop",
    durationInFrames: 600,
    timeline: "loop",
    palette: BLUE,
    framing: { cubeScreenX: 0.525, clearLeft: false },
    cubeText: "AI",
  },
  {
    id: "AIHandCube-Gold",
    durationInFrames: 450,
    timeline: "story",
    palette: GOLD,
    framing: { cubeScreenX: 0.525, clearLeft: false },
    cubeText: "AI",
  },
  {
    id: "AIHandCube-Mirrored",
    durationInFrames: 600,
    timeline: "loop",
    palette: BLUE,
    framing: { cubeScreenX: 0.68, clearLeft: true },
    cubeText: "AI",
  },
  // Variations of the Hold Loop (composition 2) in two more colourways
  {
    id: "AIHandCube-HoldLoopViolet",
    durationInFrames: 600,
    timeline: "loop",
    palette: VIOLET,
    framing: { cubeScreenX: 0.525, clearLeft: false },
    cubeText: "AI",
  },
  {
    id: "AIHandCube-HoldLoopGold",
    durationInFrames: 600,
    timeline: "loop",
    palette: GOLD,
    framing: { cubeScreenX: 0.525, clearLeft: false },
    cubeText: "AI",
  },
];
