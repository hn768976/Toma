import type {WorkflowData} from './workflows';

export const FPS = 30;
export const DURATION = 300;

const START = 10;
/** Frames between a node appearing and the next event. */
const NODE_STEP = 16;
/** Frames between a connector starting to draw and the next event. */
const EDGE_STEP = 12;
/** Stroke-dash draw-on length. */
export const EDGE_DRAW = 12;

export type Schedule = {
  nodeStart: Record<string, number>;
  edgeStart: Record<string, number>;
  buildEnd: number;
};

/**
 * A node lands, then each of its outgoing connectors draws on, then the next
 * node lands. Ordering comes from the variant's data, so a new workflow gets a
 * correct build sequence for free.
 */
export const buildSchedule = (wf: WorkflowData): Schedule => {
  const nodeStart: Record<string, number> = {};
  const edgeStart: Record<string, number> = {};
  let t = START;

  for (const id of wf.order) {
    nodeStart[id] = t;
    t += NODE_STEP;
    for (const e of wf.edges) {
      const key = `${e.from}->${e.to}`;
      if (e.from !== id || key in edgeStart) continue;
      edgeStart[key] = t;
      t += EDGE_STEP;
    }
  }

  return {nodeStart, edgeStart, buildEnd: t};
};

export const NODE_SPRING = {damping: 17, mass: 0.7, stiffness: 130} as const;
