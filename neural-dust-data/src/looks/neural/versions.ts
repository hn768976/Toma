// One row per version. Add a row (and nothing else) to get a new composition.
export type NeuralVersion = {
  id: string;
  node: string; // node tint
  link: string; // link colour
  edge: string; // node edge highlight
  pulse: string; // travelling pulse colour
  bg: string; // background navy
  grid: string; // faint grid line colour
};

export const NEURAL_VERSIONS: NeuralVersion[] = [
  { id: "NeuralLayers-IceBlue", node: "#9FD0F0", link: "#9FD0F0", edge: "#FFFFFF", pulse: "#FFFFFF", bg: "#0A1428", grid: "#1A2C4A" },
  { id: "NeuralLayers-Violet", node: "#B89CFF", link: "#B89CFF", edge: "#F2EAFF", pulse: "#FF6FD8", bg: "#0A1428", grid: "#1E2448" },
];
