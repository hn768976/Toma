import { DURATION } from "../theme";
import { loopFrame, pick, rndInt } from "./util";

export type FlickerEvent = { start: number; end: number; ids: string[] };

/**
 * Two or three elements drop to 30% for two or three frames, every 90-160
 * frames. Any event that would straddle frame 600 is dropped, so the schedule
 * is identical on every pass of the loop.
 */
export const flickerSchedule = (ids: string[], seed: string): FlickerEvent[] => {
  const events: FlickerEvent[] = [];
  let t = rndInt(`${seed}-t0`, 24, 90);
  let i = 0;

  while (t < DURATION && i < 32) {
    const duration = rndInt(`${seed}-d-${i}`, 2, 3);
    if (t + duration <= DURATION) {
      const count = Math.min(ids.length, rndInt(`${seed}-c-${i}`, 2, 3));
      const chosen: string[] = [];
      for (let attempt = 0; attempt < 40 && chosen.length < count; attempt++) {
        const id = pick(`${seed}-p-${i}-${attempt}`, ids);
        if (!chosen.includes(id)) {
          chosen.push(id);
        }
      }
      events.push({ start: t, end: t + duration, ids: chosen });
    }
    t += rndInt(`${seed}-g-${i}`, 90, 160);
    i++;
  }

  return events;
};

export const flickeringAt = (events: FlickerEvent[], frame: number) => {
  const f = loopFrame(frame);
  const active = new Set<string>();
  events.forEach((e) => {
    if (f >= e.start && f < e.end) {
      e.ids.forEach((id) => active.add(id));
    }
  });
  return active;
};
