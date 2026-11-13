export type BrainPalette = {
  name: string;
  background: string;
  anterior: string;
  top: string;
  low: string;
  wave1: string;
  wave2: string;
  vignette: number;
};

/** Version 1 — matches the reference: cyan-white body, green frontal lobe, red low/back accents, red→green formation wave. */
export const referencePalette: BrainPalette = {
  name: "Reference (cyan / green / red)",
  background: "#00070b",
  anterior: "#5cf27a",
  top: "#7fd6f2",
  low: "#ff5a45",
  wave1: "#ff6a4f",
  wave2: "#6dff7e",
  vignette: 0.3,
};

/** Version 2 — alternative palette: molten gold body, magenta frontal lobe, violet accents, violet→gold wave. */
export const emberPalette: BrainPalette = {
  name: "Neural Ember (gold / magenta / violet)",
  background: "#07030a",
  anterior: "#ff4fb0",
  top: "#ffd27a",
  low: "#8a5bff",
  wave1: "#9a6bff",
  wave2: "#ffb03a",
  vignette: 0.6,
};
