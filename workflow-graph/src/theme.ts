export type IconKind =
  | "globe"
  | "globeGreen"
  | "globeCyan"
  | "power"
  | "refresh"
  | "router"
  | "cloud"
  | "sign"
  | "agent"
  | "sparkle"
  | "db"
  | "plus"
  | "pencil"
  | "braces"
  | "form";

export type Theme = {
  name: string;
  // CSS background behind the WebGL canvas
  bgInner: string;
  bgMid: string;
  bgOuter: string;
  fog: string;
  // Ground plane
  gridLine: string;
  gridDot: string;
  label: string;
  // Tiles
  topA: string;
  topB: string;
  rim: string;
  rimGlow: string;
  side: string;
  ghostTop: string;
  ghostRim: string;
  ghostSide: string;
  shadow: string;
  // Connections
  wire: string;
  dotted: string;
  // Icons
  icon: Record<IconKind, string>;
  iconAccent: Partial<Record<IconKind, string>>;
  text: string;
};

// Matches the reference: deep navy stage, blue glassy tiles, white wires.
export const referenceTheme: Theme = {
  name: "reference",
  bgInner: "#1b3d62",
  bgMid: "#0c1d33",
  bgOuter: "#02050a",
  fog: "rgba(2, 5, 10, 0.92)",
  gridLine: "rgba(120, 170, 230, 0.07)",
  gridDot: "rgba(150, 200, 255, 0.38)",
  label: "rgba(150, 200, 255, 0.55)",
  topA: "#18497a",
  topB: "#103659",
  rim: "#94c4ee",
  rimGlow: "rgba(110, 175, 240, 0.55)",
  side: "#25609a",
  ghostTop: "#12304d",
  ghostRim: "rgba(110, 170, 230, 0.35)",
  ghostSide: "#16395c",
  shadow: "rgba(0, 4, 12, 1)",
  wire: "#f2f7ff",
  dotted: "#e6f0ff",
  icon: {
    globe: "#f4f8ff",
    globeGreen: "#3ee07a",
    globeCyan: "#3fe6ff",
    power: "#46f06a",
    refresh: "#f4f8ff",
    router: "#c88cff",
    cloud: "#f4f8ff",
    sign: "#ff9a2e",
    agent: "#e8f2ff",
    sparkle: "#22e4ff",
    db: "#ff4f7a",
    plus: "#ffd23a",
    pencil: "#ffd23a",
    braces: "#f4f8ff",
    form: "#f4f8ff",
  },
  iconAccent: {
    globe: "#ff6b8a",
    globeCyan: "#ffe14d",
    cloud: "#2b9bff",
    db: "#a066ff",
    router: "#7a4cff",
    sign: "#c76414",
  },
  text: "#f2f7ff",
};

// Variant: warm "ember" palette — plum/black stage, copper tiles, gold wires.
export const emberTheme: Theme = {
  name: "ember",
  bgInner: "#5a1f33",
  bgMid: "#1f0912",
  bgOuter: "#060205",
  fog: "rgba(6, 2, 5, 0.92)",
  gridLine: "rgba(255, 170, 130, 0.06)",
  gridDot: "rgba(255, 190, 150, 0.25)",
  label: "rgba(255, 190, 150, 0.5)",
  topA: "#6e2a3a",
  topB: "#3e1424",
  rim: "#ffc89a",
  rimGlow: "rgba(255, 150, 90, 0.9)",
  side: "#c4603f",
  ghostTop: "#2a0d18",
  ghostRim: "rgba(255, 150, 110, 0.5)",
  ghostSide: "#4a1a26",
  shadow: "rgba(8, 0, 3, 1)",
  wire: "#fff1dc",
  dotted: "#ffe6c8",
  icon: {
    globe: "#fff3e6",
    globeGreen: "#ffd166",
    globeCyan: "#ff8fb1",
    power: "#ffd166",
    refresh: "#fff3e6",
    router: "#ff9e6b",
    cloud: "#fff3e6",
    sign: "#7ee0c3",
    agent: "#fff3e6",
    sparkle: "#ffb347",
    db: "#5fd3c4",
    plus: "#ffe08a",
    pencil: "#ffe08a",
    braces: "#fff3e6",
    form: "#fff3e6",
  },
  iconAccent: {
    globe: "#ffb347",
    globeCyan: "#ffe08a",
    cloud: "#ff7a59",
    db: "#2f9e8f",
    router: "#e0504a",
    sign: "#2f9e80",
  },
  text: "#fff3e6",
};
