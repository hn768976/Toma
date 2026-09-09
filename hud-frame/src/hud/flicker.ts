import { buildLayout } from "./layout";
import { mulberry32 } from "./random";
import { DURATION_IN_FRAMES } from "./constants";

type Event = { start: number; end: number; depth: number };

/**
 * A fixed flicker schedule: a few furniture elements dim for a frame or two,
 * rarely. Built once from a constant seed over the element ids (which do not
 * depend on the composition size), so every render thread agrees and the
 * schedule repeats exactly on `frame % 600`.
 */
const buildSchedule = (): Map<string, Event[]> => {
  const rand = mulberry32(0x5eed_1a7c);
  const ids = buildLayout(1, 1).elements.map((e) => e.id);
  const schedule = new Map<string, Event[]>();
  for (const id of ids) {
    const events: Event[] = [];
    // Roughly half the elements never flicker at all.
    const count = rand() < 0.5 ? 0 : 1 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      // Keep events clear of the reveal and of the loop point.
      const start = 180 + Math.floor(rand() * (DURATION_IN_FRAMES - 200));
      const end = start + 1 + Math.floor(rand() * 2);
      events.push({ start, end, depth: 0.15 + rand() * 0.35 });
    }
    if (events.length) schedule.set(id, events);
  }
  return schedule;
};

const SCHEDULE = buildSchedule();

/** Opacity multiplier for `id` at `frame`; 1 when it is not flickering. */
export const flickerAt = (id: string, frame: number): number => {
  const events = SCHEDULE.get(id);
  if (!events) return 1;
  const f = frame % DURATION_IN_FRAMES;
  for (const e of events) {
    if (f >= e.start && f < e.end) return e.depth;
  }
  return 1;
};
