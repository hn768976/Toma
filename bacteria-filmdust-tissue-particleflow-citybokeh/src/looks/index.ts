import type { LookFactory } from "../engine/types";
import { createBacteria } from "./bacteria";
import { createBokeh } from "./bokeh";
import { createFilmDust } from "./filmdust";
import { createParticleFlow } from "./particleflow";
import { createTissue } from "./tissue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LOOKS: Record<string, LookFactory<any>> = {
  bacteria: createBacteria,
  bokeh: createBokeh,
  filmdust: createFilmDust,
  particleflow: createParticleFlow,
  tissue: createTissue,
};
export type LookName = keyof typeof LOOKS;
